import type {
  Soldier, SchedulePeriod, AuditLog, MockUser, Platoon, Leave, LeaveRequest,
  EquipmentRequirements, SoldierHistory, MiluimPeriod, Company, Squad,
  CompanyMission, OverrideAlert,
  SoldierStatusEvent, Delegation,
  CalendarEvent,
  Mission, Qualification, EquipmentItem, SoldierQualification, Assignment, SlotOperationalState,
  Pkal, PkalQuota,
  ChecklistTemplate, ChecklistRun, ChecklistInstance,
  PlatoonLeaveDay, CompanyLeavePolicy, CompanyCoverageRuleSet, SoldierLeaveOverride,
  CompanyBlockedDate,
  LeaveRotationPolicy, LeaveBlock,
  CoverageEvent, DutyExclusion, LeaveRotationPlan,
  SignedEquipment,
  CommandDelegation, EquipmentGap,
  MissionNote,
  OperationalOrder,
  Announcement, EscalationEvent, PlatoonLeaveCycle,
  LogisticsRotation,
  CommandRank, RankPolicy,
} from '../types';
import type { MissionTemplate, TemplateFamily } from '../utils/missionTemplates';

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
  // ── מחלקה 1 ─────────────────────────────────────────────────────────
  // currentStatus drives every operational view. statusSetAt is the
  // canonical "since" timestamp; statusExpectedUntil is set when going
  // home so the system knows when they should be back.
  { id: 's1',  name: 'משה ישראלי',  phone: '0509876543', idLast4: '1111', companyId: 'co1', status: 'active', claimedAt: '2024-05-08T09:00:00', userId: 'u3', operationalRoles: ['קלע', 'חובש'],    teamClass: 'כיתה א', squadId: 'su-g1-a',  currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true,  availabilityNotes: [], currentLoad: 2,
    dateOfBirth: '1998-03-14', dominantHand: 'right', weaponSide: 'right', shirtSize: 'L', pantsSize: '34', shoeSize: '43' },
  { id: 's2',  name: 'רוני שמש',    phone: '0502222111', idLast4: '2222', companyId: 'co1', status: 'active', userId: 'u2', operationalRoles: ['מ״מ', 'קשר מ״מ'], teamClass: 'כיתה א', squadId: 'su-g1-a',  currentStatus: 'home',    statusSetAt: '2024-05-12T00:00:00', statusExpectedUntil: '2024-05-14T22:00:00', availability: true,  availabilityNotes: [{ type: 'leave', description: 'חופשה', startDate: '2024-05-20', endDate: '2024-05-21' }], currentLoad: 1 },
  { id: 's3',  name: 'אורן פרץ',    phone: '0503333222', idLast4: '3333', companyId: 'co1', status: 'active', userId: 'u14', operationalRoles: ['נגביסט'],          teamClass: 'כיתה ב', squadId: 'su-g1-b',  currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true,  availabilityNotes: [], currentLoad: 3 },
  { id: 's4',  name: 'נועם כץ',     phone: '0504444333', idLast4: '4444', companyId: 'co1', status: 'active', operationalRoles: ['קשר מ״מ'],         teamClass: 'כיתה ב', squadId: 'su-g1-b',  currentStatus: 'inactive-temp', statusSetAt: YESTERDAY_AM, availability: false, availabilityNotes: [{ type: 'other', description: 'לא זמין לשיבוץ' }], currentLoad: 0 },
  // s5 — סמ"פ, lives in חפ"ק (sq-chap-1) rather than a combat platoon
  { id: 's5',  name: 'איתי בן דוד', phone: '0505555444', idLast4: '5555', companyId: 'co1', status: 'active', operationalRoles: ['סמ״פ', 'רחפן'],   teamClass: 'חפ״ק',   squadId: 'sq-chap-1', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true,  availabilityNotes: [], currentLoad: 1 },
  { id: 's6',  name: 'גל מזרחי',    phone: '0506666555', idLast4: '6666', companyId: 'co1', status: 'active', operationalRoles: ['מאגיסט'],         teamClass: 'כיתה ב', squadId: 'su-g1-b',  currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true,  availabilityNotes: [], currentLoad: 2 },
  { id: 's7',  name: 'שי אברהם',    phone: '0507777666', idLast4: '7777', companyId: 'co1', status: 'active', operationalRoles: ['רחפן', 'קלע'],    teamClass: 'כיתה ג', squadId: 'su-g1-c',  currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true,  availabilityNotes: [], currentLoad: 1 },
  // s8: UNCLAIMED slot
  { id: 's8',  name: 'יניב שלום',   phone: '0508888777', idLast4: '8888', companyId: 'co1', status: 'active', operationalRoles: ['קלע'],             teamClass: 'כיתה ג', squadId: 'su-g1-c',  currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true,  availabilityNotes: [{ type: 'location', description: 'לא נמצא בבסיס', startDate: '2024-05-12', endDate: '2024-05-13' }], currentLoad: 0 },
  { id: 's9',  name: 'ניסים דהן',   phone: '0509999888', idLast4: '9999', companyId: 'co1', status: 'active', userId: 'u5', operationalRoles: ['סמל', 'חובש'],    teamClass: 'כיתה א', squadId: 'su-g1-a',  currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true,  availabilityNotes: [], currentLoad: 2, dateOfBirth: (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 26); return d.toISOString().slice(0, 10); })() },
  { id: 's10', name: 'אלון ברק',    phone: '0501010101', idLast4: '1010', companyId: 'co1', status: 'active', operationalRoles: ['מ״כ', 'מאגיסט'],  teamClass: 'כיתה ג', squadId: 'su-g1-c',  currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true,  availabilityNotes: [], currentLoad: 1 },

  // ── חפ"ק ─────────────────────────────────────────────────────────────
  // Small command attachment around the מ"פ and סמ"פ. Carries the
  // communication soldiers attached directly to company command.
  { id: 's12', name: 'אורי לביא',   phone: '0501212121', idLast4: '1212', companyId: 'co1', status: 'active', operationalRoles: ['מש״ק קשר', 'קשר מ״מ'], teamClass: 'חפ״ק',   squadId: 'sq-chap-1', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's13', name: 'טל מאור',     phone: '0501313131', idLast4: '1313', companyId: 'co1', status: 'active', operationalRoles: ['מש״ק קשר'],            teamClass: 'חפ״ק',   squadId: 'sq-chap-1', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },

  // ── מחלקה 2 ──────────────────────────────────────────────────────────
  { id: 's14', name: 'עומר בר',     phone: '0501414141', idLast4: '1414', companyId: 'co1', status: 'active', userId: 'u9',  operationalRoles: ['מ״מ'],                  teamClass: 'כיתה א', squadId: 'su-g2-a',   currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's15', name: 'נדב חרל״פ',   phone: '0501515151', idLast4: '1515', companyId: 'co1', status: 'active', operationalRoles: ['קלע'],                  teamClass: 'כיתה א', squadId: 'su-g2-a',   currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 2 },
  { id: 's16', name: 'תום הירש',    phone: '0501616161', idLast4: '1616', companyId: 'co1', status: 'active', operationalRoles: ['חובש'],                 teamClass: 'כיתה ב', squadId: 'su-g2-b',   currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 2 },
  { id: 's17', name: 'אדם עוזרי',   phone: '0501717171', idLast4: '1717', companyId: 'co1', status: 'active', operationalRoles: ['נגביסט'],              teamClass: 'כיתה ב', squadId: 'su-g2-b',   currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's18', name: 'אייל גלעד',   phone: '0501818181', idLast4: '1818', companyId: 'co1', status: 'active', userId: 'u11', operationalRoles: ['סמל'],                  teamClass: 'כיתה ג', squadId: 'su-g2-c',   currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 2 },

  // ── מחלקה 3 ──────────────────────────────────────────────────────────
  { id: 's19', name: 'יואב סער',    phone: '0501919191', idLast4: '1919', companyId: 'co1', status: 'active', userId: 'u10', operationalRoles: ['מ״מ'],                  teamClass: 'כיתה א', squadId: 'su-g3-a',   currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's20', name: 'דניאל אריה',  phone: '0502020202', idLast4: '2020', companyId: 'co1', status: 'active', operationalRoles: ['קלע'],                  teamClass: 'כיתה א', squadId: 'su-g3-a',   currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's21', name: 'שגיא ברנר',   phone: '0502121212', idLast4: '2121', companyId: 'co1', status: 'active', userId: 'u12', operationalRoles: ['סמל'],                  teamClass: 'כיתה ב', squadId: 'su-g3-b',   currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 2 },
  { id: 's22', name: 'אסף קמין',    phone: '0502222122', idLast4: '2222', companyId: 'co1', status: 'active', operationalRoles: ['מאגיסט'],              teamClass: 'כיתה ב', squadId: 'su-g3-b',   currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },

  // ── מפלג ─────────────────────────────────────────────────────────────
  // Logistics platoon, commanded by the רס״פ. Coordinates supply,
  // equipment, food, cleaning task assignment, etc. — does not "do all
  // cleaning" itself.
  { id: 's23', name: 'אבי כהן',     phone: '0502323232', idLast4: '2323', companyId: 'co1', status: 'active', userId: 'u6', operationalRoles: ['רס״פ'],                 teamClass: 'מפלג',   squadId: 'su-meflag-1', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1, functionalRoles: ['rasap'] },
  { id: 's24', name: 'רון אביב',    phone: '0502424242', idLast4: '2424', companyId: 'co1', status: 'active', userId: 'u8', operationalRoles: ['שליש'],                 teamClass: 'מפלג',   squadId: 'su-meflag-1', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1, functionalRoles: ['shalish'] },
  { id: 's25', name: 'ניר טל',      phone: '0502525252', idLast4: '2525', companyId: 'co1', status: 'active', operationalRoles: [],                       teamClass: 'מפלג',   squadId: 'su-meflag-2', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 0 },

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  PHASE 6.3.a — REALISTIC COMPANY SEED EXPANSION                          ║
  // ║                                                                          ║
  // ║  Goal: 3 combat platoons × ~20 soldiers + 8 in CHAPAK + 6 in MAFLAG.     ║
  // ║                                                                          ║
  // ║  Per regular platoon (g1/g2/g3):                                         ║
  // ║    • 1 מ״מ + 1 קשר מ״מ                                                  ║
  // ║    • 3 squads × (1 מ״כ + ~5 חיילים): נגביסט/קלע/מטוליסט/חובש/...      ║
  // ║    • 1 סמל + 1 קשר סמל                                                 ║
  // ║                                                                          ║
  // ║  CHAPAK: forward command around the CC + DCC. CC and DCC appear here    ║
  // ║  as REAL soldier records (linked from MockUser.soldierProfileId), since ║
  // ║  the principle is "everyone is first a soldier".                        ║
  // ║                                                                          ║
  // ║  MAFLAG: 6 with functional roles (driver / kitchen / cleaning / water / ║
  // ║  equipment / רס״פ). Roles are flags in operationalRoles so they are     ║
  // ║  reassignable without schema changes.                                   ║
  // ╚══════════════════════════════════════════════════════════════════════════╝

  // ── מחלקה 1 — fill out to ~20 ───────────────────────────────────────────
  { id: 's26', name: 'יותם פרידמן',  phone: '0502611111', idLast4: '2611', companyId: 'co1', status: 'active', operationalRoles: ['מ״כ', 'קלע חוד'],   teamClass: 'כיתה א', squadId: 'su-g1-a', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 2 },
  { id: 's27', name: 'אריאל מימון',  phone: '0502711111', idLast4: '2711', companyId: 'co1', status: 'active', operationalRoles: ['מ״כ'],              teamClass: 'כיתה ב', squadId: 'su-g1-b', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 2 },
  { id: 's28', name: 'יונתן עזרא',   phone: '0502811111', idLast4: '2811', companyId: 'co1', status: 'active', operationalRoles: ['קשר מ״מ'],          teamClass: 'כיתה א', squadId: 'su-g1-a', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's29', name: 'עידן רוט',     phone: '0502911111', idLast4: '2911', companyId: 'co1', status: 'active', operationalRoles: ['קשר סמל'],          teamClass: 'כיתה א', squadId: 'su-g1-a', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's30', name: 'בן אלון',      phone: '0503011111', idLast4: '3011', companyId: 'co1', status: 'active', operationalRoles: ['חובש'],             teamClass: 'כיתה ב', squadId: 'su-g1-b', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's31', name: 'אביב גרינברג', phone: '0503111111', idLast4: '3111', companyId: 'co1', status: 'active', operationalRoles: ['מטוליסט'],          teamClass: 'כיתה ב', squadId: 'su-g1-b', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's32', name: 'גיא דרור',     phone: '0503211111', idLast4: '3211', companyId: 'co1', status: 'active', operationalRoles: ['רובאי'],            teamClass: 'כיתה ב', squadId: 'su-g1-b', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's33', name: 'דור חזן',      phone: '0503311111', idLast4: '3311', companyId: 'co1', status: 'active', operationalRoles: ['נגביסט חוד'],       teamClass: 'כיתה ג', squadId: 'su-g1-c', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 2 },
  { id: 's34', name: 'יואל סופר',    phone: '0503411111', idLast4: '3411', companyId: 'co1', status: 'active', operationalRoles: ['חובש'],             teamClass: 'כיתה ג', squadId: 'su-g1-c', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's35', name: 'אדם ברקת',     phone: '0503511111', idLast4: '3511', companyId: 'co1', status: 'active', operationalRoles: ['רובאי'],            teamClass: 'כיתה ג', squadId: 'su-g1-c', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's36', name: 'נריה שרון',    phone: '0503611111', idLast4: '3611', companyId: 'co1', status: 'active', operationalRoles: ['רובאי'],            teamClass: 'כיתה א', squadId: 'su-g1-a', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },

  // ── מחלקה 2 — fill out to ~20 ───────────────────────────────────────────
  { id: 's37', name: 'אריק שרעבי',   phone: '0503711111', idLast4: '3711', companyId: 'co1', status: 'active', operationalRoles: ['קשר מ״מ'],          teamClass: 'כיתה א', squadId: 'su-g2-a', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's38', name: 'אסיף לויתן',   phone: '0503811111', idLast4: '3811', companyId: 'co1', status: 'active', operationalRoles: ['מ״כ', 'נגביסט חוד'], teamClass: 'כיתה א', squadId: 'su-g2-a', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 2 },
  { id: 's39', name: 'אורי מנגד',    phone: '0503911111', idLast4: '3911', companyId: 'co1', status: 'active', operationalRoles: ['חובש'],             teamClass: 'כיתה א', squadId: 'su-g2-a', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's40', name: 'יואב טננבאום', phone: '0504011111', idLast4: '4011', companyId: 'co1', status: 'active', operationalRoles: ['מטוליסט'],          teamClass: 'כיתה א', squadId: 'su-g2-a', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's41', name: 'דביר בן חיים', phone: '0504111111', idLast4: '4111', companyId: 'co1', status: 'active', operationalRoles: ['רובאי'],            teamClass: 'כיתה א', squadId: 'su-g2-a', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's42', name: 'אורי שטרן',    phone: '0504211111', idLast4: '4211', companyId: 'co1', status: 'active', operationalRoles: ['מ״כ'],              teamClass: 'כיתה ב', squadId: 'su-g2-b', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 2 },
  { id: 's43', name: 'בני אבני',     phone: '0504311111', idLast4: '4311', companyId: 'co1', status: 'active', operationalRoles: ['קלע חוד'],          teamClass: 'כיתה ב', squadId: 'su-g2-b', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's44', name: 'ארז עמרני',    phone: '0504411111', idLast4: '4411', companyId: 'co1', status: 'active', operationalRoles: ['רובאי'],            teamClass: 'כיתה ב', squadId: 'su-g2-b', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's45', name: 'יהונתן רובין', phone: '0504511111', idLast4: '4511', companyId: 'co1', status: 'active', operationalRoles: ['מאגיסט'],           teamClass: 'כיתה ב', squadId: 'su-g2-b', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's46', name: 'תומר אדרי',    phone: '0504611111', idLast4: '4611', companyId: 'co1', status: 'active', operationalRoles: ['מ״כ'],              teamClass: 'כיתה ג', squadId: 'su-g2-c', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 2 },
  { id: 's47', name: 'חי בקאל',      phone: '0504711111', idLast4: '4711', companyId: 'co1', status: 'active', operationalRoles: ['קשר סמל'],          teamClass: 'כיתה ג', squadId: 'su-g2-c', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's48', name: 'אופיר רובין',  phone: '0504811111', idLast4: '4811', companyId: 'co1', status: 'active', operationalRoles: ['חובש'],             teamClass: 'כיתה ג', squadId: 'su-g2-c', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's49', name: 'גלעד נחמני',   phone: '0504911111', idLast4: '4911', companyId: 'co1', status: 'active', operationalRoles: ['רובאי'],            teamClass: 'כיתה ג', squadId: 'su-g2-c', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's50', name: 'איתן ספרי',    phone: '0505011111', idLast4: '5011', companyId: 'co1', status: 'active', operationalRoles: ['רובאי'],            teamClass: 'כיתה ג', squadId: 'su-g2-c', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's51', name: 'יואב נתנאל',   phone: '0505111111', idLast4: '5111', companyId: 'co1', status: 'active', operationalRoles: ['מטוליסט'],          teamClass: 'כיתה ב', squadId: 'su-g2-b', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },

  // ── מחלקה 3 — fill out to ~20 ───────────────────────────────────────────
  { id: 's52', name: 'דני שוורץ',    phone: '0505211111', idLast4: '5211', companyId: 'co1', status: 'active', operationalRoles: ['קשר מ״מ'],          teamClass: 'כיתה א', squadId: 'su-g3-a', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's53', name: 'איל ליפשיץ',   phone: '0505311111', idLast4: '5311', companyId: 'co1', status: 'active', operationalRoles: ['מ״כ', 'קלע חוד'],   teamClass: 'כיתה א', squadId: 'su-g3-a', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 2 },
  { id: 's54', name: 'לירוי אביגד',  phone: '0505411111', idLast4: '5411', companyId: 'co1', status: 'active', operationalRoles: ['חובש'],             teamClass: 'כיתה א', squadId: 'su-g3-a', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's55', name: 'איתי בכר',     phone: '0505511111', idLast4: '5511', companyId: 'co1', status: 'active', operationalRoles: ['נגביסט חוד'],       teamClass: 'כיתה א', squadId: 'su-g3-a', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's56', name: 'מתן בלוך',     phone: '0505611111', idLast4: '5611', companyId: 'co1', status: 'active', operationalRoles: ['רובאי'],            teamClass: 'כיתה א', squadId: 'su-g3-a', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's57', name: 'אורי בן עזרא', phone: '0505711111', idLast4: '5711', companyId: 'co1', status: 'active', operationalRoles: ['מ״כ'],              teamClass: 'כיתה ב', squadId: 'su-g3-b', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 2 },
  { id: 's58', name: 'גל יוסיפוף',   phone: '0505811111', idLast4: '5811', companyId: 'co1', status: 'active', operationalRoles: ['חובש'],             teamClass: 'כיתה ב', squadId: 'su-g3-b', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's59', name: 'גידי שטיינר',  phone: '0505911111', idLast4: '5911', companyId: 'co1', status: 'active', operationalRoles: ['מטוליסט'],          teamClass: 'כיתה ב', squadId: 'su-g3-b', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's60', name: 'אופיר טמיר',   phone: '0506011111', idLast4: '6011', companyId: 'co1', status: 'active', operationalRoles: ['רובאי'],            teamClass: 'כיתה ב', squadId: 'su-g3-b', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's61', name: 'אביב מטרי',    phone: '0506111111', idLast4: '6111', companyId: 'co1', status: 'active', operationalRoles: ['מ״כ'],              teamClass: 'כיתה ג', squadId: 'su-g3-c', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 2 },
  { id: 's62', name: 'הראל גלזר',    phone: '0506211111', idLast4: '6211', companyId: 'co1', status: 'active', operationalRoles: ['קשר סמל'],          teamClass: 'כיתה ג', squadId: 'su-g3-c', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's63', name: 'אמיתי הוד',    phone: '0506311111', idLast4: '6311', companyId: 'co1', status: 'active', operationalRoles: ['סמל'],              teamClass: 'כיתה ג', squadId: 'su-g3-c', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's64', name: 'בועז יזרעאלי', phone: '0506411111', idLast4: '6411', companyId: 'co1', status: 'active', operationalRoles: ['חובש'],             teamClass: 'כיתה ג', squadId: 'su-g3-c', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's65', name: 'צבי הראבן',    phone: '0506511111', idLast4: '6511', companyId: 'co1', status: 'active', operationalRoles: ['נגביסט'],           teamClass: 'כיתה ג', squadId: 'su-g3-c', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's66', name: 'אופיר כספי',   phone: '0506611111', idLast4: '6611', companyId: 'co1', status: 'active', operationalRoles: ['רובאי'],            teamClass: 'כיתה ג', squadId: 'su-g3-c', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's67', name: 'יותם הרץ',     phone: '0506711111', idLast4: '6711', companyId: 'co1', status: 'active', operationalRoles: ['רובאי'],            teamClass: 'כיתה ב', squadId: 'su-g3-b', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },

  // ── חפ״ק — CC + DCC as soldiers + 3 more (driver / equipment lead / ops clerk) ─
  // The CC and DCC each have a soldier record so the system can show their
  // personal status, equipment, leaves, etc. "Everyone is first a soldier."
  { id: 's68', name: 'יוסי כהן',     phone: '0501234567', idLast4: '0001', companyId: 'co1', status: 'active', userId: 'u1', operationalRoles: ['מ״פ'],             teamClass: 'חפ״ק', squadId: 'sq-chap-1', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 2 },
  { id: 's69', name: 'דנה לוי',      phone: '0507777666', idLast4: '7777', companyId: 'co1', status: 'active', userId: 'u7', operationalRoles: ['סמ״פ'],           teamClass: 'חפ״ק', squadId: 'sq-chap-1', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's70', name: 'אסף נהג',      phone: '0507011111', idLast4: '7011', companyId: 'co1', status: 'active', operationalRoles: ['נהג', 'אחראי ציוד חפ״ק'], teamClass: 'חפ״ק', squadId: 'sq-chap-1', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1, functionalRoles: ['equipment-lead-chapack'] },
  { id: 's71', name: 'יואב פלדמן',   phone: '0507111111', idLast4: '7111', companyId: 'co1', status: 'active', operationalRoles: ['רחפן'],            teamClass: 'חפ״ק', squadId: 'sq-chap-1', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },
  { id: 's72', name: 'נדב סער',      phone: '0507211111', idLast4: '7211', companyId: 'co1', status: 'active', operationalRoles: ['מש״ק קשר'],         teamClass: 'חפ״ק', squadId: 'sq-chap-1', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1 },

  // ── מפלג — fill out to 6, with configurable functional roles ───────────────
  // functionalRoles is a flag set (kitchen-lead / cleaning-lead / water-lead /
  // driver / equipment-lead / etc.). These are intended to be operator-editable
  // in Phase 6.3.c — not hardcoded to a position.
  { id: 's73', name: 'יואב מורן',    phone: '0507311111', idLast4: '7311', companyId: 'co1', status: 'active', userId: 'u13', operationalRoles: ['סרס״פ'],           teamClass: 'מפלג', squadId: 'su-meflag-1', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1, functionalRoles: ['srasap'] },
  { id: 's74', name: 'איתן בן ארי',  phone: '0507411111', idLast4: '7411', companyId: 'co1', status: 'active', operationalRoles: ['אחראי מטבח'],      teamClass: 'מפלג', squadId: 'su-meflag-2', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1, functionalRoles: ['kitchen-lead'] },
  { id: 's75', name: 'אוהד ברקאי',   phone: '0507511111', idLast4: '7511', companyId: 'co1', status: 'active', operationalRoles: ['אחראי מים', 'נהג'], teamClass: 'מפלג', squadId: 'su-meflag-2', currentStatus: 'in-base', statusSetAt: TWO_DAYS_AGO, availability: true, availabilityNotes: [], currentLoad: 1, functionalRoles: ['water-lead', 'driver'] },

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
    // BOOTSTRAP CC — registered before any roster existed.
    // Phase 6.3.a: now also bound to soldier s68 (חפ״ק), so the CC
    // appears in the active roster like any other soldier.
    id: 'u1', name: 'יוסי כהן', role: 'companyCommander',
    phone: '0501234567', idLast4: '0001', password: 'Test@1234',
    operationalRoles: ['מ״פ'], teamClass: 'חפ״ק',
    companyId: 'co1',
    platoonId: 'g-chapack', commandedPlatoonId: 'g-chapack', squadId: 'sq-chap-1',
    soldierProfileId: 's68',
    createdAt: '2024-04-20T08:00:00',
  },
  {
    // Claimed PC slot — מ"מ of מחלקה 1 (roster soldier s2)
    id: 'u2', name: 'רוני שמש', role: 'platoonCommander',
    phone: '0502222111', idLast4: '2222', password: 'Test@1234',
    platoonId: 'g1', commandedPlatoonId: 'g1', companyId: 'co1',
    soldierProfileId: 's2',
    operationalRoles: ['מ״מ', 'קשר מ״מ'], teamClass: 'כיתה א',
    createdAt: '2024-04-21T09:00:00',
  },
  {
    // Claimed soldier slot s1
    id: 'u3', name: 'משה ישראלי', role: 'soldier',
    phone: '0509876543', idLast4: '1111', password: 'Test@1234',
    platoonId: 'g1', companyId: 'co1', squadId: 'su-g1-a',
    soldierProfileId: 's1',
    operationalRoles: ['קלע', 'חובש'], teamClass: 'כיתה א',
    createdAt: '2024-05-08T09:00:00',
  },
  {
    // Claimed PS slot — סמל of מחלקה 1 (roster soldier s9)
    id: 'u5', name: 'ניסים דהן', role: 'platoonSergeant',
    phone: '0509999888', idLast4: '9999', password: 'Test@1234',
    platoonId: 'g1', commandedPlatoonId: 'g1', companyId: 'co1',
    soldierProfileId: 's9',
    operationalRoles: ['סמל', 'חובש'], teamClass: 'כיתה א',
    createdAt: '2024-04-21T09:30:00',
  },
  {
    // רס״פ — מפקד המפלג. Base role is still 'soldier' so route guards for
    // company-tier surfaces still reject him, but he carries
    // `commandedPlatoonId: 'g-meflag'` so platoon-level helpers
    // (canManagePlatoon, scope-aware approvals) recognise him as the
    // logistics platoon commander. The functional-role tag 'רס״פ' in
    // operationalRoles unlocks logistics-wide writes via canManageEquipment.
    id: 'u6', name: 'אבי כהן', role: 'soldier',
    phone: '0502323232', idLast4: '2323', password: 'Test@1234',
    platoonId: 'g-meflag', commandedPlatoonId: 'g-meflag',
    companyId: 'co1', squadId: 'su-meflag-1',
    soldierProfileId: 's23',
    operationalRoles: ['רס״פ'], teamClass: 'מפלג',
    createdAt: '2024-04-22T08:00:00',
  },
  {
    // סמ"פ — Deputy CC. Same company powers as CC except can't grant
    // delegations. Phase 6.3.a: bound to soldier s69 in חפ״ק.
    id: 'u7', name: 'דנה לוי', role: 'deputyCompanyCommander',
    phone: '0507777666', idLast4: '7777', password: 'Test@1234',
    companyId: 'co1',
    platoonId: 'g-chapack', squadId: 'sq-chap-1',
    soldierProfileId: 's69',
    operationalRoles: ['סמ״פ'], teamClass: 'חפ״ק',
    createdAt: '2024-04-20T08:30:00',
  },
  {
    // שליש — administrative officer (functional role on a base soldier).
    // Bound to roster soldier s24 (רון אביב). The Shalish gets Report-1
    // read access + standard soldier capabilities (profile, leave request,
    // damage report). Crucially NOT a commander role — base UserRole stays
    // 'soldier' so route guards keep CC-only screens out of reach.
    id: 'u8', name: 'רון אביב', role: 'soldier',
    phone: '0502424242', idLast4: '2424', password: 'Test@1234',
    platoonId: 'g-meflag', companyId: 'co1', squadId: 'su-meflag-1',
    soldierProfileId: 's24',
    operationalRoles: ['שליש'], teamClass: 'מפלג',
    createdAt: '2024-04-22T09:00:00',
  },
  {
    // PC of מחלקה 2 (s14 עומר בר).
    id: 'u9', name: 'עומר בר', role: 'platoonCommander',
    phone: '0501414141', idLast4: '1414', password: 'Test@1234',
    platoonId: 'g2', commandedPlatoonId: 'g2', companyId: 'co1', squadId: 'su-g2-a',
    soldierProfileId: 's14',
    operationalRoles: ['מ״מ'], teamClass: 'כיתה א',
    createdAt: '2024-04-21T09:00:00',
  },
  {
    // PC of מחלקה 3 (s19 יואב סער).
    id: 'u10', name: 'יואב סער', role: 'platoonCommander',
    phone: '0501919191', idLast4: '1919', password: 'Test@1234',
    platoonId: 'g3', commandedPlatoonId: 'g3', companyId: 'co1', squadId: 'su-g3-a',
    soldierProfileId: 's19',
    operationalRoles: ['מ״מ'], teamClass: 'כיתה א',
    createdAt: '2024-04-21T09:00:00',
  },
  {
    // PS of מחלקה 2 (s18 אייל גלעד).
    id: 'u11', name: 'אייל גלעד', role: 'platoonSergeant',
    phone: '0501818181', idLast4: '1818', password: 'Test@1234',
    platoonId: 'g2', commandedPlatoonId: 'g2', companyId: 'co1', squadId: 'su-g2-c',
    soldierProfileId: 's18',
    operationalRoles: ['סמל'], teamClass: 'כיתה ג',
    createdAt: '2024-04-21T09:30:00',
  },
  {
    // PS of מחלקה 3 (s21 שגיא ברנר).
    id: 'u12', name: 'שגיא ברנר', role: 'platoonSergeant',
    phone: '0502121212', idLast4: '2121', password: 'Test@1234',
    platoonId: 'g3', commandedPlatoonId: 'g3', companyId: 'co1', squadId: 'su-g3-b',
    soldierProfileId: 's21',
    operationalRoles: ['סמל'], teamClass: 'כיתה ב',
    createdAt: '2024-04-21T09:30:00',
  },
  {
    // סרס״פ — Deputy logistics chief (functional role on base soldier).
    // Bound to soldier s73 (יואב מורן) in מפלג.
    id: 'u13', name: 'יואב מורן', role: 'soldier',
    phone: '0507311111', idLast4: '7311', password: 'Test@1234',
    platoonId: 'g-meflag', companyId: 'co1', squadId: 'su-meflag-1',
    soldierProfileId: 's73',
    operationalRoles: ['סרס״פ'], teamClass: 'מפלג',
    createdAt: '2024-04-22T08:30:00',
  },
  {
    // חייל 2 — bound to soldier s3 (אורן פרץ, נגביסט, מחלקה 1 כיתה ב).
    // Distinct from u3 (חייל 1): high currentLoad (3) so the engine
    // de-prioritizes him AND he has both a pending leave request and an
    // open equipment gap — surfaces a different soldier-side narrative.
    id: 'u14', name: 'אורן פרץ', role: 'soldier',
    phone: '0503333222', idLast4: '3333', password: 'Test@1234',
    platoonId: 'g1', companyId: 'co1', squadId: 'su-g1-b',
    soldierProfileId: 's3',
    operationalRoles: ['נגביסט'], teamClass: 'כיתה ב',
    createdAt: '2024-05-08T09:00:00',
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
    // Pending request from u14 (חייל 2). When u14 logs in he sees this
    // in "הבקשות שלי" with status pending. When his PC (u2) logs in he
    // sees it in the approvable queue.
    id: 'lr-u14-pending',
    soldierId: 's3', soldierName: 'אורן פרץ',
    soldierTeamClass: 'כיתה ב', soldierSquadId: 'su-g1-b', soldierSquadName: 'כיתה ב',
    startDate: '2026-05-21', startTime: '07:00',
    endDate:   '2026-05-23', endTime:   '20:00',
    reason: 'יום הולדת לאחות',
    status: 'pending',
    submittedAt: '2026-05-14T18:30:00',
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

// ─── Platoons (מחלקות + חפ"ק + מפלג) ────────────────────────────────────────
//
// Real company structure:
//   חפ"ק           — small command attachment around the מ"פ / סמ"פ
//   מחלקה 1/2/3   — combat platoons, each with a מ"מ + סמל + כיתות
//   מפלג           — logistics platoon, commanded by the רס"פ

export const mockPlatoons: Platoon[] = [
  {
    id: 'g-chapack', name: 'חפ״ק', unitName: 'גדוד 9203', code: 'UNIT-CHAP',
    memberIds: ['u1', 'u7'],
    platoonCommander: 'יוסי כהן',
    availableRoles: ['קשר מ״מ', 'מש״ק קשר', 'מ״פ', 'סמ״פ', 'רחפן', 'נהג', 'אחראי ציוד חפ״ק'],
    size: 8,
    companyId: 'co1',
    platoonCommanderUserId: 'u1',
    squadIds: ['sq-chap-1'],
    kind: 'forward-command',
    followsCompanyLeaveRotation: false,
    minSoldiersOnBase: 4,
  },
  {
    id: 'g1', name: 'מחלקה 1', unitName: 'גדוד 9203', code: 'UNIT-M1',
    memberIds: ['u2', 'u3', 'u5'],
    platoonCommander: 'רוני שמש', platoonSergeant: 'ניסים דהן',
    availableRoles: ['קלע', 'חובש', 'נגביסט', 'נגביסט חוד', 'קלע חוד', 'מטוליסט', 'מאגיסט', 'קשר מ״מ', 'קשר סמל', 'רובאי', 'רחפן', 'מ״מ', 'סמל', 'מ״כ'],
    size: 20,
    companyId: 'co1',
    platoonCommanderUserId: 'u2',
    platoonSergeantUserId: 'u5',
    squadIds: ['su-g1-a', 'su-g1-b', 'su-g1-c'],
    kind: 'combat',
    followsCompanyLeaveRotation: true,
    minSoldiersOnBase: 12,
  },
  {
    id: 'g2', name: 'מחלקה 2', unitName: 'גדוד 9203', code: 'UNIT-M2',
    memberIds: [],
    platoonCommander: 'עומר בר', platoonSergeant: 'אייל גלעד',
    availableRoles: ['קלע', 'חובש', 'נגביסט', 'נגביסט חוד', 'קלע חוד', 'מטוליסט', 'מאגיסט', 'קשר מ״מ', 'קשר סמל', 'רובאי', 'מ״מ', 'סמל', 'מ״כ'],
    size: 20,
    companyId: 'co1',
    squadIds: ['su-g2-a', 'su-g2-b', 'su-g2-c'],
    kind: 'combat',
    followsCompanyLeaveRotation: true,
    minSoldiersOnBase: 12,
  },
  {
    id: 'g3', name: 'מחלקה 3', unitName: 'גדוד 9203', code: 'UNIT-M3',
    memberIds: [],
    platoonCommander: 'יואב סער', platoonSergeant: 'שגיא ברנר',
    availableRoles: ['קלע', 'חובש', 'נגביסט', 'נגביסט חוד', 'קלע חוד', 'מטוליסט', 'מאגיסט', 'קשר מ״מ', 'קשר סמל', 'רובאי', 'מ״מ', 'סמל', 'מ״כ'],
    size: 20,
    companyId: 'co1',
    squadIds: ['su-g3-a', 'su-g3-b', 'su-g3-c'],
    kind: 'combat',
    followsCompanyLeaveRotation: true,
    minSoldiersOnBase: 12,
  },
  {
    id: 'g-meflag', name: 'מפלג', unitName: 'גדוד 9203', code: 'UNIT-MEF',
    memberIds: ['u6', 'u8'],
    platoonCommander: 'אבי כהן',
    availableRoles: ['רס״פ', 'סרס״פ', 'שליש', 'מש״ק קשר', 'נהג', 'אחראי מטבח', 'אחראי מים', 'אחראי ציוד'],
    size: 6,
    companyId: 'co1',
    platoonCommanderUserId: 'u6',
    squadIds: ['su-meflag-1', 'su-meflag-2'],
    kind: 'logistics',
    followsCompanyLeaveRotation: false,
    minSoldiersOnBase: 3,
  },
];

// ─── Squads / כיתות ──────────────────────────────────────────────────────────
//
// Squad names follow real operational convention: combat platoons use
// כיתה א / ב / ג; non-combat platoons (חפ"ק, מפלג) use functional names
// that fit their work (e.g. צוות חפ"ק / לוגיסטיקה / אספקה).

export const mockSquads: Squad[] = [
  // חפ"ק — CC + DCC + driver + comms + drone operator (8 with s5/s12/s13)
  { id: 'sq-chap-1',   platoonId: 'g-chapack', name: 'צוות חפ״ק',   soldierIds: ['s5', 's12', 's13', 's68', 's69', 's70', 's71', 's72'] },

  // מחלקה 1
  { id: 'su-g1-a',     platoonId: 'g1',        name: 'כיתה א',      soldierIds: ['s1', 's2', 's9', 's26', 's28', 's29', 's36'] },
  { id: 'su-g1-b',     platoonId: 'g1',        name: 'כיתה ב',      soldierIds: ['s3', 's4', 's6', 's27', 's30', 's31', 's32'] },
  { id: 'su-g1-c',     platoonId: 'g1',        name: 'כיתה ג',      soldierIds: ['s7', 's8', 's10', 's33', 's34', 's35'] },

  // מחלקה 2
  { id: 'su-g2-a',     platoonId: 'g2',        name: 'כיתה א',      soldierIds: ['s14', 's15', 's37', 's38', 's39', 's40', 's41'] },
  { id: 'su-g2-b',     platoonId: 'g2',        name: 'כיתה ב',      soldierIds: ['s16', 's17', 's42', 's43', 's44', 's45', 's51'] },
  { id: 'su-g2-c',     platoonId: 'g2',        name: 'כיתה ג',      soldierIds: ['s18', 's46', 's47', 's48', 's49', 's50'] },

  // מחלקה 3 — added su-g3-c (previously missing — soldiers spread across a/b)
  { id: 'su-g3-a',     platoonId: 'g3',        name: 'כיתה א',      soldierIds: ['s19', 's20', 's52', 's53', 's54', 's55', 's56'] },
  { id: 'su-g3-b',     platoonId: 'g3',        name: 'כיתה ב',      soldierIds: ['s21', 's22', 's57', 's58', 's59', 's60', 's67'] },
  { id: 'su-g3-c',     platoonId: 'g3',        name: 'כיתה ג',      soldierIds: ['s61', 's62', 's63', 's64', 's65', 's66'] },

  // מפלג — functional squads, flexible naming
  { id: 'su-meflag-1', platoonId: 'g-meflag',  name: 'לוגיסטיקה',   soldierIds: ['s23', 's24', 's73'] },
  { id: 'su-meflag-2', platoonId: 'g-meflag',  name: 'אספקה',       soldierIds: ['s25', 's74', 's75'] },
];

// ─── Companies / פלוגות ──────────────────────────────────────────────────────

export const mockCompanies: Company[] = [
  {
    id: 'co1',
    name: 'פלוגה ב',
    unitName: 'גדוד 9203',
    commanderUserId: 'u1',
    deputyCommanderUserId: undefined,
    platoonIds: ['g-chapack', 'g1', 'g2', 'g3', 'g-meflag'],
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
    description: 'שמירה היקפית רציפה. סבב יומי בין מחלקה 1 למחלקה 2.',
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

// ─── Slot assignments (operator-confirmed staffing) ─────────────────────
//
// Persisted record of which soldiers a commander assigned to a specific
// materialized slot. Keyed by `slotId` (the deterministic id produced by
// materializeWeek: `mat-<missionId>-<isoDate>-<windowIdx>`). When present,
// the materializer USES these assignments verbatim instead of falling
// back to its auto-pick heuristic. Seeded empty — populated at runtime
// when a PC opens StaffingSheet and confirms a roster.

export const mockAssignments: Assignment[] = [];

// ─── Slot Operational State (Phase 6.9) ────────────────────────────────
// Per-slot operator manipulations (locks, excuses, forced rationale,
// notes) that survive any engine recompute. Seeded empty — fills at
// runtime via the operations panel on MissionDetailPage.
export const mockSlotOperationalState: SlotOperationalState[] = [];

// ─── Checklists (Phase 6.2.c) ──────────────────────────────────────────
// One canonical "basic gear" template seeded so PC can start a צל״ם
// without first authoring a template. The catalog can grow at runtime
// via a ChecklistComposer surface (future slice).

export const mockChecklistTemplates: ChecklistTemplate[] = [
  {
    id: 'tpl-basic',
    companyId: 'co1',
    name: 'צל״ם בסיסי',
    category: 'full',
    items: [
      { key: 'helmet',   label: 'קסדה',           level: 'critical' },
      { key: 'vest',     label: 'ווסט',           level: 'critical' },
      { key: 'weapon',   label: 'נשק אישי',       level: 'critical' },
      { key: 'mags',     label: 'מחסניות',        expectedCount: 3, level: 'critical' },
      { key: 'water',    label: 'מימייה מלאה',    level: 'required' },
      { key: 'comms',    label: 'מכשיר קשר',      level: 'required' },
      { key: 'medkit',   label: 'תיק חובש (אם רלוונטי)', level: 'soft' },
    ],
    createdAt: '2026-05-15T07:00:00.000Z',
  },
];

export const mockChecklistRuns: ChecklistRun[] = [];
export const mockChecklistInstances: ChecklistInstance[] = [];

// ─── Operational Leave Management seed (Phase 6.10) ────────────────────
//
// A simple 30-day rotation seeded forward from today: g1 home days
// 4-7, g2 home days 11-14, g3 home days 18-21. Combat platoons only —
// CHAPAK / MAFLAG don't have a unit-level rotation by default.

const _LEAVE_SEED_TODAY = new Date();
_LEAVE_SEED_TODAY.setHours(0, 0, 0, 0);

function _leaveDate(offsetDays: number): string {
  const d = new Date(_LEAVE_SEED_TODAY);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function _platoonRange(platoonId: string, fromOffset: number, toOffset: number): PlatoonLeaveDay[] {
  const out: PlatoonLeaveDay[] = [];
  for (let i = fromOffset; i <= toOffset; i++) {
    out.push({
      dateIso: _leaveDate(i),
      platoonId,
      status: 'home',
      updatedAt: '2026-05-15T08:00:00.000Z',
      updatedByUserId: 'u1',
    });
  }
  return out;
}

export const mockPlatoonLeaveDays: PlatoonLeaveDay[] = [
  ..._platoonRange('g1', 4, 7),
  ..._platoonRange('g2', 11, 14),
  ..._platoonRange('g3', 18, 21),
];

export const mockCompanyLeavePolicy: CompanyLeavePolicy = {
  companyId: 'co1',
  maxPlatoonsHome: 1,
  homeStintDays: 4,
  minBaseGapDays: 7,
  mode: 'one-at-a-time',
  updatedAt: '2026-05-15T08:00:00.000Z',
  updatedByUserId: 'u1',
  // Phase 7.3 wizard extensions — pre-seeded defaults so the wizard
  // has reasonable starting values for new companies.
  bodySeparation: 'platoons-together',
  rotationPattern: '8-7',
  noWeekendTransition: true,
  minConsecutiveBaseDays: 3,
  minConsecutiveHomeDays: 3,
  allowSplitByPlatoon: false,
};

// Phase 7.3 — Company blocked dates seed. Two examples covering the
// most common operational shapes (line-up day + a drill).
export const mockCompanyBlockedDates: CompanyBlockedDate[] = [
  {
    id: 'cbd-line-up',
    companyId: 'co1',
    dateIso: '2026-05-20',
    kind: 'line-up',
    reason: 'עליה לקו — תדריך פלוגתי, חתימת ציוד',
    requireAllInBase: true,
    addToCalendar: true,
    blockLeaveRequests: true,
    countsForBalance: false,
    createdAt: '2026-05-10T08:00:00.000Z',
    createdByUserId: 'u1',
  },
  {
    id: 'cbd-drill',
    companyId: 'co1',
    dateIso: '2026-05-28',
    kind: 'drill',
    reason: 'תרגיל פלוגתי',
    requireAllInBase: true,
    addToCalendar: true,
    blockLeaveRequests: true,
    countsForBalance: true,
    createdAt: '2026-05-10T08:00:00.000Z',
    createdByUserId: 'u1',
  },
];

// Coverage rules for non-rotating units (חפ״ק / מפלג). Seeded with
// reasonable defaults — operator can edit/add via the page.
export const mockCompanyCoverageRules: CompanyCoverageRuleSet = {
  companyId: 'co1',
  rules: [
    {
      id: 'cr-chap-min',
      kind: 'min-count-in-platoon',
      label: 'מינימום 3 אנשי חפ״ק בבסיס',
      platoonId: 'g-chapack',
      min: 3,
    },
    {
      id: 'cr-meflag-min',
      kind: 'min-count-in-platoon',
      label: 'מינימום 2 אנשי מפלג בבסיס',
      platoonId: 'g-meflag',
      min: 2,
    },
    {
      id: 'cr-driver-min',
      kind: 'min-with-functional-role',
      label: 'מינימום נהג אחד',
      functionalRole: 'driver',
      min: 1,
    },
    {
      id: 'cr-comms-min',
      kind: 'min-with-functional-role',
      label: 'מינימום מש״ק קשר אחד',
      functionalRole: 'mashak-kesher',
      min: 1,
    },
    {
      id: 'cr-equip-chap',
      kind: 'min-with-functional-role',
      label: 'אחראי ציוד חפ״ק חייב להיות בבסיס',
      functionalRole: 'equipment-lead-chapack',
      min: 1,
    },
  ],
  updatedAt: '2026-05-15T08:00:00.000Z',
  updatedByUserId: 'u1',
};

export const mockSoldierLeaveOverrides: SoldierLeaveOverride[] = [];

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

// §20 — default seeded PKALs. These mirror the canonical company kit
// roster: each command position + the core specialist roles. The kits
// are intentionally sparse — operators add items as the company's gear
// gets catalogued. Names are stable so screens / quotas / reports can
// reference them by id.
export const mockPkalim: Pkal[] = [
  {
    id:        'pkal-mafaz',
    companyId: 'co1',
    name:      'פק״ל מ״פ',
    role:      'מ״פ',
    description: 'ערכת מפקד פלוגה — קשר, מפה, תיק פיקוד',
    items: [
      { id: 'pi-mafaz-1', equipmentItemId: 'eq-radio-cmd', itemName: 'מכשיר קשר מ״פ', quantity: 1 },
      { id: 'pi-mafaz-2', itemName: 'מפה אופרטיבית',           quantity: 1 },
      { id: 'pi-mafaz-3', itemName: 'תיק פיקוד',               quantity: 1 },
    ],
    createdBy: 'u-cc',
    createdAt: SEED_CREATED,
    updatedAt: SEED_CREATED,
  },
  {
    id:        'pkal-mm',
    companyId: 'co1',
    name:      'פק״ל מ״מ',
    role:      'מ״מ',
    description: 'ערכת מפקד מחלקה — קשר, מפה, פנקס',
    items: [
      { id: 'pi-mm-1', equipmentItemId: 'eq-radio-cmd', itemName: 'מכשיר קשר מ״מ', quantity: 1 },
      { id: 'pi-mm-2', itemName: 'מפה',                      quantity: 1 },
      { id: 'pi-mm-3', itemName: 'פנקס מפקד',                 quantity: 1 },
    ],
    createdBy: 'u-cc',
    createdAt: SEED_CREATED,
    updatedAt: SEED_CREATED,
  },
  {
    id:        'pkal-samal',
    companyId: 'co1',
    name:      'פק״ל סמל',
    role:      'סמל',
    description: 'ערכת סמל מחלקה — לוגיסטיקה + קשר',
    items: [
      { id: 'pi-samal-1', equipmentItemId: 'eq-radio-cmd', itemName: 'מכשיר קשר', quantity: 1 },
      { id: 'pi-samal-2', itemName: 'פנקס סמל',               quantity: 1 },
    ],
    createdBy: 'u-cc',
    createdAt: SEED_CREATED,
    updatedAt: SEED_CREATED,
  },
  {
    id:        'pkal-mk',
    companyId: 'co1',
    name:      'פק״ל מ״כ',
    role:      'מ״כ',
    description: 'ערכת מפקד כיתה',
    items: [
      { id: 'pi-mk-1', itemName: 'מכשיר קשר רשת מחלקה', quantity: 1 },
      { id: 'pi-mk-2', itemName: 'פנקס מ״כ',             quantity: 1 },
    ],
    createdBy: 'u-cc',
    createdAt: SEED_CREATED,
    updatedAt: SEED_CREATED,
  },
  {
    id:               'pkal-chovesh',
    companyId:        'co1',
    name:             'פק״ל חובש',
    role:             'חובש',
    qualificationId:  'q-tactical-medic',
    description: 'תיק חובש קרבי — תרופות + ציוד החייאה',
    items: [
      { id: 'pi-ch-1', itemName: 'תיק חובש מלא', quantity: 1 },
      { id: 'pi-ch-2', itemName: 'חוסם עורקים',   quantity: 4 },
      { id: 'pi-ch-3', itemName: 'נר',            quantity: 2 },
    ],
    createdBy: 'u-cc',
    createdAt: SEED_CREATED,
    updatedAt: SEED_CREATED,
  },
  {
    id:        'pkal-kasher-mm',
    companyId: 'co1',
    name:      'פק״ל קשר מ״מ',
    role:      'קשר מ״מ',
    items: [
      { id: 'pi-km-1', equipmentItemId: 'eq-radio-cmd', itemName: 'מכשיר קשר רשת מ״מ', quantity: 1 },
      { id: 'pi-km-2', itemName: 'סוללה רזרבית',       quantity: 2 },
      { id: 'pi-km-3', itemName: 'אנטנה ארוכה',         quantity: 1 },
    ],
    createdBy: 'u-cc',
    createdAt: SEED_CREATED,
    updatedAt: SEED_CREATED,
  },
  {
    id:               'pkal-drone',
    companyId:        'co1',
    name:             'פק״ל רחפן',
    role:             'רחפן',
    qualificationId:  'q-drone-op',
    items: [
      { id: 'pi-dr-1', equipmentItemId: 'eq-drone-mvk', itemName: 'רחפן מאוויק 3', quantity: 1 },
      { id: 'pi-dr-2', itemName: 'סוללה רזרבית רחפן',      quantity: 2 },
    ],
    createdBy: 'u-cc',
    createdAt: SEED_CREATED,
    updatedAt: SEED_CREATED,
  },
  {
    id:        'pkal-negbist',
    companyId: 'co1',
    name:      'פק״ל נגביסט',
    role:      'נגביסט',
    items: [
      { id: 'pi-ng-1', itemName: 'נגב',         quantity: 1 },
      { id: 'pi-ng-2', itemName: 'מחסניות נגב',  quantity: 5 },
    ],
    createdBy: 'u-cc',
    createdAt: SEED_CREATED,
    updatedAt: SEED_CREATED,
  },
];

// §21 — example quotas. The CC requires one מ״מ-PKAL holder per platoon,
// one חובש-PKAL per platoon, and at least three at company level. Demo
// numbers are intentionally tight so the gap analysis lights up.
export const mockPkalQuotas: PkalQuota[] = [
  {
    id: 'pq-mm-p1',  companyId: 'co1', pkalId: 'pkal-mm',
    scope: { kind: 'platoon', platoonId: 'p1' }, required: 1,
    createdAt: SEED_CREATED, updatedAt: SEED_CREATED,
  },
  {
    id: 'pq-mm-p2',  companyId: 'co1', pkalId: 'pkal-mm',
    scope: { kind: 'platoon', platoonId: 'p2' }, required: 1,
    createdAt: SEED_CREATED, updatedAt: SEED_CREATED,
  },
  {
    id: 'pq-mm-p3',  companyId: 'co1', pkalId: 'pkal-mm',
    scope: { kind: 'platoon', platoonId: 'p3' }, required: 1,
    createdAt: SEED_CREATED, updatedAt: SEED_CREATED,
  },
  {
    id: 'pq-ch-co',  companyId: 'co1', pkalId: 'pkal-chovesh',
    scope: { kind: 'company' }, required: 3,
    createdAt: SEED_CREATED, updatedAt: SEED_CREATED,
  },
  {
    id: 'pq-kasher-co', companyId: 'co1', pkalId: 'pkal-kasher-mm',
    scope: { kind: 'company' }, required: 3,
    createdAt: SEED_CREATED, updatedAt: SEED_CREATED,
  },
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
    // 24/7 continuous standing guard — 2h on station, 4h cycle off.
    // First 2h of the off-window is standby (כוננות), then 2h sleep.
    cycleProfile: {
      guardMinutes: 120,
      restMinutes:  240,
      standbyMinutes: 120,
    },
    overlapPolicy: {
      // While actively standing guard — no other duty allowed.
      activeOverlap: [],
      // During rest from guard — can be pulled into passive readiness
      // or admin; never another active patrol or ambush.
      restOverlap:   ['readiness', 'admin'],
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
    orderId:   'order-current',
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
    overlapPolicy: {
      // Ambush mission — nothing else while active. Rest window is
      // strict recovery; only admin tasks tolerated.
      activeOverlap: [],
      restOverlap:   ['admin'],
    },
    qualifications: [
      { qualificationId: 'q-tactical-medic', count: 1 },
    ],
    equipment: [
      { equipmentItemId: 'eq-radio-cmd', count: 1, perSoldier: false },
    ],
    logisticsAlerts: [
      {
        itemName: 'רחפן מאוויק',
        urgency:  'medium',
        note:     'נדרש למחלקה 2 לסיור לילה — חסר בציוד הפלוגה',
        raisedAt: SEED_CREATED,
        raisedBy: 'u-cc',
      },
    ],
    conflictsWith:  [],
    canOverlapWith: [],
    pairings:       [],
    squadPolicy:    { mode: 'no-mix' },
    requiresDailyConfirmation: true,
    status:    'active',
    orderId:   'order-current',
    createdAt: SEED_CREATED,
  },
  // Phase 6.3.a — missions for g2 and g3 so every PC in the demo has
  // visible work (and a slot to staff in StaffingSheet).
  {
    id:               'mi-gate-south',
    companyId:        'co1',
    name:             'שמירה בשער דרום',
    description:      'שמירת בסיס · מחלקה 2 · משמרת יום',
    createdByUserId:  'u-cc',
    ownerRole:        'company',
    assignedPlatoonIds: ['g2'],
    timeModel: { kind: '24-7-continuous' },
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
      rankPolicy: { soldier: 'regular', mk: 'regular', samal: 'regular', mam: 'excluded', officer: 'excluded', custom: 'excluded' },
    },
    rotation: { kind: 'fixed-platoon', platoonId: 'g2' },
    fatigue: { intensity: 'standing-guard', impactsSleep: false, minRestAfterHours: 6, fatigueWeight: 3 },
    cycleProfile: { guardMinutes: 120, restMinutes: 240, standbyMinutes: 120 },
    overlapPolicy: { activeOverlap: [], restOverlap: ['readiness', 'admin'] },
    qualifications: [],
    equipment: [{ equipmentItemId: 'eq-radio-cmd', count: 1, perSoldier: false }],
    conflictsWith:  [],
    canOverlapWith: [],
    pairings:       [],
    squadPolicy:    { mode: 'mix' },
    requiresDailyConfirmation: false,
    status:    'active',
    orderId:   'order-current',
    createdAt: SEED_CREATED,
  },
  {
    id:               'mi-readiness-east',
    companyId:        'co1',
    name:             'כוננות מזרח',
    description:      'כוננות תגובה · מחלקה 3 · יום שלם',
    createdByUserId:  'u-cc',
    ownerRole:        'company',
    assignedPlatoonIds: ['g3'],
    timeModel: {
      kind: 'fixed-hours',
      windows: [
        { startTime: '08:00', endTime: '20:00', shiftDurationMinutes: 720, recurring: 'every-day' },
      ],
    },
    manpower: { kind: 'exact', count: 6 },
    command: {
      fieldCommandRequired:      true,
      commandersPerSlot:         1,
      commanderCountsAsManpower: true,
      rankPolicy: { soldier: 'regular', mk: 'regular', samal: 'commander-only', mam: 'commander-only', officer: 'excluded', custom: 'excluded' },
    },
    rotation: { kind: 'fixed-platoon', platoonId: 'g3' },
    fatigue: { intensity: 'readiness', impactsSleep: false, minRestAfterHours: 8, fatigueWeight: 5 },
    overlapPolicy: { activeOverlap: ['admin'], restOverlap: ['admin', 'readiness'] },
    qualifications: [],
    equipment: [{ equipmentItemId: 'eq-radio-cmd', count: 1, perSoldier: false }],
    conflictsWith:  [],
    canOverlapWith: [],
    pairings:       [],
    squadPolicy:    { mode: 'mix' },
    requiresDailyConfirmation: false,
    status:    'active',
    orderId:   'order-current',
    createdAt: SEED_CREATED,
  },
];

// ─── Operational orders (צווים) ─────────────────────────────────────────────
// The current duty period the company is in. One published order at a time
// is typical; planning/draft orders can be staged ahead.

const orderStart = (() => { const d = new Date(); d.setDate(d.getDate() - 2); return d.toISOString().slice(0, 10); })();
const orderEnd   = (() => { const d = new Date(); d.setDate(d.getDate() + 12); return d.toISOString().slice(0, 10); })();

export const mockOperationalOrders: OperationalOrder[] = [
  {
    id:               'order-current',
    companyId:        'co1',
    name:             'צו מילואים נוכחי',
    startDate:        orderStart,
    endDate:          orderEnd,
    description:      'מילואים שוטף — שמירה היקפית + סיור לילי. גזרה מערבית.',
    status:           'published',
    createdByUserId:  'u1',
    createdAt:        SEED_CREATED,
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
  {
    // Gap reported by u14 (חייל 2 = s3 אורן פרץ). Surfaces on his
    // SoldierDashboard + in /rasap queue + in PS review queue.
    id:                  'eg-2',
    companyId:           'co1',
    reportedByUserId:    'u14',
    reportedBySoldierId: 's3',
    reportedByName:      'אורן פרץ',
    reportedByPlatoonId: 'g1',
    kind:                'missing',
    itemName:            'מימייה',
    description:         'הגיע מהבית בלי מימייה — צריך חדשה',
    status:              'reported',
    createdAt:           todayAt('09:15', 0),
  },
];

// ─── Mission notes — free-text operational extensions ───────────────────────
// Seeded so the demo shows both company-level and platoon-execution notes.

export const mockMissionNotes: MissionNote[] = [
  {
    id:           'mn-1',
    missionId:    'mi-night-patrol',
    scope:        'company',
    authorUserId: 'u-cc',
    authorName:   'מ״פ',
    authorRole:   'companyCommander',
    text:         'לבדוק קשר ושני מטענים נטענים לפני יציאה. החלפה כל שעתיים.',
    createdAt:    SEED_CREATED,
  },
  {
    id:           'mn-2',
    missionId:    'mi-night-patrol',
    scope:        'platoon',
    platoonId:    'g1',
    authorUserId: 'u-pc',
    authorName:   'מ״מ א׳',
    authorRole:   'platoonCommander',
    text:         'כיתה ב תופסת לילה ראשון. ניסים אחראי על קשר.',
    createdAt:    SEED_CREATED,
  },
  {
    id:           'mn-3',
    missionId:    'mi-gate-north',
    scope:        'company',
    authorUserId: 'u-cc',
    authorName:   'מ״פ',
    authorRole:   'companyCommander',
    text:         'לא להכניס למשמרת לילה חיילים שחזרו מהבית באותו יום.',
    createdAt:    SEED_CREATED,
  },
];

// ─── Round-4 entities ─────────────────────────────────────────────────────
// Announcements / Escalations / Leave cycle.
// All scoped to co1 + the current order (order-current).

const dayOffsetIso = (offset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

export const mockAnnouncements: Announcement[] = [
  {
    id:              'ann-pinned-1',
    companyId:       SEED_CO,
    kind:            'operational',
    title:           'בדיקת ציוד גנרל',
    body:            'כל החיילים מתבקשים להתייצב מחר ב-08:30 בהיכון מלא לבדיקת ציוד.',
    startDate:       dayOffsetIso(1),
    endDate:         dayOffsetIso(1),
    startTime:       '08:30',
    audience:        { kind: 'company' },
    showOnCalendar:  true,
    status:          'active',
    pinned:          true,
    createdByUserId: 'u-cc',
    createdByName:   'מ״פ',
    createdAt:       SEED_CREATED,
  },
  {
    id:              'ann-schedule-1',
    companyId:       SEED_CO,
    kind:            'schedule',
    title:           'בריפינג מ״מים',
    body:            'בריפינג מ״מים שבועי בחפ״ק. נוכחות חובה.',
    startDate:       dayOffsetIso(2),
    endDate:         dayOffsetIso(2),
    startTime:       '19:00',
    endTime:         '20:00',
    audience:        { kind: 'operational-roles', operationalRoles: ['מ״מ', 'סמל'] },
    showOnCalendar:  true,
    status:          'active',
    createdByUserId: 'u-cc',
    createdByName:   'מ״פ',
    createdAt:       SEED_CREATED,
  },
  {
    id:              'ann-message-1',
    companyId:       SEED_CO,
    kind:            'message',
    title:           'מקלחות בחפ״ק',
    body:            'מקלחות בחפ״ק לא יפעלו מחר בין 14:00 ל-16:00 בעקבות עבודות אחזקה.',
    startDate:       dayOffsetIso(1),
    endDate:         dayOffsetIso(1),
    audience:        { kind: 'company' },
    showOnCalendar:  false,
    status:          'active',
    createdByUserId: 'u-cc',
    createdByName:   'מ״פ',
    createdAt:       SEED_CREATED,
  },
  {
    id:              'ann-platoon-1',
    companyId:       SEED_CO,
    kind:            'message',
    title:           'נשק נקי בכלי הראשון',
    body:            'תזכורת — מחלקה 1 בודקים שטח. נשק נקי בכלי הראשון.',
    startDate:       dayOffsetIso(0),
    endDate:         dayOffsetIso(3),
    audience:        { kind: 'platoons', platoonIds: ['g1'] },
    showOnCalendar:  false,
    status:          'active',
    createdByUserId: 'u-cc',
    createdByName:   'מ״פ',
    createdAt:       SEED_CREATED,
  },
];

// One historical (closed) escalation, no active. CC can declare a new one.
export const mockEscalationEvents: EscalationEvent[] = [
  {
    id:              'esc-history-1',
    companyId:       SEED_CO,
    reason:          'תרגיל הקפצה מפקדתי',
    location:        'שער ראשי',
    reportTime:      new Date(Date.now() - 6 * 86400000).toISOString(),
    endKind:         'planned',
    endTime:         new Date(Date.now() - 6 * 86400000 + 3 * 3600000).toISOString(),
    audience:        { kind: 'company' },
    instructions:    'התייצבות מלאה. סבב נוכחות בידי המ״מים.',
    requiredEquipment: ['ווסט', 'קסדה', 'נשק אישי'],
    status:          'closed',
    openedByUserId:  'u-cc',
    openedByName:    'מ״פ',
    openedAt:        new Date(Date.now() - 6 * 86400000 - 1800000).toISOString(),
    closedByUserId:  'u-cc',
    closedByName:    'מ״פ',
    closedAt:        new Date(Date.now() - 6 * 86400000 + 4 * 3600000).toISOString(),
    closeReason:     'תרגיל הסתיים בהצלחה',
  },
];

// One active leave cycle anchored to the current order.
// 3 home segments × 3 platoons rolling, plus one base-locked period.
export const mockPlatoonLeaveCycles: PlatoonLeaveCycle[] = [
  {
    id:               'plc-current',
    companyId:        SEED_CO,
    orderId:          'order-current',
    name:             'סבב יציאות — צו נוכחי',
    status:           'published',
    segments: [
      {
        id: 'seg-1', kind: 'home',
        scope: { kind: 'platoon', platoonId: 'g1' },
        startDate: dayOffsetIso(2), endDate: dayOffsetIso(5),
        note: 'מחלקה 1 בבית',
      },
      {
        id: 'seg-2', kind: 'home',
        scope: { kind: 'platoon', platoonId: 'g2' },
        startDate: dayOffsetIso(6), endDate: dayOffsetIso(9),
        note: 'מחלקה 2 בבית',
      },
      {
        id: 'seg-3', kind: 'home',
        scope: { kind: 'platoon', platoonId: 'g3' },
        startDate: dayOffsetIso(10), endDate: dayOffsetIso(13),
        note: 'מחלקה 3 בבית',
      },
      {
        id: 'seg-4', kind: 'base-locked',
        scope: { kind: 'platoon', platoonId: 'g-chapack' },
        startDate: dayOffsetIso(0), endDate: dayOffsetIso(13),
        note: 'חפ״ק חייב נוכחות מלאה כל הצו',
      },
    ],
    createdByUserId:  'u-cc',
    createdAt:        SEED_CREATED,
    publishedAt:      SEED_CREATED,
  },
];

// ─── Logistics rotations (סבבים לוגיסטיים) ────────────────────────────────
// Seed enough rows so the Rasap dashboard surface looks operational
// on first paint.
export const mockLogisticsRotations: LogisticsRotation[] = [
  {
    id: 'lr-1',
    companyId: 'co1',
    kind: 'kitchen',
    title: 'תורנות מטבח — בוקר',
    description: 'הכנת ארוחת בוקר 06:30, הגשה 07:00',
    assignedSoldierIds: ['s24', 's25'],
    startIso: `${dayOffsetIso(0)}T06:00:00`,
    endIso:   `${dayOffsetIso(0)}T09:00:00`,
    status: 'in-progress',
    createdByUserId: 'u6',
    createdByName:   'אבי כהן',
    createdAt:       SEED_CREATED,
  },
  {
    id: 'lr-2',
    companyId: 'co1',
    kind: 'cleaning',
    title: 'ניקיון שירותים פלוגתיים',
    description: 'שירותים ציבוריים + מקלחות',
    assignedSoldierIds: [],
    squadId: 'su-meflag-2',
    startIso: `${dayOffsetIso(0)}T14:00:00`,
    status: 'planned',
    createdByUserId: 'u6',
    createdByName:   'אבי כהן',
    createdAt:       SEED_CREATED,
  },
  {
    id: 'lr-3',
    companyId: 'co1',
    kind: 'container',
    title: 'פריקת מכולה — ציוד חורף',
    description: 'מכולה במגרש 4, הגעה ב־09:30',
    assignedSoldierIds: ['s5', 's6', 's7'],
    startIso: `${dayOffsetIso(1)}T09:30:00`,
    endIso:   `${dayOffsetIso(1)}T12:00:00`,
    status: 'planned',
    createdByUserId: 'u6',
    createdByName:   'אבי כהן',
    createdAt:       SEED_CREATED,
  },
  {
    id: 'lr-4',
    companyId: 'co1',
    kind: 'water',
    title: 'מילוי מיכלי מים — בסיס',
    assignedSoldierIds: ['s24'],
    startIso: `${dayOffsetIso(-1)}T18:00:00`,
    endIso:   `${dayOffsetIso(-1)}T19:30:00`,
    status: 'done',
    createdByUserId: 'u6',
    createdByName:   'אבי כהן',
    createdAt:       SEED_CREATED,
  },
  {
    id: 'lr-5',
    companyId: 'co1',
    kind: 'weapons',
    title: 'ניקוי נשקים פלוגתי',
    description: 'מוכן לשבת — כל החיילים בבסיס',
    assignedSoldierIds: [],
    startIso: `${dayOffsetIso(2)}T16:00:00`,
    status: 'planned',
    createdByUserId: 'u6',
    createdByName:   'אבי כהן',
    createdAt:       SEED_CREATED,
  },
];

// ─── Mission Template Library — seed entries (Phase 7.3) ────────────
//
// A starter library so a fresh demo isn't an empty picker. The
// platoon's repertoire grows from here as the operator creates new
// missions and saves them. Each entry sets archetypeKind + the
// behavioral payload — picking a template applies all of it.

const _tplPolicy = (commanders: CommandRank[]): Record<CommandRank, RankPolicy> => {
  const all: CommandRank[] = ['soldier', 'mk', 'samal', 'mam', 'officer', 'custom'];
  const out = {} as Record<CommandRank, RankPolicy>;
  for (const r of all) {
    if (commanders.includes(r))             out[r] = 'commander-only';
    else if (r === 'soldier' || r === 'mk') out[r] = 'regular';
    else                                    out[r] = 'excluded';
  }
  return out;
};

// ─── Doctrine families — operational groupings ──────────────────────
//
// First-class persisted entities so the library can group, filter, and
// later bundle into Mission Packages without re-keying. The seed below
// is the platoon's STARTER doctrine — operator may rename/archive/
// reorder via the library UI.

export const mockTemplateFamilies: TemplateFamily[] = [
  { id: 'tf-guard-line',    companyId: 'co1', key: 'guard-line',    label: 'קווי שמירה',         icon: '👁',  color: 'olive', order: 10, description: 'שערים, עמדות, מגדלים — שמירה רציפה', createdAt: SEED_CREATED, createdByUserId: 'u1' },
  { id: 'tf-night-patrol',  companyId: 'co1', key: 'night-patrol',  label: 'סיורי לילה',          icon: '🌙',  color: 'info',  order: 20, description: 'סיור הולך-נע בגזרה, שעות החושך',     createdAt: SEED_CREATED, createdByUserId: 'u1' },
  { id: 'tf-vehicle-patrol', companyId: 'co1', key: 'vehicle-patrol', label: 'סיורים רכובים',      icon: '🚗',  color: 'info',  order: 30, description: 'סיור ברכב פלוגתי',                   createdAt: SEED_CREATED, createdByUserId: 'u1' },
  { id: 'tf-readiness',     companyId: 'co1', key: 'readiness',     label: 'כוננויות',             icon: '🛡',  color: 'warn',  order: 40, description: 'תגובה לאירוע — נקודת ריכוז, צוותי תגובה', createdAt: SEED_CREATED, createdByUserId: 'u1' },
  { id: 'tf-chamal',        companyId: 'co1', key: 'chamal',        label: 'חמ״ל',                 icon: '📻',  color: 'muted', order: 50, description: 'משמרות חמ״ל פלוגתי / קשר',           createdAt: SEED_CREATED, createdByUserId: 'u1' },
  { id: 'tf-chpk',          companyId: 'co1', key: 'chpk',          label: 'חפ״ק',                 icon: '🎯',  color: 'muted', order: 60, description: 'חמ״ל מבצעי — הרכב חפ״ק',              createdAt: SEED_CREATED, createdByUserId: 'u1' },
  { id: 'tf-logistics',     companyId: 'co1', key: 'logistics',     label: 'לוגיסטיקה',            icon: '📦',  color: 'muted', order: 70, description: 'סבבי לוגיסטיקה ושינוע',              createdAt: SEED_CREATED, createdByUserId: 'u1' },
  { id: 'tf-duties',        companyId: 'co1', key: 'duties',        label: 'תורנויות',             icon: '🧹',  color: 'muted', order: 80, description: 'מטבח, ניקיון, חמ״ל, שמירה פלוגתית', createdAt: SEED_CREATED, createdByUserId: 'u1' },
  { id: 'tf-emergency',     companyId: 'co1', key: 'emergency',     label: 'אירועי חירום',         icon: '⚠',  color: 'alert', order: 90, description: 'נוהלי תגובה לאירועים חריגים',        createdAt: SEED_CREATED, createdByUserId: 'u1' },
  { id: 'tf-one-time-op',   companyId: 'co1', key: 'one-time-op',   label: 'מבצעים חד פעמיים',    icon: '🎯',  color: 'alert', order: 100, description: 'משימות עם חלון זמן ספציפי',         createdAt: SEED_CREATED, createdByUserId: 'u1' },
];

export const mockMissionTemplates: MissionTemplate[] = [
  // ── שמירות ──────────────────────────────────────────────────────
  {
    id: 'mt-shg', companyId: 'co1',
    familyId: 'tf-guard-line',
    name: 'שמירה בש״ג',
    description: 'שער ראשי — שתי משמרות יום, שלוש לילה',
    category: 'שמירות',
    isFavorite: true,
    usageCount: 12,
    createdAt: SEED_CREATED, createdByUserId: 'u1',
    payload: {
      archetypeKind: 'static-guard',
      timeModel: { kind: '24-7-continuous' },
      manpower: {
        kind: 'window-varies',
        windows: [
          { label: 'day',   from: '06:00', to: '22:00', spec: { kind: 'exact', count: 2 } },
          { label: 'night', from: '22:00', to: '06:00', spec: { kind: 'exact', count: 3 } },
        ],
      },
      command: { fieldCommandRequired: false, commandersPerSlot: 0, commanderCountsAsManpower: false, rankPolicy: _tplPolicy([]) },
      rotation: { kind: 'rotate-platoons', period: 'weekly' },
      fatigue:  { intensity: 'standing-guard', impactsSleep: false, minRestAfterHours: 6, fatigueWeight: 3 },
      dayNightProfile: { dayStartTime: '06:00', nightStartTime: '22:00', dayShiftDurationMinutes: 120, nightShiftDurationMinutes: 180 },
      allowPCOverride: true, shiftDurationLocked: false,
      qualifications: [], equipment: [], squadPolicy: { mode: 'mix' }, pairings: [], requiresDailyConfirmation: false,
      rallyPoint: 'שער ראשי — ש״ג',
    },
  },
  {
    id: 'mt-static-guard-position', companyId: 'co1',
    familyId: 'tf-guard-line',
    name: 'שמירה בעמדה',
    description: 'עמדה היקפית — חייל אחד, משמרת רגילה',
    category: 'שמירות',
    isFavorite: false,
    usageCount: 5,
    createdAt: SEED_CREATED, createdByUserId: 'u1',
    payload: {
      archetypeKind: 'static-guard',
      timeModel: { kind: '24-7-continuous' },
      manpower: { kind: 'exact', count: 1 },
      command:  { fieldCommandRequired: false, commandersPerSlot: 0, commanderCountsAsManpower: false, rankPolicy: _tplPolicy([]) },
      rotation: { kind: 'rotate-platoons', period: 'daily' },
      fatigue:  { intensity: 'standing-guard', impactsSleep: false, minRestAfterHours: 6, fatigueWeight: 3 },
      dayNightProfile: { dayStartTime: '06:00', nightStartTime: '22:00', dayShiftDurationMinutes: 180, nightShiftDurationMinutes: 180 },
      allowPCOverride: true, shiftDurationLocked: false,
      qualifications: [], equipment: [], squadPolicy: { mode: 'mix' }, pairings: [], requiresDailyConfirmation: false,
      rallyPoint: 'עמדה היקפית',
    },
  },
  // ── סיורים ──────────────────────────────────────────────────────
  {
    id: 'mt-night-patrol', companyId: 'co1',
    familyId: 'tf-night-patrol',
    name: 'סיור לילה',
    description: 'סיור הולך-נע בגזרה — 22:00–04:00, רביעייה',
    category: 'סיורים',
    isFavorite: true,
    usageCount: 8,
    createdAt: SEED_CREATED, createdByUserId: 'u1',
    payload: {
      archetypeKind: 'patrol',
      timeModel: { kind: 'fixed-hours', windows: [{ startTime: '22:00', endTime: '04:00', shiftDurationMinutes: 360, recurring: 'every-day' }] },
      manpower: { kind: 'exact', count: 4 },
      command:  { fieldCommandRequired: true, commandersPerSlot: 1, commanderCountsAsManpower: true, rankPolicy: _tplPolicy(['samal']) },
      rotation: { kind: 'rotate-squads', period: 'daily' },
      fatigue:  { intensity: 'active-patrol', impactsSleep: true, minRestAfterHours: 8, fatigueWeight: 7 },
      overlapPolicy: { activeOverlap: [], restOverlap: [] },
      allowPCOverride: true, shiftDurationLocked: true,
      qualifications: [], equipment: [], squadPolicy: { mode: 'no-mix' }, pairings: [], requiresDailyConfirmation: false,
      routeDescription: 'ציר היקפי — נצפ״ה 4 → 7 → 9',
    },
  },
  {
    id: 'mt-vehicle-patrol', companyId: 'co1',
    familyId: 'tf-vehicle-patrol',
    name: 'סיור רכוב',
    description: 'סיור ברכב פלוגתי — 06:00–14:00 כל יום',
    category: 'סיורים',
    isFavorite: false,
    usageCount: 3,
    createdAt: SEED_CREATED, createdByUserId: 'u1',
    payload: {
      archetypeKind: 'patrol',
      timeModel: { kind: 'fixed-hours', windows: [{ startTime: '06:00', endTime: '14:00', shiftDurationMinutes: 240, recurring: 'every-day' }] },
      manpower: { kind: 'exact', count: 3 },
      command:  { fieldCommandRequired: true, commandersPerSlot: 1, commanderCountsAsManpower: true, rankPolicy: _tplPolicy(['samal']) },
      rotation: { kind: 'rotate-squads', period: 'daily' },
      fatigue:  { intensity: 'active-patrol', impactsSleep: false, minRestAfterHours: 6, fatigueWeight: 6 },
      overlapPolicy: { activeOverlap: [], restOverlap: [] },
      allowPCOverride: true, shiftDurationLocked: false, hasVehicle: true,
      qualifications: [], equipment: [], squadPolicy: { mode: 'no-mix' }, pairings: [], requiresDailyConfirmation: false,
      routeDescription: 'ציר מערב + ציר דרום',
    },
  },
  // ── כוננויות ────────────────────────────────────────────────────
  {
    id: 'mt-carmel-a', companyId: 'co1',
    familyId: 'tf-readiness',
    name: 'כוננות כרמל א',
    description: 'תגובה ראשונית — רביעייה + מ״כ, רחבת מטה',
    category: 'כוננויות',
    isFavorite: true,
    usageCount: 6,
    createdAt: SEED_CREATED, createdByUserId: 'u1',
    payload: {
      archetypeKind: 'readiness',
      timeModel: { kind: '24-7-continuous' },
      manpower: { kind: 'exact', count: 4 },
      command:  { fieldCommandRequired: true, commandersPerSlot: 1, commanderCountsAsManpower: true, rankPolicy: _tplPolicy(['samal', 'mam']) },
      rotation: { kind: 'rotate-platoons', period: 'daily' },
      fatigue:  { intensity: 'readiness', impactsSleep: false, minRestAfterHours: 4, fatigueWeight: 2 },
      overlapPolicy: { activeOverlap: ['standing-guard', 'admin', 'readiness'], restOverlap: ['standing-guard', 'admin', 'readiness', 'active-patrol'] },
      allowPCOverride: true, shiftDurationLocked: false,
      qualifications: [], equipment: [], squadPolicy: { mode: 'no-mix' }, pairings: [], requiresDailyConfirmation: false,
      rallyPoint: 'רחבת מטה הפלוגה',
      responseInstructions: 'יציאה מהירה לרחבת מטה הפלוגה. מ״כ מוביל. נשק ואפוד אישי. דריכות מלאה — לקבל הוראות מהמ״פ בהגעה.',
    },
  },
  {
    id: 'mt-carmel-b', companyId: 'co1',
    familyId: 'tf-readiness',
    name: 'כוננות כרמל ב',
    description: 'כוח גיבוי — 8 חיילים, מטה משני',
    category: 'כוננויות',
    isFavorite: false,
    usageCount: 4,
    createdAt: SEED_CREATED, createdByUserId: 'u1',
    payload: {
      archetypeKind: 'readiness',
      timeModel: { kind: '24-7-continuous' },
      manpower: { kind: 'exact', count: 8 },
      command:  { fieldCommandRequired: true, commandersPerSlot: 1, commanderCountsAsManpower: true, rankPolicy: _tplPolicy(['samal', 'mam']) },
      rotation: { kind: 'rotate-platoons', period: 'daily' },
      fatigue:  { intensity: 'readiness', impactsSleep: false, minRestAfterHours: 4, fatigueWeight: 2 },
      overlapPolicy: { activeOverlap: ['standing-guard', 'admin', 'readiness'], restOverlap: ['standing-guard', 'admin', 'readiness', 'active-patrol'] },
      allowPCOverride: true, shiftDurationLocked: false,
      qualifications: [], equipment: [], squadPolicy: { mode: 'no-mix' }, pairings: [], requiresDailyConfirmation: false,
      rallyPoint: 'מטה משני — בניין 7',
      responseInstructions: 'יציאה ל-מטה משני בבניין 7. כוח גיבוי לרחבת המטה — ממתינים להוראות מהמ״פ.',
    },
  },
  {
    id: 'mt-rapid-response', companyId: 'co1',
    familyId: 'tf-emergency',
    name: 'כוננות הקפצה',
    description: 'התראה מיידית — כל המחלקה, נקודת ריכוז שער',
    category: 'כוננויות',
    isFavorite: false,
    usageCount: 2,
    createdAt: SEED_CREATED, createdByUserId: 'u1',
    payload: {
      archetypeKind: 'readiness',
      timeModel: { kind: '24-7-continuous' },
      manpower: { kind: 'range', min: 6, max: 12 },
      command:  { fieldCommandRequired: true, commandersPerSlot: 1, commanderCountsAsManpower: true, rankPolicy: _tplPolicy(['mam', 'officer']) },
      rotation: { kind: 'whichever-strongest' },
      fatigue:  { intensity: 'readiness', impactsSleep: false, minRestAfterHours: 4, fatigueWeight: 2 },
      overlapPolicy: { activeOverlap: ['standing-guard', 'admin', 'readiness'], restOverlap: ['standing-guard', 'admin', 'readiness', 'active-patrol'] },
      allowPCOverride: true, shiftDurationLocked: false,
      qualifications: [], equipment: [], squadPolicy: { mode: 'mix' }, pairings: [], requiresDailyConfirmation: false,
      rallyPoint: 'שער ראשי',
      responseInstructions: 'יציאה דחופה לשער. כל החיילים — אפודים ונשק. מקבלים תיק תגובה משם.',
    },
  },
  // ── תורנויות ─────────────────────────────────────────────────────
  {
    id: 'mt-kitchen', companyId: 'co1',
    familyId: 'tf-duties',
    name: 'תורנות מטבח',
    description: 'בוקר וצהריים — שלושייה',
    category: 'תורנויות',
    isFavorite: false,
    usageCount: 14,
    createdAt: SEED_CREATED, createdByUserId: 'u1',
    payload: {
      archetypeKind: 'custom',
      timeModel: { kind: 'fixed-hours', windows: [{ startTime: '05:30', endTime: '14:00', shiftDurationMinutes: 510, recurring: 'every-day' }] },
      manpower: { kind: 'exact', count: 3 },
      command:  { fieldCommandRequired: false, commandersPerSlot: 0, commanderCountsAsManpower: false, rankPolicy: _tplPolicy([]) },
      rotation: { kind: 'rotate-platoons', period: 'daily' },
      fatigue:  { intensity: 'admin', impactsSleep: false, minRestAfterHours: 6, fatigueWeight: 2 },
      allowPCOverride: true, shiftDurationLocked: false,
      qualifications: [], equipment: [], squadPolicy: { mode: 'mix' }, pairings: [], requiresDailyConfirmation: false,
    },
  },
  {
    id: 'mt-chamal', companyId: 'co1',
    familyId: 'tf-chamal',
    name: 'תורנות חמ״ל',
    description: 'משמרת חמ״ל פלוגתי — 12 שעות',
    category: 'תורנויות',
    isFavorite: false,
    usageCount: 9,
    createdAt: SEED_CREATED, createdByUserId: 'u1',
    payload: {
      archetypeKind: 'custom',
      timeModel: { kind: '24-7-continuous' },
      manpower: { kind: 'exact', count: 2 },
      command:  { fieldCommandRequired: false, commandersPerSlot: 0, commanderCountsAsManpower: false, rankPolicy: _tplPolicy([]) },
      rotation: { kind: 'rotate-platoons', period: 'weekly' },
      fatigue:  { intensity: 'readiness', impactsSleep: false, minRestAfterHours: 6, fatigueWeight: 3 },
      dayNightProfile: { dayStartTime: '08:00', nightStartTime: '20:00', dayShiftDurationMinutes: 720, nightShiftDurationMinutes: 720 },
      allowPCOverride: true, shiftDurationLocked: false,
      qualifications: [], equipment: [], squadPolicy: { mode: 'mix' }, pairings: [], requiresDailyConfirmation: false,
      rallyPoint: 'חמ״ל פלוגתי',
    },
  },
];

