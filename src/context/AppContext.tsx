import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type {
  MockUser, UserRole, Soldier, SchedulePeriod, AuditLog, Platoon,
  MissionType, ReminderSetting, Leave, LeaveRequest, SoldierHistory, MiluimPeriod,
  ShiftWarning, FairnessScore, Company, CompanySettings, Squad,
  CompanyMission, OverrideAlert,
} from '../types';
import { canApproveLeaveFor } from '../utils/permissions';
import {
  mockUsers, mockSoldiers, mockSchedulePeriods, mockAuditLogs, mockPlatoons, mockLeaves, mockLeaveRequests,
  mockSoldierHistory, mockMiluimPeriods, mockCompanies, mockSquads, mockCompanyMissions, mockOverrideAlerts,
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
    name: string;                  // e.g. "מחלקה א׳" or "חפ״ק"
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
  currentRole:    UserRole;
  soldiers:       Soldier[];
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

  login:          (identifier: string, password: string) => MockUser | null;
  register:       (data: { name: string; email: string; username: string; password: string }) => { user: MockUser | null; error?: string };
  // Joining always means joining an EXISTING company. Officers (platoonCommander /
  // platoonSergeant / deputyCompanyCommander) are placed inside the company
  // structure; soldiers go into a specific platoon → sub-unit.
  joinCompany:    (code: string, identity: JoinIdentity) => { ok: boolean; error?: string };
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
  const [platoons, setPlatoons]           = useState<Platoon[]>(mockPlatoons);
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
  const [squads,      setSquads]      = useState<Squad[]>(mockSquads);

  const addSquad = (data: { platoonId: string; name: string }): Squad => {
    const newSu: Squad = {
      id: `su-${Date.now()}`,
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
      operationalRoles: [],
      teamClass: '',
    };
    setUsers((prev) => [...prev, newUser]);
    setCurrentUser(newUser);
    setCurrentRole('soldier');
    return { user: newUser };
  };

  // ── Join an EXISTING company (the only way non-commanders enter) ──
  // Officers (platoonCommander / platoonSergeant / deputyCompanyCommander) are
  // attached to the company structure; soldiers go inside a specific platoon
  // and sub-unit. There is intentionally no path for soldiers to "create" or
  // "claim" anything — they only fit into structure that's already there.
  const joinCompany = (code: string, identity: JoinIdentity): { ok: boolean; error?: string } => {
    if (!currentUser) return { ok: false, error: 'לא מחובר' };
    const company = companies.find((c) => c.inviteCode === code.trim().toUpperCase());
    if (!company) return { ok: false, error: 'קוד פלוגה לא נמצא' };

    if (identity.kind === 'deputyCompanyCommander') {
      setCompanies((prev) => prev.map((c) => c.id === company.id
        ? { ...c, deputyCommanderUserId: currentUser.id }
        : c
      ));
      setCurrentUser((prev) => prev ? {
        ...prev,
        role: 'deputyCompanyCommander',
        companyId: company.id,
      } : prev);
      setCurrentRole('deputyCompanyCommander');
      return { ok: true };
    }

    // From here on we need a platoon
    const platoon = platoons.find((g) => g.id === identity.platoonId && g.companyId === company.id);
    if (!platoon) return { ok: false, error: 'המחלקה שנבחרה לא שייכת לפלוגה זו' };

    if (identity.kind === 'platoonCommander' || identity.kind === 'platoonSergeant') {
      const isCommander = identity.kind === 'platoonCommander';
      setPlatoons((prev) => prev.map((g) => g.id === platoon.id ? ({
        ...g,
        memberIds: g.memberIds.includes(currentUser.id) ? g.memberIds : [...g.memberIds, currentUser.id],
        ...(isCommander
          ? { platoonCommanderUserId: currentUser.id, platoonCommander: currentUser.name }
          : { platoonSergeantUserId:  currentUser.id, platoonSergeant:  currentUser.name }),
        scheduleManagers: g.scheduleManagers?.includes(currentUser.id)
          ? g.scheduleManagers
          : [...(g.scheduleManagers ?? []), currentUser.id],
      }) : g));
      setCurrentUser((prev) => prev ? {
        ...prev,
        role: identity.kind,
        companyId: company.id,
        commandedPlatoonId: platoon.id,
        platoonId: platoon.id,
      } : prev);
      setCurrentRole(identity.kind);
      return { ok: true };
    }

    // identity.kind === 'soldier'
    const squad = identity.squadId ? squads.find((s) => s.id === identity.squadId) : undefined;
    const squadName = squad?.name ?? '';
    const operationalRole = identity.operationalRole ?? '';
    const soldierRecord: Soldier = {
      id: `s-${Date.now()}`,
      name: currentUser.name,
      operationalRoles: (operationalRole ? [operationalRole] : []) as import('../types').OperationalRole[],
      teamClass: squadName,
      squadId: squad?.id,
      availability: true,
      availabilityNotes: [],
      currentLoad: 0,
      userId: currentUser.id,
    };
    setSoldiers((prev) => [...prev, soldierRecord]);
    if (squad) {
      setSquads((prev) => prev.map((s) => s.id === squad.id
        ? { ...s, soldierIds: [...s.soldierIds, soldierRecord.id] }
        : s
      ));
    }
    setPlatoons((prev) => prev.map((g) => g.id === platoon.id
      ? { ...g, memberIds: g.memberIds.includes(currentUser.id) ? g.memberIds : [...g.memberIds, currentUser.id] }
      : g
    ));
    setCurrentUser((prev) => prev ? {
      ...prev,
      role: 'soldier',
      companyId: company.id,
      platoonId: platoon.id,
      teamClass: squadName,
      squadId: squad?.id,
      soldierProfileId: soldierRecord.id,
    } : prev);

    (identity.pendingLeaves ?? []).forEach((lv) => {
      setLeaveRequests((prev) => [...prev, {
        ...lv,
        id: `lr-${Date.now()}-${Math.random()}`,
        soldierId: soldierRecord.id,
        soldierName: currentUser.name,
        soldierTeamClass: squadName,
        soldierSquadId: squad?.id,
        soldierSquadName: squadName || undefined,
        status: 'pending',
        submittedAt: new Date().toISOString(),
      }]);
    });
    return { ok: true };
  };

  // ── Create COMPANY (sole entry point for org creation) ─────────────────────
  // One atomic transaction: Company + Platoons + Squads. The current user
  // becomes the company commander. There is no path for non-commanders to
  // reach this — the route guard + permission helper enforce that.

  const DEFAULT_AVAILABLE_ROLES = ['קלע', 'חובש', 'נגביסט', 'מאגיסט', 'קשר מ״מ', 'רחפן', 'מ״מ', 'סמל'];

  const createCompany = (data: CreateCompanyInput): string => {
    if (!currentUser) return '';
    const companyId  = `co-${Date.now()}`;
    const inviteCode = `CO-${Math.floor(1000 + Math.random() * 9000)}`;

    // Create platoons + sub-units first so we can reference their ids
    const newPlatoons: Platoon[] = [];
    const newSquads: Squad[] = [];
    data.platoons.forEach((p, idx) => {
      const platoonId = `g-${Date.now()}-${idx}`;
      const platoonCode = `UNIT-${Math.floor(1000 + Math.random() * 9000)}`;
      const squadIds: string[] = [];
      p.squadNames.forEach((suName, sIdx) => {
        const suId = `su-${Date.now()}-${idx}-${sIdx}`;
        squadIds.push(suId);
        newSquads.push({ id: suId, platoonId, name: suName, soldierIds: [] });
      });
      newPlatoons.push({
        id: platoonId,
        name: p.name,
        unitName: data.unitName,
        code: platoonCode,
        memberIds: [],                            // populated as users join
        availableRoles: DEFAULT_AVAILABLE_ROLES,
        companyId,
        squadIds,
        isSpecialPlatoon: p.isSpecial,
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
      currentUser, currentRole, soldiers, periods, auditLogs, platoons,
      leaves, leaveRequests, soldierHistory, miluimPeriods, reminders, isOnline, hasEmergency,
      lastWarnings, lastFairness, lastGeneratedPeriodId, setGenerationResult,
      companies, squads, addSquad, removeSquad, renameSquad,
      createCompany, inviteOfficer, inviteSoldier,
      companyMissions, addCompanyMission, removeCompanyMission,
      overrideAlerts, recordOverrideAlert, acknowledgeAlert, resolveAlert,
      login, register, joinCompany, logout, switchRole, addPeriod, updatePeriod, addAuditLog,
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
  const { currentUser, leaveRequests, soldiers, platoons } = useApp();
  if (!currentUser) return [];
  return leaveRequests.filter((req) => canApproveLeaveFor(currentUser, req, soldiers, platoons));
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
