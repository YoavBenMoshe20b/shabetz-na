/* eslint-disable react-refresh/only-export-components -- legacy monolith: hooks co-locate with provider; will be deleted in Phase 4 */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type {
  MockUser, UserRole, Soldier, SchedulePeriod, AuditLog, Platoon,
  MissionType, ReminderSetting, Leave, LeaveRequest, SoldierHistory, MiluimPeriod,
  ShiftWarning, FairnessScore, Company, CompanySettings, Squad,
  CompanyMission, OverrideAlert,
  SoldierStatus, SoldierStatusEvent, Delegation,
  CalendarEvent,
  Mission, Assignment, SelectorOutcomeRecord, SlotOperationalState, SlotExcuse,
  ChecklistTemplate, ChecklistRun, ChecklistInstance, ChecklistRunScope,
  PlatoonLeaveDay, PlatoonLeaveDayStatus, CompanyLeavePolicy, CompanyCoverageRuleSet, CoverageRule, SoldierLeaveOverride,
  CompanyBlockedDate,
  Qualification, EquipmentItem, SoldierQualification,
  LeaveRotationPolicy, LeaveBlock,
  CoverageEvent, DutyExclusion, LeaveRotationPlan,
  SignedEquipment, SignedEquipmentStatus,
  EquipmentCondition, EquipmentLifecycleEvent,
  CommandDelegation, EquipmentGap, EquipmentGapKind, EquipmentGapStatus,
  CommandAuthority, OperationalRole, FunctionalRole,
  MissionNote,
  OperationalOrder, OperationalOrderStatus,
  Announcement, AnnouncementStatus,
  EscalationEvent, PlatoonLeaveCycle, PlatoonLeaveCycleSegment,
  LogisticsRotation, LogisticsRotationStatus,
} from '../types';
import { newId } from '../utils/id';
import { canApproveLeaveFor, canCreateAnnouncement, canDeclareEscalation, canEditLeaveCycle, isRasap } from '../utils/permissions';
import { USE_SUPABASE } from '../api/_supabase';
import { usePersistedState } from '../utils/persistedState';
import type { MissionTemplate, TemplateFamily } from '../utils/missionTemplates';

// Seed version — bump when mockData shape changes in a way that should
// invalidate everyone's localStorage. Old blobs at older versions are
// ignored and the fresh seed wins. v1 = Phase 6.3.b initial persistence.
const SEED_VERSION = 1;
import * as missionsApi      from '../api/missions';
import * as announcementsApi from '../api/announcements';
import * as equipmentApi     from '../api/equipment';
import * as assignmentsApi   from '../api/assignments';
import * as leavesApi        from '../api/leaves';
import * as alertsApi        from '../api/alerts';
import * as soldiersApi      from '../api/soldiers';
import {
  mockUsers, mockSoldiers, mockSchedulePeriods, mockAuditLogs, mockPlatoons, mockLeaves, mockLeaveRequests,
  mockSoldierHistory, mockMiluimPeriods, mockCompanies, mockSquads, mockCompanyMissions, mockOverrideAlerts,
  mockSoldierStatusEvents, mockDelegations,
  mockCalendarEvents,
  mockMissions, mockAssignments, mockSlotOperationalState, mockQualifications, mockEquipmentItems, mockSoldierQualifications,
  mockChecklistTemplates, mockChecklistRuns, mockChecklistInstances,
  mockPlatoonLeaveDays, mockCompanyLeavePolicy, mockCompanyCoverageRules, mockSoldierLeaveOverrides,
  mockLeaveRotationPolicy, mockLeaveBlocks,
  mockCoverageEvents, mockDutyExclusions, mockLeaveRotationPlans,
  mockSignedEquipment,
  mockCommandDelegations, mockEquipmentGaps,
  mockMissionNotes,
  mockOperationalOrders,
  mockAnnouncements, mockEscalationEvents, mockPlatoonLeaveCycles,
  mockLogisticsRotations,
  mockMissionTemplates, mockTemplateFamilies,
  mockCompanyBlockedDates,
} from '../data/mockData';

// ─── Company-first flow shapes ───────────────────────────────────────────────
//
// The operational center of the app is the COMPANY. Only company commanders
// instantiate a company; everyone else joins an EXISTING one. These types are
// the contracts for those two operations.

export interface CreateCompanyInput {
  name: string;                    // e.g. "פלוגה ב"
  unitName?: string;               // e.g. "גדוד 51"
  settings: CompanySettings;
  /** Internal platoons defined during setup. At least one is required. */
  platoons: Array<{
    name: string;                  // e.g. "מחלקה 1" or "חפ״ק"
    isSpecial?: boolean;
    /** Sub-unit names to seed under this platoon. Empty for special platoons
     *  whose structure the platoon commander will define later. */
    squadNames: string[];
  }>;
}

export type JoinIdentity =
  | {
      kind:        'soldier';
      platoonId:   string;
      squadId?:  string;
      operationalRole?: string;
      pendingLeaves?: Array<{ startDate: string; startTime: string; endDate: string; endTime: string; reason: string }>;
    }
  | { kind: 'platoonCommander'; platoonId: string }
  | { kind: 'platoonSergeant';  platoonId: string }
  | { kind: 'deputyCompanyCommander' };

interface AppContextType {
  currentUser:    MockUser | null;
  /** All MockUsers in storage — used by approval-routing + commander
   *  surfaces that need to resolve "who is this soldier's user / role". */
  users:          MockUser[];
  currentRole:    UserRole;
  /** Active roster only. Inactive (historical) records are deliberately
   *  hidden behind `allSoldiers` so that no operational selector can read
   *  past memberships by accident. */
  soldiers:       Soldier[];
  /** Full historical record — audit/security flows ONLY. */
  allSoldiers:    Soldier[];
  /** Append-only operational state log. */
  soldierStatusEvents: SoldierStatusEvent[];
  /** Active permission grants (Delegations). Empty by default; CC grant
   *  UI lands in a future phase. */
  delegations:    Delegation[];

  // ── Operational state actions ──────────────────────────────────────
  /** Soldier updates their OWN status. Writes a status event + denorms. */
  updateSoldierStatus: (data: {
    soldierId: string;
    next: SoldierStatus;
    expectedUntil?: string;
    reason?: string;
  }) => void;
  /** Commander updates a soldier's status manually (e.g. CC sends a
   *  soldier home for personal reasons). Always logs isManualOverride=true
   *  and captures the actor + previous value. */
  updateSoldierStatusByCommander: (data: {
    soldierId: string;
    next: SoldierStatus;
    expectedUntil?: string;
    reason?: string;
  }) => void;
  periods:        SchedulePeriod[];
  auditLogs:      AuditLog[];
  platoons:       Platoon[];
  leaves:         Leave[];
  leaveRequests:  LeaveRequest[];
  soldierHistory: SoldierHistory[];
  miluimPeriods:  MiluimPeriod[];
  reminders:      ReminderSetting[];
  isOnline:       boolean;
  hasEmergency:   boolean;
  // Last schedule generation result (manager-only; soldier UI must filter)
  lastWarnings:   ShiftWarning[];
  lastFairness:   FairnessScore[];
  lastGeneratedPeriodId: string | null;
  setGenerationResult: (periodId: string, warnings: ShiftWarning[], fairness: FairnessScore[]) => void;
  // Company hierarchy
  companies:      Company[];
  squads:       Squad[];
  addSquad:     (data: { platoonId: string; name: string }) => Squad;
  removeSquad:  (id: string) => void;
  renameSquad:  (id: string, name: string) => void;
  // The ONE entry point for organisational creation. Only company-level
  // leadership invokes this (gated by canCreateCompany). It creates the
  // Company + its Platoons + their Squads in one transaction, then sets
  // the current user as that company's commander.
  createCompany:  (data: CreateCompanyInput) => string;     // returns invite code
  inviteOfficer:  (companyId: string, role: 'platoonCommander' | 'platoonSergeant', platoonId?: string) => string;
  inviteSoldier:  (platoonId: string) => string;

  // Company-level missions (created by company commander only)
  companyMissions:    CompanyMission[];
  addCompanyMission:  (data: Omit<CompanyMission, 'id' | 'createdAt'>) => CompanyMission;
  removeCompanyMission: (id: string) => void;

  // Operational override alerts
  overrideAlerts:      OverrideAlert[];
  recordOverrideAlert: (data: Omit<OverrideAlert, 'id' | 'timestamp' | 'status'>) => OverrideAlert;
  acknowledgeAlert:    (id: string, byUserId: string) => void;
  resolveAlert:        (id: string, byUserId: string) => void;

  // ── Calendar spine ─────────────────────────────────────────────────
  // First-class events the app owns. Other entry kinds (guard-shift,
  // leave-period, birthday, mission) are derived at read time in
  // utils/calendar.ts and don't live here.
  calendarEvents:   CalendarEvent[];
  /** Create a combat-block, locked-date, or announcement. CC-only at the
   *  UI tier — no permission check inside the action itself yet. */
  addCalendarEvent: (data: Omit<CalendarEvent, 'id' | 'createdAt'>) => CalendarEvent;
  /** Attach a platoon's content to a 'platoon-time' combat-block. */
  fillPlatoonTime:  (data: {
    eventId:   string;
    platoonId: string;
    title:     string;
    detail?:   string;
  }) => void;
  /** Convenience helper for the locked-date creation path (slice 3 UI). */
  setLockedDate:    (data: {
    companyId: string;
    dayIso:    string;            // YYYY-MM-DD
    reason:    string;
    allowsLeave?: boolean;
  }) => CalendarEvent;

  // ── Engine foundation (slice E1 — read-only, no UI consumer yet) ─────
  // The mission engine reads these as source-of-truth state. Slice E2 will
  // add `addMission` / mission-edit actions; slice E5 adds leave-rotation
  // write actions. For now: exposed for reads only.
  missions:               Mission[];
  /** Create a new mission. CC-only at the UI tier (no permission check
   *  inside the action itself yet — gated by route in slice E2). */
  addMission:             (data: Omit<Mission, 'id' | 'createdAt'>) => Mission;
  setMissionStatus:       (id: string, status: Mission['status']) => void;
  /** Apply a partial patch to an existing mission. The id/companyId/
   *  createdAt fields are immutable; everything else is patchable.
   *  Materialization runs every render — downstream surfaces update
   *  automatically on the next paint. */
  updateMission:          (id: string, patch: Partial<Omit<Mission, 'id' | 'companyId' | 'createdAt'>>) => void;

  // ── Slot assignments (operator-confirmed staffing) ─────────────────
  /** Persisted operator assignments keyed by materialized slot id.
   *  When a slot has assignments here, the materializer USES THEM
   *  verbatim — overriding its auto-pick heuristic. */
  assignments:            Assignment[];
  /** Replace all assignments for one slot atomically. Pass empty
   *  `soldierIds` and no `commanderSoldierId` to effectively clear via
   *  `clearSlotAssignment` instead. */
  setSlotAssignment:      (
    slotId: string,
    soldierIds: string[],
    options?: { commanderSoldierId?: string; overrideId?: string; overrideAlertId?: string },
  ) => void;
  clearSlotAssignment:    (slotId: string) => void;
  /** Audit trail of staffing decisions. Newest first. */
  selectorOutcomes:       SelectorOutcomeRecord[];
  recordSelectorOutcome:  (record: Omit<SelectorOutcomeRecord, 'id' | 'decidedAt'>) => void;

  // ── Mission Operations Layer ────────────────────────────────────
  /** Per-slot operator manipulations (locks, excuses, notes, forced
   *  rationale). Persisted; the materializer respects this on every
   *  recompute. */
  slotOperationalState:   SlotOperationalState[];
  setSlotOps:             (slotId: string, patch: Partial<Omit<SlotOperationalState, 'slotId' | 'updatedAt' | 'updatedByUserId'>>) => void;
  clearSlotOps:           (slotId: string) => void;
  toggleSlotSoldierLock:  (slotId: string, soldierId: string) => void;
  addSlotExcuse:          (slotId: string, excuse: SlotExcuse) => void;
  removeSlotExcuse:       (slotId: string, soldierId: string) => void;

  // ── Checklists (Phase 6.2.c) ────────────────────────────────────
  checklistTemplates:     ChecklistTemplate[];
  checklistRuns:          ChecklistRun[];
  checklistInstances:     ChecklistInstance[];
  createChecklistRun:     (input: { templateId: string; scope: ChecklistRunScope; missionId?: string; notes?: string; soldierIds: string[] }) => ChecklistRun | null;
  setChecklistInstanceItem: (instanceId: string, itemKey: string, patch: { present?: boolean; actualCount?: number; notes?: string }) => void;
  completeChecklistRun:   (runId: string) => void;

  // ── Operational Leave Management (Phase 6.10) ────────────────────
  platoonLeaveDays:        PlatoonLeaveDay[];
  companyLeavePolicy:      CompanyLeavePolicy;
  companyCoverageRules:    CompanyCoverageRuleSet;
  soldierLeaveOverrides:   SoldierLeaveOverride[];
  setPlatoonLeaveDay:      (dateIso: string, platoonId: string, status: PlatoonLeaveDayStatus, notes?: string) => void;
  clearPlatoonLeaveDay:    (dateIso: string, platoonId: string) => void;
  generatePlatoonRotation: (input: { startDateIso: string; days: number; order: string[]; homeStintDays?: number }) => void;
  updateCompanyLeavePolicy: (patch: Partial<Omit<CompanyLeavePolicy, 'companyId' | 'updatedAt' | 'updatedByUserId'>>) => void;
  upsertCoverageRule:      (rule: CoverageRule) => void;
  removeCoverageRule:      (ruleId: string) => void;
  setSoldierLeaveOverride: (dateIso: string, soldierId: string, status: 'home' | 'in-base', reason?: string) => void;
  clearSoldierLeaveOverride: (dateIso: string, soldierId: string) => void;

  // ── Phase 7.3 — Company blocked dates ────────────────────────────
  companyBlockedDates:     CompanyBlockedDate[];
  addCompanyBlockedDate:   (data: Omit<CompanyBlockedDate, 'id' | 'createdAt'>) => CompanyBlockedDate;
  updateCompanyBlockedDate: (id: string, patch: Partial<Omit<CompanyBlockedDate, 'id' | 'companyId' | 'createdAt'>>) => void;
  removeCompanyBlockedDate: (id: string) => void;

  // ── Mission Template Library (Phase 7.3) ─────────────────────────
  missionTemplates:           MissionTemplate[];
  addMissionTemplate:         (data: Omit<MissionTemplate, 'id' | 'createdAt' | 'usageCount'>) => MissionTemplate;
  updateMissionTemplate:      (id: string, patch: Partial<Omit<MissionTemplate, 'id' | 'companyId' | 'createdAt'>>) => void;
  hideMissionTemplate:        (id: string) => void;
  toggleMissionTemplateFavorite: (id: string) => void;
  /** Increments usageCount AND updates lastUsedAt — call after
   *  addMission from a template fires successfully. */
  incrementTemplateUsage:     (id: string) => void;
  // ── Doctrine families ────────────────────────────────────────────
  templateFamilies:           TemplateFamily[];
  addTemplateFamily:          (data: Omit<TemplateFamily, 'id' | 'createdAt'>) => TemplateFamily;
  updateTemplateFamily:       (id: string, patch: Partial<Omit<TemplateFamily, 'id' | 'companyId' | 'createdAt'>>) => void;
  archiveTemplateFamily:      (id: string) => void;

  // ── Operational orders (צווים) ──────────────────────────────────────
  orders:                 OperationalOrder[];
  addOrder:               (data: Omit<OperationalOrder, 'id' | 'createdAt'>) => OperationalOrder;
  setOrderStatus:         (id: string, status: OperationalOrderStatus) => void;
  qualifications:         Qualification[];
  equipmentItems:         EquipmentItem[];
  soldierQualifications:  SoldierQualification[];
  leaveRotationPolicy:    LeaveRotationPolicy | null;
  leaveBlocks:            LeaveBlock[];

  // ── Leave/coverage engine foundation (slice L1 — read-only) ──────────
  // Write actions (L2 policy editor, L3 coverage modal, L4 exclusion
  // manager) land in later slices.
  coverageEvents:      CoverageEvent[];
  dutyExclusions:      DutyExclusion[];
  leaveRotationPlans:  LeaveRotationPlan[];

  // ── Signed equipment (per-soldier ledger) ───────────────────────────
  signedEquipment:     SignedEquipment[];
  /** Append-only audit log of every equipment state transition (round 6). */
  equipmentLifecycle:  EquipmentLifecycleEvent[];
  /** Rasap actions — write paths go through the state machine + log. */
  signOutEquipment:    (data: {
    soldierId: string;
    itemName: string;
    category: SignedEquipment['category'];
    equipmentItemId?: string;
    serialNumber?: string;
    source?: string;
    notes?: string;
    initialCondition?: EquipmentCondition;
  }) => SignedEquipment | null;
  returnEquipment:     (data: {
    signedEquipmentId: string;
    partial?: boolean;
    damageDescription?: string;
    finalCondition?: EquipmentCondition;
  }) => void;
  markEquipmentDamage: (data: {
    signedEquipmentId: string;
    description: string;
    newCondition?: EquipmentCondition;
  }) => void;
  /** Bulk replace inventory (CSV import). */
  setInventoryItems:   (items: EquipmentItem[]) => void;

  // ── Soldier profile updates (self-edited from /profile) ─────────────
  updateSoldierProfile: (data: {
    soldierId:     string;
    dominantHand?: 'right' | 'left';
    weaponSide?:   'right' | 'left';
    shirtSize?:    string;
    pantsSize?:    string;
    shoeSize?:     string;
    dateOfBirth?:  string;
    // Phase 7.4 — operational logistics fields (§7)
    weaponType?:    string;
    weaponSerial?:  string;
    shirtSizeB?:    string;
    pantsSizeB?:    string;
    shirtSizeCiv?:  string;
    pantsSizeCiv?:  string;
  }) => void;

  // ── PC/PS soldier assignment updates ────────────────────────────────
  /** Reassign a soldier to a different squad within the same platoon. */
  updateSoldierSquad: (soldierId: string, squadId: string | null) => void;
  /** Set a soldier's operational roles (multi-select). */
  updateSoldierOperationalRoles: (soldierId: string, roles: OperationalRole[]) => void;
  /** Set the soldier's functional-role flags (kitchen-lead, water-lead,
   *  equipment-lead-chapack, etc.). Used by CHAPAK / MAFLAG admin UI. */
  updateSoldierFunctionalRoles:  (soldierId: string, roles: FunctionalRole[]) => void;

  // ── Temporary command delegation ────────────────────────────────────
  commandDelegations:   CommandDelegation[];
  /** Active delegations covering "now" — derived for callers. */
  activeCommandDelegations: () => CommandDelegation[];
  createCommandDelegation: (data: {
    toUserId:    string;
    scope:       'company' | 'platoon';
    scopeRefId?: string;
    authorities: CommandAuthority[];
    startIso:    string;
    endIso:      string;
    reason?:     string;
  }) => CommandDelegation;
  revokeCommandDelegation: (id: string, reason?: string) => void;

  // ── Mission notes (free-text operational extensions) ───────────────
  missionNotes:    MissionNote[];
  addMissionNote:  (data: {
    missionId:   string;
    scope:       'company' | 'platoon';
    platoonId?:  string;
    text:        string;
  }) => MissionNote;
  editMissionNote: (id: string, text: string) => void;
  deleteMissionNote: (id: string) => void;

  // ── Equipment items (CC/PC inline addition while authoring missions) ──
  /** Add a new EquipmentItem to the company's reusable inventory. */
  addEquipmentItem: (data: {
    name: string;
    category?: string;
    isConsumable?: boolean;
    unitCount?: number;
  }) => { id: string };

  // ── Equipment gap reports ──────────────────────────────────────────
  equipmentGaps:         EquipmentGap[];
  reportEquipmentGap: (data: {
    soldierId:           string;
    kind:                EquipmentGapKind;
    itemName:            string;
    signedEquipmentId?:  string;
    description?:        string;
  }) => EquipmentGap;
  reviewEquipmentGap:   (id: string) => void;
  forwardEquipmentGap:  (id: string) => void;
  resolveEquipmentGap:  (id: string, notes?: string) => void;
  dismissEquipmentGap:  (id: string, notes?: string) => void;

  // ── Roster-first auth ────────────────────────────────────────────────
  // Sign in for already-claimed identities
  signIn:         (phone: string, password: string) => { user: MockUser | null; error?: string };

  // Lookup phase of the claim flow: phone + idLast4 -> reveal the slot
  // (without committing). The result indicates whether a transfer would
  // be required (i.e. an active Soldier already exists for this phone).
  lookupClaim:    (phone: string, idLast4: string) => {
    ok: boolean;
    soldier?: Soldier;
    company?: Company;
    platoon?: Platoon;
    requiresTransfer?: boolean;
    currentActiveCompany?: { id: string; name: string };
    error?: string;
  };

  // Commit phase. confirmTransfer must be true when a transfer is required.
  claimIdentity:  (phone: string, idLast4: string, password: string, confirmTransfer?: boolean) => {
    ok: boolean;
    user?: MockUser;
    error?: string;
  };

  // Bootstrap path — the ONE self-registration in the system. Used only
  // by users who are opening a brand-new company (no roster exists yet).
  bootstrapCC:    (data: { name: string; phone: string; idLast4: string; password: string }) => {
    ok: boolean;
    user?: MockUser;
    error?: string;
  };
  // joinCompany kept temporarily for any consumer that still references it;
  // returns a soft error in the roster-first model. Will be removed in S2.
  joinCompany:    (code: string, identity: JoinIdentity) => { ok: boolean; error?: string };
  logout:         () => void;
  switchRole:     (role: UserRole) => void; // dev/test only
  switchUser:     (userId: string) => void; // demo-only: hop between mock users without re-auth
  addPeriod:      (p: SchedulePeriod) => void;
  updatePeriod:   (p: SchedulePeriod) => void;
  addAuditLog:    (entry: Omit<AuditLog, 'id' | 'timestamp'>) => void;
  updateSoldierAvailability: (id: string, available: boolean) => void;
  setHasEmergency: (v: boolean) => void;
  setReminder:    (r: ReminderSetting) => void;
  addLeave:       (leave: Omit<Leave, 'id'>) => void;
  removeLeave:    (id: string) => void;
  addLeaveRequest:     (req: Omit<LeaveRequest, 'id' | 'status' | 'submittedAt'>) => void;
  approveLeaveRequest: (id: string, reviewerId: string, reviewerName: string) => void;
  rejectLeaveRequest:  (id: string, reviewerId: string, reviewerName: string) => void;

  // ── Round 4: Announcements / Escalations / Leave Cycles ──────────────
  // All three follow the same pattern: state in-context + action functions
  // that perform a permission check at the write boundary. Read paths are
  // open — visibility filtering happens at projection time so commanders
  // see the full set and soldiers see only what their audience covers.

  // Announcements / לו"ז פלוגתי
  announcements:        Announcement[];
  addAnnouncement:      (data: Omit<Announcement, 'id' | 'createdAt' | 'createdByUserId' | 'createdByName' | 'status'> & { status?: AnnouncementStatus }) => Announcement | null;
  updateAnnouncement:   (id: string, patch: Partial<Omit<Announcement, 'id' | 'companyId' | 'createdAt' | 'createdByUserId' | 'createdByName'>>) => void;
  closeAnnouncement:    (id: string) => void;
  deleteAnnouncement:   (id: string) => void;

  // Escalation events / הקפצה
  escalationEvents:     EscalationEvent[];
  /** Single active event by default — commanders can stack if needed.
   *  Returns the newly-created EscalationEvent (or null if not permitted). */
  declareEscalation:    (data: Omit<EscalationEvent, 'id' | 'status' | 'openedAt' | 'openedByUserId' | 'openedByName'>) => EscalationEvent | null;
  closeEscalation:      (id: string, reason?: string) => void;
  /** True iff the viewer has at least one active escalation whose audience
   *  covers them. Used by the global EscalationActiveBanner. */
  activeEscalationsForViewer: () => EscalationEvent[];

  // Platoon leave cycle / סבב יציאות פלוגתי
  platoonLeaveCycles:        PlatoonLeaveCycle[];
  addPlatoonLeaveCycle:      (data: Omit<PlatoonLeaveCycle, 'id' | 'createdAt' | 'createdByUserId' | 'status' | 'segments'> & { segments?: PlatoonLeaveCycleSegment[]; status?: PlatoonLeaveCycle['status'] }) => PlatoonLeaveCycle | null;
  updatePlatoonLeaveCycle:   (id: string, patch: Partial<Omit<PlatoonLeaveCycle, 'id' | 'companyId' | 'createdAt' | 'createdByUserId'>>) => void;
  addLeaveCycleSegment:      (cycleId: string, segment: Omit<PlatoonLeaveCycleSegment, 'id'>) => void;
  updateLeaveCycleSegment:   (cycleId: string, segmentId: string, patch: Partial<Omit<PlatoonLeaveCycleSegment, 'id'>>) => void;
  removeLeaveCycleSegment:   (cycleId: string, segmentId: string) => void;
  publishLeaveCycle:         (id: string) => void;

  // Logistics rotations (round 8) — Rasap-owned recurring/one-off chores
  logisticsRotations:        LogisticsRotation[];
  addLogisticsRotation:      (data: Omit<LogisticsRotation, 'id' | 'createdAt' | 'createdByUserId' | 'createdByName' | 'status'> & { status?: LogisticsRotationStatus }) => LogisticsRotation | null;
  setLogisticsRotationStatus:(id: string, status: LogisticsRotationStatus) => void;
}

const AppContext = createContext<AppContextType | null>(null);

// ─── Persistence side-effect helper ───────────────────────────────────────
//
// Every mutation in this provider first updates LOCAL state for instant UI
// feedback, then calls `persist(() => api.x(...))` to fire the Supabase
// write in the background. When USE_SUPABASE=false the lambda never runs;
// when true, any error is logged but does not roll back the optimistic
// update — the next refresh will reconcile via React Query. This keeps
// every action's signature synchronous from the caller's perspective,
// matching the existing demo behavior.
// Parse the missionId out of a materialized slot id. Format produced by
// materializeWeek is `mat-<missionId>-<YYYY-MM-DD>-<windowIndex>`. The
// missionId itself may contain hyphens (e.g. `mi-gate-north`), so we
// can't just split on '-'. Strategy: strip the prefix, strip the
// trailing `-<date>-<idx>` (10 chars + 1 + N digits), keep the rest.
function parseMissionIdFromSlotId(slotId: string): string | null {
  if (!slotId.startsWith('mat-')) return null;
  // Look for the date pattern YYYY-MM-DD and slice before it.
  const m = slotId.match(/^mat-(.+?)-\d{4}-\d{2}-\d{2}-\d+$/);
  return m ? m[1] : null;
}

function persist(fire: () => Promise<unknown>): void {
  if (!USE_SUPABASE) return;
  void fire().catch((err) => {
    console.error('[persist] write failed:', err);
  });
}

export function AppProvider({ children }: { children: ReactNode }) {
  // Persisted: login survives refresh. UserSwitcher and signIn both
  // write here; logout clears it. Without this every page reload would
  // bounce to /login which kills the demo flow.
  const [currentUser,  setCurrentUser]  = usePersistedState<MockUser | null>('currentUser', null, SEED_VERSION);
  const [currentRole,  setCurrentRole]  = usePersistedState<UserRole>('currentRole', 'soldier', SEED_VERSION);
  const [users,        setUsers]        = usePersistedState<MockUser[]>('users', mockUsers, SEED_VERSION);
  // ── Roster: active-only at the boundary ───────────────────────────────
  // `allSoldiers` is the full historical record — UI/screens MUST NOT read
  // this directly. Only audit flows should touch it. The exported `soldiers`
  // selector below filters to status === 'active', and that's what every
  // operational screen sees.
  const [allSoldiers,  setAllSoldiers]  = usePersistedState<Soldier[]>('allSoldiers', mockSoldiers, SEED_VERSION);
  const soldiers = allSoldiers.filter((s) => s.status === 'active');
  const setSoldiers = setAllSoldiers;   // legacy callers — semantic equivalence

  // ── Operational status log + delegations (foundation, no UI yet) ──────
  const [soldierStatusEvents, setSoldierStatusEvents] = usePersistedState<SoldierStatusEvent[]>('soldierStatusEvents', mockSoldierStatusEvents, SEED_VERSION);
  const [delegations] = useState<Delegation[]>(mockDelegations);

  // Internal helper — handles BOTH soldier-self-update and commander-
  // override paths. Captures previous value + actor + reason for audit.
  const writeStatusTransition = (data: {
    soldierId: string;
    next: SoldierStatus;
    expectedUntil?: string;
    reason?: string;
    isManualOverride?: boolean;
  }) => {
    const now = new Date().toISOString();
    // Resolve previous value BEFORE updating. We read from the live state
    // via the functional updater pattern to avoid stale closures.
    let previousValue: SoldierStatus | undefined;
    setAllSoldiers((prev) => {
      const target = prev.find((s) => s.id === data.soldierId);
      previousValue = target?.currentStatus;
      return prev.map((s) => s.id === data.soldierId ? {
        ...s,
        currentStatus:       data.next,
        statusSetAt:         now,
        statusExpectedUntil: data.expectedUntil,
        availability:        data.next === 'in-base',
      } : s);
    });
    setSoldierStatusEvents((prev) => [...prev, {
      id: newId('sse'),
      soldierId:        data.soldierId,
      value:            data.next,
      previousValue,
      setAt:            now,
      setBy:            currentUser?.id ?? 'system',
      setByName:        currentUser?.name ?? 'system',
      setByRole:        currentRole,
      expectedUntil:    data.expectedUntil,
      reason:           data.reason,
      isManualOverride: data.isManualOverride ?? false,
    }]);
    persist(() => soldiersApi.updateStatus({
      soldierId:        data.soldierId,
      next:             data.next,
      expectedUntil:    data.expectedUntil,
      reason:           data.reason,
      setByName:        currentUser?.name,
      setByRole:        currentRole,
      isManualOverride: data.isManualOverride ?? false,
    }));
  };

  /** Soldier updates their OWN status. */
  const updateSoldierStatus = (data: {
    soldierId: string;
    next: SoldierStatus;
    expectedUntil?: string;
    reason?: string;
  }) => writeStatusTransition({ ...data, isManualOverride: false });

  /** Commander updates a SOLDIER'S status. Reason becomes mandatory in
   *  the UI layer; the data path treats it as optional but the audit
   *  log will surface "no reason given" when absent. */
  const updateSoldierStatusByCommander = (data: {
    soldierId: string;
    next: SoldierStatus;
    expectedUntil?: string;
    reason?: string;
  }) => writeStatusTransition({ ...data, isManualOverride: true });
  const [periods,      setPeriods]      = usePersistedState<SchedulePeriod[]>('periods', mockSchedulePeriods, SEED_VERSION);
  const [auditLogs,    setAuditLogs]    = useState<AuditLog[]>(mockAuditLogs);
  const [platoons, setPlatoons]           = usePersistedState<Platoon[]>('platoons', mockPlatoons, SEED_VERSION);
  const [leaves,        setLeaves]        = usePersistedState<Leave[]>('leaves', mockLeaves, SEED_VERSION);
  const [leaveRequests, setLeaveRequests] = usePersistedState<LeaveRequest[]>('leaveRequests', mockLeaveRequests, SEED_VERSION);
  const [soldierHistory]                  = useState<SoldierHistory[]>(mockSoldierHistory);
  const [miluimPeriods]                   = useState<MiluimPeriod[]>(mockMiluimPeriods);
  const [reminders,     setReminders]     = useState<ReminderSetting[]>([]);
  const [isOnline,     setIsOnline]     = useState(navigator.onLine);
  const [hasEmergency, setHasEmergency] = useState(false);
  const [lastWarnings,  setLastWarnings]  = useState<ShiftWarning[]>([]);
  const [lastFairness,  setLastFairness]  = useState<FairnessScore[]>([]);
  const [lastGeneratedPeriodId, setLastGeneratedPeriodId] = useState<string | null>(null);
  const [companies,     setCompanies]     = useState<Company[]>(mockCompanies);
  const [squads,      setSquads]      = usePersistedState<Squad[]>('squads', mockSquads, SEED_VERSION);

  const addSquad = (data: { platoonId: string; name: string }): Squad => {
    const newSu: Squad = {
      id: newId('su'),
      platoonId: data.platoonId,
      name: data.name,
      soldierIds: [],
    };
    setSquads((prev) => [...prev, newSu]);
    setPlatoons((prev) => prev.map((g) => g.id === data.platoonId
      ? { ...g, squadIds: [...(g.squadIds ?? []), newSu.id] }
      : g
    ));
    return newSu;
  };

  const removeSquad = (id: string) => {
    setSquads((prev) => prev.filter((s) => s.id !== id));
    setPlatoons((prev) => prev.map((g) => g.squadIds?.includes(id)
      ? { ...g, squadIds: g.squadIds.filter((x) => x !== id) }
      : g
    ));
  };

  const renameSquad = (id: string, name: string) =>
    setSquads((prev) => prev.map((s) => s.id === id ? { ...s, name } : s));

  // ── Company missions (company-tier capability — gated by canCreateCompanyMission) ──
  const [companyMissions, setCompanyMissions] = useState<CompanyMission[]>(mockCompanyMissions);

  const addCompanyMission = (data: Omit<CompanyMission, 'id' | 'createdAt'>): CompanyMission => {
    const cm: CompanyMission = {
      ...data,
      id: newId('cm'),
      createdAt: new Date().toISOString(),
    };
    setCompanyMissions((prev) => [...prev, cm]);
    return cm;
  };

  const removeCompanyMission = (id: string) =>
    setCompanyMissions((prev) => prev.filter((m) => m.id !== id));

  // ── Override alerts (escalation upward to company commander) ──
  // The action that triggers the alert always succeeds first; recording the
  // alert is purely the upward signal. Calling code MUST NOT block on this.
  const [overrideAlerts, setOverrideAlerts] = usePersistedState<OverrideAlert[]>('overrideAlerts', mockOverrideAlerts, SEED_VERSION);

  const recordOverrideAlert = (data: Omit<OverrideAlert, 'id' | 'timestamp' | 'status'>): OverrideAlert => {
    const alert: OverrideAlert = {
      ...data,
      id: newId('al-ov'),
      timestamp: new Date().toISOString(),
      status: 'open',
    };
    setOverrideAlerts((prev) => [alert, ...prev]);
    return alert;
  };

  const acknowledgeAlert = (id: string, byUserId: string) => {
    setOverrideAlerts((prev) => prev.map((a) => a.id === id
      ? { ...a, status: 'acknowledged', acknowledgedByUserId: byUserId, acknowledgedAt: new Date().toISOString() }
      : a
    ));
    persist(() => alertsApi.acknowledgeOverride(id, byUserId));
  };

  const resolveAlert = (id: string, byUserId: string) => {
    setOverrideAlerts((prev) => prev.map((a) => a.id === id
      ? { ...a, status: 'resolved', resolvedByUserId: byUserId, resolvedAt: new Date().toISOString() }
      : a
    ));
    persist(() => alertsApi.resolveOverride(id, byUserId));
  };

  // ── Engine foundation (slice E1 — state only, no UI consumer yet) ─────
  // The engine pipeline (slice E3+) will read from these directly. Mission
  // authoring (slice E2) will add a setMissions write path; leave-rotation
  // configuration (slice E5) will replace the readonly policy with a setter.
  // Bump to v2: Phase 6.3.a/b added mi-gate-south (g2) and mi-readiness-east
  // (g3). v1 localStorage wouldn't have them; v2 invalidates the old blob
  // so the new seed wins.
  const [missions, setMissions] = usePersistedState<Mission[]>('missions', mockMissions, 2);

  const addMission = (data: Omit<Mission, 'id' | 'createdAt'>): Mission => {
    const m: Mission = {
      ...data,
      id:        newId('mi'),
      createdAt: new Date().toISOString(),
    };
    setMissions((prev) => [...prev, m]);
    persist(() => missionsApi.create(data));
    return m;
  };

  const setMissionStatus = (id: string, status: Mission['status']) => {
    setMissions((prev) => prev.map((m) => m.id === id ? { ...m, status } : m));
    persist(() => missionsApi.setStatus(id, status));
  };

  const updateMission = (
    id: string,
    patch: Partial<Omit<Mission, 'id' | 'companyId' | 'createdAt'>>,
  ) => {
    setMissions((prev) => prev.map((m) => m.id === id ? { ...m, ...patch } : m));
    persist(() => missionsApi.update(id, patch));
  };

  // ── Slot assignments — operator-confirmed staffing ─────────────────
  //
  // Each Assignment links one soldier to one materialized slot (`slotId`
  // produced by materializeWeek). The materializer overrides its
  // auto-pick when assignments are present, so this is the bridge from
  // a PC opening StaffingSheet → confirming a roster → everyone in the
  // app (CC, PC, soldiers) seeing the assigned soldiers on the slot.
  //
  // setSlotAssignment replaces ALL assignments for a slot in one shot —
  // committing the operator's full intent atomically.
  const [assignments, setAssignments] = usePersistedState<Assignment[]>('assignments', mockAssignments, SEED_VERSION);

  // Mission Operations Layer (Phase 6.9) — durable per-slot operator
  // manipulations. The engine reads these as hard input alongside
  // assignments; the materializer respects them on every recompute.
  // Keyed by slot.id (deterministic from materializeWeek).
  const [slotOperationalState, setSlotOperationalState] = usePersistedState<SlotOperationalState[]>(
    'slotOperationalState', mockSlotOperationalState, SEED_VERSION,
  );

  /** Merge a partial operational state for one slot. Atomic write. */
  const setSlotOps = (slotId: string, patch: Partial<Omit<SlotOperationalState, 'slotId' | 'updatedAt' | 'updatedByUserId'>>) => {
    const actorId = currentUser?.id ?? 'system';
    const nowIso = new Date().toISOString();
    setSlotOperationalState((prev) => {
      const existing = prev.find((s) => s.slotId === slotId);
      const merged: SlotOperationalState = {
        ...(existing ?? { slotId, updatedAt: nowIso, updatedByUserId: actorId }),
        ...patch,
        slotId,
        updatedAt: nowIso,
        updatedByUserId: actorId,
      };
      return [...prev.filter((s) => s.slotId !== slotId), merged];
    });
  };

  /** Clear all operational state for a slot. */
  const clearSlotOps = (slotId: string) => {
    setSlotOperationalState((prev) => prev.filter((s) => s.slotId !== slotId));
  };

  // ── Checklists (Phase 6.2.c) ──────────────────────────────────────
  const [checklistTemplates] = usePersistedState<ChecklistTemplate[]>(
    'checklistTemplates', mockChecklistTemplates, SEED_VERSION,
  );
  const [checklistRuns, setChecklistRuns] = usePersistedState<ChecklistRun[]>(
    'checklistRuns', mockChecklistRuns, SEED_VERSION,
  );
  const [checklistInstances, setChecklistInstances] = usePersistedState<ChecklistInstance[]>(
    'checklistInstances', mockChecklistInstances, SEED_VERSION,
  );

  const createChecklistRun = (input: {
    templateId: string;
    scope: ChecklistRunScope;
    missionId?: string;
    notes?: string;
    soldierIds: string[];
  }): ChecklistRun | null => {
    if (!currentUser) return null;
    const tpl = checklistTemplates.find((t) => t.id === input.templateId);
    if (!tpl) return null;
    const runId = newId('crun');
    const nowIso = new Date().toISOString();
    const run: ChecklistRun = {
      id: runId,
      companyId: tpl.companyId,
      templateId: input.templateId,
      scope: input.scope,
      missionId: input.missionId,
      initiatedByUserId: currentUser.id,
      initiatedByName: currentUser.name,
      notes: input.notes,
      status: 'open',
      createdAt: nowIso,
    };
    const instances: ChecklistInstance[] = input.soldierIds.map((sid) => ({
      id: newId('cinst'),
      runId,
      soldierId: sid,
      status: 'pending',
      items: tpl.items.map((it) => ({
        key: it.key,
        present: false,
        actualCount: it.expectedCount,
      })),
    }));
    setChecklistRuns((prev) => [run, ...prev]);
    setChecklistInstances((prev) => [...instances, ...prev]);
    return run;
  };

  const setChecklistInstanceItem = (
    instanceId: string,
    itemKey: string,
    patch: { present?: boolean; actualCount?: number; notes?: string },
  ) => {
    setChecklistInstances((prev) => prev.map((inst) => {
      if (inst.id !== instanceId) return inst;
      const items = inst.items.map((it) => (it.key === itemKey ? { ...it, ...patch } : it));
      // Auto-status: if all critical items checked → in-progress; if any critical missing → in-progress
      const tpl = checklistTemplates.find((t) => t.id === checklistRuns.find((r) => r.id === inst.runId)?.templateId);
      let status = inst.status;
      if (tpl) {
        const critical = tpl.items.filter((i) => i.level === 'critical');
        const allCriticalPresent = critical.every((c) =>
          items.find((it) => it.key === c.key)?.present === true,
        );
        const anyTouched = items.some((it) => it.present);
        if (allCriticalPresent && items.every((it) => it.present || tpl.items.find((tplI) => tplI.key === it.key)?.level === 'soft')) {
          status = 'passed';
        } else if (anyTouched) {
          status = 'in-progress';
        }
      }
      return { ...inst, items, status };
    }));
  };

  // ── Operational Leave Management (Phase 6.10) ────────────────────
  const [platoonLeaveDays, setPlatoonLeaveDays] = usePersistedState<PlatoonLeaveDay[]>(
    'platoonLeaveDays', mockPlatoonLeaveDays, SEED_VERSION,
  );
  const [companyLeavePolicy, setCompanyLeavePolicy] = usePersistedState<CompanyLeavePolicy>(
    'companyLeavePolicy', mockCompanyLeavePolicy, SEED_VERSION,
  );
  const [companyCoverageRules, setCompanyCoverageRules] = usePersistedState<CompanyCoverageRuleSet>(
    'companyCoverageRules', mockCompanyCoverageRules, SEED_VERSION,
  );
  const [soldierLeaveOverrides, setSoldierLeaveOverrides] = usePersistedState<SoldierLeaveOverride[]>(
    'soldierLeaveOverrides', mockSoldierLeaveOverrides, SEED_VERSION,
  );

  /** Toggle/set the home/in-base status for a (date, platoon) pair. */
  const setPlatoonLeaveDay = (
    dateIso: string,
    platoonId: string,
    status: PlatoonLeaveDayStatus,
    notes?: string,
  ) => {
    const actorId = currentUser?.id ?? 'system';
    const nowIso = new Date().toISOString();
    setPlatoonLeaveDays((prev) => {
      const filtered = prev.filter((d) => !(d.dateIso === dateIso && d.platoonId === platoonId));
      // 'in-base' is the default; storing it explicitly is unnecessary
      // unless the operator wants to LOCK the day. To keep the state
      // file lean we drop in-base entries unless `notes` is provided.
      if (status === 'in-base' && !notes) return filtered;
      return [
        ...filtered,
        {
          dateIso, platoonId, status, notes,
          updatedAt: nowIso, updatedByUserId: actorId,
        },
      ];
    });
  };

  const clearPlatoonLeaveDay = (dateIso: string, platoonId: string) => {
    setPlatoonLeaveDays((prev) =>
      prev.filter((d) => !(d.dateIso === dateIso && d.platoonId === platoonId)),
    );
  };

  /** Apply an automatic rotation forward N days from a start date using
   *  the current policy. Platoons in `order` rotate one-at-a-time
   *  (default) with `homeStintDays` days each. Existing entries for the
   *  same date+platoon are overwritten (unless locked). */
  const generatePlatoonRotation = (input: {
    startDateIso: string;
    days: number;
    order: string[];
    homeStintDays?: number;
  }) => {
    const stint = input.homeStintDays ?? companyLeavePolicy.homeStintDays;
    if (input.order.length === 0 || stint <= 0) return;
    const actorId = currentUser?.id ?? 'system';
    const nowIso = new Date().toISOString();
    const next: PlatoonLeaveDay[] = [];
    const start = new Date(input.startDateIso);
    for (let i = 0; i < input.days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateIso = d.toISOString().slice(0, 10);
      const slotIndex = Math.floor(i / stint) % input.order.length;
      const homePlatoon = input.order[slotIndex];
      next.push({
        dateIso,
        platoonId: homePlatoon,
        status: 'home',
        updatedAt: nowIso,
        updatedByUserId: actorId,
      });
    }
    setPlatoonLeaveDays((prev) => {
      // Keep locked entries; overwrite any unlocked entries in the
      // target range; append new ones for unrepresented (date, platoon).
      const inRange = (e: PlatoonLeaveDay) => {
        const iso = e.dateIso;
        return iso >= input.startDateIso
          && iso <= (next[next.length - 1]?.dateIso ?? input.startDateIso);
      };
      const lockedInRange = prev.filter((e) => inRange(e) && e.locked);
      const outOfRange = prev.filter((e) => !inRange(e));
      const lockedKeys = new Set(lockedInRange.map((e) => `${e.dateIso}::${e.platoonId}`));
      const fresh = next.filter((e) => !lockedKeys.has(`${e.dateIso}::${e.platoonId}`));
      return [...outOfRange, ...lockedInRange, ...fresh];
    });
  };

  const updateCompanyLeavePolicy = (patch: Partial<Omit<CompanyLeavePolicy, 'companyId' | 'updatedAt' | 'updatedByUserId'>>) => {
    const actorId = currentUser?.id ?? 'system';
    const nowIso = new Date().toISOString();
    setCompanyLeavePolicy((prev) => ({
      ...prev,
      ...patch,
      updatedAt: nowIso,
      updatedByUserId: actorId,
    }));
  };

  const upsertCoverageRule = (rule: CoverageRule) => {
    const actorId = currentUser?.id ?? 'system';
    const nowIso = new Date().toISOString();
    setCompanyCoverageRules((prev) => ({
      ...prev,
      rules: [
        ...prev.rules.filter((r) => r.id !== rule.id),
        rule,
      ],
      updatedAt: nowIso,
      updatedByUserId: actorId,
    }));
  };

  const removeCoverageRule = (ruleId: string) => {
    const actorId = currentUser?.id ?? 'system';
    const nowIso = new Date().toISOString();
    setCompanyCoverageRules((prev) => ({
      ...prev,
      rules: prev.rules.filter((r) => r.id !== ruleId),
      updatedAt: nowIso,
      updatedByUserId: actorId,
    }));
  };

  const setSoldierLeaveOverride = (dateIso: string, soldierId: string, status: 'home' | 'in-base', reason?: string) => {
    const actorId = currentUser?.id ?? 'system';
    const nowIso = new Date().toISOString();
    setSoldierLeaveOverrides((prev) => [
      ...prev.filter((o) => !(o.dateIso === dateIso && o.soldierId === soldierId)),
      { id: newId('slo'), dateIso, soldierId, status, reason, createdAt: nowIso, createdByUserId: actorId },
    ]);
  };

  const clearSoldierLeaveOverride = (dateIso: string, soldierId: string) => {
    setSoldierLeaveOverrides((prev) =>
      prev.filter((o) => !(o.dateIso === dateIso && o.soldierId === soldierId)),
    );
  };

  // ── Phase 7.3 — Company blocked dates ────────────────────────────
  const [companyBlockedDates, setCompanyBlockedDates] = usePersistedState<CompanyBlockedDate[]>(
    'companyBlockedDates', mockCompanyBlockedDates, SEED_VERSION,
  );

  const addCompanyBlockedDate = (data: Omit<CompanyBlockedDate, 'id' | 'createdAt'>) => {
    const entry: CompanyBlockedDate = {
      ...data,
      id: newId('cbd'),
      createdAt: new Date().toISOString(),
    };
    setCompanyBlockedDates((prev) => [...prev, entry]);
    return entry;
  };

  const updateCompanyBlockedDate = (
    id: string,
    patch: Partial<Omit<CompanyBlockedDate, 'id' | 'companyId' | 'createdAt'>>,
  ) => {
    setCompanyBlockedDates((prev) => prev.map((d) => d.id === id ? { ...d, ...patch } : d));
  };

  const removeCompanyBlockedDate = (id: string) => {
    setCompanyBlockedDates((prev) => prev.filter((d) => d.id !== id));
  };

  // ── Mission Template Library (Phase 7.3) ──────────────────────────
  const [missionTemplates, setMissionTemplates] = usePersistedState<MissionTemplate[]>(
    'missionTemplates', mockMissionTemplates, SEED_VERSION,
  );

  const addMissionTemplate = (data: Omit<MissionTemplate, 'id' | 'createdAt' | 'usageCount'>) => {
    const tpl: MissionTemplate = {
      ...data,
      id: newId('mt'),
      createdAt: new Date().toISOString(),
      usageCount: 0,
    };
    setMissionTemplates((prev) => [tpl, ...prev]);
    return tpl;
  };

  const updateMissionTemplate = (
    id: string,
    patch: Partial<Omit<MissionTemplate, 'id' | 'companyId' | 'createdAt'>>,
  ) => {
    setMissionTemplates((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
  };

  const hideMissionTemplate = (id: string) => {
    setMissionTemplates((prev) => prev.map((t) => t.id === id ? { ...t, isHidden: true } : t));
  };

  const toggleMissionTemplateFavorite = (id: string) => {
    setMissionTemplates((prev) =>
      prev.map((t) => t.id === id ? { ...t, isFavorite: !t.isFavorite } : t),
    );
  };

  const incrementTemplateUsage = (id: string) => {
    const now = new Date().toISOString();
    setMissionTemplates((prev) =>
      prev.map((t) => t.id === id
        ? { ...t, usageCount: t.usageCount + 1, lastUsedAt: now }
        : t),
    );
  };

  // ── Doctrine families ─────────────────────────────────────────────
  const [templateFamilies, setTemplateFamilies] = usePersistedState<TemplateFamily[]>(
    'templateFamilies', mockTemplateFamilies, SEED_VERSION,
  );

  const addTemplateFamily = (data: Omit<TemplateFamily, 'id' | 'createdAt'>) => {
    const fam: TemplateFamily = {
      ...data,
      id: newId('tf'),
      createdAt: new Date().toISOString(),
    };
    setTemplateFamilies((prev) => [...prev, fam]);
    return fam;
  };

  const updateTemplateFamily = (
    id: string,
    patch: Partial<Omit<TemplateFamily, 'id' | 'companyId' | 'createdAt'>>,
  ) => {
    setTemplateFamilies((prev) => prev.map((f) => f.id === id ? { ...f, ...patch } : f));
  };

  const archiveTemplateFamily = (id: string) => {
    setTemplateFamilies((prev) => prev.map((f) => f.id === id ? { ...f, isArchived: true } : f));
  };

  const completeChecklistRun = (runId: string) => {
    const nowIso = new Date().toISOString();
    setChecklistRuns((prev) => prev.map((r) =>
      r.id === runId ? { ...r, status: 'completed', completedAt: nowIso } : r,
    ));
  };

  /** Toggle a soldier's locked-on-slot state. Adds to lockedSoldierIds
   *  if absent, removes if present. */
  const toggleSlotSoldierLock = (slotId: string, soldierId: string) => {
    setSlotOperationalState((prev) => {
      const existing = prev.find((s) => s.slotId === slotId);
      const currentLocked = existing?.lockedSoldierIds ?? [];
      const nextLocked = currentLocked.includes(soldierId)
        ? currentLocked.filter((id) => id !== soldierId)
        : [...currentLocked, soldierId];
      const actorId = currentUser?.id ?? 'system';
      const nowIso = new Date().toISOString();
      const merged: SlotOperationalState = {
        ...(existing ?? { slotId, updatedAt: nowIso, updatedByUserId: actorId }),
        slotId,
        lockedSoldierIds: nextLocked.length > 0 ? nextLocked : undefined,
        updatedAt: nowIso,
        updatedByUserId: actorId,
      };
      return [...prev.filter((s) => s.slotId !== slotId), merged];
    });
  };

  /** Add a per-slot soldier exclusion until iso timestamp. */
  const addSlotExcuse = (slotId: string, excuse: SlotExcuse) => {
    setSlotOperationalState((prev) => {
      const existing = prev.find((s) => s.slotId === slotId);
      const currentExcuses = existing?.excusedUntil ?? [];
      // Replace any prior excuse for the same soldier; one excuse per
      // (slot, soldier) makes the semantics unambiguous.
      const nextExcuses = [
        ...currentExcuses.filter((e) => e.soldierId !== excuse.soldierId),
        excuse,
      ];
      const actorId = currentUser?.id ?? 'system';
      const nowIso = new Date().toISOString();
      const merged: SlotOperationalState = {
        ...(existing ?? { slotId, updatedAt: nowIso, updatedByUserId: actorId }),
        slotId,
        excusedUntil: nextExcuses,
        updatedAt: nowIso,
        updatedByUserId: actorId,
      };
      return [...prev.filter((s) => s.slotId !== slotId), merged];
    });
  };

  /** Remove a specific excuse from a slot. */
  const removeSlotExcuse = (slotId: string, soldierId: string) => {
    setSlotOperationalState((prev) => {
      const existing = prev.find((s) => s.slotId === slotId);
      if (!existing) return prev;
      const remainingExcuses = (existing.excusedUntil ?? []).filter((e) => e.soldierId !== soldierId);
      const actorId = currentUser?.id ?? 'system';
      const nowIso = new Date().toISOString();
      const merged: SlotOperationalState = {
        ...existing,
        slotId,
        excusedUntil: remainingExcuses.length > 0 ? remainingExcuses : undefined,
        updatedAt: nowIso,
        updatedByUserId: actorId,
      };
      return [...prev.filter((s) => s.slotId !== slotId), merged];
    });
  };

  // Audit trail: every operator-confirmed staffing produces a record
  // capturing the engine outcome at decision time + the final picks.
  // Persisted so refresh preserves the audit. Bounded — keep newest 200
  // to avoid unbounded growth in long demo sessions.
  const [selectorOutcomes, setSelectorOutcomes] = usePersistedState<SelectorOutcomeRecord[]>(
    'selectorOutcomes', [], SEED_VERSION,
  );

  const recordSelectorOutcome = (record: Omit<SelectorOutcomeRecord, 'id' | 'decidedAt'>) => {
    const fresh: SelectorOutcomeRecord = {
      ...record,
      id: newId('sor'),
      decidedAt: new Date().toISOString(),
    };
    setSelectorOutcomes((prev) => [fresh, ...prev].slice(0, 200));
    // Forward to Supabase when enabled. Audit records are append-only.
    persist(() => assignmentsApi.recordSelectorOutcome(fresh));
  };

  const setSlotAssignment = (
    slotId: string,
    soldierIds: string[],
    options?: { commanderSoldierId?: string; overrideId?: string; overrideAlertId?: string },
  ) => {
    const actorId = currentUser?.id ?? 'system';
    const nowIso = new Date().toISOString();
    const records = soldierIds.map((sid) => ({
      id: newId('asg'),
      slotId,
      soldierId: sid,
      role: (sid === options?.commanderSoldierId ? 'commander' : 'soldier') as 'soldier' | 'commander',
      createdBy: actorId,
      createdAt: nowIso,
      overrideId: options?.overrideId,
      overrideAlertId: options?.overrideAlertId,
    }));
    // Commander as a separate Assignment record (also tied to this slot).
    if (options?.commanderSoldierId && !soldierIds.includes(options.commanderSoldierId)) {
      records.push({
        id: newId('asg'),
        slotId,
        soldierId: options.commanderSoldierId,
        role: 'commander',
        createdBy: actorId,
        createdAt: nowIso,
        overrideId: undefined,
        overrideAlertId: undefined,
      });
    }
    setAssignments([
      ...assignments.filter((a) => a.slotId !== slotId),
      ...records,
    ]);
    // Forward atomically to Supabase. The mission/company lookup comes
    // from the slotId's parsed missionId — slotId format is
    // `mat-<missionId>-<isoDate>-<wIdx>` so we extract the mission.
    const missionId = parseMissionIdFromSlotId(slotId);
    const mission = missionId ? missions.find((m) => m.id === missionId) : undefined;
    if (mission) {
      persist(() => assignmentsApi.setSlotAssignment({
        companyId: mission.companyId,
        slotId,
        missionId: mission.id,
        records: records.map((r) => ({
          id: r.id,
          soldierId: r.soldierId,
          role: r.role,
          overrideId: r.overrideId,
          overrideAlertId: r.overrideAlertId,
        })),
      }));
    }
  };

  const clearSlotAssignment = (slotId: string) => {
    setAssignments((prev) => prev.filter((a) => a.slotId !== slotId));
    persist(() => assignmentsApi.clearSlotAssignment(slotId));
  };

  // ── Operational orders ─────────────────────────────────────────────
  const [orders, setOrders] = usePersistedState<OperationalOrder[]>('orders', mockOperationalOrders, SEED_VERSION);

  const addOrder = (data: Omit<OperationalOrder, 'id' | 'createdAt'>): OperationalOrder => {
    const o: OperationalOrder = {
      ...data,
      id:        newId('order'),
      createdAt: new Date().toISOString(),
    };
    setOrders((prev) => [...prev, o]);
    return o;
  };

  const setOrderStatus = (id: string, status: OperationalOrderStatus) => {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
  };

  // Mission notes — separate state so they can be authored independently
  // of the mission's structured definition (commanders annotate without
  // re-publishing the mission).
  const [missionNotes, setMissionNotes] = usePersistedState<MissionNote[]>('missionNotes', mockMissionNotes, SEED_VERSION);

  const addMissionNote = (data: {
    missionId: string;
    scope: 'company' | 'platoon';
    platoonId?: string;
    text: string;
  }): MissionNote => {
    const note: MissionNote = {
      id:           newId('mn'),
      missionId:    data.missionId,
      scope:        data.scope,
      platoonId:    data.platoonId,
      authorUserId: currentUser?.id ?? 'system',
      authorName:   currentUser?.name ?? '—',
      authorRole:   currentUser?.role ?? 'soldier',
      text:         data.text,
      createdAt:    new Date().toISOString(),
    };
    setMissionNotes((prev) => [...prev, note]);
    return note;
  };

  const editMissionNote = (id: string, text: string) => {
    setMissionNotes((prev) => prev.map((n) => n.id === id
      ? { ...n, text, updatedAt: new Date().toISOString() }
      : n
    ));
  };

  const deleteMissionNote = (id: string) => {
    setMissionNotes((prev) => prev.filter((n) => n.id !== id));
  };
  const [qualifications]        = useState<Qualification[]>(mockQualifications);
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>(mockEquipmentItems);

  const addEquipmentItem = (data: {
    name: string;
    category?: string;
    isConsumable?: boolean;
    unitCount?: number;
  }): { id: string } => {
    const id = newId('eq');
    const item: EquipmentItem = {
      id,
      companyId:    currentUser?.companyId ?? '',
      name:         data.name,
      category:     data.category,
      isConsumable: !!data.isConsumable,
      unitCount:    data.unitCount ?? 1,
    };
    setEquipmentItems((prev) => [...prev, item]);
    return { id };
  };
  const [soldierQualifications] = useState<SoldierQualification[]>(mockSoldierQualifications);
  const [leaveRotationPolicy]   = useState<LeaveRotationPolicy | null>(mockLeaveRotationPolicy);
  const [leaveBlocks]           = useState<LeaveBlock[]>(mockLeaveBlocks);

  // ── Leave/coverage engine foundation (slice L1 — state only) ──────────
  const [coverageEvents]     = useState<CoverageEvent[]>(mockCoverageEvents);
  const [dutyExclusions]     = useState<DutyExclusion[]>(mockDutyExclusions);
  const [leaveRotationPlans] = useState<LeaveRotationPlan[]>(mockLeaveRotationPlans);

  // ── Signed equipment (per-soldier gear ledger) ─────────────────────
  const [signedEquipment, setSignedEquipment] = usePersistedState<SignedEquipment[]>('signedEquipment', mockSignedEquipment, SEED_VERSION);
  // ── Equipment lifecycle event log (round 6) — append-only audit ────
  const [equipmentLifecycle, setEquipmentLifecycle] = useState<EquipmentLifecycleEvent[]>([]);
  // ── Equipment inventory items (CC-defined catalogue) ──────────────
  // We expose a setter alongside the existing addEquipmentItem so the
  // Rasap module can do bulk updates (CSV import, write-off, etc.) without
  // re-implementing the create-only path.
  const setEquipmentItemsState = (next: EquipmentItem[]) => setEquipmentItems(next);

  // ── Helpers ────────────────────────────────────────────────────────
  const appendLifecycle = (data: Omit<EquipmentLifecycleEvent, 'id' | 'occurredAt' | 'actorUserId' | 'actorName' | 'actorRole'>) => {
    if (!currentUser) return;
    const ev: EquipmentLifecycleEvent = {
      ...data,
      id: newId('eql'),
      actorUserId: currentUser.id,
      actorName:   currentUser.name,
      actorRole:   currentRole,
      occurredAt:  new Date().toISOString(),
    };
    setEquipmentLifecycle((prev) => [ev, ...prev]);
  };

  /** Sign an item OUT to a soldier — creates a new SignedEquipment record
   *  AND appends a sign-out LifecycleEvent. */
  const signOutEquipment = (data: {
    soldierId: string;
    itemName: string;
    category: SignedEquipment['category'];
    equipmentItemId?: string;
    serialNumber?: string;
    source?: string;
    notes?: string;
    initialCondition?: EquipmentCondition;
  }): SignedEquipment | null => {
    if (!currentUser) return null;
    const now = new Date().toISOString();
    const se: SignedEquipment = {
      id: newId('se'),
      companyId: currentUser.companyId ?? '',
      soldierId: data.soldierId,
      itemName:  data.itemName,
      category:  data.category,
      equipmentItemId: data.equipmentItemId,
      serialNumber:    data.serialNumber,
      signedByUserId:  currentUser.id,
      signedByName:    currentUser.name,
      source:          data.source ?? 'מחסן רס״פ',
      signedAt:        now,
      status:          'active',
      notes:           data.notes,
      condition:       data.initialCondition ?? 'good',
      currentLocation: 'אצל החייל',
      lastTransitionAt: now,
      eventCount: 1,
    };
    setSignedEquipment((prev) => [...prev, se]);
    appendLifecycle({
      companyId: se.companyId,
      signedEquipmentId: se.id,
      equipmentItemId: data.equipmentItemId,
      kind: 'sign-out',
      description: `החתמת ${data.itemName} ל-${data.soldierId}`,
      conditionAfter: se.condition,
      locationAfter:  se.currentLocation,
      toSoldierId: data.soldierId,
    });
    persist(() => equipmentApi.signOut({
      companyId:        se.companyId,
      soldierId:        data.soldierId,
      itemName:         data.itemName,
      category:         data.category,
      equipmentItemId:  data.equipmentItemId,
      serialNumber:     data.serialNumber,
      source:           se.source,
      notes:            data.notes,
      initialCondition: se.condition,
      signedByUserId:   currentUser.id,
      signedByName:     currentUser.name,
    }));
    return se;
  };

  /** Return an item — full or partial. Partial means damage was noted on
   *  return; the item transitions to 'in-repair' or 'returned' accordingly. */
  const returnEquipment = (data: {
    signedEquipmentId: string;
    partial?: boolean;
    damageDescription?: string;
    finalCondition?: EquipmentCondition;
  }) => {
    const now = new Date().toISOString();
    setSignedEquipment((prev) => prev.map((se) => {
      if (se.id !== data.signedEquipmentId) return se;
      const nextStatus: SignedEquipmentStatus = data.partial ? 'in-repair' : 'returned';
      const cond = data.finalCondition ?? (data.partial ? 'damaged' : 'good');
      return {
        ...se,
        status: nextStatus,
        condition: cond,
        currentLocation: data.partial ? 'מחסן רס״פ — תיקון' : 'מחסן רס״פ',
        lastTransitionAt: now,
        eventCount: (se.eventCount ?? 0) + 1,
      };
    }));
    const se = signedEquipment.find((x) => x.id === data.signedEquipmentId);
    if (se) {
      appendLifecycle({
        companyId: se.companyId,
        signedEquipmentId: se.id,
        equipmentItemId: se.equipmentItemId,
        kind: data.partial ? 'return-partial' : 'return-full',
        description: data.damageDescription
          ?? (data.partial ? 'החזרת ציוד עם בלאי' : 'החזרת ציוד תקין'),
        conditionAfter: data.finalCondition ?? (data.partial ? 'damaged' : 'good'),
        locationAfter:  data.partial ? 'מחסן רס״פ — תיקון' : 'מחסן רס״פ',
        fromSoldierId: se.soldierId,
      });
      if (currentUser) {
        persist(() => equipmentApi.returnItem({
          companyId:         se.companyId,
          signedEquipmentId: se.id,
          partial:           data.partial,
          damageDescription: data.damageDescription,
          finalCondition:    data.finalCondition,
          actorUserId:       currentUser.id,
          actorName:         currentUser.name,
        }));
      }
    }
  };

  /** Mark damage WITHOUT a return — the item stays with the soldier but
   *  the audit log captures the damage. Used by soldiers in the field. */
  const markEquipmentDamage = (data: {
    signedEquipmentId: string;
    description: string;
    newCondition?: EquipmentCondition;
  }) => {
    const now = new Date().toISOString();
    setSignedEquipment((prev) => prev.map((se) => se.id !== data.signedEquipmentId ? se : {
      ...se,
      condition: data.newCondition ?? 'damaged',
      lastTransitionAt: now,
      eventCount: (se.eventCount ?? 0) + 1,
    }));
    const se = signedEquipment.find((x) => x.id === data.signedEquipmentId);
    if (se) {
      appendLifecycle({
        companyId: se.companyId,
        signedEquipmentId: se.id,
        equipmentItemId: se.equipmentItemId,
        kind: 'damage-report',
        description: data.description,
        conditionAfter: data.newCondition ?? 'damaged',
        locationAfter:  se.currentLocation,
      });
      if (currentUser) {
        persist(() => equipmentApi.markDamage({
          companyId:         se.companyId,
          signedEquipmentId: se.id,
          description:       data.description,
          newCondition:      data.newCondition,
          actorUserId:       currentUser.id,
          actorName:         currentUser.name,
        }));
      }
    }
  };

  // Soldier self-edit of profile fields.
  const updateSoldierProfile = (data: {
    soldierId: string;
    dominantHand?: 'right' | 'left'; weaponSide?: 'right' | 'left';
    shirtSize?: string; pantsSize?: string; shoeSize?: string;
    dateOfBirth?: string;
    weaponType?: string; weaponSerial?: string;
    shirtSizeB?: string; pantsSizeB?: string;
    shirtSizeCiv?: string; pantsSizeCiv?: string;
  }) => {
    setAllSoldiers((prev) => prev.map((s) => s.id === data.soldierId
      ? {
          ...s,
          dominantHand: data.dominantHand ?? s.dominantHand,
          weaponSide:   data.weaponSide   ?? s.weaponSide,
          shirtSize:    data.shirtSize    ?? s.shirtSize,
          pantsSize:    data.pantsSize    ?? s.pantsSize,
          shoeSize:     data.shoeSize     ?? s.shoeSize,
          dateOfBirth:  data.dateOfBirth  ?? s.dateOfBirth,
          weaponType:    data.weaponType    ?? s.weaponType,
          weaponSerial:  data.weaponSerial  ?? s.weaponSerial,
          shirtSizeB:    data.shirtSizeB    ?? s.shirtSizeB,
          pantsSizeB:    data.pantsSizeB    ?? s.pantsSizeB,
          shirtSizeCiv:  data.shirtSizeCiv  ?? s.shirtSizeCiv,
          pantsSizeCiv:  data.pantsSizeCiv  ?? s.pantsSizeCiv,
        }
      : s
    ));
  };

  // PC/PS reassignment + role-management actions.
  const updateSoldierSquad = (soldierId: string, squadId: string | null) => {
    setAllSoldiers((prev) => prev.map((s) => s.id === soldierId
      ? { ...s, squadId: squadId ?? undefined }
      : s
    ));
  };

  const updateSoldierOperationalRoles = (soldierId: string, roles: OperationalRole[]) => {
    setAllSoldiers((prev) => prev.map((s) => s.id === soldierId
      ? { ...s, operationalRoles: roles }
      : s
    ));
  };

  // Functional role flags — different category from operationalRoles.
  // Used for CHAPAK/MAFLAG configurable responsibilities (kitchen-lead,
  // water-lead, equipment-lead-chapack, driver, srasap, etc.). Free-form
  // string flags so command can introduce new responsibilities without
  // schema changes.
  const updateSoldierFunctionalRoles = (soldierId: string, roles: FunctionalRole[]) => {
    setAllSoldiers((prev) => prev.map((s) => s.id === soldierId
      ? { ...s, functionalRoles: roles }
      : s
    ));
  };

  // ── Temporary command delegation ────────────────────────────────────
  const [commandDelegations, setCommandDelegations] = usePersistedState<CommandDelegation[]>('commandDelegations', mockCommandDelegations, SEED_VERSION);

  const activeCommandDelegations = (): CommandDelegation[] => {
    const now = Date.now();
    return commandDelegations.filter((d) => {
      if (d.revoked) return false;
      const s = Date.parse(d.startIso);
      const e = Date.parse(d.endIso);
      return !isNaN(s) && !isNaN(e) && s <= now && now <= e;
    });
  };

  const createCommandDelegation = (data: {
    toUserId: string;
    scope: 'company' | 'platoon';
    scopeRefId?: string;
    authorities: CommandAuthority[];
    startIso: string;
    endIso: string;
    reason?: string;
  }): CommandDelegation => {
    if (!currentUser) {
      throw new Error('createCommandDelegation requires a current user');
    }
    const target = users.find((u) => u.id === data.toUserId);
    const cd: CommandDelegation = {
      id:           newId('cd'),
      companyId:    currentUser.companyId ?? '',
      fromUserId:   currentUser.id,
      fromUserName: currentUser.name,
      toUserId:     data.toUserId,
      toUserName:   target?.name ?? '—',
      scope:        data.scope,
      scopeRefId:   data.scopeRefId,
      authorities:  data.authorities,
      startIso:     data.startIso,
      endIso:       data.endIso,
      revoked:      false,
      reason:       data.reason,
      createdAt:    new Date().toISOString(),
    };
    setCommandDelegations((prev) => [cd, ...prev]);
    addAuditLog({
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action:    'הענקת פיקוד זמני',
      target:    `${cd.toUserName} · ${cd.authorities.join(', ')}`,
    });
    return cd;
  };

  const revokeCommandDelegation = (id: string, reason?: string) => {
    setCommandDelegations((prev) => prev.map((d) => d.id === id
      ? {
          ...d,
          revoked:          true,
          revokedAt:        new Date().toISOString(),
          revokedByUserId:  currentUser?.id,
          revokeReason:     reason,
        }
      : d
    ));
    const target = commandDelegations.find((d) => d.id === id);
    if (target && currentUser) {
      addAuditLog({
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action:    'ביטול פיקוד זמני',
        target:    `${target.toUserName}${reason ? ` · ${reason}` : ''}`,
      });
    }
  };

  // ── Equipment gap reports ──────────────────────────────────────────
  const [equipmentGaps, setEquipmentGaps] = usePersistedState<EquipmentGap[]>('equipmentGaps', mockEquipmentGaps, SEED_VERSION);

  const reportEquipmentGap = (data: {
    soldierId: string;
    kind: EquipmentGapKind;
    itemName: string;
    signedEquipmentId?: string;
    description?: string;
  }): EquipmentGap => {
    const soldier = allSoldiers.find((s) => s.id === data.soldierId);
    const platoon = soldier?.squadId
      ? platoons.find((p) => squads.find((sq) => sq.id === soldier.squadId)?.platoonId === p.id)
      : undefined;
    const gap: EquipmentGap = {
      id:                  newId('eg'),
      companyId:           soldier?.companyId ?? currentUser?.companyId ?? '',
      reportedByUserId:    currentUser?.id ?? '',
      reportedBySoldierId: data.soldierId,
      reportedByName:      soldier?.name ?? '—',
      reportedByPlatoonId: platoon?.id,
      kind:                data.kind,
      itemName:            data.itemName,
      signedEquipmentId:   data.signedEquipmentId,
      description:         data.description,
      status:              'reported',
      createdAt:           new Date().toISOString(),
    };
    setEquipmentGaps((prev) => [gap, ...prev]);
    persist(() => equipmentApi.reportGap({
      companyId:           gap.companyId,
      soldierId:           data.soldierId,
      kind:                data.kind,
      itemName:            data.itemName,
      signedEquipmentId:   data.signedEquipmentId,
      description:         data.description,
      reportedByUserId:    gap.reportedByUserId,
      reportedByPlatoonId: gap.reportedByPlatoonId,
    }));
    return gap;
  };

  const setGapStatus = (id: string, patch: Partial<EquipmentGap>) =>
    setEquipmentGaps((prev) => prev.map((g) => g.id === id ? { ...g, ...patch } : g));

  const reviewEquipmentGap = (id: string) => {
    setGapStatus(id, {
      status: 'reviewed-by-platoon',
      reviewedByUserId: currentUser?.id,
      reviewedAt: new Date().toISOString(),
    });
    persist(() => equipmentApi.setGapStatus({
      gapId: id, status: 'reviewed-by-platoon', reviewerId: currentUser?.id,
    }));
  };

  const forwardEquipmentGap = (id: string) => {
    setGapStatus(id, {
      status: 'forwarded-to-rasap',
      forwardedAt: new Date().toISOString(),
    });
    persist(() => equipmentApi.setGapStatus({
      gapId: id, status: 'forwarded-to-rasap', reviewerId: currentUser?.id,
    }));
  };

  const resolveEquipmentGap = (id: string, notes?: string) => {
    setGapStatus(id, {
      status: 'resolved' as EquipmentGapStatus,
      resolvedByUserId: currentUser?.id,
      resolvedAt: new Date().toISOString(),
      resolvedNotes: notes,
    });
    persist(() => equipmentApi.setGapStatus({
      gapId: id, status: 'resolved', resolverId: currentUser?.id, notes,
    }));
  };

  const dismissEquipmentGap = (id: string, notes?: string) => {
    setGapStatus(id, {
      status: 'dismissed' as EquipmentGapStatus,
      resolvedByUserId: currentUser?.id,
      resolvedAt: new Date().toISOString(),
      resolvedNotes: notes,
    });
    persist(() => equipmentApi.setGapStatus({
      gapId: id, status: 'dismissed', resolverId: currentUser?.id, notes,
    }));
  };

  // ── Calendar events (slice 1: state + write actions, no UI uses them yet) ──
  // Slice 1 ships read-only. The actions are wired so slice 2 (week view +
  // platoon-time fill modal) and slice 3 (CC combat-block builder + locked
  // date picker) can call them without further refactoring.
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(mockCalendarEvents);

  const addCalendarEvent = (data: Omit<CalendarEvent, 'id' | 'createdAt'>): CalendarEvent => {
    const ev: CalendarEvent = {
      ...data,
      id: newId('ce'),
      createdAt: new Date().toISOString(),
    };
    setCalendarEvents((prev) => [...prev, ev]);
    return ev;
  };

  const fillPlatoonTime = (data: {
    eventId: string; platoonId: string; title: string; detail?: string;
  }) => {
    if (!currentUser) return;
    const now = new Date().toISOString();
    setCalendarEvents((prev) => prev.map((e) => {
      if (e.id !== data.eventId) return e;
      if (e.kind !== 'combat-block' || e.combatBlock?.kind !== 'platoon-time') return e;
      return {
        ...e,
        combatBlock: {
          ...e.combatBlock,
          platoonFill: {
            platoonId: data.platoonId,
            title:     data.title,
            detail:    data.detail,
            filledBy:  currentUser.id,
            filledAt:  now,
          },
        },
      };
    }));
  };

  const setLockedDate = (data: {
    companyId: string; dayIso: string; reason: string; allowsLeave?: boolean;
  }): CalendarEvent => {
    const start = `${data.dayIso}T00:00:00`;
    const end   = `${data.dayIso}T23:59:59`;
    return addCalendarEvent({
      companyId:  data.companyId,
      kind:       'locked-date',
      scope:      'company',
      scopeRefId: data.companyId,
      start, end,
      allDay:     true,
      title:      `יום נעול — ${data.reason}`,
      lockedDate: { reason: data.reason, allowsLeave: data.allowsLeave ?? false },
      createdBy:  currentUser?.id ?? 'system',
    });
  };

  const setGenerationResult = (periodId: string, warnings: ShiftWarning[], fairness: FairnessScore[]) => {
    setLastGeneratedPeriodId(periodId);
    setLastWarnings(warnings);
    setLastFairness(fairness);
  };

  useEffect(() => {
    const up   = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online',  up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  // ── Sign in (already-claimed identity) ─────────────────────────────────
  const signIn = (phone: string, password: string): { user: MockUser | null; error?: string } => {
    const cleanPhone = phone.replace(/\D/g, '');
    const user = users.find((u) => u.phone.replace(/\D/g, '') === cleanPhone) ?? null;
    if (!user) return { user: null, error: 'טלפון לא נמצא במערכת' };
    if (user.password !== password) return { user: null, error: 'סיסמה שגויה' };
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, lastSignInAt: new Date().toISOString() } : u));
    setCurrentUser(user);
    setCurrentRole(user.role);
    return { user };
  };

  // ── Claim flow: lookup phase ────────────────────────────────────────────
  // Looks up the ACTIVE Soldier slot matching phone+idLast4. Detects whether
  // a transfer would be required (the same phone has another active Soldier
  // already, in any company).
  const lookupClaim = (phone: string, idLast4: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanId4   = idLast4.trim();

    // Match against ANY soldier (active or inactive) for this phone+id pair
    const target = allSoldiers.find((s) =>
      s.phone.replace(/\D/g, '') === cleanPhone && s.idLast4 === cleanId4
    );
    if (!target) return { ok: false, error: 'לא נמצא רישום מתאים' };

    if (target.userId) {
      return { ok: false, error: 'הרישום הזה כבר תבע זהות. השתמש בלשונית "התחברות"' };
    }
    if (target.status === 'inactive') {
      return { ok: false, error: 'הרישום הזה אינו פעיל יותר' };
    }

    const company = companies.find((c) => c.id === target.companyId);
    const platoon = platoons.find((p) => p.squadIds?.includes(target.squadId ?? '') || p.id === target.squadId);

    // Transfer check: does this phone already have an active Soldier elsewhere?
    const otherActive = allSoldiers.find((s) =>
      s.phone.replace(/\D/g, '') === cleanPhone &&
      s.status === 'active' &&
      s.id !== target.id &&
      s.userId,
    );
    if (otherActive) {
      const otherCo = companies.find((c) => c.id === otherActive.companyId);
      return {
        ok: true,
        soldier: target,
        company,
        platoon,
        requiresTransfer: true,
        currentActiveCompany: { id: otherCo?.id ?? '', name: otherCo?.name ?? '' },
      };
    }

    return { ok: true, soldier: target, company, platoon };
  };

  // ── Claim flow: commit phase ────────────────────────────────────────────
  const claimIdentity = (phone: string, idLast4: string, password: string, confirmTransfer = false) => {
    const lookup = lookupClaim(phone, idLast4);
    if (!lookup.ok || !lookup.soldier) return { ok: false, error: lookup.error };
    if (lookup.requiresTransfer && !confirmTransfer) {
      return { ok: false, error: 'נדרש אישור העברה' };
    }

    const slot = lookup.soldier;
    const cleanPhone = phone.replace(/\D/g, '');
    const now = new Date().toISOString();

    // Find or create the MockUser for this phone (persons survive transfers)
    let user = users.find((u) => u.phone.replace(/\D/g, '') === cleanPhone);
    const isNewUser = !user;
    if (!user) {
      user = {
        id: newId('u'),
        name: slot.name,
        role: 'soldier',
        phone, idLast4, password,
        operationalRoles: slot.operationalRoles,
        teamClass: slot.teamClass,
        platoonId: undefined,             // set below from active soldier
        companyId: undefined,
        squadId: undefined,
        soldierProfileId: undefined,
        createdAt: now,
      } satisfies MockUser;
    }

    // Apply transfer if required: deactivate previous active soldier(s)
    if (lookup.requiresTransfer) {
      const previousActives = allSoldiers.filter((s) =>
        s.phone.replace(/\D/g, '') === cleanPhone &&
        s.status === 'active' &&
        s.id !== slot.id,
      );
      setAllSoldiers((prev) => prev.map((s) => {
        const isPrev = previousActives.some((p) => p.id === s.id);
        return isPrev ? { ...s, status: 'inactive' as const, deactivatedAt: now, deactivatedReason: 'transferred' as const } : s;
      }));
      previousActives.forEach((p) => {
        addAuditLog({
          actorName: slot.name,
          actorRole: 'soldier',
          action: 'הועבר לפלוגה חדשה',
          target: `מ-${companies.find((c) => c.id === p.companyId)?.name ?? '—'} ל-${lookup.company?.name ?? '—'}`,
        });
      });
    }

    // Bind the slot to this user (the claim)
    setAllSoldiers((prev) => prev.map((s) => s.id === slot.id
      ? { ...s, userId: user!.id, claimedAt: now }
      : s
    ));

    // Update user's scope mirrors to reflect the newly active membership
    const updatedUser: MockUser = {
      ...user!,
      role: 'soldier',
      password,
      idLast4,
      companyId: slot.companyId,
      platoonId: lookup.platoon?.id,
      squadId: slot.squadId,
      operationalRoles: slot.operationalRoles,
      teamClass: slot.teamClass,
      soldierProfileId: slot.id,
      lastSignInAt: now,
    };
    setUsers((prev) => isNewUser ? [...prev, updatedUser] : prev.map((u) => u.id === updatedUser.id ? updatedUser : u));
    setCurrentUser(updatedUser);
    setCurrentRole('soldier');

    addAuditLog({
      actorName: slot.name,
      actorRole: 'soldier',
      action: 'תבע זהות במערכת',
      target: `${slot.name} · ${lookup.company?.name ?? '—'}`,
    });

    return { ok: true, user: updatedUser };
  };

  // ── Bootstrap CC — the one self-registration path ──────────────────────
  // Used by a user who has no roster slot anywhere because they're opening
  // a brand-new company. Their next action MUST be createCompany().
  const bootstrapCC = (data: { name: string; phone: string; idLast4: string; password: string }) => {
    const cleanPhone = data.phone.replace(/\D/g, '');
    if (users.some((u) => u.phone.replace(/\D/g, '') === cleanPhone)) {
      return { ok: false, error: 'טלפון זה כבר רשום. השתמש בלשונית "התחברות"' };
    }
    const now = new Date().toISOString();
    const newUser: MockUser = {
      id: `u-${Date.now()}`,
      name: data.name.trim(),
      role: 'companyCommander',
      phone: data.phone,
      idLast4: data.idLast4,
      password: data.password,
      operationalRoles: ['מ״פ'],
      teamClass: 'חפ״ק',
      createdAt: now,
    };
    setUsers((prev) => [...prev, newUser]);
    setCurrentUser(newUser);
    setCurrentRole('companyCommander');
    return { ok: true, user: newUser };
  };

  // ── Join an EXISTING company (the only way non-commanders enter) ──
  // Officers (platoonCommander / platoonSergeant / deputyCompanyCommander) are
  // attached to the company structure; soldiers go inside a specific platoon
  // and sub-unit. There is intentionally no path for soldiers to "create" or
  // Legacy stub. The roster-first model does not permit users to "join"
  // their way into a company — they CLAIM a slot that already exists.
  // Kept only so any in-flight reference to joinCompany returns cleanly
  // until it can be removed.
  const joinCompany = (_code: string, _identity: JoinIdentity): { ok: boolean; error?: string } => {
    return {
      ok: false,
      error: 'הצטרפות לפלוגה אפשרית רק דרך תביעת זהות. בקש מהמ״מ שלך לרשום אותך.',
    };
  };

  // ── Create COMPANY (sole entry point for org creation) ─────────────────────
  // One atomic transaction: Company + Platoons + Squads. The current user
  // becomes the company commander. There is no path for non-commanders to
  // reach this — the route guard + permission helper enforce that.

  const DEFAULT_AVAILABLE_ROLES = ['קלע', 'חובש', 'נגביסט', 'מאגיסט', 'קשר מ״מ', 'רחפן', 'מ״מ', 'סמל'];

  const createCompany = (data: CreateCompanyInput): string => {
    if (!currentUser) return '';
    const companyId  = newId('co');
    const inviteCode = `CO-${Math.floor(1000 + Math.random() * 9000)}`;

    // Create platoons + sub-units first so we can reference their ids
    const newPlatoons: Platoon[] = [];
    const newSquads: Squad[] = [];
    data.platoons.forEach((p, idx) => {
      const platoonId = newId(`g-${idx}`);
      const platoonCode = `UNIT-${Math.floor(1000 + Math.random() * 9000)}`;
      const squadIds: string[] = [];
      p.squadNames.forEach((suName, sIdx) => {
        const suId = newId(`su-${idx}-${sIdx}`);
        squadIds.push(suId);
        newSquads.push({ id: suId, platoonId, name: suName, soldierIds: [] });
      });
      newPlatoons.push({
        id: platoonId,
        name: p.name,
        unitName: data.unitName,
        code: platoonCode,
        memberIds: [],
        availableRoles: DEFAULT_AVAILABLE_ROLES,
        companyId,
        squadIds,
        kind: p.isSpecial ? 'forward-command' : 'combat',
        isSpecialPlatoon: p.isSpecial,    // legacy mirror for one commit
        followsCompanyLeaveRotation: !p.isSpecial,
      });
    });

    const newCompany: Company = {
      id: companyId,
      name: data.name,
      unitName: data.unitName,
      commanderUserId: currentUser.id,
      platoonIds: newPlatoons.map((p) => p.id),
      inviteCode,
      settings: data.settings,
      createdAt: new Date().toISOString(),
    };

    setCompanies((prev) => [...prev, newCompany]);
    setPlatoons((prev)    => [...prev, ...newPlatoons]);
    setSquads((prev)  => [...prev, ...newSquads]);
    setCurrentUser((prev) => prev ? {
      ...prev,
      role: 'companyCommander',
      companyId,
    } : prev);
    setCurrentRole('companyCommander');

    return inviteCode;
  };

  // Returns an invite code an officer can paste / scan. Mock impl reuses
  // a UNIT-XXXX style code; once a real backend exists this becomes a
  // single-use signed token bound to the (companyId, role, platoonId) tuple.
  const inviteOfficer = (
    _companyId: string,
    _role: 'platoonCommander' | 'platoonSergeant',
    _platoonId?: string,
  ): string => `OFF-${Math.floor(1000 + Math.random() * 9000)}`;

  // For inviting a soldier into a specific platoon. Returns the platoon's
  // existing join code if known, else a freshly generated placeholder.
  const inviteSoldier = (platoonId: string): string => {
    const platoon = platoons.find((g) => g.id === platoonId);
    return platoon?.code ?? `INV-${Math.floor(1000 + Math.random() * 9000)}`;
  };

  const logout = () => { setCurrentUser(null); setCurrentRole('soldier'); };
  const switchRole = (role: UserRole) => setCurrentRole(role);
  // Demo-only: switch to a different mock user without re-authenticating.
  // Skips password — used by UserSwitcher in the header to flip CC/PC/Soldier
  // contexts mid-session. NOT a production code path; the real signIn must
  // remain phone+password.
  const switchUser = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    setCurrentUser(user);
    setCurrentRole(user.role);
  };

  const addPeriod    = (p: SchedulePeriod) => setPeriods((prev) => [...prev, p]);
  const updatePeriod = (p: SchedulePeriod) => setPeriods((prev) => prev.map((x) => x.id === p.id ? p : x));

  const addAuditLog = (entry: Omit<AuditLog, 'id' | 'timestamp'>) =>
    setAuditLogs((prev) => [{ ...entry, id: newId('al'), timestamp: new Date().toISOString() }, ...prev]);

  const updateSoldierAvailability = (id: string, available: boolean) =>
    setSoldiers((prev) => prev.map((s) => s.id === id ? { ...s, availability: available } : s));

  const setReminder = (r: ReminderSetting) =>
    setReminders((prev) => [...prev.filter((x) => x.timeSlotId !== r.timeSlotId), r]);

  const addLeave = (leave: Omit<Leave, 'id'>) =>
    setLeaves((prev) => [...prev, { ...leave, id: newId('lv') }]);

  const removeLeave = (id: string) =>
    setLeaves((prev) => prev.filter((l) => l.id !== id));

  const addLeaveRequest = (req: Omit<LeaveRequest, 'id' | 'status' | 'submittedAt'>) => {
    setLeaveRequests((prev) => [...prev, {
      ...req,
      id: newId('lr'),
      status: 'pending',
      submittedAt: new Date().toISOString(),
    }]);
    if (currentUser?.companyId) {
      persist(() => leavesApi.submitLeaveRequest({
        companyId:           currentUser.companyId!,
        soldierId:           req.soldierId,
        soldierName:         req.soldierName,
        soldierTeamClass:    req.soldierTeamClass,
        soldierSquadId:      req.soldierSquadId,
        soldierSquadName:    req.soldierSquadName,
        startDate: req.startDate, startTime: req.startTime,
        endDate:   req.endDate,   endTime:   req.endTime,
        reason:    req.reason,
      }));
    }
  };

  // Authorization guard for leave-request decisions. The page also
  // displays per-row buttons gated by useApprovableLeaveRequests, but
  // we re-check at the write boundary so a stale UI cannot escalate.
  const ensureCanApprove = (id: string, reviewer: MockUser): boolean => {
    const req = leaveRequests.find((r) => r.id === id);
    if (!req) return false;
    return canApproveLeaveFor(reviewer, req, soldiers, platoons, users, squads);
  };

  const approveLeaveRequest = (id: string, reviewerId: string, reviewerName: string) => {
    const reviewer = users.find((u) => u.id === reviewerId);
    if (!reviewer || !ensureCanApprove(id, reviewer)) return;
    setLeaveRequests((prev) => prev.map((r) => r.id === id
      ? { ...r, status: 'approved', reviewedBy: reviewerId, reviewedByName: reviewerName, reviewedAt: new Date().toISOString() }
      : r
    ));
    if (reviewer.companyId) {
      persist(() => leavesApi.reviewLeaveRequest({
        companyId: reviewer.companyId!,
        requestId: id, decision: 'approved',
        reviewerId, reviewerName,
      }));
    }
  };

  const rejectLeaveRequest = (id: string, reviewerId: string, reviewerName: string) => {
    const reviewer = users.find((u) => u.id === reviewerId);
    if (!reviewer || !ensureCanApprove(id, reviewer)) return;
    setLeaveRequests((prev) => prev.map((r) => r.id === id
      ? { ...r, status: 'rejected', reviewedBy: reviewerId, reviewedByName: reviewerName, reviewedAt: new Date().toISOString() }
      : r
    ));
    if (reviewer.companyId) {
      persist(() => leavesApi.reviewLeaveRequest({
        companyId: reviewer.companyId!,
        requestId: id, decision: 'rejected',
        reviewerId, reviewerName,
      }));
    }
  };

  // ── Round 4 state — Announcements / Escalations / Leave Cycles ───────
  //
  // Each action performs a permission check at the write boundary. When a
  // backend replaces this layer, the check moves server-side; the action
  // signature stays the same so consumers don't change.
  const [announcements,       setAnnouncements]       = usePersistedState<Announcement[]>('announcements', mockAnnouncements, SEED_VERSION);
  const [escalationEvents,    setEscalationEvents]    = usePersistedState<EscalationEvent[]>('escalationEvents', mockEscalationEvents, SEED_VERSION);
  const [platoonLeaveCycles,  setPlatoonLeaveCycles]  = usePersistedState<PlatoonLeaveCycle[]>('platoonLeaveCycles', mockPlatoonLeaveCycles, SEED_VERSION);

  // — Announcements —
  const addAnnouncement = (
    data: Omit<Announcement, 'id' | 'createdAt' | 'createdByUserId' | 'createdByName' | 'status'> & { status?: AnnouncementStatus },
  ): Announcement | null => {
    if (!currentUser) return null;
    if (!canCreateAnnouncement(currentUser, delegations)) return null;
    const ann: Announcement = {
      ...data,
      id: newId('ann'),
      createdByUserId: currentUser.id,
      createdByName:   currentUser.name,
      createdAt:       new Date().toISOString(),
      status:          data.status ?? 'active',
    };
    setAnnouncements((prev) => [ann, ...prev]);
    addAuditLog({ actorName: currentUser.name, actorRole: currentRole, action: 'הודעה פלוגתית חדשה', target: ann.title });
    persist(() => announcementsApi.create({
      companyId:        ann.companyId,
      kind:             ann.kind,
      title:            ann.title,
      body:             ann.body,
      audience:         ann.audience,
      startDate:        ann.startDate,
      startTime:        ann.startTime,
      endDate:          ann.endDate,
      endTime:          ann.endTime,
      pinned:           ann.pinned,
      showOnCalendar:   ann.showOnCalendar,
      status:           ann.status,
      createdByUserId:  ann.createdByUserId,
      createdByName:    ann.createdByName,
    }));
    return ann;
  };

  const updateAnnouncement = (id: string, patch: Partial<Omit<Announcement, 'id' | 'companyId' | 'createdAt' | 'createdByUserId' | 'createdByName'>>) => {
    if (!currentUser) return;
    if (!canCreateAnnouncement(currentUser, delegations)) return;
    setAnnouncements((prev) => prev.map((a) => a.id === id
      ? { ...a, ...patch, updatedAt: new Date().toISOString() }
      : a
    ));
  };

  const closeAnnouncement = (id: string) => {
    if (!currentUser) return;
    if (!canCreateAnnouncement(currentUser, delegations)) return;
    const now = new Date().toISOString();
    setAnnouncements((prev) => prev.map((a) => a.id === id
      ? { ...a, status: 'closed' as const, closedAt: now, closedByUserId: currentUser.id }
      : a
    ));
    if (currentUser.companyId) {
      persist(() => announcementsApi.close(id, currentUser.companyId!));
    }
  };

  const deleteAnnouncement = (id: string) => {
    if (!currentUser) return;
    if (!canCreateAnnouncement(currentUser, delegations)) return;
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    if (currentUser.companyId) {
      persist(() => announcementsApi.remove(id, currentUser.companyId!));
    }
  };

  // — Escalation events —
  const declareEscalation = (
    data: Omit<EscalationEvent, 'id' | 'status' | 'openedAt' | 'openedByUserId' | 'openedByName'>,
  ): EscalationEvent | null => {
    if (!currentUser) return null;
    if (!canDeclareEscalation(currentUser, delegations)) return null;
    const ev: EscalationEvent = {
      ...data,
      id: newId('esc'),
      status: 'active',
      openedByUserId: currentUser.id,
      openedByName:   currentUser.name,
      openedAt:       new Date().toISOString(),
    };
    setEscalationEvents((prev) => [ev, ...prev]);
    addAuditLog({ actorName: currentUser.name, actorRole: currentRole, action: 'פתיחת הקפצה', target: ev.reason });
    return ev;
  };

  const closeEscalation = (id: string, reason?: string) => {
    if (!currentUser) return;
    if (!canDeclareEscalation(currentUser, delegations)) return;
    const now = new Date().toISOString();
    setEscalationEvents((prev) => prev.map((e) => e.id === id
      ? { ...e,
          status: 'closed' as const,
          closedAt: now,
          closedByUserId: currentUser.id,
          closedByName:   currentUser.name,
          closeReason:    reason,
        }
      : e
    ));
    addAuditLog({ actorName: currentUser.name, actorRole: currentRole, action: 'סגירת הקפצה', target: reason ?? id });
  };

  const activeEscalationsForViewer = (): EscalationEvent[] => {
    if (!currentUser) return [];
    return escalationEvents.filter((e) => {
      if (e.status !== 'active') return false;
      // Commanders see all active escalations in their company. Soldiers
      // see only events whose audience covers them.
      const isCommander = currentRole !== 'soldier';
      if (isCommander) return e.companyId === currentUser.companyId;
      if (!currentUser.soldierProfileId) return false;
      if (e.audience.kind === 'company') return e.companyId === currentUser.companyId;
      // Inline minimal scope check to avoid runtime import cycle with
      // utils/audience.ts — projection util is consumed by surfaces, not here.
      switch (e.audience.kind) {
        case 'platoons': {
          const myPlatoonId = currentUser.platoonId ?? currentUser.commandedPlatoonId;
          return !!myPlatoonId && e.audience.platoonIds.includes(myPlatoonId);
        }
        case 'squads':
          return !!currentUser.squadId && e.audience.squadIds.includes(currentUser.squadId);
        case 'soldiers':
          return e.audience.soldierIds.includes(currentUser.soldierProfileId);
        case 'operational-roles':
          return currentUser.operationalRoles.some((r) => e.audience.kind === 'operational-roles' && e.audience.operationalRoles.includes(r));
      }
      return false;
    });
  };

  // — Platoon leave cycle —
  const addPlatoonLeaveCycle = (
    data: Omit<PlatoonLeaveCycle, 'id' | 'createdAt' | 'createdByUserId' | 'status' | 'segments'> & { segments?: PlatoonLeaveCycleSegment[]; status?: PlatoonLeaveCycle['status'] },
  ): PlatoonLeaveCycle | null => {
    if (!currentUser) return null;
    if (!canEditLeaveCycle(currentUser, delegations)) return null;
    const c: PlatoonLeaveCycle = {
      ...data,
      id: newId('plc'),
      segments: data.segments ?? [],
      status: data.status ?? 'draft',
      createdByUserId: currentUser.id,
      createdAt: new Date().toISOString(),
    };
    setPlatoonLeaveCycles((prev) => [...prev, c]);
    addAuditLog({ actorName: currentUser.name, actorRole: currentRole, action: 'יצירת סבב יציאות', target: c.name });
    return c;
  };

  const updatePlatoonLeaveCycle = (id: string, patch: Partial<Omit<PlatoonLeaveCycle, 'id' | 'companyId' | 'createdAt' | 'createdByUserId'>>) => {
    if (!currentUser || !canEditLeaveCycle(currentUser, delegations)) return;
    setPlatoonLeaveCycles((prev) => prev.map((c) => c.id === id
      ? { ...c, ...patch, updatedAt: new Date().toISOString() }
      : c
    ));
  };

  const addLeaveCycleSegment = (cycleId: string, segment: Omit<PlatoonLeaveCycleSegment, 'id'>) => {
    if (!currentUser || !canEditLeaveCycle(currentUser, delegations)) return;
    const seg: PlatoonLeaveCycleSegment = {
      ...segment,
      id: newId('seg'),
    };
    setPlatoonLeaveCycles((prev) => prev.map((c) => c.id === cycleId
      ? { ...c, segments: [...c.segments, seg], updatedAt: new Date().toISOString() }
      : c
    ));
  };

  const updateLeaveCycleSegment = (cycleId: string, segmentId: string, patch: Partial<Omit<PlatoonLeaveCycleSegment, 'id'>>) => {
    if (!currentUser || !canEditLeaveCycle(currentUser, delegations)) return;
    setPlatoonLeaveCycles((prev) => prev.map((c) => c.id === cycleId
      ? { ...c,
          segments: c.segments.map((s) => s.id === segmentId ? { ...s, ...patch } : s),
          updatedAt: new Date().toISOString() }
      : c
    ));
  };

  const removeLeaveCycleSegment = (cycleId: string, segmentId: string) => {
    if (!currentUser || !canEditLeaveCycle(currentUser, delegations)) return;
    setPlatoonLeaveCycles((prev) => prev.map((c) => c.id === cycleId
      ? { ...c, segments: c.segments.filter((s) => s.id !== segmentId), updatedAt: new Date().toISOString() }
      : c
    ));
  };

  const publishLeaveCycle = (id: string) => {
    if (!currentUser || !canEditLeaveCycle(currentUser, delegations)) return;
    const now = new Date().toISOString();
    setPlatoonLeaveCycles((prev) => prev.map((c) => c.id === id
      ? { ...c, status: 'published' as const, publishedAt: now, updatedAt: now }
      : c
    ));
  };

  // ── Logistics rotations (round 8 — Rasap-owned chores) ────────────
  const [logisticsRotations, setLogisticsRotations] = useState<LogisticsRotation[]>(mockLogisticsRotations);

  const addLogisticsRotation: AppContextType['addLogisticsRotation'] = (data) => {
    if (!currentUser) return null;
    const rotation: LogisticsRotation = {
      ...data,
      id: newId('lr'),
      status: data.status ?? 'planned',
      createdByUserId: currentUser.id,
      createdByName:   currentUser.name,
      createdAt:       new Date().toISOString(),
    };
    setLogisticsRotations((prev) => [rotation, ...prev]);
    return rotation;
  };

  const setLogisticsRotationStatus = (id: string, status: LogisticsRotationStatus) => {
    setLogisticsRotations((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
  };

  return (
    <AppContext.Provider value={{
      currentUser, users, currentRole, soldiers, periods, auditLogs, platoons,
      leaves, leaveRequests, soldierHistory, miluimPeriods, reminders, isOnline, hasEmergency,
      lastWarnings, lastFairness, lastGeneratedPeriodId, setGenerationResult,
      companies, squads, addSquad, removeSquad, renameSquad,
      createCompany, inviteOfficer, inviteSoldier,
      companyMissions, addCompanyMission, removeCompanyMission,
      overrideAlerts, recordOverrideAlert, acknowledgeAlert, resolveAlert,
      calendarEvents, addCalendarEvent, fillPlatoonTime, setLockedDate,
      missions, addMission, setMissionStatus, updateMission,
      assignments, setSlotAssignment, clearSlotAssignment,
      selectorOutcomes, recordSelectorOutcome,
      slotOperationalState, setSlotOps, clearSlotOps,
      toggleSlotSoldierLock, addSlotExcuse, removeSlotExcuse,
      checklistTemplates, checklistRuns, checklistInstances,
      createChecklistRun, setChecklistInstanceItem, completeChecklistRun,
      platoonLeaveDays, companyLeavePolicy, companyCoverageRules, soldierLeaveOverrides,
      setPlatoonLeaveDay, clearPlatoonLeaveDay, generatePlatoonRotation,
      updateCompanyLeavePolicy, upsertCoverageRule, removeCoverageRule,
      setSoldierLeaveOverride, clearSoldierLeaveOverride,
      companyBlockedDates, addCompanyBlockedDate, updateCompanyBlockedDate, removeCompanyBlockedDate,
      missionTemplates, addMissionTemplate, updateMissionTemplate,
      hideMissionTemplate, toggleMissionTemplateFavorite, incrementTemplateUsage,
      templateFamilies, addTemplateFamily, updateTemplateFamily, archiveTemplateFamily,
      orders, addOrder, setOrderStatus,
      missionNotes, addMissionNote, editMissionNote, deleteMissionNote,
      qualifications, equipmentItems, addEquipmentItem, soldierQualifications,
      leaveRotationPolicy, leaveBlocks,
      coverageEvents, dutyExclusions, leaveRotationPlans,
      signedEquipment, equipmentLifecycle,
      signOutEquipment, returnEquipment, markEquipmentDamage,
      setInventoryItems: setEquipmentItemsState,
      updateSoldierProfile,
      updateSoldierSquad, updateSoldierOperationalRoles, updateSoldierFunctionalRoles,
      commandDelegations, activeCommandDelegations,
      createCommandDelegation, revokeCommandDelegation,
      equipmentGaps,
      reportEquipmentGap, reviewEquipmentGap, forwardEquipmentGap,
      resolveEquipmentGap, dismissEquipmentGap,
      signIn, lookupClaim, claimIdentity, bootstrapCC, joinCompany,
      logout, switchRole, switchUser, addPeriod, updatePeriod, addAuditLog,
      updateSoldierAvailability, setHasEmergency, setReminder, addLeave, removeLeave,
      addLeaveRequest, approveLeaveRequest, rejectLeaveRequest,
      allSoldiers,
      soldierStatusEvents, delegations, updateSoldierStatus,
      updateSoldierStatusByCommander,
      // ── Round 4 ─────────────────────────────────────────────────────
      announcements, addAnnouncement, updateAnnouncement, closeAnnouncement, deleteAnnouncement,
      escalationEvents, declareEscalation, closeEscalation, activeEscalationsForViewer,
      platoonLeaveCycles, addPlatoonLeaveCycle, updatePlatoonLeaveCycle,
      addLeaveCycleSegment, updateLeaveCycleSegment, removeLeaveCycleSegment, publishLeaveCycle,
      logisticsRotations, addLogisticsRotation, setLogisticsRotationStatus,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

// useActivePeriod removed — Phase 7.3 stabilization. The legacy
// SchedulePeriod model has been superseded by OperationalOrder (צו),
// and no surface still reads "the active period". The persisted
// `periods` slice + addPeriod/updatePeriod mutations remain for
// back-compat with any in-flight localStorage payloads; they may be
// retired in a future seed-version bump.

// The company the current user belongs to (if any).
// company commander → his commanded company
// platoon commander / sergeant / squad commander / soldier → company of their platoon
export function useMyCompany() {
  const { currentUser, companies, platoons } = useApp();
  if (!currentUser) return null;
  if (currentUser.companyId) {
    return companies.find((c) => c.id === currentUser.companyId) ?? null;
  }
  // Fallback: derive via the user's platoon
  if (!currentUser.platoonId) return null;
  const platoon = platoons.find((g) => g.id === currentUser.platoonId);
  if (!platoon?.companyId) return null;
  return companies.find((c) => c.id === platoon.companyId) ?? null;
}

// Platoons the current user has authority over.
// companyCommander / deputyCompanyCommander → all platoons in their company
// platoonCommander / platoonSergeant         → their commanded platoon
// soldier                                    → empty (no management scope)
export function useMyPlatoons(): Platoon[] {
  const { currentUser, currentRole, platoons } = useApp();
  const company = useMyCompany();
  if (!currentUser) return [];
  if (currentRole === 'companyCommander' || currentRole === 'deputyCompanyCommander' || currentRole === 'owner') {
    if (!company) return [];
    return platoons.filter((g) => company.platoonIds.includes(g.id) || g.companyId === company.id);
  }
  if (currentRole === 'platoonCommander' || currentRole === 'platoonSergeant' || currentRole === 'manager') {
    if (currentUser.commandedPlatoonId) {
      return platoons.filter((g) => g.id === currentUser.commandedPlatoonId);
    }
    // Legacy fallback: any platoon the user is a member of
    return platoons.filter((g) => g.memberIds.includes(currentUser.id));
  }
  // רס״פ — his base role is 'soldier' but he commands the logistics
  // platoon. Treat him like a PC for "platoons under my command".
  if (isRasap(currentUser) && currentUser.commandedPlatoonId) {
    return platoons.filter((g) => g.id === currentUser.commandedPlatoonId);
  }
  return [];
}

// Squads belonging to a given platoon (organisational layer).
// Returns [] if the platoon has none defined.
export function useSquadsForPlatoon(platoonId: string | undefined): Squad[] {
  const { squads } = useApp();
  if (!platoonId) return [];
  return squads.filter((s) => s.platoonId === platoonId);
}

// Operational emergency detector — returns a non-null payload when the
// platoon/company has a LIVE issue that should shift the whole UI:
//   - any platoon below its required minimum manpower on base
//   - any open override alert with requiresImmediateAttention=true
//   - any active scheduled slot in the published period below minSoldiers
//
// Scoped per-user: a soldier never sees this (they're not allowed to see
// company-wide manpower). A platoon-tier user sees emergencies in their
// own platoon. A company-tier user sees the worst across all platoons.
export interface OperationalEmergency {
  severity: 'critical';
  message: string;
  detail?: string;
  actionLabel?: string;
  actionHref?: string;
}

export function useOperationalEmergency(): OperationalEmergency | null {
  const { currentUser, currentRole, soldiers, leaves, platoons, squads, companies, periods, overrideAlerts } = useApp();
  if (!currentUser) return null;
  if (currentRole === 'soldier') return null;     // soldiers never see this layer

  // Resolve scope: which platoons should we evaluate?
  let scopePlatoons: typeof platoons = [];
  if (currentRole === 'companyCommander' || currentRole === 'deputyCompanyCommander' || currentRole === 'owner') {
    const co = companies.find((c) => c.id === currentUser.companyId);
    scopePlatoons = co ? platoons.filter((g) => co.platoonIds.includes(g.id) || g.companyId === co.id) : [];
  } else if (currentUser.commandedPlatoonId) {
    const p = platoons.find((g) => g.id === currentUser.commandedPlatoonId);
    if (p) scopePlatoons = [p];
  } else {
    scopePlatoons = platoons.filter((g) => g.memberIds.includes(currentUser.id));
  }
  if (scopePlatoons.length === 0) return null;

  // 1. Below-minimum platoon
  const today = new Date().toISOString().slice(0, 10);
  const onLeaveIds = new Set<string>();
  leaves.forEach((lv) => {
    if (today < lv.startDate || today > lv.endDate) return;
    if (lv.scope === 'individual') lv.soldierIds.forEach((id) => onLeaveIds.add(id));
    else if (lv.scope === 'squad') soldiers.filter((s) => s.squadId === lv.squadId).forEach((s) => onLeaveIds.add(s.id));
    else soldiers.forEach((s) => onLeaveIds.add(s.id));
  });
  for (const p of scopePlatoons) {
    const ids   = squads.filter((s) => s.platoonId === p.id).map((s) => s.id);
    const ps    = soldiers.filter((s) => s.squadId && ids.includes(s.squadId));
    const onBase = ps.filter((s) => s.availability && !onLeaveIds.has(s.id)).length;
    const required = p.minSoldiersOnBase ?? 0;
    if (required > 0 && onBase < required) {
      return {
        severity: 'critical',
        message: `${p.name} מתחת לסד״כ`,
        detail: `${onBase}/${required} בבסיס · נדרשת פעולה`,
        actionLabel: 'פתח שיבוץ',
        actionHref: '/schedule',
      };
    }
  }

  // 2. High-risk open override alert
  const platoonIds = new Set(scopePlatoons.map((p) => p.id));
  const highOpen = overrideAlerts.find((a) => a.status === 'open' && a.riskLevel === 'high' && platoonIds.has(a.platoonId));
  if (highOpen) {
    return {
      severity: 'critical',
      message: highOpen.description,
      detail: highOpen.suggestedAction,
      actionLabel: 'פתח שיבוץ',
      actionHref: '/schedule',
    };
  }

  // 3. Critical slot — published period only
  const published = periods.find((p) => p.status === 'published');
  if (published) {
    for (const mt of published.missionTypes) {
      for (const ts of mt.timeSlots) {
        if (ts.status === 'conflict' && ts.assignedSoldierIds.length < mt.minSoldiers) {
          return {
            severity: 'critical',
            message: `${mt.name} לא מאוישת במלואה`,
            detail: `${ts.assignedSoldierIds.length}/${mt.minSoldiers} · ${ts.date} ${ts.startTime}`,
            actionLabel: 'פתח שיבוץ',
            actionHref: '/schedule',
          };
        }
      }
    }
  }

  return null;
}

// Override alerts visible to company leadership. A company commander sees
// alerts from every platoon in their company. A platoon commander sees
// alerts that originated in their own platoon (so they know what their
// own actions logged upward). Soldiers see nothing here.
export function useAlertsForCompany(): OverrideAlert[] {
  const { currentUser, currentRole, overrideAlerts, platoons } = useApp();
  if (!currentUser) return [];
  // Company-tier sees every alert in their company.
  if (currentRole === 'companyCommander' || currentRole === 'deputyCompanyCommander' || currentRole === 'owner') {
    return overrideAlerts.filter((a) => a.companyId === currentUser.companyId);
  }
  // Platoon-tier sees only alerts originating from their commanded platoon.
  if (currentUser.commandedPlatoonId) {
    return overrideAlerts.filter((a) => a.platoonId === currentUser.commandedPlatoonId);
  }
  // Legacy fallback for platoon-role users without commandedPlatoonId.
  if (currentRole === 'platoonCommander' || currentRole === 'platoonSergeant' || currentRole === 'manager') {
    const myPlatoonIds = platoons.filter((g) => g.memberIds.includes(currentUser.id)).map((g) => g.id);
    return overrideAlerts.filter((a) => myPlatoonIds.includes(a.platoonId));
  }
  return [];
}

// Leave requests THIS user can approve/reject. Empty for a pure company
// commander (no commanded platoon); scoped to the user's commanded platoon
// for platoon leadership and for the חפ״ק dual-role case.
export function useApprovableLeaveRequests(): LeaveRequest[] {
  const { currentUser, leaveRequests, soldiers, platoons, users, squads } = useApp();
  if (!currentUser) return [];
  return leaveRequests.filter((req) => canApproveLeaveFor(currentUser, req, soldiers, platoons, users, squads));
}

export function useVisiblePeriods() {
  const { periods, currentRole } = useApp();
  if (currentRole === 'soldier') return periods.filter((p) => p.status === 'published');
  return periods;
}

export function useAllTimeSlots(periodId: string) {
  const { periods } = useApp();
  const period = periods.find((p) => p.id === periodId);
  if (!period) return [];
  return period.missionTypes.flatMap((mt) =>
    mt.timeSlots.map((ts) => ({ ...ts, missionType: mt as MissionType }))
  );
}
