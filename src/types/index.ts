// Command-chain roles. Legacy 'owner'/'manager' kept for compat; new code
// should prefer the explicit company/platoon/squad roles.
export type UserRole =
  | 'companyCommander'   // מ״פ / סמ״פ — owns the company
  | 'platoonCommander'   // מ״מ — runs one platoon
  | 'platoonSergeant'    // סמל — runs one platoon (peer of platoonCommander)
  | 'squadCommander'     // מ״כ — runs one squad/class within a platoon
  | 'soldier'            // regular soldier
  | 'owner'              // [legacy] ≈ companyCommander
  | 'manager';           // [legacy] ≈ platoonCommander

export type OperationalRole =
  | 'מ״פ' | 'סמ״פ' | 'מ״מ' | 'קשר מ״מ' | 'סמל'
  | 'חובש' | 'נגביסט' | 'קלע' | 'מאגיסט' | 'רחפן';

export type TeamClass = 'כיתה 1' | 'כיתה 2' | 'כיתה 3' | 'מפקדה' | 'אחר';

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
  operationalRoles: OperationalRole[];
  teamClass: TeamClass;
  availability: boolean;   // manager-controlled toggle
  availabilityNotes: AvailabilityNote[];
  currentLoad: number;
  phone?: string;
  userId?: string;
}

// ─── Leaves / יציאות ─────────────────────────────────────────────────────────

export type LeaveScope = 'individual' | 'class' | 'machlaka';

export interface Leave {
  id: string;
  scope: LeaveScope;
  soldierIds: string[];
  teamClass?: TeamClass;
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
  soldierTeamClass: TeamClass;
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
  classMixing: ClassMixingPolicy;
  allowedClasses?: TeamClass[];        // when classMixing === 'specific'

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

export interface ManagerNote {
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
  managerNotes: ManagerNote[];
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
  managerOnly: boolean;     // if true, hidden from soldier views
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

// ─── Groups / מחלקה (platoon — child of Company) ─────────────────────────────

export interface Group {
  id: string;
  name: string;
  unitName?: string;
  code: string;
  ownerId: string;
  memberIds: string[];
  platoonCommander?: string;
  platoonSergeant?: string;
  scheduleManagers?: string[];
  availableRoles: string[];
  size?: number;
  enemyConfusion?: boolean;
  confusionMinutes?: number;

  // Company hierarchy (added in refactor)
  companyId?: string;                       // parent company
  platoonCommanderUserId?: string;          // user id of מ״מ
  platoonSergeantUserId?: string;           // user id of סמל
  squadCommanderUserIds?: Partial<Record<TeamClass, string>>;  // class → user id of מ״כ
  isSpecialPlatoon?: boolean;               // different mission rules
  followsCompanyLeaveRotation?: boolean;    // default: true
  minSoldiersOnBase?: number;               // platoon-level override
}

// ─── Miluim period (the overall reserve duty window) ─────────────────────────

export interface MiluimPeriod {
  id: string;
  groupId: string;
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

// Authentication is mocked in this MVP and must be replaced with
// Firebase Auth or another secure auth provider before production.
export interface MockUser {
  id: string;
  name: string;
  role: UserRole;
  phone: string;
  email: string;
  username: string;
  password: string;
  joinedGroupIds: string[];
  operationalRoles: OperationalRole[];
  teamClass: TeamClass;
  soldierProfileId?: string;          // links to Soldier record

  // Company-hierarchy scope (added in refactor)
  companyId?: string;                 // company this user belongs to
  commandedPlatoonId?: string;        // when role = platoonCommander / platoonSergeant
  commandedSquadClass?: TeamClass;    // when role = squadCommander
}
