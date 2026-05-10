import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import BottomNav from './components/BottomNav';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage          from './pages/LoginPage';
import StartPage          from './pages/StartPage';
import JoinPlatoonPage    from './pages/JoinPlatoonPage';
import CreatePlatoonPage  from './pages/CreatePlatoonPage';
import DashboardPage      from './pages/DashboardPage';
import SoldiersPage       from './pages/SoldiersPage';
import CreateMissionPage  from './pages/CreateMissionPage';
import SchedulePage       from './pages/SchedulePage';
import EmergencyPage      from './pages/EmergencyPage';
import AuditLogPage       from './pages/AuditLogPage';
import LeavesPage         from './pages/LeavesPage';
import MyGroupsPage       from './pages/MyGroupsPage';
import ProfilePage        from './pages/ProfilePage';
import JoinGroupPage      from './pages/JoinGroupPage';
import OfflinePage        from './pages/OfflinePage';
import OnboardingPage     from './pages/OnboardingPage';
import ReportPage         from './pages/ReportPage';

// Routes where the bottom nav is hidden (full-screen onboarding flows)
const FULL_SCREEN_PATHS = ['/login', '/start', '/join-platoon', '/create-platoon', '/onboarding', '/join'];

function AppRoutes() {
  const { currentUser, groups } = useApp();
  const location = useLocation();
  const auth = <Navigate to="/login" replace />;
  const hasGroup = !!currentUser && groups.some((g) => g.memberIds.includes(currentUser.id));
  const showNav = currentUser && !FULL_SCREEN_PATHS.includes(location.pathname);

  return (
    <>
      <Routes>
        {/* Public */}
        <Route path="/login" element={
          currentUser
            ? <Navigate to={hasGroup ? '/dashboard' : '/start'} replace />
            : <LoginPage />
        } />
        <Route path="/join" element={<JoinGroupPage />} />

        {/* Onboarding choice — requires login but no group */}
        <Route path="/start"           element={currentUser ? <StartPage />          : auth} />
        <Route path="/join-platoon"    element={currentUser ? <JoinPlatoonPage />    : auth} />
        <Route path="/create-platoon"  element={currentUser ? <CreatePlatoonPage />  : auth} />
        <Route path="/onboarding"      element={<OnboardingPage />} />

        {/* Authenticated — require both login AND a group */}
        <Route path="/dashboard" element={
          !currentUser ? auth : !hasGroup ? <Navigate to="/start" replace /> : <DashboardPage />
        } />
        <Route path="/soldiers"  element={currentUser ? <SoldiersPage />  : auth} />
        <Route path="/schedule"  element={currentUser ? <SchedulePage />  : auth} />
        <Route path="/groups"    element={currentUser ? <MyGroupsPage />  : auth} />
        <Route path="/profile"   element={currentUser ? <ProfilePage />   : auth} />
        <Route path="/offline"   element={currentUser ? <OfflinePage />   : auth} />

        {/* Manager / Owner only */}
        <Route path="/create-mission" element={
          <ProtectedRoute requiredRoles={['owner', 'manager']}><CreateMissionPage /></ProtectedRoute>
        } />
        <Route path="/report" element={
          <ProtectedRoute requiredRoles={['owner', 'manager']}><ReportPage /></ProtectedRoute>
        } />
        <Route path="/leaves" element={
          <ProtectedRoute requiredRoles={['owner', 'manager']}><LeavesPage /></ProtectedRoute>
        } />
        <Route path="/emergency" element={
          <ProtectedRoute requiredRoles={['owner', 'manager']}><EmergencyPage /></ProtectedRoute>
        } />
        <Route path="/audit-log" element={
          <ProtectedRoute requiredRoles={['owner', 'manager']}><AuditLogPage /></ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to={currentUser ? (hasGroup ? '/dashboard' : '/start') : '/login'} replace />} />
      </Routes>

      {showNav && <BottomNav />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <div className="min-h-screen bg-mil-bg font-sans" dir="rtl">
          <AppRoutes />
        </div>
      </AppProvider>
    </BrowserRouter>
  );
}
