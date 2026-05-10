import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useActivePeriod, useApprovableLeaveRequests, useAlertsForCompany, useMyCompany, useMyPlatoons } from '../context/AppContext';
import Header from '../components/Header';
import { isPlatoonLeadership, isCompanyLeadership } from '../utils/permissions';
import { buildPlatoonTimeline, type OpsEvent } from '../utils/timeline';
import { Card, StatusPill, StatusDot, Section, PageMain, CollapsibleSection } from '../components/ui';
import type { TimeSlot, MissionType, Soldier } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const timeToMins = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

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

// ─── Company Commander Dashboard (operational overview) ──────────────────────
// Reads as: עכשיו → השעות הקרובות → פעילות אחרונה (collapsed) → הגדרות.
// The company commander does NOT see leave queues here per spec — those
// belong to platoon commanders. Override alerts are demoted to a collapsed
// section, never the headline.

function CompanyCommanderDashboard() {
  const navigate = useNavigate();
  const { soldiers, leaves, subUnits, groups, overrideAlerts } = useApp();
  const myCompany = useMyCompany();
  const myPlatoons = useMyPlatoons();
  const allAlerts = useAlertsForCompany();
  const activePeriod = useActivePeriod();

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  // Soldiers attached to a platoon via their subUnit (subUnit.platoonId)
  const soldiersInPlatoon = (platoonId: string): Soldier[] => {
    const ids = subUnits.filter((s) => s.platoonId === platoonId).map((s) => s.id);
    return soldiers.filter((s) => s.subUnitId && ids.includes(s.subUnitId));
  };

  const onLeaveIds = useMemo(() => {
    const ids = new Set<string>();
    leaves.forEach((lv) => {
      if (today < lv.startDate || today > lv.endDate) return;
      if (lv.scope === 'individual') lv.soldierIds.forEach((id) => ids.add(id));
      else if (lv.scope === 'subUnit') soldiers.filter((s) => s.subUnitId === lv.subUnitId).forEach((s) => ids.add(s.id));
      else soldiers.forEach((s) => ids.add(s.id));
    });
    return ids;
  }, [leaves, soldiers, today]);

  // Per-platoon stats
  const platoonStats = myPlatoons.map((p) => {
    const ps = soldiersInPlatoon(p.id);
    const onBase = ps.filter((s) => s.availability && !onLeaveIds.has(s.id)).length;
    const atHome = ps.filter((s) => onLeaveIds.has(s.id)).length;
    const requiredMin = p.minSoldiersOnBase ?? Math.ceil((myCompany?.settings.minSoldiersOnBase ?? 0) / Math.max(1, myPlatoons.length));
    const status: 'ready' | 'warning' | 'critical' =
      onBase < requiredMin              ? 'critical' :
      onBase < requiredMin + 1          ? 'warning'  :
      'ready';
    return { platoon: p, total: ps.length, onBase, atHome, requiredMin, status };
  });

  const totalOnBase = platoonStats.reduce((sum, ps) => sum + ps.onBase, 0);
  const totalSoldiers = platoonStats.reduce((sum, ps) => sum + ps.total, 0);

  // Cross-company timeline (no pending approvals — CC doesn't approve)
  const events = useMemo(() => buildPlatoonTimeline({
    now,
    period: activePeriod ?? null,
    leaves,
    soldiers,
    pendingApprovals: 0,
    recentAlerts: allAlerts,
    horizonHours: 12,
  }), [now, activePeriod, leaves, soldiers, allAlerts]);

  // Recent activity (override alerts, regardless of status, demoted to collapsible)
  const [showActivity, setShowActivity] = useState(false);
  const openAlertCount = overrideAlerts.filter((a) => a.companyId === myCompany?.id && a.status === 'open').length;

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title={myCompany?.name ?? 'פלוגה'} />
      <PageMain>

        {/* ── עכשיו ──────────────────────────────────── */}
        <Section label="עכשיו">
          <Card>
            <div className="px-4 py-3">
              <p className="text-sm text-mil-text">
                <span className="font-bold text-mil-olive">{totalOnBase}</span>
                <span className="text-mil-ghost mx-1">/</span>
                <span className="text-mil-text">{totalSoldiers}</span>
                <span className="mr-1">בבסיס</span>
                <span className="text-mil-ghost mx-2">·</span>
                <span className="text-mil-muted">{platoonStats.length} מחלקות</span>
              </p>
            </div>
          </Card>

          {platoonStats.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {platoonStats.map((ps) => (
                <Card
                  key={ps.platoon.id}
                  variant={ps.status === 'critical' ? 'critical' : 'default'}
                  className="text-right"
                >
                  <div className="px-4 py-3">
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-bold text-mil-text text-sm leading-tight">{ps.platoon.name}</p>
                      <StatusDot status={ps.status} />
                    </div>
                    <p className="text-xs text-mil-muted">
                      <span className="font-bold text-mil-text">{ps.onBase}</span>
                      <span className="mx-0.5">/</span>
                      <span>{ps.total}</span>
                      <span className="mr-1">בבסיס</span>
                    </p>
                    {ps.atHome > 0 && (
                      <p className="text-xs text-mil-sand mt-0.5">{ps.atHome} בבית</p>
                    )}
                    {ps.platoon.isSpecialPlatoon && (
                      <p className="text-[10px] text-mil-muted mt-1 tracking-wide">מיוחדת</p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Section>

        {/* ── השעות הקרובות בפלוגה ───────────────── */}
        <Section label="השעות הקרובות בפלוגה">
          {events.length === 0 ? (
            <Card variant="muted">
              <div className="px-5 py-6 text-center">
                <p className="text-sm font-bold text-mil-olive-dim">הכל רגוע</p>
                <p className="text-xs text-mil-muted mt-1">אין שינויים מתוכננים ב-12 השעות הקרובות</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              {events.map((ev) => <TimelineCard key={ev.id} event={ev} onCta={() => ev.ctaHref && navigate(ev.ctaHref)} />)}
            </div>
          )}
        </Section>

        {/* ── פעילות מחלקות אחרונה (collapsed) ─────── */}
        <CollapsibleSection
          label="פעילות מחלקות אחרונה"
          open={showActivity}
          onToggle={() => setShowActivity((v) => !v)}
          count={openAlertCount}
        >
          {allAlerts.length === 0 ? (
            <Card>
              <p className="px-4 py-3 text-sm text-mil-muted">אין פעילות לתעד</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {allAlerts.slice(0, 8).map((a) => (
                <Card key={a.id}>
                  <div className="px-4 py-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      {a.status === 'open' && <StatusPill status={a.riskLevel === 'high' ? 'critical' : 'warning'}>פתוח</StatusPill>}
                      {a.status === 'acknowledged' && <span className="text-[10px] text-mil-muted">נצפה</span>}
                      {a.status === 'resolved' && <span className="text-[10px] text-mil-success">טופל</span>}
                      <span className="text-xs text-mil-ghost mr-auto">
                        {groups.find((g) => g.id === a.platoonId)?.name ?? '—'}
                      </span>
                    </div>
                    <p className="text-sm text-mil-text leading-snug">{a.description}</p>
                    {a.suggestedAction && (
                      <p className="text-xs text-mil-muted mt-1">{a.suggestedAction}</p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* ── הגדרות פלוגה ──────────────────────────── */}
        <Section label="הגדרות פלוגה">
          <Card>
            <div className="divide-y divide-mil-border">
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-mil-text">מינימום בבסיס</p>
                  <p className="text-xs text-mil-muted">{myCompany?.settings.minSoldiersOnBase ?? '—'} חיילים</p>
                </div>
                <span className="text-xs text-mil-ghost">בקרוב</span>
              </div>
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-mil-text">מבנה החברה</p>
                  <p className="text-xs text-mil-muted">{myPlatoons.length} מחלקות · {subUnits.filter((s) => myPlatoons.some((p) => p.id === s.platoonId)).length} תת-קבוצות</p>
                </div>
                <span className="text-xs text-mil-ghost">בקרוב</span>
              </div>
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-mil-text">משתמשים והרשאות</p>
                  <p className="text-xs text-mil-muted">ניהול חברי פלוגה</p>
                </div>
                <span className="text-xs text-mil-ghost">בקרוב</span>
              </div>
            </div>
          </Card>
        </Section>

      </PageMain>
    </div>
  );
}

// ─── Platoon Commander Dashboard (timeline-led) ──────────────────────────────
// Reads top-to-bottom as: now → next 12 hours → waiting work → primary action.
// No alerts feed. Override alerts that demand immediate attention surface as
// timeline cards; everything else lives in the company commander view.

function PlatoonCommanderDashboard() {
  const navigate = useNavigate();
  const { soldiers, leaves, groups, currentUser } = useApp();
  const activePeriod = useActivePeriod();
  const approvableRequests = useApprovableLeaveRequests();
  const myAlerts = useAlertsForCompany();           // platoon-tier sees only their own platoon's alerts

  const myPlatoon = groups.find((g) => g.id === currentUser?.commandedPlatoonId)
    ?? groups.find((g) => g.memberIds.includes(currentUser?.id ?? ''));

  // "Now" stats strip
  const today = new Date().toISOString().slice(0, 10);
  const onLeaveIds = useMemo(() => {
    const ids = new Set<string>();
    leaves.forEach((lv) => {
      if (today < lv.startDate || today > lv.endDate) return;
      if (lv.scope === 'individual') lv.soldierIds.forEach((id) => ids.add(id));
      else if (lv.scope === 'subUnit') soldiers.filter((s) => s.subUnitId === lv.subUnitId).forEach((s) => ids.add(s.id));
      else soldiers.forEach((s) => ids.add(s.id));
    });
    return ids;
  }, [leaves, soldiers, today]);
  const onBase     = soldiers.filter((s) => s.availability && !onLeaveIds.has(s.id)).length;
  const atHome     = onLeaveIds.size;
  const unavail    = soldiers.filter((s) => !s.availability && !onLeaveIds.has(s.id)).length;

  // Currently running missions (compact list)
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const activeMissions = useMemo(() => {
    if (!activePeriod) return [];
    return activePeriod.missionTypes.map((mt) => {
      const todayDate = activePeriod.missionTypes[0]?.timeSlots[0]?.date ?? today;
      const slots = mt.timeSlots.filter((ts) => ts.date === todayDate);
      const active = slots.find((ts) => {
        const s = timeToMins(ts.startTime);
        let e   = timeToMins(ts.endTime); if (e <= s) e += 24 * 60;
        const n = nowMins < s && (s - nowMins) > 12 * 60 ? nowMins + 24 * 60 : nowMins;
        return n >= s && n < e;
      });
      return active ? { mt, ts: active } : null;
    }).filter(Boolean) as Array<{ mt: MissionType; ts: TimeSlot }>;
  }, [activePeriod, today, nowMins]);

  // The timeline itself
  const pendingApprovals = approvableRequests.filter((r) => r.status === 'pending').length;
  const events = useMemo(() => buildPlatoonTimeline({
    now,
    period: activePeriod ?? null,
    leaves,
    soldiers,
    pendingApprovals,
    recentAlerts: myAlerts,
    horizonHours: 12,
  }), [now, activePeriod, leaves, soldiers, pendingApprovals, myAlerts]);

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title={myPlatoon?.name ?? 'מחלקה'} />
      <main className="px-4 py-4 pb-28 max-w-xl mx-auto space-y-5">

        {/* ── עכשיו ──────────────────────────────────────── */}
        <section>
          <p className="text-xs font-bold tracking-widest text-mil-muted uppercase mb-2 px-1">עכשיו</p>
          <div className="bg-mil-card border border-mil-border rounded-2xl px-4 py-3">
            <p className="text-sm text-mil-text">
              <span className="font-bold text-mil-olive">{onBase}</span> בבסיס
              <span className="text-mil-ghost mx-2">·</span>
              <span className="font-bold text-mil-sand">{atHome}</span> בבית
              <span className="text-mil-ghost mx-2">·</span>
              <span className="font-bold text-mil-ghost">{unavail}</span> לא זמין
            </p>
            {activeMissions.length > 0 && (
              <div className="mt-3 pt-3 border-t border-mil-border space-y-1.5">
                {activeMissions.map(({ mt, ts }) => {
                  const names = ts.assignedSoldierIds
                    .map((id) => soldiers.find((s) => s.id === id)?.name?.split(' ')[0])
                    .filter(Boolean) as string[];
                  return (
                    <div key={ts.id} className="flex items-center gap-3 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-mil-olive flex-shrink-0" />
                      <span className="font-medium text-mil-text">{mt.name}</span>
                      <span className="text-mil-olive truncate text-xs mr-auto">
                        {names.length > 0 ? names.join(' · ') : <span className="text-mil-muted">—</span>}
                      </span>
                      <span className="text-xs text-mil-ghost font-mono">{ts.startTime}–{ts.endTime}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── השעות הקרובות ──────────────────────────────── */}
        <section>
          <p className="text-xs font-bold tracking-widest text-mil-muted uppercase mb-2 px-1">השעות הקרובות</p>
          {events.length === 0 ? (
            <CalmCard />
          ) : (
            <div className="space-y-2">
              {events.map((ev) => <TimelineCard key={ev.id} event={ev} onCta={() => ev.ctaHref && navigate(ev.ctaHref)} />)}
            </div>
          )}
        </section>

        {/* ── Single primary action ─────────────────────── */}
        <button
          onClick={() => navigate('/schedule')}
          className="w-full bg-mil-olive hover:bg-mil-olive-light text-white font-bold py-4 rounded-2xl text-base transition-colors flex items-center justify-center gap-2"
        >
          <span className="text-lg">▦</span>
          <span>הכנס משימות לשיבוץ</span>
        </button>

      </main>
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
    <div className="bg-mil-card border border-mil-border rounded-xl flex overflow-hidden">
      <div className={`w-1 ${edge} flex-shrink-0`} />
      <div className="flex-1 px-4 py-3">
        <p className={`text-xs font-bold tracking-wide ${labelTone}`}>{event.whenLabel}</p>
        <p className="text-sm font-medium text-mil-text mt-0.5 leading-snug">{event.title}</p>
        {event.detail && <p className="text-xs text-mil-muted mt-1 leading-snug">{event.detail}</p>}
        {event.ctaLabel && (
          <button
            onClick={onCta}
            className="mt-2 text-xs font-bold text-mil-olive hover:text-mil-olive-dim border border-mil-olive/30 rounded-lg px-3 py-1 transition-colors"
          >
            {event.ctaLabel} ←
          </button>
        )}
      </div>
    </div>
  );
}

function CalmCard() {
  return (
    <div className="bg-mil-olive-bg border border-mil-olive/20 rounded-2xl px-5 py-6 text-center">
      <p className="text-sm font-bold text-mil-olive-dim">הכל רגוע</p>
      <p className="text-xs text-mil-muted mt-1">אין שינויים מתוכננים ב-12 השעות הקרובות</p>
    </div>
  );
}

// ─── Soldier Dashboard ────────────────────────────────────────────────────────

function SoldierDashboard() {
  const { soldiers, leaves, currentUser, groups, subUnits, setReminder, addLeaveRequest } = useApp();
  const activePeriod = useActivePeriod();
  const myGroup = groups.find((g) => g.memberIds.includes(currentUser?.id ?? ''));

  const myProfile = soldiers.find((s) => s.id === currentUser?.soldierProfileId || s.userId === currentUser?.id);
  const mySubUnitName = subUnits.find((s) => s.id === myProfile?.subUnitId)?.name ?? myProfile?.teamClass ?? '';

  // Collapsibles + modal state
  const [showWeek,    setShowWeek]    = useState(false);
  const [showRoster,  setShowRoster]  = useState(false);
  const [leaveOpen,   setLeaveOpen]   = useState(false);
  const [leaveSaved,  setLeaveSaved]  = useState(false);

  // Current wall-clock time (in minutes since midnight of "today")
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  // Use first scheduled date as our "today" for the demo
  const scheduleDate = useMemo(() => {
    return activePeriod?.missionTypes[0]?.timeSlots[0]?.date ?? new Date().toISOString().slice(0, 10);
  }, [activePeriod]);

  // Active right now: per mission, the slot whose [start, end) contains nowMins
  const activeMissions = useMemo(() => {
    if (!activePeriod) return [];
    return activePeriod.missionTypes.map((mt) => {
      const todaySlots = mt.timeSlots.filter((ts) => ts.date === scheduleDate);
      const active = todaySlots.find((ts) => {
        const s = timeToMins(ts.startTime);
        let e = timeToMins(ts.endTime);
        if (e <= s) e += 24 * 60;
        const n = nowMins < s && (s - nowMins) > 12 * 60 ? nowMins + 24 * 60 : nowMins;
        return n >= s && n < e;
      });
      return active ? { mt, ts: active } : null;
    }).filter(Boolean) as Array<{ mt: MissionType; ts: TimeSlot }>;
  }, [activePeriod, scheduleDate, nowMins]);

  // My next shift (upcoming, with wrap-around to next day)
  const myNextShift = useMemo(() => {
    if (!activePeriod || !myProfile) return null;
    const all: Array<{ mt: MissionType; ts: TimeSlot; minsTo: number }> = [];
    activePeriod.missionTypes.forEach((mt) => {
      mt.timeSlots
        .filter((ts) => ts.assignedSoldierIds.includes(myProfile.id))
        .forEach((ts) => {
          const s = timeToMins(ts.startTime);
          const minsTo = s < nowMins ? s + 24 * 60 - nowMins : s - nowMins;
          all.push({ mt, ts, minsTo });
        });
    });
    all.sort((a, b) => a.minsTo - b.minsTo);
    return all[0] ?? null;
  }, [activePeriod, myProfile, nowMins]);

  const teammates = myNextShift
    ? myNextShift.ts.assignedSoldierIds
        .filter((id) => id !== myProfile?.id)
        .map((id) => soldiers.find((s) => s.id === id))
        .filter(Boolean) as Soldier[]
    : [];

  const onLeaveSoldierIds = useMemo(() => {
    const ids = new Set<string>();
    leaves.forEach((lv) => {
      if (scheduleDate < lv.startDate || scheduleDate > lv.endDate) return;
      if (lv.scope === 'individual') lv.soldierIds.forEach((id) => ids.add(id));
      else if (lv.scope === 'subUnit') soldiers.filter((s) => s.subUnitId === lv.subUnitId).forEach((s) => ids.add(s.id));
      else soldiers.forEach((s) => ids.add(s.id));
    });
    return ids;
  }, [leaves, soldiers, scheduleDate]);

  // My upcoming shifts in the published period (sorted, all of them, not just next)
  const myUpcomingShifts = useMemo(() => {
    if (!activePeriod || !myProfile) return [];
    const out: Array<{ mt: MissionType; ts: TimeSlot }> = [];
    activePeriod.missionTypes.forEach((mt) => {
      mt.timeSlots
        .filter((ts) => ts.assignedSoldierIds.includes(myProfile.id))
        .forEach((ts) => out.push({ mt, ts }));
    });
    out.sort((a, b) =>
      a.ts.date === b.ts.date
        ? a.ts.startTime.localeCompare(b.ts.startTime)
        : a.ts.date.localeCompare(b.ts.date),
    );
    return out;
  }, [activePeriod, myProfile]);

  const submitLeaveRequest = (data: { startDate: string; startTime: string; endDate: string; endTime: string; reason: string }) => {
    if (!myProfile) return;
    addLeaveRequest({
      soldierId:           myProfile.id,
      soldierName:         myProfile.name,
      soldierTeamClass:    myProfile.teamClass,
      soldierSubUnitId:    myProfile.subUnitId,
      soldierSubUnitName:  mySubUnitName || undefined,
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
      <main className="px-4 py-4 pb-32 max-w-xl mx-auto space-y-4">

        {/* Toast on successful leave-request submit */}
        {leaveSaved && (
          <div className="bg-mil-success-bg border border-mil-success/40 text-mil-success rounded-xl px-4 py-3 text-sm flex items-center gap-2">
            <span>✓</span> בקשת היציאה הוגשה למ״מ
          </div>
        )}

        {/* Greeting — one line, calm */}
        <div>
          <h2 className="text-xl font-bold text-mil-text">שלום, {currentUser?.name?.split(' ')[0]}</h2>
          <p className="text-sm text-mil-muted mt-0.5">
            {myGroup?.name}
            {mySubUnitName && ` · ${mySubUnitName}`}
            {myProfile && myProfile.operationalRoles.length > 0 && ` · ${myProfile.operationalRoles.join(', ')}`}
          </p>
        </div>

        {/* HERO: my next shift (or fallback if none) */}
        {myNextShift ? (
          <NextShiftCard
            mission={myNextShift.mt}
            slot={myNextShift.ts}
            minsTo={myNextShift.minsTo}
            teammates={teammates}
            onSetReminder={(mins) => setReminder({ timeSlotId: myNextShift.ts.id, minutesBefore: mins, enabled: true })}
          />
        ) : (
          <div className="bg-mil-card border border-mil-border rounded-2xl px-4 py-6 text-center">
            <p className="text-mil-muted text-sm">אין שיבוץ עתידי</p>
            <p className="text-xs text-mil-ghost mt-1">תקבל הודעה כשהמ״מ יפרסם סידור חדש</p>
          </div>
        )}

        {/* Compact "מי על שמירה כרגע" — only if something is running */}
        {activeMissions.length > 0 && (
          <div className="bg-mil-card border border-mil-border rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-mil-border bg-mil-bg">
              <span className="text-xs font-bold tracking-widest text-mil-muted">מי על שמירה כרגע</span>
            </div>
            <div className="divide-y divide-mil-border">
              {activeMissions.map(({ mt, ts }) => {
                const names = ts.assignedSoldierIds
                  .map((id) => soldiers.find((s) => s.id === id)?.name?.split(' ')[0])
                  .filter(Boolean) as string[];
                return (
                  <div key={ts.id} className="px-4 py-2.5 flex items-center gap-3">
                    <span className="text-sm font-medium text-mil-text">{mt.name}</span>
                    <span className="text-xs text-mil-ghost mr-auto">{ts.startTime}–{ts.endTime}</span>
                    <span className="text-sm text-mil-olive truncate max-w-[55%] text-left">
                      {names.length > 0 ? names.join(' · ') : <span className="text-mil-muted">—</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Collapsible: my schedule this week */}
        <CollapsibleCard
          title="הסידור שלי השבוע"
          count={myUpcomingShifts.length}
          open={showWeek}
          onToggle={() => setShowWeek((v) => !v)}
        >
          {myUpcomingShifts.length === 0 ? (
            <p className="px-4 py-3 text-sm text-mil-muted">אין משמרות מתוכננות</p>
          ) : (
            <div className="divide-y divide-mil-border">
              {myUpcomingShifts.map(({ mt, ts }) => (
                <div key={ts.id} className="px-4 py-2.5 flex items-center gap-3">
                  <span className="text-xs text-mil-ghost w-20 flex-shrink-0">{ts.date}</span>
                  <span className="text-sm font-medium text-mil-text flex-1 truncate">{mt.name}</span>
                  <span className="text-xs text-mil-muted font-mono">{ts.startTime}–{ts.endTime}</span>
                </div>
              ))}
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
              const subUnit = subUnits.find((su) => su.id === s.subUnitId)?.name ?? s.teamClass;
              return (
                <div key={s.id} className="px-4 py-2.5 flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${tone} flex-shrink-0`} />
                  <span className="text-sm text-mil-text flex-1">{s.name}</span>
                  <span className="text-xs text-mil-muted">{subUnit}</span>
                </div>
              );
            })}
          </div>
        </CollapsibleCard>

      </main>

      {/* FAB — bottom-left for RTL, above bottom nav */}
      <button
        onClick={() => setLeaveOpen(true)}
        className="fixed bottom-24 left-4 z-20 bg-mil-olive hover:bg-mil-olive-light text-white font-bold px-5 py-3.5 rounded-full shadow-lg flex items-center gap-2 transition-colors"
      >
        <span className="text-lg leading-none">+</span>
        <span className="text-sm">בקשת יציאה</span>
      </button>

      {/* Leave-request modal */}
      {leaveOpen && (
        <LeaveRequestModal
          onClose={() => setLeaveOpen(false)}
          onSubmit={submitLeaveRequest}
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
    <div className="bg-mil-card border border-mil-border rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 bg-mil-bg flex items-center gap-2 hover:bg-mil-card-hover transition-colors"
      >
        <span className="text-sm font-bold text-mil-text">{title}</span>
        {count != null && <span className="text-xs text-mil-ghost">({count})</span>}
        <span className="mr-auto text-mil-ghost">{open ? '▲' : '▼'}</span>
      </button>
      {open && children}
    </div>
  );
}

// ─── NextShiftCard with Wake-me-up ────────────────────────────────────────────

function NextShiftCard({
  mission, slot, minsTo, teammates, onSetReminder,
}: {
  mission: MissionType; slot: TimeSlot; minsTo: number;
  teammates: Soldier[];
  onSetReminder: (mins: 5 | 15 | 30 | 60) => void;
}) {
  const [activeReminder, setActiveReminder] = useState<5 | 15 | 30 | 60 | null>(null);

  const handleReminder = (mins: 5 | 15 | 30 | 60) => {
    onSetReminder(mins);
    setActiveReminder(mins);
  };

  return (
    <div className="bg-mil-card border-2 border-mil-olive/40 rounded-2xl overflow-hidden">
      <div className="bg-mil-olive px-4 py-2.5 flex items-center justify-between">
        <span className="text-xs font-bold tracking-widest text-white">המשמרת הבאה שלך</span>
        <span className="text-xs text-white/80">{formatRelative(minsTo)}</span>
      </div>
      <div className="px-4 py-4 space-y-3">
        <div>
          <p className="text-xl font-bold text-mil-text">{mission.name}</p>
          <p className="text-sm text-mil-muted mt-0.5">
            <span className="font-mono">{slot.startTime}–{slot.endTime}</span>
            <span className="mx-2 text-mil-ghost">·</span>
            <span>{slot.date}</span>
          </p>
        </div>

        {teammates.length > 0 && (
          <div className="bg-mil-bg border border-mil-border rounded-lg px-3 py-2">
            <p className="text-xs text-mil-muted mb-1">יחד עם:</p>
            <p className="text-sm text-mil-text font-medium">{teammates.map((s) => s.name).join(' · ')}</p>
          </div>
        )}

        {/* Wake me up */}
        <div className="border-t border-mil-border pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-mil-text flex items-center gap-2">
              <span className="text-mil-warn">🔔</span>
              תעיר אותי
            </span>
            {activeReminder && (
              <span className="text-xs text-mil-success font-bold">✓ נקבעה תזכורת ({activeReminder} דק׳ לפני)</span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {([5, 15, 30, 60] as const).map((m) => (
              <button
                key={m}
                onClick={() => handleReminder(m)}
                className={`py-2 rounded-lg text-xs font-bold transition-colors border ${
                  activeReminder === m
                    ? 'bg-mil-olive border-mil-olive text-white'
                    : 'bg-mil-bg border-mil-border text-mil-text hover:border-mil-olive hover:bg-mil-olive-bg'
                }`}
              >
                {m === 60 ? 'שעה' : `${m} דק׳`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

