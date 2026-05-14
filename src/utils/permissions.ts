// ─── Permissions ─────────────────────────────────────────────────────────────
//
// Two layers:
//
//   1. Role-only checks (legacy).  Take a UserRole, return boolean. Useful
//      for quick UI gates that don't need scope (e.g. "show emergency tab").
//
//   2. Scope-aware checks.  Take a MockUser plus the target entity and answer
//      "can THIS specific user act on THAT specific thing?" — needed because
//      a platoon commander may approve leave for HIS platoon but not for
//      another platoon. Soldiers never see base-wide manpower.
//
// Command hierarchy (highest first):
//
//   companyCommander  ≈  deputyCompanyCommander
//                          >  platoonCommander  ≈  platoonSergeant
//                                                 >  soldier
//
// Sub-units (formerly "squads/classes") are organisational only — they
// grant no permission of their own. A soldier who leads a sub-unit is
// just a soldier with that fact recorded in their operationalRoles.
//
// Legacy 'owner' ≈ companyCommander, legacy 'manager' ≈ platoonCommander
// so old mock users still resolve correctly.

import type { UserRole, MockUser, Platoon, LeaveRequest, Soldier, Squad, PermissionToken, Delegation } from '../types';

// ─── Role hierarchy ──────────────────────────────────────────────────────────

const RANK: Record<UserRole, number> = {
  companyCommander:       4,
  deputyCompanyCommander: 4,
  owner:                  4,   // legacy alias
  platoonCommander:       3,
  platoonSergeant:        3,
  manager:                3,   // legacy alias
  soldier:                1,
};

export const roleRank = (role: UserRole): number => RANK[role] ?? 0;

export const roleAtLeast = (role: UserRole, min: UserRole): boolean =>
  roleRank(role) >= roleRank(min);

// Any officer = platoon leadership or above. Sub-unit leaders are NOT
// officers in the permission sense (they're soldiers organisationally).
export const isOfficer = (role: UserRole): boolean =>
  roleAtLeast(role, 'platoonSergeant');

export const isPlatoonLeadership = (role: UserRole): boolean =>
  roleAtLeast(role, 'platoonCommander');

export const isCompanyLeadership = (role: UserRole): boolean =>
  roleAtLeast(role, 'companyCommander');

export const roleLabel = (role: UserRole): string => ({
  companyCommander:       'מ״פ',
  deputyCompanyCommander: 'סמ״פ',
  platoonCommander:       'מ״מ',
  platoonSergeant:        'סמל',
  soldier:                'חייל',
  // Legacy aliases — show operational labels even if the legacy UserRole
  // leaks through into a display path. No "בעלים" / "מנהל" wording.
  owner:                  'מ״פ',
  manager:                'מ״מ',
}[role]);

// ─── Permission tokens (new parallel model) ──────────────────────────────────
//
// The token system runs alongside the legacy role-only helpers. Existing
// `canX` predicates become thin wrappers (below) so no consumer breaks.
// New code should reach for `hasPermission(user, token, scope?)` directly.

const ALL_TOKENS: PermissionToken[] = [
  'roster.add', 'roster.edit', 'roster.remove',
  'schedule.create', 'schedule.edit', 'schedule.publish',
  'mission.create.platoon', 'mission.create.company',
  'leave.approve.platoon', 'leave.approve.company', 'leave.create.lockedDate',
  'combatClock.publish', 'combatClock.fillBlock',
  'comm.send.platoon', 'comm.send.company',
  'escalation.declare', 'escalation.respond', 'escalation.collectStatus',
  'logistics.signOut', 'logistics.signIn', 'logistics.viewAll',
  'report.viewCompanyState', 'report.viewPlatoonState',
  'announcement.create', 'leaveCycle.edit',
  'rasap.viewInventory', 'rasap.signOut', 'rasap.return',
  'rasap.markDamaged',   'rasap.resolveGap',
  'delegation.grant',
];

const PLATOON_LEADERSHIP_TOKENS: PermissionToken[] = [
  'schedule.create', 'schedule.edit',
  'mission.create.platoon',
  'leave.approve.platoon',
  'combatClock.fillBlock',
  'comm.send.platoon',
  'report.viewPlatoonState',
  'roster.edit',
  'escalation.respond',
];

const DEFAULT_TOKENS_BY_ROLE: Record<UserRole, PermissionToken[]> = {
  companyCommander:       ALL_TOKENS,
  deputyCompanyCommander: ALL_TOKENS.filter((t) => t !== 'delegation.grant'),
  owner:                  ALL_TOKENS,                            // legacy alias
  platoonCommander:       [...PLATOON_LEADERSHIP_TOKENS, 'schedule.publish'],
  platoonSergeant:        PLATOON_LEADERSHIP_TOKENS,             // peer of PC, no publish seal
  manager:                [...PLATOON_LEADERSHIP_TOKENS, 'schedule.publish'],   // legacy alias
  soldier:                [],
};

/**
 * Quick role-only check — useful when you only have a role string and
 * no scope. New code should prefer `hasPermission(user, token, scope?)`
 * which respects delegations and explicit scope.
 */
export const roleHasPermission = (role: UserRole, token: PermissionToken): boolean =>
  DEFAULT_TOKENS_BY_ROLE[role].includes(token);

/**
 * The canonical permission check. Resolves:
 *   1. Default tokens granted by the user's base role.
 *   2. Any active (non-expired) Delegations granted to this specific user
 *      or to their role broadly.
 *   3. Scope: 'company' grants apply everywhere; 'platoon' grants only to
 *      the named platoon.
 *
 * `delegations` is optional — if omitted, only role defaults are consulted.
 * Future phases (delegation grant UI) will pass the live list.
 */
export function hasPermission(
  user: MockUser,
  token: PermissionToken,
  scope?: { platoonId?: string },
  delegations: Delegation[] = [],
): boolean {
  if (roleHasPermission(user.role, token)) return true;

  const now = Date.now();
  const applies = (d: Delegation): boolean => {
    if (d.permission !== token) return false;
    if (d.expiresAt && Date.parse(d.expiresAt) < now) return false;
    if (d.grantedToUserId && d.grantedToUserId !== user.id) return false;
    if (d.grantedToRole && d.grantedToRole !== user.role) return false;
    if (d.scope.kind === 'company') return true;
    if (d.scope.kind === 'platoon') {
      return !!scope?.platoonId && d.scope.platoonId === scope.platoonId;
    }
    return false;
  };
  return delegations.some(applies);
}

// ─── Role-only helpers (legacy API kept for existing call sites) ─────────────

export const canEditSchedule     = (role: UserRole) => isPlatoonLeadership(role);
export const canPublishSchedule  = (role: UserRole) => isPlatoonLeadership(role);
export const canTriggerEmergency = (role: UserRole) => isPlatoonLeadership(role);
export const canViewAuditLog     = (role: UserRole) => isPlatoonLeadership(role);
export const canViewCommanderNotes = (role: UserRole) => isPlatoonLeadership(role);
export const canRecalculate      = (role: UserRole) => isPlatoonLeadership(role);
export const canDeleteData       = (role: UserRole) => isCompanyLeadership(role);
export const canCreateCompany    = (role: UserRole) => isCompanyLeadership(role);

// Soldiers must NEVER see base-wide manpower load (per spec §6).
export const canViewBaseWideManpower = (role: UserRole): boolean => isPlatoonLeadership(role);
export const canViewWarnings         = (role: UserRole): boolean => isPlatoonLeadership(role);
export const canViewFairness         = (role: UserRole): boolean => isPlatoonLeadership(role);

// ─── Scope-aware helpers ─────────────────────────────────────────────────────
//
// These take the actor (MockUser) and a target entity. A platoon commander
// may approve leave inside HIS platoon but not in a sibling platoon. A
// company commander may always.

/** Can this user manage the given platoon's roster, schedule, leave queue? */
export function canManagePlatoon(user: MockUser, platoon: Platoon): boolean {
  if (isCompanyLeadership(user.role)) {
    // Company commander manages every platoon in his company
    return !platoon.companyId || platoon.companyId === user.companyId;
  }
  if (isPlatoonLeadership(user.role)) {
    // Platoon commander/sergeant manage only their commanded platoon
    if (user.commandedPlatoonId && user.commandedPlatoonId === platoon.id) return true;
    // Legacy 'manager' / 'owner' fallback: if they're a member, they can manage
    return platoon.memberIds.includes(user.id);
  }
  // רס״פ — מפקד המפלג. Functional role on top of a base 'soldier' identity.
  // Manages the logistics platoon (whichever one carries his commandedPlatoonId)
  // for roster + schedule + leave queue purposes. Does NOT cascade to sibling
  // platoons even within the same company.
  if (isRasap(user) && user.commandedPlatoonId && user.commandedPlatoonId === platoon.id) {
    return true;
  }
  return false;
}

/**
 * Approval chain — who can approve THIS leave request?
 *
 * The chain depends on the REQUESTER's role, not the approver's:
 *
 *   חייל  → מ״מ או סמל של המחלקה
 *   סמל   → מ״מ של המחלקה
 *   מ״מ   → מ״פ או סמ״פ
 *   רס״פ  → מ״פ או סמ״פ      (regardless of base UserRole — operational tag)
 *   סמ״פ  → מ״פ
 *   מ״פ   → לעצמו (no approval needed)
 *
 * The function resolves the requester from request.soldierId via the
 * MockUser linked through Soldier.userId. When the link is missing
 * (legacy / unclaimed slot) we default to 'soldier' role.
 */

export type ApprovalScope =
  | 'self'                  // requester approves themselves (CC)
  | 'cc-only'               // only company commander
  | 'cc-or-deputy'          // CC or deputy
  | 'platoon-pc-only'       // platoon commander of the requester's platoon
  | 'platoon-pc-or-ps';     // PC or PS of the requester's platoon

export interface ApprovalRouting {
  scope: ApprovalScope;
  /** When scope is platoon-level, the platoon id the approver must command. */
  platoonId?: string;
}

/** Resolve the approval routing for a given leave request. Pure helper —
 *  consumed both by canApproveLeaveFor (the predicate) and by UI labels
 *  that want to display "ממתין למ״מ" / "ממתין למ״פ" etc. */
export function approvalRoutingFor(
  request: LeaveRequest,
  soldiers: Soldier[],
  users: MockUser[],
  platoons: Platoon[],
  squads: Squad[] = [],
): ApprovalRouting {
  const soldier = soldiers.find((s) => s.id === request.soldierId);

  // Resolve requester's UserRole + OperationalRole list.
  // When the soldier has no userId yet (unclaimed), fall back to soldier role.
  const requesterUser = soldier?.userId ? users.find((u) => u.id === soldier.userId) : undefined;
  const requesterRole: UserRole = requesterUser?.role ?? 'soldier';
  const requesterOps  = requesterUser?.operationalRoles ?? soldier?.operationalRoles ?? [];

  // CC requests don't need approval.
  if (requesterRole === 'companyCommander' || requesterRole === 'owner') {
    return { scope: 'self' };
  }
  // Deputy CC needs CC only.
  if (requesterRole === 'deputyCompanyCommander') {
    return { scope: 'cc-only' };
  }
  // Rasap operational role routes upward to company tier regardless of base role.
  if (requesterOps.includes('רס״פ')) {
    return { scope: 'cc-or-deputy' };
  }
  // Platoon commander goes up to company.
  if (requesterRole === 'platoonCommander' || requesterRole === 'manager') {
    return { scope: 'cc-or-deputy' };
  }

  // Platoon sergeant goes up to platoon commander only.
  if (requesterRole === 'platoonSergeant') {
    const platoonId = requesterUser?.commandedPlatoonId
      ?? findPlatoonOfSoldier(soldier, platoons, squads);
    return { scope: 'platoon-pc-only', platoonId };
  }

  // Plain soldier — PC or PS of their platoon may approve.
  const platoonId = findPlatoonOfSoldier(soldier, platoons, squads);
  return { scope: 'platoon-pc-or-ps', platoonId };
}

function findPlatoonOfSoldier(
  soldier: Soldier | undefined,
  platoons: Platoon[],
  squads: Squad[],
): string | undefined {
  if (!soldier) return undefined;
  // Modern path: via squadId.
  if (soldier.squadId) {
    const sq = squads.find((s) => s.id === soldier.squadId);
    if (sq) return sq.platoonId;
  }
  // Legacy path: memberIds.
  const p = platoons.find((g) => g.memberIds.includes(soldier.userId ?? ''));
  return p?.id;
}

/**
 * Can this user approve / reject the given leave request? Built on top
 * of approvalRoutingFor so the routing logic stays single-source.
 *
 * Note: this function preserves the legacy 4-argument signature for
 * callsites that don't have the users array handy (e.g. older calls in
 * legacy reducers). When users is missing we fall back to the simpler
 * platoon-only rule.
 */
export function canApproveLeaveFor(
  user: MockUser,
  request: LeaveRequest,
  soldiers: Soldier[],
  platoons: Platoon[],
  users?: MockUser[],
  squads?: Squad[],
): boolean {
  // Path A — full role-chain resolution when we have the users array.
  if (users) {
    const routing = approvalRoutingFor(request, soldiers, users, platoons, squads);
    switch (routing.scope) {
      case 'self':
        return false; // CC requests are self-approved at creation; no review needed.
      case 'cc-only':
        return user.role === 'companyCommander' || user.role === 'owner';
      case 'cc-or-deputy':
        return isCompanyLeadership(user.role);
      case 'platoon-pc-only':
        return user.role === 'platoonCommander' && user.commandedPlatoonId === routing.platoonId;
      case 'platoon-pc-or-ps':
        return isPlatoonLeadership(user.role) && user.commandedPlatoonId === routing.platoonId;
    }
  }

  // Path B — legacy fallback (kept for callers that don't pass users).
  const soldier = soldiers.find((s) => s.id === request.soldierId);
  if (!soldier) return false;
  const platoon = platoons.find((g) => g.memberIds.includes(soldier.userId ?? ''));
  if (!platoon) return false;

  if (user.commandedPlatoonId === platoon.id) return true;

  const isPlatoonRole =
    user.role === 'platoonCommander' ||
    user.role === 'platoonSergeant'  ||
    user.role === 'manager';
  if (isPlatoonRole && platoon.memberIds.includes(user.id)) return true;

  return false;
}

/** Approval-status display helper — what's the queue label for a pending request? */
export function approvalQueueLabel(routing: ApprovalRouting): string {
  switch (routing.scope) {
    case 'self':                return 'אישור עצמי';
    case 'cc-only':             return 'ממתין למ״פ';
    case 'cc-or-deputy':        return 'ממתין למ״פ / סמ״פ';
    case 'platoon-pc-only':     return 'ממתין למ״מ';
    case 'platoon-pc-or-ps':    return 'ממתין למ״מ / סמל';
  }
}

/** Only company-level leadership can create company-wide missions (assigned to one or more platoons). */
export const canCreateCompanyMission = (role: UserRole): boolean => isCompanyLeadership(role);

/** Soldier-side guard: does this soldier see this slot at all? Only published. */
export function canSoldierSeeSchedule(user: MockUser): boolean {
  return user.role === 'soldier' || isOfficer(user.role);
}

/** Manual-override on slots: anyone who can manage the platoon. */
export function canManuallyOverride(user: MockUser, platoon: Platoon): boolean {
  return canManagePlatoon(user, platoon);
}

// ─── Mission create / edit scope ─────────────────────────────────────────────
//
// Two concerns share a scope model:
//   1. Who can CREATE a mission and against what platoon(s)?
//   2. Who can EDIT a given existing mission?
//
// Resolution order is the same:
//   • CC/Deputy → unbounded
//   • PC/PS     → their commanded platoon's missions only (ownerRole='platoon'
//                 AND assignedPlatoonIds ⊆ their platoon)
//   • Anyone with an active Delegation (mission.create.platoon or
//                 mission.create.company) — within the delegation's scope
//   • Soldiers / other roles by default: no.

import type { Mission } from '../types';

export interface MissionCreateScope {
  /** When CC: empty array allowed (means "any platoon"). When PC: forced
   *  to the commanded platoon. When delegated: limited to delegation scope. */
  allowedPlatoonIds: string[];
  /** True when the viewer can publish company-wide (multiple platoons). */
  companyWide: boolean;
  /** Why the viewer has this scope — useful for surface UX. */
  reason: 'company-leadership' | 'platoon-leadership' | 'delegation' | 'none';
}

export function getMissionCreateScope(
  user: MockUser,
  delegations: Delegation[] = [],
): MissionCreateScope {
  // CC / Deputy → full
  if (isCompanyLeadership(user.role)) {
    return { allowedPlatoonIds: [], companyWide: true, reason: 'company-leadership' };
  }

  // PC / PS → their commanded platoon
  const isPlatoon = user.role === 'platoonCommander' || user.role === 'platoonSergeant' || user.role === 'manager';
  if (isPlatoon && user.commandedPlatoonId) {
    return {
      allowedPlatoonIds: [user.commandedPlatoonId],
      companyWide:       false,
      reason:            'platoon-leadership',
    };
  }

  // Delegation grants (active, non-expired)
  const now = Date.now();
  const grants = delegations.filter((d) => {
    if (d.permission !== 'mission.create.platoon' && d.permission !== 'mission.create.company') return false;
    if (d.expiresAt && Date.parse(d.expiresAt) < now) return false;
    if (d.grantedToUserId && d.grantedToUserId !== user.id) return false;
    if (d.grantedToRole && d.grantedToRole !== user.role) return false;
    return true;
  });

  if (grants.length === 0) {
    return { allowedPlatoonIds: [], companyWide: false, reason: 'none' };
  }

  const companyWide = grants.some((d) =>
    d.scope.kind === 'company' || d.permission === 'mission.create.company'
  );
  if (companyWide) {
    return { allowedPlatoonIds: [], companyWide: true, reason: 'delegation' };
  }
  const allowedPlatoonIds = grants
    .map((d) => d.scope.kind === 'platoon' ? d.scope.platoonId : null)
    .filter((id): id is string => !!id);
  return { allowedPlatoonIds, companyWide: false, reason: 'delegation' };
}

export function canCreateMission(user: MockUser, delegations: Delegation[] = []): boolean {
  const scope = getMissionCreateScope(user, delegations);
  return scope.reason !== 'none';
}

/** Can THIS user edit THIS mission's structured fields (manpower / hours /
 *  command / rotation / etc.)? Notes are governed separately on the detail
 *  page — author can edit own, CC can edit any. */
export function canEditMission(
  user: MockUser,
  mission: Mission,
  delegations: Delegation[] = [],
): boolean {
  // CC / Deputy can edit any mission in their company.
  if (isCompanyLeadership(user.role) && user.companyId === mission.companyId) {
    return true;
  }
  // PC / PS can edit missions assigned to their commanded platoon, but
  // only platoon-owned missions — they can't override company-wide policy.
  const isPlatoon = user.role === 'platoonCommander' || user.role === 'platoonSergeant' || user.role === 'manager';
  if (isPlatoon && user.commandedPlatoonId) {
    if (mission.ownerRole === 'platoon' && mission.assignedPlatoonIds.includes(user.commandedPlatoonId)) {
      return true;
    }
  }
  // Active delegation for mission.create within the mission's scope
  // implies edit. (Same token covers both; future slice may split.)
  const scope = getMissionCreateScope(user, delegations);
  if (scope.companyWide) return true;
  if (scope.allowedPlatoonIds.some((pid) => mission.assignedPlatoonIds.includes(pid))) {
    return true;
  }
  return false;
}

// ─── Soldier-detail visibility scopes ────────────────────────────────────────
//
// When a viewer opens another soldier's detail page, what they can see
// depends on their relationship to that soldier:
//
//   self        — viewing your own record (full view + edit own fields)
//   platoon-cmd — PC/PS of the soldier's platoon (full operational view)
//   company-cmd — CC/Deputy (full operational view across company)
//   rasap       — logistics functional role (equipment + sizes only)
//   public      — fallback (basic name/squad only — restrictive)
//
// Sensitive operational details (status history, mission load, leave
// history) are visible only to self / platoon-cmd / company-cmd.

export type SoldierDetailScope = 'self' | 'platoon-cmd' | 'company-cmd' | 'rasap' | 'public';

export function getSoldierDetailScope(
  viewer: MockUser,
  target: Soldier,
  platoons: Platoon[],
): SoldierDetailScope {
  // Self
  if (viewer.soldierProfileId === target.id) return 'self';

  // Company-tier — sees soldiers across their entire company
  if (isCompanyLeadership(viewer.role) && viewer.companyId === target.companyId) {
    return 'company-cmd';
  }

  // Platoon-tier — sees their commanded platoon's members
  if (viewer.commandedPlatoonId) {
    const cmdPlatoon = platoons.find((p) => p.id === viewer.commandedPlatoonId);
    if (cmdPlatoon) {
      const cmdSquadIds = cmdPlatoon.squadIds ?? [];
      if (target.squadId && cmdSquadIds.includes(target.squadId)) return 'platoon-cmd';
      if (cmdPlatoon.memberIds.includes(target.userId ?? '')) return 'platoon-cmd';
    }
  }

  // רס״פ — logistics-only view
  if (viewer.operationalRoles?.includes('רס״פ' as never) ||
      (viewer as MockUser & { functionalRoles?: string[] }).functionalRoles?.includes('rasap')) {
    return 'rasap';
  }

  return 'public';
}

/** Which sections of the soldier detail page each scope can view. */
export function canSeeSoldierSection(
  scope: SoldierDetailScope,
  section: 'identity' | 'operational-status' | 'roles' | 'qualifications'
         | 'sizes'    | 'equipment'          | 'history' | 'edit-controls',
): boolean {
  if (section === 'identity') return true;                                // everyone sees name + squad
  if (section === 'operational-status') return scope !== 'rasap' && scope !== 'public';
  if (section === 'roles')         return scope !== 'public';
  if (section === 'qualifications') return scope !== 'public';
  if (section === 'sizes')         return scope !== 'public';
  if (section === 'equipment')     return scope !== 'public';
  if (section === 'history')       return scope === 'self' || scope === 'platoon-cmd' || scope === 'company-cmd';
  if (section === 'edit-controls') return scope === 'platoon-cmd' || scope === 'company-cmd';
  return false;
}

// ─── Round 4 helpers — announcements, escalation, leave cycle, report 1 ──────
//
// All four surfaces are company-tier: CC + Deputy by default, anyone else
// only via an active Delegation. Helpers funnel through hasPermission() so
// the same delegation system already used elsewhere covers them for free.

export function canCreateAnnouncement(user: MockUser, delegations: Delegation[] = []): boolean {
  if (hasPermission(user, 'announcement.create', { platoonId: user.commandedPlatoonId }, delegations)) {
    return true;
  }
  // רס״פ — מפקד המפלג. Logistics broadcasts (ארוחה מוכנה / פעולה מבצעית)
  // are part of the role's day-to-day; gate at the audience level (RLS
  // / audience_within_authority on the server) rather than blocking
  // here.
  return isRasap(user);
}

export function canEditLeaveCycle(user: MockUser, delegations: Delegation[] = []): boolean {
  return hasPermission(user, 'leaveCycle.edit', undefined, delegations);
}

export function canDeclareEscalation(user: MockUser, delegations: Delegation[] = []): boolean {
  return hasPermission(user, 'escalation.declare', undefined, delegations);
}

/** דוח 1 — same scope as the company-wide state report. */
export function canViewReport1(user: MockUser, delegations: Delegation[] = []): boolean {
  // Base role check first, then functional-role grants.
  // • Shalish: read-only access (admin staff role).
  // • Rasap: read-only access for logistics decision-making — he needs
  //   to see who's on base / on leave to plan inventory and rotations.
  // Both grants are READ-only. None of these confer company-tier WRITE
  // capabilities (announcement create, escalation declare, leave cycle
  // edit) — those still require base CC/Deputy roles.
  if (hasPermission(user, 'report.viewCompanyState', undefined, delegations)) return true;
  return isShalish(user) || isRasap(user);
}

// ─── Rasap / logistics module (round 6) ────────────────────────────────
//
// Rasap permissions are granted to:
//   • CC / Deputy by default (they always carry every token)
//   • soldiers carrying the 'רס״פ' OperationalRole or functionalRoles.rasap
//   • anyone with an active Delegation
//
// The role-only checks fall through to hasPermission() which already
// respects delegations. For functional-role detection we expose a tiny
// helper used by the dashboard NavTile + the /rasap route gate.

export function isRasap(user: MockUser): boolean {
  if (user.operationalRoles.includes('רס״פ')) return true;
  const fn = (user as MockUser & { functionalRoles?: string[] }).functionalRoles;
  return !!fn && fn.includes('rasap');
}

/**
 * שליש — administrative officer attached to HQ/חפ״ק. A functional role
 * on top of a base soldier identity. Grants Report-1 read access and
 * preserves the soldier's personal toolbox (profile, leave request,
 * damage report). Does NOT grant any command-tier writes — those still
 * require base CC/PC roles.
 */
export function isShalish(user: MockUser): boolean {
  if (user.operationalRoles.includes('שליש')) return true;
  const fn = (user as MockUser & { functionalRoles?: string[] }).functionalRoles;
  return !!fn && fn.includes('shalish');
}

export function canManageEquipment(user: MockUser, delegations: Delegation[] = []): boolean {
  // CC/Deputy always; Rasap soldiers always; delegated users via token.
  if (isCompanyLeadership(user.role)) return true;
  if (isRasap(user)) return true;
  return hasPermission(user, 'rasap.signOut', undefined, delegations);
}

/** Anyone can VIEW inventory (commanders + Rasap). Editing is separate. */
export function canViewInventory(user: MockUser, delegations: Delegation[] = []): boolean {
  if (isCompanyLeadership(user.role) || isPlatoonLeadership(user.role)) return true;
  if (isRasap(user)) return true;
  return hasPermission(user, 'rasap.viewInventory', undefined, delegations);
}

/** Anyone in the chain can REPORT damage. The scope of where the report
 *  routes depends on the viewer's role, but the CTA itself is universal. */
export function canReportDamage(_user: MockUser): boolean {
  // Every authenticated user can report damage on equipment they signed for
  // or that they're commanding. UI scope-aware filtering applies elsewhere.
  return true;
}
