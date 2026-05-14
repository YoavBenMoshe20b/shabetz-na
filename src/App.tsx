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

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useApp, useOperationalEmergency } from './context/AppContext';
import { AppProviders } from './providers/AppProviders';
import { isShalish, isRasap } from './utils/permissions';
import BottomNav from './components/BottomNav';
import ProtectedRoute from './components/ProtectedRoute';
import DelegationBanner from './components/DelegationBanner';
import EscalationActiveBanner from './components/EscalationActiveBanner';
import { EmergencyBanner } from './components/ui';

// Eager — entry surfaces every authed user lands on
import LoginPage          from './pages/LoginPage';
import StartPage          from './pages/StartPage';
import DashboardPage      from './pages/DashboardPage';

// Lazy — heavier surfaces loaded on demand. Cuts the initial bundle
// substantially since these (wizard, calendar, coverage, week, detail
// pages) ship a lot of code that isn't needed for the first paint.
const CreateCompanyPage  = lazy(() => import('./pages/CreateCompanyPage'));
const SoldiersPage       = lazy(() => import('./pages/SoldiersPage'));
const SchedulePage       = lazy(() => import('./pages/SchedulePage'));
const LeavesPage         = lazy(() => import('./pages/LeavesPage'));
const ProfilePage        = lazy(() => import('./pages/ProfilePage'));
const CalendarPage       = lazy(() => import('./pages/CalendarPage'));
const MissionsPage       = lazy(() => import('./pages/MissionsPage'));
const MissionWizardPage  = lazy(() => import('./pages/MissionWizardPage'));
const MissionDetailPage  = lazy(() => import('./pages/MissionDetailPage'));
const CoveragePage       = lazy(() => import('./pages/CoveragePage'));
const PlatoonWeekPage    = lazy(() => import('./pages/PlatoonWeekPage'));
const EquipmentPage      = lazy(() => import('./pages/EquipmentPage'));
const SoldierDetailPage  = lazy(() => import('./pages/SoldierDetailPage'));
const PlatoonGapsPage    = lazy(() => import('./pages/PlatoonGapsPage'));
const DelegationsPage    = lazy(() => import('./pages/DelegationsPage'));
// Round 4
const Report1Page        = lazy(() => import('./pages/Report1Page'));
const AnnouncementsPage  = lazy(() => import('./pages/AnnouncementsPage'));
const LeaveCyclePage     = lazy(() => import('./pages/LeaveCyclePage'));
// Round 5
const AlertsPage         = lazy(() => import('./pages/AlertsPage'));
// Round 6 — Rasap / logistics module
const RasapPage              = lazy(() => import('./pages/RasapPage'));
const EquipmentInventoryPage = lazy(() => import('./pages/EquipmentInventoryPage'));
const LogisticsRotationsPage = lazy(() => import('./pages/LogisticsRotationsPage'));

// Calm Suspense fallback — single subtle skeleton so the transition
// feels intentional rather than a flash of blank.
function RouteFallback() {
  return (
    <div className="min-h-screen bg-mil-bg flex items-center justify-center" dir="rtl">
      <div className="w-1.5 h-1.5 rounded-full bg-mil-olive animate-pulse" aria-hidden />
    </div>
  );
}

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

      {/* Active escalation (הקפצה) — higher priority than DelegationBanner;
          renders only if the viewer's audience covers an active event. */}
      {currentUser && !isFullScreen && <EscalationActiveBanner />}

      {currentUser && !isFullScreen && <DelegationBanner />}

      <Suspense fallback={<RouteFallback />}>
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
        <Route path="/soldiers"    element={currentUser ? <SoldiersPage />       : auth} />
        <Route path="/soldier/:id" element={currentUser ? <SoldierDetailPage /> : auth} />
        <Route path="/profile"   element={currentUser ? <ProfilePage />   : auth} />
        <Route path="/equipment" element={currentUser ? <EquipmentPage /> : auth} />

        {/* ── Manager only ─────────────────────────── */}
        {/* רס״פ gets access to /leaves and /platoon for his מפלג scope:
            the pages themselves filter to his commandedPlatoonId so he
            sees only logistics-platoon requests / week. */}
        <Route path="/leaves" element={
          <ProtectedRoute minRole="platoonCommander" allowWhen={isRasap}><LeavesPage /></ProtectedRoute>
        } />
        <Route path="/platoon"      element={
          <ProtectedRoute minRole="platoonCommander" allowWhen={isRasap}><PlatoonWeekPage /></ProtectedRoute>
        } />
        <Route path="/platoon/gaps" element={
          <ProtectedRoute minRole="platoonCommander" allowWhen={isRasap}><PlatoonGapsPage /></ProtectedRoute>
        } />
        <Route path="/delegations" element={
          <ProtectedRoute minRole="platoonCommander"><DelegationsPage /></ProtectedRoute>
        } />

        {/* ── Company commander only ───────────────── */}
        <Route path="/missions"     element={
          <ProtectedRoute minRole="companyCommander"><MissionsPage /></ProtectedRoute>
        } />
        <Route path="/missions/new" element={
          <ProtectedRoute minRole="platoonCommander"><MissionWizardPage /></ProtectedRoute>
        } />
        <Route path="/mission/:id" element={currentUser ? <MissionDetailPage /> : auth} />
        <Route path="/coverage"     element={
          <ProtectedRoute minRole="companyCommander"><CoveragePage /></ProtectedRoute>
        } />

        {/* ── Round 4: דוח 1 + הודעות + יציאות פלוגתיות ─── */}
        {/* Report1: opens to platoon-leadership tier too; the page itself
            resolves scope (company-wide vs platoon) by role + token.
            שליש + רס״פ get read access via allowWhen (functional-role grants). */}
        <Route path="/report1"        element={
          <ProtectedRoute minRole="platoonCommander" allowWhen={(u) => isShalish(u) || isRasap(u)}>
            <Report1Page />
          </ProtectedRoute>
        } />
        {/* ── Round 5: התראות ─── */}
        {/* Alerts page opens to platoon-leadership tier AND Rasap (he
            owns logistics-driven alerts and the escalation banner now
            routes everyone here, including soldiers receiving an
            active escalation — page scopes content by viewer role). */}
        <Route path="/alerts"         element={
          <ProtectedRoute minRole="platoonCommander" allowWhen={isRasap}>
            <AlertsPage />
          </ProtectedRoute>
        } />
        {/* ── Round 6: לוגיסטיקה ורס״פ ─── */}
        {/* Rasap pages open to platoonCommander+ AND to soldiers carrying
            the רס״פ functional role (their BASE role stays 'soldier' but
            they're the logistics platoon commander). Per-page logic gates
            writes to canManageEquipment (CC + Rasap role). */}
        <Route path="/rasap"                 element={
          <ProtectedRoute minRole="platoonCommander" allowWhen={isRasap}>
            <RasapPage />
          </ProtectedRoute>
        } />
        <Route path="/equipment/inventory"   element={
          <ProtectedRoute minRole="platoonCommander" allowWhen={isRasap}>
            <EquipmentInventoryPage />
          </ProtectedRoute>
        } />
        <Route path="/rasap/rotations"       element={
          <ProtectedRoute minRole="companyCommander" allowWhen={isRasap}>
            <LogisticsRotationsPage />
          </ProtectedRoute>
        } />
        {/* Announcements: read open to everyone; create gated inside the page. */}
        <Route path="/announcements"  element={currentUser ? <AnnouncementsPage /> : auth} />
        <Route path="/leave-cycle"    element={
          <ProtectedRoute minRole="companyCommander"><LeaveCyclePage /></ProtectedRoute>
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
      </Suspense>

      {showNav && <BottomNav />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <div className="min-h-screen bg-mil-bg font-sans" dir="rtl">
          <AppRoutes />
        </div>
      </AppProviders>
    </BrowserRouter>
  );
}
