// MissionAssignPage — /missions/:id/assign
//
// The deliberate seam between mission CREATION and mission ASSIGNMENT.
// The wizard (or PC quick-create) produces a mission definition; this
// page is where the CC says "and now MY platoon-A and platoon-C will own
// it." Critically, it surfaces leave-day conflicts BEFORE confirmation —
// "מחלקה ג׳ יוצאת הביתה 18–21 במאי, חלק מהמשימה חופף יציאה" — so the
// operator catches the calendar collision without leaving the page.
//
// Routes: /missions/:id/assign
//
// Why a separate page (and not just a step in the wizard):
//   1. After a mission is created, the operator often re-assigns it
//      across orders / weeks; that flow doesn't need the 6-step wizard.
//   2. Smart templates skip the wizard entirely and need a dedicated
//      assignment surface afterwards.
//   3. Leave-aware assignment needs platoonLeaveDays input that the
//      wizard's step-5 platoon picker doesn't reason about.

import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useApp, useMyCompany } from '../context/AppContext';
import { isCompanyLeadership, isPlatoonLeadership } from '../utils/permissions';
import Header from '../components/Header';
import { buildMissionSummary } from '../utils/missionSummary';
import {
  Section, PageMain, PageTitle, Body, Muted, Hint, Eyebrow, Button,
} from '../components/ui';

interface LeaveConflict {
  platoonId: string;
  platoonName: string;
  homeDayCount: number;
  firstHomeIso: string;
  lastHomeIso: string;
}

export default function MissionAssignPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const {
    currentUser, currentRole, missions, platoons, orders,
    platoonLeaveDays, qualifications, equipmentItems, updateMission,
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

  // Effective mission window: mission's own dates take priority, then
  // the parent order's range, then today + 14 days as a soft default.
  const window = useMemo(() => {
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

  // For each selected platoon, count home-status days that fall inside
  // the mission window. Anything > 0 is a conflict.
  const conflicts: LeaveConflict[] = useMemo(() => {
    return selectedPlatoonIds.flatMap((pid) => {
      const days = platoonLeaveDays
        .filter((d) =>
          d.platoonId === pid
          && d.status === 'home'
          && d.dateIso >= window.from
          && d.dateIso <= window.to,
        )
        .map((d) => d.dateIso)
        .sort();
      if (days.length === 0) return [];
      const platoon = platoons.find((p) => p.id === pid);
      return [{
        platoonId: pid,
        platoonName: platoon?.name ?? pid,
        homeDayCount: days.length,
        firstHomeIso: days[0],
        lastHomeIso: days[days.length - 1],
      }];
    });
  }, [selectedPlatoonIds, platoonLeaveDays, platoons, window.from, window.to]);

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

        {/* Mission summary card — read-only context */}
        <Section label="פרטי המשימה">
          <div className="bg-mil-card border border-mil-border rounded-2xl shadow-card px-5 py-4 space-y-1.5">
            {missionSummary.slice(1).map((line, i) => (
              <Body key={i} className="text-sm leading-snug">{line}</Body>
            ))}
            <div className="pt-2 mt-1 border-t border-mil-border flex items-baseline gap-2">
              <Hint>חלון זמן</Hint>
              <Body className="text-tiny font-semibold tabular-nums">
                {window.from} — {window.to}
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
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlatoon(p.id)}
                    className={`px-3.5 py-2 rounded-xl-soft text-sm font-bold transition-colors ${
                      on
                        ? hasConflict
                          ? 'bg-mil-warn-bg text-mil-warn border border-mil-warn'
                          : 'bg-mil-olive text-white'
                        : 'bg-mil-card border border-mil-border text-mil-muted hover:border-mil-olive'
                    }`}
                  >
                    {p.name}
                    {on && hasConflict && <span className="mr-1.5" aria-hidden>⚠</span>}
                  </button>
                );
              })}
            </div>
          )}
        </Section>

        {/* Leave-conflict warnings */}
        {conflicts.length > 0 && (
          <Section label="התראת חפיפה ליציאות פלוגתיות">
            <div className="bg-mil-warn-bg border border-mil-warn rounded-2xl px-5 py-4 space-y-2">
              <Body className="text-sm font-semibold text-mil-warn">
                {conflicts.length === 1
                  ? 'מחלקה אחת מתוכננת ליציאה בחלון המשימה.'
                  : `${conflicts.length} מחלקות מתוכננות ליציאה בחלון המשימה.`}
              </Body>
              <ul className="space-y-1.5">
                {conflicts.map((c) => (
                  <li key={c.platoonId} className="text-tiny text-mil-text leading-snug">
                    <span className="font-bold">{c.platoonName}</span>
                    {' — '}
                    {c.homeDayCount === 1
                      ? `יום יציאה אחד (${c.firstHomeIso})`
                      : `${c.homeDayCount} ימי יציאה (${c.firstHomeIso} – ${c.lastHomeIso})`}
                  </li>
                ))}
              </ul>
              <Muted className="text-tiny pt-1">
                ניתן להמשיך, אך מומלץ לשייך מחלקה נוספת או לעדכן את ימי היציאה ב־
                <button
                  onClick={() => navigate('/coverage/platoons')}
                  className="underline font-bold text-mil-warn hover:text-mil-text"
                >
                  לוח יציאות פלוגתיות
                </button>
                .
              </Muted>
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
              שמור שיוך
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
