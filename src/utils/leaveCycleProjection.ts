// ─── Leave cycle projection ─────────────────────────────────────────────────
//
// Three responsibilities:
//
//   1. segmentsCoveringDay — return the segments active on a given day. Used
//      by Calendar (cycle filter) + the CC dashboard's "today's cycle picture"
//      widget + the per-soldier cycle inference.
//
//   2. inferSoldierCycleStateForDay — for a single soldier, on a given day:
//      'home-by-cycle' (their platoon/squad/soldier scope is in a home segment),
//      'base-locked'   (their scope is in a base-locked segment),
//      'home-by-individual-leave' (an individual approved Leave overlaps),
//      'none'.
//      The 'home-by-individual-leave' tag wins over a cycle 'home' tag — both
//      may be true; we keep the most-specific signal.
//
//   3. floorViolations — given a cycle + soldier roster + minSoldiersOnBase,
//      list dates where the cycle segments would push the company below
//      its floor.
//
// Pure functions. Heavy use of memoization at the page level.
//
// Scale: O(segments × days × soldiers). For a cycle of 30 segments × 30 days
// × 150 soldiers ≈ 135k ops per render. Run once at page mount with useMemo.
// Server-side: this same function ports to a single SQL window-function pass.

import type {
  PlatoonLeaveCycle, PlatoonLeaveCycleSegment,
  Soldier, Squad, Leave,
} from '../types';

export type SoldierCycleStateForDay =
  | 'home-by-cycle'
  | 'home-by-individual-leave'
  | 'base-locked'
  | 'none';

export interface CycleLookups {
  soldiers: Soldier[];
  squads:   Squad[];
  leaves:   Leave[];
}

/** Predicate: does segment cover day? Inclusive both ends. */
function segmentCovers(seg: PlatoonLeaveCycleSegment, dayIso: string): boolean {
  return dayIso >= seg.startDate && dayIso <= seg.endDate;
}

/** Expand a segment scope to a set of soldier ids. */
function scopeSoldiers(
  seg: PlatoonLeaveCycleSegment,
  { soldiers, squads }: { soldiers: Soldier[]; squads: Squad[] },
): Set<string> {
  // Extract narrowed scope to a local — closures inside .filter() lose
  // discriminated-union narrowing of `seg.scope` otherwise.
  const scope = seg.scope;
  switch (scope.kind) {
    case 'platoon': {
      const platoonId = scope.platoonId;
      const sqIds = new Set(squads.filter((sq) => sq.platoonId === platoonId).map((sq) => sq.id));
      return new Set(
        soldiers.filter((s) => s.squadId && sqIds.has(s.squadId)).map((s) => s.id),
      );
    }
    case 'squad': {
      const squadId = scope.squadId;
      return new Set(soldiers.filter((s) => s.squadId === squadId).map((s) => s.id));
    }
    case 'soldiers':
      return new Set(scope.soldierIds);
  }
}

/** Does this soldier fall within the segment's scope? */
function soldierInSegment(
  segment: PlatoonLeaveCycleSegment,
  soldier: Soldier,
  squads: Squad[],
): boolean {
  const scope = segment.scope;
  switch (scope.kind) {
    case 'platoon': {
      const platoonId = scope.platoonId;
      return squads.some((sq) =>
        sq.platoonId === platoonId && sq.id === soldier.squadId,
      );
    }
    case 'squad':
      return soldier.squadId === scope.squadId;
    case 'soldiers':
      return scope.soldierIds.includes(soldier.id);
  }
}

/** Return all segments covering the day, sorted by kind (home first). */
export function segmentsCoveringDay(
  cycle: PlatoonLeaveCycle | null,
  dayIso: string,
): PlatoonLeaveCycleSegment[] {
  if (!cycle) return [];
  return cycle.segments
    .filter((seg) => segmentCovers(seg, dayIso))
    .sort((a, b) => a.kind.localeCompare(b.kind));
}

export function inferSoldierCycleStateForDay(
  cycle: PlatoonLeaveCycle | null,
  soldier: Soldier,
  dayIso: string,
  { squads, leaves }: { squads: Squad[]; leaves: Leave[] },
): SoldierCycleStateForDay {
  // 1. Individual leave wins. If a Leave overlaps and references this soldier.
  const onLeave = leaves.some((lv) => {
    if (dayIso < lv.startDate || dayIso > lv.endDate) return false;
    if (lv.scope === 'individual') return lv.soldierIds.includes(soldier.id);
    if (lv.scope === 'squad')      return lv.squadId === soldier.squadId;
    if (lv.scope === 'machlaka')   return true; // platoon-wide leave, simplified
    return false;
  });
  if (onLeave) return 'home-by-individual-leave';

  // 2. Cycle segments
  if (cycle) {
    const matchingHome = cycle.segments.find((seg) =>
      segmentCovers(seg, dayIso) && seg.kind === 'home' && soldierInSegment(seg, soldier, squads),
    );
    if (matchingHome) return 'home-by-cycle';

    const matchingBase = cycle.segments.find((seg) =>
      segmentCovers(seg, dayIso) && seg.kind === 'base-locked' && soldierInSegment(seg, soldier, squads),
    );
    if (matchingBase) return 'base-locked';
  }

  return 'none';
}

export interface FloorViolation {
  dayIso: string;
  soldiersAtHome: number;
  totalSoldiers: number;
  soldiersOnBaseProjected: number;
  minSoldiersOnBase: number;
  shortfall: number;
}

/** Walk each day in the cycle, count soldiers projected home (by cycle OR
 *  individual leave), and surface days that violate the floor. */
export function floorViolations(
  cycle: PlatoonLeaveCycle,
  minSoldiersOnBase: number,
  lookups: CycleLookups,
): FloorViolation[] {
  if (cycle.segments.length === 0) return [];

  const totalSoldiers = lookups.soldiers.length;
  if (totalSoldiers === 0) return [];

  // Compute the cycle's overall date window.
  const startDate = cycle.segments.reduce((min, s) => s.startDate < min ? s.startDate : min, cycle.segments[0].startDate);
  const endDate   = cycle.segments.reduce((max, s) => s.endDate   > max ? s.endDate   : max, cycle.segments[0].endDate);

  const violations: FloorViolation[] = [];
  const cursor = new Date(startDate);
  const last   = new Date(endDate);
  while (cursor <= last) {
    const dayIso = cursor.toISOString().slice(0, 10);

    // Union of soldiers at home (from cycle) on this day
    const atHome = new Set<string>();
    for (const seg of cycle.segments) {
      if (seg.kind !== 'home') continue;
      if (!segmentCovers(seg, dayIso)) continue;
      for (const id of scopeSoldiers(seg, lookups)) atHome.add(id);
    }
    // Also count individual leaves overlapping this day
    for (const lv of lookups.leaves) {
      if (dayIso < lv.startDate || dayIso > lv.endDate) continue;
      if (lv.scope === 'individual') lv.soldierIds.forEach((id) => atHome.add(id));
      else if (lv.scope === 'squad' && lv.squadId) {
        lookups.soldiers
          .filter((s) => s.squadId === lv.squadId)
          .forEach((s) => atHome.add(s.id));
      } else if (lv.scope === 'machlaka') {
        // platoon-wide — treat all soldiers
        lookups.soldiers.forEach((s) => atHome.add(s.id));
      }
    }

    const projectedOnBase = totalSoldiers - atHome.size;
    if (projectedOnBase < minSoldiersOnBase) {
      violations.push({
        dayIso,
        soldiersAtHome: atHome.size,
        totalSoldiers,
        soldiersOnBaseProjected: projectedOnBase,
        minSoldiersOnBase,
        shortfall: minSoldiersOnBase - projectedOnBase,
      });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return violations;
}

/** Find the segment whose window covers today AND scope covers the soldier.
 *  Returns the most-specific match (soldiers > squad > platoon). */
export function activeSegmentForSoldier(
  cycle: PlatoonLeaveCycle | null,
  soldier: Soldier,
  dayIso: string,
  squads: Squad[],
): PlatoonLeaveCycleSegment | null {
  if (!cycle) return null;
  const candidates = cycle.segments.filter((seg) =>
    segmentCovers(seg, dayIso) && soldierInSegment(seg, soldier, squads),
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const rank = (k: PlatoonLeaveCycleSegment['scope']['kind']) =>
      k === 'soldiers' ? 0 : k === 'squad' ? 1 : 2;
    return rank(a.scope.kind) - rank(b.scope.kind);
  });
  return candidates[0];
}
