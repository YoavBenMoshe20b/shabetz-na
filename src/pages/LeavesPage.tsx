import { useState } from 'react';
import { useApp, useMyPlatoons } from '../context/AppContext';
import Header from '../components/Header';
import { isPlatoonLeadership } from '../utils/permissions';
import type { LeaveScope } from '../types';

const scopeLabel: Record<LeaveScope, string> = {
  individual: 'יחיד',
  subUnit:    'תת-קבוצה',
  machlaka:   'מחלקה',
};

const reqStatusLabel = { pending: 'ממתין', approved: 'אושר', rejected: 'נדחה' };
const reqStatusStyle = {
  pending:  'bg-mil-warn-bg text-mil-warn border-mil-warn-border',
  approved: 'bg-mil-success-bg text-mil-success border-mil-success-border',
  rejected: 'bg-mil-alert-bg text-mil-alert border-mil-alert-border',
};

export default function LeavesPage() {
  const {
    leaves, soldiers, subUnits, addLeave, removeLeave, addAuditLog,
    currentUser, currentRole,
    leaveRequests, approveLeaveRequest, rejectLeaveRequest,
  } = useApp();
  const myPlatoons = useMyPlatoons();

  // Sub-units the current manager can issue leaves against:
  // company commander → all sub-units in the company; platoon leader →
  // sub-units of their platoon only.
  const visibleSubUnits = subUnits.filter((s) =>
    myPlatoons.some((p) => p.id === s.platoonId)
  );
  const subUnitNameOf = (id?: string) => subUnits.find((s) => s.id === id)?.name ?? '—';

  const isManager = isPlatoonLeadership(currentRole);
  const [tab, setTab] = useState<'leaves' | 'requests'>('leaves');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    scope:      'individual' as LeaveScope,
    soldierIds: [] as string[],
    subUnitId:  visibleSubUnits[0]?.id ?? '',
    startDate:  '',
    startTime:  '14:00',
    endDate:    '',
    endTime:    '08:00',
    note:       '',
  });
  const [saved, setSaved] = useState(false);

  const pendingCount = leaveRequests.filter((r) => r.status === 'pending').length;

  const toggleSoldier = (id: string) =>
    setForm((f) => ({
      ...f,
      soldierIds: f.soldierIds.includes(id) ? f.soldierIds.filter((x) => x !== id) : [...f.soldierIds, id],
    }));

  const getSoldierName = (id: string) => soldiers.find((s) => s.id === id)?.name ?? id;

  const leaveDescription = () => {
    if (form.scope === 'individual') return form.soldierIds.map(getSoldierName).join(', ');
    if (form.scope === 'subUnit')    return `תת-קבוצה: ${subUnitNameOf(form.subUnitId)}`;
    return 'כל המחלקה';
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const subUnit = subUnits.find((s) => s.id === form.subUnitId);
    addLeave({
      scope:         form.scope,
      soldierIds:    form.soldierIds,
      subUnitId:     form.scope === 'subUnit' ? form.subUnitId : undefined,
      teamClass:     form.scope === 'subUnit' ? subUnit?.name : undefined,
      startDate:     form.startDate,
      startTime:     form.startTime,
      endDate:       form.endDate,
      endTime:       form.endTime,
      note:          form.note || undefined,
      createdBy:     currentUser!.id,
      createdByName: currentUser!.name,
    });
    addAuditLog({ actorName: currentUser!.name, actorRole: currentRole, action: 'הגדיר יציאה', target: leaveDescription() });
    setSaved(true);
    setShowForm(false);
    setForm({ scope: 'individual', soldierIds: [], subUnitId: visibleSubUnits[0]?.id ?? '', startDate: '', startTime: '14:00', endDate: '', endTime: '08:00', note: '' });
    setTimeout(() => setSaved(false), 3000);
  };

  const handleApprove = (id: string) => {
    approveLeaveRequest(id, currentUser!.id, currentUser!.name);
    addAuditLog({ actorName: currentUser!.name, actorRole: currentRole, action: 'אישר בקשת יציאה', target: id });
  };

  const handleReject = (id: string) => {
    rejectLeaveRequest(id, currentUser!.id, currentUser!.name);
    addAuditLog({ actorName: currentUser!.name, actorRole: currentRole, action: 'דחה בקשת יציאה', target: id });
  };

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="יציאות" />

      <main className="px-4 py-4 pb-28 max-w-xl mx-auto space-y-3">
        {saved && (
          <div className="bg-mil-success-bg border border-mil-success/40 text-mil-success rounded-xl px-4 py-3 text-sm">✓ היציאה נשמרה</div>
        )}

        {/* Tabs (manager only — soldiers see leaves list inline on profile) */}
        {isManager && (
          <div className="flex bg-mil-card border border-mil-border rounded-xl overflow-hidden">
            <TabBtn label="יציאות מאושרות" active={tab === 'leaves'}   onClick={() => setTab('leaves')} />
            <TabBtn
              label={`בקשות יציאה${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
              active={tab === 'requests'}
              onClick={() => setTab('requests')}
              badge={pendingCount}
            />
          </div>
        )}

        {/* ── LEAVES TAB ─────────────────────────────────────────── */}
        {(!isManager || tab === 'leaves') && (
          <>
            {isManager && (
              <button
                onClick={() => setShowForm((v) => !v)}
                className="w-full bg-mil-olive hover:bg-mil-olive-light text-white font-bold py-3.5 rounded-xl text-sm transition-colors"
              >
                {showForm ? '✕ ביטול' : '+ הוסף יציאה'}
              </button>
            )}

            {/* Form */}
            {showForm && isManager && (
              <form onSubmit={handleSave} className="bg-mil-card border border-mil-border rounded-xl overflow-hidden">
                <div className="bg-mil-surface px-4 py-2.5 border-b border-mil-border">
                  <p className="text-xs font-bold tracking-widest text-mil-text-inv/70">יציאה חדשה</p>
                </div>
                <div className="px-4 py-4 space-y-4">

                  {/* Scope */}
                  <div>
                    <label className="block text-xs text-mil-muted mb-2">סוג יציאה</label>
                    <div className="flex gap-2">
                      {(['individual', 'subUnit', 'machlaka'] as LeaveScope[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, scope: s }))}
                          className={`flex-1 py-2 rounded-lg text-xs border transition-colors ${
                            form.scope === s ? 'bg-mil-olive border-mil-olive text-white' : 'bg-mil-bg border-mil-border text-mil-muted'
                          }`}
                        >
                          {scopeLabel[s]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Who */}
                  {form.scope === 'individual' && (
                    <div>
                      <label className="block text-xs text-mil-muted mb-2">בחר חיילים</label>
                      <div className="max-h-40 overflow-y-auto border border-mil-border rounded-lg divide-y divide-mil-border">
                        {soldiers.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleSoldier(s.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-right transition-colors ${
                              form.soldierIds.includes(s.id) ? 'bg-mil-olive-bg' : 'hover:bg-mil-card-hover'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-xs flex-shrink-0 ${form.soldierIds.includes(s.id) ? 'bg-mil-olive border-mil-olive text-white' : 'border-mil-border'}`}>
                              {form.soldierIds.includes(s.id) && '✓'}
                            </span>
                            <span className="text-sm text-mil-text">{s.name}</span>
                            <span className="text-xs text-mil-muted mr-auto">{s.teamClass}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {form.scope === 'subUnit' && (
                    <div>
                      <label className="block text-xs text-mil-muted mb-1.5">תת-קבוצה</label>
                      <select className={inp} value={form.subUnitId} onChange={(e) => setForm((f) => ({ ...f, subUnitId: e.target.value }))}>
                        {visibleSubUnits.length === 0 && <option value="">— אין תת-קבוצות במחלקתך —</option>}
                        {visibleSubUnits.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}

                  {form.scope === 'machlaka' && (
                    <div className="bg-mil-warn-bg border border-mil-warn-border text-mil-warn rounded-lg px-3 py-2 text-xs">
                      ⚠ יציאת כל המחלקה — כל החיילים יסומנו כלא זמינים
                    </div>
                  )}

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-mil-muted mb-1.5">מתאריך</label>
                      <input type="date" className={inp} value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="block text-xs text-mil-muted mb-1.5">משעה</label>
                      <input type="time" className={inp} value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-mil-muted mb-1.5">עד תאריך</label>
                      <input type="date" className={inp} value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="block text-xs text-mil-muted mb-1.5">עד שעה</label>
                      <input type="time" className={inp} value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
                    </div>
                  </div>

                  {/* Note */}
                  <div>
                    <label className="block text-xs text-mil-muted mb-1.5">הערה</label>
                    <input className={inp} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="יציאת סוף שבוע / טיול גדוד..." />
                  </div>

                  <button type="submit" className="w-full bg-mil-olive hover:bg-mil-olive-light text-white font-bold py-3.5 rounded-xl text-base transition-colors">
                    שמור יציאה
                  </button>
                </div>
              </form>
            )}

            {/* Leaves list */}
            <div className="space-y-2">
              <p className="text-xs text-mil-muted px-1">{leaves.length} יציאות מוגדרות</p>
              {leaves.map((lv) => {
                const who = lv.scope === 'individual'
                  ? lv.soldierIds.map(getSoldierName).join(', ')
                  : lv.scope === 'subUnit'
                  ? `תת-קבוצה: ${subUnitNameOf(lv.subUnitId)}`
                  : 'כל המחלקה';

                return (
                  <div key={lv.id} className="bg-mil-card border border-mil-border rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs bg-mil-olive-bg text-mil-olive border border-mil-olive/30 px-1.5 py-0.5 rounded">
                            {scopeLabel[lv.scope]}
                          </span>
                          <span className="text-mil-text text-sm font-medium truncate">{who}</span>
                        </div>
                        <p className="text-xs text-mil-muted">
                          {lv.startDate} {lv.startTime} — {lv.endDate} {lv.endTime}
                        </p>
                        {lv.note && <p className="text-xs text-mil-muted mt-0.5 italic">{lv.note}</p>}
                        <p className="text-xs text-mil-ghost mt-1">נוצר ע״י {lv.createdByName}</p>
                      </div>
                      {isManager && (
                        <button
                          onClick={() => removeLeave(lv.id)}
                          className="text-mil-alert hover:text-white hover:bg-mil-alert text-xs px-2 py-1 rounded border border-mil-alert/40 transition-colors flex-shrink-0"
                        >
                          מחק
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {leaves.length === 0 && (
                <div className="text-center py-10 text-mil-ghost">
                  <p className="text-4xl mb-3">◎</p>
                  <p>אין יציאות מוגדרות</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── REQUESTS TAB (manager only) ────────────────────────── */}
        {isManager && tab === 'requests' && (
          <div className="space-y-2">
            <p className="text-xs text-mil-muted px-1">{leaveRequests.length} בקשות · {pendingCount} ממתינות</p>
            {leaveRequests.length === 0 && (
              <div className="text-center py-10 text-mil-ghost">
                <p className="text-4xl mb-3">⊖</p>
                <p>אין בקשות יציאה</p>
              </div>
            )}
            {[...leaveRequests].sort((a, b) => {
              if (a.status === 'pending' && b.status !== 'pending') return -1;
              if (b.status === 'pending' && a.status !== 'pending') return 1;
              return b.submittedAt.localeCompare(a.submittedAt);
            }).map((req) => (
              <div key={req.id} className="bg-mil-card border border-mil-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-medium text-mil-text text-sm">{req.soldierName}</p>
                    <p className="text-xs text-mil-ghost">{req.soldierTeamClass}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded border ${reqStatusStyle[req.status]}`}>
                    {reqStatusLabel[req.status]}
                  </span>
                </div>
                <p className="text-xs text-mil-muted mb-1">
                  {req.startDate} {req.startTime} — {req.endDate} {req.endTime}
                </p>
                <p className="text-sm text-mil-text">{req.reason}</p>
                <p className="text-xs text-mil-ghost mt-1">הוגש: {req.submittedAt.slice(0, 10)}</p>

                {req.status === 'pending' && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleApprove(req.id)}
                      className="flex-1 py-2 rounded-lg text-sm font-medium bg-mil-success-bg text-mil-success border border-mil-success-border hover:bg-mil-success hover:text-white transition-colors"
                    >
                      ✓ אשר
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      className="flex-1 py-2 rounded-lg text-sm font-medium bg-mil-alert-bg text-mil-alert border border-mil-alert-border hover:bg-mil-alert hover:text-white transition-colors"
                    >
                      ✕ דחה
                    </button>
                  </div>
                )}

                {req.status !== 'pending' && req.reviewedByName && (
                  <p className="text-xs text-mil-ghost mt-2">
                    {req.status === 'approved' ? 'אושר' : 'נדחה'} ע״י {req.reviewedByName}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function TabBtn({ label, active, onClick, badge }: { label: string; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 text-sm font-medium transition-colors relative ${
        active ? 'bg-mil-olive text-white' : 'text-mil-muted hover:text-mil-text'
      }`}
    >
      {label}
      {badge != null && badge > 0 && !active && (
        <span className="absolute top-1.5 right-4 min-w-[14px] h-3.5 bg-mil-warn text-white text-[9px] rounded-full flex items-center justify-center px-0.5">
          {badge}
        </span>
      )}
    </button>
  );
}

const inp = 'w-full bg-mil-bg border border-mil-border rounded-lg px-3 py-2.5 text-sm text-mil-text focus:outline-none focus:ring-1 focus:ring-mil-olive focus:border-mil-olive placeholder:text-mil-ghost';
