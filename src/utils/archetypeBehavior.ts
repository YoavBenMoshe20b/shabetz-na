// Archetype runtime behavior — the single funnel between an
// archetype's STATIC declaration (kind, flags, defaults) and the
// RUNTIME decisions the materializer + UI make about a mission.
//
// Read by:
//   • materializeWeek — slot tagging, day/night splitting
//   • MissionDetailPage — warning ribbon + honest implementation status
//   • assignment / staffing surfaces — soft warnings
//
// CLEAN ENGINE INVARIANT: no scattered if (mission.archetypeKind === 'x')
// outside this module. Everything goes through getArchetypeBehavior.
//
// HONESTY INVARIANT: when the runtime cannot yet enforce a behavior the
// archetype promises (e.g. parallel-assignment allowance), the helper
// must report it as 'todo' in `implementationStatus` — so the UI can
// surface a visible warning instead of silently pretending it works.

import type {
  Mission, MissionArchetypeKind, MissionIntensity, MissionOverlapPolicy,
} from '../types';
import { MISSION_ARCHETYPES } from './missionArchetypes';

// ─── Implementation status — what's actually wired ──────────────────

/** 'wired' = the behavior is enforced at runtime by the engine.
 *  'partial' = it's enforced through populated values but the engine
 *              has no archetype-specific RULE.
 *  'todo' = not enforced at all yet; UI shows a visible warning. */
export type ImplStatus = 'wired' | 'partial' | 'todo';

export interface ImplementationStatus {
  /** Engine splits slots by day/night when archetype demands it. */
  slotSplitting: ImplStatus;
  /** Engine applies fatigue weight differentiated by archetype. */
  fatigueWeighting: ImplStatus;
  /** Engine enforces archetype's overlap policy in slot generation. */
  overlapEnforcement: ImplStatus;
  /** Engine allows parallel assignment when archetype is event-driven. */
  parallelAllowance: ImplStatus;
  /** Soldier surface shows rally-point + response-instructions. */
  responseSurface: ImplStatus;
  /** UI flags missing-required archetype fields as warnings. */
  warningSurface: ImplStatus;
}

// ─── The behavior object — what materializer & UI consume ───────────

export interface ArchetypeBehavior {
  kind: MissionArchetypeKind;

  // ── Slot generation ──────────────────────────────────────────────
  /** When true, materializer splits 24-7 or boundary-crossing windows
   *  into day-portion + night-portion slots so day/night durations and
   *  manpower can differ. */
  splitsByDayNight: boolean;
  dayStartTime?: string;       // "06:00"
  nightStartTime?: string;     // "22:00"
  dayShiftMinutes?: number;
  nightShiftMinutes?: number;
  dayMinCount?: number;
  nightMinCount?: number;

  // ── Staffing ─────────────────────────────────────────────────────
  /** Event-driven missions allow parallel assignment with non-conflicting
   *  duties. The current engine relies on overlapPolicy to enforce this;
   *  the flag here is the archetype-level INTENT. */
  allowsParallelAssignment: boolean;
  /** Movement-based missions cannot share time with anything else. */
  forbidsParallelAssignment: boolean;

  // ── Fatigue ──────────────────────────────────────────────────────
  /** The effective intensity for fatigue calculation. Mission's fatigue
   *  override wins; otherwise we use the archetype's default. */
  fatigueIntensity: MissionIntensity;
  fatigueWeight: number;
  /** Fatigue weight bump for the night portion of the mission. */
  nightFatigueBoost: number;

  // ── Overlap policy ───────────────────────────────────────────────
  effectiveOverlapPolicy: MissionOverlapPolicy;

  // ── Lifecycle ────────────────────────────────────────────────────
  supportsScheduledPublish: boolean;

  // ── Diagnostic / warnings ────────────────────────────────────────
  /** Human-readable warnings about misconfiguration (missing rally
   *  point, missing response instructions, etc.). Empty when clean. */
  warnings: ArchetypeWarning[];

  /** Honest "what does the engine actually do" status. */
  implementationStatus: ImplementationStatus;
}

export interface ArchetypeWarning {
  /** 'error' = will produce incorrect behavior; 'warn' = degraded UX. */
  severity: 'error' | 'warn' | 'info';
  /** Hebrew message shown to the operator. */
  message: string;
  /** Short tag for filtering ('missing-rally-point' etc.). */
  code: string;
}

// ─── The helper ─────────────────────────────────────────────────────

/** Resolve a mission's archetype kind. Missions written before Phase
 *  7.3 have no archetypeKind — they're treated as 'custom'. */
function resolveKind(mission: Mission): MissionArchetypeKind {
  return mission.archetypeKind ?? 'custom';
}

/** Compute archetype warnings for a mission — what's missing or
 *  misconfigured against its declared archetype. */
function computeWarnings(mission: Mission, kind: MissionArchetypeKind): ArchetypeWarning[] {
  const a = MISSION_ARCHETYPES[kind];
  const out: ArchetypeWarning[] = [];

  if (a.supportsRallyPoint && !mission.rallyPoint?.trim()) {
    out.push({
      severity: 'warn',
      code: 'missing-rally-point',
      message: 'משימת כוננות בלי נקודת ריכוז — חיילים לא יידעו לאן להתייצב.',
    });
  }
  if (a.supportsResponseInstructions && !mission.responseInstructions?.trim()) {
    out.push({
      severity: 'error',
      code: 'missing-response-instructions',
      message: 'משימת כוננות בלי הוראות תגובה — לא יוצגו לחיילים בעת אירוע.',
    });
  }
  if (a.supportsRoute && !mission.routeDescription?.trim()) {
    out.push({
      severity: 'warn',
      code: 'missing-route',
      message: 'סיור בלי מסלול / סקטור מוגדר — קשה לתדרך את הצוות.',
    });
  }
  // One-time op should have explicit start/end dates.
  if (kind === 'one-time-op' && (!mission.startDate || !mission.endDate)) {
    out.push({
      severity: 'warn',
      code: 'missing-one-time-window',
      message: 'מבצע חד-פעמי בלי תאריך התחלה/סיום — חלון זמן לא מובהק.',
    });
  }
  return out;
}

/** Current implementation status per archetype. Update this AS THE
 *  ENGINE GAINS BEHAVIOR. Lying here is what we explicitly promised
 *  the user we wouldn't do. */
function computeStatus(kind: MissionArchetypeKind): ImplementationStatus {
  // Defaults — Phase 7.3 second pass: fatigueWeighting, overlap, and
  // parallel allowance all now have RULE-LEVEL enforcement in the
  // engine (burden reads slot.effectiveFatigueWeight + night boost;
  // hardFilters.hasTimeConflict reads ctx.allSlots + archetype overlap
  // policy; readiness's isEventDriven flag flows into the symmetrical
  // overlap permission).
  const base: ImplementationStatus = {
    slotSplitting:      'todo',
    fatigueWeighting:   'wired',
    overlapEnforcement: 'wired',
    parallelAllowance:  'wired',
    responseSurface:    'partial',
    warningSurface:     'wired',
  };

  switch (kind) {
    case 'static-guard':
      // Day/night splitting IS wired (see splitDayNightWindows).
      // ResponseSurface n/a for static guard.
      return { ...base, slotSplitting: 'wired', responseSurface: 'wired' };
    case 'patrol':
      return { ...base, responseSurface: 'wired' };
    case 'readiness':
      // Response model (rally point + instructions + split teams) is
      // wired on the mission detail; per-soldier surface still partial
      // (CC sees teams, soldier still uses fallback mission-level view).
      return { ...base, responseSurface: 'partial' };
    case 'one-time-op':
      return { ...base, responseSurface: 'wired' };
    case 'custom':
      return {
        slotSplitting:      'wired',
        fatigueWeighting:   'wired',
        overlapEnforcement: 'wired',
        parallelAllowance:  'wired',
        responseSurface:    'wired',
        warningSurface:     'wired',
      };
  }
}

export function getArchetypeBehavior(mission: Mission): ArchetypeBehavior {
  const kind = resolveKind(mission);
  const a    = MISSION_ARCHETYPES[kind];
  const dn   = mission.dayNightProfile ?? a.defaultDraft.dayNightProfile;

  // splitsByDayNight is the engine-level decision: only true when (a)
  // archetype claims day/night support, (b) the profile defines day &
  // night shift durations, and (c) those durations DIFFER (otherwise
  // there's nothing to split).
  const splitsByDayNight =
    a.supportsDayNight
    && !!dn
    && !!dn.dayShiftDurationMinutes
    && !!dn.nightShiftDurationMinutes
    && dn.dayShiftDurationMinutes !== dn.nightShiftDurationMinutes;

  // Fatigue — mission.fatigue is set by the archetype's defaultDraft on
  // creation but the operator may have overridden it. Trust whichever
  // is populated (mission.fatigue is required by the type).
  const intensity = mission.fatigue.intensity;
  const fatigueWeight = mission.fatigue.fatigueWeight;
  // Night boost — 1.4× for archetypes whose profile says fatigue
  // differs by period. Keep small to avoid runaway burden growth.
  const nightFatigueBoost = dn?.fatigueDiffersByPeriod
    ? Math.round(fatigueWeight * 0.4)
    : 0;

  // Effective overlap policy — mission's own value wins; otherwise
  // archetype default; otherwise the safest baseline (empty arrays).
  const effectiveOverlapPolicy: MissionOverlapPolicy =
    mission.overlapPolicy
    ?? a.defaultDraft.overlapPolicy
    ?? { activeOverlap: [], restOverlap: [] };

  return {
    kind,

    splitsByDayNight,
    dayStartTime:       dn?.dayStartTime,
    nightStartTime:     dn?.nightStartTime,
    dayShiftMinutes:    dn?.dayShiftDurationMinutes,
    nightShiftMinutes:  dn?.nightShiftDurationMinutes,
    dayMinCount:        dn?.dayMinCount,
    nightMinCount:      dn?.nightMinCount,

    allowsParallelAssignment: a.isEventDriven,
    forbidsParallelAssignment: a.isMovementBased,

    fatigueIntensity:  intensity,
    fatigueWeight,
    nightFatigueBoost,

    effectiveOverlapPolicy,

    supportsScheduledPublish: a.supportsScheduledPublish,

    warnings: computeWarnings(mission, kind),
    implementationStatus: computeStatus(kind),
  };
}

// ─── Day/night window splitting helper ──────────────────────────────

export interface DayNightSegment {
  start: Date;
  end:   Date;
  partOfDay: 'day' | 'night';
  durationMinutes: number;
}

/**
 * Split a [start, end] window into day-portion + night-portion segments
 * driven by the archetype behavior. The engine creates ONE materialized
 * slot per segment so day-2h and night-3h shifts are first-class.
 *
 * For windows that don't cross the day/night boundary, returns a single
 * segment with the relevant part-of-day tag.
 *
 * `splitsByDayNight=false` callers should NOT use this — they get a
 * single segment back with partOfDay computed from the START time.
 */
export function splitDayNightWindows(
  start: Date,
  end: Date,
  behavior: ArchetypeBehavior,
): DayNightSegment[] {
  const dayStart = behavior.dayStartTime ?? '06:00';
  const nightStart = behavior.nightStartTime ?? '22:00';

  // Untagged path — just label which half of the day START falls into.
  if (!behavior.splitsByDayNight) {
    const partOfDay = partOfDayAt(start, dayStart, nightStart);
    return [{
      start, end, partOfDay,
      durationMinutes: minutesBetween(start, end),
    }];
  }

  // Splitting path — chop the window at the day/night boundaries and
  // then re-chop each portion into shift-duration sub-slots.
  const segments: DayNightSegment[] = [];
  let cursor = new Date(start);
  const safetyMax = 50;            // guard against pathological loops
  let i = 0;
  while (cursor < end && i < safetyMax) {
    i++;
    const part = partOfDayAt(cursor, dayStart, nightStart);
    const boundary = nextBoundary(cursor, dayStart, nightStart);
    const segmentEnd = boundary < end ? boundary : end;

    const targetMinutes = part === 'day'
      ? behavior.dayShiftMinutes ?? minutesBetween(cursor, segmentEnd)
      : behavior.nightShiftMinutes ?? minutesBetween(cursor, segmentEnd);

    // Slice this part-of-day chunk into shift-duration sub-slots.
    let subStart = new Date(cursor);
    while (subStart < segmentEnd) {
      const proposedEnd = new Date(subStart.getTime() + targetMinutes * 60_000);
      const subEnd = proposedEnd < segmentEnd ? proposedEnd : segmentEnd;
      segments.push({
        start: new Date(subStart),
        end:   new Date(subEnd),
        partOfDay: part,
        durationMinutes: minutesBetween(subStart, subEnd),
      });
      subStart = subEnd;
    }
    cursor = segmentEnd;
  }
  return segments;
}

function partOfDayAt(d: Date, dayStartHHmm: string, nightStartHHmm: string): 'day' | 'night' {
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (dayStartHHmm <= nightStartHHmm) {
    // Normal: day = [dayStart, nightStart)
    return hhmm >= dayStartHHmm && hhmm < nightStartHHmm ? 'day' : 'night';
  }
  // Wraps midnight (unusual; defensive).
  return hhmm >= dayStartHHmm || hhmm < nightStartHHmm ? 'day' : 'night';
}

/** Returns the next day/night boundary AFTER `from`. */
function nextBoundary(from: Date, dayStartHHmm: string, nightStartHHmm: string): Date {
  const candidates = [
    setHHmm(from, dayStartHHmm),
    setHHmm(from, nightStartHHmm),
  ];
  // Drop candidates that are <= from; if all are, jump to next day.
  const future = candidates.filter((c) => c > from);
  if (future.length === 0) {
    // Both boundaries already passed today — return tomorrow's earliest.
    const tomorrowDay = setHHmm(new Date(from.getTime() + 24 * 3600_000), dayStartHHmm);
    return tomorrowDay;
  }
  future.sort((a, b) => a.getTime() - b.getTime());
  return future[0];
}

function setHHmm(d: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const out = new Date(d);
  out.setHours(h, m, 0, 0);
  return out;
}

function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60_000));
}
