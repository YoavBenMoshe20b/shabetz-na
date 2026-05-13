// DashboardPage — thin router by role.
//
// The three variants live in src/pages/dashboards/. Each is independently
// importable + lazily loadable in the future. The router decides ONLY
// which variant to mount.
//
// Architecture: variants share widgets via dashboards/_shared/. Pure
// presentation; no cross-variant prop drilling. Each variant owns its
// data fetching (useApp + projections) so the file-level boundaries
// map cleanly to backend endpoints later: one fetch per variant.

import { useApp } from '../context/AppContext';
import { isCompanyLeadership, isPlatoonLeadership } from '../utils/permissions';

import CompanyCommanderDashboard from './dashboards/CompanyCommanderDashboard';
import PlatoonCommanderDashboard from './dashboards/PlatoonCommanderDashboard';
import SoldierDashboard          from './dashboards/SoldierDashboard';

export default function DashboardPage() {
  const { currentRole } = useApp();
  if (isCompanyLeadership(currentRole))   return <CompanyCommanderDashboard />;
  if (isPlatoonLeadership(currentRole))   return <PlatoonCommanderDashboard />;
  return <SoldierDashboard />;
}
