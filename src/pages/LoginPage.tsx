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
import { USE_SUPABASE } from '../api';

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
          <h1 className="text-4xl font-extrabold text-mil-olive">הפלוגה שלי</h1>
          <Muted className="mt-2">מערכת מוכנות מבצעית</Muted>
          {!USE_SUPABASE && (
            <button
              type="button"
              onClick={() => navigate('/demo-guide')}
              className="mt-2 text-tiny font-semibold text-mil-olive hover:text-mil-olive-dim"
            >
              מדריך דמו · 12 משתמשים ←
            </button>
          )}
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

            {/* Demo accounts — visible only in mock mode. In production
                (USE_SUPABASE=true) this is hidden completely. */}
            {!USE_SUPABASE && (
              <DemoAccountsPanel
                onPick={(phone: string) => {
                  setSiPhone(phone);
                  setSiPass('Test@1234');
                  setError('');
                }}
              />
            )}
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

        {/* Dev panel — collapsed by default so it doesn't dominate the
            real auth surface. Click the row to expand. */}
        <DevPanel
          onPickUser={(phone, password) => { setMode('signIn'); setSiPhone(phone); setSiPass(password); setError(''); }}
          onPickClaim={(phone, idLast4) => { setMode('claim'); setCPhone(phone); setCId4(idLast4); setError(''); setCReveal(null); }}
        />

      </PageMain>
    </div>
  );
}

// ─── Dev panel ─────────────────────────────────────────────────────────
// A focused, collapsible row. Keeps the page light by default and lets
// the developer expand when they need to switch demo users.

function DevPanel({
  onPickUser,
  onPickClaim,
}: {
  onPickUser:  (phone: string, password: string) => void;
  onPickClaim: (phone: string, idLast4: string)  => void;
}) {
  // Open by default so testers see every demo role (including רס״פ and
  // שליש) without needing to discover the expand affordance. The
  // collapsible chrome stays for when the list grows.
  const [open, setOpen] = useState(true);
  const unclaimed = useMemo(
    () => mockSoldiers.filter((s) => s.status === 'active' && !s.userId),
    [],
  );
  const roleLabel: Record<string, string> = {
    companyCommander: 'מ״פ', deputyCompanyCommander: 'סמ״פ',
    platoonCommander: 'מ״מ', platoonSergeant: 'סמל',
    soldier: 'חייל', owner: 'מ״פ', manager: 'מ״מ',
  };
  // Functional roles (רס״פ / שליש) live on `operationalRoles` while the
  // base `role` stays 'soldier'. Surface them in the dev-user picker so
  // testers can find them at a glance instead of seeing six "חייל" rows.
  const labelFor = (u: typeof mockUsers[number]) => {
    if (u.operationalRoles.includes('רס״פ'))  return 'רס״פ';
    if (u.operationalRoles.includes('שליש'))  return 'שליש';
    return roleLabel[u.role] ?? u.role;
  };
  const toneFor  = (u: typeof mockUsers[number]) => {
    if (u.operationalRoles.includes('רס״פ')) return 'text-mil-sand';
    if (u.operationalRoles.includes('שליש')) return 'text-mil-info';
    return 'text-mil-olive-dim';
  };

  return (
    <Card variant="muted">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-right"
        aria-expanded={open}
      >
        <Hint>משתמשי דמו · סיסמה Test@1234</Hint>
        <span className={`text-mil-ghost transition-transform ${open ? 'rotate-90' : ''}`}>‹</span>
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-1.5">
          {mockUsers.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => onPickUser(u.phone, u.password)}
              className="w-full flex items-center justify-between gap-2 text-tiny bg-mil-card hover:bg-mil-card-hover rounded-lg px-3 py-2 transition-colors border border-mil-border"
            >
              <span className="text-mil-text truncate">{u.name}</span>
              <span className="font-mono text-mil-ghost dir-ltr text-[11px]">{u.phone}</span>
              <span className={`font-semibold flex-shrink-0 ${toneFor(u)}`}>{labelFor(u)}</span>
            </button>
          ))}
          {unclaimed.length > 0 && (
            <>
              <Hint className="pt-2 border-t border-mil-border mt-2">פתוחים לתביעה</Hint>
              {unclaimed.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onPickClaim(s.phone, s.idLast4)}
                  className="w-full flex items-center justify-between gap-2 text-tiny bg-mil-card hover:bg-mil-card-hover rounded-lg px-3 py-2 transition-colors border border-dashed border-mil-olive/40"
                >
                  <span className="text-mil-text truncate">{s.name}</span>
                  <span className="font-mono text-mil-ghost dir-ltr text-[11px]">{s.phone} · {s.idLast4}</span>
                  <span className="text-mil-warn flex-shrink-0">לא תבע</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </Card>
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

// ─── Demo accounts panel ────────────────────────────────────────────
//
// Mock-mode helper that surfaces the seeded users so a reviewer can
// tap-to-fill instead of memorizing phones. Hidden when USE_SUPABASE
// is true. Password is always 'Test@1234' in mock mode.

function DemoAccountsPanel({ onPick }: { onPick: (phone: string) => void }) {
  const [open, setOpen] = useState(false);
  // Roles to surface in the order that walks the demo end-to-end.
  // `commands` makes the PC ↔ platoon mapping unambiguous — the reviewer
  // shouldn't have to memorise that u9 is for מחלקה 2.
  const accounts: { label: string; name: string; phone: string; commands?: string }[] = [
    { label: 'מ״פ',     name: 'יוסי כהן',   phone: '0501234567', commands: 'כל הפלוגה · חפ״ק' },
    { label: 'סמ״פ',    name: 'דנה לוי',    phone: '0507777666', commands: 'כל הפלוגה' },
    { label: 'מ״מ 1',  name: 'רוני שמש',   phone: '0502222111', commands: 'מחלקה 1' },
    { label: 'מ״מ 2',  name: 'עומר בר',    phone: '0501414141', commands: 'מחלקה 2' },
    { label: 'מ״מ 3',  name: 'יואב סער',   phone: '0501919191', commands: 'מחלקה 3' },
    { label: 'סמל 1',  name: 'ניסים דהן',  phone: '0509999888', commands: 'מחלקה 1' },
    { label: 'סמל 2',  name: 'אייל גלעד',  phone: '0501818181', commands: 'מחלקה 2' },
    { label: 'סמל 3',  name: 'שגיא ברנר',  phone: '0502121212', commands: 'מחלקה 3' },
    { label: 'רס״פ',    name: 'אבי כהן',    phone: '0502323232', commands: 'מפלג' },
    { label: 'שליש',    name: 'רון אביב',   phone: '0502424242', commands: 'מפלג · Report-1' },
    { label: 'חייל 1', name: 'משה ישראלי', phone: '0509876543', commands: 'מחלקה 1 · כיתה א' },
    { label: 'חייל 2', name: 'אורן פרץ',   phone: '0503333222', commands: 'מחלקה 1 · כיתה ב · יציאה ממתינה + ליקוי' },
  ];
  return (
    <div className="mt-3 bg-mil-card border border-mil-border rounded-xl-soft overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-right px-4 py-3 flex items-center justify-between hover:bg-mil-bg-alt transition-colors"
      >
        <span className="text-tiny font-semibold text-mil-muted tracking-wide uppercase">
          חשבונות דמו
        </span>
        <span className="text-tiny text-mil-ghost">{open ? 'הסתר' : 'הצג'} ←</span>
      </button>
      {open && (
        <div className="border-t border-mil-border bg-mil-bg-alt px-3 py-2 space-y-1">
          <Muted className="block text-tiny leading-snug pb-1">
            לחץ/י על שורה כדי למלא טלפון + סיסמה (Test@1234).
          </Muted>
          {accounts.map((a) => (
            <button
              key={a.phone}
              type="button"
              onClick={() => onPick(a.phone)}
              className="w-full text-right px-2 py-1.5 rounded-md flex items-baseline gap-2 hover:bg-mil-card transition-colors"
            >
              <span className="text-tiny font-semibold text-mil-olive min-w-[44px]">{a.label}</span>
              <span className="text-tiny font-medium text-mil-text">{a.name}</span>
              {a.commands && (
                <span className="text-tiny text-mil-olive-dim font-semibold">{a.commands}</span>
              )}
              <span className="mr-auto text-tiny font-mono tabular-nums text-mil-ghost" dir="ltr">{a.phone}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
