// Soldiers API — read + write paths for roster.
//
// Two modes:
//   • USE_SUPABASE=false (default) — reads from the live mock snapshot;
//     writes are no-ops (AppContext owns mutation today).
//   • USE_SUPABASE=true            — reads from Supabase, writes through
//     RPC + insert; React Query invalidates after the mutation.

import type { Soldier, SoldierStatus, SoldierStatusEvent, UserRole } from '../types';
import { read, simulate, USE_SUPABASE, supabase } from './_adapter';
import { invalidate } from './queryClient';

// ─── Reads ─────────────────────────────────────────────────────────────

export async function listForCompany(companyId: string): Promise<Soldier[]> {
  if (USE_SUPABASE) {
    const { data, error } = await supabase()
      .from('soldiers')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'active');
    if (error) throw error;
    return (data ?? []).map(mapSoldier);
  }
  return simulate(read.soldiers().filter((s) => s.companyId === companyId));
}

export async function byId(id: string): Promise<Soldier | null> {
  if (USE_SUPABASE) {
    const { data, error } = await supabase()
      .from('soldiers')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapSoldier(data) : null;
  }
  return simulate(read.soldiers().find((s) => s.id === id) ?? null);
}

export async function statusEventsFor(soldierId: string): Promise<SoldierStatusEvent[]> {
  if (USE_SUPABASE) {
    const { data, error } = await supabase()
      .from('soldier_status_events')
      .select('*')
      .eq('soldier_id', soldierId)
      .order('set_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapStatusEvent);
  }
  return simulate(read.statusEvents().filter((e) => e.soldierId === soldierId));
}

// ─── Writes ────────────────────────────────────────────────────────────

export interface UpdateStatusInput {
  soldierId: string;
  next: SoldierStatus;
  expectedUntil?: string;
  reason?: string;
  setByName?: string;
  setByRole?: UserRole;
  isManualOverride?: boolean;
}

/**
 * Append a status event. The DB trigger denormalizes `soldiers.current_status`
 * in the same transaction (see migration 0002). Caller invalidates caches.
 */
export async function updateStatus(input: UpdateStatusInput): Promise<void> {
  if (!USE_SUPABASE) {
    // Mock path: nothing here — AppContext.updateSoldierStatus owns it.
    return simulate(undefined);
  }
  const { error } = await supabase()
    .from('soldier_status_events')
    .insert({
      soldier_id: input.soldierId,
      value: input.next,
      expected_until: input.expectedUntil ?? null,
      reason: input.reason ?? null,
      set_by_name: input.setByName ?? null,
      set_by_role: input.setByRole ?? null,
      is_manual_override: input.isManualOverride ?? false,
    });
  if (error) throw error;

  // Need company id for invalidation — fetch soldier to find it.
  const soldier = await byId(input.soldierId);
  if (soldier?.companyId) invalidate.soldierStatus(soldier.companyId, input.soldierId);
}

// ─── Mappers ───────────────────────────────────────────────────────────

interface SoldierRow {
  id: string;
  company_id: string;
  user_id: string | null;
  name: string;
  phone: string;
  id_last4: string;
  status: 'active' | 'inactive';
  current_status: SoldierStatus;
  status_set_at: string;
  status_expected_until: string | null;
  squad_id: string | null;
  team_class: string | null;
  operational_roles: string[] | null;
  functional_roles: string[] | null;
  availability: boolean | null;
  current_load: number | null;
  dominant_hand: 'right' | 'left' | null;
  weapon_side: 'right' | 'left' | null;
  shirt_size: string | null;
  pants_size: string | null;
  shoe_size: string | null;
  date_of_birth: string | null;
}

function mapSoldier(r: SoldierRow): Soldier {
  return {
    id: r.id,
    companyId: r.company_id,
    userId: r.user_id ?? undefined,
    name: r.name,
    phone: r.phone,
    idLast4: r.id_last4,
    status: r.status,
    currentStatus: r.current_status,
    statusSetAt: r.status_set_at,
    statusExpectedUntil: r.status_expected_until ?? undefined,
    squadId: r.squad_id ?? '',
    teamClass: (r.team_class ?? '') as Soldier['teamClass'],
    operationalRoles: (r.operational_roles ?? []) as Soldier['operationalRoles'],
    functionalRoles: (r.functional_roles ?? []) as Soldier['functionalRoles'],
    availability: r.availability ?? true,
    currentLoad: r.current_load ?? 0,
    availabilityNotes: [],
    dominantHand: r.dominant_hand ?? undefined,
    weaponSide: r.weapon_side ?? undefined,
    shirtSize: r.shirt_size ?? undefined,
    pantsSize: r.pants_size ?? undefined,
    shoeSize: r.shoe_size ?? undefined,
    dateOfBirth: r.date_of_birth ?? undefined,
  } as Soldier;
}

interface StatusEventRow {
  id: string;
  soldier_id: string;
  value: SoldierStatus;
  previous_value: SoldierStatus | null;
  set_at: string;
  set_by: string | null;
  set_by_name: string | null;
  set_by_role: UserRole | null;
  expected_until: string | null;
  reason: string | null;
  is_manual_override: boolean | null;
}

function mapStatusEvent(r: StatusEventRow): SoldierStatusEvent {
  return {
    id: r.id,
    soldierId: r.soldier_id,
    value: r.value,
    previousValue: r.previous_value ?? undefined,
    setAt: r.set_at,
    setBy: r.set_by ?? undefined,
    setByName: r.set_by_name ?? undefined,
    setByRole: r.set_by_role ?? undefined,
    expectedUntil: r.expected_until ?? undefined,
    reason: r.reason ?? undefined,
    isManualOverride: r.is_manual_override ?? false,
  } as SoldierStatusEvent;
}
