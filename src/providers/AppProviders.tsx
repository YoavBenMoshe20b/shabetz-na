// AppProviders — the single root that composes every provider in order.
//
// Mount this ONCE around the app. Order matters:
//
//   1. AppContext (current monolith) — owns data state today
//   2. AuthProvider                  — reads currentUser from AppContext
//   3. OrgProvider                   — needs auth.companyId for scoping
//   4. RosterProvider                — needs auth + companyId
//   5. LeaveProvider                 — needs roster for soldier scope
//   6. AlertsProvider                — needs auth for companyId
//   7. MissionProvider               — needs auth for companyId
//   8. EquipmentProvider             — needs auth for companyId
//
// As AppContext gets gutted in Phase 3, each provider will swap its
// data source from useApp() to a React Query hook. The ORDER and the
// public API stay identical.

import { type ReactNode } from 'react';
import { AppProvider } from '../context/AppContext';
import { AuthProvider } from './AuthProvider';
import { OrgProvider } from './OrgProvider';
import { RosterProvider } from './RosterProvider';
import { LeaveProvider } from './LeaveProvider';
import { AlertsProvider } from './AlertsProvider';
import { MissionProvider } from './MissionProvider';
import { EquipmentProvider } from './EquipmentProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <AuthProvider>
        <OrgProvider>
          <RosterProvider>
            <LeaveProvider>
              <AlertsProvider>
                <MissionProvider>
                  <EquipmentProvider>
                    {children}
                  </EquipmentProvider>
                </MissionProvider>
              </AlertsProvider>
            </LeaveProvider>
          </RosterProvider>
        </OrgProvider>
      </AuthProvider>
    </AppProvider>
  );
}
