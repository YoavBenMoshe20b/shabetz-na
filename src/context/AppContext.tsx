import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type {
  MockUser, UserRole, Soldier, SchedulePeriod, AuditLog, Group,
  MissionType, ReminderSetting, Leave, LeaveRequest, SoldierHistory, MiluimPeriod,
  ShiftWarning, FairnessScore, Company, CompanySettings, SubUnit,
  CompanyMission, OverrideAlert,
} from '../types';
import { canApproveLeaveFor } from '../utils/permissions';
import {
  mockUsers, mockSoldiers, mockSchedulePeriods, mockAuditLogs, mockGroups, mockLeaves, mockLeaveRequests,
  mockSoldierHistory, mockMiluimPeriods, mockCompanies, mockSubUnits, mockCompanyMissions, mockOverrideAlerts,
} from '../data/mockData';

interface AppContextType {
  currentUser:    MockUser | null;
  currentRole:    UserRole;
  soldiers:       Soldier[];
  periods:        SchedulePeriod[];
  auditLogs:      AuditLog[];
  groups:         Group[];
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
  subUnits:       SubUnit[];
  addSubUnit:     (data: { platoonId: string; name: string }) => SubUnit;
  removeSubUnit:  (id: string) => void;
  renameSubUnit:  (id: string, name: string) => void;
  createCompany:  (data: { name: string; unitName?: string; settings: CompanySettings }) => string;     // returns invite code
  inviteOfficer:  (companyId: string, role: 'platoonCommander' | 'platoonSergeant', platoonId?: string) => string; // returns invite code
  inviteSoldier:  (platoonId: string) => string; // returns invite code (= group code)

  // Company-level missions (created by company commander only)
  companyMissions:    CompanyMission[];
  addCompanyMission:  (data: Omit<CompanyMission, 'id' | 'createdAt'>) => CompanyMission;
  removeCompanyMission: (id: string) => void;

  // Operational override alerts
  overrideAlerts:      OverrideAlert[];
  recordOverrideAlert: (data: Omit<OverrideAlert, 'id' | 'timestamp' | 'status'>) => OverrideAlert;
  acknowledgeAlert:    (id: string, byUserId: string) => void;
  resolveAlert:        (id: string, byUserId: string) => void;

  login:          (identifier: string, password: string) => MockUser | null;
  register:       (data: { name: string; email: string; username: string; password: string }) => { user: MockUser | null; error?: string };
  joinGroup:      (code: string, role: string, subUnitId: string, pendingLeaves: Array<{ startDate: string; startTime: string; endDate: string; endTime: string; reason: string }>) => boolean;
  createGroup:    (data: { name: string; unitName?: string; availableRoles: string[]; commanderName: string; sergeantName: string; size?: number; enemyConfusion?: boolean; confusionMinutes?: number }) => string;
  logout:         () => void;
  switchRole:     (role: UserRole) => void; // dev/test only
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
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser,  setCurrentUser]  = useState<MockUser | null>(null);
  const [currentRole,  setCurrentRole]  = useState<UserRole>('soldier');
  const [users,        setUsers]        = useState<MockUser[]>(mockUsers);
  const [soldiers,     setSoldiers]     = useState<Soldier[]>(mockSoldiers);
  const [periods,      setPeriods]      = useState<SchedulePeriod[]>(mockSchedulePeriods);
  const [auditLogs,    setAuditLogs]    = useState<AuditLog[]>(mockAuditLogs);
  const [groups, setGroups]             = useState<Group[]>(mockGroups);
  const [leaves,        setLeaves]        = useState<Leave[]>(mockLeaves);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(mockLeaveRequests);
  const [soldierHistory]                  = useState<SoldierHistory[]>(mockSoldierHistory);
  const [miluimPeriods]                   = useState<MiluimPeriod[]>(mockMiluimPeriods);
  const [reminders,     setReminders]     = useState<ReminderSetting[]>([]);
  const [isOnline,     setIsOnline]     = useState(navigator.onLine);
  const [hasEmergency, setHasEmergency] = useState(false);
  const [lastWarnings,  setLastWarnings]  = useState<ShiftWarning[]>([]);
  const [lastFairness,  setLastFairness]  = useState<FairnessScore[]>([]);
  const [lastGeneratedPeriodId, setLastGeneratedPeriodId] = useState<string | null>(null);
  const [companies,     setCompanies]     = useState<Company[]>(mockCompanies);
  const [subUnits,      setSubUnits]      = useState<SubUnit[]>(mockSubUnits);

  const addSubUnit = (data: { platoonId: string; name: string }): SubUnit => {
    const newSu: SubUnit = {
      id: `su-${Date.now()}`,
      platoonId: data.platoonId,
      name: data.name,
      soldierIds: [],
    };
    setSubUnits((prev) => [...prev, newSu]);
    setGroups((prev) => prev.map((g) => g.id === data.platoonId
      ? { ...g, subUnitIds: [...(g.subUnitIds ?? []), newSu.id] }
      : g
    ));
    return newSu;
  };

  const removeSubUnit = (id: string) => {
    setSubUnits((prev) => prev.filter((s) => s.id !== id));
    setGroups((prev) => prev.map((g) => g.subUnitIds?.includes(id)
      ? { ...g, subUnitIds: g.subUnitIds.filter((x) => x !== id) }
      : g
    ));
  };

  const renameSubUnit = (id: string, name: string) =>
    setSubUnits((prev) => prev.map((s) => s.id === id ? { ...s, name } : s));

  // ── Company missions (company-tier capability — gated by canCreateCompanyMission) ──
  const [companyMissions, setCompanyMissions] = useState<CompanyMission[]>(mockCompanyMissions);

  const addCompanyMission = (data: Omit<CompanyMission, 'id' | 'createdAt'>): CompanyMission => {
    const cm: CompanyMission = {
      ...data,
      id: `cm-${Date.now()}`,
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
  const [overrideAlerts, setOverrideAlerts] = useState<OverrideAlert[]>(mockOverrideAlerts);

  const recordOverrideAlert = (data: Omit<OverrideAlert, 'id' | 'timestamp' | 'status'>): OverrideAlert => {
    const alert: OverrideAlert = {
      ...data,
      id: `al-ov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      status: 'open',
    };
    setOverrideAlerts((prev) => [alert, ...prev]);
    return alert;
  };

  const acknowledgeAlert = (id: string, byUserId: string) =>
    setOverrideAlerts((prev) => prev.map((a) => a.id === id
      ? { ...a, status: 'acknowledged', acknowledgedByUserId: byUserId, acknowledgedAt: new Date().toISOString() }
      : a
    ));

  const resolveAlert = (id: string, byUserId: string) =>
    setOverrideAlerts((prev) => prev.map((a) => a.id === id
      ? { ...a, status: 'resolved', resolvedByUserId: byUserId, resolvedAt: new Date().toISOString() }
      : a
    ));

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

  const login = (identifier: string, password: string): MockUser | null => {
    const clean = identifier.trim().toLowerCase();
    const user = users.find((u) =>
      (u.email.toLowerCase() === clean || u.username.toLowerCase() === clean) &&
      u.password === password
    ) ?? null;
    if (!user) return null;
    setCurrentUser(user);
    setCurrentRole(user.role);
    return user;
  };

  const register = (data: { name: string; email: string; username: string; password: string }): { user: MockUser | null; error?: string } => {
    const emailLower    = data.email.trim().toLowerCase();
    const usernameLower = data.username.trim().toLowerCase();
    if (users.some((u) => u.email.toLowerCase() === emailLower))       return { user: null, error: 'אימייל כבר רשום במערכת' };
    if (users.some((u) => u.username.toLowerCase() === usernameLower)) return { user: null, error: 'שם המשתמש כבר תפוס' };
    const newUser: MockUser = {
      id: `u-${Date.now()}`,
      name: data.name.trim(),
      role: 'soldier',
      phone: '',
      email: data.email.trim(),
      username: data.username.trim(),
      password: data.password,
      joinedGroupIds: [],
      operationalRoles: [],
      teamClass: '',
    };
    setUsers((prev) => [...prev, newUser]);
    setCurrentUser(newUser);
    setCurrentRole('soldier');
    return { user: newUser };
  };

  const joinGroup = (
    code: string,
    role: string,
    subUnitId: string,
    pendingLeaves: Array<{ startDate: string; startTime: string; endDate: string; endTime: string; reason: string }>,
  ): boolean => {
    const group = groups.find((g) => g.code === code.toUpperCase());
    if (!group || !currentUser) return false;
    const subUnit = subUnits.find((s) => s.id === subUnitId);
    const subUnitName = subUnit?.name ?? '';
    const soldierRecord: Soldier = {
      id: `s-${Date.now()}`,
      name: currentUser.name,
      operationalRoles: (role ? [role] : []) as import('../types').OperationalRole[],
      teamClass: subUnitName,         // legacy display field
      subUnitId,
      availability: true,
      availabilityNotes: [],
      currentLoad: 0,
      userId: currentUser.id,
    };
    setSoldiers((prev) => [...prev, soldierRecord]);
    setSubUnits((prev) => prev.map((s) => s.id === subUnitId ? { ...s, soldierIds: [...s.soldierIds, soldierRecord.id] } : s));
    setGroups((prev) => prev.map((g) => g.id === group.id ? { ...g, memberIds: [...g.memberIds, currentUser.id] } : g));
    setCurrentUser((prev) => prev ? {
      ...prev,
      joinedGroupIds: [...prev.joinedGroupIds, group.id],
      teamClass: subUnitName,
      subUnitId,
      soldierProfileId: soldierRecord.id,
    } : prev);
    pendingLeaves.forEach((lv) => {
      setLeaveRequests((prev) => [...prev, {
        ...lv,
        id: `lr-${Date.now()}-${Math.random()}`,
        soldierId: soldierRecord.id,
        soldierName: currentUser.name,
        soldierTeamClass: subUnitName,
        soldierSubUnitId: subUnitId,
        soldierSubUnitName: subUnitName,
        status: 'pending',
        submittedAt: new Date().toISOString(),
      }]);
    });
    return true;
  };

  const createGroup = (data: {
    name: string; unitName?: string; availableRoles: string[];
    commanderName: string; sergeantName: string;
    size?: number; enemyConfusion?: boolean; confusionMinutes?: number;
  }): string => {
    const code = `UNIT-${Math.floor(1000 + Math.random() * 9000)}`;
    const newGroup: Group = {
      id: `g-${Date.now()}`,
      name: data.name,
      unitName: data.unitName,
      code,
      ownerId: currentUser?.id ?? '',
      memberIds: [currentUser?.id ?? ''],
      platoonCommander: data.commanderName,
      platoonSergeant: data.sergeantName,
      scheduleManagers: [currentUser?.id ?? ''],
      availableRoles: data.availableRoles,
      size: data.size,
      enemyConfusion: data.enemyConfusion,
      confusionMinutes: data.confusionMinutes,
    };
    setGroups((prev) => [...prev, newGroup]);
    setCurrentUser((prev) => prev ? { ...prev, joinedGroupIds: [...prev.joinedGroupIds, newGroup.id], role: 'platoonCommander', commandedPlatoonId: newGroup.id } : prev);
    setCurrentRole('platoonCommander');
    return code;
  };

  // ── Company hierarchy actions ─────────────────────────────────────────────
  // These are stubs — the API surface used by the upcoming "company commander
  // setup wizard" screen. They mutate state but do not yet have a UI.

  const createCompany = (data: { name: string; unitName?: string; settings: CompanySettings }): string => {
    if (!currentUser) return '';
    const inviteCode = `CO-${Math.floor(1000 + Math.random() * 9000)}`;
    const newCo: Company = {
      id: `co-${Date.now()}`,
      name: data.name,
      unitName: data.unitName,
      commanderUserId: currentUser.id,
      platoonIds: [],
      inviteCode,
      settings: data.settings,
      createdAt: new Date().toISOString(),
    };
    setCompanies((prev) => [...prev, newCo]);
    setCurrentUser((prev) => prev ? { ...prev, role: 'companyCommander', companyId: newCo.id } : prev);
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
    const platoon = groups.find((g) => g.id === platoonId);
    return platoon?.code ?? `INV-${Math.floor(1000 + Math.random() * 9000)}`;
  };

  const logout = () => { setCurrentUser(null); setCurrentRole('soldier'); };
  const switchRole = (role: UserRole) => setCurrentRole(role);

  const addPeriod    = (p: SchedulePeriod) => setPeriods((prev) => [...prev, p]);
  const updatePeriod = (p: SchedulePeriod) => setPeriods((prev) => prev.map((x) => x.id === p.id ? p : x));

  const addAuditLog = (entry: Omit<AuditLog, 'id' | 'timestamp'>) =>
    setAuditLogs((prev) => [{ ...entry, id: `al-${Date.now()}`, timestamp: new Date().toISOString() }, ...prev]);

  const updateSoldierAvailability = (id: string, available: boolean) =>
    setSoldiers((prev) => prev.map((s) => s.id === id ? { ...s, availability: available } : s));

  const setReminder = (r: ReminderSetting) =>
    setReminders((prev) => [...prev.filter((x) => x.timeSlotId !== r.timeSlotId), r]);

  const addLeave = (leave: Omit<Leave, 'id'>) =>
    setLeaves((prev) => [...prev, { ...leave, id: `lv-${Date.now()}` }]);

  const removeLeave = (id: string) =>
    setLeaves((prev) => prev.filter((l) => l.id !== id));

  const addLeaveRequest = (req: Omit<LeaveRequest, 'id' | 'status' | 'submittedAt'>) =>
    setLeaveRequests((prev) => [...prev, {
      ...req,
      id: `lr-${Date.now()}`,
      status: 'pending',
      submittedAt: new Date().toISOString(),
    }]);

  const approveLeaveRequest = (id: string, reviewerId: string, reviewerName: string) =>
    setLeaveRequests((prev) => prev.map((r) => r.id === id
      ? { ...r, status: 'approved', reviewedBy: reviewerId, reviewedByName: reviewerName, reviewedAt: new Date().toISOString() }
      : r
    ));

  const rejectLeaveRequest = (id: string, reviewerId: string, reviewerName: string) =>
    setLeaveRequests((prev) => prev.map((r) => r.id === id
      ? { ...r, status: 'rejected', reviewedBy: reviewerId, reviewedByName: reviewerName, reviewedAt: new Date().toISOString() }
      : r
    ));

  return (
    <AppContext.Provider value={{
      currentUser, currentRole, soldiers, periods, auditLogs, groups,
      leaves, leaveRequests, soldierHistory, miluimPeriods, reminders, isOnline, hasEmergency,
      lastWarnings, lastFairness, lastGeneratedPeriodId, setGenerationResult,
      companies, subUnits, addSubUnit, removeSubUnit, renameSubUnit,
      createCompany, inviteOfficer, inviteSoldier,
      companyMissions, addCompanyMission, removeCompanyMission,
      overrideAlerts, recordOverrideAlert, acknowledgeAlert, resolveAlert,
      login, register, joinGroup, createGroup, logout, switchRole, addPeriod, updatePeriod, addAuditLog,
      updateSoldierAvailability, setHasEmergency, setReminder, addLeave, removeLeave,
      addLeaveRequest, approveLeaveRequest, rejectLeaveRequest,
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

export function useActivePeriod() {
  const { periods } = useApp();
  return periods.find((p) => p.status === 'published') ?? periods[0] ?? null;
}

// The company the current user belongs to (if any).
// company commander → his commanded company
// platoon commander / sergeant / squad commander / soldier → company of their platoon
export function useMyCompany() {
  const { currentUser, companies, groups } = useApp();
  if (!currentUser) return null;
  if (currentUser.companyId) {
    return companies.find((c) => c.id === currentUser.companyId) ?? null;
  }
  // Fallback: derive via the user's first joined platoon
  const platoon = groups.find((g) => currentUser.joinedGroupIds.includes(g.id));
  if (!platoon?.companyId) return null;
  return companies.find((c) => c.id === platoon.companyId) ?? null;
}

// Platoons the current user has authority over.
// companyCommander / deputyCompanyCommander → all platoons in their company
// platoonCommander / platoonSergeant         → their commanded platoon
// soldier                                    → empty (no management scope)
export function useMyPlatoons(): Group[] {
  const { currentUser, currentRole, groups } = useApp();
  const company = useMyCompany();
  if (!currentUser) return [];
  if (currentRole === 'companyCommander' || currentRole === 'deputyCompanyCommander' || currentRole === 'owner') {
    if (!company) return [];
    return groups.filter((g) => company.platoonIds.includes(g.id) || g.companyId === company.id);
  }
  if (currentRole === 'platoonCommander' || currentRole === 'platoonSergeant' || currentRole === 'manager') {
    if (currentUser.commandedPlatoonId) {
      return groups.filter((g) => g.id === currentUser.commandedPlatoonId);
    }
    // Legacy fallback: any platoon the user is a member of
    return groups.filter((g) => g.memberIds.includes(currentUser.id));
  }
  return [];
}

// SubUnits belonging to a given platoon (organisational layer).
// Returns [] if the platoon has none defined.
export function useSubUnitsForPlatoon(platoonId: string | undefined): SubUnit[] {
  const { subUnits } = useApp();
  if (!platoonId) return [];
  return subUnits.filter((s) => s.platoonId === platoonId);
}

// Override alerts visible to company leadership. A company commander sees
// alerts from every platoon in their company. A platoon commander sees
// alerts that originated in their own platoon (so they know what their
// own actions logged upward). Soldiers see nothing here.
export function useAlertsForCompany(): OverrideAlert[] {
  const { currentUser, currentRole, overrideAlerts, groups } = useApp();
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
    const myPlatoonIds = groups.filter((g) => g.memberIds.includes(currentUser.id)).map((g) => g.id);
    return overrideAlerts.filter((a) => myPlatoonIds.includes(a.platoonId));
  }
  return [];
}

// Leave requests THIS user can approve/reject. Empty for a pure company
// commander (no commanded platoon); scoped to the user's commanded platoon
// for platoon leadership and for the חפ״ק dual-role case.
export function useApprovableLeaveRequests(): LeaveRequest[] {
  const { currentUser, leaveRequests, soldiers, groups } = useApp();
  if (!currentUser) return [];
  return leaveRequests.filter((req) => canApproveLeaveFor(currentUser, req, soldiers, groups));
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
