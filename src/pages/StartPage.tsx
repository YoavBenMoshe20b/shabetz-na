import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function StartPage() {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const firstName = currentUser?.name?.split(' ')[0] ?? '';

  return (
    <div className="min-h-screen bg-mil-bg flex flex-col items-center justify-center px-5" dir="rtl">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="text-center mb-2">
          <h1 className="text-4xl font-bold text-mil-olive tracking-widest">שבץ־נא</h1>
          <p className="text-mil-muted text-sm mt-1">
            {firstName ? `שלום, ${firstName}!` : 'ברוך הבא'}
          </p>
        </div>

        <p className="text-center text-mil-text font-medium">מה תרצה לעשות?</p>

        {/* Join existing platoon */}
        <button
          onClick={() => navigate('/join')}
          className="w-full bg-mil-card border-2 border-mil-border hover:border-mil-olive rounded-2xl p-6 text-right transition-all group"
        >
          <div className="text-4xl mb-3 text-mil-olive">◎</div>
          <h2 className="text-xl font-bold text-mil-text mb-1">הצטרף למחלקה שלך</h2>
          <p className="text-sm text-mil-muted leading-relaxed">הזן קוד הצטרפות שקיבלת מהמ״מ שלך, או סרוק QR</p>
          <div className="mt-4 flex items-center gap-2 text-mil-olive text-sm font-medium group-hover:gap-3 transition-all">
            <span>הצטרפות</span>
            <span>←</span>
          </div>
        </button>

        {/* Create new platoon */}
        <button
          onClick={() => navigate('/create')}
          className="w-full bg-mil-olive-bg border-2 border-mil-olive/30 hover:border-mil-olive rounded-2xl p-6 text-right transition-all group"
        >
          <div className="text-4xl mb-3 text-mil-olive">▦</div>
          <h2 className="text-xl font-bold text-mil-text mb-1">צור סידור למחלקה</h2>
          <p className="text-sm text-mil-muted leading-relaxed">למ״מ ולסמל — הגדר מחלקה חדשה, הכנס חיילים ובנה סידור</p>
          <div className="mt-4 flex items-center gap-2 text-mil-olive text-sm font-medium group-hover:gap-3 transition-all">
            <span>יצירה</span>
            <span>←</span>
          </div>
        </button>

        <button
          onClick={() => { /* will be handled via route guard */ }}
          className="w-full text-center text-xs text-mil-ghost py-2"
        >
          מחובר בתור: {currentUser?.name}
        </button>
      </div>
    </div>
  );
}
