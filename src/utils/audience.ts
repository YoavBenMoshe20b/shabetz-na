// ─── Audience resolver ──────────────────────────────────────────────────────
//
// Single source of truth for "given this Audience descriptor, which soldiers
// are in scope?" Used by:
//   • AnnouncementsStrip — render only announcements visible to viewer
//   • EscalationEvent — figure out who needs the banner
//   • PlatoonLeaveCycleSegment — expand a scope into concrete soldiers
//   • Calendar projection — same expansion for entry visibility
//
// Pure functions. No React, no state, no side effects. Easily testable, and
// trivially portable to a server-side projection layer when the backend
// arrives — at that point the call sites become server RPCs and the helpers
// here become the canonical implementation.
//
// Performance: O(soldiers) worst case. For a company of ~150 we run this
// dozens of times per render with no measurable cost. At the 5k-soldier
// company scale (battalion-wide future), we'd memoize per-audience inside
// the viewer, or precompute squad→soldier and platoon→soldier indices.

import type { Audience, Platoon, Soldier, Squad } from '../types';

export interface AudienceLookups {
  soldiers: Soldier[];
  platoons: Platoon[];
  squads:   Squad[];
}

/** Expand an Audience to the concrete set of soldier ids it covers. */
export function resolveAudienceToSoldierIds(
  audience: Audience,
  { soldiers, platoons, squads }: AudienceLookups,
): Set<string> {
  switch (audience.kind) {
    case 'company':
      return new Set(soldiers.map((s) => s.id));

    case 'platoons': {
      const targetPlatoons = new Set(audience.platoonIds);
      const squadIds = new Set(
        squads.filter((sq) => targetPlatoons.has(sq.platoonId)).map((sq) => sq.id),
      );
      return new Set(
        soldiers
          .filter((s) => s.squadId && squadIds.has(s.squadId))
          .map((s) => s.id),
      );
    }

    case 'squads': {
      const targets = new Set(audience.squadIds);
      return new Set(
        soldiers.filter((s) => s.squadId && targets.has(s.squadId)).map((s) => s.id),
      );
    }

    case 'soldiers':
      return new Set(audience.soldierIds);

    case 'operational-roles': {
      const targets = new Set(audience.operationalRoles);
      return new Set(
        soldiers
          .filter((s) => s.operationalRoles.some((r) => targets.has(r)))
          .map((s) => s.id),
      );
    }
  }
  // Exhaustiveness fallback (should never run)
  void platoons;
  return new Set();
}

/** Does the given viewer (by their soldier id) fall within the audience? */
export function viewerInAudience(
  audience: Audience,
  viewerSoldierId: string | undefined,
  lookups: AudienceLookups,
): boolean {
  if (!viewerSoldierId) return false;
  if (audience.kind === 'company') return true;
  const ids = resolveAudienceToSoldierIds(audience, lookups);
  return ids.has(viewerSoldierId);
}

/** Short Hebrew label describing an audience for UI rendering. */
export function describeAudience(
  audience: Audience,
  { platoons, squads }: { platoons: Platoon[]; squads: Squad[] },
): string {
  switch (audience.kind) {
    case 'company':
      return 'כל הפלוגה';
    case 'platoons': {
      const names = audience.platoonIds
        .map((id) => platoons.find((p) => p.id === id)?.name)
        .filter(Boolean);
      if (names.length === 0) return 'אין מחלקות';
      if (names.length === 1) return `מחלקה: ${names[0]}`;
      return `${names.length} מחלקות`;
    }
    case 'squads': {
      const names = audience.squadIds
        .map((id) => squads.find((s) => s.id === id)?.name)
        .filter(Boolean);
      if (names.length === 0) return 'אין כיתות';
      if (names.length === 1) return `כיתה: ${names[0]}`;
      return `${names.length} כיתות`;
    }
    case 'soldiers':
      if (audience.soldierIds.length === 0) return 'אין חיילים';
      if (audience.soldierIds.length === 1) return 'חייל אחד';
      return `${audience.soldierIds.length} חיילים`;
    case 'operational-roles':
      return `תפקידים: ${audience.operationalRoles.join(' · ')}`;
  }
}
