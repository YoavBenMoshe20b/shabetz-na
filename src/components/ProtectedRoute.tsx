import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { roleAtLeast } from '../utils/permissions';
import type { UserRole } from '../types';
import type { ReactNode } from 'react';

// A route is allowed if EITHER:
//   - the user's role is in `requiredRoles` (explicit allow-list), OR
//   - the user's rank is >= `minRole` (hierarchical gate).
// New code should prefer `minRole` so adding roles doesn't require
// updating every route definition.

interface Props {
  children: ReactNode;
  requiredRoles?: UserRole[];
  minRole?: UserRole;
}

export default function ProtectedRoute({ children, requiredRoles, minRole }: Props) {
  const { currentUser, currentRole } = useApp();

  if (!currentUser) return <Navigate to="/login" replace />;

  const allowedByList  = requiredRoles ? requiredRoles.includes(currentRole) : false;
  const allowedByRank  = minRole       ? roleAtLeast(currentRole, minRole)   : false;
  const allowed        = allowedByList || allowedByRank;

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
