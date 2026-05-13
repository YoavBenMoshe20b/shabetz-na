// Roster-first login.
//
// Two primary paths:
//   1. SIGN IN     — phone + password, for already-claimed identities
//   2. CLAIM       — phone + last-4-of-id, for first-time soldiers/officers
//                    whose slot was put on the roster by their commander
//
// Plus one demoted path at the bottom:
//   3. BOOTSTRAP CC — the only self-registration in the system,
//                     for a company commander opening a brand-new company
//
// Free-form "register an account" no longer exists.

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Card, Button, PageMain, PageTitle, CardTitle, Body, Muted, Hint } from '../components/ui';
import { validatePassword, isPasswordValid, validatePhone, validateIdLast4 } from '../services/authService';
import { mockSoldiers, mockUsers } from '../data/mockData';

type Mode = 'signIn' | 'claim' | 'bootstrap';

export default function LoginPage() {
  const { signIn, lookupClaim, claimIdentity, bootstrapCC } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('signIn');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ── SIGN IN state ────────────────────────────────────────────────
  const [siPhone, setSiPhone] = useState('');
  const [siPass,  setSiPass]  = useState('');
  const canSignIn = validatePhone(siPhone) && siPass.length > 0;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSignIn) return;
    setLoading(true); setError('');
    await new Promise((r) => setTimeout(r, 300));
    const res = signIn(siPhone, siPass);
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    navigate(res.user?.companyId ? '/home' : '/start');
  };

  // ── CLAIM state ──────────────────────────────────────────────────
  const [cPhone, setCPhone] = useState('');
  const [cId4,   setCId4]   = useState('');
  const [cReveal, setCReveal] = useState<{
    soldierName: string;
    companyName: string;
    platoonName?: string;
    requiresTransfer?: boolean;
    transferFrom?: string;
  } | null>(null);
  const [cPass,   setCPass]   = useState('');
  const [cConfirmTransfer, setCConfirmTransfer] = useState(false);
  const cPwv = useMemo(() => validatePassword(cPass), [cPass]);
  const cPwOk = isPasswordValid(cPwv);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePhone(cPhone) || !validateIdLast4(cId4)) return;
    setLoading(true); setError('');
    await new Promise((r) => setTimeout(r, 250));
    const res = lookupClaim(cPhone, cId4);
    setLoading(false);
    if (!res.ok || !res.soldier) { setError(res.error ?? 'שגיאה'); return; }
    setCReveal({
      soldierName: res.soldier.name,
      companyName: res.company?.name ?? '—',
      platoonName: res.platoon?.name,
      requiresTransfer: res.requiresTransfer,
      transferFrom: res.currentActiveCompany?.name,
    });
  };

  const handleCompleteClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cPwOk) return;
    if (cReveal?.requiresTransfer && !cConfirmTransfer) {
      setError('יש לאשר העברה לפני המשך');
      return;
    }
    setLoading(true); setError('');
    await new Promise((r) => setTimeout(r, 300));
    const res = claimIdentity(cPhone, cId4, cPass, cReveal?.requiresTransfer);
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    navigate('/home');
  };

  // ── BOOTSTRAP CC state ───────────────────────────────────────────
  const [bName,  setBName]  = useState('');
  const [bPhone, setBPhone] = useState('');
  const [bId4,   setBId4]   = useState('');
  const [bPass,  setBPass]  = useState('');
  const bPwv = useMemo(() => validatePassword(bPass), [bPass]);
  const bPwOk = isPasswordValid(bPwv);
  const canBootstrap = bName.trim().length >= 2 && validatePhone(bPhone) && validateIdLast4(bId4) && bPwOk;

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canBootstrap) return;
    setLoading(true); setError('');
    await new Promise((r) => setTimeout(r, 300));
    const res = bootstrapCC({ name: bName, phone: bPhone, idLast4: bId4, password: bPass });
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    navigate('/start');
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-mil-bg flex flex-col" dir="rtl">
      <PageMain>

        <div className="text-center pt-6">
          <h1 className="text-4xl font-extrabold text-mil-olive">שבץ־נא</h1>
          <Muted className="mt-2">מערכת מוכנות מבצעית</Muted>
        </div>

        {mode !== 'bootstrap' && (
          <Card>
            <div className="flex gap-1 p-1">
              <TabBtn active={mode === 'signIn'} onClick={() => { setMode('signIn'); setError(''); }}>
                התחברות
              </TabBtn>
              <TabBtn active={mode === 'claim'} onClick={() => { setMode('claim'); setError(''); setCReveal(null); }}>
                תביעת זהות
              </TabBtn>
            </div>
          </Card>
        )}

        {/* ── SIGN IN ─────────────────────────────────── */}
        {mode === 'signIn' && (
          <form onSubmit={handleSignIn}>
            <Card>
              <div className="px-5 py-5 space-y-4">
                <PageTitle>התחברות</PageTitle>
                <Muted>הזן/י את הטלפון והסיסמה שלך.</Muted>

                <Field label="טלפון">
                  <input className={inp} value={siPhone} onChange={(e) => setSiPhone(e.target.value)} placeholder="050-1234567" dir="ltr" inputMode="tel" />
                </Field>
                <Field label="סיסמה">
                  <input className={inp} type="password" value={siPass} onChange={(e) => setSiPass(e.target.value)} placeholder="••••••••" dir="ltr" />
                </Field>

                {error && <ErrorRow>{error}</ErrorRow>}

                <Button variant="primary" size="lg" fullWidth type="submit" disabled={!canSignIn || loading}>
                  {loading ? 'מתחבר...' : 'התחבר/י'}
                </Button>
              </div>
            </Card>
          </form>
        )}

        {/* ── CLAIM ───────────────────────────────────── */}
        {mode === 'claim' && !cReveal && (
          <form onSubmit={handleLookup}>
            <Card>
              <div className="px-5 py-5 space-y-4">
                <PageTitle>תביעת זהות</PageTitle>
                <Muted>המ״מ שלך רשם אותך לפלוגה. הזן/י את הפרטים שמסרת לו.</Muted>

                <Field label="טלפון">
                  <input className={inp} value={cPhone} onChange={(e) => setCPhone(e.target.value)} placeholder="050-1234567" dir="ltr" inputMode="tel" />
                </Field>
                <Field label='4 ספרות אחרונות בת"ז'>
                  <input className={inp} value={cId4} onChange={(e) => setCId4(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" dir="ltr" inputMode="numeric" maxLength={4} />
                </Field>

                {error && <ErrorRow>{error}</ErrorRow>}

                <Button variant="primary" size="lg" fullWidth type="submit" disabled={!validatePhone(cPhone) || !validateIdLast4(cId4) || loading}>
                  {loading ? 'מאמת...' : 'אמת/י זהות'}
                </Button>
              </div>
            </Card>
          </form>
        )}

        {/* ── CLAIM (identity reveal + set password) ───── */}
        {mode === 'claim' && cReveal && (
          <form onSubmit={handleCompleteClaim}>
            <Card variant="hero">
              <div className="px-5 py-5 space-y-4">
                <div>
                  <Hint>זוהית בהצלחה</Hint>
                  <CardTitle className="text-lg mt-1">{cReveal.soldierName}</CardTitle>
                  <Muted className="mt-1">
                    {cReveal.companyName}
                    {cReveal.platoonName && ` · ${cReveal.platoonName}`}
                  </Muted>
                </div>

                {cReveal.requiresTransfer && (
                  <Card variant="highlight">
                    <div className="px-4 py-3.5">
                      <Body className="font-bold text-mil-warn">דרושה העברה</Body>
                      <Muted className="mt-1">
                        את/ה משובץ/ת כעת בפלוגה <strong>{cReveal.transferFrom || '—'}</strong>.
                        תביעת הזהות הזו תעביר אותך לפלוגה החדשה ותסיר את שיוכך הקודם.
                      </Muted>
                      <label className="flex items-start gap-2 mt-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cConfirmTransfer}
                          onChange={(e) => setCConfirmTransfer(e.target.checked)}
                          className="w-4 h-4 accent-mil-warn mt-0.5"
                        />
                        <Body className="text-mil-warn font-semibold">אני מאשר/ת את ההעברה</Body>
                      </label>
                    </div>
                  </Card>
                )}

                <Field label="קבע/י סיסמה">
                  <input className={inp} type="password" value={cPass} onChange={(e) => setCPass(e.target.value)} placeholder="••••••••" dir="ltr" />
                </Field>
                {cPass.length > 0 && <PwRules pwv={cPwv} />}

                {error && <ErrorRow>{error}</ErrorRow>}

                <div className="flex gap-2">
                  <Button variant="secondary" size="md" fullWidth onClick={() => { setCReveal(null); setError(''); }}>
                    חזור/י
                  </Button>
                  <Button variant="primary" size="lg" fullWidth type="submit" disabled={!cPwOk || (cReveal.requiresTransfer && !cConfirmTransfer) || loading}>
                    {loading ? 'מעדכן...' : 'סיים/י תביעה'}
                  </Button>
                </div>
              </div>
            </Card>
          </form>
        )}

        {/* ── BOOTSTRAP CC ────────────────────────────── */}
        {mode === 'bootstrap' && (
          <form onSubmit={handleBootstrap}>
            <Card>
              <div className="px-5 py-5 space-y-4">
                <PageTitle>פתיחת פלוגה חדשה</PageTitle>
                <Muted>נתיב זה למ״פים בלבד. אם הוקצית כחייל או כמ״מ — עבור/י לתביעת זהות.</Muted>

                <Field label="שם מלא"><input className={inp} value={bName} onChange={(e) => setBName(e.target.value)} placeholder="שם פרטי ושם משפחה" /></Field>
                <Field label="טלפון"><input className={inp} value={bPhone} onChange={(e) => setBPhone(e.target.value)} placeholder="050-1234567" dir="ltr" inputMode="tel" /></Field>
                <Field label='4 ספרות אחרונות בת"ז'><input className={inp} value={bId4} onChange={(e) => setBId4(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" dir="ltr" inputMode="numeric" maxLength={4} /></Field>
                <Field label="סיסמה"><input className={inp} type="password" value={bPass} onChange={(e) => setBPass(e.target.value)} placeholder="••••••••" dir="ltr" /></Field>
                {bPass.length > 0 && <PwRules pwv={bPwv} />}

                {error && <ErrorRow>{error}</ErrorRow>}

                <div className="flex gap-2">
                  <Button variant="secondary" size="md" fullWidth onClick={() => { setMode('signIn'); setError(''); }}>
                    חזור/י
                  </Button>
                  <Button variant="primary" size="lg" fullWidth type="submit" disabled={!canBootstrap || loading}>
                    {loading ? 'יוצר...' : 'יצירת פלוגה'}
                  </Button>
                </div>
              </div>
            </Card>
          </form>
        )}

        {/* Bootstrap demoted link */}
        {mode !== 'bootstrap' && (
          <button
            onClick={() => { setMode('bootstrap'); setError(''); }}
            className="text-center text-tiny text-mil-muted hover:text-mil-text underline self-center pt-2"
          >
            אני מ״פ ופותח/ת פלוגה חדשה ←
          </button>
        )}

        {/* Dev panel — claimed users + the one unclaimed slot for testing */}
        <Card variant="muted">
          <div className="px-4 py-3 space-y-2">
            <Hint>משתמשי דמו · סיסמה {'Test@1234'}</Hint>
            {mockUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => { setMode('signIn'); setSiPhone(u.phone); setSiPass(u.password); setError(''); }}
                className="w-full flex items-center justify-between text-tiny bg-mil-card hover:bg-mil-card-hover rounded-lg px-3 py-2 transition-colors border border-mil-border"
              >
                <span className="text-mil-text">{u.name}</span>
                <span className="font-mono text-mil-ghost dir-ltr">{u.phone}</span>
                <span className="text-mil-olive-dim">
                  {{ companyCommander: 'מ״פ', deputyCompanyCommander: 'סמ״פ', platoonCommander: 'מ״מ', platoonSergeant: 'סמל', soldier: 'חייל', owner: 'מ״פ', manager: 'מ״מ' }[u.role]}
                </span>
              </button>
            ))}
            <Hint className="pt-2 border-t border-mil-border">רישומים פתוחים לתביעה</Hint>
            {mockSoldiers.filter((s) => s.status === 'active' && !s.userId).map((s) => (
              <button
                key={s.id}
                onClick={() => { setMode('claim'); setCPhone(s.phone); setCId4(s.idLast4); setError(''); setCReveal(null); }}
                className="w-full flex items-center justify-between text-tiny bg-mil-card hover:bg-mil-card-hover rounded-lg px-3 py-2 transition-colors border border-dashed border-mil-olive/40"
              >
                <span className="text-mil-text">{s.name}</span>
                <span className="font-mono text-mil-ghost dir-ltr">{s.phone} · {s.idLast4}</span>
                <span className="text-mil-warn">לא תבע</span>
              </button>
            ))}
          </div>
        </Card>

      </PageMain>
    </div>
  );
}

// ─── Small helpers ───────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-mil-olive text-white' : 'text-mil-muted hover:text-mil-text'}`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-tiny text-mil-muted font-medium mb-1.5 tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function ErrorRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-mil-alert-bg border border-mil-alert/40 text-mil-alert rounded-lg px-3 py-2 text-tiny">
      {children}
    </div>
  );
}

function PwRules({ pwv }: { pwv: ReturnType<typeof validatePassword> }) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {[
        { ok: pwv.minLength,  label: '8 תווים לפחות' },
        { ok: pwv.hasUpper,   label: 'אות גדולה' },
        { ok: pwv.hasLower,   label: 'אות קטנה' },
        { ok: pwv.hasNumber,  label: 'ספרה' },
        { ok: pwv.hasSpecial, label: 'תו מיוחד' },
      ].map(({ ok, label }) => (
        <span key={label} className={`text-tiny flex items-center gap-1 ${ok ? 'text-mil-success' : 'text-mil-muted'}`}>
          <span>{ok ? '✓' : '○'}</span>{label}
        </span>
      ))}
    </div>
  );
}

const inp = 'w-full bg-mil-bg border border-mil-border rounded-xl px-4 py-3 text-mil-text text-base focus:outline-none focus:ring-2 focus:ring-mil-olive/30 focus:border-mil-olive placeholder:text-mil-ghost';
