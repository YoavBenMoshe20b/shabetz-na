// hardFilters.ts — boolean eligibility filters.
//
// A pure function: (soldier, slot, context) → HardFilterCode[].
// Empty array means the soldier passes all hard filters.
// A non-empty array means the soldier is NOT a candidate by default,
// but the operator MAY override (each filter has soft semantics
// downstream in the selector).
//
// Filters are EXPLAINABLE: each failure carries a code that the UI
// translates to a Hebrew sentence. Operators see WHY a soldier was
// filtered out.

import type {
  EngineContext, HardFilterCode, Soldier, Mission,
  Leave, EquipmentRequirement,
} from '../../types';
import type { MaterializedSlot } from '../materialize';
import { getArchetypeBehavior } from '../archetypeBehavior';

/**
 * Evaluate all hard filters for one soldier on one slot. Returns the
 * list of codes for filters that FAILED. Empty list = pass.
 *
 * NOTE: This function does NOT decide eligibility — it reports facts.
 * The selector decides what to do with a non-empty list (skip the
 * candidate, or accept the override if the operator approved one).
 */
export function evaluateHardFilters(
  soldier: Soldier,
  slot: MaterializedSlot,
  ctx: EngineContext,
): HardFilterCode[] {
  const fails: HardFilterCode[] = [];

  // ── 1. Soldier active + on base ─────────────────────────────────
  if (soldier.status !== 'active') {
    fails.push('soldier-inactive');
    // Inactive soldiers fail everything else trivially — return early.
    return fails;
  }
  if (soldier.currentStatus === 'home') {
    fails.push('soldier-home');
  }
  if (soldier.currentStatus === 'inactive-temp') {
    fails.push('soldier-inactive');
  }

  // ── 2. Overlapping personal leave ───────────────────────────────
  if (isOnLeaveDuring(soldier.id, slot.start, slot.end, ctx.leaves)) {
    fails.push('on-leave');
  }

  // ── 3. Overlapping duty exclusion ───────────────────────────────
  const exclusion = ctx.dutyExclusions.find((e) =>
    e.soldierId === soldier.id
    && datesOverlap(slot.start, slot.end, e.startIso, e.endIso),
  );
  if (exclusion) {
    fails.push('duty-exclusion');
  }

  // ── 4. Soldier's platoon must be in mission.assignedPlatoonIds ──
  const mission = ctx.missions.find((m) => m.id === slot.missionId);
  if (mission) {
    const soldierPlatoonId = resolveSoldierPlatoonId(soldier, ctx);
    if (soldierPlatoonId && !mission.assignedPlatoonIds.includes(soldierPlatoonId)) {
      fails.push('wrong-platoon');
    }
  }

  // ── 5. Required qualifications ──────────────────────────────────
  if (mission && mission.qualifications.length > 0) {
    const soldierQuals = ctx.qualifications
      .filter((q) => q.soldierId === soldier.id)
      .map((q) => q.qualificationId);
    const missing = mission.qualifications.some(
      (req) => !soldierQuals.includes(req.qualificationId),
    );
    if (missing) {
      fails.push('missing-qualifications');
    }
  }

  // ── 6. Squad policy ─────────────────────────────────────────────
  if (mission && mission.squadPolicy) {
    const policyFail = checkSquadPolicy(soldier, mission, slot, ctx);
    if (policyFail) fails.push('squad-policy-violation');
  }

  // ── 7. Time conflict with another assignment ────────────────────
  if (hasTimeConflict(soldier.id, slot, ctx)) {
    fails.push('time-conflict');
  }

  // ── 8. Critical-level equipment requirements ────────────────────
  if (mission && mission.equipment.length > 0) {
    const criticalMissing = hasCriticalEquipmentGap(soldier, mission.equipment, ctx);
    if (criticalMissing) {
      fails.push('critical-equipment-missing');
    }
  }

  // Note: in-leave-cycle-home is a separate concern — needs the
  // platoon leave cycle data which isn't in EngineContext yet.
  // To be wired in Phase 6.1.1 (cycle projection input).

  return fails;
}

// ─── Internal helpers (pure) ───────────────────────────────────────

function isOnLeaveDuring(
  soldierId: string,
  slotStart: string,
  slotEnd: string,
  leaves: Leave[],
): boolean {
  return leaves.some((lv) => {
    if (lv.scope === 'individual' && !lv.soldierIds.includes(soldierId)) return false;
    // For squad / machlaka scope, the caller would need to expand;
    // here we only confirm individual scope. Phase 6.1.1 expands.
    const lvStart = `${lv.startDate}T${lv.startTime || '00:00'}:00`;
    const lvEnd   = `${lv.endDate}T${lv.endTime   || '23:59'}:00`;
    return datesOverlap(slotStart, slotEnd, lvStart, lvEnd);
  });
}

function datesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return Date.parse(aStart) < Date.parse(bEnd) && Date.parse(aEnd) > Date.parse(bStart);
}

function resolveSoldierPlatoonId(soldier: Soldier, ctx: EngineContext): string | undefined {
  if (!soldier.squadId) return undefined;
  const squad = ctx.squads.find((sq) => sq.id === soldier.squadId);
  return squad?.platoonId;
}

function checkSquadPolicy(
  soldier: Soldier,
  mission: Mission,
  // slot reserved for future per-slot policies; kept in signature so
  // callers always pass full context (interface stability)
  _slot: MaterializedSlot,
  ctx: EngineContext,
): boolean {
  void _slot;
  const policy = mission.squadPolicy;
  if (!policy || policy.mode === 'mix') return false;

  if (policy.mode === 'specific') {
    const allowed = policy.allowedSquadIds ?? [];
    return !(soldier.squadId && allowed.includes(soldier.squadId));
  }

  if (policy.mode === 'no-mix') {
    // If no soldiers have been picked yet, any squad is fine. If some
    // have been picked, the candidate must be from the same squad.
    const alreadyPickedIds = ctx.alreadyPickedForSlot ?? [];
    if (alreadyPickedIds.length === 0) return false;
    const firstPicked = ctx.soldiers.find((s) => s.id === alreadyPickedIds[0]);
    const firstSquad = firstPicked?.squadId;
    return firstSquad !== soldier.squadId;
  }

  return false;
}

function hasTimeConflict(
  soldierId: string,
  slot: MaterializedSlot,
  ctx: EngineContext,
): boolean {
  // Same-slot duplicate guard — cheapest check first.
  if ((ctx.alreadyPickedForSlot ?? []).includes(soldierId)) return true;

  // Cross-slot conflict: real enforcement now that ctx.allSlots is
  // populated. The soldier is in conflict if they're assigned to ANY
  // other slot whose time window overlaps with this one AND archetype
  // policy does not permit the overlap.
  const allSlots = ctx.allSlots;
  if (!allSlots || allSlots.length === 0) return false;

  const slotStartMs = Date.parse(slot.start);
  const slotEndMs   = Date.parse(slot.end);
  if (Number.isNaN(slotStartMs) || Number.isNaN(slotEndMs)) return false;

  const thisMission = ctx.missions.find((m) => m.id === slot.missionId);

  for (const other of allSlots) {
    if (other.id === slot.id) continue;
    const isAssigned =
      other.assignedSoldierIds.includes(soldierId)
      || other.commanderSoldierId === soldierId;
    if (!isAssigned) continue;

    const otherStartMs = Date.parse(other.start);
    const otherEndMs   = Date.parse(other.end);
    if (otherStartMs >= slotEndMs || otherEndMs <= slotStartMs) continue;

    // Overlapping commitment. Both archetypes must EXPLICITLY consent
    // to overlap (symmetrical policy). When either side forbids, the
    // soldier is in conflict.
    const otherMission = ctx.missions.find((m) => m.id === other.missionId);
    if (!thisMission || !otherMission) return true;
    if (!isOverlapPermitted(thisMission, otherMission)) return true;
  }
  return false;
}

/**
 * Symmetrical archetype-aware overlap check. The active soldier is on
 * mission A and a candidate slot belongs to mission B (or vice versa).
 * Overlap is permitted ONLY when both missions' effective overlap
 * policy includes the OTHER's intensity in their activeOverlap list.
 *
 * The clean-engine invariant: this is the ONE place the engine looks
 * at archetype behavior for overlap. Anything else stays through the
 * existing MissionOverlapPolicy values the wizard wrote.
 */
function isOverlapPermitted(a: Mission, b: Mission): boolean {
  const aBehavior = getArchetypeBehavior(a);
  const bBehavior = getArchetypeBehavior(b);
  // Patrol forbids EVERYTHING — short-circuit before even checking
  // the activeOverlap list (movement-based archetype invariant).
  if (aBehavior.forbidsParallelAssignment) return false;
  if (bBehavior.forbidsParallelAssignment) return false;
  const aPolicy = aBehavior.effectiveOverlapPolicy;
  const bPolicy = bBehavior.effectiveOverlapPolicy;
  return aPolicy.activeOverlap.includes(b.fatigue.intensity)
      && bPolicy.activeOverlap.includes(a.fatigue.intensity);
}

function hasCriticalEquipmentGap(
  soldier: Soldier,
  requirements: EquipmentRequirement[],
  ctx: EngineContext,
): boolean {
  // Only `level === 'critical'` requirements are hard filters. The
  // selector handles 'required' and 'soft' as score penalties.
  const critical = requirements.filter((r) => r.level === 'critical');
  if (critical.length === 0) return false;

  const signed = ctx.signedEquipment
    .filter((se) => se.soldierId === soldier.id && se.status === 'active')
    .map((se) => se.equipmentItemId)
    .filter(Boolean) as string[];

  return critical.some((req) => !signed.includes(req.equipmentItemId));
}
