// Final operational bottom nav.
//
//   SOLDIER         (2 tabs)   בית · פרופיל
//   PLATOON LEADER  (3 tabs)   בית · סידור · חיילים
//   COMPANY LEADER  (3 tabs)   בית · סידור · חיילים
//
// Per spec — leave-approvals are surfaced as a timeline card on the
// commander Home (with a CTA into /leaves), not as their own tab.
// Profile is reached via the avatar in the header for commanders, so
// they don't need a Profile tab — the soldier tab keeps it because
// soldier Home is the ONLY destination otherwise.

import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { isPlatoonLeadership } from '../utils/permissions';

const baseClasses     = 'flex flex-col items-center justify-center gap-0.5 flex-1 py-2.5 text-xs transition-colors border-t-2';
const activeClasses   = 'text-mil-sand border-mil-sand';
const inactiveClasses = 'text-mil-ghost border-transparent hover:text-mil-text-inv';

interface NavItem { to: string; label: string; icon: string }

const SOLDIER_ITEMS: NavItem[] = [
  { to: '/home',    label: 'בית',    icon: '◈' },
  { to: '/profile', label: 'פרופיל', icon: '○' },
];

const COMMANDER_ITEMS: NavItem[] = [
  { to: '/home',     label: 'בית',    icon: '◈' },
  { to: '/schedule', label: 'סידור',  icon: '▦' },
  { to: '/soldiers', label: 'חיילים', icon: '◉' },
];

export default function BottomNav() {
  const { currentRole } = useApp();
  const items = isPlatoonLeadership(currentRole) ? COMMANDER_ITEMS : SOLDIER_ITEMS;

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-mil-surface border-t border-mil-border flex z-10 safe-area-bottom">
      {items.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `${baseClasses} ${isActive ? activeClasses : inactiveClasses}`
          }
        >
          <span className="text-lg leading-none">{icon}</span>
          <span className="text-[10px] tracking-wide">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
