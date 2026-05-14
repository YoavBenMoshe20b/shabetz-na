/* eslint-disable react-refresh/only-export-components -- co-locating hooks with their Provider is intentional */
// OrgProvider — the organizational structure: company / platoons / squads.
//
// Read-mostly. Writes are constrained to CC (and PC for squad scope).
// Today reads from AppContext; tomorrow reads from React Query backed
// by Supabase.

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Company, Platoon, Squad } from '../types';
import { useApp } from '../context/AppContext';
import { useAuth } from './AuthProvider';

export interface OrgApi {
  /** All companies the user can see (RLS-scoped server-side; client also filters). */
  companies: Company[];
  /** The user's active company. */
  company:   Company | null;
  /** Platoons within the active company. */
  platoons:  Platoon[];
  /** Squads within the active company. */
  squads:    Squad[];

  /** Find a platoon by id, scoped to the active company. */
  platoonById: (id: string | undefined) => Platoon | undefined;
  /** Find a squad by id, scoped to the active company. */
  squadById:   (id: string | undefined) => Squad | undefined;

  // Mutations (CC-only at UI tier)
  addSquad:    (data: { platoonId: string; name: string }) => Squad;
  removeSquad: (id: string) => void;
  renameSquad: (id: string, name: string) => void;
}

const OrgCtx = createContext<OrgApi | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  const { currentUser } = useAuth();

  const company = useMemo(
    () => app.companies.find((c) => c.id === currentUser?.companyId) ?? null,
    [app.companies, currentUser?.companyId],
  );

  const platoons = useMemo(
    () => company ? app.platoons.filter((p) => p.companyId === company.id) : [],
    [app.platoons, company],
  );

  const squads = useMemo(
    () => platoons.length === 0
      ? []
      : app.squads.filter((sq) => platoons.some((p) => p.id === sq.platoonId)),
    [app.squads, platoons],
  );

  const platoonById = (id: string | undefined) =>
    id ? platoons.find((p) => p.id === id) : undefined;
  const squadById = (id: string | undefined) =>
    id ? squads.find((sq) => sq.id === id) : undefined;

  const value: OrgApi = {
    companies: app.companies,
    company,
    platoons,
    squads,
    platoonById,
    squadById,
    addSquad: app.addSquad,
    removeSquad: app.removeSquad,
    renameSquad: app.renameSquad,
  };

  return <OrgCtx.Provider value={value}>{children}</OrgCtx.Provider>;
}

export function useOrg(): OrgApi {
  const v = useContext(OrgCtx);
  if (!v) throw new Error('useOrg must be used inside <OrgProvider>');
  return v;
}
