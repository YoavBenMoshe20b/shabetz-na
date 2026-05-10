import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Step = 1 | 2 | 3 | 4;

const DEMO_CODE = 'UNIT-' + Math.floor(1000 + Math.random() * 9000);

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState({
    machlakName: '',
    unitName: '',
    commander: '',
    sergeant: '',
    scheduleRole: 'commander' as 'commander' | 'sergeant' | 'both',
  });
  const [created, setCreated] = useState(false);
  const [groupCode] = useState(DEMO_CODE);

  const canNext = () => {
    if (step === 1) return form.machlakName.trim().length >= 2;
    if (step === 2) return form.commander.trim().length >= 2;
    return true;
  };

  const handleCreate = () => {
    setCreated(true);
    setStep(4);
  };

  if (step === 4 && created) {
    return (
      <div className="min-h-screen bg-mil-bg flex flex-col items-center justify-center px-5" dir="rtl">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center">
            <div className="w-16 h-16 bg-mil-olive-bg border-2 border-mil-olive/40 rounded-full flex items-center justify-center text-3xl text-mil-olive mx-auto mb-4">✓</div>
            <h1 className="text-2xl font-bold text-mil-text">{form.machlakName} נוצרה!</h1>
            <p className="text-mil-muted text-sm mt-1">שתף את הפרטים הבאים עם החיילים שלך</p>
          </div>

          {/* Code card */}
          <div className="bg-mil-card border-2 border-mil-olive/30 rounded-2xl p-5 space-y-4">
            <div className="text-center">
              <p className="text-xs text-mil-muted mb-1">קוד הצטרפות</p>
              <p className="text-3xl font-bold font-mono text-mil-olive-dim tracking-widest">{groupCode}</p>
            </div>

            {/* Mock QR */}
            <div className="flex justify-center">
              <div className="w-28 h-28 bg-mil-bg border-2 border-dashed border-mil-border rounded-xl flex flex-col items-center justify-center gap-1">
                <span className="text-3xl text-mil-ghost">▦</span>
                <span className="text-[10px] text-mil-ghost">QR דמו</span>
              </div>
            </div>

            {/* Mock link */}
            <div className="bg-mil-bg border border-mil-border rounded-lg px-3 py-2">
              <p className="text-xs text-mil-muted mb-0.5">קישור הצטרפות</p>
              <p className="text-xs font-mono text-mil-olive dir-ltr text-left">shavatz.app/join/{groupCode}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {}}
                className="flex-1 bg-mil-olive-bg border border-mil-olive/30 text-mil-olive text-sm py-2 rounded-lg hover:bg-mil-olive hover:text-white transition-colors"
              >
                העתק קוד
              </button>
              <button
                onClick={() => {}}
                className="flex-1 bg-mil-olive-bg border border-mil-olive/30 text-mil-olive text-sm py-2 rounded-lg hover:bg-mil-olive hover:text-white transition-colors"
              >
                שתף קישור
              </button>
            </div>
          </div>

          <div className="bg-mil-sand-bg border border-mil-sand/40 rounded-xl p-3 text-xs text-mil-warn">
            <p className="font-medium mb-1">מה הלאה?</p>
            <p>1. שלח את הקוד לחיילים — הם יצטרפו דרך האפליקציה</p>
            <p className="mt-0.5">2. לאחר שהם מצטרפים, צור את תקופת השיבוץ הראשונה</p>
          </div>

          <button
            onClick={() => navigate('/schedule')}
            className="w-full bg-mil-olive hover:bg-mil-olive-light text-white font-bold py-4 rounded-xl text-base transition-colors"
          >
            התחל לבנות שיבוץ →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mil-bg flex flex-col items-center justify-start px-5 pt-12 pb-10" dir="rtl">
      <div className="w-full max-w-sm space-y-5">

        {/* Logo */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-mil-olive tracking-widest">שבץ־נא</h1>
          <p className="text-mil-muted text-sm mt-1">צור את המחלקה שלך</p>
          {/* Progress */}
          <div className="flex justify-center gap-1.5 mt-4">
            {([1, 2, 3] as const).map((s) => (
              <div key={s} className={`h-1.5 rounded-full transition-all ${s < step ? 'w-8 bg-mil-olive' : s === step ? 'w-8 bg-mil-olive/70' : 'w-4 bg-mil-border'}`} />
            ))}
          </div>
        </div>

        {/* Step 1: Machlaka name */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-mil-card border border-mil-border rounded-2xl p-5">
              <h2 className="text-lg font-bold text-mil-text mb-1">שם המחלקה</h2>
              <p className="text-mil-muted text-sm mb-4">איך נקראת המחלקה שלכם?</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-mil-muted mb-1.5">שם המחלקה</label>
                  <input
                    className={inp}
                    value={form.machlakName}
                    onChange={(e) => setForm((f) => ({ ...f, machlakName: e.target.value }))}
                    placeholder="מחלקה א׳ / מחלקת סיור"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs text-mil-muted mb-1.5">שם יחידה (אופציונלי)</label>
                  <input
                    className={inp}
                    value={form.unitName}
                    onChange={(e) => setForm((f) => ({ ...f, unitName: e.target.value }))}
                    placeholder="גדוד 51 / חטיבה 7"
                  />
                </div>
              </div>
            </div>
            <Btn label="המשך →" onClick={() => canNext() && setStep(2)} disabled={!canNext()} />
          </div>
        )}

        {/* Step 2: Leadership */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-mil-card border border-mil-border rounded-2xl p-5">
              <h2 className="text-lg font-bold text-mil-text mb-1">מבנה הפיקוד</h2>
              <p className="text-mil-muted text-sm mb-4">מי עומד בראש המחלקה?</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-mil-muted mb-1.5">מי המ״מ?</label>
                  <input
                    className={inp}
                    value={form.commander}
                    onChange={(e) => setForm((f) => ({ ...f, commander: e.target.value }))}
                    placeholder="שם המ״מ"
                  />
                </div>
                <div>
                  <label className="block text-xs text-mil-muted mb-1.5">מי הסמל? (אופציונלי)</label>
                  <input
                    className={inp}
                    value={form.sergeant}
                    onChange={(e) => setForm((f) => ({ ...f, sergeant: e.target.value }))}
                    placeholder="שם הסמל"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <BackBtn onClick={() => setStep(1)} />
              <Btn label="המשך →" onClick={() => canNext() && setStep(3)} disabled={!canNext()} />
            </div>
          </div>
        )}

        {/* Step 3: Permissions */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-mil-card border border-mil-border rounded-2xl p-5">
              <h2 className="text-lg font-bold text-mil-text mb-1">ניהול שיבוץ</h2>
              <p className="text-mil-muted text-sm mb-4">מי רשאי לערוך ולפרסם שיבוצים?</p>
              <div className="space-y-2">
                {([
                  ['commander', `המ״מ בלבד (${form.commander || 'המ״מ'})`],
                  ['sergeant',  `הסמל בלבד (${form.sergeant  || 'הסמל'})`],
                  ['both',      'גם המ״מ וגם הסמל'],
                ] as const).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setForm((f) => ({ ...f, scheduleRole: v }))}
                    className={`w-full text-right px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                      form.scheduleRole === v
                        ? 'bg-mil-olive-bg border-mil-olive text-mil-olive-dim'
                        : 'bg-mil-bg border-mil-border text-mil-muted hover:border-mil-olive/50'
                    }`}
                  >
                    <span className="inline-block w-5 h-5 rounded-full border-2 mr-2 align-middle flex-shrink-0 text-center text-xs leading-4 inline-flex items-center justify-center" style={{ display: 'inline-flex' }}>
                      {form.scheduleRole === v ? '●' : '○'}
                    </span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-mil-olive-bg border border-mil-olive/20 rounded-xl p-4 text-sm space-y-1">
              <p className="font-bold text-mil-olive-dim mb-1.5">סיכום</p>
              <SummaryRow label="מחלקה" value={form.machlakName} />
              {form.unitName && <SummaryRow label="יחידה" value={form.unitName} />}
              <SummaryRow label="מ״מ" value={form.commander} />
              {form.sergeant && <SummaryRow label="סמל" value={form.sergeant} />}
              <SummaryRow label="ניהול שיבוץ" value={{ commander: `המ״מ`, sergeant: 'הסמל', both: 'מ״מ + סמל' }[form.scheduleRole]} />
            </div>

            <div className="flex gap-2">
              <BackBtn onClick={() => setStep(2)} />
              <Btn label="צור מחלקה ✓" onClick={handleCreate} />
            </div>
          </div>
        )}

      </div>
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-mil-muted min-w-[70px]">{label}:</span>
      <span className="text-mil-text font-medium">{value}</span>
    </div>
  );
}

const inp = 'w-full bg-mil-bg border border-mil-border rounded-xl px-4 py-3 text-mil-text focus:outline-none focus:ring-2 focus:ring-mil-olive/30 focus:border-mil-olive placeholder:text-mil-ghost text-base';
