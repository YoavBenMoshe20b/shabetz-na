import { useState } from 'react';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';

const DEMO_CODE = 'UNIT-4821';

export default function MyGroupsPage() {
  const { groups, currentUser } = useApp();
  const [tab, setTab]   = useState<'list' | 'join' | 'create'>('list');
  const [joinCode, setJoinCode]   = useState('');
  const [newName, setNewName]     = useState('');
  const [newUnit, setNewUnit]     = useState('');
  const [joined, setJoined]       = useState(false);
  const [created, setCreated]     = useState(false);

  const myGroups = groups.filter((g) => currentUser && g.memberIds.includes(currentUser.id));

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="קבוצות שלי" />

      <main className="px-4 py-4 pb-28 max-w-xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-1 bg-mil-card border border-mil-border rounded-xl p-1 mb-4">
          {([['list', 'הקבוצות שלי'], ['join', 'הצטרפות'], ['create', 'יצירה']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setTab(key); setJoined(false); setCreated(false); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === key
                  ? 'bg-mil-olive text-white'
                  : 'text-mil-muted hover:text-mil-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* My groups */}
        {tab === 'list' && (
          <div className="space-y-2">
            {myGroups.length === 0 ? (
              <div className="text-center py-12 text-mil-ghost">
                <p className="text-4xl mb-3">◎</p>
                <p>לא הצטרפת לאף קבוצה</p>
                <button onClick={() => setTab('join')} className="mt-3 text-mil-olive-light hover:text-mil-sand text-sm transition-colors">
                  הצטרף לקבוצה ←
                </button>
              </div>
            ) : (
              myGroups.map((g) => (
                <div key={g.id} className="bg-mil-card border border-mil-border rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-mil-text">{g.name}</p>
                      {g.unitName && <p className="text-xs text-mil-muted">{g.unitName}</p>}
                    </div>
                    {g.ownerId === currentUser?.id && (
                      <span className="text-xs bg-mil-sand/20 text-mil-sand border border-mil-sand/40 px-2 py-0.5 rounded">בעלים</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-mil-muted">
                    <span>{g.memberIds.length} חברים</span>
                    <span className="font-mono text-mil-ghost tracking-widest">{g.code}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Join */}
        {tab === 'join' && (
          <div className="space-y-4">
            {joined ? (
              <div className="bg-mil-success-bg border border-mil-success/40 text-mil-success rounded-xl px-4 py-4 text-center">
                <p className="text-2xl mb-2">✓</p>
                <p className="font-bold">הצטרפת לקבוצה בהצלחה (דמו)</p>
              </div>
            ) : (
              <>
                {/* QR mock */}
                <div className="bg-mil-card border border-mil-border rounded-xl p-5 flex flex-col items-center gap-3">
                  <div className="w-32 h-32 bg-mil-surface border-2 border-dashed border-mil-border rounded-xl flex flex-col items-center justify-center gap-1">
                    <span className="text-4xl text-mil-ghost">▦</span>
                    <span className="text-xs text-mil-ghost">סרוק QR</span>
                  </div>
                  <p className="text-xs text-mil-muted">או הזן קוד ידנית:</p>
                </div>

                <div className="bg-mil-card border border-mil-border rounded-xl p-4 space-y-3">
                  <div>
                    <label className="block text-xs text-mil-muted mb-1.5">קוד קבוצה</label>
                    <input
                      className={inp}
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder={DEMO_CODE}
                    />
                    <p className="text-xs text-mil-ghost mt-1">לדמו השתמש: {DEMO_CODE}</p>
                  </div>
                  <button
                    onClick={() => setJoined(true)}
                    disabled={!joinCode}
                    className="w-full bg-mil-olive hover:bg-mil-olive-light disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-colors"
                  >
                    הצטרף לקבוצה
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Create */}
        {tab === 'create' && (
          <div className="space-y-3">
            {created ? (
              <div className="bg-mil-success-bg border border-mil-success/40 text-mil-success rounded-xl px-4 py-4 text-center">
                <p className="text-2xl mb-2">✓</p>
                <p className="font-bold">הקבוצה נוצרה (דמו)</p>
              </div>
            ) : (
              <div className="bg-mil-card border border-mil-border rounded-xl p-4 space-y-3">
                <div>
                  <label className="block text-xs text-mil-muted mb-1.5">שם הקבוצה</label>
                  <input className={inp} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="מחלקה א׳" />
                </div>
                <div>
                  <label className="block text-xs text-mil-muted mb-1.5">שם יחידה (אופציונלי)</label>
                  <input className={inp} value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="גדוד 51" />
                </div>
                <div className="bg-mil-bg border border-mil-border rounded-lg px-3 py-2.5 flex items-center justify-between">
                  <span className="text-xs text-mil-muted">קוד קבוצה (ייווצר אוטומטית)</span>
                  <span className="font-mono text-mil-sand text-sm">UNIT-????</span>
                </div>
                <button
                  onClick={() => setCreated(true)}
                  disabled={!newName}
                  className="w-full bg-mil-olive hover:bg-mil-olive-light disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-colors"
                >
                  צור קבוצה
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

const inp = 'w-full bg-mil-bg border border-mil-border rounded-lg px-3 py-2.5 text-sm text-mil-text focus:outline-none focus:ring-1 focus:ring-mil-olive focus:border-mil-olive placeholder:text-mil-ghost';
