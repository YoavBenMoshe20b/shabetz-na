import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useApprovableLeaveRequests, useAlertsForCompany, useMyCompany, useMyPlatoons } from '../context/AppContext';
import Header from '../components/Header';
import { isPlatoonLeadership, isCompanyLeadership } from '../utils/permissions';
import { buildPlatoonTimeline, type OpsEvent } from '../utils/timeline';
import { materializeWeek } from '../utils/materialize';
import {
  Card, Button, StatusPill, Section, PageMain, CollapsibleSection,
  PageTitle, CardTitle, Body, Muted, Hint,
} from '../components/ui';
import type { Soldier, SoldierStatus } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hhmm = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const formatRelative = (mins: number): string => {
  if (mins < 0) return 'עכשיו';
  if (mins < 60) return `בעוד ${mins} דקות`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m === 0 ? `בעוד ${h} שעות` : `בעוד ${h}:${m.toString().padStart(2, '0')} שעות`;
  return `בעוד ${Math.floor(h / 24)} ימים`;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { currentRole } = useApp();
  // Three Home variants — same shell, different operational intent.
  if (isCompanyLeadership(currentRole))   return <CompanyCommanderDashboard />; // operational overview
  if (isPlatoonLeadership(currentRole))   return <PlatoonCommanderDashboard />; // timeline-led action queue
  return <SoldierDashboard />;                                                  // hero-led personal
}

// ─── Company Commander Dashboard (command overview) ──────────────────────────
// Designed as a COMMAND PICTURE, not a card list. Reads top-to-bottom as:
//   1. Status now            — typographic hero (total in-base + readiness bar)
//   2. Platoon health        — compact rows, one per platoon, red where weak
//   3. Upcoming (12h)        — timeline of next transitions
//   4. Recent changes        — collapsed by default
// No settings, no greeting card, no 2-col grid. The header bar already shows
// the company name; the first thing the eye lands on is the live readiness.

function CompanyCommanderDashboard() {
  const navigate = useNavigate();
  const {
    soldiers, leaves, squads, platoons, overrideAlerts, soldierStatusEvents,
    missions, dutyExclusions,
  } = useApp();
  const myCompany = useMyCompany();
  const myPlatoons = useMyPlatoons();
  const allAlerts = useAlertsForCompany();

  const now = new Date();
  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  // Materialize this week's slots once — drives the timeline + future tables.
  const materializedSlots = useMemo(() => materializeWeek({
    missions, platoons, squads, soldiers, leaves, dutyExclusions,
    startDay: todayStart, days: 7,
  }), [missions, platoons, squads, soldiers, leaves, dutyExclusions, todayStart]);

  const soldiersInPlatoon = (platoonId: string): Soldier[] => {
    const ids = squads.filter((s) => s.platoonId === platoonId).map((s) => s.id);
    return soldiers.filter((s) => s.squadId && ids.includes(s.squadId));
  };

  // Per-platoon health computed from currentStatus (single source of truth).
  // `gap` = how many more soldiers are needed to reach the platoon floor.
  const platoonStats = myPlatoons.map((p) => {
    const ps = soldiersInPlatoon(p.id);
    const inBase   = ps.filter((s) => s.currentStatus === 'in-base').length;
    const atHome   = ps.filter((s) => s.currentStatus === 'home').length;
    const inactive = ps.filter((s) => s.currentStatus === 'inactive-temp').length;
    const requiredMin = p.minSoldiersOnBase
      ?? Math.ceil((myCompany?.settings.minSoldiersOnBase ?? 0) / Math.max(1, myPlatoons.length));
    const gap = Math.max(0, requiredMin - inBase);
    const status: 'ready' | 'warning' | 'critical' =
      gap > 0                 ? 'critical' :
      inBase === requiredMin  ? 'warning'  :
      'ready';
    return { platoon: p, total: ps.length, inBase, atHome, inactive, requiredMin, gap, status };
  });

  const totalInBase   = platoonStats.reduce((s, ps) => s + ps.inBase, 0);
  const totalAtHome   = platoonStats.reduce((s, ps) => s + ps.atHome, 0);
  const totalInactive = platoonStats.reduce((s, ps) => s + ps.inactive, 0);
  const totalSoldiers = platoonStats.reduce((s, ps) => s + ps.total, 0);

  const criticalCount = platoonStats.filter((ps) => ps.status === 'critical').length;
  const warningCount  = platoonStats.filter((ps) => ps.status === 'warning').length;
  const companyHealth: 'ready' | 'warning' | 'critical' =
    criticalCount > 0 ? 'critical' :
    warningCount  > 0 ? 'warning'  :
    'ready';
  const readinessPct = totalSoldiers > 0 ? (totalInBase / totalSoldiers) * 100 : 0;

  const events = useMemo(() => buildPlatoonTimeline({
    now,
    materializedSlots,
    leaves,
    soldiers,
    pendingApprovals: 0,
    recentAlerts: allAlerts,
    statusEvents: soldierStatusEvents,
    horizonHours: 12,
  }), [now, materializedSlots, leaves, soldiers, allAlerts, soldierStatusEvents]);

  const [showActivity, setShowActivity] = useState(false);
  const openAlertCount = overrideAlerts.filter((a) => a.companyId === myCompany?.id && a.status === 'open').length;

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title={myCompany?.name ?? 'פלוגה'} />
      <PageMain>

        {/* ── 1. STATUS NOW — typographic hero, no card chrome ───────────── */}
        <header>
          <div className="flex items-baseline gap-1.5 text-tiny text-mil-muted">
            {myCompany?.unitName && (
              <>
                <span>{myCompany.unitName}</span>
                <span className="text-mil-ghost">·</span>
              </>
            )}
            <span>
              <span className="tabular-nums font-semibold text-mil-text">{platoonStats.length}</span> מחלקות
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-2.5 flex-wrap">
            <span className="text-[48px] leading-[0.9] font-extrabold tabular-nums tracking-tight text-mil-text">
              {totalInBase}
            </span>
            <span className="text-mil-ghost text-lg tabular-nums">
              / {totalSoldiers}
            </span>
            <span className="text-sm font-semibold text-mil-text mr-1">בבסיס עכשיו</span>

            <div className="mr-auto flex items-baseline gap-3">
              {totalAtHome > 0 && (
                <span className="text-tiny text-mil-muted">
                  <span className="tabular-nums font-bold text-mil-text">{totalAtHome}</span> בבית
                </span>
              )}
              {totalInactive > 0 && (
                <span className="text-tiny text-mil-muted">
                  <span className="tabular-nums font-bold text-mil-text">{totalInactive}</span> לא פעיל
                </span>
              )}
            </div>
          </div>

          <ReadinessBar pct={readinessPct} health={companyHealth} />

          {criticalCount > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 text-mil-alert font-semibold text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-mil-alert" aria-hidden />
              <span>
                {criticalCount === 1
                  ? 'מחלקה אחת מתחת לסף המינימום'
                  : `${criticalCount} מחלקות מתחת לסף המינימום`}
              </span>
            </div>
          )}
        </header>

        {/* ── 2. PLATOON HEALTH — compact scannable rows ──────────────────── */}
        <Section label="מחלקות">
          <div className="bg-mil-card border border-mil-border rounded-2xl divide-y divide-mil-border overflow-hidden">
            {platoonStats.map((ps) => (
              <PlatoonHealthRow key={ps.platoon.id} ps={ps} />
            ))}
          </div>
        </Section>

        {/* ── 3. UPCOMING — next 12 hours ─────────────────────────────────── */}
        <Section label="ב-12 השעות הקרובות">
          {events.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-bold text-mil-olive-dim">הכל רגוע</p>
              <p className="text-tiny text-mil-muted mt-1">אין שינויים מתוכננים</p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((ev) => <TimelineCard key={ev.id} event={ev} onCta={() => ev.ctaHref && navigate(ev.ctaHref)} />)}
            </div>
          )}
        </Section>

        {/* ── 4. RECENT CHANGES — collapsed; only when there's something ──── */}
        {allAlerts.length > 0 && (
          <CollapsibleSection
            label="שינויים אחרונים"
            open={showActivity}
            onToggle={() => setShowActivity((v) => !v)}
            count={openAlertCount}
          >
            <div className="space-y-2">
              {allAlerts.slice(0, 8).map((a) => (
                <Card key={a.id}>
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      {a.status === 'open' && <StatusPill status={a.riskLevel === 'high' ? 'critical' : 'warning'}>פתוח</StatusPill>}
                      {a.status === 'acknowledged' && <Hint>נצפה</Hint>}
                      {a.status === 'resolved' && <Hint className="text-mil-success">טופל</Hint>}
                      <Hint className="mr-auto">{platoons.find((g) => g.id === a.platoonId)?.name ?? '—'}</Hint>
                    </div>
                    <Body>{a.description}</Body>
                    {a.suggestedAction && <Muted className="mt-1">{a.suggestedAction}</Muted>}
                  </div>
                </Card>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* ── 5. CC operational destinations ── */}
        <Section label="ניהול">
          <div className="bg-mil-card border border-mil-border rounded-2xl divide-y divide-mil-border overflow-hidden">
            <button
              onClick={() => navigate('/missions')}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-mil-card-warm/40 transition-colors text-right"
            >
              <div className="flex-1">
                <Body className="font-semibold">ניהול משימות</Body>
                <Hint className="block mt-0.5">הגדרת משימות פעילות וטיוטות</Hint>
              </div>
              <span className="text-mil-ghost">←</span>
            </button>
            <button
              onClick={() => navigate('/coverage')}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-mil-card-warm/40 transition-colors text-right"
            >
              <div className="flex-1">
                <Body className="font-semibold">יציאות וכיסוי</Body>
                <Hint className="block mt-0.5">מי בבית, מי בבסיס, אירועי כיסוי</Hint>
              </div>
              <span className="text-mil-ghost">←</span>
            </button>
            <button
              onClick={() => navigate('/delegations')}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-mil-card-warm/40 transition-colors text-right"
            >
              <div className="flex-1">
                <Body className="font-semibold">פיקוד זמני</Body>
                <Hint className="block mt-0.5">הענקת סמכויות לתקופה מוגדרת</Hint>
              </div>
              <span className="text-mil-ghost">←</span>
            </button>
          </div>
        </Section>

      </PageMain>
    </div>
  );
}

// ─── Readiness bar — thin, single horizontal integral of company state ──────
// Color tracks the company's health, not a per-platoon detail. Width is the
// percentage of active soldiers currently in-base. No labels — the numbers
// above the bar carry the meaning; this is purely a visual signal.

function ReadinessBar({ pct, health }: { pct: number; health: 'ready' | 'warning' | 'critical' }) {
  const tone =
    health === 'critical' ? 'bg-mil-alert' :
    health === 'warning'  ? 'bg-mil-warn'  :
    'bg-mil-olive';
  return (
    <div className="mt-3 h-1 rounded-full bg-mil-border/60 overflow-hidden">
      <div
        className={`h-full ${tone} transition-[width] duration-500`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

// ─── Platoon health row — one compact scannable row per platoon ─────────────
// Reads as: status-dot · platoon name · gap/at-home/inactive notes · X/N
// Red is used ONLY when the platoon is below its minimum. Otherwise quiet.

interface PlatoonHealthRowData {
  platoon: { id: string; name: string; kind?: string };
  total: number;
  inBase: number;
  atHome: number;
  inactive: number;
  requiredMin: number;
  gap: number;
  status: 'ready' | 'warning' | 'critical';
}

function PlatoonHealthRow({ ps }: { ps: PlatoonHealthRowData }) {
  const dot =
    ps.status === 'critical' ? 'bg-mil-alert' :
    ps.status === 'warning'  ? 'bg-mil-warn'  :
    'bg-mil-olive';
  const numTone = ps.status === 'critical' ? 'text-mil-alert' : 'text-mil-text';
  const isSpecial = ps.platoon.kind === 'forward-command';
  const hasSubline = ps.gap > 0 || ps.atHome > 0 || ps.inactive > 0;

  return (
    <div className="px-5 py-4 flex items-center gap-3 hover:bg-mil-card-warm/40 transition-colors duration-150">
      <span className={`w-1.5 h-1.5 rounded-full ${dot} flex-shrink-0`} aria-hidden />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <Body className="font-semibold truncate">{ps.platoon.name}</Body>
          {isSpecial && <Hint className="text-mil-muted">מיוחדת</Hint>}
        </div>

        {hasSubline && (
          <div className="mt-1 flex items-baseline gap-1.5 flex-wrap text-tiny">
            {ps.gap > 0 && (
              <span className="text-mil-alert font-semibold">חסר {ps.gap} לבסיס</span>
            )}
            {ps.gap > 0 && (ps.atHome > 0 || ps.inactive > 0) && (
              <span className="text-mil-ghost">·</span>
            )}
            {ps.atHome > 0 && (
              <span className="text-mil-muted">
                <span className="tabular-nums font-semibold text-mil-text">{ps.atHome}</span> בבית
              </span>
            )}
            {ps.atHome > 0 && ps.inactive > 0 && (
              <span className="text-mil-ghost">·</span>
            )}
            {ps.inactive > 0 && (
              <span className="text-mil-muted">
                <span className="tabular-nums font-semibold text-mil-text">{ps.inactive}</span> לא פעיל
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-baseline flex-shrink-0 tabular-nums">
        <span className={`text-xl font-extrabold ${numTone}`}>{ps.inBase}</span>
        <span className="text-mil-ghost text-sm">/{ps.total}</span>
      </div>
    </div>
  );
}

// ─── Platoon Commander Dashboard (timeline-led) ──────────────────────────────
// Reads top-to-bottom as: now → next 12 hours → waiting work → primary action.
// No alerts feed. Override alerts that demand immediate attention surface as
// timeline cards; everything else lives in the company commander view.

function PlatoonCommanderDashboard() {
  const navigate = useNavigate();
  const {
    soldiers, leaves, platoons, squads, currentUser, soldierStatusEvents,
    missions, dutyExclusions, equipmentGaps,
  } = useApp();
  const approvableRequests = useApprovableLeaveRequests();
  const myAlerts = useAlertsForCompany();           // platoon-tier sees only their own platoon's alerts

  const myPlatoon = platoons.find((g) => g.id === currentUser?.commandedPlatoonId)
    ?? platoons.find((g) => g.memberIds.includes(currentUser?.id ?? ''));

  // Speak the same operational vocabulary the soldier sees.
  // currentStatus is the source of truth — Leave records only inform why,
  // not whether.
  const inBase     = soldiers.filter((s) => s.currentStatus === 'in-base').length;
  const atHome     = soldiers.filter((s) => s.currentStatus === 'home').length;
  const inactive   = soldiers.filter((s) => s.currentStatus === 'inactive-temp').length;

  // Currently running missions — from materialized slots scoped to my platoon.
  const now = new Date();
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

  // The timeline itself — same materialized slots, scoped to my platoon.
  const pendingApprovals = approvableRequests.filter((r) => r.status === 'pending').length;
  const events = useMemo(() => buildPlatoonTimeline({
    now,
    materializedSlots,
    ownerPlatoonId: myPlatoon?.id,
    leaves,
    soldiers,
    pendingApprovals,
    recentAlerts: myAlerts,
    statusEvents: soldierStatusEvents,
    horizonHours: 12,
  }), [now, materializedSlots, myPlatoon, leaves, soldiers, pendingApprovals, myAlerts, soldierStatusEvents]);

  // Platoon-floor + readiness — same pattern as CC home so the visual
  // language stays cohesive across roles.
  const platoonFloor = myPlatoon?.minSoldiersOnBase ?? 0;
  const totalAssigned = inBase + atHome + inactive;
  const platoonHealth: 'ready' | 'warning' | 'critical' =
    platoonFloor > 0 && inBase < platoonFloor      ? 'critical' :
    platoonFloor > 0 && inBase === platoonFloor    ? 'warning'  :
    'ready';
  const readinessPct = totalAssigned > 0 ? (inBase / totalAssigned) * 100 : 0;

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title={myPlatoon?.name ?? 'מחלקה'} />
      <PageMain>

        {/* ── STATUS NOW — typographic hero, same shape as CC home ──────── */}
        <header>
          <div className="flex items-baseline gap-1.5 text-tiny text-mil-muted">
            {myPlatoon?.unitName && (
              <>
                <span>{myPlatoon.unitName}</span>
                <span className="text-mil-ghost">·</span>
              </>
            )}
            <span>{myPlatoon?.name ?? 'מחלקה'}</span>
          </div>

          <div className="mt-3 flex items-baseline gap-2.5 flex-wrap">
            <span className="text-[48px] leading-[0.9] font-extrabold tabular-nums tracking-tight text-mil-text">
              {inBase}
            </span>
            <span className="text-mil-ghost text-lg tabular-nums">
              / {totalAssigned}
            </span>
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

        {/* ── Active missions (calmer presentation now hero replaces stats card) ── */}
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

        {/* ── השעות הקרובות ──────────────────────────── */}
        <Section label="השעות הקרובות">
          {events.length === 0 ? (
            <CalmCard />
          ) : (
            <div className="space-y-2.5">
              {events.map((ev) => <TimelineCard key={ev.id} event={ev} onCta={() => ev.ctaHref && navigate(ev.ctaHref)} />)}
            </div>
          )}
        </Section>

        {/* ── Single primary action — chunkier, lifted ── */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => navigate('/platoon')}
        >
          פתח שבצ״ק השבוע ←
        </Button>

        {/* ── PC operational destinations ────────────────────────────── */}
        {(() => {
          const openGapCount = equipmentGaps.filter((g) =>
            (g.reportedByPlatoonId === myPlatoon?.id) &&
            (g.status === 'reported' || g.status === 'reviewed-by-platoon')
          ).length;
          return (
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
                        <span className="text-tiny font-bold text-mil-alert tabular-nums">
                          {openGapCount} פתוחים
                        </span>
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
          );
        })()}

      </PageMain>
    </div>
  );
}

// ─── Timeline rendering ─────────────────────────────────────────────────────

function TimelineCard({ event, onCta }: { event: OpsEvent; onCta: () => void }) {
  const edge =
    event.severity === 'alert' ? 'bg-mil-alert' :
    event.severity === 'warn'  ? 'bg-mil-warn'  :
    'bg-mil-olive';
  const labelTone =
    event.severity === 'alert' ? 'text-mil-alert' :
    event.severity === 'warn'  ? 'text-mil-warn'  :
    'text-mil-muted';

  return (
    <div className="bg-mil-card border border-mil-border rounded-2xl flex overflow-hidden">
      <div className={`w-1 ${edge} flex-shrink-0`} />
      <div className="flex-1 px-4 py-3.5">
        <p className={`text-tiny font-bold tracking-wide ${labelTone}`}>{event.whenLabel}</p>
        <Body className="font-semibold mt-1">{event.title}</Body>
        {event.detail && <Muted className="mt-1">{event.detail}</Muted>}
        {event.ctaLabel && (
          <div className="mt-2.5">
            <Button variant="ghost" size="sm" onClick={onCta}>
              {event.ctaLabel} ←
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

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


// ─── Soldier Dashboard ────────────────────────────────────────────────────────

function SoldierDashboard() {
  const navigate = useNavigate();
  const {
    soldiers, leaves, currentUser, platoons, squads, setReminder, addLeaveRequest, updateSoldierStatus,
    missions, dutyExclusions,
  } = useApp();
  const myPlatoon = platoons.find((p) => p.id === currentUser?.platoonId);

  const myProfile = soldiers.find((s) => s.id === currentUser?.soldierProfileId || s.userId === currentUser?.id);
  const mySquadName = squads.find((s) => s.id === myProfile?.squadId)?.name ?? myProfile?.teamClass ?? '';

  // Collapsibles + modal state
  const [showWeek,    setShowWeek]    = useState(false);
  const [showRoster,  setShowRoster]  = useState(false);
  const [leaveOpen,   setLeaveOpen]   = useState(false);
  const [leaveSaved,  setLeaveSaved]  = useState(false);
  const [statusUpdateOpen, setStatusUpdateOpen] = useState(false);
  const [statusToastMsg,   setStatusToastMsg]   = useState('');

  const now = new Date();
  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const todayIso = useMemo(() => todayStart.toISOString().slice(0, 10), [todayStart]);

  // Materialize this week's slots — drives "now", "next shift", and the
  // collapsible "my week".
  const materializedSlots = useMemo(() => materializeWeek({
    missions, platoons, squads, soldiers, leaves, dutyExclusions,
    startDay: todayStart, days: 7,
  }), [missions, platoons, squads, soldiers, leaves, dutyExclusions, todayStart]);

  // My slots — where I'm assigned as a soldier OR commander
  const mySlots = useMemo(() => {
    if (!myProfile) return [];
    return materializedSlots.filter((slot) =>
      slot.assignedSoldierIds.includes(myProfile.id) || slot.commanderSoldierId === myProfile.id
    );
  }, [materializedSlots, myProfile]);

  // Active right now — slots I'm in that contain `now`
  const activeMissions = useMemo(() => {
    return mySlots.filter((slot) => {
      const s = Date.parse(slot.start);
      const e = Date.parse(slot.end);
      return s <= now.getTime() && now.getTime() < e;
    });
  }, [mySlots, now]);

  // Next shift — first upcoming slot I'm in
  const myNextShift = useMemo(() => {
    const upcoming = mySlots.filter((slot) => Date.parse(slot.start) > now.getTime());
    upcoming.sort((a, b) => a.start.localeCompare(b.start));
    const next = upcoming[0];
    if (!next) return null;
    const minsTo = Math.floor((Date.parse(next.start) - now.getTime()) / 60000);
    return { slot: next, minsTo };
  }, [mySlots, now]);

  const teammates = useMemo(() => {
    if (!myNextShift) return [] as Soldier[];
    const ids = [...myNextShift.slot.assignedSoldierIds];
    if (myNextShift.slot.commanderSoldierId) ids.push(myNextShift.slot.commanderSoldierId);
    return ids
      .filter((id) => id !== myProfile?.id)
      .map((id) => soldiers.find((s) => s.id === id))
      .filter(Boolean) as Soldier[];
  }, [myNextShift, myProfile, soldiers]);

  const onLeaveSoldierIds = useMemo(() => {
    const ids = new Set<string>();
    leaves.forEach((lv) => {
      if (todayIso < lv.startDate || todayIso > lv.endDate) return;
      if (lv.scope === 'individual') lv.soldierIds.forEach((id) => ids.add(id));
      else if (lv.scope === 'squad') soldiers.filter((s) => s.squadId === lv.squadId).forEach((s) => ids.add(s.id));
      else soldiers.forEach((s) => ids.add(s.id));
    });
    return ids;
  }, [leaves, soldiers, todayIso]);

  // My week — all my slots ordered by start time
  const myUpcomingShifts = useMemo(() =>
    mySlots.slice().sort((a, b) => a.start.localeCompare(b.start)),
    [mySlots],
  );

  const submitLeaveRequest = (data: { startDate: string; startTime: string; endDate: string; endTime: string; reason: string }) => {
    if (!myProfile) return;
    addLeaveRequest({
      soldierId:           myProfile.id,
      soldierName:         myProfile.name,
      soldierTeamClass:    myProfile.teamClass,
      soldierSquadId:    myProfile.squadId,
      soldierSquadName:  mySquadName || undefined,
      startDate: data.startDate,
      startTime: data.startTime,
      endDate:   data.endDate,
      endTime:   data.endTime,
      reason:    data.reason,
    });
    setLeaveOpen(false);
    setLeaveSaved(true);
    setTimeout(() => setLeaveSaved(false), 3500);
  };

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="המחלקה שלי" />
      <PageMain>

        {/* Transient toasts */}
        {leaveSaved && (
          <Card variant="muted" className="!border-mil-success/40 bg-mil-success-bg">
            <div className="px-4 py-3 flex items-center gap-2">
              <span className="text-mil-success font-bold">✓</span>
              <Body className="text-mil-success">בקשת היציאה הוגשה למ״מ</Body>
            </div>
          </Card>
        )}
        {statusToastMsg && (
          <Card variant="muted" className="!border-mil-olive/40 bg-mil-olive-bg">
            <div className="px-4 py-3 flex items-center gap-2">
              <span className="text-mil-olive-dim font-bold">✓</span>
              <Body className="text-mil-olive-dim">{statusToastMsg}</Body>
            </div>
          </Card>
        )}

        {/* Subtle greeting — name + context, no card chrome */}
        <div>
          <PageTitle>שלום, {currentUser?.name?.split(' ')[0]}</PageTitle>
          <Muted className="mt-1.5">
            {myPlatoon?.name}
            {mySquadName && ` · ${mySquadName}`}
            {myProfile && myProfile.operationalRoles.length > 0 && ` · ${myProfile.operationalRoles.join(', ')}`}
          </Muted>
        </div>

        {/* OPERATIONAL STATE SPINE — current state · next transition · next shift */}
        {myProfile && (
          <OperationalStateCard
            soldier={myProfile}
            leaves={leaves}
            nextShift={myNextShift ? {
              id:        myNextShift.slot.id,
              missionId: myNextShift.slot.missionId,
              name:      myNextShift.slot.missionName,
              startTime: hhmm(new Date(myNextShift.slot.start)),
              endTime:   hhmm(new Date(myNextShift.slot.end)),
              minsTo:    myNextShift.minsTo,
              teammates,
            } : null}
            onSetReminder={(mins) => myNextShift && setReminder({ timeSlotId: myNextShift.slot.id, minutesBefore: mins, enabled: true })}
            onOpenStatusUpdate={() => setStatusUpdateOpen(true)}
            onOpenMission={(missionId) => navigate(`/mission/${missionId}`)}
          />
        )}

        {/* Compact "מי על שמירה כרגע" — only if something is running */}
        {activeMissions.length > 0 && (
          <Section label="מי על שמירה כרגע">
            <Card>
              <div className="divide-y divide-mil-border">
                {activeMissions.map((slot) => {
                  const ids = [...slot.assignedSoldierIds];
                  if (slot.commanderSoldierId) ids.push(slot.commanderSoldierId);
                  const names = ids
                    .map((id) => soldiers.find((s) => s.id === id)?.name?.split(' ')[0])
                    .filter(Boolean) as string[];
                  return (
                    <div key={slot.id} className="px-4 py-3 flex items-center gap-3">
                      <Body className="font-semibold">{slot.missionName}</Body>
                      <Hint className="font-mono mr-auto">
                        {hhmm(new Date(slot.start))}–{hhmm(new Date(slot.end))}
                      </Hint>
                      <Muted className="truncate max-w-[55%] text-left text-mil-olive-dim">
                        {names.length > 0 ? names.join(' · ') : '—'}
                      </Muted>
                    </div>
                  );
                })}
              </div>
            </Card>
          </Section>
        )}

        {/* Collapsible: my schedule this week */}
        <CollapsibleCard
          title="הסידור שלי השבוע"
          count={myUpcomingShifts.length}
          open={showWeek}
          onToggle={() => setShowWeek((v) => !v)}
        >
          {myUpcomingShifts.length === 0 ? (
            <Body className="px-4 py-3 text-mil-muted">אין משמרות מתוכננות</Body>
          ) : (
            <div className="divide-y divide-mil-border">
              {myUpcomingShifts.map((slot) => {
                const start = new Date(slot.start);
                const end   = new Date(slot.end);
                return (
                  <div key={slot.id} className="px-4 py-3 flex items-center gap-3">
                    <Hint className="w-20 flex-shrink-0">{start.toISOString().slice(0, 10)}</Hint>
                    <Body className="font-semibold flex-1 truncate">{slot.missionName}</Body>
                    <Muted className="font-mono">{hhmm(start)}–{hhmm(end)}</Muted>
                  </div>
                );
              })}
            </div>
          )}
        </CollapsibleCard>

        {/* Collapsible: roster — read-only, status dots */}
        <CollapsibleCard
          title="צוות המחלקה"
          count={soldiers.length}
          open={showRoster}
          onToggle={() => setShowRoster((v) => !v)}
        >
          <div className="divide-y divide-mil-border max-h-80 overflow-y-auto">
            {soldiers.map((s) => {
              const onLeave = onLeaveSoldierIds.has(s.id);
              const tone =
                onLeave ? 'bg-mil-sand' :
                s.availability ? 'bg-mil-success' : 'bg-mil-ghost';
              const squad = squads.find((su) => su.id === s.squadId)?.name ?? s.teamClass;
              return (
                <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${tone} flex-shrink-0`} />
                  <Body className="flex-1">{s.name}</Body>
                  <Muted>{squad}</Muted>
                </div>
              );
            })}
          </div>
        </CollapsibleCard>

      </PageMain>

      {/* FAB — bottom-left for RTL, above bottom nav. Lifted with shadow-hero
          so it reads as the persistent action affordance, not a decoration. */}
      <button
        onClick={() => setLeaveOpen(true)}
        className="fixed bottom-24 left-5 z-20 bg-mil-olive hover:bg-mil-olive-light active:bg-mil-olive-dim text-white font-bold px-5 py-4 rounded-full shadow-hero flex items-center gap-2 transition-all active:scale-95"
      >
        <span className="text-xl leading-none">+</span>
        <span className="text-sm tracking-wide">בקשת יציאה</span>
      </button>

      {/* Leave-request modal */}
      {leaveOpen && (
        <LeaveRequestModal
          onClose={() => setLeaveOpen(false)}
          onSubmit={submitLeaveRequest}
        />
      )}

      {/* Operational state update modal */}
      {statusUpdateOpen && myProfile && (
        <StatusUpdateModal
          soldier={myProfile}
          onClose={() => setStatusUpdateOpen(false)}
          onSubmit={(next, expectedUntil) => {
            updateSoldierStatus({ soldierId: myProfile.id, next, expectedUntil });
            setStatusUpdateOpen(false);
            setStatusToastMsg(
              next === 'home'    ? 'עדכנת: יצאת הביתה' :
              next === 'in-base' ? 'עדכנת: חזרת לבסיס' :
                                   'עדכנת: לא פעיל כרגע'
            );
            setTimeout(() => setStatusToastMsg(''), 3500);
          }}
        />
      )}
    </div>
  );
}

// ─── Soldier-side leave request modal ────────────────────────────────────────

function LeaveRequestModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: { startDate: string; startTime: string; endDate: string; endTime: string; reason: string }) => void;
}) {
  const [form, setForm] = useState({
    startDate: '', startTime: '14:00',
    endDate:   '', endTime:   '08:00',
    reason:    '',
  });
  const canSubmit = form.startDate && form.endDate && form.reason.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center" dir="rtl">
      <div className="w-full max-w-md bg-mil-card rounded-t-2xl sm:rounded-2xl">
        <div className="bg-mil-olive rounded-t-2xl px-5 py-4 flex items-center gap-3">
          <button onClick={onClose} className="text-white/80 hover:text-white text-xl leading-none">✕</button>
          <h2 className="text-white font-bold flex-1">בקשת יציאה</h2>
        </div>
        <div className="px-5 py-5 space-y-4">
          <p className="text-sm text-mil-muted">הבקשה תישלח למ״מ לאישור.</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-mil-muted mb-1.5">יציאה — תאריך</label>
              <input type="date" className={modalInp} value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-mil-muted mb-1.5">שעה</label>
              <input type="time" className={modalInp} value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-mil-muted mb-1.5">חזרה — תאריך</label>
              <input type="date" className={modalInp} value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-mil-muted mb-1.5">שעה</label>
              <input type="time" className={modalInp} value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="block text-xs text-mil-muted mb-1.5">סיבה</label>
            <textarea
              className={`${modalInp} resize-none`}
              rows={3}
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="אירוע משפחתי / פגישה רפואית..."
            />
          </div>

          <button
            onClick={() => canSubmit && onSubmit(form)}
            disabled={!canSubmit}
            className="w-full bg-mil-olive hover:bg-mil-olive-light disabled:opacity-40 text-white font-bold py-4 rounded-xl text-base transition-colors"
          >
            שלח בקשה
          </button>
        </div>
      </div>
    </div>
  );
}

const modalInp = 'w-full bg-mil-bg border border-mil-border rounded-xl px-3 py-3 text-mil-text focus:outline-none focus:ring-2 focus:ring-mil-olive/30 focus:border-mil-olive placeholder:text-mil-ghost text-base';

// ─── CollapsibleCard — reused for "my week" and roster ───────────────────────

function CollapsibleCard({
  title, count, open, onToggle, children,
}: {
  title: string; count?: number; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <Card>
      <button
        onClick={onToggle}
        className="w-full px-4 py-3.5 bg-mil-card-warm hover:bg-mil-card-hover transition-colors flex items-center gap-2 text-right"
      >
        <CardTitle>{title}</CardTitle>
        {count != null && <Hint>({count})</Hint>}
        <span className="mr-auto text-mil-ghost">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="border-t border-mil-border">{children}</div>}
    </Card>
  );
}

// NextShiftCard was absorbed into OperationalStateCard above.


// ─── OperationalStateCard ────────────────────────────────────────────────────
// The soldier's operational spine. Reads as state + transition, not stats.
// Temporal/operational language only — no dates that read as "history."
//
//   1. Current state (calm, present-tense: "אתה בבסיס")
//   2. Duration in that state ("כבר 3 ימים בפנים")
//   3. Forward transition ("עוד 4 ימים לבית" / "עוד יומיים לחזרה")
//   4. Next shift (when in-base)
//   5. One contextual action verb ("יצאתי הביתה" / "חזרתי לבסיס" / ...)
//
// Architecture-ready: the "next transition" slot can later show a combat
// clock block OR an escalation directive — currently it shows next shift.

interface NextShiftDisplay {
  id: string;
  missionId: string;
  name: string;
  startTime: string;
  endTime: string;
  minsTo: number;
  teammates: Soldier[];
}

function OperationalStateCard({
  soldier, leaves, nextShift, onSetReminder, onOpenStatusUpdate, onOpenMission,
}: {
  soldier: Soldier;
  leaves: import('../types').Leave[];
  nextShift: NextShiftDisplay | null;
  onSetReminder: (mins: 5 | 15 | 30 | 60) => void;
  onOpenStatusUpdate: () => void;
  onOpenMission: (missionId: string) => void;
}) {
  const status = soldier.currentStatus;
  const now = new Date();
  const durationLabel = formatDurationInState(soldier.statusSetAt, status, now);
  const nextLeaveDays = status === 'in-base' ? findDaysToNextLeave(soldier, leaves, now) : null;
  const daysToReturn  = status === 'home' && soldier.statusExpectedUntil
    ? daysBetweenIso(now, soldier.statusExpectedUntil)
    : null;

  const presentation = {
    'in-base':       { label: 'אתה בבסיס',     accentClass: 'text-mil-olive-dim',  verb: 'יצאתי הביתה'    },
    'home':          { label: 'אתה בבית',       accentClass: 'text-mil-sand',       verb: 'חזרתי לבסיס'    },
    'inactive-temp': { label: 'לא פעיל כרגע',   accentClass: 'text-mil-muted',      verb: 'חזרתי לפעילות'  },
  }[status];

  const [activeReminder, setActiveReminder] = useState<5 | 15 | 30 | 60 | null>(null);
  const handleReminder = (m: 5 | 15 | 30 | 60) => { onSetReminder(m); setActiveReminder(m); };

  return (
    <Card variant="hero">
      <div className="px-5 py-5 space-y-5">

        {/* — Current state — */}
        <div>
          <Hint>המצב שלך</Hint>
          <p className={`text-hero font-extrabold leading-tight mt-1.5 ${presentation.accentClass}`}>
            {presentation.label}
          </p>
          <Body className="mt-1.5 text-mil-text font-semibold">
            {durationLabel}
            {nextLeaveDays != null && (
              <>
                <span className="text-mil-ghost mx-2">·</span>
                <span className="text-mil-muted font-medium">{formatDaysCountdown(nextLeaveDays, 'home')}</span>
              </>
            )}
            {daysToReturn != null && (
              <>
                <span className="text-mil-ghost mx-2">·</span>
                <span className="text-mil-muted font-medium">{formatDaysCountdown(daysToReturn, 'base')}</span>
              </>
            )}
          </Body>
        </div>

        {/* — Next operational transition — */}
        {nextShift && status === 'in-base' && (
          <div className="pt-4 border-t border-mil-border">
            <div className="flex items-baseline gap-3">
              <Hint>המשמרת הבאה</Hint>
              <button
                onClick={() => onOpenMission(nextShift.missionId)}
                className="mr-auto text-tiny font-bold text-mil-olive-dim hover:text-mil-olive"
              >
                פרטים →
              </button>
            </div>
            <p className="text-lg font-bold text-mil-text mt-1.5 leading-snug">{nextShift.name}</p>
            <Muted className="mt-1">
              <span className="font-mono font-semibold text-mil-text">{nextShift.startTime}–{nextShift.endTime}</span>
              <span className="mx-2 text-mil-ghost">·</span>
              <span>{formatRelative(nextShift.minsTo)}</span>
            </Muted>
            {nextShift.teammates.length > 0 && (
              <Muted className="mt-1">
                יחד עם: {nextShift.teammates.map((t) => t.name).join(' · ')}
              </Muted>
            )}

            {/* Inline wake-me-up — no separate card, part of the same flow */}
            <div className="mt-3.5 grid grid-cols-4 gap-2">
              {([5, 15, 30, 60] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => handleReminder(m)}
                  className={`py-2.5 rounded-lg text-tiny font-bold transition-all active:scale-95 ${
                    activeReminder === m
                      ? 'bg-mil-olive text-white shadow-card-hover'
                      : 'bg-mil-bg border border-mil-border text-mil-text hover:border-mil-olive'
                  }`}
                >
                  {m === 60 ? 'שעה' : `${m} דק׳`}
                </button>
              ))}
            </div>
            {activeReminder && (
              <Hint className="text-mil-success mt-2 font-semibold">✓ תזכורת {activeReminder} דק׳ לפני</Hint>
            )}
          </div>
        )}

        {/* — Single action — past-tense operational verb, not "update state" — */}
        <button
          onClick={onOpenStatusUpdate}
          className="w-full bg-mil-card border border-mil-border hover:border-mil-olive text-mil-text font-bold py-3 rounded-xl text-sm transition-all active:scale-[0.98]"
        >
          {presentation.verb}
        </button>
      </div>
    </Card>
  );
}

// ─── StatusUpdateModal ───────────────────────────────────────────────────────
// Operational confirmation, not "edit a record."
// - in-base  → "אני יוצא הביתה" with return picker, primary "יצאתי הביתה"
// - home     → confirm "חזרתי לבסיס"
// - inactive → confirm "חזרתי לפעילות"

function StatusUpdateModal({
  soldier, onClose, onSubmit,
}: {
  soldier: Soldier;
  onClose: () => void;
  onSubmit: (next: SoldierStatus, expectedUntil?: string) => void;
}) {
  const [returnDate, setReturnDate] = useState('');
  const [returnTime, setReturnTime] = useState('08:00');

  const goHome = () => {
    const iso = returnDate ? `${returnDate}T${returnTime}:00` : undefined;
    onSubmit('home', iso);
  };

  const headline = {
    'in-base':       'יציאה הביתה',
    'home':          'חזרה לבסיס',
    'inactive-temp': 'חזרה לפעילות',
  }[soldier.currentStatus];

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center" dir="rtl">
      <div className="w-full max-w-md bg-mil-card rounded-t-2xl sm:rounded-2xl">
        <div className="bg-mil-olive rounded-t-2xl px-5 py-4 flex items-center gap-3">
          <button onClick={onClose} className="text-white/80 hover:text-white text-xl leading-none">✕</button>
          <h2 className="text-white font-bold flex-1">{headline}</h2>
        </div>

        <div className="px-5 py-5 space-y-4">
          {soldier.currentStatus === 'in-base' && (
            <>
              <Body className="text-mil-muted">מתי אתה צפוי לחזור?</Body>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Hint className="mb-1.5 block">תאריך</Hint>
                  <input type="date" className={modalInp} value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
                </div>
                <div>
                  <Hint className="mb-1.5 block">שעה</Hint>
                  <input type="time" className={modalInp} value={returnTime} onChange={(e) => setReturnTime(e.target.value)} />
                </div>
              </div>
              <Button variant="primary" size="lg" fullWidth onClick={goHome} disabled={!returnDate}>
                יצאתי הביתה
              </Button>
              <Hint className="text-center">המ״מ יראה מתי אתה צפוי לחזור.</Hint>
            </>
          )}

          {soldier.currentStatus === 'home' && (
            <>
              <Body className="text-mil-muted">לאשר: אתה בבסיס מעכשיו?</Body>
              <Button variant="primary" size="lg" fullWidth onClick={() => onSubmit('in-base')}>
                חזרתי לבסיס
              </Button>
            </>
          )}

          {soldier.currentStatus === 'inactive-temp' && (
            <>
              <Body className="text-mil-muted">לאשר: אתה פעיל ומוכן לשיבוץ?</Body>
              <Button variant="primary" size="lg" fullWidth onClick={() => onSubmit('in-base')}>
                חזרתי לפעילות
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Operational temporal helpers ─────────────────────────────────────────────
// Durations and countdowns. NO date displays. Soldiers think in
// "how long" and "how many days until", not "since X/Y."

function formatDurationInState(since: string, status: SoldierStatus, now: Date): string {
  if (!since) return '';
  const diffMs   = Math.max(0, now.getTime() - new Date(since).getTime());
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs  = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Phrase tail per status — uses Israeli soldier vernacular for in-base
  const tail = {
    'in-base':       'בפנים',
    'home':          'בבית',
    'inactive-temp': 'לא פעיל',
  }[status];

  if (diffDays >= 1) {
    const n = diffDays;
    if (n === 1) return `כבר יום ${tail}`;
    if (n === 2) return `כבר יומיים ${tail}`;
    return `כבר ${n} ימים ${tail}`;
  }
  if (diffHrs >= 1) {
    const n = diffHrs;
    if (n === 1) return `כבר שעה ${tail}`;
    if (n === 2) return `כבר שעתיים ${tail}`;
    return `כבר ${n} שעות ${tail}`;
  }
  if (diffMins >= 1) return `כבר ${diffMins} דקות ${tail}`;
  return `הרגע ${tail}`;
}

function formatDaysCountdown(days: number, target: 'home' | 'base'): string {
  const label = target === 'home' ? 'לבית' : 'לבסיס';
  if (days <= 0)  return target === 'home' ? 'יציאה היום' : 'חזרה היום';
  if (days === 1) return target === 'home' ? 'יציאה מחר'  : 'חזרה מחר';
  if (days === 2) return `עוד יומיים ${label}`;
  return `עוד ${days} ימים ${label}`;
}

// Whole-day distance from `from` to `toIso` (e.g. status expected-until).
function daysBetweenIso(from: Date, toIso: string): number | null {
  const to = new Date(toIso); if (isNaN(to.getTime())) return null;
  const startOfFrom = new Date(from); startOfFrom.setHours(0, 0, 0, 0);
  const startOfTo   = new Date(to);   startOfTo.setHours(0, 0, 0, 0);
  return Math.round((startOfTo.getTime() - startOfFrom.getTime()) / 86400000);
}

// Days until this soldier's NEXT scheduled leave starts (any matching scope).
// Returns null if no upcoming leave is on file.
function findDaysToNextLeave(soldier: Soldier, leaves: import('../types').Leave[], now: Date): number | null {
  const upcoming = leaves
    .filter((lv) => {
      const startTs = Date.parse(`${lv.startDate}T${lv.startTime || '00:00'}`);
      if (isNaN(startTs) || startTs <= now.getTime()) return false;
      if (lv.scope === 'individual') return lv.soldierIds.includes(soldier.id);
      if (lv.scope === 'squad')      return soldier.squadId && soldier.squadId === lv.squadId;
      return true; // machlaka / company-wide includes everyone
    })
    .sort((a, b) =>
      `${a.startDate}T${a.startTime || '00:00'}`.localeCompare(`${b.startDate}T${b.startTime || '00:00'}`),
    );
  if (upcoming.length === 0) return null;
  return daysBetweenIso(now, `${upcoming[0].startDate}T${upcoming[0].startTime || '00:00'}`);
}

