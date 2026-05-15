// engine/ — pure scheduling engine (Phase 6.1).
//
// All functions exported here are PURE:
//   • input: EngineContext + entity arguments
//   • output: typed result
//   • no side effects, no async, no DB, no React, no clock reads
//
// The engine is portable: same context → same output on client, server,
// in tests, or replayed from an audit snapshot.

export {
  GLOBAL_FATIGUE_DEFAULTS,
  DEFAULT_BURDEN_WEIGHTS,
  OPERATIONAL_MODE_PROFILES,
  resolveRequiredRestHours,
  resolveFatiguePolicy,
} from './defaults';

export { evaluateHardFilters } from './hardFilters';

export { scoreCandidate } from './scoring';

export { computeBurden, markOverShoot } from './burden';

export { selectCandidates } from './selector';

export { buildFocusItems } from './focus';
