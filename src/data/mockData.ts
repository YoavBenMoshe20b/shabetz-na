import type {
  Soldier, SchedulePeriod, AuditLog, MockUser, Group, Leave, LeaveRequest,
  EquipmentRequirements, SoldierHistory, MiluimPeriod,
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
export const mockUsers: MockUser[] = [
  {
    id: 'u1', name: 'יוסי כהן', role: 'owner',
    phone: '0501234567', email: 'yosi@unit.il', username: 'yosi123',
    password: 'Test@1234', joinedGroupIds: ['g1'],
    operationalRoles: ['מ״פ'], teamClass: 'מפקדה',
  },
  {
    id: 'u2', name: 'דוד לוי', role: 'manager',
    phone: '0507654321', email: 'david@unit.il', username: 'david99',
    password: 'Test@1234', joinedGroupIds: ['g1'],
    operationalRoles: ['סמ״פ'], teamClass: 'מפקדה',
  },
  {
    id: 'u3', name: 'משה ישראלי', role: 'soldier',
    phone: '0509876543', email: 'moshe@unit.il', username: 'moshe7',
    password: 'Test@1234', joinedGroupIds: ['g1'],
    operationalRoles: ['קלע', 'חובש'], teamClass: 'כיתה 1',
    soldierProfileId: 's1',
  },
  {
    id: 'u4', name: 'עמית גרין', role: 'soldier',
    phone: '0504567890', email: 'amit@unit.il', username: 'amit22',
    password: 'Test@1234', joinedGroupIds: [],
    operationalRoles: [], teamClass: 'אחר',
  },
];

export const mockSoldiers: Soldier[] = [
  { id: 's1', name: 'משה ישראלי',  operationalRoles: ['קלע', 'חובש'],    teamClass: 'כיתה 1', availability: true,  availabilityNotes: [], currentLoad: 2, userId: 'u3' },
  { id: 's2', name: 'רוני שמש',    operationalRoles: ['מ״מ', 'קשר מ״מ'], teamClass: 'כיתה 1', availability: true,  availabilityNotes: [{ type: 'leave', description: 'חופשה', startDate: '2024-05-20', endDate: '2024-05-21' }], currentLoad: 1 },
  { id: 's3', name: 'אורן פרץ',    operationalRoles: ['נגביסט'],          teamClass: 'כיתה 2', availability: true,  availabilityNotes: [], currentLoad: 3 },
  { id: 's4', name: 'נועם כץ',     operationalRoles: ['קשר מ״מ'],         teamClass: 'כיתה 2', availability: false, availabilityNotes: [{ type: 'other', description: 'לא זמין לשיבוץ' }], currentLoad: 0 },
  { id: 's5', name: 'איתי בן דוד', operationalRoles: ['סמ״פ', 'רחפן'],   teamClass: 'מפקדה',  availability: true,  availabilityNotes: [], currentLoad: 1 },
  { id: 's6', name: 'גל מזרחי',    operationalRoles: ['מאגיסט', 'סמל'],  teamClass: 'כיתה 2', availability: true,  availabilityNotes: [], currentLoad: 2 },
  { id: 's7', name: 'שי אברהם',    operationalRoles: ['רחפן', 'קלע'],    teamClass: 'כיתה 3', availability: true,  availabilityNotes: [], currentLoad: 1 },
  { id: 's8', name: 'יניב שלום',   operationalRoles: ['קלע'],             teamClass: 'כיתה 3', availability: true,  availabilityNotes: [{ type: 'location', description: 'לא נמצא בבסיס', startDate: '2024-05-12', endDate: '2024-05-13' }], currentLoad: 0 },
  { id: 's9', name: 'ניסים דהן',   operationalRoles: ['חובש', 'סמל'],    teamClass: 'כיתה 1', availability: true,  availabilityNotes: [], currentLoad: 2 },
  { id: 's10', name: 'אלון ברק',   operationalRoles: ['מ״מ', 'מאגיסט'],  teamClass: 'כיתה 3', availability: true,  availabilityNotes: [], currentLoad: 1 },
];

// ─── Leaves ──────────────────────────────────────────────────────────────────

export const mockLeaves: Leave[] = [
  {
    id: 'lv1', scope: 'class', teamClass: 'כיתה 2',
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
    soldierId: 's1', soldierName: 'משה ישראלי', soldierTeamClass: 'כיתה 1',
    startDate: '2024-05-22', startTime: '14:00',
    endDate:   '2024-05-24', endTime:   '08:00',
    reason: 'אירוע משפחתי',
    status: 'pending',
    submittedAt: '2024-05-14T10:00:00',
  },
  {
    id: 'lr2',
    soldierId: 's3', soldierName: 'אורן פרץ', soldierTeamClass: 'כיתה 2',
    startDate: '2024-05-19', startTime: '08:00',
    endDate:   '2024-05-19', endTime:   '18:00',
    reason: 'פגישה רפואית',
    status: 'approved',
    reviewedBy: 'u2', reviewedByName: 'דוד לוי', reviewedAt: '2024-05-13T14:30:00',
    submittedAt: '2024-05-13T08:00:00',
  },
  {
    id: 'lr3',
    soldierId: 's7', soldierName: 'שי אברהם', soldierTeamClass: 'כיתה 3',
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
    managerNotes: [
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
    managerNotes: [],
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

export const mockGroups: Group[] = [
  {
    id: 'g1', name: 'מחלקה א׳', unitName: 'גדוד 51', code: 'UNIT-4821',
    ownerId: 'u1', memberIds: ['u1', 'u2', 'u3'],
    platoonCommander: 'יוסי כהן', platoonSergeant: 'דוד לוי',
    scheduleManagers: ['u1', 'u2'],
    availableRoles: ['קלע', 'חובש', 'נגביסט', 'מאגיסט', 'קשר מ״מ', 'רחפן', 'מ״מ', 'סמל'],
    size: 10,
    enemyConfusion: false,
    confusionMinutes: 0,
  },
  {
    id: 'g2', name: 'כיתת סיור', unitName: 'גדוד 51', code: 'UNIT-9934',
    ownerId: 'u2', memberIds: ['u2'],
    availableRoles: ['קלע', 'חובש', 'מ״מ'],
    size: 8,
  },
];

// ─── Miluim Period ────────────────────────────────────────────────────────────

export const mockMiluimPeriods: MiluimPeriod[] = [
  { id: 'mp1', groupId: 'g1', startDate: '2024-05-05', endDate: '2024-08-22', description: 'מילואים קיץ 2024 — גדוד 51' },
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
