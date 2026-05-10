import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

type Step = 1 | 2 | 3 | 4;

interface PendingLeave {
  startDate: string; startTime: string;
  endDate: string; endTime: string;
  reason: string;
}

export default function JoinPlatoonPage() {
  const { groups, subUnits, joinGroup } = useApp();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [foundGroup, setFoundGroup] = useState<typeof groups[0] | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedSubUnitId, setSelectedSubUnitId] = useState<string>('');

  // Sub-units defined for the platoon being joined. The company commander
  // configured these per-platoon, so a recon platoon will offer different
  // names than a regular platoon (e.g. ספרפס vs כיתה 1).
  const platoonSubUnits = foundGroup ? subUnits.filter((s) => s.platoonId === foundGroup.id) : [];
  const [hasLeaves, setHasLeaves] = useState<boolean | null>(null);
  const [pendingLeaves, setPendingLeaves] = useState<PendingLeave[]>([]);
  const [newLeave, setNewLeave] = useState<PendingLeave>({ startDate: '', startTime: '14:00', endDate: '', endTime: '08:00', reason: '' });

  const handleCodeSubmit = () => {
    const g = groups.find((g) => g.code === code.trim().toUpperCase());
    if (!g) { setCodeError('קוד לא נמצא. נסה שוב.'); return; }
    setFoundGroup(g);
    // Default-select the first sub-unit so step 2 has a sane initial choice
    const first = subUnits.find((s) => s.platoonId === g.id);
    if (first) setSelectedSubUnitId(first.id);
    setCodeError('');
    setStep(2);
  };

  const handleAddLeave = () => {
    if (!newLeave.startDate || !newLeave.endDate || !newLeave.reason) return;
    setPendingLeaves((prev) => [...prev, { ...newLeave }]);
    setNewLeave({ startDate: '', startTime: '14:00', endDate: '', endTime: '08:00', reason: '' });
  };

  const handleFinish = () => {
    if (!foundGroup) return;
    const leavesToSubmit = hasLeaves ? pendingLeaves : [];
    joinGroup(foundGroup.code, selectedRole, selectedSubUnitId, leavesToSubmit);
    setStep(4);
  };

  return (
    <div className="min-h-screen bg-mil-bg flex flex-col" dir="rtl">
      {/* Header */}
      <div className="bg-mil-surface px-4 py-3 flex items-center gap-3">
        <button onClick={() => step === 1 ? navigate('/start') : setStep((s) => (s - 1) as Step)} className="text-mil-text-inv/70 hover:text-mil-text-inv text-lg">←</button>
        <h1 className="text-base font-bold text-mil-text-inv">הצטרפות למחלקה</h1>
        <div className="flex-1" />
        <span className="text-xs text-mil-text-inv/50">{step}/3</span>
      </div>

      <main className="flex-1 px-4 py-6 max-w-sm mx-auto w-full space-y-4">

        {/* ── STEP 1: Code entry ─────────────────────── */}
        {step === 1 && (
          <>
            <div className="text-center mb-2">
              <p className="text-2xl mb-1">◎</p>
              <h2 className="text-xl font-bold text-mil-text">הזן קוד הצטרפות</h2>
              <p className="text-sm text-mil-muted mt-1">קיבלת קוד מהמ״מ שלך? הזן אותו כאן</p>
            </div>

            {/* Mock QR */}
            <div className="bg-mil-card border border-mil-border rounded-2xl p-5 flex flex-col items-center gap-3">
              <div className="w-36 h-36 bg-mil-surface/10 border-2 border-dashed border-mil-border rounded-xl flex flex-col items-center justify-center gap-1">
                <span className="text-4xl text-mil-ghost">▦</span>
                <span className="text-xs text-mil-ghost">סרוק QR</span>
              </div>
              <p className="text-xs text-mil-muted">— או הזן קוד ידנית —</p>
              <div className="w-full space-y-2">
                <input
                  className={inp}
                  value={code}
                  onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeError(''); }}
                  placeholder="UNIT-4821"
                  dir="ltr"
                />
                {codeError && <p className="text-xs text-mil-alert">{codeError}</p>}
                <p className="text-xs text-mil-ghost text-center">לדמו: UNIT-4821</p>
              </div>
              <button
                onClick={handleCodeSubmit}
                disabled={!code.trim()}
                className="w-full bg-mil-olive hover:bg-mil-olive-light disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-colors"
              >
                המשך
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2: Role + Class ──────────────────── */}
        {step === 2 && foundGroup && (
          <>
            <div className="bg-mil-success-bg border border-mil-success/30 rounded-xl px-4 py-3">
              <p className="font-bold text-mil-text">{foundGroup.name}</p>
              {foundGroup.unitName && <p className="text-sm text-mil-muted">{foundGroup.unitName}</p>}
              {foundGroup.platoonCommander && <p className="text-xs text-mil-muted mt-1">מ״מ: {foundGroup.platoonCommander}</p>}
            </div>

            <div className="bg-mil-card border border-mil-border rounded-2xl p-5 space-y-5">
              {/* Role */}
              <div>
                <label className="block text-sm font-bold text-mil-text mb-3">מה התפקיד שלך?</label>
                <div className="flex flex-wrap gap-2">
                  {foundGroup.availableRoles.map((r) => (
                    <button
                      key={r}
                      onClick={() => setSelectedRole(r)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        selectedRole === r
                          ? 'bg-mil-olive border-mil-olive text-white'
                          : 'bg-mil-bg border-mil-border text-mil-text hover:border-mil-olive/50'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-unit */}
              <div>
                <label className="block text-sm font-bold text-mil-text mb-3">לאיזו תת-קבוצה אתה משתייך?</label>
                {platoonSubUnits.length === 0 ? (
                  <p className="text-xs text-mil-muted bg-mil-warn-bg border border-mil-warn-border rounded-lg px-3 py-2">
                    מ״מ המחלקה לא הגדיר עדיין תת-קבוצות. תוכל לבחור מאוחר יותר.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {platoonSubUnits.map((su) => (
                      <button
                        key={su.id}
                        onClick={() => setSelectedSubUnitId(su.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          selectedSubUnitId === su.id
                            ? 'bg-mil-olive border-mil-olive text-white'
                            : 'bg-mil-bg border-mil-border text-mil-text hover:border-mil-olive/50'
                        }`}
                      >
                        {su.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setStep(3)}
              disabled={!selectedRole}
              className="w-full bg-mil-olive hover:bg-mil-olive-light disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-colors"
            >
              המשך
            </button>
          </>
        )}

        {/* ── STEP 3: Leave requests ────────────────── */}
        {step === 3 && (
          <>
            <div className="text-center mb-2">
              <h2 className="text-xl font-bold text-mil-text">בקשות יציאה</h2>
              <p className="text-sm text-mil-muted mt-1">האם יש לך בקשות יציאה לקרוב?</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setHasLeaves(true)}
                className={`flex-1 py-4 rounded-xl border-2 font-bold text-sm transition-colors ${hasLeaves === true ? 'border-mil-olive bg-mil-olive text-white' : 'border-mil-border bg-mil-card text-mil-text hover:border-mil-olive'}`}
              >
                כן, יש לי
              </button>
              <button
                onClick={() => setHasLeaves(false)}
                className={`flex-1 py-4 rounded-xl border-2 font-bold text-sm transition-colors ${hasLeaves === false ? 'border-mil-olive bg-mil-olive text-white' : 'border-mil-border bg-mil-card text-mil-text hover:border-mil-olive'}`}
              >
                לא, ממשיך
              </button>
            </div>

            {hasLeaves && (
              <div className="bg-mil-card border border-mil-border rounded-2xl p-4 space-y-3">
                <p className="text-sm font-bold text-mil-text">הוסף בקשת יציאה</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-mil-muted mb-1 block">יציאה — תאריך</label>
                    <input type="date" className={inp} value={newLeave.startDate} onChange={(e) => setNewLeave((p) => ({ ...p, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-mil-muted mb-1 block">יציאה — שעה</label>
                    <input type="time" className={inp} value={newLeave.startTime} onChange={(e) => setNewLeave((p) => ({ ...p, startTime: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-mil-muted mb-1 block">חזרה — תאריך</label>
                    <input type="date" className={inp} value={newLeave.endDate} onChange={(e) => setNewLeave((p) => ({ ...p, endDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-mil-muted mb-1 block">חזרה — שעה</label>
                    <input type="time" className={inp} value={newLeave.endTime} onChange={(e) => setNewLeave((p) => ({ ...p, endTime: e.target.value }))} />
                  </div>
                </div>
                <input className={inp} placeholder="סיבה / הערה" value={newLeave.reason} onChange={(e) => setNewLeave((p) => ({ ...p, reason: e.target.value }))} />
                <button
                  onClick={handleAddLeave}
                  disabled={!newLeave.startDate || !newLeave.endDate || !newLeave.reason}
                  className="w-full border border-mil-olive text-mil-olive bg-mil-olive-bg hover:bg-mil-olive hover:text-white disabled:opacity-40 py-2.5 rounded-xl text-sm font-bold transition-colors"
                >
                  + הוסף בקשה
                </button>

                {pendingLeaves.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-mil-border">
                    {pendingLeaves.map((lv, i) => (
                      <div key={i} className="flex items-center justify-between text-xs text-mil-muted bg-mil-bg rounded-lg px-3 py-2">
                        <span>{lv.startDate} → {lv.endDate}</span>
                        <span className="text-mil-text">{lv.reason}</span>
                        <button onClick={() => setPendingLeaves((p) => p.filter((_, j) => j !== i))} className="text-mil-alert">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {hasLeaves !== null && (
              <button
                onClick={handleFinish}
                className="w-full bg-mil-olive hover:bg-mil-olive-light text-white font-bold py-3.5 rounded-xl transition-colors"
              >
                הצטרף למחלקה
              </button>
            )}
          </>
        )}

        {/* ── STEP 4: Success ───────────────────────── */}
        {step === 4 && (
          <div className="flex flex-col items-center text-center py-8 space-y-4">
            <div className="w-20 h-20 bg-mil-success-bg border-2 border-mil-success/40 rounded-full flex items-center justify-center text-4xl">
              ✓
            </div>
            <h2 className="text-2xl font-bold text-mil-text">הצטרפת בהצלחה!</h2>
            <p className="text-mil-muted text-sm">ברוך הבא ל{foundGroup?.name}. השיבוץ שלך יתעדכן לאחר פרסום.</p>
            {pendingLeaves.length > 0 && (
              <div className="bg-mil-warn-bg border border-mil-warn/30 rounded-xl px-4 py-3 text-sm text-mil-warn w-full text-right">
                <p className="font-bold mb-1">בקשות שנשלחו:</p>
                {pendingLeaves.map((lv, i) => (
                  <p key={i}>• {lv.startDate}–{lv.endDate}: {lv.reason}</p>
                ))}
                <p className="text-xs mt-1 text-mil-muted">הבקשות ממתינות לאישור המ״מ</p>
              </div>
            )}
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-mil-olive hover:bg-mil-olive-light text-white font-bold py-4 rounded-xl text-base transition-colors"
            >
              כניסה למחלקה →
            </button>
          </div>
        )}

      </main>
    </div>
  );
}

const inp = 'w-full bg-mil-bg border border-mil-border rounded-xl px-3 py-2.5 text-sm text-mil-text focus:outline-none focus:ring-1 focus:ring-mil-olive focus:border-mil-olive placeholder:text-mil-ghost';
