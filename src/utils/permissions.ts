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

import type { UserRole, MockUser, Platoon, LeaveRequest, Soldier, PermissionToken, Delegation } from '../types';

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

export const canCreateMission    = (role: UserRole) => isPlatoonLeadership(role);
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
  return false;
}

/**
 * Can this user approve / reject the given leave request?
 *
 * Only the commander/sergeant of the SAME PLATOON the soldier belongs to.
 * Company commanders do NOT auto-approve other platoons' leaves — per spec,
 * each platoon is a closed approval scope. The exception (חפ״ק case) is
 * handled by the same predicate: a company commander who also leads חפ״ק
 * has `commandedPlatoonId === g_chapack`, so this returns true for that
 * platoon and false for siblings.
 */
export function canApproveLeaveFor(
  user: MockUser,
  request: LeaveRequest,
  soldiers: Soldier[],
  platoons: Platoon[],
): boolean {
  const soldier = soldiers.find((s) => s.id === request.soldierId);
  if (!soldier) return false;
  const platoon = platoons.find((g) => g.memberIds.includes(soldier.userId ?? ''));
  if (!platoon) return false;

  // Primary: explicit command-chain link.
  if (user.commandedPlatoonId === platoon.id) return true;

  // Legacy fallback for mock users without commandedPlatoonId set yet.
  // ONLY platoon-level roles fall through here — a pure company commander
  // (no commandedPlatoonId) deliberately does not.
  const isPlatoonRole =
    user.role === 'platoonCommander' ||
    user.role === 'platoonSergeant'  ||
    user.role === 'manager';
  if (isPlatoonRole && platoon.memberIds.includes(user.id)) return true;

  return false;
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
