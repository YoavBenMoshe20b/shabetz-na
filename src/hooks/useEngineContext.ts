// useEngineContext — the boundary between React state and the pure engine.
//
// This is the ONLY place where impure code (React, AppContext, Date.now)
// touches the engine. Every engine function downstream receives the
// returned EngineContext and produces deterministic output.
//
// Keeping the boundary at one location:
//   • lets us swap the source (server snapshot, local cache, mock fixture)
//     without changing any engine code
//   • makes the engine itself fully testable with synthesized contexts
//   • enables replay — pass a frozen `computedAt` + state snapshot
//     and get the exact same engine outputs

import { useMemo } from 'react';
import { useApp, useMyCompany } from '../context/AppContext';
import { resolveFatiguePolicy, OPERATIONAL_MODE_PROFILES, DEFAULT_BURDEN_WEIGHTS } from '../utils/engine';
import { computeBurden, markOverShoot } from '../utils/engine/burden';
import { materializeWeek } from '../utils/materialize';
import type {
  EngineContext, OperationalMode, SoldierBurden,
} from '../types';

interface UseEngineContextOptions {
  /** When provided, overrides "now" — useful for replay and tests. */
  asOfIso?: string;
  /** When provided, overrides the company's mode for what-if analysis. */
  modeOverride?: OperationalMode;
  /** When set, burdens are precomputed for these soldiers. Defaults to all. */
  computeBurdenForSoldierIds?: string[];
}

/**
 * Build an EngineContext from the live AppContext state.
 *
 * Memoization: stable as long as the underlying entity arrays don't
 * change. When the soldier array changes, the burdens map is recomputed.
 * The component using this hook re-renders only when something
 * downstream uses changes.
 */
export function useEngineContext(options: UseEngineContextOptions = {}): EngineContext {
  const app = useApp();
  const myCompany = useMyCompany();

  const computedAt = options.asOfIso ?? new Date().toISOString();
  const mode = options.modeOverride ?? 'normal';

  const fatiguePolicy = resolveFatiguePolicy(undefined, myCompany?.settings.fatigue);
  const modeProfile = OPERATIONAL_MODE_PROFILES[mode];

  // Materialize the current week so burden has slots to count.
  const todayStart = useMemo(() => {
    const d = new Date(computedAt);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [computedAt]);

  const allSlots = useMemo(
    () => materializeWeek({
      missions: app.missions,
      platoons: app.platoons,
      squads: app.squads,
      soldiers: app.soldiers,
      leaves: app.leaves,
      dutyExclusions: app.dutyExclusions,
      startDay: todayStart,
      days: 7,
      assignments: app.assignments,
      slotOperationalState: app.slotOperationalState,
      platoonLeaveDays: app.platoonLeaveDays,
      soldierLeaveOverrides: app.soldierLeaveOverrides,
    }),
    [app.missions, app.platoons, app.squads, app.soldiers, app.leaves, app.dutyExclusions, todayStart, app.assignments, app.slotOperationalState, app.platoonLeaveDays, app.soldierLeaveOverrides],
  );

  // Precompute burden per soldier. The context carries these so the
  // selector / scoring functions don't recompute per call.
  const burdens: Record<string, SoldierBurden> = useMemo(() => {
    const targetIds = options.computeBurdenForSoldierIds
      ?? app.soldiers.map((s) => s.id);

    // Build a minimal ctx-shape for the burden computer. computeBurden
    // does NOT recursively call computeBurden, so this is safe.
    const partialCtx: EngineContext = {
      computedAt,
      modeProfile,
      soldiers: app.soldiers,
      platoons: app.platoons,
      squads: app.squads,
      missions: app.missions,
      leaves: app.leaves,
      dutyExclusions: app.dutyExclusions,
      statusEvents: app.soldierStatusEvents,
      signedEquipment: app.signedEquipment,
      qualifications: app.soldierQualifications,
      logisticsRotations: app.logisticsRotations,
      fatiguePolicy,
      burdenWeights: DEFAULT_BURDEN_WEIGHTS,
      burdens: {},
    };

    const out: Record<string, SoldierBurden> = {};
    for (const id of targetIds) {
      const soldier = app.soldiers.find((s) => s.id === id);
      if (!soldier) continue;
      out[id] = computeBurden(soldier, allSlots, partialCtx);
    }
    // Mark p75 over-shooters across the whole computed set.
    markOverShoot(out);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Recompute on the underlying entities. Deliberately not depending on
    // options.computeBurdenForSoldierIds — the caller controls scope.
    app.soldiers, app.platoons, app.squads, app.missions, app.leaves,
    app.dutyExclusions, app.soldierStatusEvents, app.signedEquipment,
    app.soldierQualifications, app.logisticsRotations, allSlots, computedAt,
    fatiguePolicy, modeProfile,
  ]);

  return useMemo(() => ({
    computedAt,
    modeProfile,
    soldiers: app.soldiers,
    platoons: app.platoons,
    squads: app.squads,
    missions: app.missions,
    leaves: app.leaves,
    dutyExclusions: app.dutyExclusions,
    statusEvents: app.soldierStatusEvents,
    signedEquipment: app.signedEquipment,
    qualifications: app.soldierQualifications,
    logisticsRotations: app.logisticsRotations,
    fatiguePolicy,
    burdenWeights: DEFAULT_BURDEN_WEIGHTS,
    burdens,
    // Phase 7.3 — engine now receives the full slot snapshot so cross-
    // slot overlap, rest windows, and effectiveFatigueWeight all work.
    // MaterializedSlot structurally satisfies EngineSlotSnapshot.
    allSlots,
  }), [
    computedAt, modeProfile,
    app.soldiers, app.platoons, app.squads, app.missions, app.leaves,
    app.dutyExclusions, app.soldierStatusEvents, app.signedEquipment,
    app.soldierQualifications, app.logisticsRotations,
    fatiguePolicy, burdens, allSlots,
  ]);
}

/** Materialized slot array — exposed alongside the engine context so
 *  pages that need to enumerate slots (e.g. StaffingSheet listing
 *  candidate slots for a mission) don't re-materialize. */
export function useMaterializedWeek(asOfIso?: string) {
  const app = useApp();
  const todayStart = useMemo(() => {
    const d = asOfIso ? new Date(asOfIso) : new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [asOfIso]);

  return useMemo(
    () => materializeWeek({
      missions: app.missions,
      platoons: app.platoons,
      squads: app.squads,
      soldiers: app.soldiers,
      leaves: app.leaves,
      dutyExclusions: app.dutyExclusions,
      startDay: todayStart,
      days: 7,
      assignments: app.assignments,
      slotOperationalState: app.slotOperationalState,
      platoonLeaveDays: app.platoonLeaveDays,
      soldierLeaveOverrides: app.soldierLeaveOverrides,
    }),
    [app.missions, app.platoons, app.squads, app.soldiers, app.leaves, app.dutyExclusions, todayStart, app.assignments, app.slotOperationalState, app.platoonLeaveDays, app.soldierLeaveOverrides],
  );
}
