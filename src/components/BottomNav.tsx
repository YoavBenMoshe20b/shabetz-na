// Floating premium bottom navigation.
//
// A white floating pill that hovers above content with a soft cast
// shadow. The active tab is an indigo-tinted slab — confident but
// quiet. Icons are simple geometric glyphs in a refined size.
//
//   SOLDIER         (3 tabs)   בית · לוח · פרופיל
//   COMMANDER       (5 tabs)   בית · לוח · שבצ״ק · דוח 1 · חיילים
//   RASAP           (5 tabs)   בית · לוח · רס״פ · מלאי · פרופיל

import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { isPlatoonLeadership, isRasap } from '../utils/permissions';

interface NavItem { to: string; label: string; icon: React.ReactNode }

// Inline icon set — SVGs scale crisply, no font dependency, and let
// us tune stroke width to match the type weight.
const stroke = 1.6;
const ICON: Record<string, React.ReactNode> = {
  home: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v10h14V10" />
    </svg>
  ),
  calendar: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17" />
      <path d="M8 3v4M16 3v4" />
    </svg>
  ),
  grid: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9.5" r="2.5" />
      <path d="M16 14c2.8 0 5 2 5 5" />
    </svg>
  ),
  user: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
    </svg>
  ),
  report1: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  ),
};

const SOLDIER_ITEMS: NavItem[] = [
  { to: '/home',     label: 'בית',    icon: ICON.home },
  { to: '/calendar', label: 'לוח',    icon: ICON.calendar },
  { to: '/profile',  label: 'פרופיל', icon: ICON.user },
];

// Commanders (CC/Deputy/PC/PS/Sergeant) see 5 tabs. דוח 1 sits between
// scheduling and roster — operational state report scoped by viewer.
const COMMANDER_ITEMS: NavItem[] = [
  { to: '/home',     label: 'בית',    icon: ICON.home },
  { to: '/calendar', label: 'לוח',    icon: ICON.calendar },
  { to: '/schedule', label: 'שבצ״ק',  icon: ICON.grid },
  { to: '/report1',  label: 'דוח 1',  icon: ICON.report1 },
  { to: '/soldiers', label: 'חיילים', icon: ICON.users },
];

// Rasap (logistics chief) — soldier-plus, with their command surface
// being logistics. Tabs anchor on inventory + lifecycle.
const RASAP_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7l8-4 8 4M4 7v10l8 4 8-4V7M4 7l8 4 8-4M12 11v10" />
  </svg>
);

const RASAP_ITEMS: NavItem[] = [
  { to: '/home',                 label: 'בית',     icon: ICON.home },
  { to: '/calendar',             label: 'לוח',     icon: ICON.calendar },
  { to: '/rasap',                label: 'רס״פ',    icon: RASAP_ICON },
  { to: '/equipment/inventory',  label: 'מלאי',    icon: ICON.grid },
  { to: '/profile',              label: 'פרופיל',  icon: ICON.user },
];

export default function BottomNav() {
  const { currentUser, currentRole } = useApp();
  // Priority: commander variant > Rasap variant > soldier variant.
  // A Rasap who is ALSO a PC keeps the commander toolbar.
  const items =
    isPlatoonLeadership(currentRole)            ? COMMANDER_ITEMS :
    currentUser && isRasap(currentUser)         ? RASAP_ITEMS     :
    SOLDIER_ITEMS;

  return (
    <nav
      className="fixed bottom-4 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:bottom-5 z-30 safe-area-bottom"
      aria-label="ניווט ראשי"
    >
      <div className="max-w-xl mx-auto bg-mil-card/90 backdrop-blur-glass-strong border border-mil-border-strong rounded-2xl-soft shadow-pop flex items-stretch p-1.5 gap-1">
        {items.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl-soft',
                'transition-all duration-200 ease-out-soft',
                isActive
                  ? 'bg-mil-olive-bg text-mil-olive'
                  : 'text-mil-muted hover:text-mil-text hover:bg-mil-bg-alt',
              ].join(' ')
            }
          >
            {icon}
            <span className="text-[10px] font-semibold tracking-wide">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
