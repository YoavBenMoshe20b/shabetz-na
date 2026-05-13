// Floating glass bottom navigation.
//
// Premium operational chrome: a discrete pill that floats above content,
// rounded geometry, soft glass surface, accent-tinted active state. Reads
// as "navigation" without ever shouting for attention.
//
//   SOLDIER         (3 tabs)   בית · לוח · פרופיל
//   PLATOON LEADER  (4 tabs)   בית · לוח · שבצ״ק · חיילים
//   COMPANY LEADER  (4 tabs)   בית · לוח · שבצ״ק · חיילים
//
// Leave-approvals are surfaced as a timeline card on commander Home (with
// a CTA into /leaves), not their own tab. Profile lives in the header
// avatar for commanders.

import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { isPlatoonLeadership } from '../utils/permissions';

interface NavItem { to: string; label: string; icon: string }

const SOLDIER_ITEMS: NavItem[] = [
  { to: '/home',     label: 'בית',    icon: '◈' },
  { to: '/calendar', label: 'לוח',    icon: '▤' },
  { to: '/profile',  label: 'פרופיל', icon: '○' },
];

const COMMANDER_ITEMS: NavItem[] = [
  { to: '/home',     label: 'בית',    icon: '◈' },
  { to: '/calendar', label: 'לוח',    icon: '▤' },
  { to: '/schedule', label: 'שבצ״ק',  icon: '▦' },
  { to: '/soldiers', label: 'חיילים', icon: '◉' },
];

export default function BottomNav() {
  const { currentRole } = useApp();
  const items = isPlatoonLeadership(currentRole) ? COMMANDER_ITEMS : SOLDIER_ITEMS;

  return (
    <nav
      className="fixed bottom-3 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:bottom-5 z-30 safe-area-bottom"
      aria-label="ניווט ראשי"
    >
      <div className="max-w-xl mx-auto bg-mil-bg-alt/85 backdrop-blur-glass border border-mil-border-strong rounded-2xl shadow-pop flex items-stretch p-1.5 gap-1">
        {items.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl-soft',
                'transition-all duration-200 ease-out-soft',
                isActive
                  ? 'bg-mil-olive-bg text-mil-olive-light'
                  : 'text-mil-muted hover:text-mil-text hover:bg-mil-card-hover/50',
              ].join(' ')
            }
          >
            <span className="text-base leading-none">{icon}</span>
            <span className="text-[10px] font-semibold tracking-wide">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
