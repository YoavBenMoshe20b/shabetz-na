// Company Commander / Deputy Dashboard — operational command picture.
//
// Reads top-to-bottom as:
//   1. Hero KPI — readiness now (sd"k + breakdown + readiness bar)
//   2. Platoon health table — per-platoon compact rows
//   3. Next 12 hours — timeline cards
//   4. Recent override alerts — collapsed
//   5. Announcements strip
//   6. Escalation CTA
//   7. Management navigation tiles

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useApp, useAlertsForCompany, useMyCompany, useMyPlatoons,
} from '../../context/AppContext';
import { canDeclareEscalation, canViewReport1 } from '../../utils/permissions';
import { buildPlatoonTimeline } from '../../utils/timeline';
import { materializeWeek } from '../../utils/materialize';
import Header from '../../components/Header';
import {
  Card, StatusPill, Section, PageMain, CollapsibleSection,
  Body, Muted, Hint,
} from '../../components/ui';
import AnnouncementsStrip from '../../components/AnnouncementsStrip';
import FocusSection from '../../components/FocusSection';
import CriticalAlertsBanner from '../../components/CriticalAlertsBanner';
import EscalationSheet from '../../components/EscalationSheet';
import AlertsButton from '../../components/AlertsButton';
import PersonalActionsFab from '../../components/PersonalActionsFab';
import { Kpi } from './_shared/Kpi';
import { NavTile } from './_shared/NavTile';
import { TimelineCard } from './_shared/TimelineCard';
import { formatTimeNow } from './_shared/timeFormat';
import type { Soldier } from '../../types';

// ─── ReadinessBar ────────────────────────────────────────────────────────
// Color tracks the company's health; width is the % of active soldiers
// currently in-base. No labels — the numbers above carry the meaning.

function ReadinessBar({ pct, health }: { pct: number; health: 'ready' | 'warning' | 'critical' }) {
  const tone =
    health === 'critical' ? 'bg-mil-alert' :
    health === 'warning'  ? 'bg-mil-warn'  :
    'bg-mil-success';
  return (
    <div className="mt-4 h-1.5 rounded-full bg-mil-bg-alt overflow-hidden border border-mil-border/40">
      <div
        className={`h-full ${tone} transition-[width] duration-700 ease-out`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

// ─── Platoon health row ──────────────────────────────────────────────────

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
  const tone =
    ps.status === 'critical' ? 'bg-mil-alert' :
    ps.status === 'warning'  ? 'bg-mil-warn'  :
    'bg-mil-success';
  const numTone = ps.status === 'critical' ? 'text-mil-alert' : 'text-mil-text';
  const isSpecial = ps.platoon.kind === 'forward-command';
  const hasSubline = ps.gap > 0 || ps.atHome > 0 || ps.inactive > 0;
  const pct = ps.total > 0 ? (ps.inBase / ps.total) * 100 : 0;

  return (
    <div className="px-5 py-4 flex items-center gap-4 hover:bg-mil-card-hover transition-colors duration-150">
      <span className={`w-2 h-2 rounded-full ${tone} flex-shrink-0 ring-4 ring-mil-card`} aria-hidden />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <Body className="font-semibold truncate">{ps.platoon.name}</Body>
          {isSpecial && <Hint className="text-mil-muted">מיוחדת</Hint>}
        </div>
        <div className="mt-2 h-1 rounded-full bg-mil-bg-alt overflow-hidden">
          <div className={`h-full ${tone} transition-[width] duration-500 ease-out`} style={{ width: `${pct}%` }} />
        </div>
        {hasSubline && (
          <div className="mt-2 flex items-baseline gap-1.5 flex-wrap text-tiny">
            {ps.gap > 0 && (
              <span className="text-mil-alert font-semibold">חסר {ps.gap} לבסיס</span>
            )}
            {ps.gap > 0 && (ps.atHome > 0 || ps.inactive > 0) && <span className="text-mil-ghost">·</span>}
            {ps.atHome > 0 && (
              <span className="text-mil-muted">
                <span className="tabular-nums font-semibold text-mil-sand">{ps.atHome}</span> בבית
              </span>
            )}
            {ps.atHome > 0 && ps.inactive > 0 && <span className="text-mil-ghost">·</span>}
            {ps.inactive > 0 && (
              <span className="text-mil-muted">
                <span className="tabular-nums font-semibold text-mil-rest">{ps.inactive}</span> לא פעיל
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-baseline flex-shrink-0 tabular-nums">
        <span className={`text-xl font-bold tracking-tightish ${numTone}`}>{ps.inBase}</span>
        <span className="text-mil-ghost text-sm">/{ps.total}</span>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────

export default function CompanyCommanderDashboard() {
  const navigate = useNavigate();
  const {
    soldiers, leaves, squads, platoons, overrideAlerts, soldierStatusEvents,
    missions, dutyExclusions,
    currentUser, delegations,
  } = useApp();
  const myCompany = useMyCompany();
  const myPlatoons = useMyPlatoons();
  const allAlerts = useAlertsForCompany();

  // `now` is stable per mount so useMemo deps that include it work as
  // intended. The dashboard is anchored to page-load time; users refresh
  // to recompute. This matches the lint rule's expectation.
  const now = useMemo(() => new Date(), []);
  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const materializedSlots = useMemo(() => materializeWeek({
    missions, platoons, squads, soldiers, leaves, dutyExclusions,
    startDay: todayStart, days: 7,
  }), [missions, platoons, squads, soldiers, leaves, dutyExclusions, todayStart]);

  const platoonStats = useMemo(() => {
    return myPlatoons.map((p) => {
      const sqIds = squads.filter((s) => s.platoonId === p.id).map((s) => s.id);
      const ps: Soldier[] = soldiers.filter((s) => s.squadId && sqIds.includes(s.squadId));
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
  }, [myPlatoons, squads, soldiers, myCompany]);

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
  const [escalationOpen, setEscalationOpen] = useState(false);
  const openAlertCount = overrideAlerts.filter((a) => a.companyId === myCompany?.id && a.status === 'open').length;

  const canEsc = !!currentUser && canDeclareEscalation(currentUser, delegations);
  const canRpt = !!currentUser && canViewReport1(currentUser, delegations);

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title={myCompany?.name ?? 'פלוגה'} />
      <PageMain>

        <section className="bg-mil-card border border-mil-border rounded-2xl-soft shadow-hero p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-1.5 text-tiny text-mil-muted min-w-0">
              {myCompany?.unitName && (
                <>
                  <span className="font-medium">{myCompany.unitName}</span>
                  <span className="text-mil-ghost">·</span>
                </>
              )}
              <span className="tabular-nums">
                <span className="font-semibold text-mil-text">{platoonStats.length}</span> מחלקות
              </span>
              <span className="text-mil-ghost">·</span>
              <span className="text-mil-ghost">{formatTimeNow(now)}</span>
            </div>
            <AlertsButton />
          </div>

          <div className="mt-3 flex items-end gap-2.5 flex-wrap">
            <span className="text-[56px] leading-[0.9] font-extrabold tabular-nums tracking-tightish text-mil-text">
              {totalInBase}
            </span>
            <div className="pb-1.5">
              <Body className="font-semibold leading-tight">בבסיס עכשיו</Body>
              <Hint className="text-tiny mt-0.5">
                <span className="tabular-nums font-semibold text-mil-text">{totalSoldiers}</span> סה״כ
                · <span className="tabular-nums font-semibold text-mil-text">{Math.round(readinessPct)}%</span> כשירות
              </Hint>
            </div>
          </div>

          <ReadinessBar pct={readinessPct} health={companyHealth} />

          <div className="mt-5 grid grid-cols-3 gap-3">
            <Kpi label="בבסיס"   value={totalInBase}   tone="success" />
            <Kpi label="בבית"    value={totalAtHome}   tone="sand"   muted={totalAtHome === 0} />
            <Kpi label="לא פעיל" value={totalInactive} tone="rest"   muted={totalInactive === 0} />
          </div>

          {criticalCount > 0 && (
            <div className="mt-5 flex items-center gap-2.5 bg-mil-alert-bg border border-mil-alert-border rounded-xl-soft px-4 py-3">
              <span className="relative flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-mil-alert block" />
                <span className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-mil-alert animate-ping opacity-60" />
              </span>
              <p className="text-sm font-semibold text-mil-alert">
                {criticalCount === 1
                  ? 'מחלקה אחת מתחת לסף המינימום'
                  : `${criticalCount} מחלקות מתחת לסף המינימום`}
              </p>
            </div>
          )}
        </section>

        {/* Critical alerts — itemized, each with a direct CTA. Auto-hides
            when there are no criticals. Always visible (breaks through
            QuietMode). Sits above Focus because critical events demand
            awareness before the operator considers what to decide next. */}
        <CriticalAlertsBanner />

        {/* Focus — "what requires a decision now". Engine-driven, max 5 items.
            Auto-hides when nothing demands a decision. */}
        <FocusSection />

        {/* Escalation CTA — surfaces FIRST after hero so the operator's
            most critical lever is one tap away. */}
        {canEsc && (
          <Section label="פעולת חירום">
            <button
              onClick={() => setEscalationOpen(true)}
              className="w-full text-right bg-mil-alert-bg border border-mil-alert-border rounded-xl-soft shadow-card hover:shadow-card-hover transition-all duration-200 ease-out-soft px-5 py-4 flex items-center gap-3.5"
            >
              <span className="w-9 h-9 rounded-xl-soft bg-mil-alert text-white flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2 L22 20 H2 Z" />
                  <path d="M12 9 v5" />
                  <circle cx="12" cy="17.5" r="0.5" fill="currentColor" />
                </svg>
              </span>
              <div className="flex-1 min-w-0">
                <Body className="font-semibold leading-tight text-mil-alert">הקפצה</Body>
                <Hint className="block mt-0.5 text-mil-alert/80">פתיחת אירוע מבצעי לקהל יעד</Hint>
              </div>
              <span className="text-mil-alert">←</span>
            </button>
          </Section>
        )}

        <Section label="מחלקות">
          <div className="bg-mil-card border border-mil-border rounded-2xl shadow-card divide-y divide-mil-border overflow-hidden">
            {platoonStats.map((ps) => (
              <PlatoonHealthRow key={ps.platoon.id} ps={ps} />
            ))}
          </div>
        </Section>

        <Section label="ב-12 השעות הקרובות">
          {events.length === 0 ? (
            <div className="bg-mil-card border border-mil-border rounded-2xl shadow-card py-10 text-center">
              <p className="text-sm font-semibold text-mil-success">הכל רגוע</p>
              <p className="text-tiny text-mil-muted mt-1">אין שינויים מתוכננים</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {events.map((ev) => (
                <TimelineCard key={ev.id} event={ev} onCta={() => ev.ctaHref && navigate(ev.ctaHref)} />
              ))}
            </div>
          )}
        </Section>

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

        <AnnouncementsStrip isCommander={true} />

        {/* Quick-access tiles for CC's top-3 secondary surfaces. The full
            navigation (announcements, leave-cycle, missions, coverage,
            rasap, delegations) now lives in the Command Menu (☰) so the
            home stays focused on operational state, not chrome. */}
        <Section label="קיצורי דרך">
          <div className="grid grid-cols-1 gap-2.5">
            {canRpt && (
              <NavTile label="דוח 1" hint="תמונת מצב חיה של הפלוגה"
                onClick={() => navigate('/report1')} icon="report1" />
            )}
            <NavTile label="ניהול משימות" hint="הגדרת משימות פעילות וטיוטות"
              onClick={() => navigate('/missions')} icon="missions" />
            <NavTile label="יציאות וכיסוי" hint="מי בבית, מי בבסיס, אירועי כיסוי"
              onClick={() => navigate('/coverage')} icon="coverage" />
          </div>
        </Section>

      </PageMain>

      {escalationOpen && (
        <EscalationSheet open onClose={() => setEscalationOpen(false)} />
      )}

      {/* Personal capability layer — every role, including CC, gets the
          personal toolbox: profile, equipment, status, leave request. */}
      <PersonalActionsFab />
    </div>
  );
}
