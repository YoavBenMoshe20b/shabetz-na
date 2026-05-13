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
  Section, PageMain, Body, Muted, Hint, Button, Card,
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
    missions, dutyExclusions, equipmentGaps,
  } = useApp();
  const approvableRequests = useApprovableLeaveRequests();
  const myAlerts = useAlertsForCompany();

  const myPlatoon = platoons.find((g) => g.id === currentUser?.commandedPlatoonId)
    ?? platoons.find((g) => g.memberIds.includes(currentUser?.id ?? ''));

  // currentStatus is the source of truth.
  const inBase     = soldiers.filter((s) => s.currentStatus === 'in-base').length;
  const atHome     = soldiers.filter((s) => s.currentStatus === 'home').length;
  const inactive   = soldiers.filter((s) => s.currentStatus === 'inactive-temp').length;

  const now = useMemo(() => new Date(), []);
  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const materializedSlots = useMemo(() => materializeWeek({
    missions, platoons, squads, soldiers, leaves, dutyExclusions,
    startDay: todayStart, days: 7,
  }), [missions, platoons, squads, soldiers, leaves, dutyExclusions, todayStart]);

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

        <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/platoon')}>
          פתח שבצ״ק השבוע ←
        </Button>

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
