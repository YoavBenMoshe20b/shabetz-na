import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import RoleBadge from './RoleBadge';
import { roleLabel } from '../utils/permissions';
import type { UserRole } from '../types';

export default function Header({ title }: { title: string }) {
  const navigate = useNavigate();
  const { currentUser, currentRole, switchRole, logout, isOnline } = useApp();
  const [showDev, setShowDev] = useState(false);

  return (
    <header className="bg-mil-surface border-b border-mil-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <span className="text-mil-sand font-bold text-base">שבץ־נא</span>
        <span className="text-mil-ghost">|</span>
        <span className="text-mil-text-inv/70 text-sm">{title}</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Online indicator */}
        <span
          className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-mil-success' : 'bg-mil-alert'}`}
          title={isOnline ? 'מחובר' : 'לא מחובר'}
        />

        {currentUser && (
          <div className="relative">
            <button
              onClick={() => setShowDev((v) => !v)}
              className="flex items-center gap-2 text-xs bg-mil-card border border-mil-border hover:border-mil-olive px-2 py-1.5 rounded transition-colors"
            >
              <span className="text-mil-text">{currentUser.name}</span>
              <RoleBadge role={currentRole} />
            </button>

            {showDev && (
              <div className="absolute left-0 top-full mt-1 bg-mil-card border border-mil-border rounded-lg shadow-2xl p-3 min-w-[220px] z-20" dir="rtl">
                {/* User destinations */}
                <button
                  onClick={() => { navigate('/profile');   setShowDev(false); }}
                  className="block w-full text-right text-sm px-2 py-2 rounded hover:bg-mil-ghost/30 transition-colors text-mil-text"
                >
                  פרופיל ופרטים אישיים
                </button>
                <button
                  onClick={() => { navigate('/equipment'); setShowDev(false); }}
                  className="block w-full text-right text-sm px-2 py-2 rounded hover:bg-mil-ghost/30 transition-colors text-mil-text"
                >
                  ציוד אישי
                </button>
                <hr className="my-2 border-mil-border" />
                <p className="text-xs text-mil-muted mb-2 flex items-center gap-1">
                  <span className="text-mil-warn">⚙</span> כלי מפתחים — החלפת תפקיד
                </p>
                {(['companyCommander', 'platoonCommander', 'soldier'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => { switchRole(r); setShowDev(false); }}
                    className={`block w-full text-right text-sm px-2 py-2 rounded hover:bg-mil-ghost/30 transition-colors ${
                      currentRole === r ? 'text-mil-olive-light font-bold' : 'text-mil-text'
                    }`}
                  >
                    {roleLabel(r)}
                  </button>
                ))}
                <hr className="my-2 border-mil-border" />
                <button
                  onClick={() => { logout(); setShowDev(false); }}
                  className="block w-full text-right text-sm px-2 py-2 rounded text-mil-alert hover:bg-mil-alert-bg transition-colors"
                >
                  יציאה מהמערכת
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
