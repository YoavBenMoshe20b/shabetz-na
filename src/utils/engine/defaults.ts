// defaults.ts — engine-wide tunable constants.
//
// These are the FALLBACK values used when neither the mission nor the
// company has overridden them. Engine code MUST resolve via:
//
//   mission.fatigueOverride
//   ?? company.settings.fatigue
//   ?? GLOBAL_FATIGUE_DEFAULTS
//
// Keeping defaults centralized makes them auditable + replaceable
// without touching the engine pipeline.

import type {
  BurdenWeights, FatiguePolicy, OperationalMode, OperationalModeProfile,
} from '../../types';

/**
 * Default fatigue rules — Phase 6.0 baseline.
 *
 * Rule: shift-length in hours → required-rest hours BEFORE next shift.
 * Engine lookup uses largest-key-≤-shift-length.
 *
 *  shift   →  rest
 *  ──────────────
 *  ≤  8h   →   8h    (8/8 cycle)
 *  ≤ 12h   →  12h    (12/12)
 *  ≤ 24h   →  24h    (after a full day)
 *  ≤ 48h   →  36h    (after 2 days, partial recovery)
 *
 *  consecutive base days cap: 14
 *  computation window:        30 days
 */
export const GLOBAL_FATIGUE_DEFAULTS: FatiguePolicy = {
  minRestHoursByShiftLength: {
    8:  8,
    12: 12,
    24: 24,
    48: 36,
  },
  consecutiveBaseDaysCap: 14,
  computationWindowDays:  30,
};

/**
 * Default burden weights — Phase 6.0 baseline.
 *
 * The four factors of the burden composite. Sums to 1.00. Each factor
 * encapsulates 2-4 raw signals (see burden.ts). The weights here are
 * the FACTOR weights, not the per-signal weights.
 *
 * Re-review after 4 weeks of usage data.
 */
export const DEFAULT_BURDEN_WEIGHTS: BurdenWeights = {
  workIntensity:   0.35,
  recoveryDeficit: 0.30,
  rotationPattern: 0.20,
  stressLoad:      0.15,
};

/**
 * Operational mode profiles. Each mode is a MULTIPLIER on engine
 * defaults. 'normal' is identity (1.0). 'elevated' tightens fairness
 * marginally. 'emergency' loosens fatigue and softens fairness so the
 * engine doesn't block urgent operations.
 *
 * These are POLICY values, not technology. Treat as configuration that
 * the CC's command structure controls per situation.
 */
export const OPERATIONAL_MODE_PROFILES: Record<OperationalMode, OperationalModeProfile> = {
  normal: {
    mode: 'normal',
    fatigueRestMultiplier:   1.0,
    burdenPenaltyMultiplier: 1.0,
    severityEscalation:      'none',
  },
  elevated: {
    mode: 'elevated',
    fatigueRestMultiplier:   0.75,
    burdenPenaltyMultiplier: 0.75,
    severityEscalation:      'warning-to-critical',
  },
  emergency: {
    mode: 'emergency',
    fatigueRestMultiplier:   0.50,
    burdenPenaltyMultiplier: 0.30,
    severityEscalation:      'all-up-one',
  },
};

/**
 * The single source of truth for "given a shift length, how many hours
 * of rest does the policy require?" — replaces ad-hoc lookups.
 */
export function resolveRequiredRestHours(
  policy: FatiguePolicy,
  shiftLengthHours: number,
  modeMultiplier = 1.0,
): number {
  const keys = Object.keys(policy.minRestHoursByShiftLength)
    .map((k) => Number(k))
    .filter((k) => !Number.isNaN(k))
    .sort((a, b) => a - b);

  if (keys.length === 0) return 8 * modeMultiplier;

  // Find largest key ≤ shiftLengthHours. If none, use smallest bracket.
  let bracket = keys[0];
  for (const k of keys) {
    if (k <= shiftLengthHours) bracket = k;
    else break;
  }
  const baseHours = policy.minRestHoursByShiftLength[bracket];
  return baseHours * modeMultiplier;
}

/** Convenience for callers that want to resolve fatigue policy with
 *  the mission > company > defaults hierarchy applied. */
export function resolveFatiguePolicy(
  missionOverride: FatiguePolicy | undefined,
  companyPolicy:   FatiguePolicy | undefined,
): FatiguePolicy {
  return missionOverride ?? companyPolicy ?? GLOBAL_FATIGUE_DEFAULTS;
}
