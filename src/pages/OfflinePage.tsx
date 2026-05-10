import { useApp } from '../context/AppContext';
import Header from '../components/Header';

export default function OfflinePage() {
  const { isOnline } = useApp();

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="מצב חיבור" />

      <main className="px-4 py-10 pb-28 max-w-xl mx-auto flex flex-col items-center gap-6">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl border-2 ${
          isOnline ? 'bg-mil-success-bg border-mil-success/50 text-mil-success' : 'bg-mil-alert-bg border-mil-alert/50 text-mil-alert'
        }`}>
          {isOnline ? '◉' : '◌'}
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold text-mil-text mb-2">
            {isOnline ? 'המערכת מחוברת' : 'מצב לא מקוון'}
          </h2>
          <p className="text-mil-muted text-sm leading-relaxed max-w-xs">
            {isOnline
              ? 'כל הנתונים מסונכרנים. ניתן לבצע את כל הפעולות.'
              : 'במצב לא מקוון ניתן לראות סידור ולעדכן נתונים אישיים. פעולות ניהול יישמרו מקומית ויסונכרנו בהמשך.'}
          </p>
        </div>

        <div className="w-full bg-mil-card border border-mil-border rounded-xl overflow-hidden">
          <div className="bg-mil-surface border-b border-mil-border px-4 py-2">
            <p className="text-xs font-bold tracking-widest text-mil-text-inv/70">מצב לא מקוון — מה אפשרי?</p>
          </div>
          <div className="px-4 py-3 space-y-2">
            {[
              { ok: true,  label: 'צפייה בשיבוץ המפורסם' },
              { ok: true,  label: 'עדכון זמינות אישית' },
              { ok: true,  label: 'עדכון מגבלות ומיקום' },
              { ok: false, label: 'עריכת טיוטת שיבוץ (יסונכרן עם חיבור)' },
              { ok: false, label: 'הפעלת בלת״מ (יסונכרן עם חיבור)' },
              { ok: false, label: 'פרסום שיבוץ (נדרש חיבור)' },
            ].map(({ ok, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm">
                <span className={ok ? 'text-mil-success' : 'text-mil-muted'}>
                  {ok ? '✓' : '⏳'}
                </span>
                <span className={ok ? 'text-mil-text' : 'text-mil-muted'}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
