// Equipment API — inventory, signed equipment, lifecycle events, gaps.
//
// Two modes with fallback (USE_SUPABASE flag). Mock paths read from
// the live snapshot; Supabase paths hit the tables in migration 0007.

import type {
  EquipmentItem, SignedEquipment, EquipmentGap, EquipmentLifecycleEvent,
  EquipmentGapKind, EquipmentGapStatus, EquipmentCondition,
  SignedEquipmentStatus, SignedEquipmentCategory,
} from '../types';
import { read, simulate, USE_SUPABASE, supabase } from './_adapter';

// ─── Inventory ─────────────────────────────────────────────────────────

export async function listInventory(companyId: string): Promise<EquipmentItem[]> {
  if (USE_SUPABASE) {
    const { data, error } = await supabase()
      .from('equipment_items')
      .select('*')
      .eq('company_id', companyId);
    if (error) throw error;
    return (data ?? []).map(mapItem);
  }
  return simulate(read.equipmentItems().filter((i) => i.companyId === companyId));
}

export async function addInventoryItem(input: {
  companyId: string;
  name: string;
  category?: string;
  isConsumable?: boolean;
  unitCount?: number;
}): Promise<{ id: string }> {
  if (!USE_SUPABASE) return simulate({ id: '' });
  const { data, error } = await supabase()
    .from('equipment_items')
    .insert({
      company_id: input.companyId,
      name: input.name,
      category: input.category ?? null,
      is_consumable: input.isConsumable ?? false,
      unit_count: input.unitCount ?? 0,
    })
    .select('id')
    .single();
  if (error) throw error;
  return { id: data.id };
}

// ─── Signed equipment ──────────────────────────────────────────────────

export async function listSignedForCompany(companyId: string): Promise<SignedEquipment[]> {
  if (USE_SUPABASE) {
    const { data, error } = await supabase()
      .from('signed_equipment')
      .select('*')
      .eq('company_id', companyId);
    if (error) throw error;
    return (data ?? []).map(mapSigned);
  }
  return simulate(read.signedEquipment().filter((s) => s.companyId === companyId));
}

export async function listSignedForSoldier(soldierId: string): Promise<SignedEquipment[]> {
  if (USE_SUPABASE) {
    const { data, error } = await supabase()
      .from('signed_equipment')
      .select('*')
      .eq('soldier_id', soldierId);
    if (error) throw error;
    return (data ?? []).map(mapSigned);
  }
  return simulate(read.signedEquipment().filter((s) => s.soldierId === soldierId));
}

export interface SignOutInput {
  companyId: string;
  soldierId: string;
  itemName: string;
  category: SignedEquipmentCategory;
  equipmentItemId?: string;
  serialNumber?: string;
  source?: string;
  notes?: string;
  initialCondition?: EquipmentCondition;
  signedByUserId: string;
  signedByName: string;
}

export async function signOut(input: SignOutInput): Promise<SignedEquipment | null> {
  if (!USE_SUPABASE) return simulate(null);
  const { data, error } = await supabase()
    .from('signed_equipment')
    .insert({
      company_id: input.companyId,
      soldier_id: input.soldierId,
      equipment_item_id: input.equipmentItemId ?? null,
      item_name: input.itemName,
      category: input.category,
      serial_number: input.serialNumber ?? null,
      source: input.source ?? null,
      signed_by_user_id: input.signedByUserId,
      signed_by_name: input.signedByName,
      condition: input.initialCondition ?? 'good',
      notes: input.notes ?? null,
      status: 'active' satisfies SignedEquipmentStatus,
    })
    .select('*')
    .single();
  if (error) throw error;
  // Append lifecycle event
  await supabase().from('equipment_lifecycle_events').insert({
    signed_equipment_id: data.id,
    company_id: input.companyId,
    kind: 'sign-out',
    to_condition: input.initialCondition ?? 'good',
    actor_user_id: input.signedByUserId,
    actor_name: input.signedByName,
    description: input.notes ?? null,
  });
  return mapSigned(data);
}

export async function returnItem(input: {
  companyId: string;
  signedEquipmentId: string;
  partial?: boolean;
  damageDescription?: string;
  finalCondition?: EquipmentCondition;
  actorUserId: string;
  actorName: string;
}): Promise<void> {
  if (!USE_SUPABASE) return simulate(undefined);
  const status: SignedEquipmentStatus = input.partial ? 'in-repair' : 'returned';
  const { error } = await supabase()
    .from('signed_equipment')
    .update({
      status,
      returned_at: new Date().toISOString(),
      condition: input.finalCondition ?? null,
      damage_description: input.damageDescription ?? null,
    })
    .eq('id', input.signedEquipmentId);
  if (error) throw error;
  await supabase().from('equipment_lifecycle_events').insert({
    signed_equipment_id: input.signedEquipmentId,
    company_id: input.companyId,
    kind: input.partial ? 'return-partial' : 'return-full',
    to_condition: input.finalCondition ?? null,
    description: input.damageDescription ?? null,
    actor_user_id: input.actorUserId,
    actor_name: input.actorName,
  });
}

export async function markDamage(input: {
  companyId: string;
  signedEquipmentId: string;
  description: string;
  newCondition?: EquipmentCondition;
  actorUserId: string;
  actorName: string;
}): Promise<void> {
  if (!USE_SUPABASE) return simulate(undefined);
  const { error } = await supabase()
    .from('signed_equipment')
    .update({
      condition: input.newCondition ?? 'damaged',
      damage_description: input.description,
    })
    .eq('id', input.signedEquipmentId);
  if (error) throw error;
  await supabase().from('equipment_lifecycle_events').insert({
    signed_equipment_id: input.signedEquipmentId,
    company_id: input.companyId,
    kind: 'damage-report',
    to_condition: input.newCondition ?? 'damaged',
    description: input.description,
    actor_user_id: input.actorUserId,
    actor_name: input.actorName,
  });
}

// ─── Lifecycle events (read-only from app side) ────────────────────────

export async function listLifecycleForSigned(signedEquipmentId: string): Promise<EquipmentLifecycleEvent[]> {
  if (USE_SUPABASE) {
    const { data, error } = await supabase()
      .from('equipment_lifecycle_events')
      .select('*')
      .eq('signed_equipment_id', signedEquipmentId)
      .order('occurred_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as EquipmentLifecycleEvent[];
  }
  return simulate([] as EquipmentLifecycleEvent[]);
}

// ─── Equipment gaps ────────────────────────────────────────────────────

export async function listGapsForCompany(companyId: string): Promise<EquipmentGap[]> {
  if (USE_SUPABASE) {
    const { data, error } = await supabase()
      .from('equipment_gaps')
      .select('*')
      .eq('company_id', companyId);
    if (error) throw error;
    return (data ?? []).map(mapGap);
  }
  return simulate(read.equipmentGaps().filter((g) => g.companyId === companyId));
}

export async function reportGap(input: {
  companyId: string;
  soldierId: string;
  kind: EquipmentGapKind;
  itemName: string;
  signedEquipmentId?: string;
  description?: string;
  reportedByUserId: string;
  reportedByPlatoonId?: string;
}): Promise<EquipmentGap | null> {
  if (!USE_SUPABASE) return simulate(null);
  const { data, error } = await supabase()
    .from('equipment_gaps')
    .insert({
      company_id: input.companyId,
      soldier_id: input.soldierId,
      reported_by_user_id: input.reportedByUserId,
      reported_by_platoon_id: input.reportedByPlatoonId ?? null,
      kind: input.kind,
      item_name: input.itemName,
      signed_equipment_id: input.signedEquipmentId ?? null,
      description: input.description ?? null,
      status: 'reported' satisfies EquipmentGapStatus,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapGap(data);
}

export async function setGapStatus(input: {
  gapId: string;
  status: EquipmentGapStatus;
  reviewerId?: string;
  resolverId?: string;
  notes?: string;
}): Promise<void> {
  if (!USE_SUPABASE) return simulate(undefined);
  const patch: Record<string, unknown> = { status: input.status };
  if (input.status === 'reviewed-by-platoon' || input.status === 'forwarded-to-rasap') {
    patch.reviewed_by_user_id = input.reviewerId ?? null;
  }
  if (input.status === 'resolved' || input.status === 'dismissed') {
    patch.resolved_by_user_id = input.resolverId ?? null;
    patch.resolution_notes = input.notes ?? null;
  }
  const { error } = await supabase().from('equipment_gaps').update(patch).eq('id', input.gapId);
  if (error) throw error;
}

// ─── Mappers ───────────────────────────────────────────────────────────

interface ItemRow {
  id: string; company_id: string; name: string; category: string | null;
  is_consumable: boolean | null; unit_count: number | null;
}
function mapItem(r: ItemRow): EquipmentItem {
  return {
    id: r.id, companyId: r.company_id, name: r.name,
    category: (r.category ?? '') as EquipmentItem['category'],
    isConsumable: r.is_consumable ?? false,
    unitCount: r.unit_count ?? 0,
  } as EquipmentItem;
}

interface SignedRow {
  id: string; company_id: string; soldier_id: string;
  equipment_item_id: string | null; item_name: string; category: string | null;
  serial_number: string | null; source: string | null;
  signed_by_user_id: string | null; signed_by_name: string | null;
  signed_at: string; returned_at: string | null;
  status: SignedEquipmentStatus; condition: EquipmentCondition | null;
  damage_description: string | null; notes: string | null;
}
function mapSigned(r: SignedRow): SignedEquipment {
  return {
    id: r.id, companyId: r.company_id, soldierId: r.soldier_id,
    equipmentItemId: r.equipment_item_id ?? undefined,
    itemName: r.item_name,
    category: (r.category ?? 'misc') as SignedEquipmentCategory,
    serialNumber: r.serial_number ?? undefined,
    source: r.source ?? '',
    signedByUserId: r.signed_by_user_id ?? '',
    signedByName: r.signed_by_name ?? '',
    signedAt: r.signed_at,
    status: r.status,
    condition: r.condition ?? undefined,
    notes: r.notes ?? undefined,
  } as SignedEquipment;
}

interface GapRow {
  id: string; company_id: string; soldier_id: string;
  reported_by_user_id: string | null; reported_by_platoon_id: string | null;
  kind: EquipmentGapKind; item_name: string;
  signed_equipment_id: string | null; description: string | null;
  status: EquipmentGapStatus;
  reviewed_by_user_id: string | null; resolved_by_user_id: string | null;
  resolution_notes: string | null;
  created_at: string; updated_at: string;
}
function mapGap(r: GapRow): EquipmentGap {
  return {
    id: r.id,
    companyId: r.company_id,
    reportedByUserId: r.reported_by_user_id ?? '',
    reportedBySoldierId: r.soldier_id,
    reportedByName: '',                                  // resolved client-side from join (or kept blank if unavailable)
    reportedByPlatoonId: r.reported_by_platoon_id ?? undefined,
    kind: r.kind,
    itemName: r.item_name,
    signedEquipmentId: r.signed_equipment_id ?? undefined,
    description: r.description ?? undefined,
    status: r.status,
    reviewedByUserId: r.reviewed_by_user_id ?? undefined,
    resolvedByUserId: r.resolved_by_user_id ?? undefined,
    resolvedNotes: r.resolution_notes ?? undefined,
    createdAt: r.created_at,
  } as EquipmentGap;
}
