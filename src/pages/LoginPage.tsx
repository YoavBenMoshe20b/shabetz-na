// Authentication is mocked in this MVP and must be replaced with
// Firebase Auth or another secure auth provider before production.
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  validatePassword, isPasswordValid,
  validateUsername,
} from '../services/authService';
import { mockUsers } from '../data/mockData';
import { roleLabel } from '../utils/permissions';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const { login, register } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');

  // Shared
  const [touched,  setTouched]  = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPwRules, setShowPwRules] = useState(false);

  // Login fields
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');

  // Register fields
  const [regName,     setRegName]     = useState('');
  const [regEmail,    setRegEmail]    = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPw,       setRegPw]       = useState('');

  const pwTarget = mode === 'login' ? pw : regPw;
  const pwv      = useMemo(() => validatePassword(pwTarget), [pwTarget]);
  const pwOk     = isPasswordValid(pwv);

  // ── Login validation ────────────────────────────────────────────────
  const isLoginEmail = id.includes('@');
  const loginIdOk    = isLoginEmail
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)
    : validateUsername(id);
  const canLogin = loginIdOk && pwOk;

  // ── Register validation ─────────────────────────────────────────────
  const nameOk     = regName.trim().length >= 2;
  const emailOk    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim());
  const usernameOk = validateUsername(regUsername.trim());
  const canRegister = nameOk && emailOk && usernameOk && pwOk;

  // ── Handlers ───────────────────────────────────────────────────────
  const switchMode = (next: Mode) => {
    setMode(next);
    setTouched(false);
    setError('');
    setShowPwRules(false);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!canLogin) return;
    setError('');
    setLoading(true);
    await new Promise((r) => setTimeout(r, 350));
    const user = login(id.trim(), pw);
    setLoading(false);
    if (user) navigate(user.joinedGroupIds.length > 0 ? '/home' : '/start');
    else setError('שם משתמש / אימייל או סיסמה שגויים');
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!canRegister) return;
    setError('');
    setLoading(true);
    await new Promise((r) => setTimeout(r, 350));
    const result = register({
      name: regName,
      email: regEmail,
      username: regUsername,
      password: regPw,
    });
    setLoading(false);
    if (result.user) navigate('/start');
    else setError(result.error ?? 'שגיאה ביצירת המשתמש');
  };

  const quickLogin = (username: string, password: string) => {
    setMode('login');
    setId(username);
    setPw(password);
    setTouched(false);
    setError('');
  };

  // ── UI ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-mil-bg flex flex-col items-center justify-center px-5 py-8" dir="rtl">
      <div className="w-full max-w-sm">

        {/* Logotype */}
        <div className="text-center mb-6">
          <p className="text-mil-muted text-xs tracking-[0.3em] uppercase mb-2">מערכת ניהול שמירות</p>
          <h1 className="text-5xl font-bold text-mil-olive tracking-widest">שבץ־נא</h1>
          <div className="mt-3 h-px bg-gradient-to-l from-transparent via-mil-olive to-transparent" />
        </div>

        {/* Tab toggle */}
        <div className="flex gap-1 bg-mil-card border border-mil-border rounded-xl p-1 mb-3">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'login' ? 'bg-mil-olive text-white' : 'text-mil-muted hover:text-mil-text'
            }`}
          >
            התחברות
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'register' ? 'bg-mil-olive text-white' : 'text-mil-muted hover:text-mil-text'
            }`}
          >
            הרשמה
          </button>
        </div>

        {/* ── LOGIN FORM ─────────────────────────────────────────────── */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="bg-mil-card border border-mil-border rounded-2xl p-6 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-mil-muted mb-1.5 tracking-wide uppercase">
                שם משתמש או אימייל
              </label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                onFocus={() => setTouched(false)}
                placeholder="username / user@mail.com"
                dir="ltr"
                className={inpClass(touched && !loginIdOk)}
              />
              {touched && !loginIdOk && id.length > 0 && (
                <p className="text-mil-alert text-xs mt-1">
                  {isLoginEmail ? 'כתובת אימייל לא תקינה' : 'שם משתמש: לפחות 3 תווים, אותיות/ספרות באנגלית בלבד'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-mil-muted mb-1.5 tracking-wide uppercase">סיסמה</label>
              <input
                type="password"
                value={pw}
                onChange={(e) => { setPw(e.target.value); setShowPwRules(true); }}
                placeholder="••••••••"
                dir="ltr"
                className={inpClass(touched && !pwOk)}
              />
              {(showPwRules || (touched && !pwOk)) && pw.length > 0 && <PwRules pwv={pwv} />}
            </div>

            {error && (
              <div className="bg-mil-alert-bg border border-mil-alert/40 text-mil-alert rounded-lg px-4 py-2 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              onClick={() => setTouched(true)}
              disabled={loading}
              className="w-full bg-mil-olive hover:bg-mil-olive-light disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-base transition-colors mt-1 tracking-wide"
            >
              {loading ? 'מתחבר...' : 'התחברות'}
            </button>
          </form>
        )}

        {/* ── REGISTER FORM ──────────────────────────────────────────── */}
        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="bg-mil-card border border-mil-border rounded-2xl p-6 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-mil-muted mb-1.5 tracking-wide uppercase">שם מלא</label>
              <input
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="שם פרטי ושם משפחה"
                className={inpClass(touched && !nameOk)}
              />
              {touched && !nameOk && regName.length > 0 && (
                <p className="text-mil-alert text-xs mt-1">שם חייב להכיל לפחות 2 תווים</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-mil-muted mb-1.5 tracking-wide uppercase">אימייל</label>
              <input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="user@mail.com"
                dir="ltr"
                className={inpClass(touched && !emailOk)}
              />
              {touched && !emailOk && regEmail.length > 0 && (
                <p className="text-mil-alert text-xs mt-1">כתובת אימייל לא תקינה</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-mil-muted mb-1.5 tracking-wide uppercase">שם משתמש</label>
              <input
                type="text"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                placeholder="username"
                dir="ltr"
                className={inpClass(touched && !usernameOk)}
              />
              {touched && !usernameOk && regUsername.length > 0 && (
                <p className="text-mil-alert text-xs mt-1">לפחות 3 תווים, אותיות/ספרות באנגלית בלבד</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-mil-muted mb-1.5 tracking-wide uppercase">סיסמה</label>
              <input
                type="password"
                value={regPw}
                onChange={(e) => { setRegPw(e.target.value); setShowPwRules(true); }}
                placeholder="••••••••"
                dir="ltr"
                className={inpClass(touched && !pwOk)}
              />
              {(showPwRules || (touched && !pwOk)) && regPw.length > 0 && <PwRules pwv={pwv} />}
            </div>

            {error && (
              <div className="bg-mil-alert-bg border border-mil-alert/40 text-mil-alert rounded-lg px-4 py-2 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              onClick={() => setTouched(true)}
              disabled={loading}
              className="w-full bg-mil-olive hover:bg-mil-olive-light disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-base transition-colors mt-1 tracking-wide"
            >
              {loading ? 'יוצר משתמש...' : 'יצירת חשבון'}
            </button>
            <p className="text-xs text-mil-ghost text-center -mt-2">
              לאחר ההרשמה תוכל להצטרף או ליצור מחלקה
            </p>
          </form>
        )}

        {/* Dev hint panel */}
        <div className="mt-4 bg-mil-card border border-mil-border rounded-xl p-4">
          <p className="text-xs text-mil-warn mb-2 flex items-center gap-1">
            <span>⚙</span> משתמשי דמו <span className="text-mil-ghost">(כלי מפתחים)</span>
          </p>
          <div className="flex flex-col gap-1.5">
            {mockUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => quickLogin(u.username, u.password)}
                className="flex items-center justify-between text-xs text-mil-muted hover:text-mil-text bg-mil-bg hover:bg-mil-card-hover rounded-lg px-3 py-2 transition-colors border border-transparent hover:border-mil-border"
              >
                <span className="text-mil-text">{u.name}</span>
                <span className="font-mono text-mil-ghost">{u.username}</span>
                <span className="text-mil-olive-dim">
                  {u.joinedGroupIds.length === 0 ? 'חדש' : roleLabel(u.role)}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-mil-ghost mt-2 text-center">סיסמה: Test@1234</p>
        </div>
      </div>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────

function PwRules({ pwv }: { pwv: ReturnType<typeof validatePassword> }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-1">
      {[
        { ok: pwv.minLength,  label: '8 תווים לפחות' },
        { ok: pwv.hasUpper,   label: 'אות גדולה (A-Z)' },
        { ok: pwv.hasLower,   label: 'אות קטנה (a-z)' },
        { ok: pwv.hasNumber,  label: 'ספרה (0-9)' },
        { ok: pwv.hasSpecial, label: 'תו מיוחד (!@#...)' },
      ].map(({ ok, label }) => (
        <span key={label} className={`text-xs flex items-center gap-1 ${ok ? 'text-mil-success' : 'text-mil-muted'}`}>
          <span>{ok ? '✓' : '○'}</span>{label}
        </span>
      ))}
    </div>
  );
}

function inpClass(invalid: boolean): string {
  return `w-full bg-mil-bg border rounded-lg px-4 py-3 text-mil-text text-sm focus:outline-none focus:ring-1 transition-colors placeholder:text-mil-ghost ${
    invalid
      ? 'border-mil-alert focus:ring-mil-alert'
      : 'border-mil-border focus:ring-mil-olive focus:border-mil-olive'
  }`;
}
