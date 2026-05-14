/* eslint-disable react-refresh/only-export-components -- co-locating hooks with their Provider is intentional */
// EquipmentProvider — inventory + signed equipment + gaps + lifecycle.

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type {
  EquipmentItem, SignedEquipment, EquipmentGap, EquipmentLifecycleEvent,
} from '../types';
import { useApp } from '../context/AppContext';
import { useAuth } from './AuthProvider';

export interface EquipmentApi {
  inventory:         EquipmentItem[];
  signedEquipment:   SignedEquipment[];
  equipmentGaps:     EquipmentGap[];
  equipmentLifecycle: EquipmentLifecycleEvent[];

  // Rasap actions
  signOut:           ReturnType<typeof useApp>['signOutEquipment'];
  returnItem:        ReturnType<typeof useApp>['returnEquipment'];
  markDamage:        ReturnType<typeof useApp>['markEquipmentDamage'];
  setInventoryItems: ReturnType<typeof useApp>['setInventoryItems'];
  addEquipmentItem:  ReturnType<typeof useApp>['addEquipmentItem'];

  // Gap workflow
  reportGap:    ReturnType<typeof useApp>['reportEquipmentGap'];
  reviewGap:    ReturnType<typeof useApp>['reviewEquipmentGap'];
  forwardGap:   ReturnType<typeof useApp>['forwardEquipmentGap'];
  resolveGap:   ReturnType<typeof useApp>['resolveEquipmentGap'];
  dismissGap:   ReturnType<typeof useApp>['dismissEquipmentGap'];
}

const EquipmentCtx = createContext<EquipmentApi | null>(null);

export function EquipmentProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  const { currentUser } = useAuth();
  const companyId = currentUser?.companyId;

  const inventory = useMemo(
    () => companyId
      ? app.equipmentItems.filter((i) => i.companyId === companyId)
      : app.equipmentItems,
    [app.equipmentItems, companyId],
  );

  const signedEquipment = useMemo(
    () => companyId
      ? app.signedEquipment.filter((s) => s.companyId === companyId)
      : app.signedEquipment,
    [app.signedEquipment, companyId],
  );

  const equipmentGaps = useMemo(
    () => companyId
      ? app.equipmentGaps.filter((g) => g.companyId === companyId)
      : app.equipmentGaps,
    [app.equipmentGaps, companyId],
  );

  const value: EquipmentApi = {
    inventory,
    signedEquipment,
    equipmentGaps,
    equipmentLifecycle: app.equipmentLifecycle,
    signOut:           app.signOutEquipment,
    returnItem:        app.returnEquipment,
    markDamage:        app.markEquipmentDamage,
    setInventoryItems: app.setInventoryItems,
    addEquipmentItem:  app.addEquipmentItem,
    reportGap:    app.reportEquipmentGap,
    reviewGap:    app.reviewEquipmentGap,
    forwardGap:   app.forwardEquipmentGap,
    resolveGap:   app.resolveEquipmentGap,
    dismissGap:   app.dismissEquipmentGap,
  };

  return <EquipmentCtx.Provider value={value}>{children}</EquipmentCtx.Provider>;
}

export function useEquipment(): EquipmentApi {
  const v = useContext(EquipmentCtx);
  if (!v) throw new Error('useEquipment must be used inside <EquipmentProvider>');
  return v;
}
