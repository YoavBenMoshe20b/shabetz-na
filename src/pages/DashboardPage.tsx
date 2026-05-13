// DashboardPage — thin router by role.
//
// Routing logic, in priority order:
//   1. Company leadership   → CompanyCommanderDashboard
//   2. Platoon leadership   → PlatoonCommanderDashboard
//   3. Rasap (functional)   → RasapDashboard (round 7)
//                              Detected via OperationalRole 'רס״פ' OR
//                              functionalRoles.includes('rasap'). A Rasap
//                              user is FIRST a soldier — their dashboard
//                              combines the soldier-spine with logistics.
//   4. Default soldier      → SoldierDashboard
//
// Each variant lives in its own file and fetches its own data so the
// file boundaries map cleanly to backend endpoints later.

import { useApp } from '../context/AppContext';
import { isCompanyLeadership, isPlatoonLeadership, isRasap } from '../utils/permissions';

import CompanyCommanderDashboard from './dashboards/CompanyCommanderDashboard';
import PlatoonCommanderDashboard from './dashboards/PlatoonCommanderDashboard';
import RasapDashboard            from './dashboards/RasapDashboard';
import SoldierDashboard          from './dashboards/SoldierDashboard';

export default function DashboardPage() {
  const { currentUser, currentRole } = useApp();
  if (isCompanyLeadership(currentRole))   return <CompanyCommanderDashboard />;
  if (isPlatoonLeadership(currentRole))   return <PlatoonCommanderDashboard />;
  // Rasap functional role on top of a plain soldier — render the
  // logistics-aware soldier variant.
  if (currentUser && isRasap(currentUser)) return <RasapDashboard />;
  return <SoldierDashboard />;
}
