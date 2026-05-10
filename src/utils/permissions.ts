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

import type { UserRole, MockUser, Platoon, LeaveRequest, Soldier } from '../types';

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
  owner:                  'בעלים',
  manager:                'מנהל',
}[role]);

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
