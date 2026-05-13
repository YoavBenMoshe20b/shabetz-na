import type {
  Soldier, SchedulePeriod, AuditLog, MockUser, Platoon, Leave, LeaveRequest,
  EquipmentRequirements, SoldierHistory, MiluimPeriod, Company, Squad,
  CompanyMission, OverrideAlert,
  SoldierStatusEvent, Delegation,
  CalendarEvent,
  Mission, Qualification, EquipmentItem, SoldierQualification,
  LeaveRotationPolicy, LeaveBlock,
  CoverageEvent, DutyExclusion, LeaveRotationPlan,
  SignedEquipment,
  CommandDelegation, EquipmentGap,
} from '../types';

const noEquip: EquipmentRequirements = {
  fullUniform: false, kneePads: false, boots: false,
  vest: false, helmet: false, weapon: false,
};
const fullEquip: EquipmentRequirements = {
  fullUniform: true, kneePads: true, boots: true,
  vest: true, helmet: true, weapon: true,
};
const watchEquip: EquipmentRequirements = {
  fullUniform: false, kneePads: false, boots: true,
  vest: true, helmet: false, weapon: true,
};

// Authentication is mocked in this MVP and must be replaced with
// Firebase Auth or another secure auth provider before production.
// ─── Pre-claim roster (operational identities created BEFORE soldiers enter) ──
//
// Every Soldier here was put on file by command. Their phone + idLast4 are
// the claim credentials that command distributes out-of-band. status='active'
// means the slot represents the soldier's current operational assignment.
// status='inactive' records are historical (transfers / discharges / revokes)
// and MUST NOT appear in operational queries — only audit/security flows
// may read them.

// Recent timestamps to drive "מאז" / "since" displays naturally.
const YESTERDAY_AM = '2024-05-11T07:00:00';
const TWO_DAYS_AGO = '2024-05-10T14:00:00';

export const mockSoldiers: Soldier[] = [
  // ── מחלקה א׳ ─────────────────────────────────────────────────────────
  // currentStatus drives every operational view. statusSetAt is the
  // canonical "since" timestamp; statusExpectedUntil is set when going
  // home so the system knows when they should be back.
  { id: 's1',  name: 'משה ישראלי',  phone: '0509876543', idLast4: '1111', companyId: 'co1', status: 'active', claimedAt: '2024-05-08T09:00:00', userId: 'u3', operationalRoles: ['קלע', 'חובש'],    teamClass: 'כיתה 1', squadId: 'su-g1-a',  currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true,  availabilityNotes: [], currentLoad: 2,
    dateOfBirth: '1998-03-14', dominantHand: 'right', weaponSide: 'right', shirtSize: 'L', pantsSize: '34', shoeSize: '43' },
  { id: 's2',  name: 'רוני שמש',    phone: '0502222111', idLast4: '2222', companyId: 'co1', status: 'active', operationalRoles: ['מ״מ', 'קשר מ״מ'], teamClass: 'כיתה 1', squadId: 'su-g1-a',  currentStatus: 'home',    statusSetAt: '2024-05-12T00:00:00', statusExpectedUntil: '2024-05-14T22:00:00', availability: true,  availabilityNotes: [{ type: 'leave', description: 'חופשה', startDate: '2024-05-20', endDate: '2024-05-21' }], currentLoad: 1 },
  { id: 's3',  name: 'אורן פרץ',    phone: '0503333222', idLast4: '3333', companyId: 'co1', status: 'active', operationalRoles: ['נגביסט'],          teamClass: 'כיתה 2', squadId: 'su-g1-b',  currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true,  availabilityNotes: [], currentLoad: 3 },
  { id: 's4',  name: 'נועם כץ',     phone: '0504444333', idLast4: '4444', companyId: 'co1', status: 'active', operationalRoles: ['קשר מ״מ'],         teamClass: 'כיתה 2', squadId: 'su-g1-b',  currentStatus: 'inactive-temp', statusSetAt: YESTERDAY_AM, availability: false, availabilityNotes: [{ type: 'other', description: 'לא זמין לשיבוץ' }], currentLoad: 0 },
  { id: 's5',  name: 'איתי בן דוד', phone: '0505555444', idLast4: '5555', companyId: 'co1', status: 'active', operationalRoles: ['סמ״פ', 'רחפן'],   teamClass: 'מפקדה',  squadId: 'su-g1-hq', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true,  availabilityNotes: [], currentLoad: 1 },
  { id: 's6',  name: 'גל מזרחי',    phone: '0506666555', idLast4: '6666', companyId: 'co1', status: 'active', operationalRoles: ['מאגיסט', 'סמל'],  teamClass: 'כיתה 2', squadId: 'su-g1-b',  currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true,  availabilityNotes: [], currentLoad: 2 },
  { id: 's7',  name: 'שי אברהם',    phone: '0507777666', idLast4: '7777', companyId: 'co1', status: 'active', operationalRoles: ['רחפן', 'קלע'],    teamClass: 'כיתה 3', squadId: 'su-g1-c',  currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true,  availabilityNotes: [], currentLoad: 1 },
  // s8: UNCLAIMED slot
  { id: 's8',  name: 'יניב שלום',   phone: '0508888777', idLast4: '8888', companyId: 'co1', status: 'active', operationalRoles: ['קלע'],             teamClass: 'כיתה 3', squadId: 'su-g1-c',  currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true,  availabilityNotes: [{ type: 'location', description: 'לא נמצא בבסיס', startDate: '2024-05-12', endDate: '2024-05-13' }], currentLoad: 0 },
  { id: 's9',  name: 'ניסים דהן',   phone: '0509999888', idLast4: '9999', companyId: 'co1', status: 'active', operationalRoles: ['חובש', 'סמל'],    teamClass: 'כיתה 1', squadId: 'su-g1-a',  currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true,  availabilityNotes: [], currentLoad: 2, dateOfBirth: (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 26); return d.toISOString().slice(0, 10); })() },
  { id: 's10', name: 'אלון ברק',    phone: '0501010101', idLast4: '1010', companyId: 'co1', status: 'active', operationalRoles: ['מ״מ', 'מאגיסט'],  teamClass: 'כיתה 3', squadId: 'su-g1-c',  currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true,  availabilityNotes: [], currentLoad: 1 },

  // ── HISTORICAL — invisible to operational selectors ──
  { id: 's11', name: 'יוסי כהן',   phone: '0501234567', idLast4: '0001', companyId: 'co2',
    status: 'inactive', deactivatedAt: '2024-04-15T10:00:00', deactivatedReason: 'transferred',
    claimedAt: '2023-09-01T08:00:00', userId: 'u1',
    operationalRoles: ['קלע'], teamClass: 'כיתה 1',
    currentStatus: 'inactive-temp', statusSetAt: '2024-04-15T10:00:00',
    availability: false, availabilityNotes: [], currentLoad: 0 },
];

// Append-only operational state log. Empty for now — populated as
// soldiers/commanders trigger status changes. Phase B+ flows (escalation
// reports etc.) will append entries with escalationId set.
export const mockSoldierStatusEvents: SoldierStatusEvent[] = [];

// Permission delegations granted by the CC. Empty default — every role
// uses its built-in token bundle. The CC's delegation grant UI lands
// in phase D; for now this list just provides architectural readiness.
export const mockDelegations: Delegation[] = [];

// ─── Claimed identities (the auth layer bound to active Soldier records) ─────

export const mockUsers: MockUser[] = [
  {
    // BOOTSTRAP CC — registered before any roster existed
    id: 'u1', name: 'יוסי כהן', role: 'companyCommander',
    phone: '0501234567', idLast4: '0001', password: 'Test@1234',
    operationalRoles: ['מ״פ'], teamClass: 'מפקדה',
    companyId: 'co1',
    createdAt: '2024-04-20T08:00:00',
  },
  {
    // Claimed PC slot in co1
    id: 'u2', name: 'דוד לוי', role: 'platoonCommander',
    phone: '0507654321', idLast4: '2468', password: 'Test@1234',
    platoonId: 'g1', commandedPlatoonId: 'g1', companyId: 'co1',
    operationalRoles: ['מ״מ'], teamClass: 'מפקדה',
    createdAt: '2024-04-21T09:00:00',
  },
  {
    // Claimed soldier slot s1
    id: 'u3', name: 'משה ישראלי', role: 'soldier',
    phone: '0509876543', idLast4: '1111', password: 'Test@1234',
    platoonId: 'g1', companyId: 'co1', squadId: 'su-g1-a',
    soldierProfileId: 's1',
    operationalRoles: ['קלע', 'חובש'], teamClass: 'כיתה 1',
    createdAt: '2024-05-08T09:00:00',
  },
  {
    // Claimed PS slot in co1
    id: 'u5', name: 'אלון בן-שמעון', role: 'platoonSergeant',
    phone: '0508889999', idLast4: '1357', password: 'Test@1234',
    platoonId: 'g1', commandedPlatoonId: 'g1', companyId: 'co1',
    operationalRoles: ['סמל'], teamClass: 'מפקדה',
    createdAt: '2024-04-21T09:30:00',
  },
];

// ─── Leaves ──────────────────────────────────────────────────────────────────

export const mockLeaves: Leave[] = [
  {
    id: 'lv1', scope: 'squad', teamClass: 'כיתה 2', squadId: 'su-g1-b',
    soldierIds: [],
    startDate: '2024-05-16', startTime: '14:00',
    endDate:   '2024-05-18', endTime:   '08:00',
    note: 'יציאת סוף שבוע — כיתה 2',
    createdBy: 'u1', createdByName: 'יוסי כהן',
  },
  {
    id: 'lv2', scope: 'individual',
    soldierIds: ['s2'],
    startDate: '2024-05-20', startTime: '00:00',
    endDate:   '2024-05-21', endTime:   '23:59',
    note: 'חופשה אישית — רוני שמש',
    createdBy: 'u2', createdByName: 'דוד לוי',
  },
  {
    id: 'lv3', scope: 'individual',
    soldierIds: ['s4'],
    startDate: '2024-05-12', startTime: '00:00',
    endDate:   '2024-05-25', endTime:   '23:59',
    note: 'לא זמין לשיבוץ',
    createdBy: 'u1', createdByName: 'יוסי כהן',
  },
  {
    id: 'lv4', scope: 'machlaka',
    soldierIds: [],
    startDate: '2024-08-15', startTime: '14:00',
    endDate:   '2024-08-17', endTime:   '18:00',
    note: 'יציאה כלל-מחלקתית — שבוע יציאה',
    createdBy: 'u1', createdByName: 'יוסי כהן',
  },
];

// ─── Leave Requests ───────────────────────────────────────────────────────────

export const mockLeaveRequests: LeaveRequest[] = [
  {
    id: 'lr1',
    soldierId: 's1', soldierName: 'משה ישראלי',
    soldierTeamClass: 'כיתה 1', soldierSquadId: 'su-g1-a', soldierSquadName: 'כיתה 1',
    startDate: '2024-05-22', startTime: '14:00',
    endDate:   '2024-05-24', endTime:   '08:00',
    reason: 'אירוע משפחתי',
    status: 'pending',
    submittedAt: '2024-05-14T10:00:00',
  },
  {
    id: 'lr2',
    soldierId: 's3', soldierName: 'אורן פרץ',
    soldierTeamClass: 'כיתה 2', soldierSquadId: 'su-g1-b', soldierSquadName: 'כיתה 2',
    startDate: '2024-05-19', startTime: '08:00',
    endDate:   '2024-05-19', endTime:   '18:00',
    reason: 'פגישה רפואית',
    status: 'approved',
    reviewedBy: 'u2', reviewedByName: 'דוד לוי', reviewedAt: '2024-05-13T14:30:00',
    submittedAt: '2024-05-13T08:00:00',
  },
  {
    id: 'lr3',
    soldierId: 's7', soldierName: 'שי אברהם',
    soldierTeamClass: 'כיתה 3', soldierSquadId: 'su-g1-c', soldierSquadName: 'כיתה 3',
    startDate: '2024-05-17', startTime: '14:00',
    endDate:   '2024-05-18', endTime:   '20:00',
    reason: 'שיקולים אישיים',
    status: 'rejected',
    reviewedBy: 'u1', reviewedByName: 'יוסי כהן', reviewedAt: '2024-05-12T09:00:00',
    submittedAt: '2024-05-11T22:00:00',
  },
];

// ─── Schedule Periods ─────────────────────────────────────────────────────────

export const mockSchedulePeriods: SchedulePeriod[] = [
  {
    id: 'sp1',
    name: 'שבוע 12–18 במאי',
    startDate: '2024-05-12',
    endDate:   '2024-05-18',
    status: 'published',
    commanderNotes: [
      { id: 'mn1', authorId: 'u1', authorName: 'יוסי כהן', text: 'אלון רק בחמ״ל עם ניסים', timestamp: '2024-05-11T09:00:00' },
      { id: 'mn2', authorId: 'u2', authorName: 'דוד לוי',  text: 'רחפן רק במשימות סיור — לא בשמירות', timestamp: '2024-05-11T10:00:00' },
      { id: 'mn3', authorId: 'u1', authorName: 'יוסי כהן', text: 'לא לשים את רוני עם נועם', timestamp: '2024-05-11T11:00:00' },
    ],
    missionTypes: [
      {
        id: 'mt1', name: 'שמירת שער צפון', category: 'שמירה',
        minSoldiers: 1, recommendedSoldiers: 2, maxSoldiers: 2,
        requiredRoles: ['קלע'], needsCommander: false, needsMedic: false,
        minShiftMinutes: 120, maxShiftMinutes: 360,
        activeStartTime: '00:00', activeEndTime: '24:00',
        shiftDurationHours: 4, recurring: true,
        conflictsWith: ['mt5'],
        canOverlapWith: ['mt4'],
        soldierMixing: 'mix', classMixing: 'mix',
        hasEquipment: true, equipmentRequired: watchEquip,
        enableCadar: true, enableConfusion: false, confusionDeviationMinutes: 0,
        pairings: [],
        timeSlots: [
          { id: 'ts1', date: '2024-05-12', startTime: '00:00', endTime: '04:00', assignedSoldierIds: ['s9', 's8'], requiredRoles: ['קלע'], status: 'filled' },
          { id: 'ts2', date: '2024-05-12', startTime: '04:00', endTime: '08:00', assignedSoldierIds: ['s3', 's7'], requiredRoles: ['קלע'], status: 'filled' },
          { id: 'ts3', date: '2024-05-12', startTime: '08:00', endTime: '12:00', assignedSoldierIds: ['s6'],       requiredRoles: ['קלע'], status: 'conflict' },
          { id: 'ts4', date: '2024-05-12', startTime: '12:00', endTime: '16:00', assignedSoldierIds: ['s1', 's9'], requiredRoles: ['קלע'], status: 'filled' },
          { id: 'ts5', date: '2024-05-12', startTime: '16:00', endTime: '20:00', assignedSoldierIds: ['s3', 's10'],requiredRoles: ['קלע'], status: 'filled' },
          { id: 'ts6', date: '2024-05-12', startTime: '20:00', endTime: '00:00', assignedSoldierIds: ['s7', 's8'], requiredRoles: ['קלע'], status: 'filled' },
        ],
      },
      {
        id: 'mt2', name: 'חמ״ל', category: 'חמ״ל',
        minSoldiers: 2, recommendedSoldiers: 3, maxSoldiers: 4,
        requiredRoles: ['מאגיסט', 'קשר מ״מ'], needsCommander: true, needsMedic: false,
        minShiftMinutes: 240, maxShiftMinutes: 480,
        activeStartTime: '08:00', activeEndTime: '20:00',
        shiftDurationHours: 8, recurring: true,
        conflictsWith: [],
        canOverlapWith: ['mt1', 'mt3', 'mt4'],
        soldierMixing: 'mix', classMixing: 'mix',
        hasEquipment: false, equipmentRequired: noEquip,
        enableCadar: false, enableConfusion: false, confusionDeviationMinutes: 0,
        pairings: [],
        timeSlots: [
          { id: 'ts7', date: '2024-05-12', startTime: '08:00', endTime: '16:00', assignedSoldierIds: ['s5', 's6', 's10'], requiredRoles: ['מאגיסט', 'קשר מ״מ'], status: 'filled' },
          { id: 'ts8', date: '2024-05-12', startTime: '16:00', endTime: '00:00', assignedSoldierIds: ['s2', 's4'],        requiredRoles: ['מאגיסט', 'קשר מ״מ'], status: 'conflict' },
          { id: 'ts9', date: '2024-05-13', startTime: '08:00', endTime: '16:00', assignedSoldierIds: ['s10', 's9'],       requiredRoles: ['מאגיסט', 'קשר מ״מ'], status: 'filled' },
        ],
      },
      {
        id: 'mt3', name: 'מטבח', category: 'מטבח',
        minSoldiers: 2, recommendedSoldiers: 3, maxSoldiers: 4,
        requiredRoles: [], needsCommander: false, needsMedic: false,
        minShiftMinutes: 240, maxShiftMinutes: 480,
        activeStartTime: '06:00', activeEndTime: '14:00',
        shiftDurationHours: 8, recurring: true,
        conflictsWith: ['mt1', 'mt4', 'mt5'],
        canOverlapWith: ['mt2'],
        soldierMixing: 'mix', classMixing: 'no-mix',
        hasEquipment: false, equipmentRequired: noEquip,
        enableCadar: false, enableConfusion: false, confusionDeviationMinutes: 0,
        pairings: [],
        timeSlots: [
          { id: 'ts10', date: '2024-05-12', startTime: '06:00', endTime: '14:00', assignedSoldierIds: ['s8', 's3'], requiredRoles: [], status: 'filled' },
          { id: 'ts11', date: '2024-05-13', startTime: '06:00', endTime: '14:00', assignedSoldierIds: ['s1', 's7'], requiredRoles: [], status: 'filled' },
        ],
      },
      {
        id: 'mt4', name: 'כוננות', category: 'כוננות',
        minSoldiers: 2, recommendedSoldiers: 2, maxSoldiers: 3,
        requiredRoles: ['חובש'], needsCommander: false, needsMedic: true,
        minShiftMinutes: 360, maxShiftMinutes: 1440,
        activeStartTime: '00:00', activeEndTime: '24:00',
        shiftDurationHours: 24, recurring: false,
        conflictsWith: ['mt5'],
        canOverlapWith: ['mt1', 'mt2'],
        soldierMixing: 'dedicated', classMixing: 'mix',
        hasEquipment: true, equipmentRequired: fullEquip,
        enableCadar: false, enableConfusion: false, confusionDeviationMinutes: 0,
        pairings: [],
        timeSlots: [
          { id: 'ts12', date: '2024-05-12', startTime: '00:00', endTime: '24:00', assignedSoldierIds: ['s1', 's9'], requiredRoles: ['חובש'], status: 'filled' },
        ],
      },
      {
        id: 'mt5', name: 'סיור לילי', category: 'סיור',
        minSoldiers: 4, recommendedSoldiers: 5, maxSoldiers: 6,
        requiredRoles: ['מ״מ', 'רחפן', 'חובש'], needsCommander: true, needsMedic: true,
        minShiftMinutes: 240, maxShiftMinutes: 480,
        activeStartTime: '22:00', activeEndTime: '04:00',
        shiftDurationHours: 6, recurring: false,
        conflictsWith: ['mt1', 'mt3', 'mt4'],
        canOverlapWith: [],
        soldierMixing: 'dedicated', classMixing: 'mix',
        hasEquipment: true, equipmentRequired: fullEquip,
        enableCadar: false, enableConfusion: true, confusionDeviationMinutes: 15,
        pairings: [],
        timeSlots: [
          { id: 'ts13', date: '2024-05-12', startTime: '22:00', endTime: '04:00', assignedSoldierIds: ['s2', 's5', 's7', 's9', 's10'], requiredRoles: ['מ״מ', 'רחפן', 'חובש'], status: 'filled' },
          { id: 'ts14', date: '2024-05-14', startTime: '22:00', endTime: '04:00', assignedSoldierIds: ['s5', 's7'],                     requiredRoles: ['מ״מ', 'רחפן', 'חובש'], status: 'conflict' },
        ],
      },
    ],
  },
  {
    id: 'sp2',
    name: 'שבוע 19–25 במאי',
    startDate: '2024-05-19',
    endDate:   '2024-05-25',
    status: 'draft',
    commanderNotes: [],
    missionTypes: [
      {
        id: 'mt6', name: 'שמירת שער מזרח', category: 'שמירה',
        minSoldiers: 1, recommendedSoldiers: 2, maxSoldiers: 2,
        requiredRoles: ['קלע'], needsCommander: false, needsMedic: false,
        minShiftMinutes: 120, maxShiftMinutes: 360,
        activeStartTime: '00:00', activeEndTime: '24:00',
        shiftDurationHours: 4, recurring: true,
        conflictsWith: [],
        canOverlapWith: [],
        soldierMixing: 'mix', classMixing: 'mix',
        hasEquipment: true, equipmentRequired: watchEquip,
        enableCadar: true, enableConfusion: false, confusionDeviationMinutes: 0,
        pairings: [],
        timeSlots: [
          { id: 'ts15', date: '2024-05-19', startTime: '00:00', endTime: '04:00', assignedSoldierIds: [], requiredRoles: ['קלע'], status: 'open' },
          { id: 'ts16', date: '2024-05-19', startTime: '04:00', endTime: '08:00', assignedSoldierIds: [], requiredRoles: ['קלע'], status: 'open' },
        ],
      },
    ],
  },
];

// ─── Groups / מחלקות ──────────────────────────────────────────────────────────

export const mockPlatoons: Platoon[] = [
  {
    id: 'g1', name: 'מחלקה א׳', unitName: 'גדוד 51', code: 'UNIT-4821',
    memberIds: ['u2', 'u3', 'u5'],
    platoonCommander: 'דוד לוי', platoonSergeant: 'אלון בן-שמעון',
    scheduleManagers: ['u1', 'u2', 'u5'],
    availableRoles: ['קלע', 'חובש', 'נגביסט', 'מאגיסט', 'קשר מ״מ', 'רחפן', 'מ״מ', 'סמל'],
    size: 10,
    enemyConfusion: false,
    confusionMinutes: 0,
    companyId: 'co1',
    platoonCommanderUserId: 'u2',
    platoonSergeantUserId: 'u5',
    squadIds: ['su-g1-a', 'su-g1-b', 'su-g1-c', 'su-g1-hq'],
    kind: 'combat',
    followsCompanyLeaveRotation: true,
  },
  {
    id: 'g2', name: 'כיתת סיור', unitName: 'גדוד 51', code: 'UNIT-9934',
    memberIds: [],
    availableRoles: ['קלע', 'חובש', 'מ״מ'],
    size: 8,
    companyId: 'co1',
    squadIds: ['su-g2-spr', 'su-g2-msh', 'su-g2-tek'],
    kind: 'forward-command',
    followsCompanyLeaveRotation: false,
    minSoldiersOnBase: 4,
  },
];

// ─── SubUnits / תת-קבוצות ────────────────────────────────────────────────────
//
// Sub-unit names are defined per-platoon by the company commander, so two
// platoons in the same company can have different sub-unit structures
// (regular platoon: כיתות; special platoon: בעלי תפקיד).

export const mockSquads: Squad[] = [
  // מחלקה א׳ (g1) — standard squad layout
  { id: 'su-g1-a',   platoonId: 'g1', name: 'כיתה 1',  soldierIds: ['s1', 's2', 's9'] },
  { id: 'su-g1-b',   platoonId: 'g1', name: 'כיתה 2',  soldierIds: ['s3', 's4', 's6'] },
  { id: 'su-g1-c',   platoonId: 'g1', name: 'כיתה 3',  soldierIds: ['s7', 's8', 's10'] },
  { id: 'su-g1-hq',  platoonId: 'g1', name: 'מפקדה',   soldierIds: ['s5'] },

  // כיתת סיור (g2) — special platoon, distinct sub-unit structure
  { id: 'su-g2-spr', platoonId: 'g2', name: 'ספרפס',         soldierIds: [] },
  { id: 'su-g2-msh', platoonId: 'g2', name: 'משקשק',         soldierIds: [] },
  { id: 'su-g2-tek', platoonId: 'g2', name: 'חוליה טכנית',  soldierIds: [] },
];

// ─── Companies / פלוגות ──────────────────────────────────────────────────────

export const mockCompanies: Company[] = [
  {
    id: 'co1',
    name: 'פלוגה ב',
    unitName: 'גדוד 51',
    commanderUserId: 'u1',
    deputyCommanderUserId: undefined,
    platoonIds: ['g1', 'g2'],
    inviteCode: 'CO-5108',
    createdAt: '2024-04-20T08:00:00',
    settings: {
      rotationStrategy: 'platoon-based',
      minSoldiersOnBase: 18,
      specialPlatoonsFollowLeaveRotation: false,
      companyHomePeriods: [
        { id: 'chp1', startDate: '2024-07-04', endDate: '2024-07-07', description: 'יציאה כלל-פלוגתית — 4 ביולי' },
      ],
    },
  },
  {
    // Stub — exists only so the inactive Soldier record s11 has a valid
    // companyId to point at. No platoons, no operational data. Audit-only.
    id: 'co2',
    name: 'פלוגה א — הסתיים',
    unitName: 'גדוד 51',
    commanderUserId: '',
    platoonIds: [],
    inviteCode: 'CO-2019',
    createdAt: '2023-09-01T08:00:00',
    settings: {
      rotationStrategy: 'platoon-based',
      minSoldiersOnBase: 0,
      specialPlatoonsFollowLeaveRotation: false,
      companyHomePeriods: [],
    },
  },
];

// ─── Miluim Period ────────────────────────────────────────────────────────────

export const mockMiluimPeriods: MiluimPeriod[] = [
  { id: 'mp1', companyId: 'co1', startDate: '2024-05-05', endDate: '2024-08-22', description: 'מילואים קיץ 2024 — גדוד 51' },
];

// ─── Soldier History ──────────────────────────────────────────────────────────

export const mockSoldierHistory: SoldierHistory[] = [
  { soldierId: 's1',  totalAssignedHours: 64, totalGuardHours: 32, totalKitchenHours: 16, totalStandbyHours: 12, totalNightShifts: 4, totalDifficultShifts: 6, difficultShiftScore: 17,  homeLeaveDays: 8,  lastAssignmentDate: '2024-05-12', missionTypeCount: { 'שמירת שער צפון': 8,  'כוננות': 3, 'מטבח': 2 } },
  { soldierId: 's2',  totalAssignedHours: 50, totalGuardHours: 24, totalKitchenHours: 0,  totalStandbyHours: 8,  totalNightShifts: 2, totalDifficultShifts: 3, difficultShiftScore: 8.5, homeLeaveDays: 6,  lastAssignmentDate: '2024-05-11', missionTypeCount: { 'שמירת שער צפון': 5,  'חמ״ל': 4, 'סיור לילי': 2 } },
  { soldierId: 's3',  totalAssignedHours: 80, totalGuardHours: 40, totalKitchenHours: 24, totalStandbyHours: 8,  totalNightShifts: 6, totalDifficultShifts: 8, difficultShiftScore: 24,  homeLeaveDays: 4,  lastAssignmentDate: '2024-05-12', missionTypeCount: { 'שמירת שער צפון': 10, 'מטבח': 5 } },
  { soldierId: 's4',  totalAssignedHours: 16, totalGuardHours: 0,  totalKitchenHours: 0,  totalStandbyHours: 0,  totalNightShifts: 1, totalDifficultShifts: 1, difficultShiftScore: 3.5, homeLeaveDays: 14, lastAssignmentDate: '2024-05-08', missionTypeCount: { 'חמ״ל': 2 } },
  { soldierId: 's5',  totalAssignedHours: 48, totalGuardHours: 0,  totalKitchenHours: 0,  totalStandbyHours: 8,  totalNightShifts: 3, totalDifficultShifts: 4, difficultShiftScore: 12,  homeLeaveDays: 6,  lastAssignmentDate: '2024-05-12', missionTypeCount: { 'חמ״ל': 5, 'סיור לילי': 3, 'כוננות': 1 } },
  { soldierId: 's6',  totalAssignedHours: 56, totalGuardHours: 28, totalKitchenHours: 0,  totalStandbyHours: 0,  totalNightShifts: 3, totalDifficultShifts: 5, difficultShiftScore: 13.5,homeLeaveDays: 7,  lastAssignmentDate: '2024-05-12', missionTypeCount: { 'שמירת שער צפון': 6,  'חמ״ל': 4 } },
  { soldierId: 's7',  totalAssignedHours: 32, totalGuardHours: 16, totalKitchenHours: 0,  totalStandbyHours: 0,  totalNightShifts: 2, totalDifficultShifts: 3, difficultShiftScore: 8.5, homeLeaveDays: 9,  lastAssignmentDate: '2024-05-10', missionTypeCount: { 'שמירת שער צפון': 4,  'סיור לילי': 2 } },
  { soldierId: 's8',  totalAssignedHours: 24, totalGuardHours: 12, totalKitchenHours: 8,  totalStandbyHours: 0,  totalNightShifts: 1, totalDifficultShifts: 2, difficultShiftScore: 5,   homeLeaveDays: 11, lastAssignmentDate: '2024-05-09', missionTypeCount: { 'שמירת שער צפון': 3,  'מטבח': 2 } },
  { soldierId: 's9',  totalAssignedHours: 72, totalGuardHours: 36, totalKitchenHours: 0,  totalStandbyHours: 24, totalNightShifts: 5, totalDifficultShifts: 7, difficultShiftScore: 20.5,homeLeaveDays: 5,  lastAssignmentDate: '2024-05-12', missionTypeCount: { 'שמירת שער צפון': 9,  'כוננות': 4, 'חמ״ל': 2 } },
  { soldierId: 's10', totalAssignedHours: 40, totalGuardHours: 0,  totalKitchenHours: 0,  totalStandbyHours: 0,  totalNightShifts: 2, totalDifficultShifts: 3, difficultShiftScore: 8.5, homeLeaveDays: 8,  lastAssignmentDate: '2024-05-11', missionTypeCount: { 'חמ״ל': 5, 'שמירת שער צפון': 4 } },
];

// ─── Company-level missions ───────────────────────────────────────────────────

export const mockCompanyMissions: CompanyMission[] = [
  {
    id: 'cm1',
    companyId: 'co1',
    name: 'שמירת היקף בסיס',
    description: 'שמירה היקפית רציפה. סבב יומי בין מחלקה א׳ למחלקת סיור.',
    durationHours: 24,
    assignedPlatoonIds: ['g1', 'g2'],
    rotation: 'platoon-rotates-daily',
    requirements: [
      { id: 'rq1', kind: 'role', role: 'קלע', count: 4 },
      { id: 'rq2', kind: 'role', role: 'חובש', count: 1 },
      { id: 'rq3', kind: 'freeText', note: 'ניסיון בתצפיות לילה' },
    ],
    createdByUserId: 'u1',
    createdAt: '2024-05-01T08:00:00',
  },
  {
    id: 'cm2',
    companyId: 'co1',
    name: 'סיור גזרה',
    description: 'סיור פעיל בגזרה הצפונית, 4 שעות בכל סבב.',
    durationHours: 4,
    assignedPlatoonIds: ['g2'],
    rotation: 'fixed-platoon',
    requirements: [
      { id: 'rq4', kind: 'role', role: 'רחפן', count: 1 },
      { id: 'rq5', kind: 'role', role: 'נגביסט', count: 1 },
    ],
    createdByUserId: 'u1',
    createdAt: '2024-05-04T10:30:00',
  },
];

// ─── Operational override alerts ──────────────────────────────────────────────
// Seeded with one example so the company commander Home renders realistic
// content out-of-the-box. New alerts are appended at runtime by the
// override-detection plumbing in AppContext / SchedulePage.

export const mockOverrideAlerts: OverrideAlert[] = [
  {
    id: 'al-ov1',
    companyId: 'co1',
    platoonId: 'g1',
    kind: 'manualSlotEdit',
    description: 'דוד לוי החליף ידנית את משה ישראלי באורן פרץ במשמרת 12:00–16:00',
    actorUserId: 'u2', actorName: 'דוד לוי',
    timestamp: '2024-05-12T11:32:00',
    status: 'acknowledged',
    acknowledgedByUserId: 'u1',
    acknowledgedAt: '2024-05-12T11:45:00',
    manpowerImpact: { currentOnBase: 9, requiredMin: 8, belowMin: false },
    riskLevel: 'low',
  },
];

// ─── Audit Log ────────────────────────────────────────────────────────────────

export const mockAuditLogs: AuditLog[] = [
  { id: 'al1', actorName: 'יוסי כהן',   actorRole: 'owner',   action: 'יצר תקופת שיבוץ',  target: 'שבוע 12–18 במאי', timestamp: '2024-05-10T09:00:00' },
  { id: 'al2', actorName: 'דוד לוי',    actorRole: 'manager', action: 'הגדיר משימה',        target: 'שמירת שער צפון',  timestamp: '2024-05-10T10:15:00' },
  { id: 'al3', actorName: 'דוד לוי',    actorRole: 'manager', action: 'חישב שיבוץ',         target: 'שבוע 12–18 במאי', timestamp: '2024-05-10T11:30:00' },
  { id: 'al4', actorName: 'יוסי כהן',   actorRole: 'owner',   action: 'הגדיר יציאה',       target: 'כיתה 2 — סוף שבוע', timestamp: '2024-05-11T08:00:00' },
  { id: 'al5', actorName: 'יוסי כהן',   actorRole: 'owner',   action: 'פרסם שיבוץ',        target: 'שבוע 12–18 במאי', timestamp: '2024-05-11T12:00:00' },
  { id: 'al6', actorName: 'דוד לוי',    actorRole: 'manager', action: 'הפעיל בלת״מ',       target: 'נועם כץ — לא זמין', timestamp: '2024-05-12T06:30:00' },
  { id: 'al7', actorName: 'דוד לוי',    actorRole: 'manager', action: 'חישב שיבוץ מחדש',  target: 'שבוע 12–18 במאי', timestamp: '2024-05-12T06:32:00' },
  { id: 'al8', actorName: 'יוסי כהן',   actorRole: 'owner',   action: 'יצר תקופת שיבוץ',  target: 'שבוע 19–25 במאי', timestamp: '2024-05-14T09:00:00' },
];

// ─── Calendar events (operational calendar spine) ────────────────────────────
//
// First-class events the app owns: combat-blocks (daily rhythm), locked
// dates, and announcements. Derived entries (guard-shifts from TimeSlot,
// leave-periods from Leave, birthdays from Soldier.dateOfBirth, missions
// from CompanyMission) are computed at read time by utils/calendar.ts and
// are NOT stored here.
//
// For the demo, event timestamps are anchored to whatever wall-clock
// "today" is when the module loads, so the calendar always renders a
// meaningful day regardless of when the demo is opened.

const todayAt = (hhmm: string, dayOffset = 0): string => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

const dayBounds = (dayOffset = 0): { start: string; end: string } => {
  const s = new Date(); s.setDate(s.getDate() + dayOffset); s.setHours(0, 0, 0, 0);
  const e = new Date(); e.setDate(e.getDate() + dayOffset); e.setHours(23, 59, 59, 0);
  return { start: s.toISOString(), end: e.toISOString() };
};

const SEED_CO = 'co1';
const SEED_PLATOON = 'g1';                       // primary mock platoon
const SEED_CREATED = new Date().toISOString();

export const mockCalendarEvents: CalendarEvent[] = [
  // ── Today — company combat-clock rhythm + one platoon-time slot ──
  {
    id:        'ce-mess-am',
    companyId: SEED_CO,
    kind:      'combat-block',
    scope:     'company',
    scopeRefId: SEED_CO,
    start:     todayAt('07:00'),
    end:       todayAt('07:45'),
    allDay:    false,
    title:     'ארוחת בוקר',
    combatBlock: { kind: 'mess' },
    createdBy: 'u-cc',
    createdAt: SEED_CREATED,
  },
  {
    id:        'ce-briefing-am',
    companyId: SEED_CO,
    kind:      'combat-block',
    scope:     'company',
    scopeRefId: SEED_CO,
    start:     todayAt('08:00'),
    end:       todayAt('08:30'),
    allDay:    false,
    title:     'תדריך בוקר',
    detail:    'מ״פ + מ״מים',
    combatBlock: { kind: 'briefing' },
    createdBy: 'u-cc',
    createdAt: SEED_CREATED,
  },
  {
    id:        'ce-pt-empty',
    companyId: SEED_CO,
    kind:      'combat-block',
    scope:     'company',
    scopeRefId: SEED_CO,
    start:     todayAt('10:00'),
    end:       todayAt('12:00'),
    allDay:    false,
    title:     'זמן מחלקה',
    combatBlock: { kind: 'platoon-time' },        // unfilled
    createdBy: 'u-cc',
    createdAt: SEED_CREATED,
  },
  {
    id:        'ce-pt-filled',
    companyId: SEED_CO,
    kind:      'combat-block',
    scope:     'company',
    scopeRefId: SEED_CO,
    start:     todayAt('13:00'),
    end:       todayAt('15:00'),
    allDay:    false,
    title:     'זמן מחלקה',
    combatBlock: {
      kind: 'platoon-time',
      platoonFill: {
        platoonId: SEED_PLATOON,
        title:     'ירי קצר באקדח',
        detail:    'כיתה ב׳ במטווח',
        filledBy:  'u-pc',
        filledAt:  SEED_CREATED,
      },
    },
    createdBy: 'u-cc',
    createdAt: SEED_CREATED,
  },
  {
    id:        'ce-mess-pm',
    companyId: SEED_CO,
    kind:      'combat-block',
    scope:     'company',
    scopeRefId: SEED_CO,
    start:     todayAt('19:00'),
    end:       todayAt('19:45'),
    allDay:    false,
    title:     'ארוחת ערב',
    combatBlock: { kind: 'mess' },
    createdBy: 'u-cc',
    createdAt: SEED_CREATED,
  },

  // ── Today (all-day) — company announcement ──
  {
    id:        'ce-anno-1',
    companyId: SEED_CO,
    kind:      'announcement',
    scope:     'company',
    scopeRefId: SEED_CO,
    ...dayBounds(0),
    allDay:    true,
    title:     'ביקור מח״ט מחר 09:00',
    detail:    'מסדר מוכנות · מדים א׳',
    createdBy: 'u-cc',
    createdAt: SEED_CREATED,
  },

  // ── Tomorrow — locked date + morning briefing ──
  {
    id:        'ce-lock-1',
    companyId: SEED_CO,
    kind:      'locked-date',
    scope:     'company',
    scopeRefId: SEED_CO,
    ...dayBounds(1),
    allDay:    true,
    title:     'יום נעול — ביקור מח״ט',
    lockedDate: { reason: 'ביקור מח״ט', allowsLeave: false },
    createdBy: 'u-cc',
    createdAt: SEED_CREATED,
  },
  {
    id:        'ce-briefing-tmrw',
    companyId: SEED_CO,
    kind:      'combat-block',
    scope:     'company',
    scopeRefId: SEED_CO,
    start:     todayAt('08:00', 1),
    end:       todayAt('08:30', 1),
    allDay:    false,
    title:     'תדריך לפני ביקור',
    combatBlock: { kind: 'briefing' },
    createdBy: 'u-cc',
    createdAt: SEED_CREATED,
  },
];

// ─── Engine seed (slice E1 — no UI consumer yet) ─────────────────────────────
//
// Read-only foundation for the scheduling/leave/mission engine. Slice E2
// adds the CC mission-authoring wizard that writes to mockMissions via
// context actions. Until then this data is reachable through useApp() but
// no screen renders it.

// Company-defined capability vocabulary.
export const mockQualifications: Qualification[] = [
  {
    id:        'q-drone-op',
    companyId: 'co1',
    name:      'מפעיל רחפן מבצעי',
    category:  'תקשורת',
    createdBy: 'u-cc',
    createdAt: SEED_CREATED,
  },
  {
    id:        'q-driver-c',
    companyId: 'co1',
    name:      'נהג קשת',
    category:  'נהיגה',
    createdBy: 'u-cc',
    createdAt: SEED_CREATED,
  },
  {
    id:        'q-tactical-medic',
    companyId: 'co1',
    name:      'חובש קרבי',
    category:  'רפואה',
    createdBy: 'u-cc',
    createdAt: SEED_CREATED,
  },
];

export const mockEquipmentItems: EquipmentItem[] = [
  { id: 'eq-ladder',    companyId: 'co1', name: 'סולם',          category: 'ציוד פריצה', isConsumable: false, unitCount: 3 },
  { id: 'eq-drone-mvk', companyId: 'co1', name: 'רחפן מאוויק 3', category: 'תקשורת',     isConsumable: false, unitCount: 2 },
  { id: 'eq-radio-cmd', companyId: 'co1', name: 'מכשיר קשר מ״מ',  category: 'תקשורת',     isConsumable: false, unitCount: 6 },
];

// Soldier ↔ Qualification links. Two soldiers carry quals for demo realism.
export const mockSoldierQualifications: SoldierQualification[] = [
  {
    id:              'sq-1',
    soldierId:       's7',                                        // Shay Avraham — has 'רחפן' op role too
    qualificationId: 'q-drone-op',
    certifiedAt:     '2025-03-01',
  },
  {
    id:              'sq-2',
    soldierId:       's9',                                        // Nisim Dahan — חובש
    qualificationId: 'q-tactical-medic',
    certifiedAt:     '2024-11-15',
  },
];

// Two seed missions exercising different policy combinations.
export const mockMissions: Mission[] = [
  {
    id:               'mi-gate-north',
    companyId:        'co1',
    name:             'שמירה בשער צפון',
    description:      'שמירת בסיס · משמרת מתחלפת',
    createdByUserId:  'u-cc',
    ownerRole:        'company',
    assignedPlatoonIds: ['g1'],
    timeModel: {
      kind: '24-7-continuous',
    },
    manpower: {
      kind: 'window-varies',
      windows: [
        { label: 'day',   from: '06:00', to: '22:00', spec: { kind: 'exact', count: 1 } },
        { label: 'night', from: '22:00', to: '06:00', spec: { kind: 'exact', count: 2 } },
      ],
    },
    command: {
      fieldCommandRequired:      false,
      commandersPerSlot:         0,
      commanderCountsAsManpower: false,
      rankPolicy: {
        soldier: 'regular',
        mk:      'regular',
        samal:   'regular',
        mam:     'excluded',
        officer: 'excluded',
        custom:  'excluded',
      },
    },
    rotation: { kind: 'fixed-platoon', platoonId: 'g1' },
    fatigue: {
      intensity:         'standing-guard',
      impactsSleep:      false,
      minRestAfterHours: 6,
      fatigueWeight:     3,
    },
    qualifications: [],
    equipment: [
      { equipmentItemId: 'eq-radio-cmd', count: 1, perSoldier: false },
    ],
    conflictsWith:  [],
    canOverlapWith: [],
    pairings:       [],
    squadPolicy:    { mode: 'mix' },
    requiresDailyConfirmation: false,
    status:    'active',
    createdAt: SEED_CREATED,
  },
  {
    id:               'mi-night-patrol',
    companyId:        'co1',
    name:             'סיור לילה — גזרה מערבית',
    description:      'יציאה לילית · משימה בעלת אופי מבצעי',
    createdByUserId:  'u-cc',
    ownerRole:        'company',
    assignedPlatoonIds: ['g1'],
    timeModel: {
      kind: 'fixed-hours',
      windows: [
        { startTime: '23:00', endTime: '03:00', shiftDurationMinutes: 240, recurring: 'every-day' },
      ],
    },
    manpower: {
      kind: 'exact',
      count: 4,
    },
    command: {
      fieldCommandRequired:      true,
      commandersPerSlot:         1,
      commanderCountsAsManpower: true,
      rankPolicy: {
        soldier: 'regular',
        mk:      'regular',
        samal:   'commander-only',
        mam:     'commander-only',
        officer: 'excluded',
        custom:  'excluded',
      },
    },
    rotation: { kind: 'rotate-squads', period: 'daily' },
    fatigue: {
      intensity:         'ambush',
      impactsSleep:      true,
      sleepWindowHours:  4,
      minRestAfterHours: 12,
      fatigueWeight:     9,
    },
    qualifications: [
      { qualificationId: 'q-tactical-medic', count: 1 },
    ],
    equipment: [
      { equipmentItemId: 'eq-radio-cmd', count: 1, perSoldier: false },
    ],
    conflictsWith:  [],
    canOverlapWith: [],
    pairings:       [],
    squadPolicy:    { mode: 'no-mix' },
    requiresDailyConfirmation: true,
    status:    'active',
    createdAt: SEED_CREATED,
  },
];

// Company-level leave rotation policy. One per company.
export const mockLeaveRotationPolicy: LeaveRotationPolicy = {
  id:                'lrp-co1',
  companyId:         'co1',
  mode:              'platoon-rotation',
  minSoldiersOnBase: 8,
  perPlatoonFloors:  { g1: 5 },
  cycle:             { everyDays: 7 },
  squadsEligibleForPartialLeave: ['su-g1-a', 'su-g1-b', 'su-g1-c'],
  exceptions: [
    {
      kind:   'never-on-leave',
      target: { functionalRoles: ['rasap'] },
      rule:   'רס״פ נשאר בבסיס במהלך מחזורי החופשה',
    },
  ],
  createdAt: SEED_CREATED,
};

// Empty until slice E5 wires the leave-rotation planner.
export const mockLeaveBlocks: LeaveBlock[] = [];

// ─── Leave/coverage engine seed (slice L1 — read-only) ───────────────────────
//
// Foundation data shapes for the leave/coverage engine. The planner, the
// fairness evaluator, and all write paths land in later L-slices.

// One CoverageEvent — a company event tomorrow afternoon. Platoon g1 is
// out for ~5 hours; the absence is small enough that the existing
// missions' manpower naturally covers it.
export const mockCoverageEvents: CoverageEvent[] = [
  {
    id:        'cv-1',
    companyId: 'co1',
    absent:    { kind: 'platoon', platoonId: 'g1' },
    covering:  { kind: 'mission-already-covers' },
    start:     todayAt('14:00', 1),
    end:       todayAt('19:00', 1),
    affectedMissionIds: [],            // engine will re-derive at projection time
    reason:    'company-event',
    notes:     'אירוע פלוגה — ברביקיו וערב גיבוש',
    createdBy: 'u-cc',
    createdAt: SEED_CREATED,
  },
];

// One DutyExclusion — soldier s4 marked abroad for the next 10 days.
// compensateOnReturn=true so the fairness evaluator weights them as
// "expected to contribute more" once they return.
export const mockDutyExclusions: DutyExclusion[] = [
  {
    id:        'de-1',
    companyId: 'co1',
    soldierId: 's4',                   // נועם כץ
    startIso:  dayBounds(-1).start,
    endIso:    dayBounds(9).end,
    reason:    'abroad',
    note:      'חו"ל — חופשת לימודים',
    compensateOnReturn: true,
    createdBy: 'u-cc',
    createdAt: SEED_CREATED,
  },
];

// Empty until slice L6 wires the rotation planner.
export const mockLeaveRotationPlans: LeaveRotationPlan[] = [];

// ─── Signed equipment (per-soldier gear ledger) ─────────────────────────────
// Seeded for a few soldiers so the /equipment surface has demo content.

export const mockSignedEquipment: SignedEquipment[] = [
  {
    id:             'se-1', companyId: 'co1', soldierId: 's1',
    itemName:       'M16A2',       category: 'weapon',
    serialNumber:   '7745321',
    signedByUserId: 'u-rasap',     signedByName: 'רס״פ אבי כהן',
    source:         'גדוד 51',     signedAt: '2024-05-01T08:30:00',
    status:         'active',
  },
  {
    id:             'se-2', companyId: 'co1', soldierId: 's1',
    itemName:       'מאיר 1',      category: 'optic',
    serialNumber:   'M1-0234',
    signedByUserId: 'u-rasap',     signedByName: 'רס״פ אבי כהן',
    source:         'גדוד 51',     signedAt: '2024-05-01T08:35:00',
    status:         'active',
  },
  {
    id:             'se-3', companyId: 'co1', soldierId: 's1',
    itemName:       'ווסט קרבי',   category: 'protection',
    signedByUserId: 'u-rasap',     signedByName: 'רס״פ אבי כהן',
    source:         'גדוד 51',     signedAt: '2024-05-01T08:40:00',
    status:         'active',
    notes:          'מידה L',
  },
  {
    id:             'se-4', companyId: 'co1', soldierId: 's1',
    itemName:       'מכשיר קשר',   category: 'comms',
    serialNumber:   'R-PRC-152-014',
    signedByUserId: 'u-rasap',     signedByName: 'רס״פ אבי כהן',
    source:         'גדוד 51',     signedAt: '2024-05-08T09:15:00',
    status:         'active',
  },
  {
    id:             'se-5', companyId: 'co1', soldierId: 's7',
    itemName:       'רחפן מאוויק 3', category: 'comms',
    serialNumber:   'DJI-MVK3-007',
    equipmentItemId: 'eq-drone-mvk',
    signedByUserId: 'u-rasap',     signedByName: 'רס״פ אבי כהן',
    source:         'מאגר חטיבתי', signedAt: '2025-03-02T10:00:00',
    status:         'active',
    notes:          'בדיקה רבעונית עברה — 2026/03',
  },
  {
    id:             'se-6', companyId: 'co1', soldierId: 's9',
    itemName:       'תיק חובש',    category: 'medical',
    signedByUserId: 'u-rasap',     signedByName: 'רס״פ אבי כהן',
    source:         'גדוד 51',     signedAt: '2024-11-20T07:00:00',
    status:         'active',
  },
];

// ─── Temporary command delegations ──────────────────────────────────────────
// Empty default — UI flows in this phase create them.
export const mockCommandDelegations: CommandDelegation[] = [];

// ─── Equipment gap reports ──────────────────────────────────────────────────
// One seed report so the PS review surface has demo content.
export const mockEquipmentGaps: EquipmentGap[] = [
  {
    id:                  'eg-1',
    companyId:           'co1',
    reportedByUserId:    'u3',
    reportedBySoldierId: 's1',
    reportedByName:      'משה ישראלי',
    reportedByPlatoonId: 'g1',
    kind:                'damaged',
    itemName:            'מאיר 1',
    signedEquipmentId:   'se-2',
    description:         'עינית פנימית סדוקה — נדרשת החלפה',
    status:              'reported',
    createdAt:           todayAt('07:30', -1),
  },
];
