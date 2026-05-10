import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { OperationalRole, TeamClass } from '../types';

const OP_ROLES: OperationalRole[] = ['מ״פ', 'סמ״פ', 'מ״מ', 'קשר מ״מ', 'סמל', 'חובש', 'נגביסט', 'קלע', 'מאגיסט', 'רחפן'];
const TEAMS: TeamClass[]          = ['כיתה 1', 'כיתה 2', 'כיתה 3', 'מפקדה', 'אחר'];
const DEMO_CODE = 'UNIT-4821';

export default function JoinGroupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', username: '', email: '', teamClass: 'כיתה 1' as TeamClass,
    roles: [] as OperationalRole[], unavailableNote: '', code: '',
  });
  const [joined, setJoined] = useState(false);

  const toggleRole = (r: OperationalRole) =>
    setForm((f) => ({ ...f, roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r] }));

  if (joined) {
    return (
      <div className="min-h-screen bg-mil-bg flex flex-col items-center justify-center gap-4 px-6" dir="rtl">
        <span className="text-5xl text-mil-success">✓</span>
        <p className="text-xl font-bold text-mil-text">הצטרפת לקבוצה!</p>
        <p className="text-sm text-mil-muted text-center">
          {form.name}, ברוך הבא לקבוצה <span className="text-mil-sand font-mono">{form.code || DEMO_CODE}</span>
        </p>
        <button onClick={() => navigate('/login')} className="mt-4 bg-mil-olive hover:bg-mil-olive-light text-white font-bold px-8 py-3 rounded-xl transition-colors">
          כניסה למערכת
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <div className="bg-mil-surface border-b border-mil-border px-4 py-3 sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => navigate('/login')} className="text-mil-muted hover:text-mil-text text-xl">←</button>
        <span className="text-mil-sand font-bold tracking-widest">שבץ־נא</span>
        <span className="text-mil-ghost">|</span>
        <span className="text-mil-muted text-sm">הצטרפות לקבוצה</span>
      </div>

      <main className="px-4 py-5 pb-12 max-w-sm mx-auto space-y-4">

        {/* QR */}
        <div className="bg-mil-card border border-mil-border rounded-xl p-5 flex flex-col items-center gap-3">
          <div className="w-32 h-32 bg-mil-surface border-2 border-dashed border-mil-border rounded-xl flex flex-col items-center justify-center gap-1">
            <span className="text-4xl text-mil-ghost">▦</span>
            <span className="text-xs text-mil-ghost">סרוק QR</span>
          </div>
          <p className="text-xs text-mil-muted">קוד לדוגמה: <span className="font-mono text-mil-sand">{DEMO_CODE}</span></p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); setJoined(true); }} className="space-y-3">
          <Card title="פרטים אישיים">
            <Field label="שם מלא">
              <input className={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ישראל ישראלי" required />
            </Field>
            <Field label="שם משתמש (אנגלית)">
              <input className={inp} dir="ltr" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="israel99" required />
            </Field>
            <Field label="אימייל">
              <input type="email" className={inp} dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="israel@unit.il" required />
            </Field>
            <Field label="כיתה">
              <select className={inp} value={form.teamClass} onChange={(e) => setForm({ ...form, teamClass: e.target.value as TeamClass })}>
                {TEAMS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </Card>

          <Card title="תפקידים מבצעיים">
            <div className="flex flex-wrap gap-2">
              {OP_ROLES.map((r) => (
                <button key={r} type="button" onClick={() => toggleRole(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                    form.roles.includes(r)
                      ? 'bg-mil-olive border-mil-olive text-white'
                      : 'bg-mil-bg border-mil-border text-mil-muted hover:border-mil-olive/50'
                  }`}>
                  {r}
                </button>
              ))}
            </div>
          </Card>

          <Card title="זמינות">
            <Field label="איפה / מתי אינך זמין">
              <textarea
                className={`${inp} resize-none`}
                rows={2}
                value={form.unavailableNote}
                onChange={(e) => setForm({ ...form, unavailableNote: e.target.value })}
                placeholder="לדוגמה: לא זמין ביום שישי עד שבת"
              />
            </Field>
          </Card>

          <Card title="קוד קבוצה">
            <Field label="הזן קוד">
              <input className={inp} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder={DEMO_CODE} />
            </Field>
          </Card>

          <button type="submit" className="w-full bg-mil-olive hover:bg-mil-olive-light text-white font-bold py-4 rounded-xl text-base transition-colors">
            הצטרף לקבוצה
          </button>
        </form>
      </main>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-mil-card border border-mil-border rounded-xl overflow-hidden">
      <div className="bg-mil-surface border-b border-mil-border px-4 py-2">
        <p className="text-xs font-bold tracking-widest text-mil-text-inv/70">{title}</p>
      </div>
      <div className="px-4 py-3 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs text-mil-muted mb-1.5">{label}</label>{children}</div>;
}

const inp = 'w-full bg-mil-bg border border-mil-border rounded-lg px-3 py-2.5 text-sm text-mil-text focus:outline-none focus:ring-1 focus:ring-mil-olive focus:border-mil-olive placeholder:text-mil-ghost';
