import { useState } from 'react';
import { useApp, useActivePeriod } from '../context/AppContext';
import Header from '../components/Header';

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' });
}

function isNight(start: string) {
  const h = parseInt(start.split(':')[0], 10);
  return h >= 22 || h < 6;
}

export default function ReportPage() {
  const { soldiers, leaves, leaveRequests, approveLeaveRequest, rejectLeaveRequest, currentUser } = useApp();
  const activePeriod = useActivePeriod();

  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);

  const periodStart = activePeriod?.startDate ?? today;
  const periodEnd   = activePeriod?.endDate   ?? addDays(today, 6);

  // Build days array for the period
  const days: string[] = [];
  let cur = periodStart;
  while (cur <= periodEnd) {
    days.push(cur);
    cur = addDays(cur, 1);
  }

  // For selected date: compute daily breakdown
  const getLeaveCount = (date: string) => {
    return leaves.filter((lv) => date >= lv.startDate && date <= lv.endDate).length;
  };

  const getSoldiersOnLeave = (date: string) => {
    const ids = new Set<string>();
    leaves.forEach((lv) => {
      if (date < lv.startDate || date > lv.endDate) return;
      if (lv.scope === 'individual') lv.soldierIds.forEach((id) => ids.add(id));
      else if (lv.scope === 'class') soldiers.filter((s) => s.teamClass === lv.teamClass).forEach((s) => ids.add(s.id));
      else soldiers.forEach((s) => ids.add(s.id));
    });
    return soldiers.filter((s) => ids.has(s.id));
  };

  const soldiersOnLeave    = getSoldiersOnLeave(selectedDate);
  const unavailableSoldiers = soldiers.filter((s) => !s.availability && !soldiersOnLeave.find((x) => x.id === s.id));
  const onBaseCount         = soldiers.length - soldiersOnLeave.length - unavailableSoldiers.length;
  const pendingRequests     = leaveRequests.filter((r) => r.status === 'pending');

  // Active slots on selected date
  const activeSlotsToday = activePeriod?.missionTypes.flatMap((mt) =>
    mt.timeSlots.filter((ts) => ts.date === selectedDate).map((ts) => ({ ts, mt }))
  ) ?? [];

  const nightSlots = activeSlotsToday.filter(({ ts }) => isNight(ts.startTime));

  // Breakdown by team class
  const byClass = ['כיתה 1', 'כיתה 2', 'כיתה 3', 'מפקדה', 'אחר'].map((cls) => {
    const clsSoldiers  = soldiers.filter((s) => s.teamClass === cls);
    const clsOnLeave   = soldiersOnLeave.filter((s) => s.teamClass === cls).length;
    const clsUnavail   = unavailableSoldiers.filter((s) => s.teamClass === cls).length;
    const clsOnBase    = clsSoldiers.length - clsOnLeave - clsUnavail;
    return { cls, total: clsSoldiers.length, onBase: clsOnBase, onLeave: clsOnLeave, unavail: clsUnavail };
  }).filter((x) => x.total > 0);

  const handleApprove = (id: string) => {
    if (!currentUser) return;
    approveLeaveRequest(id, currentUser.id, currentUser.name);
  };

  const handleReject = (id: string) => {
    if (!currentUser) return;
    rejectLeaveRequest(id, currentUser.id, currentUser.name);
  };

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="דוח כוח אדם" />

      <main className="px-4 py-4 pb-28 max-w-xl mx-auto space-y-4">

        {/* Date selector */}
        <div className="bg-mil-card border border-mil-border rounded-xl overflow-hidden">
          <div className="bg-mil-surface border-b border-mil-border px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-bold tracking-widest text-mil-text-inv/80">בחר תאריך</span>
            <span className="text-xs text-mil-text-inv/60">{activePeriod?.name ?? 'אין תקופה פעילה'}</span>
          </div>
          <div className="flex gap-1.5 p-3 overflow-x-auto">
            {days.slice(0, 14).map((d) => {
              const leaveCnt = getLeaveCount(d);
              const isToday  = d === today;
              const isSel    = d === selectedDate;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  className={`flex-shrink-0 flex flex-col items-center px-2.5 py-2 rounded-lg border text-xs transition-colors relative ${
                    isSel
                      ? 'bg-mil-olive border-mil-olive text-white'
                      : isToday
                      ? 'bg-mil-olive-bg border-mil-olive/50 text-mil-olive-dim'
                      : 'bg-mil-bg border-mil-border text-mil-muted hover:border-mil-olive/30'
                  }`}
                >
                  <span className="font-medium">{new Date(d).getDate()}</span>
                  <span className="opacity-70">{['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'][new Date(d).getDay()]}</span>
                  {leaveCnt > 0 && (
                    <span className={`absolute -top-1 -right-1 text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center ${isSel ? 'bg-white text-mil-olive' : 'bg-mil-warn text-white'}`}>
                      {leaveCnt}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Daily summary */}
        <div>
          <p className="text-sm font-medium text-mil-text px-1 mb-2">{formatDate(selectedDate)}</p>
          <div className="grid grid-cols-3 gap-2">
            <StatCard value={onBaseCount}                  label="בבסיס"     color="olive" />
            <StatCard value={soldiersOnLeave.length}       label="בבית"       color="sand" />
            <StatCard value={unavailableSoldiers.length}   label="לא זמין"    color="muted" />
          </div>
        </div>

        {/* By class */}
        <div className="bg-mil-card border border-mil-border rounded-xl overflow-hidden">
          <div className="bg-mil-surface border-b border-mil-border px-4 py-2.5">
            <span className="text-xs font-bold tracking-widest text-mil-text-inv/80">פירוט לפי כיתה</span>
          </div>
          <div className="divide-y divide-mil-border">
            {byClass.map(({ cls, total, onBase, onLeave, unavail }) => (
              <div key={cls} className="px-4 py-2.5 flex items-center gap-3">
                <span className="text-sm text-mil-text w-20 flex-shrink-0">{cls}</span>
                <div className="flex-1 flex gap-2 text-xs">
                  <span className="text-mil-olive font-medium">{onBase} בבסיס</span>
                  {onLeave > 0 && <span className="text-mil-sand">{onLeave} בבית</span>}
                  {unavail > 0 && <span className="text-mil-muted">{unavail} לא זמין</span>}
                </div>
                <div className="flex-1 bg-mil-bg rounded-full h-1.5 max-w-[80px]">
                  <div className="bg-mil-olive h-1.5 rounded-full transition-all" style={{ width: `${total > 0 ? (onBase / total) * 100 : 0}%` }} />
                </div>
                <span className="text-xs text-mil-ghost w-8 text-left">{total}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Active missions today */}
        {activeSlotsToday.length > 0 && (
          <div className="bg-mil-card border border-mil-border rounded-xl overflow-hidden">
            <div className="bg-mil-surface border-b border-mil-border px-4 py-2.5 flex items-center gap-2">
              <span className="text-xs font-bold tracking-widest text-mil-text-inv/80">משימות היום</span>
              {nightSlots.length > 0 && (
                <span className="text-xs text-mil-sand bg-mil-surface-hover px-2 py-0.5 rounded">{nightSlots.length} לילה</span>
              )}
            </div>
            <div className="divide-y divide-mil-border">
              {activeSlotsToday.map(({ ts, mt }) => (
                <div key={ts.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-mil-text font-medium">{mt.name}</p>
                    <p className="text-xs text-mil-muted">{ts.startTime}–{ts.endTime}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isNight(ts.startTime) && <span className="text-xs text-mil-sand">לילה</span>}
                    <span className={`text-xs px-2 py-0.5 rounded border ${
                      ts.status === 'filled' ? 'bg-mil-success-bg text-mil-success border-mil-success-border' :
                      ts.status === 'conflict' ? 'bg-mil-alert-bg text-mil-alert border-mil-alert-border' :
                      'bg-mil-bg text-mil-muted border-mil-border'
                    }`}>
                      {ts.assignedSoldierIds.length} חיילים
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending leave requests */}
        {pendingRequests.length > 0 && (
          <div className="bg-mil-card border border-mil-border rounded-xl overflow-hidden">
            <div className="bg-mil-surface border-b border-mil-border px-4 py-2.5 flex items-center gap-2">
              <span className="text-xs font-bold tracking-widest text-mil-text-inv/80">בקשות יציאה ממתינות</span>
              <span className="bg-mil-warn text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{pendingRequests.length}</span>
            </div>
            <div className="divide-y divide-mil-border">
              {pendingRequests.map((req) => (
                <div key={req.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-medium text-mil-text">{req.soldierName}</p>
                      <p className="text-xs text-mil-muted">{req.soldierTeamClass} · {req.startDate} {req.startTime}–{req.endDate} {req.endTime}</p>
                      <p className="text-xs text-mil-text mt-0.5">{req.reason}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(req.id)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-mil-success-bg text-mil-success border border-mil-success-border hover:bg-mil-success hover:text-white transition-colors"
                    >
                      ✓ אשר
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-mil-alert-bg text-mil-alert border border-mil-alert-border hover:bg-mil-alert hover:text-white transition-colors"
                    >
                      ✕ דחה
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* On leave today */}
        {soldiersOnLeave.length > 0 && (
          <div className="bg-mil-card border border-mil-border rounded-xl overflow-hidden">
            <div className="bg-mil-surface border-b border-mil-border px-4 py-2.5">
              <span className="text-xs font-bold tracking-widest text-mil-text-inv/80">יוצאים היום — {formatDate(selectedDate)}</span>
            </div>
            <div className="divide-y divide-mil-border">
              {soldiersOnLeave.map((s) => (
                <div key={s.id} className="px-4 py-2.5 flex items-center justify-between">
                  <span className="text-sm text-mil-text">{s.name}</span>
                  <span className="text-xs text-mil-muted">{s.teamClass}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="bg-mil-olive-bg border border-mil-olive/20 rounded-xl p-4">
          <p className="text-xs font-medium text-mil-olive-dim mb-2">פעולות מהירות</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <ActionChip label="עדכן יציאה" icon="⊖" href="/leaves" />
            <ActionChip label="פתח שיבוץ" icon="▦" href="/schedule" />
          </div>
        </div>

      </main>
    </div>
  );
}

function StatCard({ value, label, color }: { value: number; label: string; color: 'olive' | 'sand' | 'muted' }) {
  const col = color === 'olive' ? 'text-mil-olive' : color === 'sand' ? 'text-mil-sand' : 'text-mil-ghost';
  return (
    <div className="bg-mil-card border border-mil-border rounded-xl p-3 text-center">
      <p className={`text-3xl font-bold ${col}`}>{value}</p>
      <p className="text-xs text-mil-muted mt-0.5">{label}</p>
    </div>
  );
}

function ActionChip({ label, icon, href }: { label: string; icon: string; href: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-2 bg-mil-card border border-mil-olive/20 rounded-lg px-3 py-2 text-mil-olive-dim hover:bg-mil-olive hover:text-white transition-colors"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </a>
  );
}
