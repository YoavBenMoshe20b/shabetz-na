import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

type Step = 1 | 2 | 3 | 4 | 5;

const PRESET_ROLES = ['קלע', 'חובש', 'נגביסט', 'מאגיסט', 'קשר מ״מ', 'רחפן', 'מ״מ', 'סמל', 'מ״כ', 'תצפיתן'];

export default function CreatePlatoonPage() {
  const { createGroup } = useApp();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [platoonName, setPlatoonName] = useState('');
  const [unitName, setUnitName]       = useState('');
  const [size, setSize]               = useState('');
  const [availableRoles, setAvailableRoles] = useState<string[]>(['קלע', 'חובש', 'נגביסט']);
  const [customRole, setCustomRole]   = useState('');
  const [commanderName, setCommanderName] = useState('');
  const [sergeantName, setSergeantName]   = useState('');
  const [enemyConfusion, setEnemyConfusion] = useState(false);
  const [confusionMinutes, setConfusionMinutes] = useState(15);
  const [groupCode, setGroupCode] = useState('');

  const toggleRole = (role: string) => {
    setAvailableRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const addCustomRole = () => {
    const r = customRole.trim();
    if (!r || availableRoles.includes(r)) return;
    setAvailableRoles((prev) => [...prev, r]);
    setCustomRole('');
  };

  const handleCreate = () => {
    const code = createGroup({
      name: platoonName,
      unitName: unitName || undefined,
      availableRoles,
      commanderName,
      sergeantName,
      size: size ? parseInt(size) : undefined,
      enemyConfusion,
      confusionMinutes: enemyConfusion ? confusionMinutes : 0,
    });
    setGroupCode(code);
    setStep(5);
  };

  const canStep1 = platoonName.trim().length >= 2;
  const canStep2 = availableRoles.length >= 1;
  const canStep3 = commanderName.trim().length >= 2;

  return (
    <div className="min-h-screen bg-mil-bg flex flex-col" dir="rtl">
      {/* Header */}
      <div className="bg-mil-surface px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => step === 1 ? navigate('/start') : setStep((s) => (s - 1) as Step)}
          className="text-mil-text-inv/70 hover:text-mil-text-inv text-lg"
        >
          ←
        </button>
        <h1 className="text-base font-bold text-mil-text-inv">צור מחלקה</h1>
        <div className="flex-1" />
        {step < 5 && <span className="text-xs text-mil-text-inv/50">{step}/4</span>}
      </div>

      {/* Progress */}
      {step < 5 && (
        <div className="bg-mil-surface/20 h-1 flex">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`flex-1 transition-colors ${s <= step ? 'bg-mil-olive' : 'bg-mil-border'}`} />
          ))}
        </div>
      )}

      <main className="flex-1 px-4 py-6 max-w-sm mx-auto w-full space-y-4">

        {/* ── STEP 1: Name & Unit ──────────────────── */}
        {step === 1 && (
          <>
            <div>
              <h2 className="text-xl font-bold text-mil-text mb-1">שם המחלקה</h2>
              <p className="text-sm text-mil-muted mb-4">פרטים בסיסיים של המחלקה</p>
            </div>
            <div className="bg-mil-card border border-mil-border rounded-2xl p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-mil-muted mb-1.5">שם המחלקה *</label>
                <input className={inp} value={platoonName} onChange={(e) => setPlatoonName(e.target.value)} placeholder="מחלקה א׳ / מחלקת סיור" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-mil-muted mb-1.5">שם יחידה (אופציונלי)</label>
                <input className={inp} value={unitName} onChange={(e) => setUnitName(e.target.value)} placeholder="גדוד 51 / חטיבה 7" />
              </div>
              <div>
                <label className="block text-xs font-medium text-mil-muted mb-1.5">כמה חיילים במחלקה? (בערך)</label>
                <input className={inp} type="number" value={size} onChange={(e) => setSize(e.target.value)} placeholder="10" min={1} max={60} />
              </div>
            </div>
            <Btn label="המשך →" onClick={() => setStep(2)} disabled={!canStep1} />
          </>
        )}

        {/* ── STEP 2: Roles ────────────────────────── */}
        {step === 2 && (
          <>
            <div>
              <h2 className="text-xl font-bold text-mil-text mb-1">תפקידים במחלקה</h2>
              <p className="text-sm text-mil-muted mb-4">איזה תפקידים יש במחלקה? (חיילים יבחרו מרשימה זו)</p>
            </div>
            <div className="bg-mil-card border border-mil-border rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                {PRESET_ROLES.map((role) => (
                  <button
                    key={role}
                    onClick={() => toggleRole(role)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      availableRoles.includes(role)
                        ? 'bg-mil-olive border-mil-olive text-white'
                        : 'bg-mil-bg border-mil-border text-mil-text hover:border-mil-olive/50'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
              <div className="border-t border-mil-border pt-3">
                <label className="block text-xs text-mil-muted mb-1.5">הוסף תפקיד מותאם</label>
                <div className="flex gap-2">
                  <input
                    className={`${inp} flex-1`}
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    placeholder="שם תפקיד..."
                    onKeyDown={(e) => e.key === 'Enter' && addCustomRole()}
                  />
                  <button
                    onClick={addCustomRole}
                    disabled={!customRole.trim()}
                    className="px-4 py-2.5 bg-mil-olive-bg border border-mil-olive/40 text-mil-olive rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-mil-olive hover:text-white transition-colors"
                  >
                    +
                  </button>
                </div>
                {availableRoles.filter((r) => !PRESET_ROLES.includes(r)).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {availableRoles.filter((r) => !PRESET_ROLES.includes(r)).map((r) => (
                      <span key={r} className="flex items-center gap-1 bg-mil-sand-bg border border-mil-sand/40 text-mil-warn text-xs px-2 py-1 rounded-lg">
                        {r}
                        <button onClick={() => toggleRole(r)} className="text-mil-alert">✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <BackBtn onClick={() => setStep(1)} />
              <Btn label="המשך →" onClick={() => setStep(3)} disabled={!canStep2} />
            </div>
          </>
        )}

        {/* ── STEP 3: Commander + Sergeant ─────────── */}
        {step === 3 && (
          <>
            <div>
              <h2 className="text-xl font-bold text-mil-text mb-1">מבנה הפיקוד</h2>
              <p className="text-sm text-mil-muted mb-4">המ״מ והסמל יקבלו הרשאות ניהול אוטומטית</p>
            </div>
            <div className="bg-mil-card border border-mil-border rounded-2xl p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-mil-muted mb-1.5">שם המ״מ *</label>
                <input className={inp} value={commanderName} onChange={(e) => setCommanderName(e.target.value)} placeholder="שם המ״מ" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-mil-muted mb-1.5">שם הסמל (אופציונלי)</label>
                <input className={inp} value={sergeantName} onChange={(e) => setSergeantName(e.target.value)} placeholder="שם הסמל" />
              </div>
            </div>
            <div className="bg-mil-olive-bg border border-mil-olive/20 rounded-xl px-4 py-3 text-xs text-mil-olive-dim space-y-1">
              <p className="font-bold">הרשאות מנהל:</p>
              <p>• אישור / דחיית בקשות יציאה</p>
              <p>• עריכה ופרסום שיבוצים</p>
              <p>• ניהול רשימת חיילים</p>
            </div>
            <div className="flex gap-2">
              <BackBtn onClick={() => setStep(2)} />
              <Btn label="המשך →" onClick={() => setStep(4)} disabled={!canStep3} />
            </div>
          </>
        )}

        {/* ── STEP 4: Enemy Confusion ──────────────── */}
        {step === 4 && (
          <>
            <div>
              <h2 className="text-xl font-bold text-mil-text mb-1">בלבול אויב</h2>
              <p className="text-sm text-mil-muted mb-4">
                שינוי שעות וסדרי שמירה כדי למנוע דפוס קבוע וצפוי שהאויב עלול לזהות.
              </p>
            </div>
            <div className="bg-mil-card border border-mil-border rounded-2xl p-5 space-y-5">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => setEnemyConfusion((v) => !v)}
                  className={`mt-0.5 w-12 h-6 rounded-full transition-colors flex-shrink-0 relative ${enemyConfusion ? 'bg-mil-olive' : 'bg-mil-border'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${enemyConfusion ? 'right-0.5' : 'left-0.5'}`} />
                </button>
                <div>
                  <p className="font-medium text-mil-text text-sm">הפעל בלבול אויב</p>
                  <p className="text-xs text-mil-muted mt-0.5">טשטוש תזמוני שמירות כברירת מחדל</p>
                </div>
              </div>

              {enemyConfusion && (
                <div className="border-t border-mil-border pt-4 space-y-2">
                  <label className="block text-sm font-medium text-mil-text">כמה זמן טשטוש מותר?</label>
                  <p className="text-xs text-mil-muted">הערך הזה מוגבל לגבול המשמרת המרבי שתוגדר בכל משימה.</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={5}
                      max={60}
                      step={5}
                      value={confusionMinutes}
                      onChange={(e) => setConfusionMinutes(parseInt(e.target.value))}
                      className="flex-1 accent-mil-olive"
                    />
                    <span className="font-bold text-mil-olive w-14 text-center">{confusionMinutes} דק׳</span>
                  </div>
                  <div className="flex justify-between text-xs text-mil-ghost px-0.5">
                    <span>5 דק׳</span><span>30 דק׳</span><span>60 דק׳</span>
                  </div>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="bg-mil-olive-bg border border-mil-olive/20 rounded-xl p-4 space-y-1.5 text-sm">
              <p className="font-bold text-mil-olive-dim mb-2">סיכום</p>
              <Row label="מחלקה" value={platoonName} />
              {unitName && <Row label="יחידה" value={unitName} />}
              {size && <Row label="גודל" value={`${size} חיילים`} />}
              <Row label="מ״מ" value={commanderName} />
              {sergeantName && <Row label="סמל" value={sergeantName} />}
              <Row label="תפקידים" value={availableRoles.join(', ')} />
              <Row label="בלבול אויב" value={enemyConfusion ? `פעיל (${confusionMinutes} דק׳)` : 'כבוי'} />
            </div>

            <div className="flex gap-2">
              <BackBtn onClick={() => setStep(3)} />
              <Btn label="צור מחלקה ✓" onClick={handleCreate} />
            </div>
          </>
        )}

        {/* ── STEP 5: Success + Invite ──────────────── */}
        {step === 5 && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="w-20 h-20 bg-mil-olive-bg border-2 border-mil-olive/40 rounded-full flex items-center justify-center text-4xl text-mil-olive mx-auto mb-4">✓</div>
              <h2 className="text-2xl font-bold text-mil-text">{platoonName} נוצרה!</h2>
              <p className="text-mil-muted text-sm mt-1">שתף את הפרטים הבאים עם החיילים שלך</p>
            </div>

            <div className="bg-mil-card border-2 border-mil-olive/30 rounded-2xl p-5 space-y-4">
              <div className="text-center">
                <p className="text-xs text-mil-muted mb-1">קוד הצטרפות</p>
                <p className="text-3xl font-bold font-mono text-mil-olive-dim tracking-widest">{groupCode}</p>
              </div>
              <div className="flex justify-center">
                <div className="w-28 h-28 bg-mil-bg border-2 border-dashed border-mil-border rounded-xl flex flex-col items-center justify-center gap-1">
                  <span className="text-3xl text-mil-ghost">▦</span>
                  <span className="text-[10px] text-mil-ghost">QR דמו</span>
                </div>
              </div>
              <div className="bg-mil-bg border border-mil-border rounded-lg px-3 py-2">
                <p className="text-xs text-mil-muted mb-0.5">קישור הצטרפות</p>
                <p className="text-xs font-mono text-mil-olive dir-ltr text-left">shavatz.app/join/{groupCode}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => navigator.clipboard?.writeText(groupCode)} className="flex-1 bg-mil-olive-bg border border-mil-olive/30 text-mil-olive text-sm py-2 rounded-lg hover:bg-mil-olive hover:text-white transition-colors">
                  העתק קוד
                </button>
                <button onClick={() => navigator.share?.({ text: `הצטרף למחלקה! קוד: ${groupCode}` })} className="flex-1 bg-mil-olive-bg border border-mil-olive/30 text-mil-olive text-sm py-2 rounded-lg hover:bg-mil-olive hover:text-white transition-colors">
                  שתף
                </button>
              </div>
            </div>

            <div className="bg-mil-sand-bg border border-mil-sand/40 rounded-xl p-3 text-xs text-mil-warn space-y-1">
              <p className="font-medium">מה הלאה?</p>
              <p>1. שלח את הקוד לחיילים — הם יצטרפו דרך האפליקציה</p>
              <p>2. לאחר שהם מצטרפים, צור את תקופת השיבוץ הראשונה</p>
            </div>

            <button
              onClick={() => navigate('/schedule')}
              className="w-full bg-mil-olive hover:bg-mil-olive-light text-white font-bold py-4 rounded-xl text-base transition-colors"
            >
              התחל לבנות שיבוץ →
            </button>
          </div>
        )}

      </main>
    </div>
  );
}

function Btn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 bg-mil-olive hover:bg-mil-olive-light disabled:opacity-40 text-white font-bold py-3.5 rounded-xl text-sm transition-colors"
    >
      {label}
    </button>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 bg-mil-card border border-mil-border hover:border-mil-olive/50 text-mil-muted font-medium py-3.5 rounded-xl text-sm transition-colors"
    >
      ← חזור
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-mil-muted min-w-[70px]">{label}:</span>
      <span className="text-mil-text font-medium">{value}</span>
    </div>
  );
}

const inp = 'w-full bg-mil-bg border border-mil-border rounded-xl px-4 py-3 text-mil-text focus:outline-none focus:ring-2 focus:ring-mil-olive/30 focus:border-mil-olive placeholder:text-mil-ghost text-base';
