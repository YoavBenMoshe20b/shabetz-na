// Company-first join flow.
//
// All non-creators come through here. The flow asks WHO you are (soldier
// or one of three officer ranks), maps that to an explicit JoinIdentity,
// and calls joinCompany() in one go. Soldiers go through additional
// steps to pick a sub-unit, operational role, and optional pending
// leave requests; officers commit at the role + platoon step.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  Card, Button, PageMain, PageTitle, CardTitle, Body, Muted, Hint, StatusPill,
} from '../components/ui';
import type { JoinIdentity } from '../context/AppContext';

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type Identity = 'soldier' | 'platoonCommander' | 'platoonSergeant' | 'deputyCompanyCommander';

interface PendingLeave { startDate: string; startTime: string; endDate: string; endTime: string; reason: string }

export default function JoinCompanyPage() {
  const { companies, groups, subUnits, joinCompany } = useApp();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);

  // Step 1: code lookup
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [foundCompany, setFoundCompany] = useState<typeof companies[0] | null>(null);
  const companyPlatoons = foundCompany ? groups.filter((g) => g.companyId === foundCompany.id) : [];

  // Step 2: identity
  const [identity, setIdentity] = useState<Identity | null>(null);

  // Step 3: platoon (soldier + officer)
  const [platoonId, setPlatoonId] = useState<string>('');
  const platoon = groups.find((g) => g.id === platoonId);
  const platoonSubUnits = platoon ? subUnits.filter((s) => s.platoonId === platoon.id) : [];

  // Step 4: sub-unit (soldier only)
  const [subUnitId, setSubUnitId] = useState<string>('');

  // Step 5: operational role (soldier only)
  const [opRole, setOpRole] = useState<string>('');

  // Step 6: pending leaves (soldier only)
  const [hasLeaves, setHasLeaves]   = useState<boolean | null>(null);
  const [pendingLeaves, setLeaves]  = useState<PendingLeave[]>([]);
  const [newLeave, setNewLeave]     = useState<PendingLeave>({ startDate: '', startTime: '14:00', endDate: '', endTime: '08:00', reason: '' });

  // Step 7: success / error
  const [submitError, setSubmitError] = useState('');

  // ── Handlers ───────────────────────────────────────────
  const isOfficer = identity === 'platoonCommander' || identity === 'platoonSergeant' || identity === 'deputyCompanyCommander';
  const isCommanderRole = identity === 'platoonCommander' || identity === 'platoonSergeant';
  const isDeputy = identity === 'deputyCompanyCommander';

  const handleCodeSubmit = () => {
    const c = companies.find((co) => co.inviteCode === code.trim().toUpperCase());
    if (!c) { setCodeError('קוד פלוגה לא נמצא. נסה שוב.'); return; }
    setFoundCompany(c);
    setCodeError('');
    setStep(2);
  };

  const handleIdentityNext = () => {
    if (!identity) return;
    if (isDeputy) {
      // deputy doesn't pick a platoon — submit immediately
      submit({ kind: 'deputyCompanyCommander' });
      return;
    }
    setStep(3);
  };

  const handlePlatoonNext = () => {
    if (!platoonId) return;
    if (isCommanderRole) {
      submit({ kind: identity === 'platoonCommander' ? 'platoonCommander' : 'platoonSergeant', platoonId });
      return;
    }
    // soldier
    if (platoonSubUnits.length > 0) {
      setSubUnitId(platoonSubUnits[0].id);
      setStep(4);
    } else {
      setStep(5);  // platoon has no sub-units yet — skip to role
    }
  };

  const handleSubUnitNext = () => {
    if (!subUnitId) return;
    setStep(5);
  };

  const handleRoleNext = () => {
    if (!opRole) return;
    setStep(6);
  };

  const addLeave = () => {
    if (!newLeave.startDate || !newLeave.endDate || !newLeave.reason) return;
    setLeaves((prev) => [...prev, { ...newLeave }]);
    setNewLeave({ startDate: '', startTime: '14:00', endDate: '', endTime: '08:00', reason: '' });
  };

  const handleSoldierFinish = () => {
    submit({
      kind: 'soldier',
      platoonId,
      subUnitId: subUnitId || undefined,
      operationalRole: opRole,
      pendingLeaves: hasLeaves ? pendingLeaves : undefined,
    });
  };

  const submit = (id: JoinIdentity) => {
    if (!foundCompany) return;
    const result = joinCompany(foundCompany.inviteCode, id);
    if (!result.ok) {
      setSubmitError(result.error ?? 'שגיאה בהצטרפות לפלוגה');
      setStep(7);
      return;
    }
    setSubmitError('');
    setStep(7);
  };

  // ── Step display number for progress (officer flow shorter) ──
  const visualSteps = isOfficer ? 3 : 6;
  const visualCurrent = (() => {
    if (step === 1) return 1;
    if (step === 2) return 2;
    if (step === 3) return 3;
    if (step === 4) return 4;
    if (step === 5) return isOfficer ? 3 : 5;
    if (step === 6) return isOfficer ? 3 : 6;
    return visualSteps;
  })();

  return (
    <div className="min-h-screen bg-mil-bg flex flex-col" dir="rtl">
      {/* Header */}
      <div className="bg-mil-surface px-5 py-4 flex items-center gap-3">
        <button
          onClick={() => step === 1 ? navigate('/start') : setStep((s) => Math.max(1, s - 1) as Step)}
          className="text-mil-text-inv/80 hover:text-mil-text-inv text-xl leading-none"
        >
          ←
        </button>
        <h1 className="text-mil-text-inv font-bold tracking-wide">הצטרף לפלוגה</h1>
        <div className="flex-1" />
        {step < 7 && <span className="text-tiny text-mil-text-inv/60">{visualCurrent}/{visualSteps}</span>}
      </div>

      {step < 7 && (
        <div className="bg-mil-surface/40 h-1 flex">
          {Array.from({ length: visualSteps }).map((_, i) => (
            <div key={i} className={`flex-1 transition-colors ${i < visualCurrent ? 'bg-mil-olive' : 'bg-mil-border'}`} />
          ))}
        </div>
      )}

      <PageMain>

        {/* ── STEP 1: Code ───────────────────────────────── */}
        {step === 1 && (
          <>
            <div>
              <PageTitle>הזן קוד פלוגה</PageTitle>
              <Muted className="mt-2">קיבלת את הקוד מהמ״פ או מהמ״מ שלך? הזן אותו כאן.</Muted>
            </div>
            <Card>
              <div className="px-5 py-5 space-y-4">
                <div className="flex justify-center">
                  <div className="w-32 h-32 bg-mil-bg border-2 border-dashed border-mil-border rounded-2xl flex flex-col items-center justify-center gap-1">
                    <span className="text-3xl text-mil-ghost">▦</span>
                    <Hint>סרוק QR</Hint>
                  </div>
                </div>
                <div className="text-center">
                  <Hint>או הזן קוד ידנית</Hint>
                </div>
                <input
                  className={inp}
                  value={code}
                  onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeError(''); }}
                  placeholder="CO-1234"
                  dir="ltr"
                  autoFocus
                />
                {codeError && <Body className="text-mil-alert text-tiny">{codeError}</Body>}
                <Hint className="text-center">לדמו: CO-5108</Hint>
              </div>
            </Card>
            <Button variant="primary" size="lg" fullWidth disabled={!code.trim()} onClick={handleCodeSubmit}>
              המשך ←
            </Button>
          </>
        )}

        {/* ── STEP 2: Identity ───────────────────────────── */}
        {step === 2 && foundCompany && (
          <>
            <Card variant="muted">
              <div className="px-4 py-3">
                <CardTitle>{foundCompany.name}</CardTitle>
                {foundCompany.unitName && <Muted className="mt-0.5">{foundCompany.unitName}</Muted>}
              </div>
            </Card>

            <div>
              <PageTitle>באיזה תפקיד את/ה מצטרף/ת?</PageTitle>
              <Muted className="mt-2">בחר/י את התפקיד הקבוע שלך בפלוגה.</Muted>
            </div>

            <div className="space-y-2.5">
              <IdentityOption
                label="חייל"
                hint="התפקיד הנפוץ ביותר — תבחר/י את המחלקה ותת-הקבוצה בהמשך"
                active={identity === 'soldier'}
                onClick={() => setIdentity('soldier')}
              />
              <IdentityOption
                label="מ״מ"
                hint="מפקד מחלקה — תבחר/י את המחלקה שלך"
                active={identity === 'platoonCommander'}
                onClick={() => setIdentity('platoonCommander')}
              />
              <IdentityOption
                label="סמל"
                hint="סמל המחלקה — תבחר/י את המחלקה שלך"
                active={identity === 'platoonSergeant'}
                onClick={() => setIdentity('platoonSergeant')}
              />
              <IdentityOption
                label="סמ״פ"
                hint="סגן מ״פ — שותף לפיקוד הפלוגה"
                active={identity === 'deputyCompanyCommander'}
                onClick={() => setIdentity('deputyCompanyCommander')}
              />
            </div>

            <Button variant="primary" size="lg" fullWidth disabled={!identity} onClick={handleIdentityNext}>
              המשך ←
            </Button>
          </>
        )}

        {/* ── STEP 3: Platoon (soldier + officer) ─────────── */}
        {step === 3 && (
          <>
            <div>
              <PageTitle>{isCommanderRole ? 'איזו מחלקה את/ה מפקד/ת?' : 'לאיזו מחלקה את/ה משתייך/ת?'}</PageTitle>
            </div>
            <div className="space-y-2.5">
              {companyPlatoons.length === 0 ? (
                <Card variant="muted">
                  <Body className="px-4 py-3 text-mil-muted">לפלוגה זו עדיין אין מחלקות מוגדרות.</Body>
                </Card>
              ) : (
                companyPlatoons.map((p) => (
                  <Card key={p.id} variant={platoonId === p.id ? 'hero' : 'default'} onClick={() => setPlatoonId(p.id)}>
                    <div className="px-4 py-3.5 flex items-center gap-3">
                      <div className="flex-1">
                        <CardTitle>{p.name}</CardTitle>
                        {p.isSpecialPlatoon && <Hint className="mt-1">מיוחדת</Hint>}
                      </div>
                      {platoonId === p.id && <StatusPill status="ready">נבחר</StatusPill>}
                    </div>
                  </Card>
                ))
              )}
            </div>
            <Button variant="primary" size="lg" fullWidth disabled={!platoonId} onClick={handlePlatoonNext}>
              {isCommanderRole ? 'אישור ←' : 'המשך ←'}
            </Button>
          </>
        )}

        {/* ── STEP 4: Sub-unit (soldier only) ────────────── */}
        {step === 4 && (
          <>
            <div>
              <PageTitle>לאיזו תת-קבוצה?</PageTitle>
              <Muted className="mt-2">{platoon?.name}</Muted>
            </div>
            <div className="space-y-2.5">
              {platoonSubUnits.map((su) => (
                <Card key={su.id} variant={subUnitId === su.id ? 'hero' : 'default'} onClick={() => setSubUnitId(su.id)}>
                  <div className="px-4 py-3.5 flex items-center gap-3">
                    <CardTitle className="flex-1">{su.name}</CardTitle>
                    {subUnitId === su.id && <StatusPill status="ready">נבחר</StatusPill>}
                  </div>
                </Card>
              ))}
            </div>
            <Button variant="primary" size="lg" fullWidth disabled={!subUnitId} onClick={handleSubUnitNext}>
              המשך ←
            </Button>
          </>
        )}

        {/* ── STEP 5: Operational role (soldier only) ────── */}
        {step === 5 && platoon && (
          <>
            <div>
              <PageTitle>מה התפקיד המבצעי שלך?</PageTitle>
              <Muted className="mt-2">בחר/י תפקיד אחד. ניתן לערוך מאוחר יותר.</Muted>
            </div>
            <Card>
              <div className="px-4 py-4 flex flex-wrap gap-2">
                {platoon.availableRoles.map((r) => (
                  <button
                    key={r}
                    onClick={() => setOpRole(r)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
                      opRole === r
                        ? 'bg-mil-olive border-mil-olive text-white shadow-card-hover'
                        : 'bg-mil-bg border-mil-border text-mil-text hover:border-mil-olive'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </Card>
            <Button variant="primary" size="lg" fullWidth disabled={!opRole} onClick={handleRoleNext}>
              המשך ←
            </Button>
          </>
        )}

        {/* ── STEP 6: Leave requests (soldier only) ──────── */}
        {step === 6 && (
          <>
            <div>
              <PageTitle>בקשות יציאה</PageTitle>
              <Muted className="mt-2">האם יש לך בקשות יציאה לקרוב? תוכל לדלג ולהוסיף מאוחר יותר.</Muted>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setHasLeaves(false)}
                className={`flex-1 py-5 rounded-2xl border-2 font-bold transition-all active:scale-98 ${
                  hasLeaves === false ? 'border-mil-olive bg-mil-olive text-white' : 'border-mil-border bg-mil-card text-mil-text'
                }`}
              >
                ממשיך
              </button>
              <button
                onClick={() => setHasLeaves(true)}
                className={`flex-1 py-5 rounded-2xl border-2 font-bold transition-all active:scale-98 ${
                  hasLeaves === true ? 'border-mil-olive bg-mil-olive text-white' : 'border-mil-border bg-mil-card text-mil-text'
                }`}
              >
                יש לי בקשות
              </button>
            </div>

            {hasLeaves && (
              <Card>
                <div className="px-4 py-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="יציאה — תאריך">
                      <input type="date" className={inp} value={newLeave.startDate} onChange={(e) => setNewLeave((p) => ({ ...p, startDate: e.target.value }))} />
                    </Field>
                    <Field label="שעה">
                      <input type="time" className={inp} value={newLeave.startTime} onChange={(e) => setNewLeave((p) => ({ ...p, startTime: e.target.value }))} />
                    </Field>
                    <Field label="חזרה — תאריך">
                      <input type="date" className={inp} value={newLeave.endDate} onChange={(e) => setNewLeave((p) => ({ ...p, endDate: e.target.value }))} />
                    </Field>
                    <Field label="שעה">
                      <input type="time" className={inp} value={newLeave.endTime} onChange={(e) => setNewLeave((p) => ({ ...p, endTime: e.target.value }))} />
                    </Field>
                  </div>
                  <input className={inp} placeholder="סיבה" value={newLeave.reason} onChange={(e) => setNewLeave((p) => ({ ...p, reason: e.target.value }))} />
                  <Button variant="secondary" size="md" fullWidth disabled={!newLeave.startDate || !newLeave.endDate || !newLeave.reason} onClick={addLeave}>
                    + הוסף בקשה
                  </Button>

                  {pendingLeaves.length > 0 && (
                    <div className="space-y-1 pt-2 border-t border-mil-border">
                      {pendingLeaves.map((lv, i) => (
                        <div key={i} className="flex items-center gap-2 text-tiny text-mil-muted bg-mil-bg rounded-lg px-3 py-2">
                          <span>{lv.startDate} → {lv.endDate}</span>
                          <span className="text-mil-text mr-auto">{lv.reason}</span>
                          <button onClick={() => setLeaves((p) => p.filter((_, j) => j !== i))} className="text-mil-alert">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {hasLeaves !== null && (
              <Button variant="primary" size="lg" fullWidth onClick={handleSoldierFinish}>
                הצטרף לפלוגה ✓
              </Button>
            )}
          </>
        )}

        {/* ── STEP 7: Result ──────────────────────────────── */}
        {step === 7 && (
          submitError ? (
            <>
              <Card variant="critical">
                <div className="px-4 py-4">
                  <Body className="text-mil-alert font-bold">לא ניתן להצטרף</Body>
                  <Muted className="mt-1 text-mil-alert">{submitError}</Muted>
                </div>
              </Card>
              <Button variant="secondary" size="lg" fullWidth onClick={() => setStep(1)}>
                נסה שוב
              </Button>
            </>
          ) : (
            <>
              <div className="text-center pt-4">
                <div className="w-20 h-20 bg-mil-olive-bg border-2 border-mil-olive/40 rounded-full inline-flex items-center justify-center text-4xl text-mil-olive mb-4">✓</div>
                <PageTitle as="h1">הצטרפת בהצלחה</PageTitle>
                <Muted className="mt-2">ברוך/ה הבא/ה ל-{foundCompany?.name}.</Muted>
              </div>
              {pendingLeaves.length > 0 && (
                <Card variant="highlight">
                  <div className="px-4 py-4">
                    <Body className="text-mil-warn font-bold">בקשות שנשלחו</Body>
                    {pendingLeaves.map((lv, i) => (
                      <Muted key={i} className="text-mil-warn mt-1">• {lv.startDate}–{lv.endDate} · {lv.reason}</Muted>
                    ))}
                    <Hint className="mt-2 text-mil-warn">ממתינות לאישור המ״מ</Hint>
                  </div>
                </Card>
              )}
              <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/home')}>
                כניסה למערכת ←
              </Button>
            </>
          )
        )}

      </PageMain>
    </div>
  );
}

// ─── Small bits ───────────────────────────────────────────

function IdentityOption({ label, hint, active, onClick }: { label: string; hint: string; active: boolean; onClick: () => void }) {
  return (
    <Card variant={active ? 'hero' : 'default'} onClick={onClick}>
      <div className="px-4 py-3.5 text-right">
        <CardTitle>{label}</CardTitle>
        <Muted className="mt-1">{hint}</Muted>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-tiny text-mil-muted font-medium mb-1">{label}</label>
      {children}
    </div>
  );
}

const inp = 'w-full bg-mil-bg border border-mil-border rounded-xl px-3 py-2.5 text-sm text-mil-text focus:outline-none focus:ring-2 focus:ring-mil-olive/30 focus:border-mil-olive placeholder:text-mil-ghost';
