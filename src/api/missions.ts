// Missions API — read + write paths.
//
// `spec` (JSONB) holds the rich policy bag (time model, manpower,
// command, rotation, fatigue, etc.). Top-level columns are filter axes.
// Mappers serialize/deserialize the rich types in and out of spec.

import type { Mission, MissionStatus } from '../types';
import { read, simulate, USE_SUPABASE, supabase } from './_adapter';

const RICH_FIELDS = [
  'timeModel','manpower','command','rotation','fatigue',
  'cycleProfile','overlapPolicy','qualifications','equipment',
  'logisticsAlerts','conflictsWith','canOverlapWith','pairings',
  'squadPolicy','requiresDailyConfirmation',
] as const;

// ─── Reads ─────────────────────────────────────────────────────────────

export async function listForCompany(companyId: string): Promise<Mission[]> {
  if (USE_SUPABASE) {
    const { data, error } = await supabase()
      .from('missions')
      .select('*')
      .eq('company_id', companyId);
    if (error) throw error;
    return (data ?? []).map(mapMission);
  }
  return simulate(read.missions().filter((m) => m.companyId === companyId));
}

export async function listForOrder(orderId: string): Promise<Mission[]> {
  if (USE_SUPABASE) {
    const { data, error } = await supabase()
      .from('missions')
      .select('*')
      .eq('order_id', orderId);
    if (error) throw error;
    return (data ?? []).map(mapMission);
  }
  return simulate(read.missions().filter((m) => m.orderId === orderId));
}

export async function listUnstaffed(companyId: string): Promise<Mission[]> {
  if (USE_SUPABASE) {
    const { data, error } = await supabase()
      .from('missions')
      .select('*')
      .eq('company_id', companyId)
      .in('status', ['active-unstaffed','staffing-pending']);
    if (error) throw error;
    return (data ?? []).map(mapMission);
  }
  return simulate(
    read.missions().filter((m) =>
      m.companyId === companyId &&
      (m.status === 'active-unstaffed' || m.status === 'staffing-pending'),
    ),
  );
}

export async function byId(id: string): Promise<Mission | null> {
  if (USE_SUPABASE) {
    const { data, error } = await supabase()
      .from('missions')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapMission(data) : null;
  }
  return simulate(read.missions().find((m) => m.id === id) ?? null);
}

// ─── Writes ────────────────────────────────────────────────────────────

export async function create(data: Omit<Mission, 'id' | 'createdAt'>): Promise<Mission | null> {
  if (!USE_SUPABASE) return simulate(null);
  const { spec, top } = splitMission(data);
  const { data: row, error } = await supabase()
    .from('missions')
    .insert({
      company_id: top.companyId,
      order_id: top.orderId ?? null,
      name: top.name,
      description: top.description ?? null,
      owner_role: top.ownerRole,
      status: top.status,
      start_date: top.startDate ?? null,
      end_date: top.endDate ?? null,
      assigned_platoon_ids: top.assignedPlatoonIds,
      spec,
      escalation_id: top.escalationId ?? null,
      created_by: top.createdByUserId,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapMission(row);
}

export async function update(id: string, patch: Partial<Mission>): Promise<void> {
  if (!USE_SUPABASE) return simulate(undefined);
  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.description !== undefined) updates.description = patch.description ?? null;
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.startDate !== undefined) updates.start_date = patch.startDate ?? null;
  if (patch.endDate !== undefined) updates.end_date = patch.endDate ?? null;
  if (patch.assignedPlatoonIds !== undefined) updates.assigned_platoon_ids = patch.assignedPlatoonIds;
  if (patch.orderId !== undefined) updates.order_id = patch.orderId ?? null;
  // Any rich-spec patch updates the spec JSONB.
  const specPatch: Record<string, unknown> = {};
  for (const key of RICH_FIELDS) {
    if ((patch as Record<string, unknown>)[key] !== undefined) {
      specPatch[key] = (patch as Record<string, unknown>)[key];
    }
  }
  if (Object.keys(specPatch).length > 0) {
    // Merge with existing spec
    const { data: existing } = await supabase().from('missions').select('spec').eq('id', id).single();
    updates.spec = { ...(existing?.spec ?? {}), ...specPatch };
  }
  const { error } = await supabase().from('missions').update(updates).eq('id', id);
  if (error) throw error;
}

export async function setStatus(id: string, status: MissionStatus): Promise<void> {
  if (!USE_SUPABASE) return simulate(undefined);
  const { error } = await supabase().from('missions').update({ status }).eq('id', id);
  if (error) throw error;
}

// ─── Helpers ───────────────────────────────────────────────────────────

function splitMission(m: Omit<Mission, 'id' | 'createdAt'>) {
  const top = m as Mission;
  const spec: Record<string, unknown> = {};
  for (const key of RICH_FIELDS) {
    const v = (m as Record<string, unknown>)[key];
    if (v !== undefined) spec[key] = v;
  }
  return { spec, top };
}

interface MissionRow {
  id: string;
  company_id: string;
  order_id: string | null;
  name: string;
  description: string | null;
  owner_role: 'company' | 'platoon';
  status: MissionStatus;
  start_date: string | null;
  end_date:   string | null;
  assigned_platoon_ids: string[] | null;
  spec: Record<string, unknown> | null;
  escalation_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapMission(r: MissionRow): Mission {
  const spec = r.spec ?? {};
  return {
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    description: r.description ?? undefined,
    createdByUserId: r.created_by ?? '',
    ownerRole: r.owner_role,
    orderId: r.order_id ?? undefined,
    assignedPlatoonIds: r.assigned_platoon_ids ?? [],
    status: r.status,
    startDate: r.start_date ?? undefined,
    endDate:   r.end_date   ?? undefined,
    escalationId: r.escalation_id ?? undefined,
    createdAt: r.created_at,
    // Rich spec fields — splatted from JSONB
    ...spec,
  } as unknown as Mission;
}
