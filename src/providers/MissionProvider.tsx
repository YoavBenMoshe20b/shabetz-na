/* eslint-disable react-refresh/only-export-components -- co-locating hooks with their Provider is intentional */
// MissionProvider — missions + operational orders + mission notes.

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Mission, OperationalOrder, MissionNote } from '../types';
import { useApp } from '../context/AppContext';
import { useAuth } from './AuthProvider';

export interface MissionApi {
  missions:     Mission[];
  orders:       OperationalOrder[];
  missionNotes: MissionNote[];

  addMission:       ReturnType<typeof useApp>['addMission'];
  updateMission:    ReturnType<typeof useApp>['updateMission'];
  setMissionStatus: ReturnType<typeof useApp>['setMissionStatus'];

  addOrder:         ReturnType<typeof useApp>['addOrder'];
  setOrderStatus:   ReturnType<typeof useApp>['setOrderStatus'];

  addMissionNote:    ReturnType<typeof useApp>['addMissionNote'];
  editMissionNote:   ReturnType<typeof useApp>['editMissionNote'];
  deleteMissionNote: ReturnType<typeof useApp>['deleteMissionNote'];
}

const MissionCtx = createContext<MissionApi | null>(null);

export function MissionProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  const { currentUser } = useAuth();
  const companyId = currentUser?.companyId;

  const missions = useMemo(
    () => companyId ? app.missions.filter((m) => m.companyId === companyId) : app.missions,
    [app.missions, companyId],
  );
  const orders = useMemo(
    () => companyId ? app.orders.filter((o) => o.companyId === companyId) : app.orders,
    [app.orders, companyId],
  );
  const missionNotes = useMemo(
    () => {
      const missionIds = new Set(missions.map((m) => m.id));
      return app.missionNotes.filter((n) => missionIds.has(n.missionId));
    },
    [app.missionNotes, missions],
  );

  const value: MissionApi = {
    missions,
    orders,
    missionNotes,
    addMission: app.addMission,
    updateMission: app.updateMission,
    setMissionStatus: app.setMissionStatus,
    addOrder: app.addOrder,
    setOrderStatus: app.setOrderStatus,
    addMissionNote: app.addMissionNote,
    editMissionNote: app.editMissionNote,
    deleteMissionNote: app.deleteMissionNote,
  };

  return <MissionCtx.Provider value={value}>{children}</MissionCtx.Provider>;
}

export function useMission(): MissionApi {
  const v = useContext(MissionCtx);
  if (!v) throw new Error('useMission must be used inside <MissionProvider>');
  return v;
}
