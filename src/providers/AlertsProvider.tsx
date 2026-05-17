/* eslint-disable react-refresh/only-export-components -- co-locating hooks with their Provider is intentional */
// AlertsProvider — operational alerts + announcements + escalations.
//
// Three related streams the user typically sees together:
//   1. Operational override alerts (engine-generated)
//   2. Announcements (CC/PC broadcast)
//   3. Escalation events (status-driven, can be a banner)

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { OverrideAlert, Announcement, EscalationEvent, Acknowledgement } from '../types';
import { useApp, useAlertsForCompany } from '../context/AppContext';
import { useAuth } from './AuthProvider';

export interface AlertsApi {
  overrideAlerts: OverrideAlert[];
  announcements:  Announcement[];
  escalations:    EscalationEvent[];

  /** Unread / active alerts for the current user. */
  myActiveAlerts: ReturnType<typeof useAlertsForCompany>;

  acknowledgeAlert: ReturnType<typeof useApp>['acknowledgeAlert'];
  resolveAlert:     ReturnType<typeof useApp>['resolveAlert'];

  /** Announcement mutations. */
  addAnnouncement:        ReturnType<typeof useApp>['addAnnouncement'];
  updateAnnouncement:     ReturnType<typeof useApp>['updateAnnouncement'];
  closeAnnouncement:      ReturnType<typeof useApp>['closeAnnouncement'];
  deleteAnnouncement:     ReturnType<typeof useApp>['deleteAnnouncement'];

  /** §10 — acknowledgements (אישור קבלה) for critical announcements. */
  acknowledgements:       Acknowledgement[];
  acknowledgeAnnouncement: ReturnType<typeof useApp>['acknowledgeAnnouncement'];

  /** Escalation mutations. */
  declareEscalation: ReturnType<typeof useApp>['declareEscalation'];
  closeEscalation:   ReturnType<typeof useApp>['closeEscalation'];
}

const AlertsCtx = createContext<AlertsApi | null>(null);

export function AlertsProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  const { currentUser } = useAuth();
  const myActiveAlerts = useAlertsForCompany();
  const companyId = currentUser?.companyId;

  const overrideAlerts = useMemo(
    () => companyId
      ? app.overrideAlerts.filter((a) => a.companyId === companyId)
      : app.overrideAlerts,
    [app.overrideAlerts, companyId],
  );

  const announcements = useMemo(
    () => companyId
      ? app.announcements.filter((a) => a.companyId === companyId)
      : app.announcements,
    [app.announcements, companyId],
  );

  const escalations = useMemo(
    () => companyId
      ? app.escalationEvents.filter((e) => e.companyId === companyId)
      : app.escalationEvents,
    [app.escalationEvents, companyId],
  );

  const acknowledgements = useMemo(
    () => companyId
      ? app.acknowledgements.filter((a) => a.companyId === companyId)
      : app.acknowledgements,
    [app.acknowledgements, companyId],
  );

  const value: AlertsApi = {
    overrideAlerts,
    announcements,
    escalations,
    myActiveAlerts,
    acknowledgeAlert: app.acknowledgeAlert,
    resolveAlert: app.resolveAlert,
    addAnnouncement: app.addAnnouncement,
    updateAnnouncement: app.updateAnnouncement,
    closeAnnouncement: app.closeAnnouncement,
    deleteAnnouncement: app.deleteAnnouncement,
    declareEscalation: app.declareEscalation,
    closeEscalation: app.closeEscalation,
    acknowledgements,
    acknowledgeAnnouncement: app.acknowledgeAnnouncement,
  };

  return <AlertsCtx.Provider value={value}>{children}</AlertsCtx.Provider>;
}

export function useAlerts(): AlertsApi {
  const v = useContext(AlertsCtx);
  if (!v) throw new Error('useAlerts must be used inside <AlertsProvider>');
  return v;
}
