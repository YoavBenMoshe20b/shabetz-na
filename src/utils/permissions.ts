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
//   companyCommander  >  platoonCommander  ≈  platoonSergeant
//                                    >  squadCommander  >  soldier
//
// Legacy 'owner' is treated as companyCommander, legacy 'manager' as
// platoonCommander, so old mock users keep working until migration.

import type { UserRole, MockUser, Group, LeaveRequest, TeamClass, Soldier } from '../types';

// ─── Role hierarchy ──────────────────────────────────────────────────────────

const RANK: Record<UserRole, number> = {
  companyCommander: 4,
  owner:            4,   // legacy alias
  platoonCommander: 3,
  platoonSergeant:  3,
  manager:          3,   // legacy alias
  squadCommander:   2,
  soldier:          1,
};

export const roleRank = (role: UserRole): number => RANK[role] ?? 0;

export const roleAtLeast = (role: UserRole, min: UserRole): boolean =>
  roleRank(role) >= roleRank(min);

export const isOfficer = (role: UserRole): boolean =>
  roleAtLeast(role, 'squadCommander');

export const isPlatoonLeadership = (role: UserRole): boolean =>
  roleAtLeast(role, 'platoonCommander');

export const isCompanyLeadership = (role: UserRole): boolean =>
  roleAtLeast(role, 'companyCommander');

export const roleLabel = (role: UserRole): string => ({
  companyCommander: 'מ״פ',
  platoonCommander: 'מ״מ',
  platoonSergeant:  'סמל',
  squadCommander:   'מ״כ',
  soldier:          'חייל',
  owner:            'בעלים',
  manager:          'מנהל',
}[role]);

// ─── Role-only helpers (legacy API kept for existing call sites) ─────────────

export const canCreateMission    = (role: UserRole) => isPlatoonLeadership(role);
export const canEditSchedule     = (role: UserRole) => isPlatoonLeadership(role);
export const canPublishSchedule  = (role: UserRole) => isPlatoonLeadership(role);
export const canTriggerEmergency = (role: UserRole) => isPlatoonLeadership(role);
export const canViewAuditLog     = (role: UserRole) => isPlatoonLeadership(role);
export const canViewManagerNotes = (role: UserRole) => isPlatoonLeadership(role);
export const canRecalculate      = (role: UserRole) => isPlatoonLeadership(role);
export const canCreateGroup      = (role: UserRole) => isPlatoonLeadership(role);
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
export function canManagePlatoon(user: MockUser, platoon: Group): boolean {
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

/** Can this user manage the given squad (class within a platoon)? */
export function canManageSquad(user: MockUser, platoon: Group, squad: TeamClass): boolean {
  if (canManagePlatoon(user, platoon)) return true;
  if (user.role === 'squadCommander') {
    return user.commandedPlatoonId === platoon.id && user.commandedSquadClass === squad;
  }
  return false;
}

/** Can this user approve / reject the given leave request? */
export function canApproveLeaveFor(
  user: MockUser,
  request: LeaveRequest,
  soldiers: Soldier[],
  platoons: Group[],
): boolean {
  if (isCompanyLeadership(user.role)) return true;
  // Find the soldier's platoon
  const soldier = soldiers.find((s) => s.id === request.soldierId);
  if (!soldier) return false;
  const platoon = platoons.find((g) => g.memberIds.includes(soldier.userId ?? ''));
  if (!platoon) return false;
  return canManagePlatoon(user, platoon);
}

/** Soldier-side guard: does this soldier see this slot at all? Only published. */
export function canSoldierSeeSchedule(user: MockUser): boolean {
  return user.role === 'soldier' || isOfficer(user.role);
}

/** Manual-override on slots: any officer level (squadCommander or above) for their scope. */
export function canManuallyOverride(user: MockUser, platoon: Group): boolean {
  return canManagePlatoon(user, platoon) || (
    user.role === 'squadCommander' && user.commandedPlatoonId === platoon.id
  );
}
