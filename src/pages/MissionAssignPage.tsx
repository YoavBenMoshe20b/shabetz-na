// MissionAssignPage — /missions/:id/assign
//
// Phase 7.3 part-2: conflict resolution FLOW, not validation error.
// When a platoon's home days fall inside the mission window, the page
// no longer just "warns" — it presents the real-world fixes:
//   • הוסף מחלקה זמינה
//   • החלף ב־<platoon>
//   • השאר בבסיס למשימה (sets PlatoonLeaveDay.status = 'in-base')
//   • יציאה חלקית     (sets PlatoonLeaveDay.status = 'partial')
//   • פתח לו״ז יציאות פלוגתי
//   • אפשר בכל זאת   (explicit override, logged)
//
// The flow logic lives in src/utils/conflictResolution.ts — pure,
// returns option lists. This page wires the chosen action to
// AppContext mutations.
//
// Routes: /missions/:id/assign

import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useApp, useMyCompany } from '../context/AppContext';
import { isCompanyLeadership, isPlatoonLeadership } from '../utils/permissions';
import Header from '../components/Header';
import { buildMissionSummary } from '../utils/missionSummary';
import {
  detectPlatoonLeaveConflicts, resolutionsForPlatoonLeave,
  type PlatoonLeaveConflict, type ConflictResolution,
} from '../utils/conflictResolution';
import {
  Section, PageMain, PageTitle, Body, Muted, Hint, Eyebrow, Button, Toast,
} from '../components/ui';

export default function MissionAssignPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const {
    currentUser, currentRole, missions, platoons, orders,
    platoonLeaveDays, qualifications, equipmentItems,
    updateMission, setPlatoonLeaveDay,
  } = useApp();
  const myCompany = useMyCompany();

  const isCC = isCompanyLeadership(currentRole);
  const isPC = isPlatoonLeadership(currentRole);

  const mission = useMemo(() => missions.find((m) => m.id === id), [missions, id]);
  const order = useMemo(
    () => mission?.orderId ? orders.find((o) => o.id === mission.orderId) : undefined,
    [mission, orders],
  );

  const companyPlatoons = useMemo(
    () => platoons.filter((p) => p.companyId === myCompany?.id),
    [platoons, myCompany],
  );

  const [selectedPlatoonIds, setSelectedPlatoonIds] = useState<string[]>(
    mission?.assignedPlatoonIds ?? [],
  );

  // Resolutions the operator has explicitly applied this session.
  // Used to:
  //  • mark a conflict as "dismissed" (allow-anyway) so it stops
  //    blocking the save CTA;
  //  • show a confirmation toast that's not a static success.
  const [resolved, setResolved] = useState<Record<string, ConflictResolution['kind']>>({});
  const [toast, setToast] = useState<string>('');
  const flashToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  // Effective mission window: mission's own dates take priority, then
  // the parent order's range, then today + 14 days as a soft default.
  const win = useMemo(() => {
    if (mission?.startDate && mission?.endDate) {
      return { from: mission.startDate, to: mission.endDate };
    }
    if (order) return { from: order.startDate, to: order.endDate };
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const e = new Date(t.getTime() + 14 * 86400000);
    return {
      from: t.toISOString().slice(0, 10),
      to:   e.toISOString().slice(0, 10),
    };
  }, [mission, order]);

  const conflicts = useMemo(
    () => detectPlatoonLeaveConflicts({
      selectedPlatoonIds,
      windowFromIso: win.from,
      windowToIso: win.to,
      platoonLeaveDays,
      platoons,
    }),
    [selectedPlatoonIds, win.from, win.to, platoonLeaveDays, platoons],
  );

  const missionSummary = useMemo(() => {
    if (!mission) return [];
    return buildMissionSummary({ mission, platoons, qualifications, equipmentItems });
  }, [mission, platoons, qualifications, equipmentItems]);

  // Route gates AFTER hooks.
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!mission)     return <Navigate to="/missions" replace />;
  if (!isCC && !isPC) return <Navigate to="/home" replace />;

  const togglePlatoon = (pid: string) => {
    setSelectedPlatoonIds((prev) =>
      prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid],
    );
  };

  /** Apply a chosen resolution. Mutations are local (selectedPlatoonIds
   *  patch) or call AppContext (setPlatoonLeaveDay, updateMission). */
  const applyResolution = (c: PlatoonLeaveConflict, r: ConflictResolution) => {
    switch (r.kind) {
      case 'reassign-add-platoon': {
        const add = r.payload?.addPlatoonId;
        if (!add) return;
        setSelectedPlatoonIds((prev) => prev.includes(add) ? prev : [...prev, add]);
        flashToast(`נוספה מחלקה לכיסוי המשימה.`);
        setResolved((prev) => ({ ...prev, [c.platoonId]: r.kind }));
        return;
      }
      case 'reassign-swap-platoon': {
        const add = r.payload?.addPlatoonId;
        const remove = r.payload?.removePlatoonId;
        if (!add || !remove) return;
        setSelectedPlatoonIds((prev) =>
          [...prev.filter((x) => x !== remove), ...(prev.includes(add) ? [] : [add])],
        );
        flashToast(`המחלקה הוחלפה.`);
        setResolved((prev) => ({ ...prev, [c.platoonId]: r.kind }));
        return;
      }
      case 'override-keep-in-base':
      case 'override-partial': {
        const status = r.kind === 'override-keep-in-base' ? 'in-base' : 'partial';
        for (const dateIso of c.homeDayIsos) {
          setPlatoonLeaveDay(dateIso, c.platoonId, status,
            r.kind === 'override-keep-in-base'
              ? `נשמרה בבסיס בשל משימה — ${mission.name}`
              : `יציאה חלקית בשל משימה — ${mission.name}`,
          );
        }
        flashToast(
          r.kind === 'override-keep-in-base'
            ? `${c.platoonName} סומנה כנשארת בבסיס לימים אלו.`
            : `${c.platoonName} סומנה כיציאה חלקית.`,
        );
        setResolved((prev) => ({ ...prev, [c.platoonId]: r.kind }));
        return;
      }
      case 'open-leave-board':
        navigate('/coverage/platoons');
        return;
      case 'allow-anyway':
        setResolved((prev) => ({ ...prev, [c.platoonId]: r.kind }));
        flashToast(`הקונפליקט נדחה — תיווסף סימן ביומן בעת השמירה.`);
        return;
      case 'shift-window-shorter':
        navigate('/coverage/platoons');
        return;
    }
  };

  const unresolved = conflicts.filter((c) => !resolved[c.platoonId]);

  const onSave = () => {
    updateMission(mission.id, { assignedPlatoonIds: selectedPlatoonIds });
    navigate(`/mission/${mission.id}`);
  };

  const canSave = selectedPlatoonIds.length > 0;

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="שיוך משימה" />
      <PageMain>

        <header>
          <Eyebrow>{mission.name}</Eyebrow>
          <PageTitle className="mt-1.5">שיוך מחלקות</PageTitle>
          <Muted className="mt-1.5">
            {missionSummary[0] ?? 'בחר את המחלקות שיאיישו את המשימה.'}
          </Muted>
        </header>

        {toast && <Toast tone="success">{toast}</Toast>}

        {/* Mission summary card — read-only context */}
        <Section label="פרטי המשימה">
          <div className="bg-mil-card border border-mil-border rounded-2xl shadow-card px-5 py-4 space-y-1.5">
            {missionSummary.slice(1).map((line, i) => (
              <Body key={i} className="text-sm leading-snug">{line}</Body>
            ))}
            <div className="pt-2 mt-1 border-t border-mil-border flex items-baseline gap-2">
              <Hint>חלון זמן</Hint>
              <Body className="text-tiny font-semibold tabular-nums">
                {win.from} — {win.to}
              </Body>
            </div>
          </div>
        </Section>

        {/* Platoon picker */}
        <Section label="מחלקות מאיישות">
          {companyPlatoons.length === 0 ? (
            <Muted>אין מחלקות בפלוגה.</Muted>
          ) : (
            <div className="flex flex-wrap gap-2">
              {companyPlatoons.map((p) => {
                const on = selectedPlatoonIds.includes(p.id);
                const hasConflict = conflicts.some((c) => c.platoonId === p.id);
                const isResolved = !!resolved[p.id];
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlatoon(p.id)}
                    className={`px-3.5 py-2 rounded-xl-soft text-sm font-bold transition-colors ${
                      on
                        ? hasConflict && !isResolved
                          ? 'bg-mil-warn-bg text-mil-warn border border-mil-warn'
                          : 'bg-mil-olive text-white'
                        : 'bg-mil-card border border-mil-border text-mil-muted hover:border-mil-olive'
                    }`}
                  >
                    {p.name}
                    {on && hasConflict && !isResolved && <span className="mr-1.5" aria-hidden>⚠</span>}
                    {on && hasConflict && isResolved && <span className="mr-1.5 text-mil-success" aria-hidden>✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </Section>

        {/* Conflict cards — one per platoon with a resolution flow */}
        {conflicts.length > 0 && (
          <Section label={`קונפליקטים (${unresolved.length}/${conflicts.length})`}>
            <div className="space-y-3">
              {conflicts.map((c) => (
                <ConflictCard
                  key={c.platoonId}
                  conflict={c}
                  resolved={resolved[c.platoonId]}
                  resolutions={resolutionsForPlatoonLeave({
                    conflict: c,
                    selectedPlatoonIds,
                    companyPlatoons,
                    platoonLeaveDays,
                  })}
                  onApply={(r) => applyResolution(c, r)}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Save row */}
        <Section label="">
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="lg"
              onClick={onSave}
              disabled={!canSave}
              fullWidth
            >
              {unresolved.length > 0
                ? `שמור שיוך (${unresolved.length} בלי פתרון)`
                : 'שמור שיוך'}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => navigate(`/mission/${mission.id}`)}
            >
              דלג
            </Button>
          </div>
        </Section>

      </PageMain>
    </div>
  );
}

// ─── Conflict card ──────────────────────────────────────────────────
//
// One card per conflicting platoon. Read of the WHAT + a chip list of
// resolution OPTIONS the operator can act on inline. Resolved
// conflicts collapse to a confirmation banner with an "החזר" affordance
// so the operator can reverse without leaving the page.

function ConflictCard({
  conflict, resolved, resolutions, onApply,
}: {
  conflict: PlatoonLeaveConflict;
  resolved: ConflictResolution['kind'] | undefined;
  resolutions: ConflictResolution[];
  onApply: (r: ConflictResolution) => void;
}) {
  const isResolved = !!resolved;

  return (
    <div
      className={`rounded-2xl border px-5 py-4 transition-colors ${
        isResolved
          ? 'bg-mil-card border-mil-success/40'
          : 'bg-mil-warn-bg border-mil-warn'
      }`}
    >
      <div className="flex items-baseline gap-2 flex-wrap">
        <Body className={`font-bold text-sm leading-snug ${isResolved ? 'text-mil-text' : 'text-mil-warn'}`}>
          {conflict.platoonName}
        </Body>
        {isResolved ? (
          <span className="text-xxs font-bold uppercase tracking-wide text-mil-success bg-mil-card px-2 py-0.5 rounded-full border border-mil-success/30">
            ✓ נפתר — {labelFor(resolved)}
          </span>
        ) : (
          <span className="text-xxs font-bold uppercase tracking-wide text-mil-warn">
            דורש החלטה
          </span>
        )}
      </div>
      <Muted className="mt-1 text-tiny leading-snug">{conflict.summary}</Muted>

      {!isResolved && (
        <>
          <Hint className="mt-3 block tracking-wide">פתרונות מוצעים</Hint>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {resolutions.map((r) => (
              <button
                key={r.kind}
                onClick={() => onApply(r)}
                className={`inline-flex items-baseline gap-1.5 px-3 py-1.5 rounded-xl-soft text-tiny font-bold transition-colors border ${
                  r.severity === 'safe'
                    ? 'bg-mil-card border-mil-olive text-mil-olive-dim hover:bg-mil-olive-bg'
                    : r.severity === 'navigate'
                      ? 'bg-mil-card border-mil-border text-mil-muted hover:text-mil-text hover:border-mil-olive'
                      : 'bg-mil-card border-mil-warn text-mil-warn hover:bg-mil-warn-bg'
                }`}
                title={r.hint}
              >
                <span aria-hidden>{r.icon}</span>
                <span>{r.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function labelFor(kind: ConflictResolution['kind'] | undefined): string {
  switch (kind) {
    case 'reassign-add-platoon':  return 'נוספה מחלקה';
    case 'reassign-swap-platoon': return 'הוחלפה מחלקה';
    case 'override-keep-in-base': return 'נשארת בבסיס';
    case 'override-partial':      return 'יציאה חלקית';
    case 'open-leave-board':      return 'נפתח לו״ז יציאות';
    case 'allow-anyway':          return 'אושר עם אזהרה';
    case 'shift-window-shorter':  return 'הזזה';
    default:                      return '';
  }
}
