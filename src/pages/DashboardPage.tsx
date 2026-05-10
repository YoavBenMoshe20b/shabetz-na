import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useActivePeriod } from '../context/AppContext';
import Header from '../components/Header';
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
  const isManager = currentRole === 'owner' || currentRole === 'manager';
  return isManager ? <ManagerDashboard /> : <SoldierDashboard />;
}

// ─── Manager Dashboard ────────────────────────────────────────────────────────

function ManagerDashboard() {
  const { soldiers, leaves, leaveRequests, miluimPeriods, groups, currentUser, approveLeaveRequest, rejectLeaveRequest } = useApp();
  const navigate = useNavigate();
  const activePeriod = useActivePeriod();

  const myGroup = groups.find((g) => g.memberIds.includes(currentUser?.id ?? ''));
  const miluim = miluimPeriods.find((m) => m.groupId === myGroup?.id);

  const today = new Date().toISOString().slice(0, 10);
  const onLeaveIds = new Set<string>();
  leaves.forEach((lv) => {
    if (today < lv.startDate || today > lv.endDate) return;
    if (lv.scope === 'individual') lv.soldierIds.forEach((id) => onLeaveIds.add(id));
    else if (lv.scope === 'class') soldiers.filter((s) => s.teamClass === lv.teamClass).forEach((s) => onLeaveIds.add(s.id));
    else soldiers.forEach((s) => onLeaveIds.add(s.id));
  });
  const onBase = soldiers.filter((s) => s.availability && !onLeaveIds.has(s.id)).length;
  const atHome = onLeaveIds.size;
  const unavailable = soldiers.filter((s) => !s.availability && !onLeaveIds.has(s.id)).length;
  const pendingRequests = leaveRequests.filter((r) => r.status === 'pending');

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="פיקוד מחלקה" />
      <main className="px-4 py-4 pb-28 max-w-xl mx-auto space-y-4">

        {/* Platoon header */}
        <div className="bg-mil-olive-bg border border-mil-olive/30 rounded-2xl px-4 py-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-mil-text">{myGroup?.name ?? 'מחלקה'}</h2>
            <span className="text-xs text-mil-muted">{myGroup?.unitName}</span>
          </div>
          {miluim && (
            <p className="text-xs text-mil-muted mt-0.5">{miluim.description} · {miluim.startDate} → {miluim.endDate}</p>
          )}
        </div>

        {/* Big action cards */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold tracking-widest text-mil-muted uppercase mt-2 px-1">פעולות ראשיות</h3>

          <button
            onClick={() => navigate('/schedule')}
            className="w-full bg-mil-card border-2 border-mil-olive/30 hover:border-mil-olive rounded-2xl p-5 text-right transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="text-4xl text-mil-olive flex-shrink-0">▦</div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-mil-text mb-0.5">הכנס משימות לתקופה</h3>
                <p className="text-sm text-mil-muted leading-snug">בחר תקופת זמן, הגדר משימות, ובנה שיבוץ</p>
                {activePeriod && (
                  <p className="text-xs text-mil-olive mt-2 font-medium">
                    תקופה פעילה: {activePeriod.name} · {activePeriod.missionTypes.length} משימות
                  </p>
                )}
                <div className="mt-3 inline-flex items-center gap-2 text-mil-olive text-sm font-bold group-hover:gap-3 transition-all">
                  <span>פתח שיבוץ</span><span>←</span>
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/leaves')}
            className="w-full bg-mil-card border-2 border-mil-sand/40 hover:border-mil-sand rounded-2xl p-5 text-right transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="text-4xl text-mil-warn flex-shrink-0">⊖</div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-mil-text mb-0.5">הכנס יציאות</h3>
                <p className="text-sm text-mil-muted leading-snug">מחלקתיות / כיתתיות / אישיות</p>
                {pendingRequests.length > 0 && (
                  <p className="text-xs text-mil-warn mt-2 font-medium">
                    {pendingRequests.length} בקשות ממתינות לאישור
                  </p>
                )}
                <div className="mt-3 inline-flex items-center gap-2 text-mil-warn text-sm font-bold group-hover:gap-3 transition-all">
                  <span>נהל יציאות</span><span>←</span>
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Quick stats */}
        <div>
          <h3 className="text-xs font-bold tracking-widest text-mil-muted uppercase mt-2 px-1 mb-2">מצב כוח אדם</h3>
          <div className="grid grid-cols-3 gap-2">
            <Stat value={onBase}        label="בבסיס"   tone="olive" />
            <Stat value={atHome}        label="בבית"     tone="sand"  />
            <Stat value={unavailable}   label="לא זמין" tone="muted" />
          </div>
          <button
            onClick={() => navigate('/report')}
            className="w-full mt-2 text-center text-sm text-mil-olive hover:text-mil-olive-dim py-2 border border-mil-border rounded-xl bg-mil-card hover:bg-mil-olive-bg transition-colors"
          >
            צפה בדוח כוח אדם מלא →
          </button>
        </div>

        {/* Pending approvals — inline */}
        {pendingRequests.length > 0 && (
          <div className="bg-mil-card border border-mil-warn/40 rounded-2xl overflow-hidden">
            <div className="bg-mil-warn-bg border-b border-mil-warn/30 px-4 py-2.5 flex items-center gap-2">
              <span className="text-mil-warn text-lg">!</span>
              <span className="text-sm font-bold text-mil-warn">בקשות יציאה ממתינות ({pendingRequests.length})</span>
            </div>
            <div className="divide-y divide-mil-border">
              {pendingRequests.slice(0, 3).map((req) => (
                <div key={req.id} className="px-4 py-3">
                  <div className="mb-2">
                    <p className="text-sm font-medium text-mil-text">{req.soldierName}</p>
                    <p className="text-xs text-mil-muted">{req.soldierTeamClass} · {req.startDate} {req.startTime}–{req.endDate} {req.endTime}</p>
                    <p className="text-xs text-mil-text mt-0.5 italic">{req.reason}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => currentUser && approveLeaveRequest(req.id, currentUser.id, currentUser.name)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-mil-success-bg text-mil-success border border-mil-success-border hover:bg-mil-success hover:text-white transition-colors"
                    >
                      ✓ אשר
                    </button>
                    <button
                      onClick={() => currentUser && rejectLeaveRequest(req.id, currentUser.id, currentUser.name)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-mil-alert-bg text-mil-alert border border-mil-alert-border hover:bg-mil-alert hover:text-white transition-colors"
                    >
                      ✕ דחה
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

// ─── Soldier Dashboard ────────────────────────────────────────────────────────

function SoldierDashboard() {
  const { soldiers, leaves, currentUser, groups, setReminder } = useApp();
  const activePeriod = useActivePeriod();
  const myGroup = groups.find((g) => g.memberIds.includes(currentUser?.id ?? ''));

  const myProfile = soldiers.find((s) => s.id === currentUser?.soldierProfileId || s.userId === currentUser?.id);

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
      else if (lv.scope === 'class') soldiers.filter((s) => s.teamClass === lv.teamClass).forEach((s) => ids.add(s.id));
      else soldiers.forEach((s) => ids.add(s.id));
    });
    return ids;
  }, [leaves, soldiers, scheduleDate]);

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="המחלקה שלי" />
      <main className="px-4 py-4 pb-28 max-w-xl mx-auto space-y-4">

        {/* Greeting */}
        <div className="bg-mil-olive-bg border border-mil-olive/30 rounded-2xl px-4 py-3">
          <h2 className="text-lg font-bold text-mil-text">שלום, {currentUser?.name?.split(' ')[0]}!</h2>
          <p className="text-xs text-mil-muted mt-0.5">
            {myGroup?.name}
            {myProfile && ` · ${myProfile.teamClass}`}
            {myProfile && myProfile.operationalRoles.length > 0 && ` · ${myProfile.operationalRoles.join(', ')}`}
          </p>
        </div>

        {/* Current ops status */}
        <div>
          <h3 className="text-xs font-bold tracking-widest text-mil-muted uppercase mt-2 px-1 mb-2">מצב כרגע</h3>
          {activeMissions.length === 0 ? (
            <div className="bg-mil-card border border-mil-border rounded-xl px-4 py-6 text-center text-sm text-mil-muted">
              אין משימות פעילות כרגע
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {activeMissions.map(({ mt, ts }) => {
                const names = ts.assignedSoldierIds.map((id) => soldiers.find((s) => s.id === id)?.name?.split(' ')[0] ?? '').filter(Boolean);
                return (
                  <div key={ts.id} className="bg-mil-card border border-mil-border rounded-xl p-3">
                    <p className="text-sm font-bold text-mil-text">{mt.name}</p>
                    <p className="text-xs text-mil-ghost mt-0.5">{ts.startTime}–{ts.endTime}</p>
                    <p className="text-xs text-mil-olive mt-1.5 leading-tight">
                      {names.length > 0 ? names.join(', ') : <span className="text-mil-muted">—</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* My next shift + Wake me up */}
        {myNextShift && (
          <NextShiftCard
            mission={myNextShift.mt}
            slot={myNextShift.ts}
            minsTo={myNextShift.minsTo}
            teammates={teammates}
            onSetReminder={(mins) => setReminder({ timeSlotId: myNextShift.ts.id, minutesBefore: mins, enabled: true })}
          />
        )}

        {/* All soldiers */}
        <div className="bg-mil-card border border-mil-border rounded-2xl overflow-hidden">
          <div className="bg-mil-surface px-4 py-2.5 border-b border-mil-border flex items-center justify-between">
            <span className="text-xs font-bold tracking-widest text-mil-text-inv/80">חיילי המחלקה</span>
            <span className="text-xs text-mil-text-inv/60">{soldiers.length}</span>
          </div>
          <div className="divide-y divide-mil-border max-h-72 overflow-y-auto">
            {soldiers.map((s) => {
              const onLeave = onLeaveSoldierIds.has(s.id);
              const status = onLeave ? 'home' : (s.availability ? 'base' : 'unavail');
              const tone = status === 'base' ? 'bg-mil-success' : status === 'home' ? 'bg-mil-sand' : 'bg-mil-ghost';
              const label = status === 'base' ? 'בבסיס' : status === 'home' ? 'בבית' : 'לא זמין';
              return (
                <div key={s.id} className="px-4 py-2.5 flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${tone} flex-shrink-0`} />
                  <span className="text-sm text-mil-text flex-1">{s.name}</span>
                  <span className="text-xs text-mil-muted">{s.teamClass}</span>
                  {s.operationalRoles[0] && <span className="text-xs text-mil-olive bg-mil-olive-bg border border-mil-olive/30 px-1.5 py-0.5 rounded">{s.operationalRoles[0]}</span>}
                  <span className="text-xs text-mil-ghost w-12 text-left">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

      </main>
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

// ─── Bits ─────────────────────────────────────────────────────────────────────

function Stat({ value, label, tone }: { value: number; label: string; tone: 'olive' | 'sand' | 'muted' }) {
  const colorMap = { olive: 'text-mil-olive', sand: 'text-mil-sand', muted: 'text-mil-ghost' };
  return (
    <div className="bg-mil-card border border-mil-border rounded-xl p-3 text-center">
      <p className={`text-3xl font-bold ${colorMap[tone]}`}>{value}</p>
      <p className="text-xs text-mil-muted mt-0.5">{label}</p>
    </div>
  );
}
