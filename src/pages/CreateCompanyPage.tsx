// Company-first setup wizard.
//
// ONE entry point for organisational creation. Only company-level leadership
// passes through here. It produces a Company with its internal Platoons and
// (optionally) per-platoon Squads in a single transaction. There is no
// "create platoon" experience anywhere else in the app — only this wizard.
//
// 4 steps + a success screen:
//   1. Company name + unit/battalion
//   2. Platoon structure (which platoons exist, special-platoon flag)
//   3. Operational rules (min on base, rotation strategy, special-leave toggle)
//   4. Review → create → success screen with invite code

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Card, Button, PageMain, PageTitle, HeroTitle, CardTitle, Body, Muted, Hint } from '../components/ui';
import type { MissionRotationStrategy } from '../types';

type Step = 1 | 2 | 3 | 4 | 5;

interface PlatoonDraft {
  id: string;          // local-only id for keying
  name: string;
  isSpecial: boolean;
  squadsCsv: string; // comma-separated names, easier to type than per-row UI
}

const DEFAULT_PLATOONS: () => PlatoonDraft[] = () => [
  { id: 'p1', name: 'חפ״ק',    isSpecial: true,  squadsCsv: 'צוות חפ״ק' },
  { id: 'p2', name: 'מחלקה 1', isSpecial: false, squadsCsv: 'כיתה א, כיתה ב, כיתה ג' },
  { id: 'p3', name: 'מחלקה 2', isSpecial: false, squadsCsv: 'כיתה א, כיתה ב, כיתה ג' },
  { id: 'p4', name: 'מחלקה 3', isSpecial: false, squadsCsv: 'כיתה א, כיתה ב, כיתה ג' },
  { id: 'p5', name: 'מפלג',    isSpecial: true,  squadsCsv: 'לוגיסטיקה, אספקה' },
];

export default function CreateCompanyPage() {
  const { createCompany } = useApp();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [name,     setName]     = useState('');
  const [unitName, setUnitName] = useState('');

  // Step 2
  const [platoons, setPlatoons] = useState<PlatoonDraft[]>(DEFAULT_PLATOONS());

  // Step 3
  const [minOnBase, setMinOnBase] = useState<number>(18);
  const [rotation,  setRotation]  = useState<MissionRotationStrategy>('platoon-based');
  const [specialFollowsLeave, setSpecialFollowsLeave] = useState(false);

  // Step 5 (success)
  const [inviteCode, setInviteCode] = useState('');

  // ── Validation ─────────────────────────────────────────
  const canStep1 = name.trim().length >= 2;
  const canStep2 = platoons.length >= 1 && platoons.every((p) => p.name.trim().length >= 2);
  const canStep3 = minOnBase >= 0;

  // ── Platoon list editing ────────────────────────────────
  const addPlatoon = () => setPlatoons((prev) => [
    ...prev,
    { id: `p-${Date.now()}`, name: '', isSpecial: false, squadsCsv: '' },
  ]);
  const removePlatoon = (id: string) =>
    setPlatoons((prev) => prev.filter((p) => p.id !== id));
  const patchPlatoon = (id: string, patch: Partial<PlatoonDraft>) =>
    setPlatoons((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p));

  // ── Submit ─────────────────────────────────────────────
  const handleCreate = () => {
    const code = createCompany({
      name: name.trim(),
      unitName: unitName.trim() || undefined,
      settings: {
        rotationStrategy: rotation,
        minSoldiersOnBase: minOnBase,
        specialPlatoonsFollowLeaveRotation: specialFollowsLeave,
        companyHomePeriods: [],
      },
      platoons: platoons.map((p) => ({
        name: p.name.trim(),
        isSpecial: p.isSpecial,
        squadNames: p.squadsCsv
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      })),
    });
    setInviteCode(code);
    setStep(5);
  };

  return (
    <div className="min-h-screen bg-mil-bg flex flex-col" dir="rtl">
      {/* Header */}
      <div className="bg-mil-surface px-5 py-4 flex items-center gap-3">
        <button
          onClick={() => step === 1 ? navigate('/start') : setStep((s) => (s - 1) as Step)}
          className="text-mil-text-inv/80 hover:text-mil-text-inv text-xl leading-none"
        >
          ←
        </button>
        <h1 className="text-mil-text-inv font-bold tracking-wide">צור פלוגה</h1>
        <div className="flex-1" />
        {step < 5 && <span className="text-tiny text-mil-text-inv/60">{step}/4</span>}
      </div>

      {/* Progress */}
      {step < 5 && (
        <div className="bg-mil-surface/40 h-1 flex">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`flex-1 transition-colors ${s <= step ? 'bg-mil-olive' : 'bg-mil-border'}`} />
          ))}
        </div>
      )}

      <PageMain>

        {/* ── STEP 1: Company basics ─────────────────────── */}
        {step === 1 && (
          <>
            <div>
              <PageTitle>צור פלוגה חדשה</PageTitle>
              <Muted className="mt-2">
                את/ה יוצר/ת את הפלוגה ותהיה/י המ״פ. מ״מים, סמלים וחיילים יתווספו לאחר מכן באמצעות קוד הצטרפות.
              </Muted>
            </div>
            <Card>
              <div className="px-5 py-5 space-y-4">
                <Field label="שם הפלוגה *">
                  <input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="פלוגה ב, חוד החנית, וכו׳" autoFocus />
                </Field>
                <Field label="גדוד / יחידה (אופציונלי)">
                  <input className={inp} value={unitName} onChange={(e) => setUnitName(e.target.value)} placeholder="גדוד 51" />
                </Field>
              </div>
            </Card>
            <Button variant="primary" size="lg" fullWidth disabled={!canStep1} onClick={() => setStep(2)}>
              המשך ←
            </Button>
          </>
        )}

        {/* ── STEP 2: Platoons ───────────────────────────── */}
        {step === 2 && (
          <>
            <div>
              <PageTitle>מחלקות בפלוגה</PageTitle>
              <Muted className="mt-2">
                איך מחולקת הפלוגה? תוכל/י להוסיף, לערוך, ולמחוק מחלקות מאוחר יותר.
              </Muted>
            </div>

            <div className="space-y-3">
              {platoons.map((p, idx) => (
                <Card key={p.id}>
                  <div className="px-4 py-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <CardTitle>מחלקה {idx + 1}</CardTitle>
                      {platoons.length > 1 && (
                        <button onClick={() => removePlatoon(p.id)} className="mr-auto text-tiny text-mil-alert hover:underline">
                          הסר
                        </button>
                      )}
                    </div>
                    <Field label="שם המחלקה">
                      <input className={inp} value={p.name} onChange={(e) => patchPlatoon(p.id, { name: e.target.value })} placeholder="מחלקה 1" />
                    </Field>
                    <Field label="כיתות (מופרדות בפסיק)">
                      <input
                        className={inp}
                        value={p.squadsCsv}
                        onChange={(e) => patchPlatoon(p.id, { squadsCsv: e.target.value })}
                        placeholder="כיתה א, כיתה ב, כיתה ג"
                      />
                    </Field>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={p.isSpecial}
                        onChange={(e) => patchPlatoon(p.id, { isSpecial: e.target.checked })}
                        className="w-4 h-4 accent-mil-olive"
                      />
                      <Body>מחלקה מיוחדת (חפ״ק / סיור / חוליה טכנית וכד׳)</Body>
                    </label>
                  </div>
                </Card>
              ))}

              <Button variant="secondary" size="md" fullWidth onClick={addPlatoon}>
                + הוסף מחלקה
              </Button>
            </div>

            <Button variant="primary" size="lg" fullWidth disabled={!canStep2} onClick={() => setStep(3)}>
              המשך ←
            </Button>
          </>
        )}

        {/* ── STEP 3: Operational rules ──────────────────── */}
        {step === 3 && (
          <>
            <div>
              <PageTitle>כללי פעולה</PageTitle>
              <Muted className="mt-2">
                מינימום כוח אדם ואסטרטגיית סבב. אפשר לשנות בכל עת בהגדרות הפלוגה.
              </Muted>
            </div>
            <Card>
              <div className="px-5 py-5 space-y-5">
                <Field label="מינימום חיילים בבסיס">
                  <div className="flex items-center gap-3">
                    <input
                      type="number" min={0} max={200}
                      className={`${inp} w-24`}
                      value={minOnBase}
                      onChange={(e) => setMinOnBase(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    />
                    <Muted>סך חיילים שחייבים להישאר בכל רגע</Muted>
                  </div>
                </Field>

                <Field label="סבב משימות">
                  <div className="flex gap-2">
                    <RotationOption
                      label="לפי מחלקה"
                      hint="כל מחלקה אחראית למשימה ביום שלה"
                      active={rotation === 'platoon-based'}
                      onClick={() => setRotation('platoon-based')}
                    />
                    <RotationOption
                      label="לפי תת-קבוצה"
                      hint="ניתן לפצל משימה בתוך מחלקה"
                      active={rotation === 'squad-based'}
                      onClick={() => setRotation('squad-based')}
                    />
                  </div>
                </Field>

                <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-mil-border">
                  <input
                    type="checkbox"
                    checked={specialFollowsLeave}
                    onChange={(e) => setSpecialFollowsLeave(e.target.checked)}
                    className="w-4 h-4 accent-mil-olive mt-1"
                  />
                  <div>
                    <Body className="font-semibold">מחלקות מיוחדות יוצאות עם הפלוגה</Body>
                    <Muted className="mt-0.5">אם כבוי, חפ״ק ומפלג ינהלו רוטציית יציאות נפרדת.</Muted>
                  </div>
                </label>
              </div>
            </Card>
            <Button variant="primary" size="lg" fullWidth disabled={!canStep3} onClick={() => setStep(4)}>
              המשך ←
            </Button>
          </>
        )}

        {/* ── STEP 4: Review ─────────────────────────────── */}
        {step === 4 && (
          <>
            <div>
              <PageTitle>סיכום</PageTitle>
              <Muted className="mt-2">בדיקה אחרונה לפני יצירת הפלוגה.</Muted>
            </div>
            <Card variant="muted">
              <div className="px-5 py-4 space-y-3">
                <SummaryRow label="שם" value={name} />
                {unitName && <SummaryRow label="יחידה" value={unitName} />}
                <SummaryRow label="מחלקות" value={`${platoons.length}`} />
                {platoons.map((p) => (
                  <SummaryRow
                    key={p.id}
                    label={`· ${p.name}`}
                    value={p.squadsCsv || 'ללא כיתות'}
                  />
                ))}
                <SummaryRow label="מינימום בבסיס" value={`${minOnBase} חיילים`} />
                <SummaryRow label="סבב" value={rotation === 'platoon-based' ? 'לפי מחלקה' : 'לפי תת-קבוצה'} />
                <SummaryRow label="מחלקות מיוחדות" value={specialFollowsLeave ? 'יוצאות עם הפלוגה' : 'רוטציית יציאות נפרדת'} />
              </div>
            </Card>
            <Button variant="primary" size="lg" fullWidth onClick={handleCreate}>
              צור פלוגה ✓
            </Button>
          </>
        )}

        {/* ── STEP 5: Success ─────────────────────────────── */}
        {step === 5 && (
          <>
            <div className="text-center pt-4">
              <div className="w-20 h-20 bg-mil-olive-bg border-2 border-mil-olive/40 rounded-full inline-flex items-center justify-center text-4xl text-mil-olive mb-4">✓</div>
              <PageTitle as="h1">{name} מוכנה</PageTitle>
              <Muted className="mt-2">את/ה המ״פ. המבנה הארגוני בנוי. הזמן עכשיו מ״מים וסמלים.</Muted>
            </div>

            <Card variant="hero">
              <div className="px-5 py-5 space-y-4 text-center">
                <Hint>קוד הצטרפות לפלוגה</Hint>
                <HeroTitle className="font-mono tracking-widest text-mil-olive-dim">{inviteCode}</HeroTitle>
                <div className="bg-mil-bg border border-mil-border rounded-xl px-4 py-3">
                  <Hint>קישור הצטרפות</Hint>
                  <p className="text-tiny font-mono text-mil-olive dir-ltr text-left mt-1">shavatz.app/join/{inviteCode}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="md" fullWidth onClick={() => navigator.clipboard?.writeText(inviteCode)}>
                    העתק קוד
                  </Button>
                  <Button variant="secondary" size="md" fullWidth onClick={() => navigator.share?.({ text: `הצטרף לפלוגה — קוד: ${inviteCode}` })}>
                    שתף
                  </Button>
                </div>
              </div>
            </Card>

            <Card variant="muted">
              <div className="px-5 py-4 space-y-1.5">
                <Body className="font-semibold text-mil-olive-dim">מה הלאה?</Body>
                <Muted>1. שלח/י את קוד הפלוגה למ״מים ולסמלים — הם יבחרו את המחלקה שהם מפקדים עליה.</Muted>
                <Muted>2. כל מ״מ ימשיך לתת את הקוד לחייליו.</Muted>
                <Muted>3. אפשר להתחיל להגדיר משימות פלוגתיות מיד.</Muted>
              </div>
            </Card>

            <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/home')}>
              כניסה למערכת ←
            </Button>
          </>
        )}

      </PageMain>
    </div>
  );
}

// ─── Small bits ───────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-tiny text-mil-muted font-medium mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function RotationOption({ label, hint, active, onClick }: { label: string; hint: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-4 py-3 rounded-xl border text-right transition-all ${
        active
          ? 'bg-mil-olive border-mil-olive text-white shadow-card-hover'
          : 'bg-mil-bg border-mil-border text-mil-text hover:border-mil-olive'
      }`}
    >
      <p className="font-bold text-sm">{label}</p>
      <p className={`text-tiny mt-0.5 ${active ? 'text-white/80' : 'text-mil-muted'}`}>{hint}</p>
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 items-baseline">
      <Muted className="min-w-[100px] flex-shrink-0">{label}</Muted>
      <Body className="font-semibold text-mil-text break-words">{value}</Body>
    </div>
  );
}

const inp = 'w-full bg-mil-bg border border-mil-border rounded-xl px-4 py-3 text-mil-text focus:outline-none focus:ring-2 focus:ring-mil-olive/30 focus:border-mil-olive placeholder:text-mil-ghost text-base';
