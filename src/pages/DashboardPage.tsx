import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useActivePeriod, useApprovableLeaveRequests, useAlertsForCompany, useMyCompany, useMyPlatoons } from '../context/AppContext';
import Header from '../components/Header';
import { isPlatoonLeadership, isCompanyLeadership } from '../utils/permissions';
import { buildPlatoonTimeline, type OpsEvent } from '../utils/timeline';
import {
  Card, Button, StatusPill, StatusDot, Section, PageMain, CollapsibleSection,
  PageTitle, CardTitle, Body, Muted, Hint, Metric,
} from '../components/ui';
import type { TimeSlot, MissionType, Soldier, SoldierStatus } from '../types';

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
  const { soldiers, leaves, squads, platoons, overrideAlerts } = useApp();
  const myCompany = useMyCompany();
  const myPlatoons = useMyPlatoons();
  const allAlerts = useAlertsForCompany();
  const activePeriod = useActivePeriod();

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  // Soldiers attached to a platoon via their squad (squad.platoonId)
  const soldiersInPlatoon = (platoonId: string): Soldier[] => {
    const ids = squads.filter((s) => s.platoonId === platoonId).map((s) => s.id);
    return soldiers.filter((s) => s.squadId && ids.includes(s.squadId));
  };

  const onLeaveIds = useMemo(() => {
    const ids = new Set<string>();
    leaves.forEach((lv) => {
      if (today < lv.startDate || today > lv.endDate) return;
      if (lv.scope === 'individual') lv.soldierIds.forEach((id) => ids.add(id));
      else if (lv.scope === 'squad') soldiers.filter((s) => s.squadId === lv.squadId).forEach((s) => ids.add(s.id));
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

        {/* Greeting — establishes page identity at the top of the scroll */}
        <div>
          <PageTitle>{myCompany?.name ?? 'פלוגה'}</PageTitle>
          {myCompany?.unitName && <Muted className="mt-1">{myCompany.unitName}</Muted>}
        </div>

        {/* ── עכשיו ──────────────────────────────────── */}
        <Section label="עכשיו">
          <Card>
            <div className="px-5 py-4 flex items-baseline gap-2">
              <Metric>{totalOnBase}</Metric>
              <Hint className="self-end pb-1.5">/ {totalSoldiers}</Hint>
              <Body className="self-end pb-1.5 mr-1">בבסיס</Body>
              <Muted className="mr-auto">{platoonStats.length} מחלקות</Muted>
            </div>
          </Card>

          {platoonStats.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              {platoonStats.map((ps) => (
                <Card
                  key={ps.platoon.id}
                  variant={ps.status === 'critical' ? 'critical' : 'default'}
                >
                  <div className="px-4 py-3.5 text-right">
                    <div className="flex items-start justify-between mb-2">
                      <CardTitle>{ps.platoon.name}</CardTitle>
                      <StatusDot status={ps.status} />
                    </div>
                    <Body>
                      <span className="font-extrabold text-mil-text">{ps.onBase}</span>
                      <Hint as="span" className="mx-0.5">/ {ps.total}</Hint>
                      <span className="mr-1">בבסיס</span>
                    </Body>
                    {ps.atHome > 0 && <Hint className="text-mil-sand mt-0.5">{ps.atHome} בבית</Hint>}
                    {ps.platoon.isSpecialPlatoon && <Hint className="mt-1 tracking-wide">מיוחדת</Hint>}
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
              <div className="px-5 py-8 text-center">
                <Body className="font-bold text-mil-olive-dim">הכל רגוע</Body>
                <Muted className="mt-1.5">אין שינויים מתוכננים ב-12 השעות הקרובות</Muted>
              </div>
            </Card>
          ) : (
            <div className="space-y-2.5">
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
              <Body className="px-4 py-3 text-mil-muted">אין פעילות לתעד</Body>
            </Card>
          ) : (
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
          )}
        </CollapsibleSection>

        {/* ── הגדרות פלוגה ──────────────────────────── */}
        <Section label="הגדרות פלוגה">
          <Card>
            <div className="divide-y divide-mil-border">
              <SettingsRow
                title="מינימום בבסיס"
                detail={`${myCompany?.settings.minSoldiersOnBase ?? '—'} חיילים`}
              />
              <SettingsRow
                title="מבנה החברה"
                detail={`${myPlatoons.length} מחלקות · ${squads.filter((s) => myPlatoons.some((p) => p.id === s.platoonId)).length} כיתות`}
              />
              <SettingsRow
                title="משתמשים והרשאות"
                detail="ניהול חברי פלוגה"
              />
            </div>
          </Card>
        </Section>

      </PageMain>
    </div>
  );
}

function SettingsRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="px-4 py-3.5 flex items-center gap-3">
      <div className="flex-1">
        <Body className="font-semibold">{title}</Body>
        <Muted className="mt-0.5">{detail}</Muted>
      </div>
      <Hint>בקרוב</Hint>
    </div>
  );
}

// ─── Platoon Commander Dashboard (timeline-led) ──────────────────────────────
// Reads top-to-bottom as: now → next 12 hours → waiting work → primary action.
// No alerts feed. Override alerts that demand immediate attention surface as
// timeline cards; everything else lives in the company commander view.

function PlatoonCommanderDashboard() {
  const navigate = useNavigate();
  const { soldiers, leaves, platoons, currentUser } = useApp();
  const activePeriod = useActivePeriod();
  const approvableRequests = useApprovableLeaveRequests();
  const myAlerts = useAlertsForCompany();           // platoon-tier sees only their own platoon's alerts

  const myPlatoon = platoons.find((g) => g.id === currentUser?.commandedPlatoonId)
    ?? platoons.find((g) => g.memberIds.includes(currentUser?.id ?? ''));

  // "Now" stats strip
  const today = new Date().toISOString().slice(0, 10);
  const onLeaveIds = useMemo(() => {
    const ids = new Set<string>();
    leaves.forEach((lv) => {
      if (today < lv.startDate || today > lv.endDate) return;
      if (lv.scope === 'individual') lv.soldierIds.forEach((id) => ids.add(id));
      else if (lv.scope === 'squad') soldiers.filter((s) => s.squadId === lv.squadId).forEach((s) => ids.add(s.id));
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
      <PageMain>

        {/* Greeting */}
        <div>
          <PageTitle>{myPlatoon?.name ?? 'מחלקה'}</PageTitle>
          {myPlatoon?.unitName && <Muted className="mt-1">{myPlatoon.unitName}</Muted>}
        </div>

        {/* ── עכשיו ─────────────────────────────────── */}
        <Section label="עכשיו">
          <Card>
            <div className="px-5 py-4">
              <div className="flex items-baseline gap-4 flex-wrap">
                <StatGroup metric={onBase} label="בבסיס" tone="olive" />
                <StatGroup metric={atHome} label="בבית"   tone="sand"  />
                <StatGroup metric={unavail} label="לא זמין" tone="ghost" />
              </div>
              {activeMissions.length > 0 && (
                <div className="mt-4 pt-4 border-t border-mil-border space-y-2">
                  {activeMissions.map(({ mt, ts }) => {
                    const names = ts.assignedSoldierIds
                      .map((id) => soldiers.find((s) => s.id === id)?.name?.split(' ')[0])
                      .filter(Boolean) as string[];
                    return (
                      <div key={ts.id} className="flex items-center gap-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-mil-olive flex-shrink-0" />
                        <Body className="font-semibold">{mt.name}</Body>
                        <Muted className="truncate mr-auto text-mil-olive-dim">
                          {names.length > 0 ? names.join(' · ') : '—'}
                        </Muted>
                        <Hint className="font-mono">{ts.startTime}–{ts.endTime}</Hint>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </Section>

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
          onClick={() => navigate('/schedule')}
        >
          הכנס משימות לשיבוץ ←
        </Button>

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
    <div className="bg-mil-card border border-mil-border rounded-2xl flex overflow-hidden shadow-card">
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

function StatGroup({ metric, label, tone }: { metric: number; label: string; tone: 'olive' | 'sand' | 'ghost' }) {
  const color =
    tone === 'olive' ? 'text-mil-olive' :
    tone === 'sand'  ? 'text-mil-sand'  :
    'text-mil-ghost';
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-2xl font-extrabold tabular-nums ${color}`}>{metric}</span>
      <Muted className="font-medium">{label}</Muted>
    </div>
  );
}

// ─── Soldier Dashboard ────────────────────────────────────────────────────────

function SoldierDashboard() {
  const { soldiers, leaves, currentUser, platoons, squads, setReminder, addLeaveRequest, updateSoldierStatus } = useApp();
  const activePeriod = useActivePeriod();
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
      else if (lv.scope === 'squad') soldiers.filter((s) => s.squadId === lv.squadId).forEach((s) => ids.add(s.id));
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
            nextShift={myNextShift ? { mission: myNextShift.mt, slot: myNextShift.ts, minsTo: myNextShift.minsTo, teammates } : null}
            onSetReminder={(mins) => myNextShift && setReminder({ timeSlotId: myNextShift.ts.id, minutesBefore: mins, enabled: true })}
            onOpenStatusUpdate={() => setStatusUpdateOpen(true)}
          />
        )}

        {/* Compact "מי על שמירה כרגע" — only if something is running */}
        {activeMissions.length > 0 && (
          <Section label="מי על שמירה כרגע">
            <Card>
              <div className="divide-y divide-mil-border">
                {activeMissions.map(({ mt, ts }) => {
                  const names = ts.assignedSoldierIds
                    .map((id) => soldiers.find((s) => s.id === id)?.name?.split(' ')[0])
                    .filter(Boolean) as string[];
                  return (
                    <div key={ts.id} className="px-4 py-3 flex items-center gap-3">
                      <Body className="font-semibold">{mt.name}</Body>
                      <Hint className="font-mono mr-auto">{ts.startTime}–{ts.endTime}</Hint>
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
              {myUpcomingShifts.map(({ mt, ts }) => (
                <div key={ts.id} className="px-4 py-3 flex items-center gap-3">
                  <Hint className="w-20 flex-shrink-0">{ts.date}</Hint>
                  <Body className="font-semibold flex-1 truncate">{mt.name}</Body>
                  <Muted className="font-mono">{ts.startTime}–{ts.endTime}</Muted>
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

function OperationalStateCard({
  soldier, leaves, nextShift, onSetReminder, onOpenStatusUpdate,
}: {
  soldier: Soldier;
  leaves: import('../types').Leave[];
  nextShift: { mission: MissionType; slot: TimeSlot; minsTo: number; teammates: Soldier[] } | null;
  onSetReminder: (mins: 5 | 15 | 30 | 60) => void;
  onOpenStatusUpdate: () => void;
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
          <Hint className="tracking-widest">המצב שלך</Hint>
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
            <Hint className="tracking-widest">המשמרת הבאה</Hint>
            <p className="text-lg font-bold text-mil-text mt-1.5 leading-snug">{nextShift.mission.name}</p>
            <Muted className="mt-1">
              <span className="font-mono font-semibold text-mil-text">{nextShift.slot.startTime}–{nextShift.slot.endTime}</span>
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

