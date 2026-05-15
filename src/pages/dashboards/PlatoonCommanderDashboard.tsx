// Platoon Commander / Sergeant Dashboard — timeline-led action queue.
//
// Same shape as CC but scoped to the commanded platoon. Reads top-to-bottom:
//   1. Status hero (in-base / total + readiness bar + floor warning)
//   2. Active missions (calmer card row, only when there's actually one running)
//   3. Announcements strip
//   4. Next 12 hours
//   5. Open שבצ״ק CTA
//   6. Platoon management (gaps + delegations)

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useApp, useApprovableLeaveRequests, useAlertsForCompany,
} from '../../context/AppContext';
import { buildPlatoonTimeline } from '../../utils/timeline';
import { materializeWeek } from '../../utils/materialize';
import Header from '../../components/Header';
import {
  Section, PageMain, Body, Muted, Hint, Card,
} from '../../components/ui';
import AnnouncementsStrip from '../../components/AnnouncementsStrip';
import AlertsButton from '../../components/AlertsButton';
import PersonalActionsFab from '../../components/PersonalActionsFab';
import { TimelineCard } from './_shared/TimelineCard';

// ─── ReadinessBar (PC mirror of the CC version) ──────────────────────────

function ReadinessBar({ pct, health }: { pct: number; health: 'ready' | 'warning' | 'critical' }) {
  const tone =
    health === 'critical' ? 'bg-mil-alert' :
    health === 'warning'  ? 'bg-mil-warn'  :
    'bg-mil-success';
  return (
    <div className="mt-4 h-1.5 rounded-full bg-mil-bg-alt overflow-hidden border border-mil-border/40">
      <div className={`h-full ${tone} transition-[width] duration-700 ease-out`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

// ─── CalmCard — empty timeline placeholder ───────────────────────────────

function CalmCard() {
  return (
    <Card variant="muted">
      <div className="px-5 py-8 text-center">
        <Body className="font-bold text-mil-olive-dim">הכל רגוע</Body>
        <Muted className="mt-1.5">אין שינויים מתוכננים ב-12 השעות הקרובות</Muted>
      </div>
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────

export default function PlatoonCommanderDashboard() {
  const navigate = useNavigate();
  const {
    soldiers, leaves, platoons, squads, currentUser, soldierStatusEvents,
    missions, dutyExclusions, equipmentGaps, assignments,
    slotOperationalState, platoonLeaveDays,
  } = useApp();
  const approvableRequests = useApprovableLeaveRequests();
  const myAlerts = useAlertsForCompany();

  const myPlatoon = platoons.find((g) => g.id === currentUser?.commandedPlatoonId)
    ?? platoons.find((g) => g.memberIds.includes(currentUser?.id ?? ''));

  // currentStatus is the source of truth. SCOPED to the PC's own
  // platoon — without this, the hero counted every soldier in the
  // company and PC g1 saw "72/74" (company-wide totals).
  const myPlatoonSoldiers = useMemo(() => {
    if (!myPlatoon) return soldiers;
    const sqIds = new Set(squads.filter((sq) => sq.platoonId === myPlatoon.id).map((sq) => sq.id));
    return soldiers.filter((s) => s.squadId && sqIds.has(s.squadId));
  }, [soldiers, squads, myPlatoon]);
  const inBase     = myPlatoonSoldiers.filter((s) => s.currentStatus === 'in-base').length;
  const atHome     = myPlatoonSoldiers.filter((s) => s.currentStatus === 'home').length;
  const inactive   = myPlatoonSoldiers.filter((s) => s.currentStatus === 'inactive-temp').length;

  const now = useMemo(() => new Date(), []);
  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const materializedSlots = useMemo(() => materializeWeek({
    missions, platoons, squads, soldiers, leaves, dutyExclusions,
    startDay: todayStart, days: 7,
    assignments,
    slotOperationalState,
  }), [missions, platoons, squads, soldiers, leaves, dutyExclusions, todayStart, assignments, slotOperationalState]);

  const myPlatoonSlots = useMemo(() =>
    myPlatoon
      ? materializedSlots.filter((slot) => slot.ownerPlatoonId === myPlatoon.id)
      : materializedSlots,
    [materializedSlots, myPlatoon],
  );

  const activeMissions = useMemo(() => {
    return myPlatoonSlots.filter((slot) => {
      const s = Date.parse(slot.start);
      const e = Date.parse(slot.end);
      return s <= now.getTime() && now.getTime() < e;
    });
  }, [myPlatoonSlots, now]);

  const pendingApprovals = approvableRequests.filter((r) => r.status === 'pending').length;
  const events = useMemo(() => buildPlatoonTimeline({
    now, materializedSlots, ownerPlatoonId: myPlatoon?.id, leaves, soldiers,
    pendingApprovals, recentAlerts: myAlerts, statusEvents: soldierStatusEvents,
    horizonHours: 12,
  }), [now, materializedSlots, myPlatoon, leaves, soldiers, pendingApprovals, myAlerts, soldierStatusEvents]);

  const platoonFloor = myPlatoon?.minSoldiersOnBase ?? 0;
  const totalAssigned = inBase + atHome + inactive;
  const platoonHealth: 'ready' | 'warning' | 'critical' =
    platoonFloor > 0 && inBase < platoonFloor      ? 'critical' :
    platoonFloor > 0 && inBase === platoonFloor    ? 'warning'  :
    'ready';
  const readinessPct = totalAssigned > 0 ? (inBase / totalAssigned) * 100 : 0;

  const openGapCount = useMemo(() =>
    equipmentGaps.filter((g) =>
      (g.reportedByPlatoonId === myPlatoon?.id) &&
      (g.status === 'reported' || g.status === 'reviewed-by-platoon')
    ).length,
    [equipmentGaps, myPlatoon],
  );

  // ── Coverage picture (read-only for PC/PS) ────────────────────────
  // What this section answers in a glance: which of MY soldiers are
  // currently away (or about to be), what their ETA back is, and which
  // squads are most depleted right now. This is the platoon-level
  // mirror of CC's "company coverage" board, available in Phase 1.
  const platoonSoldierIds = useMemo(
    () => new Set(soldiers.filter((s) => s.squadId && squads.find((sq) => sq.id === s.squadId)?.platoonId === myPlatoon?.id).map((s) => s.id)),
    [soldiers, squads, myPlatoon],
  );

  const activeLeaves = useMemo(() => {
    const nowTs = now.getTime();
    return leaves
      .filter((l) => {
        const start = Date.parse(`${l.startDate}T${l.startTime || '00:00'}:00`);
        const end   = Date.parse(`${l.endDate}T${l.endTime   || '23:59'}:00`);
        if (!(start <= nowTs && nowTs <= end)) return false;
        // any soldier in scope belongs to my platoon
        if (l.scope === 'individual') return l.soldierIds.some((id) => platoonSoldierIds.has(id));
        if (l.scope === 'squad') {
          return !!l.squadId && squads.find((sq) => sq.id === l.squadId)?.platoonId === myPlatoon?.id;
        }
        return false; // 'machlaka' shown only when it's MY machlaka — handled by individuals filter
      })
      .slice(0, 5);
  }, [leaves, now, platoonSoldierIds, squads, myPlatoon]);

  const squadBreakdown = useMemo(() => {
    if (!myPlatoon) return [];
    const mySquads = squads.filter((sq) => sq.platoonId === myPlatoon.id);
    return mySquads.map((sq) => {
      const members = soldiers.filter((s) => s.squadId === sq.id);
      const home    = members.filter((s) => s.currentStatus === 'home').length;
      return { id: sq.id, name: sq.name, total: members.length, atHome: home, inBase: members.length - home };
    });
  }, [squads, myPlatoon, soldiers]);

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title={myPlatoon?.name ?? 'מחלקה'} />
      <PageMain>

        <header>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-1.5 text-tiny text-mil-muted min-w-0">
              {myPlatoon?.unitName && (
                <>
                  <span>{myPlatoon.unitName}</span>
                  <span className="text-mil-ghost">·</span>
                </>
              )}
              <span>{myPlatoon?.name ?? 'מחלקה'}</span>
            </div>
            <AlertsButton />
          </div>

          <div className="mt-3 flex items-baseline gap-2.5 flex-wrap">
            <span className="text-[48px] leading-[0.9] font-extrabold tabular-nums tracking-tight text-mil-text">
              {inBase}
            </span>
            <span className="text-mil-ghost text-lg tabular-nums">/ {totalAssigned}</span>
            <span className="text-sm font-semibold text-mil-text mr-1">בבסיס עכשיו</span>

            <div className="mr-auto flex items-baseline gap-3">
              {atHome > 0 && (
                <span className="text-tiny text-mil-muted">
                  <span className="tabular-nums font-bold text-mil-text">{atHome}</span> בבית
                </span>
              )}
              {inactive > 0 && (
                <span className="text-tiny text-mil-muted">
                  <span className="tabular-nums font-bold text-mil-text">{inactive}</span> לא פעיל
                </span>
              )}
            </div>
          </div>

          <ReadinessBar pct={readinessPct} health={platoonHealth} />

          {platoonFloor > 0 && inBase < platoonFloor && (
            <div className="mt-3 inline-flex items-center gap-2 text-mil-alert font-semibold text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-mil-alert" aria-hidden />
              <span>חסר {platoonFloor - inBase} לרצפת המחלקה ({inBase}/{platoonFloor})</span>
            </div>
          )}
        </header>

        {/* Action Center — the PC's primary surface. Shows live staffing
            pressure with: a prominent count, breakdown by severity, and
            up to 3 understaffed slots inline that route directly into
            the platoon week. Designed to feel like a command-and-control
            tile, not a generic dashboard card. */}
        {(() => {
          const understaffed = myPlatoonSlots.filter(
            (s) => s.status === 'partially-staffed' || s.status === 'open',
          );
          const open = understaffed.filter((s) => s.status === 'open');
          const partial = understaffed.filter((s) => s.status === 'partially-staffed');
          const upcoming = understaffed
            .filter((s) => Date.parse(s.start) > now.getTime())
            .sort((a, b) => a.start.localeCompare(b.start))
            .slice(0, 3);

          // Calm green tile when there's nothing to staff.
          if (myPlatoonSlots.length === 0) {
            return (
              <section className="bg-mil-card border border-mil-border rounded-2xl-soft px-5 py-5">
                <Hint className="block uppercase tracking-wide font-semibold text-mil-muted">לוח שיבוץ</Hint>
                <Body className="mt-1 font-semibold text-base">אין משימות פעילות השבוע</Body>
                <Muted className="mt-1 text-tiny leading-snug">כשמ״פ יוריד משימות למחלקה, הן יופיעו כאן.</Muted>
              </section>
            );
          }
          if (understaffed.length === 0) {
            return (
              <section className="bg-mil-success-bg border border-mil-success-border rounded-2xl-soft px-5 py-5">
                <Hint className="block uppercase tracking-wide font-semibold text-mil-success">לוח שיבוץ</Hint>
                <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                  <Body className="font-bold text-lg">הכל מאוייש</Body>
                  <Muted className="text-tiny">{myPlatoonSlots.length} משבצות השבוע</Muted>
                </div>
                <div className="mt-3 flex items-baseline gap-3">
                  <button
                    onClick={() => navigate('/platoon/missions')}
                    className="text-tiny font-semibold text-mil-olive hover:text-mil-olive-dim"
                  >
                    משימות המחלקה ←
                  </button>
                  <button
                    onClick={() => navigate('/platoon')}
                    className="text-tiny font-semibold text-mil-muted hover:text-mil-text"
                  >
                    תצוגת שבוע ←
                  </button>
                </div>
              </section>
            );
          }

          return (
            <section className="bg-mil-card border-2 border-mil-warn-border rounded-2xl-soft overflow-hidden shadow-card">
              <header className="bg-mil-warn-bg px-5 py-4 border-b border-mil-warn-border">
                <Hint className="block uppercase tracking-wide font-bold text-mil-warn">דורש איוש</Hint>
                <div className="mt-1 flex items-baseline gap-2.5 flex-wrap">
                  <span className="text-3xl font-extrabold tabular-nums text-mil-warn">{understaffed.length}</span>
                  <Body className="font-semibold">משבצות פתוחות השבוע</Body>
                </div>
                <Muted className="mt-1 text-tiny tabular-nums">
                  {open.length > 0 && <><span className="font-bold text-mil-alert">{open.length}</span> ללא איוש · </>}
                  {partial.length > 0 && <><span className="font-bold text-mil-warn">{partial.length}</span> חלקי · </>}
                  {myPlatoonSlots.length} סה״כ
                </Muted>
              </header>

              {upcoming.length > 0 && (
                <div className="divide-y divide-mil-border">
                  {upcoming.map((slot) => {
                    const sDate = new Date(slot.start);
                    const eDate = new Date(slot.end);
                    const dayLabel = `${sDate.getDate().toString().padStart(2, '0')}/${(sDate.getMonth() + 1).toString().padStart(2, '0')}`;
                    const timeRange = `${sDate.getHours().toString().padStart(2, '0')}:${sDate.getMinutes().toString().padStart(2, '0')}–${eDate.getHours().toString().padStart(2, '0')}:${eDate.getMinutes().toString().padStart(2, '0')}`;
                    const assignedCount = slot.assignedSoldierIds.length + (slot.commanderSoldierId ? 1 : 0);
                    const isOpen = slot.status === 'open';
                    return (
                      <button
                        key={slot.id}
                        onClick={() => navigate('/platoon/missions')}
                        className="w-full text-right px-5 py-3 hover:bg-mil-card-warm/40 transition-colors flex items-center gap-3"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOpen ? 'bg-mil-alert' : 'bg-mil-warn'}`} aria-hidden />
                        <div className="flex-1 min-w-0">
                          <Body className="font-semibold leading-tight truncate text-sm">{slot.missionName}</Body>
                          <Hint className="block mt-0.5 text-mil-muted font-mono tabular-nums">
                            {dayLabel} · {timeRange}
                          </Hint>
                        </div>
                        <span className={`text-xs font-bold tabular-nums ${isOpen ? 'text-mil-alert' : 'text-mil-warn'}`}>
                          {assignedCount}/{slot.requiredCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                onClick={() => navigate('/platoon/missions')}
                className="w-full bg-mil-olive hover:bg-mil-olive-light text-white px-5 py-3.5 font-bold text-base transition-colors"
              >
                אייש עכשיו ←
              </button>
            </section>
          );
        })()}

        {activeMissions.length > 0 && (
          <Section label="פעיל עכשיו">
            <div className="bg-mil-card border border-mil-border rounded-2xl divide-y divide-mil-border overflow-hidden">
              {activeMissions.map((slot) => {
                const ids = [...slot.assignedSoldierIds];
                if (slot.commanderSoldierId) ids.push(slot.commanderSoldierId);
                const names = ids
                  .map((id) => soldiers.find((s) => s.id === id)?.name?.split(' ')[0])
                  .filter(Boolean) as string[];
                const s = new Date(slot.start);
                const e = new Date(slot.end);
                const hh = (d: Date) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                return (
                  <div key={slot.id} className="px-5 py-3.5 flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-mil-olive flex-shrink-0" aria-hidden />
                    <Body className="font-semibold">{slot.missionName}</Body>
                    <Muted className="truncate mr-auto text-mil-olive-dim">
                      {names.length > 0 ? names.join(' · ') : '—'}
                    </Muted>
                    <Hint className="font-mono tabular-nums">{hh(s)}–{hh(e)}</Hint>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        <AnnouncementsStrip isCommander={true} />

        {/* יציאות מחלקה — upcoming home days for the PC's platoon.
            Read-only on the dashboard; the CC drives the rotation from
            /coverage/platoons. Auto-hides when there are zero upcoming
            home days in the next 30. */}
        {(() => {
          if (!myPlatoon) return null;
          const todayIso = new Date().toISOString().slice(0, 10);
          const upcoming = platoonLeaveDays
            .filter((d) => d.platoonId === myPlatoon.id && d.status === 'home' && d.dateIso >= todayIso)
            .sort((a, b) => a.dateIso.localeCompare(b.dateIso));
          if (upcoming.length === 0) return null;
          // Cluster consecutive days into stints.
          const stints: Array<{ from: string; to: string }> = [];
          for (const d of upcoming) {
            const last = stints[stints.length - 1];
            if (!last) { stints.push({ from: d.dateIso, to: d.dateIso }); continue; }
            const nextDay = new Date(last.to); nextDay.setDate(nextDay.getDate() + 1);
            if (nextDay.toISOString().slice(0, 10) === d.dateIso) {
              last.to = d.dateIso;
            } else {
              stints.push({ from: d.dateIso, to: d.dateIso });
            }
          }
          const fmt = (iso: string) => {
            const dt = new Date(iso);
            return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
          };
          const nextStint = stints[0];
          const nextStintDays = (() => {
            const from = new Date(nextStint.from);
            const to = new Date(nextStint.to);
            return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
          })();
          const daysAway = Math.max(0, Math.round((new Date(nextStint.from).getTime() - new Date(todayIso).getTime()) / 86_400_000));
          return (
            <Section label="יציאות המחלקה">
              <div className="bg-mil-card border border-mil-border rounded-2xl-soft shadow-card overflow-hidden">
                <div className="bg-mil-info-bg px-5 py-4 border-b border-mil-info-border">
                  <Hint className="block uppercase tracking-wide font-bold text-mil-info">הסבב הקרוב</Hint>
                  <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                    <Body className="font-bold text-base">
                      {fmt(nextStint.from)}{nextStint.from !== nextStint.to && ` – ${fmt(nextStint.to)}`}
                    </Body>
                    <Hint className="text-mil-muted">· {nextStintDays} ימים · בעוד {daysAway} ימים</Hint>
                  </div>
                </div>
                {stints.length > 1 && (
                  <div className="px-5 py-3 divide-y divide-mil-border">
                    {stints.slice(1).map((st) => (
                      <div key={st.from} className="py-2 first:pt-0 last:pb-0 flex items-baseline gap-2">
                        <Hint className="font-mono tabular-nums text-mil-muted">
                          {fmt(st.from)}{st.from !== st.to && ` – ${fmt(st.to)}`}
                        </Hint>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => navigate('/coverage/platoons')}
                  className="w-full text-center bg-mil-bg-alt hover:bg-mil-card px-5 py-2.5 text-tiny font-semibold text-mil-muted transition-colors border-t border-mil-border"
                >
                  לוח יציאות פלוגתי ←
                </button>
              </div>
            </Section>
          );
        })()}

        <Section label="השעות הקרובות">
          {events.length === 0 ? (
            <CalmCard />
          ) : (
            <div className="space-y-2.5">
              {events.map((ev) => (
                <TimelineCard key={ev.id} event={ev} onCta={() => ev.ctaHref && navigate(ev.ctaHref)} />
              ))}
            </div>
          )}
        </Section>

        <Section label="כיסוי המחלקה">
          <Card>
            <div className="px-5 py-4 space-y-4">
              <div>
                <Hint>חלוקה לכיתות</Hint>
                <div className="mt-2 space-y-2">
                  {squadBreakdown.length === 0 ? (
                    <Muted>אין כיתות במחלקה</Muted>
                  ) : squadBreakdown.map((sq) => (
                    <div key={sq.id} className="flex items-baseline gap-2 text-sm">
                      <Body className="font-semibold">{sq.name}</Body>
                      <span className="tabular-nums text-mil-text">{sq.inBase}</span>
                      <Muted>/ {sq.total}</Muted>
                      {sq.atHome > 0 && (
                        <span className="text-tiny text-mil-muted mr-auto">
                          {sq.atHome} בבית
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-mil-border">
                <Hint>חופשות פעילות עכשיו</Hint>
                {activeLeaves.length === 0 ? (
                  <Muted className="mt-1">אף אחד מהמחלקה לא בחופשה כרגע</Muted>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {activeLeaves.map((l) => {
                      const names = l.soldierIds
                        .map((id) => soldiers.find((s) => s.id === id)?.name?.split(' ')[0])
                        .filter(Boolean)
                        .join(' · ');
                      return (
                        <div key={l.id} className="flex items-baseline gap-2 text-sm">
                          <Body>
                            {l.scope === 'squad'
                              ? squads.find((sq) => sq.id === l.squadId)?.name ?? 'כיתה'
                              : (names || `${l.soldierIds.length} חיילים`)}
                          </Body>
                          <Muted className="mr-auto tabular-nums">חזרה {l.endDate} {l.endTime}</Muted>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </Section>

        <Section label="ניהול מחלקה">
          <div className="bg-mil-card border border-mil-border rounded-2xl divide-y divide-mil-border overflow-hidden">
            <button
              onClick={() => navigate('/platoon/gaps')}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-mil-card-warm/40 transition-colors text-right"
            >
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <Body className="font-semibold">ליקויי ציוד</Body>
                  {openGapCount > 0 && (
                    <span className="text-tiny font-bold text-mil-alert tabular-nums">{openGapCount} פתוחים</span>
                  )}
                </div>
                <Hint className="block mt-0.5">דיווחי חיילים והעברה לרס״פ</Hint>
              </div>
              <span className="text-mil-ghost">←</span>
            </button>
            <button
              onClick={() => navigate('/delegations')}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-mil-card-warm/40 transition-colors text-right"
            >
              <div className="flex-1">
                <Body className="font-semibold">פיקוד זמני</Body>
                <Hint className="block mt-0.5">הענק סמכויות לתקופה</Hint>
              </div>
              <span className="text-mil-ghost">←</span>
            </button>
          </div>
        </Section>

      </PageMain>

      {/* Personal capability layer — every PC/PS is FIRST a soldier
          who can submit their own leave request, update own status,
          report damage on their own gear. */}
      <PersonalActionsFab />
    </div>
  );
}
