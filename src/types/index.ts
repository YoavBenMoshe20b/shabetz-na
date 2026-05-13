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
  // Announcements + leave cycles (added in product round 4)
  | 'announcement.create' | 'leaveCycle.edit'
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

// Operational roles — Hebrew labels displayed directly in UI. The
// operational truth of the company is expressed via these tags; soldiers
// can carry multiple (e.g. ['קלע', 'חובש']). All operational job titles
// the product surfaces live here — there are no generic "manager" /
// "admin" / "מנהל" / "בעלים" concepts.
export type OperationalRole =
  | 'מ״פ' | 'סמ״פ' | 'מ״מ' | 'קשר מ״מ' | 'סמל' | 'מ״כ'
  | 'חובש' | 'נגביסט' | 'קלע' | 'מאגיסט' | 'רחפן'
  | 'רס״פ' | 'שליש' | 'מש״ק קשר';

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

  // ── Profile / operational personal data ─────────────────────────────
  // Edited by the soldier from their /profile surface. Used by the
  // engine for slot eligibility (e.g. dominant hand → weapon side
  // pairing rules) and by logistics (sizes). All optional — pre-claim
  // roster entries don't carry this.
  dominantHand?:  'right' | 'left';
  weaponSide?:    'right' | 'left';
  shirtSize?:     string;       // free-text: S/M/L/XL/2XL/...
  pantsSize?:     string;       // free-text: 30/32/.../48
  shoeSize?:      string;       // EU number as string ("42", "44.5")
}

// ─── Equipment (signed-out gear) ─────────────────────────────────────────────
//
// Records every piece of gear formally signed out to a soldier. Distinct
// from EquipmentItem (the company-wide inventory): SignedEquipment is the
// per-soldier ledger of "you have this item, signed by X, on date Y."
//
// Logistics workflows (sign-in / transfer / return / lost-report) layer
// on top of this entity in future slices.

export type SignedEquipmentCategory =
  | 'weapon'
  | 'optic'
  | 'comms'
  | 'protection'        // vest / helmet / kneepads
  | 'navigation'
  | 'medical'
  | 'misc';

export type SignedEquipmentStatus = 'active' | 'returned' | 'lost' | 'in-repair';

export interface SignedEquipment {
  id: string;
  companyId: string;
  soldierId: string;
  /** Free-text item identity (item name + model/serial when relevant). */
  itemName: string;
  category: SignedEquipmentCategory;
  /** Optional inventory back-reference when the item maps to a company-
   *  defined EquipmentItem. Free-text gear (personal weapon, etc.) leaves
   *  this undefined. */
  equipmentItemId?: string;
  serialNumber?: string;
  /** Who signed the item TO the soldier (the logistics-side actor). */
  signedByUserId: string;
  signedByName: string;
  /** Source of the item — usually the company/battalion name. */
  source: string;
  signedAt: string;             // ISO
  status: SignedEquipmentStatus;
  notes?: string;
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
  | 'hq'               // small command attachment (חפ״ק / מטה פלוגתי)
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

  /** Back-link to the Override audit record this alert was raised from.
   *  Present only for alerts produced by the engine (slice E3+); legacy
   *  alerts (pre-engine) have no Override and leave this undefined. */
  overrideId?: string;
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
    /** Operational categorization — filterable + future analytics grouping. */
    category?: LockedDateCategory;
    /** Scope of the lock. Defaults to { kind: 'company' } when absent —
     *  preserves behavior of pre-existing locked dates. */
    appliesTo?: LockedDateScope;
    /** When true, even a CC grant emits an immediate OverrideAlert for
     *  audit. Future workflow may require a second CC ack. */
    overrideRequiresCC?: boolean;
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
  /** Mission id when the entry came from a mission/guard-shift slot.
   *  UI uses this to navigate from a calendar row → /mission/:id. */
  missionId?: string;
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

// Per-mission, per-rank policy. Every CommandRank gets EXACTLY one value
// when a Mission is created — no implicit defaults. The engine reads this
// single map to answer all seven command-related questions:
//   Q1 (field-command required?)         → MissionCommandSpec.fieldCommandRequired
//   Q2 (who can command?)                → ranks with policy 'commander-only'
//   Q3 (commanders per slot?)            → MissionCommandSpec.commandersPerSlot
//   Q4 (commander counts as manpower?)   → MissionCommandSpec.commanderCountsAsManpower
//   Q5 (who can participate?)            → ranks with policy 'regular' or 'fallback'
//   Q6 (who is excluded?)                → ranks with policy 'excluded'
//   Q7 (fallback when manpower short?)   → ranks with policy 'fallback'
export type RankPolicy =
  | 'regular'         // fills regular soldier slots normally
  | 'fallback'        // joins regular slots ONLY when manpower is below ideal
  | 'commander-only'  // commands the slot; cannot fill regular slots
  | 'excluded';       // never assigned to this mission

export interface MissionCommandSpec {
  fieldCommandRequired:      boolean;
  commandersPerSlot:         number;
  commanderCountsAsManpower: boolean;
  /** Every CommandRank carries exactly one policy. */
  rankPolicy: Record<CommandRank, RankPolicy>;
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

// ── Mission cycle profile (24/7 continuous duty pattern) ──────────────────
//
// For a continuous mission (e.g. שמירה) the algorithm needs to know the
// guard/rest rhythm to compute SUSTAINED manpower. Example:
//   guardMinutes=60, restMinutes=120 → 1h-guard / 2h-rest cycle
//   To staff continuously with K soldiers on station, you need
//   manpowerPerShift × (guard+rest)/guard total people in rotation.
//
// This drives:
//   • sustained manpower computation
//   • soldier operational-state derivation (post-shift standby vs sleep)
//   • overlap rules — a soldier in cycle "rest" is in standby for first
//     half of restMinutes, then transitions to true sleep/recovery
export interface MissionCycleProfile {
  guardMinutes: number;
  restMinutes:  number;
  /** Of the rest portion, how many minutes count as standby/readiness
   *  rather than true rest. Used for overlap eligibility. */
  standbyMinutes?: number;
}

// ── Mission overlap policy ────────────────────────────────────────────────
//
// "Can a soldier do something else while assigned to this mission, or
//  while resting from it?" — the spec's core operational nuance.
//
//   activeOverlap — while actively on this mission's guard window:
//     which OTHER mission intensities may the same soldier ALSO carry?
//     (typically empty for ambush/active-patrol; non-empty for
//      readiness/admin where the soldier can stack a passive role.)
//
//   restOverlap — while in the rest portion of this mission's cycle:
//     which OTHER mission intensities may the soldier be pulled into?
//     (typically passive/admin OK; never another active-patrol.)
//
// Both reference the OTHER mission's intensity tag.
export interface MissionOverlapPolicy {
  activeOverlap: MissionIntensity[];
  restOverlap:   MissionIntensity[];
}

// ── Mission logistics alert ──────────────────────────────────────────────
//
// When a mission requires equipment the company may not have on hand,
// the CC can flag a logistics signal that reaches רס״פ / מפלג.
// Surfaces alongside the mission requirement + on the מפלג dashboard
// (future) as a known need.
export interface MissionLogisticsAlert {
  itemName:  string;
  urgency:   'low' | 'medium' | 'high';
  note?:     string;
  raisedAt:  string;
  raisedBy:  string;
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

  /** When set, this mission belongs to a specific operational order (צו).
   *  Otherwise it's an "evergreen" mission tied only to the company. */
  orderId?: string;

  // Scope — platoons sharing responsibility for this mission
  assignedPlatoonIds: string[];

  // Composable policy objects
  timeModel: MissionTimeModel;
  manpower:  MissionManpowerSpec;
  command:   MissionCommandSpec;
  rotation:  MissionRotation;
  fatigue:   MissionFatigueProfile;

  /** For 24/7 continuous missions: the guard/rest cycle pattern. The
   *  engine uses this to compute sustained-manpower + soldier post-
   *  shift operational state (standby vs sleeping vs recovery). */
  cycleProfile?: MissionCycleProfile;

  /** What can overlap with this mission, in either direction. The
   *  scheduler reads activeOverlap to allow stacking other roles
   *  while a soldier is actively on this mission; restOverlap to
   *  decide what other missions a soldier may be pulled into during
   *  rest from this one. */
  overlapPolicy?: MissionOverlapPolicy;

  // Open-vocabulary requirements
  qualifications: QualificationRequirement[];
  equipment:      EquipmentRequirement[];

  /** Free-text logistics signals raised for רס״פ / מפלג. Multiple
   *  items can be flagged (drone + ladder + extra radio). */
  logisticsAlerts?: MissionLogisticsAlert[];

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

  /** Back-reference when this mission was spawned in response to an
   *  EscalationEvent. Lets the escalation surface show the missions it
   *  created, and lets the mission surface show its escalation origin. */
  escalationId?: string;
}

// ─── Operational order (צו) ──────────────────────────────────────────────────
//
// A "צו" is the operational duty period — typically the current reserve
// duty window, or a planned upcoming one. All missions belong to a צו (or
// are evergreen with no צו). The CC organizes work by צו: open/close
// missions inside, assign rotations, manage the period.

export type OperationalOrderStatus = 'planning' | 'published' | 'archived';

export interface OperationalOrder {
  id: string;
  companyId: string;
  /** Display name — e.g. "צו 12–18 במאי". */
  name: string;
  /** ISO date range — inclusive. */
  startDate: string;
  endDate: string;
  /** Free-form intent / commander's framing. */
  description?: string;
  status: OperationalOrderStatus;
  createdByUserId: string;
  createdAt: string;
}

// ─── Soldier operational state (engine-derived) ──────────────────────────────
//
// Beyond the binary in-base/home/inactive on the Soldier record, the engine
// must reason about WHERE in the duty cycle each soldier is at a given time.
// This drives availability, overlap eligibility, sleep protection, and
// fairness scoring.
//
//   active-mission     currently on a guard/patrol/ambush window
//   standby            post-mission "כוננות" — first part of rest; can be
//                      pulled into passive overlaps but not active duty
//   recovery           transitional cool-down after demanding mission
//   sleeping           protected sleep window; engine should not assign
//                      anything unless the protection is overridden
//   passive-available  in-base, not currently on duty, fully assignable
//   partial-available  on duty for a limited subset (e.g. only readiness)
//   unavailable        home / inactive-temp / DutyExclusion

export type SoldierOperationalState =
  | 'active-mission'
  | 'standby'
  | 'recovery'
  | 'sleeping'
  | 'passive-available'
  | 'partial-available'
  | 'unavailable';

// ─── Engine: schedule outputs (produced by phases 4 + 7) ────────────────────
//
// AssignmentSlot is the unit soldiers are assigned to. It is the bridge
// between Mission (policy) and Assignment (execution). Crucially, every
// requirement on the slot is a SNAPSHOT captured at generation time —
// editing a Mission's policy later does NOT retroactively change slots
// that were already generated. You don't change what was scheduled; you
// re-generate from the new policy going forward.
//
// Replaces TimeSlot's responsibilities. Both exist for one transitional
// phase while engine slice E3+ starts producing AssignmentSlot.

export type AssignmentSlotStatus =
  | 'open'                                                 // no one assigned yet
  | 'partially-staffed'                                    // some assignments < required
  | 'fully-staffed'                                        // requiredCount + commander coverage met
  | 'over-staffed'                                         // assignments > max (allowed under override)
  | 'cancelled';                                           // mission paused / day rescheduled / locked-date overlap

export interface AssignmentSlot {
  id: string;
  companyId: string;
  missionId: string;

  // Concrete time window
  start: string;                                           // ISO
  end:   string;

  // ── Manpower snapshot — frozen at generation ──
  requiredCount: number;
  minCount?:     number;                                   // present when mission.manpower is range / window-varies
  maxCount?:     number;
  idealCount?:   number;

  // ── Commander snapshot ──
  commanderRequired:         boolean;
  commanderCount:            number;                       // typically 0 or 1
  commanderRanks:            CommandRank[];
  commanderCountsAsManpower: boolean;

  // ── Requirement snapshots ──
  qualifications: QualificationRequirement[];
  equipment:      EquipmentRequirement[];
  squadPolicy:    { mode: 'mix' | 'no-mix' | 'specific'; allowedSquadIds?: string[] };

  // ── Ownership — resolved by Phase 3 (rotation) ──
  ownerPlatoonId: string;

  // ── Lifecycle ──
  status: AssignmentSlotStatus;

  // ── Audit ──
  generatedAt:      string;                                // engine run timestamp
  generatedBy:      'engine' | 'manual';
  createdByUserId?: string;                                // populated when generatedBy='manual'
}

export interface Assignment {
  id: string;
  /** Back-reference to the AssignmentSlot this fills. */
  slotId: string;
  soldierId: string;
  role: 'soldier' | 'commander';
  createdBy: string;
  createdAt: string;
  /** Link to the OverrideAlert when this assignment broke an engine rule. */
  overrideAlertId?: string;
  /** Link to the Override audit record (always present when an override
   *  occurred — alerts are produced only for medium/high risk). */
  overrideId?: string;
}

// ─── Engine: overrides — audit record vs upward alert ────────────────────────
//
// Override is the immutable, always-emitted audit record of a rule-breaking
// action. OverrideAlert (declared earlier in this file) is the visible
// escalation surface — only produced when riskLevel ≥ medium. This separation
// means every rule break is documented for accountability while only the
// ones that need attention surface upward.
//
// Operational principle: the engine NEVER blocks an action. The action
// commits first; the Override is logged after the fact.

export type OverrideActionKind =
  | 'manual-assignment'         // PC assigned a specific soldier outside engine recommendation
  | 'manpower-below-min'        // slot left below minimum manpower
  | 'rest-violation'            // soldier assigned within minRestAfterHours window
  | 'sleep-violation'           // soldier assigned despite sleep-protected state
  | 'qualification-missing'     // slot doesn't satisfy a qualification requirement
  | 'commander-missing'         // commander-required slot has no commander
  | 'leave-floor-breach'        // leave plan dropped company/platoon below floor
  | 'locked-date-leave'         // leave scheduled on a locked date
  | 'custom';

export interface Override {
  id: string;
  companyId: string;

  action: OverrideActionKind;
  /** Human-readable summary, e.g. "מאמ סימן את ש' שאול לסיור למרות שעבד בלילה". */
  description: string;

  // Who — under the "never block" principle, the actor IS the approver.
  actorUserId: string;
  actorName:   string;
  actorRole:   UserRole;

  // What rules were broken — Observation/Rule back-references.
  brokenRuleIds: string[];
  /** Free-text summary of the rule(s), e.g. "rest-after-ambush · 6h < 12h required". */
  ruleSummary: string;

  // Reason — required when riskLevel='high'; optional otherwise.
  reason?:        string;
  reasonRequired: boolean;

  riskLevel: 'low' | 'medium' | 'high';

  /** Scope of impact — any/all may be present depending on the action. */
  affected: {
    soldierIds?: string[];
    slotIds?:    string[];
    missionIds?: string[];
    platoonIds?: string[];
  };

  timestamp: string;

  /** When risk ≥ medium, the engine raises an OverrideAlert and links it
   *  here. Low-risk overrides log silently for audit only. */
  alertId?: string;
}

// ─── Engine: future availability — eligibility across time ──────────────────
//
// Phase 2 of the engine answers "is soldier X available for slot Y?" — but
// Y can be hours, days, or weeks ahead. AvailabilityForecast is the per-
// soldier sequence of back-to-back state windows over a horizon. Aligning
// windows to state transitions (leave start / leave end / assignment
// start / rest-window end) gives back-to-back coverage with no gaps, so
// any caller can answer any time-point question via lookup.
//
// Computation lands in slice E3 (phase 2). E1 declares the shapes only.

export type AvailabilityState =
  | 'available'         // free for assignment in this window
  | 'on-leave'          // confirmed Leave / LeaveBlock overlaps
  | 'on-mission'        // already assigned to a slot overlapping this window
  | 'resting'           // within minRestAfterHours of a previous shift
  | 'sleep-protected'   // would breach sleep window (e.g. ambush last night)
  | 'inactive-temp'     // Soldier.currentStatus = 'inactive-temp'
  | 'unknown';          // future state cannot be determined

export type AvailabilityBlockedBy =
  | { kind: 'leave-block';  leaveBlockId: string }
  | { kind: 'leave';        leaveId: string }
  | { kind: 'assignment';   slotId: string; missionId: string }
  | { kind: 'rest-window';  previousSlotId: string; restEndsAt: string }
  | { kind: 'sleep-window'; previousSlotId: string; sleepEndsAt: string }
  | { kind: 'status';       value: 'inactive-temp' };

export interface AvailabilityWindow {
  soldierId: string;
  from: string;                                          // ISO
  to:   string;
  state: AvailabilityState;
  /** Source explaining why state !== 'available'. */
  blockedBy?: AvailabilityBlockedBy;
  /** firm — backed by a confirmed assignment / leave.
   *  planned — on the rotation plan but not yet confirmed.
   *  projected — computed from rotation policy + history alone. */
  confidence: 'firm' | 'planned' | 'projected';
}

export interface AvailabilityForecast {
  soldierId:    string;
  horizonStart: string;
  horizonEnd:   string;
  generatedAt:  string;
  /** Back-to-back windows covering [horizonStart, horizonEnd] with no gaps. */
  windows: AvailabilityWindow[];
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

  // ── Duration controls (slice L1 — read-only in this slice) ─────────────
  /** Hard floor — soldier must stay this many continuous days on base
   *  before another home rotation is offered. Prevents 2–3 day rotations
   *  that hurt operational continuity. */
  minBaseDaysBeforeHome?: number;
  /** Soft preference — engine targets this rotation length when scoring
   *  alternative plans. Used as a weight in Phase L6, NOT a hard constraint. */
  preferredRotationLengthDays?: number;
  /** Hard floor — minimum gap between two consecutive home periods for
   *  the same soldier/platoon. Prevents "home Tue, back Thu, home again Fri". */
  minDaysBetweenHomePeriods?: number;

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

// ─── Leave & coverage engine — foundation (slice L1) ────────────────────────
//
// Read-only data shapes for the leave/coverage engine. The algorithm
// pipeline (Phases L0–L8), the planner, the fairness evaluator, and all
// the write paths land in later slices. L1 only establishes the model so
// future slices can plug in cleanly.

// ── Locked date scoping (extensions to CalendarEvent.lockedDate) ──

export type LockedDateCategory =
  | 'duty-start'
  | 'duty-end'
  | 'inspection'
  | 'special-mission'
  | 'preparation'
  | 'escalation'
  | 'command-decision'
  | 'other';

export type LockedDateScope =
  | { kind: 'company' }
  | { kind: 'platoons'; platoonIds: string[] }
  | { kind: 'squads';   squadIds:   string[] }
  | { kind: 'soldiers'; soldierIds: string[] };

// ── DutyExclusion — non-counting period for a single soldier ──
//
// Distinct from LeaveBlock because the soldier isn't on leave — they're
// outside the count entirely. Fairness ignores days inside an exclusion.
// Used for: soldier abroad, outside reserve duty period, extended medical,
// extended personal leave that shouldn't count as "home benefit".

export type DutyExclusionReason =
  | 'abroad'
  | 'outside-duty-period'
  | 'medical'
  | 'personal'
  | 'other';

export interface DutyExclusion {
  id: string;
  companyId: string;
  soldierId: string;
  startIso: string;
  endIso:   string;
  reason: DutyExclusionReason;
  note?:  string;
  /** When true, the engine weights this soldier as "expected to contribute
   *  more" upon return — scheduler prefers giving them base time after
   *  the exclusion window closes to balance the missed contribution. */
  compensateOnReturn: boolean;
  createdBy: string;
  createdAt: string;
}

// ── CoverageEvent — temporary group absence + who covers it ──
//
// The "company barbecue / rest activity / 5-hour off" case. Distinct from:
//   • LeaveBlock — too long, too formal
//   • SoldierStatusEvent — individual, not group
//   • CombatBlock — positive activity, not an absence

export type AbsentScope =
  | { kind: 'platoon';  platoonId:  string }
  | { kind: 'squad';    squadId:    string }
  | { kind: 'soldiers'; soldierIds: string[] };

export type CoveringScope =
  | { kind: 'platoon';                platoonId:  string }
  | { kind: 'squad';                  squadId:    string }
  | { kind: 'soldiers';               soldierIds: string[] }
  | { kind: 'mission-already-covers' };

export type CoverageEventReason =
  | 'company-event'
  | 'rest-activity'
  | 'training'
  | 'logistics'
  | 'other';

export interface CoverageEvent {
  id: string;
  companyId: string;

  /** Who is OUT during this window. */
  absent: AbsentScope;
  /** Who COVERS for them. 'mission-already-covers' when an existing
   *  mission's manpower naturally covers the absence. */
  covering: CoveringScope;

  start: string;                                                  // ISO
  end:   string;

  /** Snapshot at creation time — audit reads correctly even if missions
   *  later change. The engine re-derives at projection time for live views. */
  affectedMissionIds: string[];

  reason: CoverageEventReason;
  notes?: string;

  createdBy: string;
  createdAt: string;
}

// ── LeaveRotationPlan — concrete schedule produced by the engine ──
//
// Editing the policy does NOT retroactively change a published plan.
// The CC re-generates from updated policy when ready.

export type LeaveRotationPlanStatus = 'draft' | 'proposed' | 'published' | 'archived';

export interface LeaveRotationPlan {
  id: string;
  companyId: string;
  policyId: string;                                               // which policy generated this
  periodStartIso: string;
  periodEndIso:   string;
  status: LeaveRotationPlanStatus;

  /** The LeaveBlocks this plan implies. */
  leaveBlockIds: string[];

  /** Snapshots at the moment of last refinement — kept on the plan so the
   *  CC sees the same numbers they approved. */
  coverageSnapshot?: CoverageReport;
  fairnessSnapshot?: FairnessSnapshot;

  notes?:        string;
  createdBy:     string;
  createdAt:     string;
  publishedAt?:  string;
}

// ── Fairness — computed, not stored ──

export interface SoldierFairness {
  soldierId: string;
  daysOnBase:     number;
  daysAtHome:     number;
  nightsOnBase:   number;
  weekendsOnBase: number;
  missionHours:   number;
  /** 0..1 — daysAtHome / (daysAtHome + daysOnBase) over the window. */
  homeRatio: number;
  /** σ from the soldier's platoon mean. */
  loadDeviationFromPlatoon: number;
  /** Days inside any DutyExclusion during the window. */
  excludedDays: number;
  trend: 'rising' | 'steady' | 'falling';
}

export interface PlatoonFairness {
  platoonId:                string;
  meanHomeRatio:            number;
  /** Diff from company mean — positive = more home time than average. */
  homeRatioVsCompany:       number;
  /** σ among soldiers within this platoon. */
  internalVariance:         number;
  overworkedSoldierIds:     string[];
  underworkedSoldierIds:    string[];
}

export type FairnessWarningKind =
  | 'platoon-overworked'
  | 'platoon-underworked'
  | 'soldier-overworked'
  | 'soldier-underworked'
  | 'too-frequent-rotation'
  | 'rotation-too-short';

export interface FairnessWarning {
  id: string;
  kind: FairnessWarningKind;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  affectedSoldierIds?: string[];
  affectedPlatoonIds?: string[];
}

export interface FairnessSnapshot {
  asOf: string;
  windowDays: number;                                             // typically 30
  companyMeanHomeRatio: number;
  perSoldier: SoldierFairness[];
  perPlatoon: PlatoonFairness[];
  warnings:   FairnessWarning[];
}

// ── Coverage report — computed at plan-evaluation time ──

export type CoverageWarningKind =
  | 'unstaffed'
  | 'understaffed'
  | 'commander-missing'
  | 'qualification-missing';

export interface CoverageWarning {
  kind: CoverageWarningKind;
  severity: 'info' | 'warning' | 'critical';
  windowStart: string;
  windowEnd:   string;
  message: string;
}

export interface MissionCoverage {
  missionId: string;
  totalHours:          number;
  fullyCoveredHours:   number;
  understaffedHours:   number;
  unstaffedHours:      number;
  warnings: CoverageWarning[];
}

export interface CoverageReport {
  generatedAt: string;
  windowStart: string;
  windowEnd:   string;
  perMission:  MissionCoverage[];
  fullyCoveredHours: number;
  understaffedHours: number;
  unstaffedHours:    number;
}

// ─── Mission notes — free-text operational extensions ──────────────────────
//
// Mission = structured rules + free operational extensions. The engine
// uses the structured fields (time / manpower / command / fatigue /
// requirements) for scheduling. Notes never feed the algorithm — they
// surface to commanders + soldiers as operational guidance:
//
//   "להחליף כל שעה"
//   "לא להכניס מי שחזר עכשיו מהבית"
//   "לבדוק קשר לפני יציאה"
//   "יוסי אחראי"
//   "כיתה ב תופסת לילה ראשון"
//
// Two scopes:
//   scope='company'  — CC-authored guidance, visible across all platoons
//                      running the mission
//   scope='platoon'  — PC/PS execution detail, visible only inside that
//                      platoon (other platoons running the same mission
//                      don't see this note)

export interface MissionNote {
  id: string;
  missionId: string;
  scope: 'company' | 'platoon';
  /** Required when scope='platoon'. */
  platoonId?: string;
  authorUserId: string;
  authorName:   string;
  authorRole:   UserRole;
  text:         string;
  createdAt: string;
  updatedAt?: string;
}

// ─── Temporary command delegation ───────────────────────────────────────────
//
// Distinct from the PermissionToken / Delegation entity (which grants
// specific permissions). CommandDelegation grants TEMPORARY ACTING COMMAND
// — start/end-bounded, revocable, audited. Real operational situation:
// PC + PS both unavailable for several hours → another soldier takes
// over scheduling / leave-approval / operational control for the window.
//
// The grantor (CC for company-tier, PC for platoon-tier) defines the
// scope, authorities[], and the time window. The system shows a banner
// during the active window and writes audit entries for grant + revoke.

export type CommandAuthority =
  | 'scheduling'           // create/edit assignments + screen schedule
  | 'leave-approval'       // approve/reject LeaveRequests within scope
  | 'operational-control'  // make operational decisions (close base, mark events)
  | 'all';                 // everything the original commander could do

export interface CommandDelegation {
  id: string;
  companyId: string;

  /** Whose authority is being temporarily delegated. */
  fromUserId:   string;
  fromUserName: string;
  /** Who is acting in their place. */
  toUserId:     string;
  toUserName:   string;

  /** Scope of acting command. */
  scope:       'company' | 'platoon';
  scopeRefId?: string;          // platoonId when scope='platoon'; companyId otherwise

  /** Which authorities transfer. Empty array = none (placeholder grant). */
  authorities: CommandAuthority[];

  /** Time window. */
  startIso: string;
  endIso:   string;

  /** Revocation. */
  revoked:           boolean;
  revokedAt?:        string;
  revokedByUserId?:  string;
  revokeReason?:     string;

  reason?:   string;        // why the delegation was needed (e.g. "מ"מ בקורס, סמל בחופש")
  createdAt: string;
}

// ─── Equipment gap reports (soldier → PS → רס״פ flow) ─────────────────────────
//
// Every soldier can report missing/damaged equipment. Reports flow:
//   1. Soldier submits → status 'reported'
//   2. PS / PC reviews → status 'reviewed-by-platoon'
//   3. PC forwards into platoon gap list → status 'forwarded-to-rasap'
//   4. רס״פ resolves → status 'resolved' (or 'dismissed' along the way)
//
// The status pipeline is append-only via state machine transitions.

export type EquipmentGapKind =
  | 'missing'           // signed-out gear missing or never received
  | 'damaged'           // gear damaged, needs replacement / repair
  | 'logistics-issue';  // any other logistics concern

export type EquipmentGapStatus =
  | 'reported'              // soldier submitted, nobody has triaged yet
  | 'reviewed-by-platoon'   // PS/PC saw it, sitting in platoon gap list
  | 'forwarded-to-rasap'    // sent up to logistics
  | 'resolved'              // closed, item replaced/repaired/explained
  | 'dismissed';            // closed without action

export interface EquipmentGap {
  id: string;
  companyId: string;

  // Reporter
  reportedByUserId:    string;
  reportedBySoldierId: string;
  reportedByName:      string;
  reportedByPlatoonId?: string;

  kind:         EquipmentGapKind;
  /** Free-text item identification — could be just a name or include
   *  a serial. When the gap is about a specific signed item, link to
   *  the SignedEquipment record. */
  itemName:     string;
  signedEquipmentId?: string;

  description?: string;

  // Pipeline
  status: EquipmentGapStatus;

  reviewedByUserId?: string;
  reviewedAt?:       string;
  forwardedAt?:      string;
  resolvedByUserId?: string;
  resolvedAt?:       string;
  resolvedNotes?:    string;

  createdAt: string;
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  AUDIENCE — shared discriminated union for targeting                     ║
// ║                                                                          ║
// ║  Reused by Announcement, EscalationEvent, PlatoonLeaveCycleSegment, and  ║
// ║  the lockedDate audience extension on CalendarEvent. Resolved to a flat  ║
// ║  Set<soldierId> by utils/audience.ts so consumers do not duplicate the   ║
// ║  expansion logic. New audience kinds (e.g. 'qualifications') extend the  ║
// ║  union without breaking existing consumers — discriminate on `kind`.     ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export type Audience =
  | { kind: 'company' }
  | { kind: 'platoons';          platoonIds:       string[] }
  | { kind: 'squads';            squadIds:         string[] }
  | { kind: 'soldiers';          soldierIds:       string[] }
  | { kind: 'operational-roles'; operationalRoles: OperationalRole[] };

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  ANNOUNCEMENT — operational message / schedule item                      ║
// ║                                                                          ║
// ║  The single product entity for "the company commander posted a thing".   ║
// ║  Three kinds:                                                            ║
// ║                                                                          ║
// ║    message       — short operational note ("בריפינג בשעה 18:30 ליד החפ״ק")║
// ║    schedule      — schedule item that ALSO appears on the calendar       ║
// ║    operational   — urgent operational guidance, surfaces emphatically    ║
// ║                                                                          ║
// ║  When kind ∈ {schedule, operational} the projection layer renders a      ║
// ║  matching CalendarEntry — we do NOT denormalize a CalendarEvent record.  ║
// ║  Calendar reads from announcements directly, so edits propagate cleanly. ║
// ║  This is the same pattern as Mission → AssignmentSlot projection.        ║
// ║                                                                          ║
// ║  Scale: a company emits maybe 10–50 announcements per duty cycle. The    ║
// ║  visible set for any viewer is bounded by O(audience-match). Search /    ║
// ║  archive filtering happens client-side until storage exceeds ~5k rows,   ║
// ║  at which point the backend will own pagination.                         ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export type AnnouncementKind = 'message' | 'schedule' | 'operational';
export type AnnouncementStatus = 'active' | 'closed' | 'archived';

export interface Announcement {
  id: string;
  companyId: string;

  kind: AnnouncementKind;
  title: string;
  body?: string;

  /** When the announcement is operationally relevant. Open-ended (no endDate)
   *  is allowed for evergreen guidance ("צוות התקשורת בקומה א'"). */
  startDate?: string;                  // ISO date (YYYY-MM-DD)
  endDate?:   string;                  // ISO date
  /** Optional time-of-day component for schedule kind (e.g. בריפינג ב-18:30). */
  startTime?: string;                  // HH:MM
  endTime?:   string;                  // HH:MM

  audience: Audience;

  /** When true (default for kind=schedule), the announcement projects into
   *  the calendar surface as a CalendarEntry. Operators can untoggle for a
   *  message that should appear on Home but not the calendar timeline. */
  showOnCalendar: boolean;

  status: AnnouncementStatus;
  pinned?: boolean;                    // floats to top of the strip

  // Authorship + audit
  createdByUserId: string;
  createdByName:   string;
  createdAt:       string;
  updatedAt?:      string;
  closedAt?:       string;
  closedByUserId?: string;
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  ESCALATION EVENT (הקפצה) — operational call-up                          ║
// ║                                                                          ║
// ║  Top-level emergency event. Only company-tier leadership opens these.    ║
// ║  When ACTIVE, surfaces as a sticky banner across every page for every    ║
// ║  affected viewer. Carries audience + reportTime + endTime + equipment +  ║
// ║  optional links to newly-created missions and temporary delegations      ║
// ║  raised in its wake. Append-only history through openedAt/closedAt.      ║
// ║                                                                          ║
// ║  We deliberately do NOT model partial acknowledgement per-soldier yet —  ║
// ║  the v1 product surfaces the event broadly; per-soldier ack is a phase-2 ║
// ║  feature requiring a real backend (push receipts + ack tokens).          ║
// ║                                                                          ║
// ║  Single source of truth for "is the company on alert right now?":        ║
// ║    escalationEvents.some(e => e.status === 'active')                     ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export type EscalationStatus = 'active' | 'closed';
export type EscalationEndKind = 'planned' | 'unknown';

export interface EscalationEvent {
  id: string;
  companyId: string;

  /** Free-text operational reason ("התרעה צפונית", "ניוד פלוגה לתעוז דרום"). */
  reason: string;
  /** Where to report ("שער ראשי", "תעוז 4", "מתחם החפ״ק"). */
  location?: string;
  /** When to report (ISO). The single most important field. */
  reportTime: string;
  /** Planned end, or 'unknown' for open-ended events. */
  endKind: EscalationEndKind;
  endTime?: string;                    // present iff endKind === 'planned'

  audience: Audience;

  /** Free-text guidance the operations officer wants the audience to see. */
  instructions?: string;
  /** Free-text equipment list ("ווסט · קסדה · מד״ר · כריזה"). Free-form so the
   *  composer doesn't have to wait on the EquipmentItem catalogue. */
  requiredEquipment?: string[];

  /** Back-references to mission(s) created in response to this escalation.
   *  The Mission carries this id back via the new `escalationId` field. */
  spawnedMissionIds?: string[];

  /** Back-references to temporary command delegations raised for this event. */
  spawnedDelegationIds?: string[];

  status: EscalationStatus;

  // Audit — append-only
  openedByUserId: string;
  openedByName:   string;
  openedAt:       string;
  closedByUserId?: string;
  closedByName?:   string;
  closedAt?:       string;
  closeReason?:    string;
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  PLATOON LEAVE CYCLE — concrete home/base rotation plan                  ║
// ║                                                                          ║
// ║  The CC-facing artifact. A Cycle holds a set of Segments. A Segment is   ║
// ║  one row of "this scope is at home / on base, over this window".         ║
// ║                                                                          ║
// ║  Distinct from existing types:                                           ║
// ║    LeaveRotationPolicy — abstract rule set (cycle length, floors, etc.)  ║
// ║    LeaveRotationPlan   — engine-produced concrete plan (future)          ║
// ║    LeaveBlock          — engine atom under a Plan                        ║
// ║    Leave / LeaveRequest— individual leaves, NOT part of the cycle        ║
// ║                                                                          ║
// ║  The cycle is the SIMPLE user-facing thing the CC actually edits. The    ║
// ║  engine concepts above remain as the path the real solver will produce.  ║
// ║  Until the solver exists, the CC's cycle IS the plan.                    ║
// ║                                                                          ║
// ║  Conflict semantics:                                                     ║
// ║    cycle segment (kind='home') vs individual Leave for someone in scope: ║
// ║      both are valid simultaneously — the individual leave is an explicit ║
// ║      'exception' overlay rendered with a distinct visual tone.           ║
// ║                                                                          ║
// ║  Scale: a company has ~1 active cycle per Order. Even at 10 platoons,    ║
// ║  the segment count stays under ~50 per cycle. All projections O(N).      ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export type LeaveCycleStatus = 'draft' | 'published' | 'archived';
export type LeaveCycleSegmentKind = 'home' | 'base-locked';
//                                  ↑      ↑
//                                  |      everybody in scope must be on base
//                                  one scope is at home for this window

export type LeaveCycleSegmentScope =
  | { kind: 'platoon'; platoonId: string }
  | { kind: 'squad';   squadId:   string }
  | { kind: 'soldiers'; soldierIds: string[] };

export interface PlatoonLeaveCycleSegment {
  id: string;
  scope: LeaveCycleSegmentScope;
  kind: LeaveCycleSegmentKind;
  startDate: string;                   // ISO YYYY-MM-DD inclusive
  endDate:   string;                   // ISO YYYY-MM-DD inclusive
  note?: string;
}

export interface PlatoonLeaveCycle {
  id: string;
  companyId: string;
  /** Optional anchor to a specific operational order. When tied to an order
   *  the cycle inherits its time window for display purposes. */
  orderId?: string;
  name: string;                        // free-text label
  status: LeaveCycleStatus;

  segments: PlatoonLeaveCycleSegment[];

  // Authorship + audit
  createdByUserId: string;
  createdAt:       string;
  updatedAt?:      string;
  publishedAt?:    string;
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  TOUR-OF-DUTY SUMMARY — derived (NEVER stored)                           ║
// ║                                                                          ║
// ║  Computed from SoldierStatusEvent[] intersected with OperationalOrder    ║
// ║  windows by utils/tourOfDuty.ts. Carries the on-base / at-home /         ║
// ║  inactive day counts per order, plus an aggregate.                       ║
// ║                                                                          ║
// ║  Why derived: status events are the single source of truth. Storing      ║
// ║  per-order counts would create drift the moment events backfill or get   ║
// ║  corrected. Pure projection guarantees consistency for free.             ║
// ║                                                                          ║
// ║  Performance: O(events × orders) per soldier. For a soldier with 200     ║
// ║  events over 10 orders → 2000 ops. Cached at viewer with useMemo. The    ║
// ║  CC dashboard does NOT compute every soldier's summary on load — Report  ║
// ║  1 doesn't need it; the soldier-detail/profile screens do.               ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export interface TourOfDutyOrderBreakdown {
  orderId?:    string;                 // undefined for "before any order existed"
  orderName?:  string;
  windowStart: string;                 // ISO date
  windowEnd:   string;                 // ISO date
  daysOnBase:  number;
  daysAtHome:  number;
  daysInactive: number;
  /** Within the order window: when does the soldier's PERSONAL current line
   *  end? (== orderEnd unless the soldier has a planned return date). */
  daysRemainingInOrder?: number;
}

export interface SoldierTourSummary {
  soldierId: string;
  asOf: string;

  /** The current line — derived from the active OperationalOrder + the
   *  soldier's current status. When no order is active, this is null. */
  current: TourOfDutyOrderBreakdown | null;

  /** Historical breakdowns, newest first. */
  past: TourOfDutyOrderBreakdown[];

  /** Aggregate over everything in storage. */
  total: {
    daysOnBase:   number;
    daysAtHome:   number;
    daysInactive: number;
  };
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
