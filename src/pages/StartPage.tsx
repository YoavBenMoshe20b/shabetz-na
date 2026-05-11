// Post-bootstrap landing.
//
// Under the roster-first model, anyone who reaches /start authenticated has
// just bootstrapped as a company commander — they registered themselves
// because no roster exists for them yet. Their only next action is to
// create their company. Soldiers and officers never see this screen:
// they go through claim and land directly on /home.

import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Card, Button, PageMain, PageTitle, CardTitle, Body, Muted } from '../components/ui';

export default function StartPage() {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const firstName = currentUser?.name?.split(' ')[0] ?? '';

  return (
    <div className="min-h-screen bg-mil-bg flex flex-col" dir="rtl">
      <PageMain>

        <div className="text-center pt-6">
          <h1 className="text-3xl font-extrabold text-mil-olive tracking-widest">שבץ־נא</h1>
          {firstName && <Muted className="mt-2">שלום, {firstName}</Muted>}
        </div>

        <div className="pt-2">
          <PageTitle>הצעד הבא: פתיחת הפלוגה</PageTitle>
          <Muted className="mt-2">
            תגדיר/י את המבנה: מחלקות, כיתות, מ״מים וסמלים. בסיום תקבל/י קוד פלוגה שאיתו
            המ״מים יתבעו את זהותם, ומשם הם ירשמו את חייליהם.
          </Muted>
        </div>

        <Card variant="hero" onClick={() => navigate('/create')}>
          <div className="px-5 py-5 text-right">
            <CardTitle className="text-lg">פתיחת הפלוגה כמ״פ</CardTitle>
            <Body className="text-mil-muted mt-2 leading-relaxed">
              אשף קצר של ~4 שלבים. תוכל/י לערוך הכל מאוחר יותר.
            </Body>
            <div className="mt-4 inline-flex items-center gap-2 text-mil-olive font-bold text-sm">
              <span>התחל/י</span><span>←</span>
            </div>
          </div>
        </Card>

        <Card variant="muted">
          <div className="px-4 py-3.5">
            <Body className="text-mil-muted leading-relaxed">
              <strong className="text-mil-text">לא מ״פ?</strong> תביעת זהות נעשית מסך ההתחברות
              עם הטלפון ו-4 ספרות אחרונות בת״ז שמסרת למ״פ או למ״מ.
            </Body>
            <div className="mt-3">
              <Button variant="secondary" size="sm" onClick={() => navigate('/login')}>
                חזרה למסך ההתחברות
              </Button>
            </div>
          </div>
        </Card>

      </PageMain>
    </div>
  );
}
