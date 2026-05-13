// Command-chain roles. Legacy 'owner'/'manager' kept for compat.
// SubUnits are organisational, NOT a permission layer — there is no
// squadCommander role. A soldier who leads a sub-unit is just a soldier
// with that fact recorded in their operationalRoles metadata.
export type UserRole =
  | 'companyCommander'         // מ״פ — owns the company
  | 'deputyCompanyCommander'   // סמ״פ — full company powers, peer of company commander
  | 'platoonCommander'         // מ״מ — runs one platoon
  | 'platoonSergeant'          // סמל — runs one platoon (peer of platoonCommander)
  | 'soldier'                  // regular soldier
  | 'owner'                    // [legacy] ≈ companyCommander
  | 'manager';                 // [legacy] ≈ platoonCommander

// ─── Permission tokens (separate from roles) ─────────────────────────────────
// Roles describe WHO you are. Permissions describe WHAT you can do.
// Each role has default tokens, and the company commander can grant any
// token to any user via the Delegation entity (with optional expiry —
// used for temporary escalation grants).

export type PermissionToken =
  // Roster
  | 'roster.add' | 'roster.edit' | 'roster.remove'
  // Schedule
  | 'schedule.create' | 'schedule.edit' | 'schedule.publish'
  // Missions
  | 'mission.create.platoon' | 'mission.create.company'
  // Leave
  | 'leave.approve.platoon' | 'leave.approve.company' | 'leave.create.lockedDate'
  // Combat clock
  | 'combatClock.publish' | 'combatClock.fillBlock'
  // Communication
  | 'comm.send.platoon' | 'comm.send.company'
  // Escalation
  | 'escalation.declare' | 'escalation.respond' | 'escalation.collectStatus'
  // Logistics
  | 'logistics.signOut' | 'logistics.signIn' | 'logistics.viewAll'
  // Reports
  | 'report.viewCompanyState' | 'report.viewPlatoonState'
  // Meta
  | 'delegation.grant';

// A permission grant. Lives as data so the CC can grant/revoke per user
// or per role with optional expiry.
export interface Delegation {
  id: string;
  companyId: string;
  /** Either a specific user OR an entire role (e.g. "all PCs in this company"). */
  grantedToUserId?: string;
  grantedToRole?: UserRole;
  permission: PermissionToken;
  /** 'company' for company-wide, or { platoonId } for platoon-scoped. */
  scope: { kind: 'company' } | { kind: 'platoon'; platoonId: string };
  grantedByUserId: string;
  grantedAt: string;
  /** Optional expiry — used for temporary escalation grants. */
  expiresAt?: string;
}

export type OperationalRole =
  | 'מ״פ' | 'סמ״פ' | 'מ״מ' | 'קשר מ״מ' | 'סמל' | 'מ״כ'
  | 'חובש' | 'נגביסט' | 'קלע' | 'מאגיסט' | 'רחפן';

// @deprecated — sub-unit structure is now per-platoon and free-form via SubUnit.
// Kept as a `string` alias so legacy annotations still compile during migration.
// Display code should resolve a soldier's sub-unit name through the SubUnit
// entity instead of reading teamClass directly.
export type TeamClass = string;

// Availability notes (NO medical classification — manager controls availability)
export type AvailabilityNoteType = 'location' | 'leave' | 'other';

export interface AvailabilityNote {
  type: AvailabilityNoteType;
  description: string;   // "לא נמצא בבסיס" / "ביחידה אחרת"
  startDate?: string;
  endDate?: string;
}

export interface Soldier {
  id: string;
  name: string;

  // ── Identity anchor (roster-first security) ──────────────────────────
  // The slot exists BEFORE the soldier ever opens the app. These two
  // fields are what the soldier provides to claim the slot. After a
  // successful claim, password (on MockUser) becomes the auth credential
  // and idLast4 is retained only for audit.
  phone: string;
  idLast4: string;

  // ── Membership lifecycle ─────────────────────────────────────────────
  // A Soldier IS an active assignment to one company. When the same
  // person transfers to a new company, the old Soldier flips to
  // 'inactive' and a new Soldier becomes active. Historical Soldier
  // records remain in storage strictly for audit; normal selectors
  // must filter to status === 'active'.
  companyId: string;
  status: 'active' | 'inactive';
  deactivatedAt?: string;
  deactivatedReason?: 'transferred' | 'discharged' | 'revoked';
  claimedAt?: string;
  userId?: string;               // populated when the slot is claimed

  // ── Operational state ───────────────────────────────────────────────
  // currentStatus is the SINGLE SOURCE OF TRUTH for "where this soldier
  // is right now". Engine availability filters, Home status strips, and
  // commander pictures all read this. The legacy `availability: boolean`
  // is kept for one transitional commit and then deleted.
  //
  // The enum is open to extension — escalation flows will add 'on-the-way'
  // and 'arrived' values without breaking existing consumers.
  currentStatus: SoldierStatus;
  statusSetAt: string;             // ISO timestamp — drives "since when"
  statusExpectedUntil?: string;    // optional planned return (set when going home)

  operationalRoles: OperationalRole[];

  // Additive functional-role tags. Live alongside the base role.
  // Architecture-ready for רס״פ / שליש / מש״ק-קשר / חפ״ק-member / logistics
  // surfaces in future phases. NOT rendered yet.
  functionalRoles?: FunctionalRole[];

  teamClass: TeamClass;            // @deprecated — use squadId
  squadId?: string;
  availability: boolean;           // @deprecated — derive from currentStatus
  availabilityNotes: AvailabilityNote[];
  currentLoad: number;

  // Optional date of birth (ISO YYYY-MM-DD). When present, the calendar
  // surface renders a birthday entry on the matching day. Strictly
  // optional — slot creation does not require it.
  dateOfBirth?: string;
}

export type SoldierStatus =
  | 'in-base'         // בבסיס — operational and present
  | 'home'            // בבית   — on approved leave / rotation home
  | 'inactive-temp';  // לא פעיל זמנית — present but unavailable for assignment

// Append-only audit log of every status change. Soldier.currentStatus
// is a denormalised cache of the latest event for fast reads.
export interface SoldierStatusEvent {
  id:        string;
  soldierId: string;
  value:     SoldierStatus;
  setAt:     string;
  setBy:     string;               // userId of whoever set it
  expectedUntil?: string;
  reason?:   string;
  // Architecture-ready: escalationId? linked when the event is part of an
  // EscalationEvent response. Not used yet.
  escalationId?: string;
}

// Functional roles — additive tags carried alongside the base UserRole.
// Each tag carries a default permission bundle (see permissions.ts).
export type FunctionalRole =
  | 'rasap'              // רס״פ — logistics chief
  | 'shalish'            // שליש — admin officer
  | 'mashak-kesher'      // מש״ק קשר — comms NCO
  | 'chapack-member'     // חפ״ק member
  | 'logistics-assistant';

// ─── Leaves / יציאות ─────────────────────────────────────────────────────────

// 'squad' replaces the legacy 'class' scope; both denote a leave that
// applies to everyone in a given organisational squad.
export type LeaveScope = 'individual' | 'squad' | 'machlaka';

export interface Leave {
  id: string;
  scope: LeaveScope;
  soldierIds: string[];
  teamClass?: TeamClass;          // @deprecated — use squadId
  squadId?: string;               // organisational squad (preferred)
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  note?: string;
  createdBy: string;
  createdByName: string;
}

// Leave requests (soldier-initiated, manager approves)
export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  soldierId: string;
  soldierName: string;
  soldierTeamClass: TeamClass;     // @deprecated — use soldierSquadId
  soldierSquadId?: string;
  soldierSquadName?: string;       // snapshot for display (squads can be renamed)
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  reason: string;
  status: LeaveRequestStatus;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  submittedAt: string;
}

// ─── Equipment ───────────────────────────────────────────────────────────────

export interface EquipmentRequirements {
  fullUniform: boolean;   // מדים מלאים
  kneePads:    boolean;   // ברכיות
  boots:       boolean;   // נעליים
  vest:        boolean;   // ווסט
  helmet:      boolean;   // קסדה
  weapon:      boolean;   // נשק
}

// ─── Schedule hierarchy ───────────────────────────────────────────────────────

export type MissionCategory =
  | 'שמירה' | 'חמ״ל' | 'מטבח' | 'סיור' | 'כוננות' | 'עבודות רס״ר' | 'אחר';

export type TimeSlotStatus = 'open' | 'filled' | 'conflict';

export interface TimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  assignedSoldierIds: string[];
  requiredRoles: OperationalRole[];
  status: TimeSlotStatus;
}

export interface SoldierPairing {
  soldierIds: [string, string];
  type: 'must-together' | 'must-apart';
  note?: string;
}

export type SoldierMixingPolicy = 'mix' | 'dedicated';
export type ClassMixingPolicy   = 'mix' | 'no-mix' | 'specific';

export interface MissionType {
  id: string;
  name: string;
  category: MissionCategory;
  // NO location field — mission name implies location

  // Manpower
  minSoldiers: number;
  recommendedSoldiers: number;
  maxSoldiers: number;

  // Roles
  requiredRoles: OperationalRole[];
  needsCommander: boolean;
  needsMedic: boolean;

  // Shift timing
  minShiftMinutes: number;     // minimum shift length
  maxShiftMinutes: number;     // maximum shift length
  activeStartTime: string;     // daily window open
  activeEndTime: string;       // daily window close
  shiftDurationHours: number;  // default for slot generation
  recurring: boolean;

  // Conflict & overlap
  conflictsWith: string[];     // missionType IDs — can't use same soldier simultaneously
  canOverlapWith: string[];    // missionType IDs — can share a soldier

  // Mixing policies
  soldierMixing: SoldierMixingPolicy;
  classMixing: ClassMixingPolicy;        // @deprecated — interpret as squadMixing
  allowedClasses?: TeamClass[];          // @deprecated — use allowedSquadIds
  allowedSquadIds?: string[];            // when classMixing === 'specific'

  // Equipment
  hasEquipment: boolean;
  equipmentRequired: EquipmentRequirements;

  // Advanced
  enableCadar: boolean;
  enableConfusion: boolean;
  confusionDeviationMinutes: number;

  pairings: SoldierPairing[];
  timeSlots: TimeSlot[];
}

export type ScheduleStatus = 'draft' | 'published';

export interface CommanderNote {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  timestamp: string;
}

export interface SchedulePeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: ScheduleStatus;
  missionTypes: MissionType[];
  commanderNotes: CommanderNote[];
}

// ─── Warnings / Audit ────────────────────────────────────────────────────────

export type WarningType =
  | 'overlap' | 'missingRole' | 'insufficientRest' | 'unavailable' | 'onLeave'
  | 'understaffed' | 'unfairDistribution' | 'classViolation'
  | 'commanderMissing' | 'medicMissing' | 'confusionViolation'
  | 'impossibleConstraint' | 'conflictMission';

export type WarningSeverity = 'critical' | 'warning' | 'info';

export interface ShiftWarning {
  type: WarningType;
  severity: WarningSeverity;
  message: string;
  soldierIds?: string[];
  timeSlotIds?: string[];
  missionId?: string;
  commanderOnly: boolean;   // if true, hidden from soldier views
}

// ─── Fairness ────────────────────────────────────────────────────────────────

export interface FairnessScore {
  soldierId: string;
  soldierName: string;
  currentPeriodHours: number;
  totalHours: number;
  nightShifts: number;
  difficultShiftScore: number;
  loadIndex: number;                   // normalized 0–100
  flag: 'overloaded' | 'underloaded' | 'balanced';
}

export interface ScheduleGenerationResult {
  missionTypes: MissionType[];
  warnings: ShiftWarning[];
  fairness: FairnessScore[];
}

export interface AuditLog {
  id: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  target: string;
  timestamp: string;
}

// ─── Soldier history (for fairness tracking across periods) ──────────────────

export interface SoldierHistory {
  soldierId: string;
  totalAssignedHours:   number;    // sum of all assigned shift hours
  totalGuardHours:      number;
  totalKitchenHours:    number;
  totalStandbyHours:    number;
  totalNightShifts:     number;    // shifts starting 22:00–06:00
  totalDifficultShifts: number;    // weekend/holiday shifts
  difficultShiftScore:  number;    // weighted: night × 2 + difficult × 1.5
  homeLeaveDays:        number;
  lastAssignmentDate?:  string;    // ISO date string
  missionTypeCount: Record<string, number>;  // missionTypeName → assignment count
}

// ─── Company / פלוגה ─────────────────────────────────────────────────────────

export type MissionRotationStrategy = 'platoon-based' | 'squad-based';

export interface CompanyHomePeriod {
  id: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface CompanySettings {
  rotationStrategy: MissionRotationStrategy;
  minSoldiersOnBase: number;
  specialPlatoonsFollowLeaveRotation: boolean;
  companyHomePeriods: CompanyHomePeriod[];   // periods when whole company is home
}

export interface Company {
  id: string;
  name: string;
  unitName?: string;             // gdoud / brigade
  commanderUserId: string;       // מ״פ / סמ״פ owner
  deputyCommanderUserId?: string;
  platoonIds: string[];
  inviteCode: string;
  settings: CompanySettings;
  createdAt: string;
}

// ─── Squads / כיתות (organisational — NOT a permission role) ────────────────
//
// A Platoon is composed of one or more Squads. Names are defined per-platoon
// by the company commander during setup, e.g.:
//   "מחלקה 1"       → ["כיתה א", "כיתה ב", "כיתה ג"]
//   "מחלקה מיוחדת"  → ["ספרפס", "משקשק", "חוליה טכנית"]
// Squad grants no permissions on its own. If a soldier leads a squad
// that fact lives in operationalRoles ('מ״כ' etc.), not in OperationalRole.

export interface Squad {
  id:         string;
  name:       string;        // free-text Hebrew/English label
  platoonId:  string;        // parent Platoon id
  soldierIds: string[];      // members of this squad
}

// ─── Platoons / מחלקות (child of Company) ────────────────────────────────────

export interface Platoon {
  id: string;
  name: string;
  unitName?: string;
  code: string;
  memberIds: string[];
  platoonCommander?: string;
  platoonSergeant?: string;
  scheduleManagers?: string[];
  availableRoles: string[];
  size?: number;
  enemyConfusion?: boolean;
  confusionMinutes?: number;

  // Company hierarchy
  companyId: string;
  platoonCommanderUserId?: string;
  platoonSergeantUserId?: string;
  squadIds?: string[];

  // What kind of operational unit this is. Replaces the legacy
  // isSpecialPlatoon boolean — platoons are not homogeneous. A combat
  // platoon has squads; a logistics platoon has work teams; an HQ
  // platoon hosts functional-role soldiers (רס״פ / שליש / מש״ק קשר).
  kind: PlatoonKind;
  isSpecialPlatoon?: boolean;               // @deprecated — use kind

  followsCompanyLeaveRotation?: boolean;
  minSoldiersOnBase?: number;
}

export type PlatoonKind =
  | 'combat'           // מחלקת לחימה
  | 'forward-command'  // חפ״ק
  | 'logistics'        // מפלג
  | 'hq'               // מפקדה — hosts רס״פ / שליש / מש״ק קשר
  | 'custom';

// ─── Company-level missions ──────────────────────────────────────────────────
//
// CompanyMission is created at the company tier (only by companyCommander
// or deputyCompanyCommander) and is then assigned to one or more platoons.
// Distinct from MissionType, which is internal to a SchedulePeriod and
// owned by the platoon commander. A CompanyMission expresses intent
// ("חפ״ק must staff a guard at gate north") plus a rotation rule between
// the platoons that share responsibility. Each assigned platoon translates
// its share of the company mission into MissionTypes inside its own period.

export type CompanyMissionRotation = 'platoon-rotates-daily' | 'platoon-rotates-weekly' | 'fixed-platoon';

export type RequirementKind =
  | 'role'        // structured: a specific OperationalRole / soldier capability
  | 'freeText';   // free-form note ("ניסיון בתצפיות לילה")

export interface MissionRequirement {
  id: string;
  kind: RequirementKind;
  // For kind === 'role':
  role?: OperationalRole;       // e.g. 'רחפן' / 'נהג' / 'נגביסט' / 'חובש'
  count?: number;               // how many of that role
  // For kind === 'freeText':
  note?: string;
}

export interface CompanyMission {
  id: string;
  companyId: string;
  name: string;
  description?: string;          // free-text note
  durationHours?: number;        // default mission length per shift
  startDate?: string;            // optional window
  endDate?: string;
  assignedPlatoonIds: string[];  // platoons sharing this mission
  rotation: CompanyMissionRotation;
  requirements: MissionRequirement[];
  createdByUserId: string;
  createdAt: string;
}

// ─── Operational override alerts ─────────────────────────────────────────────
//
// Generated whenever a platoon-level action causes (or would cause) a
// deviation from configured operational requirements: dropping below
// minimum manpower, force-assigning outside engine recommendation,
// pulling a soldier off shift early, etc.
//
// The action ALWAYS succeeds — operational flexibility is preserved.
// The alert is the upward signal so company leadership sees the picture.

export type OverrideAlertKind =
  | 'manualSlotEdit'        // commander manually changed a slot's assignment
  | 'belowMinManpower'      // platoon dropped below required minimum on base
  | 'soldierSentHome'       // commander marked soldier unavailable / sent home immediately
  | 'extraSoldiersAssigned' // commander assigned more than the recommended number
  | 'requirementUnmet';     // a CompanyMission requirement is no longer satisfied

export type OverrideAlertStatus = 'open' | 'acknowledged' | 'resolved';

export interface OverrideAlert {
  id: string;
  companyId: string;
  platoonId: string;
  kind: OverrideAlertKind;
  description: string;            // human-readable summary
  actorUserId: string;            // who performed the action
  actorName: string;
  timestamp: string;              // ISO
  status: OverrideAlertStatus;
  acknowledgedByUserId?: string;
  acknowledgedAt?: string;
  resolvedByUserId?: string;
  resolvedAt?: string;
  manpowerImpact?: {
    currentOnBase: number;
    requiredMin: number;
    belowMin: boolean;
  };

  // ── Future-ready risk fields (optional; not surfaced in UI yet) ──
  riskLevel?: 'low' | 'medium' | 'high';
  affectedMissionIds?: string[];
  affectedSoldierIds?: string[];
  requiresImmediateAttention?: boolean;
  suggestedAction?: string;
}

// ─── Miluim period (the overall reserve duty window) ─────────────────────────

export interface MiluimPeriod {
  id: string;
  companyId: string;         // miluim is a company-level cycle
  startDate: string;
  endDate: string;
  description: string;
}

// ─── Reminders ───────────────────────────────────────────────────────────────

export interface ReminderSetting {
  timeSlotId: string;
  minutesBefore: 5 | 15 | 30 | 60;
  enabled: boolean;
}

// ─── Auth (mocked) ───────────────────────────────────────────────────────────
//
// Authentication is roster-first: a user cannot exist without an operational
// slot put on file by command. The exception is the bootstrap CC, who self-
// registers because there is no roster yet for that person to claim against.
//
// All MockUser scope fields (companyId, platoonId, role, etc.) MIRROR the
// active Soldier record. When a person transfers, these fields are flipped
// atomically with the Soldier.status change. Selectors should always read
// these from currentUser (the active picture) and never iterate over the
// historical Soldier records.

// ─── Calendar spine (operational calendar/timeline) ──────────────────────────
//
// The calendar is the chronological projection of the same operational data
// the rest of the app already owns. Two layers:
//
//   STORAGE  — CalendarEvent: things the app *owns* and that don't already
//              exist as some other entity (combat-block, locked-date,
//              announcement). Stored in AppContext, mutated via actions.
//
//   UI ENTRY — CalendarEntry: what every view consumes after projection.
//              Includes both the storage events above AND derived entries
//              from existing entities (guard-shift from TimeSlot, leave-
//              period from Leave, birthday from Soldier.dateOfBirth).
//              Calendar pages never read storage directly — they call
//              buildDayEntries() in utils/calendar.ts.

export type CombatBlockKind =
  | 'platoon-time'   // can be filled by PC/PS of a platoon
  | 'training'
  | 'briefing'
  | 'mess'
  | 'rest'
  | 'free';

export type CalendarEventKind =
  | 'combat-block'
  | 'locked-date'
  | 'announcement';

// Storage entity. CC creates these; PC fills platoon-time blocks for their
// platoon. All times are ISO strings. allDay events use 00:00 → 23:59 of
// the same day with allDay: true.
export interface CalendarEvent {
  id: string;
  companyId: string;                       // tenant scope
  kind: CalendarEventKind;
  scope: 'company' | 'platoon';            // who sees / owns this event
  scopeRefId: string;                      // company.id | platoon.id

  start: string;                           // ISO
  end: string;                             // ISO (== start for instantaneous)
  allDay: boolean;

  title: string;
  detail?: string;

  // Discriminated payloads — only one is present, based on `kind`.
  combatBlock?: {
    kind: CombatBlockKind;
    /** Populated iff combatBlock.kind === 'platoon-time' AND a platoon has
     *  filled the slot. Empty platoon-time blocks render as "לא מולא". */
    platoonFill?: {
      platoonId: string;
      title: string;
      detail?: string;
      filledBy: string;                    // userId
      filledAt: string;                    // ISO
    };
  };
  lockedDate?: {
    reason: string;
    /** Even on a locked date, certain leave kinds may still be allowed.
     *  When false, the leave flow must reject requests covering this day. */
    allowsLeave: boolean;
  };

  createdBy: string;                       // userId
  createdAt: string;                       // ISO
}

// UI-facing entry. Pages render CalendarEntry[], not CalendarEvent[].
export type CalendarEntryKind =
  | 'guard-shift'    // derived from TimeSlot
  | 'mission'        // derived from MissionType / CompanyMission
  | 'leave-period'   // derived from approved Leave
  | 'combat-block'   // from CalendarEvent (operational sub-kinds)
  | 'platoon-time'   // from CalendarEvent.combatBlock.kind === 'platoon-time'
  | 'locked-date'    // from CalendarEvent
  | 'announcement'   // from CalendarEvent
  | 'birthday';      // from Soldier.dateOfBirth

export interface CalendarEntry {
  id: string;
  kind: CalendarEntryKind;
  scope: 'personal' | 'platoon' | 'company';
  scopeRefId: string;                      // soldierId | platoonId | companyId
  start: string;                           // ISO
  end: string;                             // ISO
  allDay: boolean;
  title: string;
  detail?: string;
  /** Higher priority wins when entries overlap visually.
   *  mission (100) > guard-shift (90) > leave-period (70) >
   *  platoon-time filled (50) > combat-block operational (40) >
   *  announcement (30) > combat-block background (20) >
   *  platoon-time empty (10) > locked-date / birthday (5). */
  priority: number;
  /** True for events that can't be moved/edited by the calendar surface
   *  (missions, locked dates, guard shifts produced by the scheduler). */
  locked: boolean;
  sourceRef: { kind: string; id: string };
}

// ─── Engine: open capability vocabulary (company-defined, reusable) ─────────
//
// Qualifications and EquipmentItems are NOT enums. They are data the
// company commander defines. The engine only understands shapes ("this
// mission needs N people with qualification Q"); the CC decides what Q is.

export interface Qualification {
  id: string;
  companyId: string;
  name: string;                          // "מפעיל רחפן מבצעי"
  description?: string;
  category?: string;                     // optional grouping ("תקשורת", "נהיגה")
  createdBy: string;                     // userId
  createdAt: string;
}

export interface EquipmentItem {
  id: string;
  companyId: string;
  name: string;                          // "סולם", "רחפן מאוויק 3"
  category?: string;
  isConsumable: boolean;                 // batteries vs ladders
  unitCount: number;                     // how many the company owns
}

// Soldier ↔ Qualification join. Annual recerts use expiresAt.
export interface SoldierQualification {
  id: string;
  soldierId: string;
  qualificationId: string;
  certifiedAt?: string;
  certifiedBy?: string;                  // userId of certifying officer
  expiresAt?: string;                    // ISO; missions exclude soldier past this
}

// ─── Engine: mission policy primitives ──────────────────────────────────────
//
// A Mission is composed of policy objects rather than fields. Each policy
// is a discriminated union so authoring flows (slice E2) and the engine
// (slice E3+) can handle the kinds independently.

export interface MissionTimeWindow {
  startTime: string;                     // HH:MM
  endTime: string;
  shiftDurationMinutes: number;          // length of a single shift inside this window
  recurring: 'every-day' | { daysOfWeek: number[] };   // 0=Sun..6=Sat
}

export type MissionTimeModel =
  | { kind: '24-7-continuous' }
  | { kind: 'fixed-hours';    windows: MissionTimeWindow[] }
  | { kind: 'daily-variable'; perDate: Record<string, MissionTimeWindow[]> }
  | { kind: 'one-time';       start: string; end: string }
  | { kind: 'on-demand' };                                        // readiness / כוננות

export type MissionManpowerSpec =
  | { kind: 'exact'; count: number }
  | { kind: 'range'; min: number; max: number; ideal?: number }
  | {
      kind: 'window-varies';
      windows: Array<{
        label: 'day' | 'night' | string;
        from:  string;                                            // HH:MM
        to:    string;
        spec:  { kind: 'exact'; count: number } | { kind: 'range'; min: number; max: number };
      }>;
    };

export type CommandRank = 'soldier' | 'mk' | 'samal' | 'mam' | 'officer' | 'custom';
export type RankParticipation = 'commander-only' | 'eligible-as-soldier' | 'excluded';

export interface MissionCommandSpec {
  required: boolean;
  count: number;                                                  // typically 1
  commanderCountsAsManpower: boolean;
  /** Whitelist — engine picks commander from one of these ranks. */
  allowedCommanderRanks: CommandRank[];
  /** Per-rank policy for THIS mission. Missing entries default to
   *  'eligible-as-soldier' for non-commander ranks and 'commander-only'
   *  for ranks listed in allowedCommanderRanks. */
  rankParticipation: Partial<Record<CommandRank, RankParticipation>>;
}

export type RotationPeriod = 'daily' | 'weekly' | { everyHours: number };

export type MissionRotation =
  | { kind: 'fixed-platoon';      platoonId: string }
  | { kind: 'rotate-platoons';    period: RotationPeriod; order?: string[] }   // explicit ordering optional
  | { kind: 'rotate-squads';      period: RotationPeriod }
  | { kind: 'whichever-strongest' }                                            // engine picks most-rested platoon
  | { kind: 'returning-from-home' }                                            // platoon just back from leave
  | { kind: 'manual' };                                                        // CC assigns each cycle

export type MissionIntensity =
  | 'passive'        // sitting in HQ
  | 'standing-guard' // gate / tower
  | 'active-patrol'
  | 'ambush'         // night-impacting
  | 'readiness'      // כוננות
  | 'admin';

export interface MissionFatigueProfile {
  intensity: MissionIntensity;
  impactsSleep: boolean;
  /** Hours of sleep window the mission overlaps with (only meaningful when
   *  impactsSleep=true and the slot crosses 23:00–05:00). */
  sleepWindowHours?: number;
  /** Hard floor on rest BEFORE the same soldier may take another shift. */
  minRestAfterHours: number;
  /** Contribution to the rolling fatigue score (0–10 scale, ambush=10). */
  fatigueWeight: number;
}

export interface QualificationRequirement {
  qualificationId: string;
  count: number;
}
export interface EquipmentRequirement {
  equipmentItemId: string;
  count: number;
  /** True when each soldier needs one (helmet); false when one per shift
   *  satisfies the slot (ladder). */
  perSoldier: boolean;
}

// ─── Engine: Mission — the unified contract ─────────────────────────────────
//
// Replaces CompanyMission + MissionType under one shape. The legacy entities
// stay declared elsewhere in this file for one transitional commit so existing
// screens keep compiling. Slice E9 deletes them.

export type MissionStatus = 'draft' | 'active' | 'paused' | 'archived';

export interface Mission {
  id: string;
  companyId: string;

  // Identity & ownership
  name: string;
  description?: string;
  createdByUserId: string;
  ownerRole: 'company' | 'platoon';

  // Scope — platoons sharing responsibility for this mission
  assignedPlatoonIds: string[];

  // Composable policy objects
  timeModel: MissionTimeModel;
  manpower:  MissionManpowerSpec;
  command:   MissionCommandSpec;
  rotation:  MissionRotation;
  fatigue:   MissionFatigueProfile;

  // Open-vocabulary requirements
  qualifications: QualificationRequirement[];
  equipment:      EquipmentRequirement[];

  // Constraints
  conflictsWith:  string[];                                       // mission ids
  canOverlapWith: string[];
  pairings:       SoldierPairing[];
  squadPolicy:    { mode: 'mix' | 'no-mix' | 'specific'; allowedSquadIds?: string[] };

  // Operational protocols
  requiresDailyConfirmation: boolean;

  // Lifecycle
  status:     MissionStatus;
  startDate?: string;
  endDate?:   string;
  createdAt:  string;
}

// ─── Engine: schedule outputs (produced by phases 4 + 7) ────────────────────
//
// ScheduleSlot replaces TimeSlot's responsibilities. Both exist for one
// transitional commit; engine slice E3+ will start producing ScheduleSlot.

export interface ScheduleSlot {
  id: string;
  missionId: string;
  start: string;
  end: string;
  /** Manpower snapshot at the moment the slot was generated. */
  requiredCount: number;
  commanderRequired: boolean;
  commanderRanks: CommandRank[];
  /** Owner platoon after rotation resolution. */
  ownerPlatoonId: string;
}

export interface Assignment {
  id: string;
  slotId: string;
  soldierId: string;
  role: 'soldier' | 'commander';
  createdBy: string;
  createdAt: string;
  /** Link to the OverrideAlert when this assignment broke an engine rule. */
  overrideAlertId?: string;
}

// ─── Engine: leave framework (refactor of existing Leave) ──────────────────
//
// LeaveBlock is the richer replacement for Leave. LeaveRotationPolicy is
// the company-level configuration the engine reads to know "who can go home
// this week" without breaking floors.

export type LeaveRotationMode =
  | 'platoon-rotation' | 'squad-rotation' | 'mixed' | 'individual-only';

export interface LeaveRotationException {
  kind: 'never-on-leave' | 'always-on-leave-when' | 'custom';
  target: {
    soldierIds?:      string[];
    functionalRoles?: FunctionalRole[];
    squadIds?:        string[];
  };
  rule: string;                                                   // free-text now; future formal predicate
}

export interface LeaveRotationPolicy {
  id: string;
  companyId: string;
  mode: LeaveRotationMode;
  /** Company-wide floor — minimum on-base soldiers at any moment. */
  minSoldiersOnBase: number;
  /** Optional per-platoon overrides (tighter floors for special platoons). */
  perPlatoonFloors: Record<string, number>;
  /** How often the rotation cycle repeats. */
  cycle: { everyDays: number };
  /** Sub-units the CC has marked as eligible for partial-leave granularity. */
  squadsEligibleForPartialLeave: string[];
  exceptions: LeaveRotationException[];
  createdAt: string;
}

export type LeaveBlockSource = 'rotation-plan' | 'request' | 'company-event' | 'commander-grant';
export type LeaveBlockStatus = 'planned' | 'confirmed' | 'cancelled';

export interface LeaveBlock {
  id: string;
  companyId: string;
  scope: 'individual' | 'squad' | 'platoon' | 'company-wide';
  scopeRefId?: string;
  soldierIds?: string[];
  startIso: string;
  endIso: string;
  reason?: string;
  source: LeaveBlockSource;
  status: LeaveBlockStatus;
  createdBy: string;
  createdAt: string;
}

// ─── Engine: fatigue snapshot (computed, never stored) ─────────────────────

export interface SoldierFatigueSnapshot {
  soldierId: string;
  asOf: string;
  // Rolling load
  hoursWorkedLast24: number;
  hoursWorkedLast48: number;
  hoursWorkedLast7d: number;
  // Sleep
  longestSleepBlockLast24h: number;
  sleepImpactedLastNight: boolean;
  consecutiveNightsImpacted: number;
  // Rest constraints
  hoursSinceLastShift: number;
  minRestRequiredNow: number;
  isRested: boolean;
  // Rolling fatigue index
  fatigueScore: number;                                           // 0–100
  trend: 'rising' | 'steady' | 'falling';
}

// ─── Engine: validation / rules (contract only; rules land in E7) ──────────

export type ObservationSeverity = 'info' | 'warning' | 'critical';

export interface Observation {
  id: string;
  ruleId: string;
  severity: ObservationSeverity;
  message: string;
  detail?: string;
  affectedSoldierIds?: string[];
  affectedSlotIds?: string[];
  affectedMissionIds?: string[];
}

export interface Recommendation {
  id: string;
  ruleId: string;
  message: string;
  detail?: string;
  /** Free-form action descriptor (engine handlers land in later slices). */
  suggestedAction?: string;
}

export interface ValidationReport {
  generatedAt: string;
  observations:    Observation[];
  recommendations: Recommendation[];
}

/** Contract for a pluggable rule. Rules' concrete evaluate signatures are
 *  defined in slice E3 once the phase-2 eligibility shape is firm. */
export interface Rule {
  id: string;
  name: string;
  category: 'rest' | 'manpower' | 'coverage' | 'fairness' | 'qualification' | 'custom';
}

export interface MockUser {
  id: string;                         // stable across membership transfers
  name: string;
  role: UserRole;                     // reflects ACTIVE membership

  // Auth credentials
  phone: string;                      // primary identifier; never changes
  idLast4: string;                    // last 4 of ת"ז — used only for first claim, kept for audit
  password: string;                   // set during claim or bootstrap

  // Active membership (mirror of the active Soldier record)
  companyId?: string;
  platoonId?: string;
  commandedPlatoonId?: string;        // officers only
  squadId?: string;                   // soldiers only
  operationalRoles: OperationalRole[];
  teamClass: TeamClass;               // legacy display field
  soldierProfileId?: string;          // active Soldier id

  // Audit trail
  createdAt?: string;
  lastSignInAt?: string;
}
