// scoring.ts — per-soldier-per-slot score.
//
// Pure function: (soldier, slot, ctx) → CandidateScore.
// Each candidate gets a final 0-100 score AND a per-dimension breakdown
// with `explain` strings so the staffing UI tooltip shows WHY.
//
// Five dimensions:
//   1. load        — current load vs platoon max (lower load = higher score)
//   2. fatigue     — hours since last shift vs required rest
//   3. qualMatch   — how well soldier's qualifications match the slot
//   4. cohesion    — same-squad bonus when squad-policy is mix
//   5. burden      — composite fairness penalty (negative score impact)
//
// Hard filters are evaluated separately (see hardFilters.ts). This
// function is called even for soldiers who fail hard filters — the
// operator may want to override, and the score helps them choose.

import type {
  EngineContext, CandidateScore, CandidateScoreDimension, Soldier, Mission,
} from '../../types';
import type { MaterializedSlot } from '../materialize';
import { evaluateHardFilters } from './hardFilters';
import { resolveRequiredRestHours } from './defaults';

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Build the full CandidateScore for one soldier on one slot.
 *
 * Final score weights:
 *   load:      0.30
 *   fatigue:   0.25
 *   qualMatch: 0.20
 *   cohesion:  0.15
 *   burden:    0.10 (penalty applied with negative weight)
 *
 * Note: burden is a PENALTY (subtracted), so its value field is the
 * raw 0-100 burden score, and the multiplier converts it to a negative
 * contribution to the final score.
 */
export function scoreCandidate(
  soldier: Soldier,
  slot: MaterializedSlot,
  ctx: EngineContext,
): CandidateScore {
  const hardFiltersFailed = evaluateHardFilters(soldier, slot, ctx);

  const dimensions: CandidateScoreDimension[] = [
    computeLoad(soldier, ctx),
    computeFatigue(soldier, slot, ctx),
    computeQualMatch(soldier, slot, ctx),
    computeCohesion(soldier, slot, ctx),
    computeBurdenPenalty(soldier, ctx),
  ];

  // Weighted blend. Burden is a penalty.
  const burdenPenalty = ctx.modeProfile.burdenPenaltyMultiplier;
  let score = clamp(
      0.30 * dimensions[0].value
    + 0.25 * dimensions[1].value
    + 0.20 * dimensions[2].value
    + 0.15 * dimensions[3].value
    - 0.10 * burdenPenalty * dimensions[4].value,
    0, 100,
  );

  // Priority pin — SOFT bonus only. STRICT INVARIANT (must not regress):
  //
  //   1. `hardFiltersFailed` is computed BEFORE pin logic touches the
  //      score, and is returned UNCHANGED. A pinned soldier who fails
  //      a hard filter still has those codes recorded.
  //
  //   2. The selector partitions candidates by
  //      `hardFiltersFailed.length === 0` — pin bonus cannot move a
  //      candidate from `forced` to `clean`.
  //
  //   3. Within each partition, pin bonus reorders by raising the
  //      candidate's score. That's the maximum legitimate effect.
  //
  // Pin = human PREFERENCE, not a system bypass. The operator must
  // still consciously confirm any forced candidate (pinned or not).
  //
  // ⚠ If a future refactor moves pin logic to `evaluateHardFilters`
  // or removes a hard-filter check based on pin presence, this
  // invariant is broken. Reviewers MUST reject such a change.
  const pinBonus = computePinBonus(soldier, slot, ctx);
  if (pinBonus > 0) {
    score = clamp(score + pinBonus, 0, 100);
  }

  return {
    soldierId: soldier.id,
    slotId: slot.id,
    score,
    hardFiltersFailed,
    dimensions,
  };
}

// ─── Dimension calculators ─────────────────────────────────────────

function computeLoad(soldier: Soldier, ctx: EngineContext): CandidateScoreDimension {
  // Lower currentLoad → higher score. Normalize against platoon max.
  const platoonSoldiers = filterToSamePlatoon(soldier, ctx);
  const maxLoad = Math.max(1, ...platoonSoldiers.map((s) => s.currentLoad));
  const ratio = soldier.currentLoad / maxLoad;
  const value = clamp((1 - ratio) * 100, 0, 100);

  const explain = `עומס ${soldier.currentLoad} (מקסימום במחלקה ${maxLoad})`;

  return { key: 'load', value, explain };
}

function computeFatigue(
  _soldier: Soldier,
  slot: MaterializedSlot,
  ctx: EngineContext,
): CandidateScoreDimension {
  // soldier reserved for future per-soldier fatigue lookup (last shift)
  void _soldier;
  const slotLengthHours = (Date.parse(slot.end) - Date.parse(slot.start)) / MS_PER_HOUR;
  const requiredRest = resolveRequiredRestHours(
    ctx.fatiguePolicy,
    slotLengthHours,
    ctx.modeProfile.fatigueRestMultiplier,
  );

  // Find the soldier's most recent slot end before this slot starts.
  // We need allSlots here — for now, conservatively check soldier's
  // statusSetAt as a proxy. Phase 6.1.1 will add allSlots to context.
  const slotStartMs = Date.parse(slot.start);
  const lastShiftEndMs = slotStartMs - 24 * MS_PER_HOUR; // pessimistic stub
  const hoursSince = (slotStartMs - lastShiftEndMs) / MS_PER_HOUR;

  let value: number;
  let explain: string;

  if (hoursSince >= requiredRest) {
    value = 100;
    explain = `${Math.floor(hoursSince)} שעות מנוחה (נדרש ${requiredRest})`;
  } else if (hoursSince > 0) {
    value = clamp(hoursSince / requiredRest * 100, 0, 100);
    explain = `רק ${Math.floor(hoursSince)} שעות מנוחה (חסר ${Math.ceil(requiredRest - hoursSince)})`;
  } else {
    value = 0;
    explain = `אין מנוחה — עייפות חריגה`;
  }

  return { key: 'fatigue', value, explain };
}

function computeQualMatch(
  soldier: Soldier,
  slot: MaterializedSlot,
  ctx: EngineContext,
): CandidateScoreDimension {
  const mission = ctx.missions.find((m) => m.id === slot.missionId);
  if (!mission || mission.qualifications.length === 0) {
    return {
      key: 'qualMatch',
      value: 50,
      explain: 'אין דרישות הכשרה',
    };
  }

  const soldierQuals = new Set(
    ctx.qualifications
      .filter((q) => q.soldierId === soldier.id)
      .map((q) => q.qualificationId),
  );

  const required = mission.qualifications.map((r) => r.qualificationId);
  const matched = required.filter((id) => soldierQuals.has(id)).length;
  const extra = Array.from(soldierQuals).filter((id) => !required.includes(id)).length;

  if (matched < required.length) {
    return {
      key: 'qualMatch',
      value: 0,
      explain: `חסר ${required.length - matched} מתוך ${required.length} כישורים נדרשים`,
    };
  }

  // All required met. Extra quals bump score for "versatile soldiers"
  // — but we cap. The penalty for using a versatile soldier on a basic
  // task is handled elsewhere (anti-waste of versatility).
  const value = clamp(50 + Math.min(extra, 5) * 10, 50, 100);
  const explain = extra > 0
    ? `כל הכישורים הנדרשים + ${extra} נוספים`
    : `כל הכישורים הנדרשים`;

  return { key: 'qualMatch', value, explain };
}

function computeCohesion(
  soldier: Soldier,
  slot: MaterializedSlot,
  ctx: EngineContext,
): CandidateScoreDimension {
  void slot;
  const mission = ctx.missions.find((m) => m.id === slot.missionId);
  const alreadyPicked = ctx.alreadyPickedForSlot ?? [];

  // No cohesion to evaluate when slot is empty.
  if (alreadyPicked.length === 0) {
    return {
      key: 'cohesion',
      value: 80,
      explain: 'משבצת ריקה — אין השפעת לכידות',
    };
  }

  // Cohesion preference depends on squad policy.
  if (mission?.squadPolicy.mode === 'mix') {
    return {
      key: 'cohesion',
      value: 50,
      explain: 'מדיניות mix — כל כיתה מתאימה',
    };
  }

  const firstPicked = ctx.soldiers.find((s) => s.id === alreadyPicked[0]);
  if (!firstPicked) {
    return {
      key: 'cohesion',
      value: 50,
      explain: 'אין מידע על שיבוץ קודם',
    };
  }

  if (soldier.squadId && firstPicked.squadId && soldier.squadId === firstPicked.squadId) {
    return {
      key: 'cohesion',
      value: 100,
      explain: `אותה כיתה (${firstPicked.squadId})`,
    };
  }

  return {
    key: 'cohesion',
    value: 30,
    explain: 'כיתה שונה מהמשבצת',
  };
}

function computeBurdenPenalty(soldier: Soldier, ctx: EngineContext): CandidateScoreDimension {
  const burden = ctx.burdens[soldier.id];
  if (!burden) {
    return {
      key: 'burden',
      value: 0,
      explain: 'אין נתוני שחיקה — מתעלם',
    };
  }

  return {
    key: 'burden',
    value: burden.burdenScore,
    explain: burden.headline,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────

function filterToSamePlatoon(soldier: Soldier, ctx: EngineContext): Soldier[] {
  const soldierSquad = ctx.squads.find((sq) => sq.id === soldier.squadId);
  if (!soldierSquad) return ctx.soldiers;
  const platoonId = soldierSquad.platoonId;
  const platoonSquadIds = new Set(
    ctx.squads.filter((sq) => sq.platoonId === platoonId).map((sq) => sq.id),
  );
  return ctx.soldiers.filter((s) => s.squadId && platoonSquadIds.has(s.squadId));
}

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/** Compute the priority-pin bonus for one candidate. Returns 0 when no
 *  active matching pin exists. Pin scopes are checked in this order:
 *  slot-specific → mission-specific → global. First-match wins.
 *  Expired pins (expiresAt < ctx.computedAt) are ignored. */
function computePinBonus(
  soldier: Soldier,
  slot: MaterializedSlot,
  ctx: EngineContext,
): number {
  const pins = ctx.priorityPins;
  if (!pins || pins.length === 0) return 0;

  const nowMs = Date.parse(ctx.computedAt);
  const activePinsForSoldier = pins.filter((p) => {
    if (p.soldierId !== soldier.id) return false;
    if (p.expiresAt && Date.parse(p.expiresAt) < nowMs) return false;
    return true;
  });

  for (const pin of activePinsForSoldier) {
    if (pin.scope.kind === 'slot' && pin.scope.slotId === slot.id) return 15;
    if (pin.scope.kind === 'mission' && pin.scope.missionId === slot.missionId) return 15;
    if (pin.scope.kind === 'global') return 10; // slightly softer for global
  }
  return 0;
}

// Mission imported for type narrowing in function signatures above
export type { Mission };
