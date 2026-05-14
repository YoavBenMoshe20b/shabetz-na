import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { roleAtLeast } from '../utils/permissions';
import type { MockUser, UserRole } from '../types';
import type { ReactNode } from 'react';

// A route is allowed if ANY of:
//   - the user's role is in `requiredRoles` (explicit allow-list)
//   - the user's rank is >= `minRole` (hierarchical gate)
//   - `allowWhen(user)` returns true (functional-role escape hatch — used
//      for grants that don't fit the base role hierarchy, e.g. Shalish
//      gaining read access to Report 1 without becoming a commander).
// New code should prefer `minRole` so adding roles doesn't require
// updating every route definition.

interface Props {
  children: ReactNode;
  requiredRoles?: UserRole[];
  minRole?: UserRole;
  allowWhen?: (user: MockUser) => boolean;
}

export default function ProtectedRoute({ children, requiredRoles, minRole, allowWhen }: Props) {
  const { currentUser, currentRole } = useApp();

  if (!currentUser) return <Navigate to="/login" replace />;

  const allowedByList  = requiredRoles ? requiredRoles.includes(currentRole) : false;
  const allowedByRank  = minRole       ? roleAtLeast(currentRole, minRole)   : false;
  const allowedByFn    = allowWhen     ? allowWhen(currentUser)              : false;
  const allowed        = allowedByList || allowedByRank || allowedByFn;

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 px-6 text-center" dir="rtl">
        <span className="text-4xl text-mil-alert">⊘</span>
        <p className="text-mil-text font-bold">אין הרשאה לצפייה בדף זה</p>
        <p className="text-mil-muted text-sm">זמין למפקדים בלבד</p>
      </div>
    );
  }

  return <>{children}</>;
}
