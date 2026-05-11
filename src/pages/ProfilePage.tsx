import { useState } from 'react';
import { useApp, useActivePeriod } from '../context/AppContext';
import Header from '../components/Header';

const REMINDER_OPTIONS = [5, 15, 30, 60] as const;

export default function ProfilePage() {
  const { currentUser, currentRole, soldiers, addLeaveRequest, leaveRequests } = useApp();
  const activePeriod = useActivePeriod();
  const [reminderMin, setReminderMin] = useState<5 | 15 | 30 | 60 | null>(null);
  const [reminderSet, setReminderSet] = useState(false);

  // Leave request form state
  const [showReqForm, setShowReqForm]   = useState(false);
  const [reqForm, setReqForm] = useState({ startDate: '', startTime: '14:00', endDate: '', endTime: '08:00', reason: '' });
  const [reqSaved, setReqSaved] = useState(false);

  const myProfile = soldiers.find((s) => s.id === currentUser?.soldierProfileId);

  const myNextSlot = activePeriod?.missionTypes.flatMap((mt) =>
    mt.timeSlots.filter((ts) => myProfile && ts.assignedSoldierIds.includes(myProfile.id))
      .map((ts) => ({ ts, mt }))
  )[0] ?? null;

  const myRequests = leaveRequests.filter((r) => r.soldierId === myProfile?.id);

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!myProfile || !currentUser) return;
    addLeaveRequest({
      soldierId:       myProfile.id,
      soldierName:     myProfile.name,
      soldierTeamClass: myProfile.teamClass,
      startDate:       reqForm.startDate,
      startTime:       reqForm.startTime,
      endDate:         reqForm.endDate,
      endTime:         reqForm.endTime,
      reason:          reqForm.reason,
    });
    setReqSaved(true);
    setShowReqForm(false);
    setReqForm({ startDate: '', startTime: '14:00', endDate: '', endTime: '08:00', reason: '' });
    setTimeout(() => setReqSaved(false), 3000);
  };

  const isSoldier = currentRole === 'soldier';

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="פרופיל" />

      <main className="px-4 py-4 pb-28 max-w-xl mx-auto space-y-3">

        {reqSaved && (
          <div className="bg-mil-success-bg border border-mil-success/40 text-mil-success rounded-xl px-4 py-3 text-sm">✓ בקשת היציאה הוגשה</div>
        )}

        {/* User card */}
        <div className="bg-mil-card border border-mil-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-mil-olive-bg border border-mil-olive/40 flex items-center justify-center text-mil-olive text-xl font-bold">
              {currentUser?.name.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-mil-text">{currentUser?.name}</p>
              <p className="text-xs text-mil-muted dir-ltr">{currentUser?.phone}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-mil-bg border border-mil-border rounded-lg px-3 py-2">
              <p className="text-mil-ghost mb-0.5">תפקיד מבצעי</p>
              <p className="text-mil-text font-medium">{currentUser?.operationalRoles.join(', ') || '—'}</p>
            </div>
            <div className="bg-mil-bg border border-mil-border rounded-lg px-3 py-2">
              <p className="text-mil-ghost mb-0.5">כיתה</p>
              <p className="text-mil-text font-medium">{currentUser?.teamClass || '—'}</p>
            </div>
          </div>
        </div>

        {/* Next guard + reminder */}
        <div className="bg-mil-card border border-mil-border rounded-xl overflow-hidden">
          <div className="bg-mil-surface border-b border-mil-border px-4 py-2.5">
            <span className="text-xs font-bold tracking-widest text-mil-text-inv/70">המשמרת הבאה שלי</span>
          </div>
          <div className="px-4 py-3">
            {myNextSlot ? (
              <>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-mil-text">{myNextSlot.mt.name}</p>
                    <p className="text-mil-muted text-sm">{myNextSlot.ts.date} · {myNextSlot.ts.startTime}–{myNextSlot.ts.endTime}</p>
                  </div>
                </div>

                {/* Reminder */}
                <div className="border-t border-mil-border pt-3">
                  <p className="text-xs text-mil-muted mb-2">תזכורת לפני המשמרת:</p>
                  <div className="flex gap-2 flex-wrap">
                    {REMINDER_OPTIONS.map((min) => (
                      <button
                        key={min}
                        onClick={() => { setReminderMin(min); setReminderSet(false); }}
                        className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                          reminderMin === min
                            ? 'bg-mil-olive border-mil-olive text-white'
                            : 'bg-mil-bg border-mil-border text-mil-muted hover:text-mil-text hover:border-mil-olive/50'
                        }`}
                      >
                        {min < 60 ? `${min} דק'` : 'שעה'}
                      </button>
                    ))}
                  </div>
                  {reminderMin && (
                    <button
                      onClick={() => setReminderSet(true)}
                      className="mt-2 w-full bg-mil-olive-bg border border-mil-olive/40 hover:border-mil-olive text-mil-olive text-sm py-2 rounded-lg transition-colors"
                    >
                      {reminderSet ? `✓ תזכורת הוגדרה (${reminderMin < 60 ? `${reminderMin} דק'` : 'שעה'} לפני)` : 'הגדר תזכורת'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="text-mil-muted text-sm">אין משמרות מתוכננות</p>
            )}
          </div>
        </div>

        {/* Leave requests (soldiers only) */}
        {isSoldier && (
          <div className="bg-mil-card border border-mil-border rounded-xl overflow-hidden">
            <div className="bg-mil-surface border-b border-mil-border px-4 py-2.5 flex items-center gap-2">
              <span className="text-xs font-bold tracking-widest text-mil-text-inv/70">בקשות יציאה</span>
              <button
                onClick={() => setShowReqForm((v) => !v)}
                className="mr-auto text-xs text-mil-sand hover:text-mil-text-inv transition-colors"
              >
                {showReqForm ? 'ביטול' : '+ בקשה חדשה'}
              </button>
            </div>

            {showReqForm && (
              <form onSubmit={handleSubmitRequest} className="px-4 py-4 space-y-3 border-b border-mil-border">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-mil-muted mb-1.5">מתאריך</label>
                    <input type="date" className={inp} value={reqForm.startDate} onChange={(e) => setReqForm((f) => ({ ...f, startDate: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="block text-xs text-mil-muted mb-1.5">משעה</label>
                    <input type="time" className={inp} value={reqForm.startTime} onChange={(e) => setReqForm((f) => ({ ...f, startTime: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-mil-muted mb-1.5">עד תאריך</label>
                    <input type="date" className={inp} value={reqForm.endDate} onChange={(e) => setReqForm((f) => ({ ...f, endDate: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="block text-xs text-mil-muted mb-1.5">עד שעה</label>
                    <input type="time" className={inp} value={reqForm.endTime} onChange={(e) => setReqForm((f) => ({ ...f, endTime: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-mil-muted mb-1.5">סיבה</label>
                  <textarea
                    className={`${inp} resize-none`}
                    rows={2}
                    value={reqForm.reason}
                    onChange={(e) => setReqForm((f) => ({ ...f, reason: e.target.value }))}
                    placeholder="אירוע משפחתי, פגישה..."
                    required
                  />
                </div>
                <button type="submit" className="w-full bg-mil-olive hover:bg-mil-olive-light text-white font-bold py-3 rounded-xl text-sm transition-colors">
                  הגש בקשה
                </button>
              </form>
            )}

            <div className="divide-y divide-mil-border">
              {myRequests.length === 0 && !showReqForm && (
                <p className="text-center text-mil-ghost py-4 text-sm">אין בקשות יציאה</p>
              )}
              {myRequests.map((req) => (
                <div key={req.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-mil-text">{req.startDate} {req.startTime} – {req.endDate} {req.endTime}</p>
                      <p className="text-xs text-mil-muted mt-0.5">{req.reason}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded border flex-shrink-0 ${
                      req.status === 'pending'  ? 'bg-mil-warn-bg text-mil-warn border-mil-warn-border' :
                      req.status === 'approved' ? 'bg-mil-success-bg text-mil-success border-mil-success-border' :
                      'bg-mil-alert-bg text-mil-alert border-mil-alert-border'
                    }`}>
                      {{ pending: 'ממתין', approved: 'אושר', rejected: 'נדחה' }[req.status]}
                    </span>
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

const inp = 'w-full bg-mil-bg border border-mil-border rounded-lg px-3 py-2.5 text-sm text-mil-text focus:outline-none focus:ring-1 focus:ring-mil-olive focus:border-mil-olive placeholder:text-mil-ghost';
