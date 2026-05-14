// resolveSoldier.ts — single source of truth for "which soldier record
// belongs to the current user".
//
// Previously each page wrote: `s.id === user.soldierProfileId || s.userId === user.id`.
// That fallback was unsafe: a user who transferred from Company A to B
// could match an inactive A-era soldier when their B-era soldierProfileId
// hadn't been set yet. The match then leaked profile data from the old
// company.
//
// This helper applies the safe rules:
//   1. If `soldierProfileId` is set, use it as the authoritative match.
//   2. Otherwise fall back to `userId` match, but ONLY against active
//      soldiers within the user's active company.

import type { MockUser, Soldier } from '../types';

export function resolveMySoldier(
  soldiers: Soldier[],
  user: MockUser | null | undefined,
): Soldier | undefined {
  if (!user) return undefined;
  // Authoritative: soldierProfileId points at the active slot for this membership.
  if (user.soldierProfileId) {
    return soldiers.find((s) => s.id === user.soldierProfileId);
  }
  // Fallback for partial demo states / pre-claim: only match active
  // soldiers in the same company. Never silently pick a historical slot
  // from a different company.
  return soldiers.find((s) =>
    s.userId === user.id
    && s.status === 'active'
    && (!user.companyId || s.companyId === user.companyId),
  );
}
