// App header — sticky, light, premium.
//
// Reads as discrete operational chrome: the brand wordmark sits on the
// right (RTL leading edge), the page title is the secondary breadcrumb,
// and the user chip on the left holds identity + a discreet dev menu.
// Glass surface (translucent + blur) so content scrolls behind it
// without a hard seam.

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
    <header className="bg-mil-bg/85 backdrop-blur-glass border-b border-mil-border px-5 py-3.5 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-baseline gap-2.5 min-w-0">
        <span className="text-mil-text font-bold text-base tracking-tightish">שבץ־נא</span>
        <span className="w-1 h-1 rounded-full bg-mil-ghost/70" aria-hidden />
        <span className="text-mil-muted text-tiny font-medium truncate">{title}</span>
      </div>

      <div className="flex items-center gap-2.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-mil-success' : 'bg-mil-alert'}`}
          title={isOnline ? 'מחובר' : 'לא מחובר'}
          aria-hidden
        />

        {currentUser && (
          <div className="relative">
            <button
              onClick={() => setShowDev((v) => !v)}
              className="flex items-center gap-2 text-tiny bg-mil-card border border-mil-border hover:border-mil-border-strong hover:shadow-card px-2.5 py-1.5 rounded-lg transition-all duration-200 ease-out-soft"
            >
              <span className="text-mil-text font-semibold">{currentUser.name}</span>
              <RoleBadge role={currentRole} />
            </button>

            {showDev && (
              <>
                <button
                  onClick={() => setShowDev(false)}
                  className="fixed inset-0 z-10 cursor-default"
                  aria-label="סגור"
                />
                <div
                  className="absolute left-0 top-full mt-2 bg-mil-card border border-mil-border rounded-xl-soft shadow-pop p-1.5 min-w-[240px] z-20 animate-fade-in"
                  dir="rtl"
                >
                  <DropdownItem onClick={() => { navigate('/profile');   setShowDev(false); }}>
                    פרופיל ופרטים אישיים
                  </DropdownItem>
                  <DropdownItem onClick={() => { navigate('/equipment'); setShowDev(false); }}>
                    ציוד אישי
                  </DropdownItem>

                  <Divider />
                  <DropdownLabel>החלפת תפקיד · כלי מפתחים</DropdownLabel>
                  {(['companyCommander', 'deputyCompanyCommander', 'platoonCommander', 'platoonSergeant', 'soldier'] as UserRole[]).map((r) => (
                    <DropdownItem
                      key={r}
                      onClick={() => { switchRole(r); setShowDev(false); }}
                      active={currentRole === r}
                    >
                      {roleLabel(r)}
                    </DropdownItem>
                  ))}

                  <Divider />
                  <DropdownItem
                    onClick={() => { logout(); setShowDev(false); }}
                    tone="danger"
                  >
                    יציאה מהמערכת
                  </DropdownItem>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

function DropdownItem({
  children, onClick, active = false, tone = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  tone?: 'default' | 'danger';
}) {
  const base = 'block w-full text-right text-sm px-3 py-2 rounded-lg transition-colors duration-150 ease-out-soft';
  const tones = {
    default: active
      ? 'bg-mil-olive-bg text-mil-olive font-semibold'
      : 'text-mil-text hover:bg-mil-bg-alt',
    danger:  'text-mil-alert hover:bg-mil-alert-bg',
  };
  return (
    <button onClick={onClick} className={`${base} ${tones[tone]}`}>
      {children}
    </button>
  );
}

function DropdownLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xxs font-semibold text-mil-muted tracking-wide uppercase px-3 py-1.5">
      {children}
    </p>
  );
}

function Divider() {
  return <hr className="my-1.5 border-mil-border" />;
}
