// Mission archetypes — the FIVE shapes the system actually understands.
//
// An archetype is not just a "template" (a Partial<Mission> literal). It
// is the BEHAVIOR DEFINITION the rest of the system reads:
//   • The wizard hides steps the archetype already answers
//     ("don't ask 'what do they do' for a static guard").
//   • The materializer reads behavior flags directly:
//       — isMovementBased → patrol's overlap rules
//       — isEventDriven   → readiness's parallel-assignment policy
//       — supportsDayNight → day/night-shaped staffing windows
//   • The UI reads behavior flags to surface the right affordances
//     (rally point input for readiness, route input for patrol).
//
// Adding a new archetype: extend MissionArchetypeKind, add a literal
// here. Do NOT extend by patching one of the existing five — every
// archetype must stand on its own.

import type {
  Mission, MissionCommandSpec, MissionFatigueProfile,
  MissionManpowerSpec, MissionOverlapPolicy, MissionRotation,
  MissionTimeModel, CommandRank, RankPolicy,
  MissionArchetypeKind, DayNightProfile,
} from '../types';

export type { MissionArchetypeKind, DayNightProfile };

export const DEFAULT_DAY_NIGHT: DayNightProfile = {
  dayStartTime:   '06:00',
  nightStartTime: '22:00',
};

// ─── Archetype shape ────────────────────────────────────────────────

/**
 * The four wizard step labels the archetype can hide. Step 1 (identity)
 * and the review step are never hidden — every mission needs a name and
 * a final confirmation. Steps 2..5 are the operational questions:
 *   2 = character (what the soldiers DO)
 *   3 = timing   (when / how many)
 *   4 = command  (who commands, rank policy)
 *   5 = rotation (how ownership rotates + quals + equipment)
 */
export type HideableWizardStep = 2 | 3 | 4 | 5;

export interface MissionArchetype {
  kind:  MissionArchetypeKind;
  label: string;
  hint:  string;
  icon:  string;

  /** Wizard steps the archetype already answers — they will be hidden
   *  and pre-filled from `defaultDraft`. For 'custom' this is empty. */
  hiddenSteps: HideableWizardStep[];

  // ── Behavior flags read by materializer & UI ──────────────────────

  /** Movement-based → soldiers are not at a fixed position; engine
   *  treats overlap with adjacent missions more strictly. */
  isMovementBased: boolean;

  /** Event-driven → the mission is dormant until activated. Engine
   *  allows parallel assignment because soldiers are nominally available
   *  for other duties while on standby. */
  isEventDriven: boolean;

  /** Whether the archetype's behavior naturally varies by day vs night
   *  (different shift durations, manpower, fatigue). Wizard surfaces a
   *  day/night editor only when this is true. */
  supportsDayNight: boolean;

  /** Whether the archetype carries a rally-point address. UI only. */
  supportsRallyPoint: boolean;

  /** Whether the archetype carries a route / sector. UI only. */
  supportsRoute: boolean;

  /** Whether the archetype optionally pairs with a vehicle. UI only. */
  supportsVehicle: boolean;

  /** Whether the archetype carries free-text response instructions
   *  shown to the soldier on event activation. UI + soldier surface. */
  supportsResponseInstructions: boolean;

  /** Allows publishing a weekly schedule into the future. */
  supportsScheduledPublish: boolean;

  // ── Default mission shape — wizard pre-fills from this ────────────

  defaultDraft: Partial<Mission> & {
    dayNightProfile?: DayNightProfile;
    allowPCOverride?:    boolean;
    shiftDurationLocked?: boolean;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

const allCommandRanks: CommandRank[] = ['soldier', 'mk', 'samal', 'mam', 'officer', 'custom'];

const policyFor = (commanderRanks: CommandRank[]): Record<CommandRank, RankPolicy> => {
  const out = {} as Record<CommandRank, RankPolicy>;
  for (const r of allCommandRanks) {
    if (commanderRanks.includes(r))       out[r] = 'commander-only';
    else if (r === 'soldier' || r === 'mk') out[r] = 'regular';
    else                                  out[r] = 'excluded';
  }
  return out;
};

// ─── The five archetypes ────────────────────────────────────────────

const STATIC_GUARD_TIME: MissionTimeModel = { kind: '24-7-continuous' };
const STATIC_GUARD_MANPOWER: MissionManpowerSpec = {
  kind: 'window-varies',
  windows: [
    { label: 'day',   from: '06:00', to: '22:00', spec: { kind: 'exact', count: 1 } },
    { label: 'night', from: '22:00', to: '06:00', spec: { kind: 'exact', count: 2 } },
  ],
};
const STATIC_GUARD_COMMAND: MissionCommandSpec = {
  fieldCommandRequired:      false,
  commandersPerSlot:         0,
  commanderCountsAsManpower: false,
  rankPolicy:                policyFor([]),
};
const STATIC_GUARD_ROTATION: MissionRotation = { kind: 'rotate-platoons', period: 'weekly' };
const STATIC_GUARD_FATIGUE: MissionFatigueProfile = {
  intensity:         'standing-guard',
  impactsSleep:      false,
  minRestAfterHours: 6,
  fatigueWeight:     3,
};

const PATROL_TIME: MissionTimeModel = {
  kind: 'fixed-hours',
  windows: [{ startTime: '06:00', endTime: '22:00', shiftDurationMinutes: 240, recurring: 'every-day' }],
};
const PATROL_MANPOWER: MissionManpowerSpec = { kind: 'exact', count: 4 };
const PATROL_COMMAND: MissionCommandSpec = {
  fieldCommandRequired:      true,
  commandersPerSlot:         1,
  commanderCountsAsManpower: true,
  rankPolicy:                policyFor(['samal']),
};
const PATROL_ROTATION: MissionRotation = { kind: 'rotate-squads', period: 'daily' };
const PATROL_FATIGUE: MissionFatigueProfile = {
  intensity:         'active-patrol',
  impactsSleep:      true,
  minRestAfterHours: 8,
  fatigueWeight:     7,
};
// Patrol cannot overlap with anything during the active window, and
// rest blocks even readiness-level overlaps.
const PATROL_OVERLAP: MissionOverlapPolicy = {
  activeOverlap: [],
  restOverlap:   [],
};

const READINESS_TIME: MissionTimeModel = { kind: '24-7-continuous' };
const READINESS_MANPOWER: MissionManpowerSpec = { kind: 'exact', count: 4 };
const READINESS_COMMAND: MissionCommandSpec = {
  fieldCommandRequired:      true,
  commandersPerSlot:         1,
  commanderCountsAsManpower: true,
  rankPolicy:                policyFor(['samal', 'mam']),
};
const READINESS_ROTATION: MissionRotation = { kind: 'rotate-platoons', period: 'daily' };
const READINESS_FATIGUE: MissionFatigueProfile = {
  intensity:         'readiness',
  impactsSleep:      false,
  minRestAfterHours: 4,
  fatigueWeight:     2,
};
// Readiness explicitly ALLOWS parallel assignment — the entire point of
// event-driven duty is that the soldier is nominally available for
// other tasks until the event fires.
const READINESS_OVERLAP: MissionOverlapPolicy = {
  activeOverlap: ['standing-guard', 'admin', 'readiness'],
  restOverlap:   ['standing-guard', 'admin', 'readiness', 'active-patrol'],
};

const ONE_TIME_TIME: MissionTimeModel = {
  kind: 'fixed-hours',
  windows: [{ startTime: '08:00', endTime: '14:00', shiftDurationMinutes: 360, recurring: 'every-day' }],
};
const ONE_TIME_MANPOWER: MissionManpowerSpec = { kind: 'exact', count: 6 };
const ONE_TIME_COMMAND: MissionCommandSpec = {
  fieldCommandRequired:      true,
  commandersPerSlot:         1,
  commanderCountsAsManpower: true,
  rankPolicy:                policyFor(['samal', 'mam', 'officer']),
};
const ONE_TIME_ROTATION: MissionRotation = { kind: 'manual' };
const ONE_TIME_FATIGUE: MissionFatigueProfile = {
  intensity:         'ambush',
  impactsSleep:      true,
  minRestAfterHours: 10,
  fatigueWeight:     8,
};

export const MISSION_ARCHETYPES: Record<MissionArchetypeKind, MissionArchetype> = {
  // ─────────────────────────────────────────────────────────────────
  'static-guard': {
    kind:  'static-guard',
    label: 'שמירה סטטית',
    hint:  'שער / מגדל / נצפ״ה — עמדה קבועה, חופף יום/לילה',
    icon:  '👁',

    // Static guard tells us its character (standing guard), its time
    // model (24/7), and its rotation default — we only ASK about
    // command (who commands at the level) and quals/equipment.
    hiddenSteps: [2, 3],

    isMovementBased:              false,
    isEventDriven:                false,
    supportsDayNight:             true,
    supportsRallyPoint:           false,
    supportsRoute:                false,
    supportsVehicle:              false,
    supportsResponseInstructions: false,
    supportsScheduledPublish:     true,

    defaultDraft: {
      timeModel:           STATIC_GUARD_TIME,
      manpower:            STATIC_GUARD_MANPOWER,
      command:             STATIC_GUARD_COMMAND,
      rotation:            STATIC_GUARD_ROTATION,
      fatigue:             STATIC_GUARD_FATIGUE,
      dayNightProfile:     { ...DEFAULT_DAY_NIGHT, dayShiftDurationMinutes: 120, nightShiftDurationMinutes: 180 },
      allowPCOverride:     true,
      shiftDurationLocked: false,
    },
  },

  // ─────────────────────────────────────────────────────────────────
  patrol: {
    kind:  'patrol',
    label: 'סיור',
    hint:  'תנועה בגזרה — מסלול / סקטור, אופציונלי רכב',
    icon:  '🚶',

    // Patrol's character + timing windows are derived. We ask about
    // command and quals/equipment (and the route lives outside the
    // wizard for now — UI follow-up).
    hiddenSteps: [2],

    isMovementBased:              true,
    isEventDriven:                false,
    supportsDayNight:             true,
    supportsRallyPoint:           false,
    supportsRoute:                true,
    supportsVehicle:              true,
    supportsResponseInstructions: false,
    supportsScheduledPublish:     true,

    defaultDraft: {
      timeModel:           PATROL_TIME,
      manpower:            PATROL_MANPOWER,
      command:             PATROL_COMMAND,
      rotation:            PATROL_ROTATION,
      fatigue:             PATROL_FATIGUE,
      overlapPolicy:       PATROL_OVERLAP,
      dayNightProfile:     { ...DEFAULT_DAY_NIGHT, dayShiftDurationMinutes: 240, nightShiftDurationMinutes: 180 },
      allowPCOverride:     true,
      shiftDurationLocked: false,
    },
  },

  // ─────────────────────────────────────────────────────────────────
  readiness: {
    kind:  'readiness',
    label: 'כוננות',
    hint:  'תגובה לאירוע — נקודת ריכוז, הוראות תגובה, מקבילי',
    icon:  '🛡',

    // Readiness is the simplest from the questionnaire side — we know
    // character, timing, rotation. We only ask about command (who
    // leads the response) and quals/equipment.
    hiddenSteps: [2, 3, 5],

    isMovementBased:              false,
    isEventDriven:                true,
    supportsDayNight:             false,
    supportsRallyPoint:           true,
    supportsRoute:                false,
    supportsVehicle:              false,
    supportsResponseInstructions: true,
    supportsScheduledPublish:     true,

    defaultDraft: {
      timeModel:           READINESS_TIME,
      manpower:            READINESS_MANPOWER,
      command:             READINESS_COMMAND,
      rotation:            READINESS_ROTATION,
      fatigue:             READINESS_FATIGUE,
      overlapPolicy:       READINESS_OVERLAP,
      allowPCOverride:     true,
      shiftDurationLocked: false,
    },
  },

  // ─────────────────────────────────────────────────────────────────
  'one-time-op': {
    kind:  'one-time-op',
    label: 'מבצע חד-פעמי',
    hint:  'חלון זמן ספציפי — כוח אדם וציוד מחייבים, פרסום חד-פעמי',
    icon:  '🎯',

    // One-time ops: we ask timing (when, hours) and command (who runs
    // it) and rotation/quals/equipment — but skip the character step
    // because the operator already classified it as a one-time op.
    hiddenSteps: [2],

    isMovementBased:              false,
    isEventDriven:                false,
    supportsDayNight:             true,
    supportsRallyPoint:           false,
    supportsRoute:                false,
    supportsVehicle:              true,
    supportsResponseInstructions: false,
    supportsScheduledPublish:     false,

    defaultDraft: {
      timeModel:           ONE_TIME_TIME,
      manpower:            ONE_TIME_MANPOWER,
      command:             ONE_TIME_COMMAND,
      rotation:            ONE_TIME_ROTATION,
      fatigue:             ONE_TIME_FATIGUE,
      allowPCOverride:     false,
      shiftDurationLocked: true,
    },
  },

  // ─────────────────────────────────────────────────────────────────
  custom: {
    kind:  'custom',
    label: 'אחר / מותאם',
    hint:  'הגדרה ידנית מלאה — להופיע כש־archetype אחר לא מתאים',
    icon:  '⚙',

    hiddenSteps: [],

    isMovementBased:              false,
    isEventDriven:                false,
    supportsDayNight:             true,
    supportsRallyPoint:           false,
    supportsRoute:                false,
    supportsVehicle:              false,
    supportsResponseInstructions: false,
    supportsScheduledPublish:     true,

    defaultDraft: {
      allowPCOverride:     true,
      shiftDurationLocked: false,
    },
  },
};

export const MISSION_ARCHETYPE_LIST: MissionArchetype[] = [
  MISSION_ARCHETYPES['static-guard'],
  MISSION_ARCHETYPES.patrol,
  MISSION_ARCHETYPES.readiness,
  MISSION_ARCHETYPES['one-time-op'],
  MISSION_ARCHETYPES.custom,
];

// ─── Step visibility helper ─────────────────────────────────────────

/**
 * Returns the ordered list of wizard steps visible for an archetype
 * (always 1 + non-hidden 2..5 + 6). Wizard advances through THIS list
 * rather than incrementing 1..6 directly.
 */
export function visibleWizardSteps(kind?: MissionArchetypeKind): Array<1 | 2 | 3 | 4 | 5 | 6> {
  // Until an archetype is picked, only show step 1 (selection).
  if (!kind) return [1];
  const archetype = MISSION_ARCHETYPES[kind];
  const hidden = new Set<number>(archetype.hiddenSteps);
  return [1, 2, 3, 4, 5, 6].filter((s) => !hidden.has(s)) as Array<1 | 2 | 3 | 4 | 5 | 6>;
}
