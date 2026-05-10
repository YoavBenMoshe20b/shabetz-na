import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import type { UserRole } from '../types';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  requiredRoles: UserRole[];
}

export default function ProtectedRoute({ children, requiredRoles }: Props) {
  const { currentUser, currentRole } = useApp();

  if (!currentUser) return <Navigate to="/login" replace />;
  if (!requiredRoles.includes(currentRole)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 px-6 text-center" dir="rtl">
        <span className="text-4xl text-mil-alert">⊘</span>
        <p className="text-mil-text font-bold">אין הרשאה לצפייה בדף זה</p>
        <p className="text-mil-muted text-sm">זמין למנהלים ובעלי קבוצה בלבד</p>
      </div>
    );
  }

  return <>{children}</>;
}
