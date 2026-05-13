// Final operational route map. Anything reachable in <2 taps from Home
// is NOT a route — it's a card or a modal. The shape:
//
//   PUBLIC
//     /login        identity tabs
//
//   ONBOARDING (authed but no group)
//     /start        join existing / create new
//     /join         multi-step join wizard       (was /join-platoon)
//     /create       multi-step create wizard      (was /create-platoon)
//
//   AUTHED + group
//     /home         role-adaptive operational Home   ← was /dashboard
//     /schedule     period hub + mission editor + slot override
//     /soldiers     roster (filterable)
//     /profile      identity + leave-request submit (soldier)
//
//   MANAGER ONLY
//     /leaves       full leave queue (also reached from Home timeline card)
//
// Removed from the route map: /report, /groups, /audit-log, /emergency,
// /create-mission, /onboarding, /offline, legacy /join. Their content
// either lives in /home now (report → company stats; emergency → banner;
// audit-log → /home alerts feed) or is reached via wizard inside another
// flow (create-mission → SchedulePage modal). Old URLs redirect to /home.

import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AppProvider, useApp, useOperationalEmergency } from './context/AppContext';
import BottomNav from './components/BottomNav';
import ProtectedRoute from './components/ProtectedRoute';
import { EmergencyBanner } from './components/ui';

import LoginPage          from './pages/LoginPage';
import StartPage          from './pages/StartPage';
import CreateCompanyPage  from './pages/CreateCompanyPage';
import DashboardPage      from './pages/DashboardPage';   // renders the Home variants
import SoldiersPage       from './pages/SoldiersPage';
import SchedulePage       from './pages/SchedulePage';
import LeavesPage         from './pages/LeavesPage';
import ProfilePage        from './pages/ProfilePage';
import CalendarPage       from './pages/CalendarPage';

// Full-screen flows hide the bottom nav AND the emergency banner so
// new-user wizards aren't competing with operational signals.
const FULL_SCREEN_PATHS = ['/login', '/start', '/create'];

function AppRoutes() {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const emergency = useOperationalEmergency();
  const auth = <Navigate to="/login" replace />;

  const hasPlatoon       = !!currentUser && (!!currentUser.platoonId || !!currentUser.companyId);
  const isFullScreen   = FULL_SCREEN_PATHS.includes(location.pathname);
  const showNav        = currentUser && !isFullScreen;
  const showEmergency  = !!emergency && !!currentUser && !isFullScreen;

  return (
    <>
      {showEmergency && (
        <EmergencyBanner
          message={emergency!.message}
          detail={emergency!.detail}
          actionLabel={emergency!.actionLabel}
          onAction={emergency!.actionHref ? () => navigate(emergency!.actionHref!) : undefined}
        />
      )}

      <Routes>
        {/* ── Public ────────────────────────────────── */}
        <Route path="/login" element={
          currentUser
            ? <Navigate to={hasPlatoon ? '/home' : '/start'} replace />
            : <LoginPage />
        } />

        {/* ── Onboarding (authed but no group) ─────── */}
        <Route path="/start"   element={currentUser ? <StartPage />          : auth} />
        <Route path="/create"  element={currentUser ? <CreateCompanyPage />  : auth} />

        {/* /join is deprecated under the roster-first model — joining means claiming */}
        <Route path="/join"    element={<Navigate to="/login" replace />} />

        {/* ── Authed + has a group ─────────────────── */}
        <Route path="/home" element={
          !currentUser ? auth : !hasPlatoon ? <Navigate to="/start" replace /> : <DashboardPage />
        } />
        <Route path="/calendar" element={
          !currentUser ? auth : !hasPlatoon ? <Navigate to="/start" replace /> : <CalendarPage />
        } />
        <Route path="/schedule" element={currentUser ? <SchedulePage /> : auth} />
        <Route path="/soldiers" element={currentUser ? <SoldiersPage /> : auth} />
        <Route path="/profile"  element={currentUser ? <ProfilePage />  : auth} />

        {/* ── Manager only ─────────────────────────── */}
        <Route path="/leaves" element={
          <ProtectedRoute minRole="platoonCommander"><LeavesPage /></ProtectedRoute>
        } />

        {/* ── Legacy redirects (so old links don't 404) ── */}
        <Route path="/dashboard"      element={<Navigate to="/home"  replace />} />
        <Route path="/join-platoon"   element={<Navigate to="/login" replace />} />
        <Route path="/create-platoon" element={<Navigate to="/create" replace />} />
        <Route path="/report"         element={<Navigate to="/home"  replace />} />
        <Route path="/groups"         element={<Navigate to="/home"  replace />} />
        <Route path="/audit-log"      element={<Navigate to="/home"  replace />} />
        <Route path="/emergency"      element={<Navigate to="/home"  replace />} />
        <Route path="/create-mission" element={<Navigate to="/schedule" replace />} />
        <Route path="/onboarding"     element={<Navigate to="/start" replace />} />
        <Route path="/offline"        element={<Navigate to="/home"  replace />} />

        <Route path="*" element={
          <Navigate to={currentUser ? (hasPlatoon ? '/home' : '/start') : '/login'} replace />
        } />
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
