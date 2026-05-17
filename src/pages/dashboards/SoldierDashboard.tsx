// Soldier Dashboard — hero-led personal command picture.
//
// Reads top-to-bottom:
//   1. Greeting + context
//   2. OperationalStateCard (current state + next shift + reminders)
//   3. TourOfDutyMini (line days)
//   4. SoldierCycleHint (when published cycle covers viewer)
//   5. Announcements strip
//   6. Currently-running missions in the platoon
//   7. Collapsible: my week / roster
// FAB: leave request.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { resolveMySoldier } from '../../utils/resolveSoldier';
import { activeSegmentForSoldier } from '../../utils/leaveCycleProjection';
import { materializeWeek } from '../../utils/materialize';
import {
  deriveTimelineEvents, selectTimelineFor,
} from '../../utils/operationalTimeline';
import Header from '../../components/Header';
import OperationalTimelineStrip from '../../components/OperationalTimelineStrip';
import AnnouncementsStrip from '../../components/AnnouncementsStrip';
import { TourOfDutyMini } from '../../components/TourOfDutyCard';
import {
  Card, Button, Section, PageMain, PageTitle, CardTitle,
  Body, Muted, Hint, Sheet, Toast,
} from '../../components/ui';
import { hhmm, formatRelative } from './_shared/timeFormat';
import type { Soldier, SoldierStatus, Leave } from '../../types';

// ─── SoldierDashboard page ──────────────────────────────────────────────

export default function SoldierDashboard() {
  const navigate = useNavigate();
  const {
    soldiers, leaves, currentUser, platoons, squads, setReminder, addLeaveRequest, updateSoldierStatus,
    missions, dutyExclusions, assignments, slotOperationalState,
    platoonLeaveDays, announcements,
  } = useApp();
  const myPlatoon = platoons.find((p) => p.id === currentUser?.platoonId);

  const myProfile = resolveMySoldier(soldiers, currentUser);
  const mySquadName = squads.find((s) => s.id === myProfile?.squadId)?.name ?? myProfile?.teamClass ?? '';

  // Soldiers in the viewer's own platoon — scoped via squad membership.
  // Without this, "צוות המחלקה" rendered all 74 company soldiers as if
  // they were one platoon. Hard cap is the platoon's actual size (~20).
  const platoonTeammates = useMemo(() => {
    if (!myPlatoon) return soldiers;
    const platoonSquadIds = new Set(
      squads.filter((sq) => sq.platoonId === myPlatoon.id).map((sq) => sq.id),
    );
    return soldiers.filter((s) => s.squadId && platoonSquadIds.has(s.squadId));
  }, [soldiers, squads, myPlatoon]);

  const [showWeek,    setShowWeek]    = useState(false);
  const [showRoster,  setShowRoster]  = useState(false);
  const [leaveOpen,   setLeaveOpen]   = useState(false);
  const [leaveSaved,  setLeaveSaved]  = useState(false);
  const [statusUpdateOpen, setStatusUpdateOpen] = useState(false);
  const [statusToastMsg,   setStatusToastMsg]   = useState('');

  const now = useMemo(() => new Date(), []);
  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const todayIso = useMemo(() => todayStart.toISOString().slice(0, 10), [todayStart]);

  const materializedSlots = useMemo(() => materializeWeek({
    missions, platoons, squads, soldiers, leaves, dutyExclusions,
    startDay: todayStart, days: 7,
    assignments,
    slotOperationalState,
  }), [missions, platoons, squads, soldiers, leaves, dutyExclusions, todayStart, assignments, slotOperationalState]);

  const mySlots = useMemo(() => {
    if (!myProfile) return [];
    return materializedSlots.filter((slot) =>
      slot.assignedSoldierIds.includes(myProfile.id) || slot.commanderSoldierId === myProfile.id
    );
  }, [materializedSlots, myProfile]);

  const activeMissions = useMemo(() => {
    return mySlots.filter((slot) => {
      const s = Date.parse(slot.start);
      const e = Date.parse(slot.end);
      return s <= now.getTime() && now.getTime() < e;
    });
  }, [mySlots, now]);

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

  const myUpcomingShifts = useMemo(
    () => mySlots.slice().sort((a, b) => a.start.localeCompare(b.start)),
    [mySlots],
  );

  // Phase 7.3 — soldier-scoped operational timeline. Soldier sees ONLY
  // events that name them (next-shift, shift-end, readiness-on for
  // their slots). No platoon noise, no company noise. Limit 4.
  const personalTimeline = useMemo(() => {
    if (!myProfile || !myPlatoon) return [];
    const all = deriveTimelineEvents({
      nowIso: now.toISOString(),
      horizonHours: 36,
      slots: materializedSlots,
      missions, platoons, soldiers, platoonLeaveDays, announcements,
      companyId: myPlatoon.companyId,
    });
    return selectTimelineFor({
      events: all,
      viewerSoldierId: myProfile.id,
      // intentionally NOT passing viewerPlatoonId — soldier home keeps
      // platoon-scoped noise (e.g. "מחלקה יוצאת") off the page unless
      // the event also names the soldier directly via soldier-scope.
      limit: 4,
    });
  }, [myProfile, myPlatoon, now, materializedSlots, missions, platoons, soldiers, platoonLeaveDays, announcements]);

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

        {leaveSaved && <Toast tone="success">בקשת היציאה הוגשה למ״מ</Toast>}
        {statusToastMsg && <Toast tone="olive">{statusToastMsg}</Toast>}

        <div>
          <PageTitle>שלום, {currentUser?.name?.split(' ')[0]}</PageTitle>
          <Muted className="mt-1.5">
            {myPlatoon?.name}
            {mySquadName && ` · ${mySquadName}`}
            {myProfile && myProfile.operationalRoles.length > 0 && ` · ${myProfile.operationalRoles.join(', ')}`}
          </Muted>
        </div>

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

        {/* Phase 7.3 — personal operational timeline. Soldier-scoped only:
            shifts that name them, shift endings, readiness slots they're
            assigned to. Platoon-scoped events (yes-this-week-my-machlaka-
            goes-home) do NOT appear here unless the engine emitted a
            soldier-scope for this specific viewer. */}
        {myProfile && personalTimeline.length > 0 && (
          <OperationalTimelineStrip
            events={personalTimeline}
            label="הציר שלך"
            compact
          />
        )}

        {myProfile && <TourOfDutyMini soldier={myProfile} />}
        {myProfile && <SoldierCycleHint soldier={myProfile} />}

        <AnnouncementsStrip isCommander={false} />

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
                      <Hint className="font-mono mr-auto">{hhmm(new Date(slot.start))}–{hhmm(new Date(slot.end))}</Hint>
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

        <CollapsibleCard
          title={`צוות ${myPlatoon?.name ?? 'המחלקה'}`}
          count={platoonTeammates.length}
          open={showRoster}
          onToggle={() => setShowRoster((v) => !v)}
        >
          <div className="divide-y divide-mil-border max-h-80 overflow-y-auto">
            {platoonTeammates.map((s) => {
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

      <button
        onClick={() => setLeaveOpen(true)}
        className="fixed bottom-24 left-5 z-20 bg-mil-olive hover:bg-mil-olive-light active:bg-mil-olive-dim text-white font-semibold px-5 py-3.5 rounded-2xl shadow-pop flex items-center gap-2 transition-all duration-200 ease-out-soft active:scale-95 hover:shadow-hero"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span className="text-sm">בקשת יציאה</span>
      </button>

      {leaveOpen && (
        <LeaveRequestModal onClose={() => setLeaveOpen(false)} onSubmit={submitLeaveRequest} />
      )}

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

// ─── LeaveRequestModal ───────────────────────────────────────────────────

function LeaveRequestModal({
  onClose, onSubmit,
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
    <Sheet open onClose={onClose} title="בקשת יציאה" subtitle="הבקשה תישלח למ״מ לאישור">
      <div className="px-5 py-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-tiny text-mil-muted mb-1.5 font-semibold">יציאה — תאריך</label>
            <input type="date" className={modalInp} value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div>
            <label className="block text-tiny text-mil-muted mb-1.5 font-semibold">שעה</label>
            <input type="time" className={modalInp} value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
          </div>
          <div>
            <label className="block text-tiny text-mil-muted mb-1.5 font-semibold">חזרה — תאריך</label>
            <input type="date" className={modalInp} value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
          </div>
          <div>
            <label className="block text-tiny text-mil-muted mb-1.5 font-semibold">שעה</label>
            <input type="time" className={modalInp} value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="block text-tiny text-mil-muted mb-1.5 font-semibold">סיבה</label>
          <textarea
            className={`${modalInp} resize-none`}
            rows={3}
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            placeholder="אירוע משפחתי / פגישה רפואית..."
          />
        </div>

        <Button variant="primary" size="lg" fullWidth onClick={() => canSubmit && onSubmit(form)} disabled={!canSubmit}>
          שלח בקשה
        </Button>
      </div>
    </Sheet>
  );
}

const modalInp = 'w-full bg-mil-bg-alt border border-mil-border rounded-xl-soft px-3.5 py-3 text-mil-text focus:outline-none focus:ring-2 focus:ring-mil-olive/40 focus:border-mil-olive placeholder:text-mil-ghost text-base transition-colors duration-200 ease-out-soft';

// ─── SoldierCycleHint ────────────────────────────────────────────────────

function SoldierCycleHint({ soldier }: { soldier: Soldier }) {
  const { platoonLeaveCycles, squads } = useApp();
  const todayIso = new Date().toISOString().slice(0, 10);
  const activeCycle = platoonLeaveCycles.find(
    (c) => c.companyId === soldier.companyId && c.status === 'published',
  );
  const seg = activeSegmentForSoldier(activeCycle ?? null, soldier, todayIso, squads);
  if (!seg) return null;

  const label = seg.kind === 'home' ? 'אתה בבית בסבב' : 'נדרשת נוכחות מלאה';
  const range = `${seg.startDate.slice(5)} – ${seg.endDate.slice(5)}`;
  const tone = seg.kind === 'home'
    ? { bg: 'bg-mil-sand-bg',  border: 'border-mil-sand/30',  fg: 'text-mil-sand'  }
    : { bg: 'bg-mil-info-bg',  border: 'border-mil-info-border', fg: 'text-mil-info' };

  return (
    <div className={`${tone.bg} border ${tone.border} rounded-xl-soft p-4`}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={`text-sm font-semibold ${tone.fg}`}>{label}</span>
        <span className="text-tiny text-mil-muted mr-auto tabular-nums font-medium">{range}</span>
      </div>
      {seg.note && <Muted className="mt-1 text-tiny">{seg.note}</Muted>}
    </div>
  );
}

// ─── CollapsibleCard ─────────────────────────────────────────────────────

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
        aria-expanded={open}
      >
        <CardTitle>{title}</CardTitle>
        {count != null && <Hint>({count})</Hint>}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          className={`mr-auto text-mil-ghost transition-transform duration-200 ease-out-soft ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div className="border-t border-mil-border">{children}</div>}
    </Card>
  );
}

// ─── OperationalStateCard ────────────────────────────────────────────────

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
  leaves: Leave[];
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
    'in-base':       { label: 'אתה בבסיס',     accentClass: 'text-mil-success',  dotBg: 'bg-mil-success',  verb: 'יצאתי הביתה'    },
    'home':          { label: 'אתה בבית',       accentClass: 'text-mil-sand',     dotBg: 'bg-mil-sand',     verb: 'חזרתי לבסיס'    },
    'inactive-temp': { label: 'לא פעיל כרגע',   accentClass: 'text-mil-rest',     dotBg: 'bg-mil-rest',     verb: 'חזרתי לפעילות'  },
  }[status];

  const [activeReminder, setActiveReminder] = useState<5 | 15 | 30 | 60 | null>(null);
  const handleReminder = (m: 5 | 15 | 30 | 60) => { onSetReminder(m); setActiveReminder(m); };

  return (
    <section className="bg-mil-card border border-mil-border rounded-2xl-soft shadow-hero overflow-hidden">
      <div className="px-6 py-6 space-y-5">

        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${presentation.dotBg}`} aria-hidden />
            <Hint className="font-semibold tracking-wide uppercase">המצב שלך</Hint>
          </div>
          <p className={`text-hero font-extrabold leading-tight mt-2 tracking-tightish ${presentation.accentClass}`}>
            {presentation.label}
          </p>
          <Body className="mt-1.5 text-mil-muted">
            {durationLabel}
            {nextLeaveDays != null && (
              <>
                <span className="text-mil-ghost mx-2">·</span>
                <span>{formatDaysCountdown(nextLeaveDays, 'home')}</span>
              </>
            )}
            {daysToReturn != null && (
              <>
                <span className="text-mil-ghost mx-2">·</span>
                <span>{formatDaysCountdown(daysToReturn, 'base')}</span>
              </>
            )}
          </Body>
        </div>

        {nextShift && status === 'in-base' && (
          <div className="pt-5 border-t border-mil-border">
            <div className="flex items-baseline gap-3">
              <Hint className="font-semibold tracking-wide uppercase">המשמרת הבאה</Hint>
              <button
                onClick={() => onOpenMission(nextShift.missionId)}
                className="mr-auto text-tiny font-semibold text-mil-olive hover:text-mil-olive-dim"
              >
                פרטים ←
              </button>
            </div>
            <p className="text-lg font-bold text-mil-text mt-2 leading-snug">{nextShift.name}</p>
            <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
              <span className="text-base font-bold tabular-nums text-mil-text">{nextShift.startTime}–{nextShift.endTime}</span>
              <Hint className="text-mil-muted">·</Hint>
              <Hint className="text-mil-muted">{formatRelative(nextShift.minsTo)}</Hint>
            </div>
            {nextShift.teammates.length > 0 && (
              <Muted className="mt-1.5">
                יחד עם: {nextShift.teammates.map((t) => t.name).join(' · ')}
              </Muted>
            )}

            <div className="mt-4">
              <Hint className="text-mil-muted block mb-2">הער אותי לפני</Hint>
              <div className="grid grid-cols-4 gap-2">
                {([5, 15, 30, 60] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => handleReminder(m)}
                    className={`py-2.5 rounded-lg text-tiny font-semibold transition-all duration-200 ease-out-soft active:scale-95 ${
                      activeReminder === m
                        ? 'bg-mil-olive text-white shadow-card'
                        : 'bg-mil-bg-alt border border-mil-border text-mil-text hover:border-mil-border-strong'
                    }`}
                  >
                    {m === 60 ? 'שעה' : `${m} דק׳`}
                  </button>
                ))}
              </div>
              {activeReminder && (
                <Hint className="text-mil-success mt-2 font-semibold flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-mil-success" aria-hidden />
                  תזכורת {activeReminder} דק׳ לפני
                </Hint>
              )}
            </div>
          </div>
        )}

        <button
          onClick={onOpenStatusUpdate}
          className="w-full bg-mil-bg-alt border border-mil-border hover:bg-mil-card hover:border-mil-olive text-mil-text font-semibold py-3 rounded-xl-soft text-sm transition-all duration-200 ease-out-soft active:scale-[0.985]"
        >
          {presentation.verb}
        </button>
      </div>
    </section>
  );
}

// ─── StatusUpdateModal ──────────────────────────────────────────────────

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
    <Sheet open onClose={onClose} title={headline}>
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
    </Sheet>
  );
}

// ─── Operational temporal helpers ───────────────────────────────────────

function formatDurationInState(since: string, status: SoldierStatus, now: Date): string {
  if (!since) return '';
  const diffMs   = Math.max(0, now.getTime() - new Date(since).getTime());
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs  = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

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

function daysBetweenIso(from: Date, toIso: string): number | null {
  const to = new Date(toIso); if (isNaN(to.getTime())) return null;
  const startOfFrom = new Date(from); startOfFrom.setHours(0, 0, 0, 0);
  const startOfTo   = new Date(to);   startOfTo.setHours(0, 0, 0, 0);
  return Math.round((startOfTo.getTime() - startOfFrom.getTime()) / 86400000);
}

function findDaysToNextLeave(soldier: Soldier, leaves: Leave[], now: Date): number | null {
  const upcoming = leaves
    .filter((lv) => {
      const startTs = Date.parse(`${lv.startDate}T${lv.startTime || '00:00'}`);
      if (isNaN(startTs) || startTs <= now.getTime()) return false;
      if (lv.scope === 'individual') return lv.soldierIds.includes(soldier.id);
      if (lv.scope === 'squad')      return soldier.squadId && soldier.squadId === lv.squadId;
      return true;
    })
    .sort((a, b) =>
      `${a.startDate}T${a.startTime || '00:00'}`.localeCompare(`${b.startDate}T${b.startTime || '00:00'}`),
    );
  if (upcoming.length === 0) return null;
  return daysBetweenIso(now, `${upcoming[0].startDate}T${upcoming[0].startTime || '00:00'}`);
}
