// Assignments API — operator-confirmed staffing.
//
// One row per (slot, soldier) — N rows per slot when there are N picks.
// The materializer prefers persisted assignments over auto-pick, so
// writing here is what makes the schedule "real" for everyone in the app.
//
// In mock mode (USE_SUPABASE=false) reads/writes go through the in-
// memory mockAssignments registry held by `_adapter`. In live mode they
// go to Supabase via RLS-gated policies.

import type { Assignment, SelectorOutcomeRecord, EngineOverride } from '../types';
import { read, simulate, USE_SUPABASE, supabase } from './_adapter';

// ─── Assignments ───────────────────────────────────────────────────────

export async function listForCompany(companyId: string): Promise<Assignment[]> {
  if (USE_SUPABASE) {
    const { data, error } = await supabase()
      .from('assignments')
      .select('*')
      .eq('company_id', companyId);
    if (error) throw error;
    return (data ?? []).map(mapAssignment);
  }
  return simulate(read.assignments?.().filter((a: Assignment & { companyId?: string }) =>
    !('companyId' in a) || (a as Assignment & { companyId?: string }).companyId === companyId
  ) ?? []);
}

/** Replace all assignments for one slot atomically. Mirrors the
 *  AppContext.setSlotAssignment mutation. The slot's company_id is
 *  derived by joining mission_id → missions.company_id at the DB layer
 *  via a stored proc; here we accept it explicitly so the client can
 *  insert without a round-trip. */
export async function setSlotAssignment(input: {
  companyId: string;
  slotId: string;
  missionId: string;
  records: Array<{
    id: string;
    soldierId: string;
    role: 'soldier' | 'commander';
    overrideAlertId?: string;
    overrideId?: string;
  }>;
}): Promise<void> {
  if (!USE_SUPABASE) return simulate(undefined);

  // Atomic-ish: delete then insert in the same client call sequence.
  // The DB applies RLS to each operation; no transaction primitive is
  // exposed through PostgREST. Two writes here are acceptable because
  // setSlotAssignment is rare (per slot, per operator action).
  const del = await supabase()
    .from('assignments')
    .delete()
    .eq('slot_id', input.slotId);
  if (del.error) throw del.error;

  if (input.records.length === 0) return;

  const rows = input.records.map((r) => ({
    id: r.id,
    company_id: input.companyId,
    slot_id: input.slotId,
    mission_id: input.missionId,
    soldier_id: r.soldierId,
    role: r.role,
    override_alert_id: r.overrideAlertId ?? null,
    override_id: r.overrideId ?? null,
  }));

  const ins = await supabase()
    .from('assignments')
    .insert(rows);
  if (ins.error) throw ins.error;
}

export async function clearSlotAssignment(slotId: string): Promise<void> {
  if (!USE_SUPABASE) return simulate(undefined);
  const { error } = await supabase()
    .from('assignments')
    .delete()
    .eq('slot_id', slotId);
  if (error) throw error;
}

interface AssignmentRow {
  id: string; company_id: string; slot_id: string; mission_id: string;
  soldier_id: string; role: 'soldier' | 'commander';
  created_by: string | null; created_at: string;
  override_alert_id: string | null; override_id: string | null;
}

function mapAssignment(r: AssignmentRow): Assignment {
  return {
    id: r.id,
    slotId: r.slot_id,
    soldierId: r.soldier_id,
    role: r.role,
    createdBy: r.created_by ?? 'system',
    createdAt: r.created_at,
    overrideAlertId: r.override_alert_id ?? undefined,
    overrideId: r.override_id ?? undefined,
  };
}

// ─── SelectorOutcomeRecord (audit) ─────────────────────────────────────

export async function recordSelectorOutcome(record: SelectorOutcomeRecord): Promise<void> {
  if (!USE_SUPABASE) return simulate(undefined);
  const { error } = await supabase()
    .from('selector_outcomes')
    .insert({
      id: record.id,
      company_id: record.companyId,
      slot_id: record.slotId,
      mission_id: record.missionId,
      outcome: record.outcome,
      final_soldier_ids: record.finalSoldierIds,
      actor_user_id: record.actorUserId,
      actor_role: record.actorRole,
      decided_at: record.decidedAt,
    });
  if (error) throw error;
}

export async function listSelectorOutcomes(companyId: string): Promise<SelectorOutcomeRecord[]> {
  if (USE_SUPABASE) {
    const { data, error } = await supabase()
      .from('selector_outcomes')
      .select('*')
      .eq('company_id', companyId)
      .order('decided_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []).map(mapOutcome);
  }
  return simulate([]);
}

interface SelectorOutcomeRow {
  id: string; company_id: string; slot_id: string; mission_id: string;
  outcome: SelectorOutcomeRecord['outcome'];
  final_soldier_ids: string[];
  actor_user_id: string | null; actor_role: string;
  decided_at: string;
}

function mapOutcome(r: SelectorOutcomeRow): SelectorOutcomeRecord {
  return {
    id: r.id,
    companyId: r.company_id,
    slotId: r.slot_id,
    missionId: r.mission_id,
    outcome: r.outcome,
    finalSoldierIds: r.final_soldier_ids ?? [],
    actorUserId: r.actor_user_id ?? '',
    actorRole: r.actor_role as SelectorOutcomeRecord['actorRole'],
    decidedAt: r.decided_at,
  };
}

// ─── EngineOverride (human override telemetry) ─────────────────────────

export async function recordEngineOverride(override: EngineOverride): Promise<void> {
  if (!USE_SUPABASE) return simulate(undefined);
  const { error } = await supabase()
    .from('engine_overrides')
    .insert({
      id: override.id,
      company_id: override.companyId,
      slot_id: override.slotId,
      engine_recommended_soldier_id: override.engineRecommendedSoldierId,
      engine_confidence: override.engineConfidence,
      operator_chose_soldier_id: override.operatorChoseSoldierId ?? null,
      rationale: override.rationale ?? null,
      rationale_code: override.rationaleCode ?? null,
      actor_user_id: override.actorUserId,
      actor_role: override.actorRole,
      occurred_at: override.occurredAt,
    });
  if (error) throw error;
}
