import { useState } from 'react';
import { useApp, useActivePeriod } from '../context/AppContext';
import Header from '../components/Header';
import { generateSchedule } from '../utils/scheduleAlgo';

type Action = 'remove' | 'add' | 'unavailable' | 'move';

const ACTION_LABELS: Record<Action, string> = {
  remove:      'הוצא ממשימות',
  add:         'הוסף למשימה',
  unavailable: 'לא זמין עד...',
  move:        'העבר משימה',
};

const ACTION_ICONS: Record<Action, string> = {
  remove:      '⊖',
  add:         '⊕',
  unavailable: '◔',
  move:        '↻',
};

export default function EmergencyPage() {
  const { soldiers, leaves, updatePeriod, addAuditLog, updateSoldierAvailability, currentUser, currentRole, setHasEmergency, soldierHistory, setGenerationResult } = useApp();
  const activePeriod = useActivePeriod();

  const [selectedIds,  setSelectedIds]  = useState<string[]>([]);
  const [action,       setAction]       = useState<Action | null>(null);
  const [startDt,      setStartDt]      = useState('');
  const [endDt,        setEndDt]        = useState('');
  const [note,         setNote]         = useState('');
  const [done,         setDone]         = useState(false);
  const [recalculated, setRecalculated] = useState(false);

  const toggleSoldier = (id: string) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleApply = () => {
    if (!action || selectedIds.length === 0) return;

    const names = selectedIds.map((id) => soldiers.find((s) => s.id === id)?.name).join(', ');
    const actionText = ACTION_LABELS[action];
    const noteText   = note ? ` — ${note}` : '';

    if (action === 'unavailable' || action === 'remove') {
      selectedIds.forEach((id) => updateSoldierAvailability(id, false));
    }

    addAuditLog({
      actorName: currentUser!.name,
      actorRole: currentRole,
      action: `בלת״מ: ${actionText}`,
      target: `${names}${noteText}${endDt ? ` עד ${endDt}` : ''}`,
    });

    setHasEmergency(true);
    setDone(true);
  };

  const handleRecalculate = () => {
    if (!activePeriod) return;
    const result = generateSchedule({
      missionTypes: activePeriod.missionTypes,
      soldiers,
      leaves,
      history: soldierHistory,
    });
    updatePeriod({ ...activePeriod, missionTypes: result.missionTypes });
    setGenerationResult(activePeriod.id, result.warnings, result.fairness);
    addAuditLog({ actorName: currentUser!.name, actorRole: currentRole, action: 'חישב שיבוץ מחדש לאחר בלת״מ', target: activePeriod.name });
    setRecalculated(true);
  };

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title='בלת״מ' />

      <main className="px-4 py-4 pb-28 max-w-xl mx-auto space-y-3">
        {/* Alert bar */}
        <div className="bg-mil-alert-bg border border-mil-alert/50 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-mil-alert text-xl">⚠</span>
          <div>
            <p className="font-bold text-mil-alert text-sm">הפעלת בלת״מ</p>
            <p className="text-xs text-mil-muted">בחר חייל/ים ופעולה, ואז הפעל חישוב מחדש</p>
          </div>
        </div>

        {done ? (
          <>
            <div className="bg-mil-success-bg border border-mil-success/40 text-mil-success rounded-xl px-4 py-3 text-sm">
              ✓ הפעולה בוצעה והוקלטה ביומן
            </div>
            <button
              onClick={handleRecalculate}
              disabled={recalculated}
              className="w-full bg-mil-olive hover:bg-mil-olive-light disabled:opacity-50 text-white font-bold py-4 rounded-xl text-base transition-colors"
            >
              {recalculated ? '✓ השיבוץ חושב מחדש' : 'חשב שיבוץ מחדש במינימום שינויים'}
            </button>
          </>
        ) : (
          <>
            {/* Soldier selection */}
            <div className="bg-mil-card border border-mil-border rounded-xl overflow-hidden">
              <div className="bg-mil-surface border-b border-mil-border px-4 py-2">
                <p className="text-xs font-bold tracking-widest text-mil-text-inv/70">בחר חייל/ים</p>
              </div>
              <div className="divide-y divide-mil-border max-h-64 overflow-y-auto">
                {soldiers.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => toggleSoldier(s.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-right transition-colors ${
                      selectedIds.includes(s.id) ? 'bg-mil-olive/20' : 'hover:bg-mil-card-hover'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      selectedIds.includes(s.id) ? 'bg-mil-olive border-mil-olive text-white' : 'border-mil-border'
                    }`}>
                      {selectedIds.includes(s.id) && '✓'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-mil-text font-medium">{s.name}</p>
                      <p className="text-xs text-mil-muted">{s.operationalRoles.join(', ')} · {s.teamClass}</p>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${s.availability ? 'border-mil-success/40 text-mil-success' : 'border-mil-alert/40 text-mil-alert'}`}>
                      {s.availability ? 'זמין' : 'לא זמין'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Action selection */}
            {selectedIds.length > 0 && (
              <div className="bg-mil-card border border-mil-border rounded-xl overflow-hidden">
                <div className="bg-mil-surface border-b border-mil-border px-4 py-2">
                  <p className="text-xs font-bold tracking-widest text-mil-text-inv/70">בחר פעולה</p>
                </div>
                <div className="grid grid-cols-2 gap-2 p-3">
                  {(Object.entries(ACTION_LABELS) as [Action, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setAction(key)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border transition-colors ${
                        action === key
                          ? 'bg-mil-alert-bg border-mil-alert text-mil-alert'
                          : 'bg-mil-bg border-mil-border text-mil-muted hover:border-mil-border hover:text-mil-text'
                      }`}
                    >
                      <span className="text-xl">{ACTION_ICONS[key]}</span>
                      <span className="text-xs text-center">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Time range + note */}
            {action && (
              <div className="bg-mil-card border border-mil-border rounded-xl overflow-hidden">
                <div className="bg-mil-surface border-b border-mil-border px-4 py-2">
                  <p className="text-xs font-bold tracking-widest text-mil-text-inv/70">פרטים</p>
                </div>
                <div className="px-4 py-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-mil-muted mb-1.5">מתאריך/שעה</label>
                      <input type="datetime-local" className={inp} value={startDt} onChange={(e) => setStartDt(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs text-mil-muted mb-1.5">עד תאריך/שעה</label>
                      <input type="datetime-local" className={inp} value={endDt} onChange={(e) => setEndDt(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-mil-muted mb-1.5">הערה (אופציונלי)</label>
                    <textarea
                      className={`${inp} resize-none`}
                      rows={2}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={`לדוגמה: ${selectedIds.length > 0
                        ? soldiers.find((s) => s.id === selectedIds[0])?.name ?? 'החייל'
                        : 'החייל'} יצא הביתה עד שבת 18:00`}
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleApply}
              disabled={!action || selectedIds.length === 0}
              className="w-full bg-mil-alert hover:bg-red-700 disabled:opacity-40 text-white font-bold py-4 rounded-xl text-base transition-colors flex items-center justify-center gap-2"
            >
              <span>⚡</span> בצע פעולה
            </button>
          </>
        )}
      </main>
    </div>
  );
}

const inp = 'w-full bg-mil-bg border border-mil-border rounded-lg px-3 py-2.5 text-sm text-mil-text focus:outline-none focus:ring-1 focus:ring-mil-olive focus:border-mil-olive placeholder:text-mil-ghost';
