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
  // Rasap / logistics module (round 6)
  | 'rasap.viewInventory' | 'rasap.signOut' | 'rasap.return'
  | 'rasap.markDamaged'   | 'rasap.resolveGap'
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
  // Command
  | 'מ״פ' | 'סמ״פ' | 'מ״מ' | 'קשר מ״מ' | 'סמל' | 'קשר סמל' | 'מ״כ'
  // Specialists — combat
  | 'חובש' | 'נגביסט' | 'נגביסט חוד' | 'קלע' | 'קלע חוד'
  | 'מאגיסט' | 'מטוליסט' | 'רובאי' | 'רחפן'
  // Logistics + admin (מפלג / חפ״ק / מטה פלוגתי)
  | 'רס״פ' | 'סרס״פ' | 'שליש' | 'מש״ק קשר'
  // Functional responsibilities visible on the soldier — distinct from
  // FunctionalRole flags (which are machine codes). These are the
  // human-readable role labels that appear next to a soldier's name.
  | 'אחראי ציוד חפ״ק' | 'אחראי ציוד' | 'אחראי מטבח' | 'אחראי מים'
  | 'אחראי ניקיון' | 'נהג';

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
  /** Round-6 additions ─────────────────────────────────────────────────
   *  These four fields denormalize the latest LifecycleEvent so reads are
   *  cheap. The event log remains the source of truth — writes ALWAYS
   *  append an event then update these fields. */
  condition?: EquipmentCondition;
  currentLocation?: EquipmentLocation;
  lastTransitionAt?: string;
  /** Total LifecycleEvents recorded — surfaces "history depth" in the UI
   *  without re-querying. */
  eventCount?: number;
}

export type SoldierStatus =
  | 'in-base'         // בבסיס — operational and present
  | 'home'            // בבית   — on approved leave / rotation home
  | 'inactive-temp';  // לא פעיל זמנית — present but unavailable for assignment

// Append-only audit log of every status change. Soldier.currentStatus
// is a denormalised cache of the latest event for fast reads.
//
// Round 7 expansion — events now capture:
//   • previousValue   — what the status WAS before the transition
//   • setByName       — actor display name (denormalized)
//   • setByRole       — actor role at time of event
//   • isManualOverride— true when a commander set the value for another
//                       soldier (vs the soldier setting their own state)
export interface SoldierStatusEvent {
  id:        string;
  soldierId: string;
  value:     SoldierStatus;
  previousValue?: SoldierStatus;
  setAt:     string;
  setBy:     string;               // userId of whoever set it
  setByName?: string;              // denormalized for audit display
  setByRole?: UserRole;            // role of the setter at time of event
  expectedUntil?: string;
  reason?:   string;
  /** True when a commander updated a soldier's status (vs. soldier
   *  setting their own). Required when isManualOverride=true. */
  isManualOverride?: boolean;
  // Architecture-ready: escalationId? linked when the event is part of an
  // EscalationEvent response. Not used yet.
  escalationId?: string;
}

// Functional roles — additive tags carried alongside the base UserRole.
// Each tag carries a default permission bundle (see permissions.ts).
export type FunctionalRole =
  // Original tags
  | 'rasap'              // רס״פ — logistics chief
  | 'shalish'            // שליש — admin officer
  | 'mashak-kesher'      // מש״ק קשר — comms NCO
  | 'chapack-member'     // חפ״ק member
  | 'logistics-assistant'
  // Phase 6.3 — CHAPAK / MAFLAG configurable responsibilities. Catalog
  // lives in PlatoonStructurePage; operators assign/reassign via chip
  // editor. Each flag is a free-form responsibility carried alongside
  // (not replacing) the soldier's base UserRole.
  | 'srasap'                   // סרס״פ
  | 'equipment-lead-chapack'   // אחראי ציוד חפ״ק
  | 'equipment-lead'           // אחראי ציוד (מפלג)
  | 'comms-lead'               // אחראי קשר
  | 'drone-operator'           // מפעיל רחפן
  | 'driver'                   // נהג
  | 'ops-clerk'                // מ״ק חפ״ק
  | 'kitchen-lead'             // אחראי מטבח
  | 'water-lead'               // אחראי מים
  | 'cleaning-lead';           // אחראי ניקיון

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

  // ── Round 6 / Phase 6.0 — Recall handling ─────────────────────────
  // When a leave is cut short due to escalation/operational need, we
  // mark these three fields. The system tracks "recall debt" — the
  // soldier is owed home-time in the next cycle. Burden score reads
  // these to apply a recall penalty.
  /** True when CC/PC recalled the soldier mid-leave. */
  wasRecalled?: boolean;
  /** ISO timestamp the recall was issued. */
  recalledAt?: string;
  /** Free-text reason ('הקפצה / חולה במחלקה / החלפה בשמירה'). */
  recallReason?: string;
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

  /** Phase 6.0 — Fatigue policy at the COMPANY level.
   *
   *  Authority chain (highest to lowest):
   *    1. mission.fatigueOverride?.minRestHoursByShiftLength
   *    2. company.settings.fatigue?.minRestHoursByShiftLength
   *    3. GLOBAL_DEFAULTS (defined in engine code, currently 8/12/24)
   *
   *  Each entry says "after a shift of N hours, the soldier needs M
   *  hours of rest before the next shift". 0-hour shifts (admin) inherit
   *  the next bracket up.
   */
  fatigue?: FatiguePolicy;
}

// ─── Fatigue policy — configurable per company/mission ────────────────────
//
// Single source of truth for "how long must a soldier rest before the
// next shift". Authoritative defaults live in engine code (GLOBAL_DEFAULTS).
// Companies override via CompanySettings.fatigue; specific missions can
// further override via Mission.fatigueOverride.
//
// The model is a piecewise mapping: shift length (hours, ceiling) → minimum
// rest required (hours). Implementation uses largest-key-≤-shift-length.

export interface FatiguePolicy {
  /** Map shift-length-ceiling → required-rest-hours.
   *  Engine looks up `Math.max(...keys.filter(k => k <= shiftLength))`.
   *  Example: { 8: 8, 12: 12, 24: 24, 48: 36 }
   *    → 6h shift needs 8h rest, 16h shift needs 12h rest,
   *      25h shift needs 24h rest, 50h shift needs 36h rest. */
  minRestHoursByShiftLength: Record<number, number>;

  /** Floor on absolute consecutive base days (no home leave) before the
   *  burden score starts heavily penalizing scheduling. */
  consecutiveBaseDaysCap?: number;

  /** Window in days over which fatigue/burden are computed. Default 30. */
  computationWindowDays?: number;
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
  /** Default storage location for un-signed units. Free text. */
  defaultLocation?: EquipmentLocation;
  /** Optional manufacturer / serial-prefix metadata. Imported from CSV. */
  manufacturer?: string;
  serialPrefix?: string;
  /** Total deployed (signed out) count — derived but cached when present. */
  deployedCount?: number;
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
/**
 * Severity of an equipment requirement — drives engine behavior:
 *
 *   critical  — HARD filter. Soldier without the item is not even a candidate.
 *               Mission cannot enter `active` status if the gap is open.
 *               Example: נשק for a combat patrol; חבישה for a 24h shift.
 *
 *   required  — SOFT filter with heavy penalty. Soldier without the item
 *               receives a -30 score. Mission can run but generates a
 *               `warning` alert. Example: אפוד for standard guard.
 *
 *   soft      — INFORMATIONAL only. Soldier without the item receives a
 *               -10 score nudge. No alert. Example: ציוד משני, פנס.
 */
export type EquipmentRequirementLevel = 'soft' | 'required' | 'critical';

export interface EquipmentRequirement {
  equipmentItemId: string;
  count: number;
  /** True when each soldier needs one (helmet); false when one per shift
   *  satisfies the slot (ladder). */
  perSoldier: boolean;
  /** Severity tier. Defaults to 'required' when absent to preserve legacy
   *  data shape; new authoring sites MUST set this explicitly. */
  level?: EquipmentRequirementLevel;
}

// ─── Engine: Mission — the unified contract ─────────────────────────────────
//
// Replaces CompanyMission + MissionType under one shape. The legacy entities
// stay declared elsewhere in this file for one transitional commit so existing
// screens keep compiling. Slice E9 deletes them.

// Expanded mission lifecycle.
//
//   draft                — author still composing
//   active-unstaffed     — definition published; no platoon assigned yet
//   staffing-pending     — assigned to a platoon, awaiting per-soldier staffing
//   active               — staffed and operational (legacy default)
//   staffed              — engine produced a full assignment plan
//   partially-staffed    — some shifts assigned, gaps remain
//   paused               — manually paused; no new shifts produced
//   archived             — historical
//
// The wizard saves new missions to `active-unstaffed` by default (round 5);
// the staffing flow on /mission/:id transitions to `assigned-to-platoon`
// then `staffing-pending` then `staffed`. Legacy 'active' remains as the
// catch-all so existing fixtures keep compiling.
export type MissionStatus =
  | 'draft'
  | 'active-unstaffed'
  | 'assigned-to-platoon'
  | 'staffing-pending'
  | 'active'
  | 'staffed'
  | 'partially-staffed'
  | 'paused'
  | 'archived';

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

  // ── Phase 6.0 — Engine signals ──────────────────────────────────
  /** Burden weight category. Hard shifts contribute disproportionately
   *  to `SoldierBurden.hardShiftHours`. Defaults to 'standard' when
   *  absent to preserve legacy mission shape. */
  difficulty?: MissionDifficulty;

  /** Per-mission override of fatigue rules. When absent, the engine
   *  falls back to company.settings.fatigue → GLOBAL_DEFAULTS. */
  fatigueOverride?: FatiguePolicy;

  /** When true, the PC cannot split or alter the per-slot shift
   *  duration during staffing — only the CC who authored the mission
   *  can. Surfaced in the StaffingSheet as a locked indicator on the
   *  duration controls. Default: false. */
  shiftDurationLocked?: boolean;
}

/**
 * Mission difficulty tier — drives the burden score's `hardShiftHours`
 * weight and the engine's repetition penalty.
 *
 *   standard  — guard, kitchen, cleaning, container loading.
 *   hard      — 24/7 guard, patrol, מארב, heavy container ops, IDF support.
 *   critical  — combat, off-base ops, night ops with operational risk.
 */
export type MissionDifficulty = 'standard' | 'hard' | 'critical';

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

// ─── Mission Operations Layer (Phase 6.9) ──────────────────────────────────
//
// Per-slot operator-asserted state that ANY future re-pick must respect.
// The engine treats this as hard constraint input — separate from
// Assignment (which is "current picks") so the operator's deliberate
// manipulations survive any recompute / auto-restaff / chaos overlay.
//
// Keys:
//   • lockedSoldierIds — these soldiers stay on this slot. Auto-pick may
//     fill REMAINING capacity but must not displace a locked soldier.
//   • lockedPair — these two soldiers move together. Either both in the
//     slot, or neither. Mirrors the operational "זוגות קבועים" pattern.
//   • lockedCommander — explicit commander pin for this slot.
//   • excusedUntil — per-soldier temporary exclusion. The materializer
//     drops them from THIS slot's eligible pool until the cutoff iso.
//   • forcedRationale — Hebrew prose captured when the operator force-
//     assigned despite a violation. Survives across recomputes.
//   • operationalNotes — free-form per-slot note (PC/PS context).
//
// All times are ISO. updatedAt + updatedByUserId record the operator
// who last mutated this state.

export interface SlotExcuse {
  soldierId: string;
  untilIso: string;
  reason?: string;
}

export interface SlotOperationalState {
  /** Deterministic materialized slot id (`mat-<missionId>-<date>-<idx>`). */
  slotId: string;
  /** Soldiers protected from auto-rebalance on this slot. */
  lockedSoldierIds?: string[];
  /** Atomic pair — both present or neither. */
  lockedPair?: [string, string];
  /** Explicit commander for this slot. */
  lockedCommander?: string;
  /** Per-soldier temporary exclusion from this slot's eligible pool. */
  excusedUntil?: SlotExcuse[];
  /** Free-form rationale when the operator force-assigned despite a
   *  violation. Stored separately from SelectorOutcomeRecord because
   *  this MUST persist even if the audit table is pruned. */
  forcedRationale?: string;
  /** PC/PS operational note attached to the slot. */
  operationalNotes?: string;
  /** ISO timestamp of last mutation. */
  updatedAt: string;
  /** User who last mutated this state. */
  updatedByUserId: string;
}

// ─── Operational Leave Management (Phase 6.10) ─────────────────────────────
//
// Day-based model for "who's home / who's in base" planning at the
// COMPANY level. Distinct from the existing PlatoonLeaveCycle (which
// is a richer segment-based scheduling artifact). This is the simpler
// operational layer the CC/DCC actually uses to plan rotations.
//
// Two parallel concepts:
//   1. PlatoonLeaveDay — per-date per-platoon home/base. Best fit for
//      combat platoons (g1/g2/g3) that rotate as a unit.
//   2. CoverageRule — operational invariants for CHAPAK/MAFLAG who
//      DON'T rotate as a unit. Rules like "min 3 חפ״ק in base", "min 1
//      driver", "team [s12,s13,s71] always together", etc.
//
// Engine consumes both: materializer excludes home-platoon soldiers
// from the eligible pool; coverage rules surface as warnings (Phase
// 6.10 MVP doesn't enforce them at pick-time — that's a follow-up).

export type PlatoonLeaveDayStatus = 'home' | 'in-base' | 'partial';

export interface PlatoonLeaveDay {
  /** ISO YYYY-MM-DD. */
  dateIso: string;
  platoonId: string;
  status: PlatoonLeaveDayStatus;
  /** Optional human note ("חזרה הדרגתית", "תרגיל בוקר"). */
  notes?: string;
  /** When locked, automatic rotation generators must NOT overwrite. */
  locked?: boolean;
  updatedAt: string;
  updatedByUserId: string;
}

export interface CompanyLeavePolicy {
  companyId: string;
  /** Concurrent home-platoon cap. */
  maxPlatoonsHome: number;
  /** Default cycle stint (days a platoon spends home before coming back). */
  homeStintDays: number;
  /** Minimum days between consecutive home stints for the same platoon. */
  minBaseGapDays: number;
  /** Policy mode — "manual" disables auto-generation; "one-at-a-time" /
   *  "two-at-a-time" are convenience presets. */
  mode: 'manual' | 'one-at-a-time' | 'two-at-a-time';
  updatedAt: string;
  updatedByUserId: string;
}

/** Operational coverage invariant. Evaluated PER DAY against the set of
 *  soldiers who would be "in base" that day. When violated, surfaces as
 *  a warning. The engine does NOT yet enforce these at pick-time. */
export type CoverageRule =
  | {
      id: string;
      kind: 'min-count-in-platoon';
      label: string;
      platoonId: string;
      min: number;
    }
  | {
      id: string;
      kind: 'min-with-functional-role';
      label: string;
      functionalRole: FunctionalRole;
      min: number;
      scopePlatoonId?: string;
    }
  | {
      id: string;
      kind: 'min-with-operational-role';
      label: string;
      operationalRole: OperationalRole;
      min: number;
      scopePlatoonId?: string;
    }
  | {
      id: string;
      kind: 'team-together';
      label: string;
      soldierIds: string[];
    }
  | {
      id: string;
      kind: 'mutual-exclusion';
      label: string;
      soldierIds: string[];
    };

export interface CompanyCoverageRuleSet {
  companyId: string;
  rules: CoverageRule[];
  updatedAt: string;
  updatedByUserId: string;
}

/** Soldier-level override that beats the platoon-day default for one
 *  specific (date, soldier) pair. Use cases: a soldier from a home
 *  platoon called back early, or a single soldier from an in-base
 *  platoon sent home for a personal reason without taking the whole
 *  unit out. */
export interface SoldierLeaveOverride {
  id: string;
  dateIso: string;
  soldierId: string;
  status: 'home' | 'in-base';
  reason?: string;
  createdAt: string;
  createdByUserId: string;
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

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  RASAP / LOGISTICS MODULE — round 6                                      ║
// ║                                                                          ║
// ║  Adds three things on top of the existing EquipmentItem +                ║
// ║  SignedEquipment + EquipmentGap entities:                                ║
// ║                                                                          ║
// ║  1. Location tracking on every SignedEquipment record.                   ║
// ║  2. Condition score (0–100) representing wear / damage state.            ║
// ║  3. Lifecycle event log — an append-only audit of every transition       ║
// ║     (sign-out, return-full, return-partial, damage-report, repair,      ║
// ║     loss, write-off). The log is the source of truth; the SignedEquip   ║
// ║     record itself just denormalizes the latest state.                    ║
// ║                                                                          ║
// ║  State machine for a signed item:                                        ║
// ║                                                                          ║
// ║     ┌─ active ──── damage-reported ──── in-repair ── returned/lost      ║
// ║     │      │                                                            ║
// ║     │      └───── returned (full or partial)                            ║
// ║     │                                                                   ║
// ║     └── lost                                                            ║
// ║                                                                          ║
// ║  Transitions are validated in AppContext actions. Each transition       ║
// ║  appends an EquipmentLifecycleEvent for audit. The server will mirror   ║
// ║  this exact state machine.                                              ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/** Coarse condition buckets shown on the inventory ledger. */
export type EquipmentCondition = 'new' | 'good' | 'worn' | 'damaged' | 'unusable';

/** A free-text location label — "מחסן רס״פ", "תעוז 4", "אצל החייל". */
export type EquipmentLocation = string;

export type EquipmentLifecycleEventKind =
  | 'sign-out'         // item handed to a soldier
  | 'return-full'      // soldier returns item in expected condition
  | 'return-partial'   // soldier returns item with damage / missing parts
  | 'damage-report'    // damage reported (by soldier or commander) without return
  | 'repair-start'     // sent to repair
  | 'repair-complete'  // returned from repair
  | 'lost'             // item declared lost
  | 'write-off';       // item retired from inventory

export interface EquipmentLifecycleEvent {
  id: string;
  companyId: string;
  /** Either references a SignedEquipment (per-soldier ledger) or a base
   *  EquipmentItem (inventory-level event). At least one is present. */
  signedEquipmentId?: string;
  equipmentItemId?:   string;
  kind: EquipmentLifecycleEventKind;
  /** Free-text describing what happened. */
  description?: string;
  /** Snapshot of condition after this event. */
  conditionAfter?: EquipmentCondition;
  /** Snapshot of location after this event. */
  locationAfter?:  EquipmentLocation;
  /** Who triggered the event. */
  actorUserId: string;
  actorName:   string;
  actorRole:   UserRole;
  /** When item changes hands: the soldier on the other side. */
  fromSoldierId?: string;
  toSoldierId?:   string;
  occurredAt: string;
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  UNIFIED ALERT — round 5                                                 ║
// ║                                                                          ║
// ║  Single surface for everything that needs the operator's attention:      ║
// ║  active escalations, unstaffed missions, override events, manpower       ║
// ║  shortfalls. Heterogeneous sources unified behind one Alert shape so     ║
// ║  AlertsPage + AlertsSheet + dashboard badge consume one stream.          ║
// ║                                                                          ║
// ║  Projected, NEVER stored. The api/alerts module computes from current    ║
// ║  state. When backend lands, a single `/alerts?companyId=X` endpoint     ║
// ║  materializes the same shape — UI doesn't change.                       ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export type AlertKind =
  | 'escalation-active'
  | 'mission-unstaffed'
  | 'override-open'
  | 'manpower-shortfall'
  | 'announcement-operational';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface Alert {
  id: string;
  companyId: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  message?: string;
  occurredAt: string;
  /** Back-reference to the origin entity. */
  source:
    | { kind: 'escalation';     id: string }
    | { kind: 'mission';        id: string }
    | { kind: 'override-alert'; id: string }
    | { kind: 'platoon';        id: string }
    | { kind: 'announcement';   id: string };
  suggestedAction?: string;
  actionHref?: string;
  /** When set, scope visibility to a specific platoon (PC/PS view). */
  platoonId?: string;
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  LOGISTICS ROTATIONS (סבבים לוגיסטיים) — round 8                         ║
// ║                                                                          ║
// ║  Owned by רס״פ. Recurring or one-off chores that need a soldier or       ║
// ║  squad assignment per occurrence: kitchen duty, container loading,       ║
// ║  water refill, weapon cleaning, etc. NOT operational missions —          ║
// ║  separate authoring + queue from the engine.                             ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export type LogisticsRotationKind =
  | 'kitchen'        // ארוחות / מטבח
  | 'cleaning'       // ניקיון שטחים ציבוריים
  | 'container'      // פריקת/סידור מכולה
  | 'water'          // מילוי מים
  | 'weapons'        // ניקוי נשקים
  | 'loading'        // העמסת ציוד
  | 'custom';

export type LogisticsRotationStatus = 'planned' | 'in-progress' | 'done' | 'cancelled';

export interface LogisticsRotation {
  id: string;
  companyId: string;
  kind: LogisticsRotationKind;
  title: string;
  description?: string;
  /** Soldier ids assigned to this occurrence (1..N). */
  assignedSoldierIds: string[];
  /** Optional squad-level assignment for "whole-squad" chores. */
  squadId?: string;
  startIso: string;
  endIso?:  string;
  status: LogisticsRotationStatus;
  createdByUserId: string;
  createdByName:   string;
  createdAt: string;
  /** Free-text notes the רס״פ adds when reviewing. */
  notes?: string;
}

export const LOGISTICS_ROTATION_LABEL: Record<LogisticsRotationKind, string> = {
  kitchen:   'מטבח',
  cleaning:  'ניקיון',
  container: 'מכולה',
  water:     'מים',
  weapons:   'ניקוי נשקים',
  loading:   'העמסת ציוד',
  custom:    'משימה לוגיסטית',
};

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  PHASE 6.0 — ENGINE TYPES                                                ║
// ║                                                                          ║
// ║  The contract layer for the scheduling engine: scoring, burden,          ║
// ║  replacements, checklists, and the focus-mode "what's burning now"      ║
// ║  derived view. None of these own state directly — they're either        ║
// ║  computed at read-time (Burden, Focus, CandidateScore) or persisted      ║
// ║  in their own tables (ChecklistRun, Replacement).                        ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// ─── Burden score — composite fairness signal ──────────────────────────
//
// Computed at read-time per soldier from the last `windowDays` of:
//   • SoldierStatusEvent log     → daysBase, daysHome, consecutiveBaseDays
//   • MaterializedSlot history   → totalShiftHours, hardShiftHours, missionVariety, repetitionFlag
//   • LogisticsRotation history  → rotationLoad
//   • Leave entries              → recallEvents, daysSinceLastHome
//
// The score is a SOFT input to the engine — it penalizes scheduling
// already-burdened soldiers but never blocks. Display layer surfaces
// the breakdown in human terms ("טחן: 4 משמרות קשות, 9 ימים רצופים").

/**
 * Burden score is computed from 12 raw operational signals, BUT the UI
 * never shows the soldier as "12 numbers". Instead the engine groups
 * the signals into 4 explainable factors, each with a plain-text reason.
 * The PC/CC sees four bars + a headline; the raw signals stay available
 * for forensic queries (audit, debugging) but are NOT the surfaced
 * model.
 *
 * Design constraint per Phase 6.0 review: NEVER black-box. Every score
 * must be reducible to a sentence a human can verify.
 */

export interface BurdenSignals {
  // ── Time & distribution ─────────────────────────────────────────
  daysBase:             number;
  daysHome:             number;
  consecutiveBaseDays:  number;
  daysSinceLastHome:    number;

  // ── Work intensity ──────────────────────────────────────────────
  totalShiftHours:      number;
  hardShiftHours:       number;
  rotationLoad:         number;

  // ── Patterns ────────────────────────────────────────────────────
  consecutiveHardShifts: number;
  missionVariety:       number;
  /** True when soldier has done same mission type ≥ 4 times in 7 days. */
  repetitionFlag:       boolean;

  // ── Stress events ───────────────────────────────────────────────
  recentRecallEvents:   number;
  daysSinceLastRecall:  number | null;   // null = never recalled
}

/** A burden FACTOR is one of the four human-meaningful groupings. Each
 *  factor carries its own sub-score (0-100) AND a plain Hebrew sentence
 *  explaining WHY this factor scored what it did. The composite
 *  burdenScore is a weighted blend of the four factor scores. */
export interface BurdenFactor {
  /** 0-100 contribution; higher = more burdened on this axis. */
  score: number;
  /** One sentence the operator reads first ("4 משמרות קשות תוך 7 ימים"). */
  explain: string;
  /** Which raw signals fed this factor — for forensic drill-down. */
  signalKeys: Array<keyof BurdenSignals>;
}

export interface SoldierBurden {
  soldierId: string;
  /** ISO date stamp of when this snapshot was computed. */
  computedAt: string;
  /** Computation window — typically 30 days. */
  windowDays: number;

  /** Raw operational signals — NOT for direct UI display. Use `factors`. */
  signals: BurdenSignals;

  /** Four human-meaningful factors. UI surfaces these as bars + text. */
  factors: {
    /** How much actual work — shift hours, hard hours, rotations. */
    workIntensity:   BurdenFactor;
    /** How depleted — consecutive base days, days-since-home. */
    recoveryDeficit: BurdenFactor;
    /** How fair the pattern was — variety, repetition. */
    rotationPattern: BurdenFactor;
    /** Stress events — recalls. */
    stressLoad:      BurdenFactor;
  };

  /** Weighted blend of the four factor scores. 0 = relaxed, 100 = redline. */
  burdenScore: number;

  /** The single-most important factor surfaced as one sentence.
   *  Example: "טחן: 4 משמרות קשות + 9 ימים רצופים בבסיס". */
  headline: string;

  /** True iff burdenScore is above this platoon's p75. */
  overShoot: boolean;
}

/** Tunable weights for the composite burdenScore. Stored centrally so
 *  the formula can be revisited after 4 weeks of usage data without
 *  touching engine code. These weights blend the four FACTORS — the
 *  raw signal weights live inside each factor calculator. */
export interface BurdenWeights {
  workIntensity:   number;   // default 0.35
  recoveryDeficit: number;   // default 0.30
  rotationPattern: number;   // default 0.20
  stressLoad:      number;   // default 0.15
}

// ─── Candidate score — engine's per-soldier-per-slot output ──────────
//
// What the staffing UI surfaces in the candidate list tooltip. Every
// dimension has an `explain` string so the PC/CC sees WHY a candidate
// scored what they scored. No black-box selection.

export interface CandidateScore {
  soldierId: string;
  slotId: string;

  /** Final score 0–100. Higher = more eligible. */
  score: number;

  /** True iff any hard filter would reject this candidate. UI typically
   *  greys these out but still shows them (with the failed filter visible)
   *  so the operator can override. */
  hardFiltersFailed: HardFilterCode[];

  /** Per-dimension breakdown. Each entry is independent so the UI can
   *  render a histogram bar + plain-text reason. */
  dimensions: CandidateScoreDimension[];
}

export interface CandidateScoreDimension {
  /** Internal name for the dimension (used by tests). */
  key: 'load' | 'fatigue' | 'qualMatch' | 'cohesion' | 'burden';
  /** 0–100 contribution to the final score. */
  value: number;
  /** Human-readable explanation surfaced in the candidate tooltip. */
  explain: string;
}

export type HardFilterCode =
  | 'soldier-home'
  | 'soldier-inactive'
  | 'on-leave'
  | 'in-leave-cycle-home'
  | 'duty-exclusion'
  | 'missing-qualifications'
  | 'wrong-platoon'
  | 'time-conflict'
  | 'squad-policy-violation'
  | 'critical-equipment-missing';

// ─── Selector outcome — the full story of staffing one slot ──────────
//
// Per Phase 6.0 review: the staffing UI must NEVER show "X was picked"
// without confidence + reasoning. Operators distrust black-box choices.
// SelectorOutcome carries:
//   • the picked soldiers (with their scores)
//   • confidence (0-1) — how clear was the pick vs the next alternate?
//   • forced flag — did we accept any constraint violation to fill?
//   • plain-text reasoning — one or two sentences the operator reads
//   • violations — every soft/hard constraint that was overridden
//   • alternates — runner-up candidates if the operator wants to swap

export interface SelectorOutcome {
  slotId: string;

  /** Soldiers picked for this slot. Ordered by score desc. May be
   *  shorter than `required` — then alerts.length > 0. */
  picked: PickedSoldier[];

  /** 0-1 confidence in the picks. Computed as:
   *    avg(picked.score) - avg(top-N alternates' scores), normalized.
   *  High confidence (> 0.7) → clear winners. Low (< 0.3) → close race,
   *  PC should review alternates. */
  confidence: number;

  /** True iff at least one pick required an override (hard filter
   *  violation accepted, or score below acceptable threshold). When
   *  true, the UI badges the slot as "ידני / כפוי". */
  forced: boolean;

  /** One- or two-sentence summary the operator reads first.
   *  "3 חיילים מאוישים, אחד עם עייפות חורגת — צריך אישור".
   *  "אין מועמדים זמינים, slot נשאר פתוח". */
  reasoning: string;

  /** Constraint violations made to reach this selection. Empty list
   *  means a clean pick. */
  violations: SelectorViolation[];

  /** Runner-up candidates if the operator wants to second-guess.
   *  Limited to top 5 to keep the UI lean. */
  alternates: CandidateScore[];

  /** Alerts the selector produced as a side effect (manpower-shortfall,
   *  fatigue-violation, etc.). The Alerts pipeline picks these up. */
  alerts: SelectorAlert[];

  /** Plain-Hebrew sentences explaining WHY confidence dropped below its
   *  base value. Empty when no decay was applied. Each entry maps to ONE
   *  decay multiplier (forced fills, shortfall, override chain, critical
   *  equipment). The UI surfaces these directly so confidence is never
   *  a "magic number" — operators see the exact reasons.
   *
   *  Example:
   *    ["שיבוץ אחד בכפייה (-50%)", "חסרים 2 שיבוצים (-60%)"]
   */
  decayReasons: string[];
}

export interface PickedSoldier {
  soldierId: string;
  /** The full score breakdown — UI shows tooltip with this. */
  score: CandidateScore;
  /** Set when this pick required override. Mandatory reason for audit. */
  forcedReason?: string;
}

export interface SelectorViolation {
  /** Which constraint was violated. */
  code: HardFilterCode | 'fatigue-violation' | 'cohesion-broken' | 'qual-suboptimal';
  /** Soldier the violation applies to. */
  soldierId: string;
  /** Severity of the violation:
   *    'soft'     — score penalty, no operator confirmation needed
   *    'override' — required operator confirmation (reason captured) */
  severity: 'soft' | 'override';
  /** Human-readable explanation. */
  explain: string;
}

export interface SelectorAlert {
  kind: 'manpower-shortfall' | 'fatigue-violation' | 'home-assignment'
      | 'qual-mismatch' | 'cohesion-broken' | 'critical-equipment-missing';
  severity: AlertSeverity;
  /** Plain-text content for the alerts feed. */
  message: string;
  /** Affected entity for invalidation. */
  affectedSoldierIds: string[];
}

// ─── Replacement — chaos-flow first-class entity ─────────────────────
//
// When a soldier is removed from a slot and another is put in their
// place (sickness, no-show, recall, override), the system records BOTH:
//
//   1. A shallow flag on the MaterializedSlot itself (`replacementOf`)
//      so the staffing UI can render "🔁 replaced" without a join.
//
//   2. A persistent Replacement entity (this one) capturing the full
//      audit story — actor, reason, timestamp, optional chain.

export interface Replacement {
  id: string;
  companyId: string;
  /** The slot whose soldier was replaced. */
  slotId: string;
  /** Soldier who was removed from the slot. */
  originalSoldierId: string;
  /** Soldier who took the slot. May be undefined if the slot remains open. */
  newSoldierId?: string;
  /** Which user performed the replacement (PC/CC/Rasap). */
  actorUserId: string;
  actorName: string;
  /** Free-text justification — required. */
  reason: string;
  /** When this replacement happened. */
  occurredAt: string;
  /** Pointer to a previous Replacement on the same slot if this is part
   *  of a chain (slot replaced 3 times in 24h = signal of chaos). */
  previousReplacementId?: string;
}

// ─── Checklist — readiness check (צל״ם) ──────────────────────────────
//
// A ChecklistRun is INSTANTIATED by CC/Deputy at any moment (general
// readiness drill) OR pre-mission. It scopes a set of soldiers and a
// template of items to verify. Per-soldier results live in ChecklistInstance.

export interface ChecklistTemplate {
  id: string;
  companyId: string;
  name: string;
  /** Pre-defined items the checker steps through per soldier. */
  items: ChecklistItem[];
  /** Optional category — drives default sort and grouping in UI. */
  category?: 'full' | 'ammunition' | 'comms' | 'medical' | 'custom';
  createdAt: string;
}

export interface ChecklistItem {
  /** Stable key — referenced in ChecklistInstance.items. */
  key: string;
  /** Display label (חולצה / קסדה / מחסניות / חבישה גוף). */
  label: string;
  /** When > 1, the item has a count (e.g. 3 mags); otherwise binary. */
  expectedCount?: number;
  /** Which equipment category this maps to — feeds gap creation. */
  equipmentCategory?: SignedEquipmentCategory;
  /** Severity tier mirrors EquipmentRequirementLevel — critical items
   *  cause the soldier's instance to fail with high alert; soft items
   *  contribute to score but not status. */
  level: EquipmentRequirementLevel;
}

export type ChecklistRunScope =
  | { kind: 'company' }
  | { kind: 'platoon';  platoonId: string }
  | { kind: 'squad';    squadId:   string }
  | { kind: 'soldiers'; soldierIds: string[] };

export type ChecklistRunStatus = 'open' | 'completed' | 'cancelled';

export interface ChecklistRun {
  id: string;
  companyId: string;
  templateId: string;
  scope: ChecklistRunScope;
  /** Optional binding to a mission — pre-mission checks reference the
   *  mission so its readiness gate can resolve. */
  missionId?: string;
  /** Who initiated the run (CC or PC). */
  initiatedByUserId: string;
  initiatedByName: string;
  /** When the check should be done by. UI surfaces a countdown. */
  deadline?: string;
  /** Note shown to the executors. */
  notes?: string;
  status: ChecklistRunStatus;
  /** Resume state — the executor's partial progress, written on sheet
   *  close (not on every tick). JSONB structure matches the in-app
   *  partial form state. Loaded on next open. */
  partialState?: ChecklistRunPartialState;
  lastUpdatedAt?: string;
  createdAt: string;
  completedAt?: string;
}

/** Persisted partial state for resume — opaque to the engine; the UI
 *  is the only reader/writer. */
export interface ChecklistRunPartialState {
  /** soldier_id → per-item status map. Empty until the executor touches a card. */
  byInstance: Record<string, {
    items: Record<string, { present: boolean; actualCount?: number; notes?: string }>;
    status: 'in-progress' | 'pending';
  }>;
}

export type ChecklistInstanceStatus = 'pending' | 'in-progress' | 'passed' | 'failed';

export interface ChecklistInstance {
  id: string;
  runId: string;
  soldierId: string;
  status: ChecklistInstanceStatus;
  /** Who performed the check (typically a sergeant/PC). */
  checkedByUserId?: string;
  completedAt?: string;
  items: ChecklistInstanceItem[];
}

export interface ChecklistInstanceItem {
  /** Matches ChecklistItem.key. */
  key: string;
  present: boolean;
  actualCount?: number;
  /** Item-specific condition override (defaults from soldier's equipment). */
  condition?: EquipmentCondition;
  notes?: string;
  /** When false + level=critical → instance auto-fails. */
}

// ─── Quiet mode — alerts hierarchy control ───────────────────────────
//
// Per-user preference that suppresses non-critical alerts in the hero
// dashboard layer for a bounded window. Critical alerts always break
// through. Never persists across the chosen window — explicit by design.

export type QuietModeDuration = '30m' | '1h' | '2h' | '4h';

export interface QuietModePreference {
  duration: QuietModeDuration;
  /** ISO timestamp the mode was activated. */
  activatedAt: string;
  /** ISO timestamp the mode will expire (computed from duration). */
  expiresAt: string;
}

// ─── Focus mode — "what requires a DECISION right now" ────────────────
//
// Per Phase 6.0 review: Focus is NOT another alerts feed. An alert says
// "this happened" — a FocusItem says "you need to decide something, and
// here's the decision".
//
// Filtering rules:
//   • Item must require a HUMAN judgment (engine cannot resolve alone)
//   • Item must have a concrete deadline or operational impact within
//     the next 24 hours (otherwise it belongs in the alerts feed)
//   • Item must surface a SPECIFIC primary action — not just "view details"
//
// Display: max 5 items on the dashboard. Sort by `decisionRequiredBy`
// ascending (soonest deadline first). Items past their deadline are
// auto-promoted to the AlertsPage as critical.

export type FocusItemKind =
  | 'cover-leaving-platoon'      // "מחלקה X יוצאת לבית 14:00 — מי מכסה?"
  | 'staff-mission-now'          // "משימה X מתחילה ב-22:00 — חסרים 2 שיבוצים"
  | 'recall-non-compliant'       // "דני לוי לא חזר מהקפצה — מה ההמשך?"
  | 'replace-vanished-soldier'   // "אבי לא הגיע למשמרת — מי מחליף?"
  | 'approve-pending-leave'      // "3 בקשות יציאה ממתינות > 8 שעות"
  | 'resolve-critical-gap'       // "חסר נשק לחייל ששובץ למחר 06:00"
  | 'close-active-escalation';   // "הקפצה פעילה מאתמול — לסגור או לשמור?"

export interface FocusItem {
  /** Stable id derived from the underlying entity (e.g. `cover-{platoonId}-{dayIso}`)
   *  so the UI can dedup across renders. */
  id: string;
  kind: FocusItemKind;

  /** The DECISION the viewer needs to make, phrased as a question.
   *  Example: "מי מכסה את שמירת השער ב-22:00?"
   *  NOT a status: NOT "שמירת השער חסרה איוש". */
  decisionPrompt: string;

  /** Context — one sentence on why this needs a decision now.
   *  Example: "מחלקה 2 בבית, שמירה קבועה ב-22:00, אין כיסוי מוגדר". */
  context: string;

  /** When the decision must be made by — drives sort order and
   *  "overdue" promotion to alerts. */
  decisionRequiredBy: string;

  /** Severity of the impact if the decision isn't made in time. */
  severity: AlertSeverity;

  /** The primary action — opens the specific decision flow.
   *  Example: { label: "הגדר כיסוי", href: "/coverage?day=2026-05-15" } */
  primaryAction: FocusAction;

  /** Optional secondary actions (defer, escalate, view details). */
  secondaryActions?: FocusAction[];

  /** Underlying source for invalidation when the entity changes. */
  source:
    | { kind: 'platoon-leave';  platoonId: string; dayIso: string }
    | { kind: 'mission';        id: string }
    | { kind: 'leave';          id: string }
    | { kind: 'soldier-status'; soldierId: string }
    | { kind: 'gap';            id: string }
    | { kind: 'escalation';     id: string };
}

export interface FocusAction {
  label: string;
  /** Either a route to navigate to OR a recognized command keyword. */
  href?: string;
  /** Programmatic command when the action opens a Sheet/Modal in place
   *  instead of navigating. Engine consumers route on this. */
  command?: 'define-coverage' | 'open-staffing' | 'open-replace' | 'open-recall-followup'
          | 'open-approve-leave' | 'open-resolve-gap' | 'open-close-escalation';
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  PHASE 6.0b — OFFLINE / SYNC INFRASTRUCTURE                              ║
// ║                                                                          ║
// ║  We don't build full offline NOW. We DO design every mutation, every     ║
// ║  read, and every engine function to be offline-ready from day one.       ║
// ║  This block defines the contract:                                        ║
// ║                                                                          ║
// ║    • Every mutation carries clientMutationId + clientCreatedAt           ║
// ║      → makes server idempotent + traceable across retries                ║
// ║    • A queue of pending mutations persists locally                       ║
// ║    • Conflicts are captured as first-class records, never silently       ║
// ║      overwritten                                                         ║
// ║    • The UI consumes a ConnectionState type that informs banners,        ║
// ║      "last synced" timestamps, and "stale data" warnings                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/** Every write mutation in the system carries this envelope. The server
 *  echoes `clientMutationId` so the client can mark the queue entry as
 *  synced. Re-sending the same id is a no-op (idempotency). */
export interface MutationEnvelope {
  /** UUID generated on the client BEFORE the mutation leaves the device. */
  clientMutationId: string;
  /** ISO when the mutation was authored locally (used for ordering). */
  clientCreatedAt:  string;
  /** Acting user — recorded even if the user is offline. */
  actorUserId:      string;
  /** Set by the server after persistence; absent while pending. */
  serverAcknowledgedAt?: string;
}

/** Per-mutation status in the local queue. */
export type MutationStatus =
  | 'pending'    // queued locally, not yet sent
  | 'syncing'    // in flight to server
  | 'synced'     // server acknowledged, can be GC'd
  | 'failed'     // server rejected (RLS, validation) — user must resolve
  | 'conflict';  // server has a newer version of the same entity

/** Generic queue entry — `payload` carries the actual mutation body
 *  shaped per `kind`. The application-layer dispatcher routes by kind. */
export interface MutationQueueEntry {
  envelope: MutationEnvelope;
  kind: MutationKind;
  /** The mutation body — exact shape varies by kind. Engine and sync
   *  layers MUST validate before applying. */
  payload: unknown;
  status: MutationStatus;
  /** Last error message when status === 'failed'. */
  lastError?: string;
  /** Retry counter — caps at some sane limit. */
  attempts: number;
}

/** All mutation kinds in the system. New writes MUST register here so
 *  the offline queue knows how to route them. */
export type MutationKind =
  | 'status-update'
  | 'leave-request-submit'
  | 'leave-request-review'
  | 'mission-create'
  | 'mission-update'
  | 'mission-set-status'
  | 'announcement-create'
  | 'announcement-close'
  | 'announcement-delete'
  | 'equipment-sign-out'
  | 'equipment-return'
  | 'equipment-damage'
  | 'gap-report'
  | 'gap-status-update'
  | 'alert-acknowledge'
  | 'alert-resolve'
  | 'checklist-run-create'
  | 'checklist-instance-update'
  | 'checklist-run-complete'
  | 'logistics-rotation-create'
  | 'logistics-rotation-set-status'
  | 'replacement-create';

/** When local and server diverge on the same entity, we capture the
 *  conflict explicitly instead of silently overwriting. The UI surfaces
 *  the conflict so the operator chooses a resolution. */
export interface ConflictRecord {
  id: string;
  /** Which entity the conflict is about. */
  entity: { kind: string; id: string };
  /** Local version (what the user did offline). */
  localVersion: {
    actorUserId: string;
    occurredAt: string;
    snapshot: unknown;
  };
  /** Server version (what was already there when we synced). */
  serverVersion: {
    actorUserId: string;
    occurredAt: string;
    snapshot: unknown;
  };
  detectedAt: string;
  /** How the user chose to resolve. `null` = not yet resolved. */
  resolution: 'use-local' | 'use-server' | 'merge' | 'dismiss' | null;
  resolvedAt?: string;
  resolvedByUserId?: string;
}

/** Connection state for UI consumption. */
export type ConnectionState =
  | 'online'       // green dot, fresh data
  | 'syncing'      // amber, pending mutations in flight
  | 'offline'      // red, mutations queued locally
  | 'stale';       // amber, online but last sync > N minutes ago

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  HUMAN PRIORITY PINNING (future-ready, scaffold only)                    ║
// ║                                                                          ║
// ║  A PC/CC marks a soldier as "high priority for this mission/slot" —     ║
// ║  the engine applies a SOFT bonus to their score (does not break          ║
// ║  hard filters). Pins are time-bounded; expired pins are ignored.        ║
// ║                                                                          ║
// ║  Phase 6.2.a-refine-2: type + scoring integration only. UI lands         ║
// ║  in Phase 6.3+.                                                          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export type SoldierPriorityPinScope =
  | { kind: 'mission'; missionId: string }
  | { kind: 'slot';    slotId: string }
  | { kind: 'global' };

export type SoldierPriorityPinReason =
  | 'training-opportunity'
  | 'continuity-with-team'
  | 'recovery-debt'
  | 'commander-judgment'
  | 'specific-qualification';

export interface SoldierPriorityPin {
  id: string;
  companyId: string;
  soldierId: string;
  scope: SoldierPriorityPinScope;
  reason: SoldierPriorityPinReason;
  /** Free-text rationale shown alongside the candidate's score breakdown. */
  note?: string;
  /** PC/CC who pinned. */
  pinnedByUserId: string;
  pinnedByName: string;
  /** Time-bounded. After this, the pin is ignored. */
  expiresAt?: string;
  createdAt: string;
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  EXPLAINABILITY HISTORY (future-ready, scaffold only)                    ║
// ║                                                                          ║
// ║  Every time the engine produces a SelectorOutcome (whether the operator ║
// ║  accepted it or overrode), a snapshot is persisted. This enables:       ║
// ║    • "why did the engine choose X for that slot 3 weeks ago?"           ║
// ║    • detection of repeated wrong picks → tuning signal                   ║
// ║    • compliance audit — "the engine was consulted before X was forced"   ║
// ║                                                                          ║
// ║  Phase 6.2.a-refine-2: type only. Persistence lands in Phase 6.2.b      ║
// ║  alongside assignment writes.                                            ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export interface SelectorOutcomeRecord {
  id: string;
  companyId: string;
  slotId: string;
  missionId: string;
  /** Snapshot of the outcome at decision time. */
  outcome: SelectorOutcome;
  /** Final picks the operator actually committed (may differ from
   *  outcome.picked if they overrode). */
  finalSoldierIds: string[];
  /** Who made the final call. */
  actorUserId: string;
  actorRole: UserRole;
  /** ISO timestamp the decision was made. */
  decidedAt: string;
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  HUMAN OVERRIDE TELEMETRY                                                ║
// ║                                                                          ║
// ║  When a PC/CC rejects the engine's pick and chooses someone else, we    ║
// ║  capture that decision. Not for AI today — for pattern analysis later.  ║
// ║  If 70% of PCs always replace soldier X with Y, the engine's scoring    ║
// ║  for that combination is probably wrong.                                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export interface EngineOverride {
  id: string;
  companyId: string;
  /** Slot the override applied to. */
  slotId: string;
  /** Soldier the engine recommended. */
  engineRecommendedSoldierId: string;
  /** Engine's confidence in its recommendation (from SelectorOutcome). */
  engineConfidence: number;
  /** Soldier the operator chose instead. May be undefined if they
   *  left the slot open after rejecting the recommendation. */
  operatorChoseSoldierId?: string;
  /** Free-text rationale — optional in v1, may become required later. */
  rationale?: string;
  /** Standard reason taxonomy — surfaces patterns. Optional. */
  rationaleCode?:
    | 'soldier-needs-rest'
    | 'wrong-fit-for-task'
    | 'training-opportunity'
    | 'personal-circumstances'
    | 'better-cohesion'
    | 'commander-judgment';
  actorUserId: string;
  actorRole: UserRole;
  occurredAt: string;
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  OPERATIONAL MODE                                                        ║
// ║                                                                          ║
// ║  Concept stub — built later. The mode modulates fatigue thresholds,     ║
// ║  fairness weights, and alert severities. Stored on Company so the       ║
// ║  whole org runs in the same mode at a given moment.                      ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export type OperationalMode = 'normal' | 'elevated' | 'emergency';

/** Per-mode modulator that the engine consults when resolving fatigue,
 *  fairness penalties, and alert thresholds. Values are MULTIPLIERS on
 *  the defaults. Default behavior in 'normal' is 1.0 across the board. */
export interface OperationalModeProfile {
  mode: OperationalMode;
  /** Fatigue min-rest hours multiplier. emergency=0.5 means soldiers can
   *  legitimately be assigned with half the usual rest gap. */
  fatigueRestMultiplier: number;
  /** Burden penalty multiplier. emergency=0.3 reduces fairness weight. */
  burdenPenaltyMultiplier: number;
  /** Alert severity escalation. emergency may upgrade warning→critical. */
  severityEscalation: 'none' | 'warning-to-critical' | 'all-up-one';
}

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  ENGINE CONTEXT — pure-function input                                    ║
// ║                                                                          ║
// ║  Every engine function (hardFilters, scoring, selector, burden, focus)   ║
// ║  takes an EngineContext snapshot. Functions are deterministic on the     ║
// ║  same context — no DB, no React, no AppContext, no clock. The clock     ║
// ║  is passed in as `computedAt`. The context can be:                       ║
// ║                                                                          ║
// ║    • built from React state for live computation                         ║
// ║    • built from a persisted snapshot for replay/audit                    ║
// ║    • built from server-side state for server-side runs                   ║
// ║    • built from local cache when offline                                 ║
// ║                                                                          ║
// ║  This is the key separation that makes the engine portable.              ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export interface EngineContext {
  /** ISO timestamp of "now" for this evaluation. PASSED IN, never read
   *  from Date.now() inside the engine. Allows replay/test. */
  computedAt: string;

  /** Company-level mode that modulates engine behavior. */
  modeProfile: OperationalModeProfile;

  // ── Entity snapshots — engine reads ONLY from these ───────────
  soldiers:           Soldier[];
  platoons:           Platoon[];
  squads:             Squad[];
  missions:           Mission[];
  leaves:             Leave[];
  dutyExclusions:     DutyExclusion[];
  statusEvents:       SoldierStatusEvent[];
  signedEquipment:    SignedEquipment[];
  qualifications:     SoldierQualification[];
  logisticsRotations: LogisticsRotation[];

  // ── Resolved policy (engine doesn't traverse hierarchy itself) ─
  fatiguePolicy:  FatiguePolicy;
  burdenWeights:  BurdenWeights;

  // ── Pre-computed burden per soldier — avoids re-computing each call ─
  /** Map soldierId → SoldierBurden snapshot. The caller computes this
   *  once per scheduling session and passes it in. */
  burdens: Record<string, SoldierBurden>;

  // ── State for the specific slot being evaluated (set per call) ─
  /** Soldiers already picked for the slot in this scheduling pass.
   *  Affects cohesion + duplicate-pick prevention. */
  alreadyPickedForSlot?: string[];

  /** Active priority pins applicable to the current evaluation. The
   *  engine applies a +15 SOFT bonus to a candidate's score when the
   *  pin's scope matches. Never breaks hard filters. */
  priorityPins?: SoldierPriorityPin[];
}

