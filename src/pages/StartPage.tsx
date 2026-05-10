// First screen after auth for users with no company yet.
//
// Two paths — and ONLY two:
//   1. Join an existing company (the vast majority of users)
//   2. Create a new company (company commander / deputy only)
//
// There is no generic "create a platoon" choice anywhere in the app.
// Platoons are organisational structure inside a company, configured
// by the company commander during setup.

import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Card, PageMain, PageTitle, CardTitle, Body, Muted } from '../components/ui';

export default function StartPage() {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const firstName = currentUser?.name?.split(' ')[0] ?? '';

  return (
    <div className="min-h-screen bg-mil-bg flex flex-col" dir="rtl">
      <PageMain>
        <div className="text-center pt-8 pb-4">
          <h1 className="text-4xl font-extrabold text-mil-olive tracking-widest">שבץ־נא</h1>
          {firstName && <Muted className="mt-3">שלום, {firstName}</Muted>}
        </div>

        <div>
          <PageTitle>איך תרצה/י להתחיל?</PageTitle>
          <Muted className="mt-2">המערכת בנויה סביב פלוגה — את/ה תצטרפ/י לפלוגה קיימת, או תיצור/י אחת חדשה כמ״פ.</Muted>
        </div>

        {/* JOIN — primary path, top of the list */}
        <Card variant="hero" onClick={() => navigate('/join')}>
          <div className="px-5 py-5 text-right">
            <div className="text-3xl text-mil-olive mb-3">◎</div>
            <CardTitle className="text-lg">הצטרף לפלוגה קיימת</CardTitle>
            <Body className="text-mil-muted mt-1.5 leading-relaxed">
              קיבלת קוד מהמ״פ או מהמ״מ שלך? הצטרף כאן — תבחר/י את המחלקה ואת התפקיד שלך.
            </Body>
            <div className="mt-3 inline-flex items-center gap-2 text-mil-olive font-bold text-sm">
              <span>הצטרפות</span><span>←</span>
            </div>
          </div>
        </Card>

        {/* CREATE — secondary, with explicit gate language */}
        <Card variant="muted" onClick={() => navigate('/create')}>
          <div className="px-5 py-5 text-right">
            <div className="text-3xl text-mil-olive-dim mb-3">▦</div>
            <CardTitle className="text-lg">צור פלוגה חדשה</CardTitle>
            <Body className="text-mil-muted mt-1.5 leading-relaxed">
              למ״פ או סמ״פ בלבד. תגדיר/י את המחלקות, התת-קבוצות וכללי הפעולה.
            </Body>
            <div className="mt-3 inline-flex items-center gap-2 text-mil-olive-dim font-bold text-sm">
              <span>הקמת פלוגה</span><span>←</span>
            </div>
          </div>
        </Card>

        {currentUser && (
          <Muted className="text-center pt-2">מחובר/ת בתור: {currentUser.name}</Muted>
        )}
      </PageMain>
    </div>
  );
}
