// Rasap Dashboard (round 7) — the logistics chief is FIRST a soldier.
//
// Layout:
//   1. Personal greeting + identity
//   2. Logistics summary card — open gaps, items in repair, signed-out
//   3. Open damage queue — top 5, link to /rasap for full
//   4. Quick logistics actions — sign-out + damage + inventory
//   5. Soldier-spine — operational state + next shift + announcements
//   6. PersonalActionsFab — universal personal toolbox
//
// The Rasap doesn't lose their soldier identity. They get the same
// status card, leave-request flow, and personal profile. The page just
// ALSO carries their logistics-management toolbox so they don't need
// to navigate to /rasap for the common actions.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useMyCompany } from '../../context/AppContext';
import { materializeWeek } from '../../utils/materialize';
import Header from '../../components/Header';
import AnnouncementsStrip from '../../components/AnnouncementsStrip';
import AlertsButton from '../../components/AlertsButton';
import PersonalActionsFab from '../../components/PersonalActionsFab';
import SignOutSheet from '../../components/SignOutSheet';
import DamageReportSheet from '../../components/DamageReportSheet';
import {
  Section, PageMain, PageTitle, Body, Muted, Hint, Button, EmptyState,
} from '../../components/ui';

export default function RasapDashboard() {
  const navigate = useNavigate();
  const {
    currentUser, soldiers, platoons, leaves, missions, dutyExclusions, squads,
    signedEquipment, equipmentGaps,
  } = useApp();
  const myCompany = useMyCompany();

  // Hooks first.
  const now = useMemo(() => new Date(), []);
  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [damageOpen,  setDamageOpen]  = useState(false);

  const myProfile = soldiers.find((s) => s.id === currentUser?.soldierProfileId || s.userId === currentUser?.id);

  const materializedSlots = useMemo(() => materializeWeek({
    missions, platoons, squads, soldiers, leaves, dutyExclusions,
    startDay: todayStart, days: 7,
  }), [missions, platoons, squads, soldiers, leaves, dutyExclusions, todayStart]);

  // My personal slots (Rasap can also be assigned to ops missions)
  const myNextShift = useMemo(() => {
    if (!myProfile) return null;
    const upcoming = materializedSlots
      .filter((slot) =>
        slot.assignedSoldierIds.includes(myProfile.id) || slot.commanderSoldierId === myProfile.id,
      )
      .filter((slot) => Date.parse(slot.start) > now.getTime())
      .sort((a, b) => a.start.localeCompare(b.start));
    const next = upcoming[0];
    if (!next) return null;
    const minsTo = Math.floor((Date.parse(next.start) - now.getTime()) / 60000);
    return { slot: next, minsTo };
  }, [materializedSlots, myProfile, now]);

  // Logistics KPIs
  const companySigned = useMemo(
    () => signedEquipment.filter((s) => s.companyId === myCompany?.id),
    [signedEquipment, myCompany],
  );
  const companyGaps = useMemo(
    () => equipmentGaps.filter((g) => g.companyId === myCompany?.id),
    [equipmentGaps, myCompany],
  );
  const kpi = useMemo(() => ({
    deployed: companySigned.filter((s) => s.status === 'active').length,
    inRepair: companySigned.filter((s) => s.status === 'in-repair').length,
    openGaps: companyGaps.filter((g) => g.status === 'reported' || g.status === 'reviewed-by-platoon' || g.status === 'forwarded-to-rasap').length,
  }), [companySigned, companyGaps]);

  const openQueue = useMemo(
    () => companyGaps
      .filter((g) => g.status === 'reported' || g.status === 'reviewed-by-platoon' || g.status === 'forwarded-to-rasap')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5),
    [companyGaps],
  );

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="רס״פ" />
      <PageMain>

        {/* ── 1. Personal greeting ── */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <PageTitle>שלום, {currentUser?.name?.split(' ')[0]}</PageTitle>
            <Muted className="mt-1.5">
              רס״פ · {myCompany?.name ?? 'פלוגה'}
            </Muted>
          </div>
          <AlertsButton />
        </div>

        {/* ── 2. Logistics summary — the role's command picture ── */}
        <section className="bg-mil-card border border-mil-border rounded-2xl-soft shadow-hero p-6">
          <div className="text-tiny text-mil-muted font-medium uppercase tracking-wide">תמונת לוגיסטיקה</div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <RasapKpi label="ציוד חתום" value={kpi.deployed} tone="success" />
            <RasapKpi label="בתיקון" value={kpi.inRepair} tone="warn" muted={kpi.inRepair === 0} />
            <RasapKpi label="ליקויים פתוחים" value={kpi.openGaps} tone="alert" muted={kpi.openGaps === 0} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="primary" size="md" onClick={() => setSignOutOpen(true)}>
              + החתמת ציוד
            </Button>
            <Button variant="secondary" size="md" onClick={() => navigate('/rasap')}>
              לוח רס״פ מלא ←
            </Button>
          </div>
        </section>

        {/* ── 3. Open damage queue ── */}
        <Section
          label={`תור ליקויים · ${kpi.openGaps}`}
          action={openQueue.length > 0 && (
            <button onClick={() => navigate('/rasap')} className="text-tiny font-semibold text-mil-olive hover:text-mil-olive-dim">
              ניהול מלא ←
            </button>
          )}
        >
          {openQueue.length === 0 ? (
            <EmptyState title="אין ליקויים פתוחים" hint="כל הציוד תקין כרגע." />
          ) : (
            <div className="bg-mil-card border border-mil-border rounded-2xl shadow-card divide-y divide-mil-border overflow-hidden">
              {openQueue.map((g) => (
                <button
                  key={g.id}
                  onClick={() => navigate('/rasap')}
                  className="w-full text-right px-5 py-3.5 flex items-center gap-3 hover:bg-mil-card-hover transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-mil-warn flex-shrink-0" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <Body className="font-semibold truncate">{g.itemName}</Body>
                    <Hint className="text-mil-muted truncate text-tiny mt-0.5">
                      {g.reportedByName}
                      {g.description && ` · ${g.description.slice(0, 60)}`}
                    </Hint>
                  </div>
                  <span className="text-mil-ghost">←</span>
                </button>
              ))}
            </div>
          )}
        </Section>

        {/* ── 4. Quick personal damage report ── */}
        <Section label="פעולות מהירות">
          <button
            onClick={() => setDamageOpen(true)}
            className="w-full text-right bg-mil-card border border-mil-border rounded-xl-soft shadow-card hover:shadow-card-hover hover:border-mil-border-strong transition-all duration-200 ease-out-soft px-5 py-4 flex items-center gap-3.5"
          >
            <span className="w-9 h-9 rounded-xl-soft bg-mil-alert-bg text-mil-alert flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 L22 20 H2 Z" />
                <path d="M12 9 v5" />
                <circle cx="12" cy="17.5" r="0.5" fill="currentColor" />
              </svg>
            </span>
            <div className="flex-1 min-w-0">
              <Body className="font-semibold leading-tight">דווח בלאי מבסיס המלאי</Body>
              <Hint className="block mt-0.5 text-mil-muted">פריט מרשימת המלאי / טקסט חופשי</Hint>
            </div>
            <span className="text-mil-ghost">←</span>
          </button>
        </Section>

        {/* ── 5. Announcements visible to this user ── */}
        <AnnouncementsStrip isCommander={false} />

        {/* ── 6. Soldier-spine: my next shift ── */}
        {myNextShift && (
          <Section label="המשמרת הבאה שלי">
            <button
              onClick={() => navigate(`/mission/${myNextShift.slot.missionId}`)}
              className="w-full text-right bg-mil-card border border-mil-border rounded-xl-soft shadow-card hover:shadow-card-hover transition-all duration-200 ease-out-soft px-5 py-4"
            >
              <Body className="font-semibold leading-tight">{myNextShift.slot.missionName}</Body>
              <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
                <span className="text-base font-bold tabular-nums text-mil-text">
                  {new Date(myNextShift.slot.start).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <Hint className="text-mil-muted">
                  בעוד {myNextShift.minsTo < 60 ? `${myNextShift.minsTo} דקות` : `${Math.floor(myNextShift.minsTo / 60)} שעות`}
                </Hint>
              </div>
            </button>
          </Section>
        )}

      </PageMain>

      {signOutOpen && <SignOutSheet open onClose={() => setSignOutOpen(false)} />}
      {damageOpen  && <DamageReportSheet open onClose={() => setDamageOpen(false)} />}

      {/* Personal toolbox always available */}
      <PersonalActionsFab />
    </div>
  );
}

// ─── KPI tile ────────────────────────────────────────────────────────────

function RasapKpi({
  label, value, tone, muted = false,
}: {
  label: string;
  value: number;
  tone: 'success' | 'warn' | 'alert';
  muted?: boolean;
}) {
  const toneClass = {
    success: 'text-mil-success',
    warn:    'text-mil-warn',
    alert:   'text-mil-alert',
  }[tone];
  return (
    <div className="bg-mil-bg-alt/70 border border-mil-border/70 rounded-xl-soft px-3 py-3">
      <span className={`text-2xl font-bold tabular-nums tracking-tightish ${muted ? 'text-mil-ghost' : toneClass}`}>
        {value}
      </span>
      <Hint className="block text-tiny font-medium text-mil-muted mt-0.5">{label}</Hint>
    </div>
  );
}
