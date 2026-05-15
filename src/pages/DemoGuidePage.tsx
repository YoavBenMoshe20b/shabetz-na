// DemoGuidePage — in-app reviewer walkthrough.
//
// Tells the reviewer who to log in as, what to test with that user,
// the route to verify, and the expected result. One-stop reference so
// no one has to remember "which user is for which platoon".
//
// Reachable from:
//   • LoginPage → "מדריך דמו ←"
//   • UserSwitcher → "מדריך דמו"
//   • Direct route /demo-guide

import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import {
  Eyebrow, Section, PageMain, PageTitle, Body, Muted, Hint,
} from '../components/ui';

interface DemoUser {
  role: string;
  name: string;
  phone: string;
  unit: string;
  whatToTest: string;
  route: string;
  expected: string;
}

const DEMO_USERS: DemoUser[] = [
  {
    role: 'מ״פ',
    name: 'יוסי כהן',
    phone: '0501234567',
    unit: 'חפ״ק',
    whatToTest: 'יצירת משימה · ניהול שיבוצים · מבנה חפ״ק / מפלג · יציאות וכיסוי',
    route: '/home → /missions → /missions/new',
    expected: 'FocusSection + שורת מחלקות (g1/g2/g3) + קיצורי דרך · בלי באנר עליון',
  },
  {
    role: 'סמ״פ',
    name: 'דנה לוי',
    phone: '0507777666',
    unit: 'חפ״ק',
    whatToTest: 'דאשבורד מ״פ מלא · מאשר חריגות · יוצר משימה',
    route: '/home',
    expected: 'אותה תמונת מ״פ · ללא הענקת ייפויי כוח',
  },
  {
    role: 'מ״מ',
    name: 'רוני שמש',
    phone: '0502222111',
    unit: 'מחלקה 1',
    whatToTest: 'שבצ״ק g1 (מי-גייט-נורת + מי-נייט-פטרול) · איוש משבצת · אישור יציאה של u14',
    route: '/home → "שבצ״ק המחלקה" → /platoon',
    expected: '7 ימים, משבצות g1, כפתור "אייש" על משבצת חסרה',
  },
  {
    role: 'מ״מ',
    name: 'עומר בר',
    phone: '0501414141',
    unit: 'מחלקה 2',
    whatToTest: 'שבצ״ק g2 (מי-גייט-סאות׳) · איוש · 20 חיילים',
    route: '/home → "שבצ״ק המחלקה" → /platoon',
    expected: 'משבצות שונות מ-g1, כפתור "אייש"',
  },
  {
    role: 'מ״מ',
    name: 'יואב סער',
    phone: '0501919191',
    unit: 'מחלקה 3',
    whatToTest: 'שבצ״ק g3 (מי-רידינס-איסט 08-20) · איוש · 20 חיילים',
    route: '/home → "שבצ״ק המחלקה" → /platoon',
    expected: 'משבצות 08:00-20:00, צוות g3',
  },
  {
    role: 'סמל',
    name: 'ניסים דהן',
    phone: '0509999888',
    unit: 'מחלקה 1',
    whatToTest: 'אישור יציאות · הערות מחלקה · ליקויים בכיתה',
    route: '/home → /leaves → /platoon/gaps',
    expected: 'אותו דאשבורד כמו מ״מ · platoon leadership tokens',
  },
  {
    role: 'סמל',
    name: 'אייל גלעד',
    phone: '0501818181',
    unit: 'מחלקה 2',
    whatToTest: 'אישור יציאות · הערות g2',
    route: '/home → /leaves',
    expected: 'בקשות g2 ממתינות (אם יש)',
  },
  {
    role: 'סמל',
    name: 'שגיא ברנר',
    phone: '0502121212',
    unit: 'מחלקה 3',
    whatToTest: 'אישור יציאות · הערות g3',
    route: '/home → /leaves',
    expected: 'בקשות g3 ממתינות (אם יש)',
  },
  {
    role: 'רס״פ',
    name: 'אבי כהן',
    phone: '0502323232',
    unit: 'מפלג',
    whatToTest: 'תור ליקויים · סיכומי מידות · המפלג שלי · החתמת ציוד · הודעות לוגיסטיות',
    route: '/home → /rasap → /platoon/g-meflag/structure',
    expected: 'דאשבורד רס״פ מלא · "המפלג שלי · 6" · רואה ליקוי של u14',
  },
  {
    role: 'סרס״פ',
    name: 'יואב מורן',
    phone: '0507311111',
    unit: 'מפלג',
    whatToTest: 'סגן רס״פ · סטטוס מפלג · גישה לתפקודי לוגיסטיקה',
    route: '/home',
    expected: 'דאשבורד חייל בסיסי + functionalRoles.srasap',
  },
  {
    role: 'שליש',
    name: 'רון אביב',
    phone: '0502424242',
    unit: 'מפלג',
    whatToTest: 'דוח 1 · סד״כ פלוגתי · מי בבית / בבסיס · רישומי כ״א',
    route: '/home → /report1',
    expected: 'דאשבורד חייל + Report-1 read access (canViewReport1)',
  },
  {
    role: 'חייל 1',
    name: 'משה ישראלי',
    phone: '0509876543',
    unit: 'מחלקה 1 · כיתה א',
    whatToTest: 'משמרת קרובה · שבוע אישי · בקשת יציאה · דיווח בלאי',
    route: '/home',
    expected: 'SoldierDashboard · משובץ למי-גייט-נורת (אוטומטית) · שותפים גלויים',
  },
  {
    role: 'חייל 2',
    name: 'אורן פרץ',
    phone: '0503333222',
    unit: 'מחלקה 1 · כיתה ב',
    whatToTest: 'בקשת יציאה pending · ליקוי ציוד פתוח · עומס גבוה (currentLoad=3)',
    route: '/home → /leaves → /equipment',
    expected: 'בקשה ל-21-23/5 ממתינה · ליקוי "מימייה" פתוח · המנוע יעדיף חיילים אחרים עליו',
  },
];

export default function DemoGuidePage() {
  const navigate = useNavigate();
  const { switchUser, users } = useApp();

  const trySignIn = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const u = users.find((x) => x.phone.replace(/\D/g, '') === cleanPhone);
    if (u) {
      switchUser(u.id);
      navigate('/home');
    }
  };

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="מדריך דמו" />
      <PageMain>
        <header>
          <Eyebrow>הדרכת בודק</Eyebrow>
          <PageTitle className="mt-1">מי בודק מה</PageTitle>
          <Muted className="mt-2 leading-relaxed">
            12 פרסונות מבצעיות. כל אחת מדגימה תפקיד אחר במערכת. לחיצה על שורה תחליף משתמש ותעבור ל-/home.
            כל הסיסמאות זהות: <code className="font-mono text-mil-text">Test@1234</code>.
          </Muted>
        </header>

        <Section label={`משתמשי דמו · ${DEMO_USERS.length}`}>
          <div className="bg-mil-card border border-mil-border rounded-2xl divide-y divide-mil-border overflow-hidden">
            {DEMO_USERS.map((u, i) => (
              <DemoUserRow key={i} u={u} onClick={() => trySignIn(u.phone)} />
            ))}
          </div>
        </Section>

        <Section label="זרימת בדיקה מומלצת">
          <ol className="bg-mil-card border border-mil-border rounded-xl-soft px-5 py-4 space-y-2 list-decimal mr-5">
            <li className="text-sm leading-relaxed text-mil-text">
              <strong>היכנס כ-מ״פ</strong> — צור משימה חדשה דרך <code className="font-mono">/missions/new</code>, וודא שהיא רשומה.
            </li>
            <li className="text-sm leading-relaxed text-mil-text">
              <strong>החלף ל-מ״מ של המחלקה שאליה הגדרת את המשימה</strong> — לחץ "שבצ״ק המחלקה" בדאשבורד.
            </li>
            <li className="text-sm leading-relaxed text-mil-text">
              <strong>אייש את המשבצת</strong> — בחר חיילים מ-StaffingSheet, וודא שיש confidence + decay reasons + why-not.
            </li>
            <li className="text-sm leading-relaxed text-mil-text">
              <strong>החלף לחייל ששובץ</strong> — וודא שהוא רואה את המשמרת ב-"השבוע שלי".
            </li>
            <li className="text-sm leading-relaxed text-mil-text">
              <strong>חזור ל-מ״פ</strong> — וודא שבעמוד המשימה (<code className="font-mono">/mission/:id</code>) מופיעה "היסטוריית שיבוץ".
            </li>
            <li className="text-sm leading-relaxed text-mil-text">
              <strong>היכנס כ-רס״פ</strong> — בדוק "המפלג שלי", "תור ליקויים" (יש שם הליקוי של u14), סיכומי מידות.
            </li>
            <li className="text-sm leading-relaxed text-mil-text">
              <strong>היכנס כ-שליש</strong> — וודא גישה ל-<code className="font-mono">/report1</code>.
            </li>
          </ol>
        </Section>

        <Section label="הערות">
          <ul className="bg-mil-card border border-mil-border rounded-xl-soft px-5 py-4 space-y-1.5 text-sm leading-relaxed text-mil-muted list-disc mr-5">
            <li>אין באנר עליון אדום/ורוד בשום מסך. התראות בפעמון או ב-AlertsPage.</li>
            <li>איפוס נתוני דמו: UserSwitcher → "איפוס נתוני דמו" (מנקה localStorage ומחזיר seed).</li>
            <li>כל ה-persistence עכשיו ב-localStorage. הגירת ה-flag ל-Supabase מצריכה <code className="font-mono">VITE_USE_SUPABASE=true</code> ב-Vercel.</li>
            <li>UserSwitcher בכותרת מאפשר מעבר בין משתמשים תוך כדי סשן (בלי re-auth).</li>
          </ul>
        </Section>
      </PageMain>
    </div>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────

function DemoUserRow({ u, onClick }: { u: DemoUser; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-right px-5 py-3.5 hover:bg-mil-card-hover transition-colors"
    >
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-sm font-bold text-mil-olive min-w-[56px]">{u.role}</span>
        <Body className="font-semibold">{u.name}</Body>
        <Hint className="text-mil-muted">· {u.unit}</Hint>
        <span className="mr-auto font-mono tabular-nums text-mil-ghost text-tiny" dir="ltr">{u.phone}</span>
      </div>
      <Hint className="block mt-1.5 text-mil-text leading-snug">
        <span className="font-semibold text-mil-muted">מה לבדוק:</span> {u.whatToTest}
      </Hint>
      <Hint className="block mt-0.5 text-mil-muted leading-snug">
        <span className="font-semibold">מסלול:</span> <code className="font-mono text-mil-text">{u.route}</code>
      </Hint>
      <Hint className="block mt-0.5 text-mil-muted leading-snug">
        <span className="font-semibold">תוצאה צפויה:</span> {u.expected}
      </Hint>
    </button>
  );
}
