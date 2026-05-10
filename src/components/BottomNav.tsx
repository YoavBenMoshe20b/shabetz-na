import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { canTriggerEmergency, isPlatoonLeadership } from '../utils/permissions';

const base    = 'flex flex-col items-center justify-center gap-0.5 flex-1 py-2.5 text-xs transition-colors border-t-2';
const active  = 'text-mil-sand border-mil-sand';
const inactive = 'text-mil-ghost border-transparent hover:text-mil-text-inv';

export default function BottomNav() {
  const { currentRole, hasEmergency, leaveRequests } = useApp();
  const isManager = isPlatoonLeadership(currentRole);
  const pendingRequests = leaveRequests.filter((r) => r.status === 'pending').length;

  type NavItem = { to: string; label: string; icon: string; emergency?: boolean; badge?: number };

  const managerItems: NavItem[] = [
    { to: '/dashboard', label: 'בית',    icon: '◈' },
    { to: '/schedule',  label: 'סידור',  icon: '▦' },
    { to: '/soldiers',  label: 'חיילים', icon: '◉' },
    { to: '/leaves',    label: 'יציאות', icon: '⊖', badge: pendingRequests },
    ...(canTriggerEmergency(currentRole) ? [{ to: '/emergency', label: 'בלת״מ', icon: hasEmergency ? '⚠' : '⚡', emergency: true }] : []),
  ];

  // Soldiers see only Home + Profile per the simplification spec — schedule
  // and roster are folded into Home as expandable sections, not nav targets.
  const soldierItems: NavItem[] = [
    { to: '/dashboard', label: 'בית',    icon: '◈' },
    { to: '/profile',   label: 'פרופיל', icon: '○' },
  ];

  const items = isManager ? managerItems : soldierItems;

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-mil-surface border-t border-mil-border flex z-10 safe-area-bottom">
      {items.map(({ to, label, icon, emergency, badge }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `${base} ${emergency ? 'text-mil-alert border-mil-alert' : isActive ? active : inactive} relative`
          }
        >
          <span className="text-lg leading-none">{icon}</span>
          <span className="text-[10px] tracking-wide">{label}</span>
          {badge != null && badge > 0 && (
            <span className="absolute top-1.5 right-1/2 translate-x-2 min-w-[14px] h-3.5 bg-mil-warn text-white text-[9px] rounded-full flex items-center justify-center px-0.5">
              {badge}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
