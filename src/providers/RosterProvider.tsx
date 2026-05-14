/* eslint-disable react-refresh/only-export-components -- co-locating hooks with their Provider is intentional */
// RosterProvider — soldiers + their operational status.
//
// Single source of truth for "who do we have on the roster" and "what
// is their current operational state." All status mutations route
// through here so that audit + invalidation are consistent.

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Soldier, SoldierStatus, SoldierStatusEvent, OperationalRole } from '../types';
import { useApp } from '../context/AppContext';
import { useAuth } from './AuthProvider';
import { invalidate } from '../api/queryClient';

export interface UpdateStatusInput {
  soldierId: string;
  next: SoldierStatus;
  expectedUntil?: string;
  reason?: string;
}

export interface RosterApi {
  /** Active soldiers, company-scoped. */
  soldiers:     Soldier[];
  /** Full historical record — audit only. */
  allSoldiers:  Soldier[];
  /** Append-only status event log, company-scoped. */
  statusEvents: SoldierStatusEvent[];

  /** Lookup helpers. */
  soldierById:   (id: string | undefined) => Soldier | undefined;
  soldiersInSquad:   (squadId: string)   => Soldier[];
  soldiersInPlatoon: (platoonId: string) => Soldier[];

  /** Self status update. */
  updateMyStatus: (data: UpdateStatusInput) => void;
  /** Commander override status update — logs isManualOverride=true. */
  updateSoldierStatusByCommander: (data: UpdateStatusInput) => void;

  /** Squad reassignment (PC/PS within their platoon, or CC anywhere). */
  updateSoldierSquad: (soldierId: string, squadId: string | null) => void;
  /** Operational roles edit. */
  updateSoldierOperationalRoles: (soldierId: string, roles: OperationalRole[]) => void;

  /** Soldier-edited profile fields. */
  updateSoldierProfile: (data: {
    soldierId:     string;
    dominantHand?: 'right' | 'left';
    weaponSide?:   'right' | 'left';
    shirtSize?:    string;
    pantsSize?:    string;
    shoeSize?:     string;
    dateOfBirth?:  string;
  }) => void;
}

const RosterCtx = createContext<RosterApi | null>(null);

export function RosterProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  const { currentUser } = useAuth();
  const companyId = currentUser?.companyId;

  const soldiers = useMemo(
    () => companyId ? app.soldiers.filter((s) => s.companyId === companyId) : app.soldiers,
    [app.soldiers, companyId],
  );

  const statusEvents = useMemo(
    () => {
      const ids = new Set(soldiers.map((s) => s.id));
      return app.soldierStatusEvents.filter((e) => ids.has(e.soldierId));
    },
    [app.soldierStatusEvents, soldiers],
  );

  const soldierById = (id: string | undefined) =>
    id ? soldiers.find((s) => s.id === id) : undefined;

  const soldiersInSquad = (squadId: string) =>
    soldiers.filter((s) => s.squadId === squadId);

  const soldiersInPlatoon = (platoonId: string) => {
    const squadIds = new Set(app.squads.filter((sq) => sq.platoonId === platoonId).map((sq) => sq.id));
    return soldiers.filter((s) => s.squadId && squadIds.has(s.squadId));
  };

  const updateMyStatus = (data: UpdateStatusInput) => {
    app.updateSoldierStatus(data);
    if (companyId) invalidate.soldierStatus(companyId, data.soldierId);
  };

  const updateSoldierStatusByCommander = (data: UpdateStatusInput) => {
    app.updateSoldierStatusByCommander(data);
    if (companyId) invalidate.soldierStatus(companyId, data.soldierId);
  };

  const value: RosterApi = {
    soldiers,
    allSoldiers: app.allSoldiers,
    statusEvents,
    soldierById,
    soldiersInSquad,
    soldiersInPlatoon,
    updateMyStatus,
    updateSoldierStatusByCommander,
    updateSoldierSquad: app.updateSoldierSquad,
    updateSoldierOperationalRoles: app.updateSoldierOperationalRoles,
    updateSoldierProfile: app.updateSoldierProfile,
  };

  return <RosterCtx.Provider value={value}>{children}</RosterCtx.Provider>;
}

export function useRoster(): RosterApi {
  const v = useContext(RosterCtx);
  if (!v) throw new Error('useRoster must be used inside <RosterProvider>');
  return v;
}
