// useFocusItems — builds the "what requires a decision now" list for
// the current viewer. React adapter over the pure `buildFocusItems`
// engine function.
//
// Performance:
//   • The hook is COMPANY-SCOPED — only entities belonging to the
//     viewer's company are passed in. No global recompute.
//   • Memoized on the input slices. A page that renders the section
//     only re-runs when one of: escalations, leave-requests pending,
//     gaps, or the engine context (soldiers/missions/etc) actually
//     changes for THIS company.
//   • The output is capped to MAX_FOCUS_ITEMS=5 inside the engine.
//   • Stable reference when no inputs changed → React.memo on
//     FocusSection skips re-render.

import { useMemo } from 'react';
import { useApp, useApprovableLeaveRequests } from '../context/AppContext';
import { useEngineContext } from './useEngineContext';
import { buildFocusItems } from '../utils/engine/focus';
import type { FocusItem, EscalationEvent, EquipmentGap } from '../types';

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Build the Focus list for the current user + role.
 *
 * Returns empty array when:
 *   • no user signed in
 *   • role is 'soldier' (no decisions to make)
 *   • engine produced no items (everything is calm)
 */
export function useFocusItems(): FocusItem[] {
  const { currentUser, currentRole, escalationEvents, equipmentGaps, missions } = useApp();
  const ctx = useEngineContext();
  const pendingLeaveRequests = useApprovableLeaveRequests();

  // Active escalations the viewer is in audience for.
  const activeEscalations = useMemo<EscalationEvent[]>(() => {
    if (!currentUser?.companyId) return [];
    return escalationEvents.filter((e) =>
      e.status === 'active' && e.companyId === currentUser.companyId,
    );
  }, [escalationEvents, currentUser]);

  // Gaps that BLOCK a near-term mission. Definition:
  //   • status not resolved / dismissed
  //   • either linked to a soldier in a mission starting in the next 24h
  //   • OR kind === 'missing' — missing gear is higher-urgency by default
  const blockingGaps = useMemo<EquipmentGap[]>(() => {
    if (!currentUser?.companyId) return [];
    const nowMs = Date.parse(ctx.computedAt);
    const horizonMs = nowMs + 24 * MS_PER_HOUR;
    const soldiersWithUpcomingMission = new Set<string>();
    for (const m of missions) {
      if (m.companyId !== currentUser.companyId) continue;
      if (!m.startDate) continue;
      const start = Date.parse(`${m.startDate}T00:00:00`);
      if (start > nowMs && start <= horizonMs) {
        // For now, treat all soldiers in the assigned platoons as
        // "could be staffed" — the gap blocks them collectively.
        const squadIds = new Set(
          ctx.squads.filter((sq) => m.assignedPlatoonIds.includes(sq.platoonId)).map((sq) => sq.id),
        );
        for (const s of ctx.soldiers) {
          if (s.squadId && squadIds.has(s.squadId)) {
            soldiersWithUpcomingMission.add(s.id);
          }
        }
      }
    }
    return equipmentGaps.filter((g) => {
      if (g.companyId !== currentUser.companyId) return false;
      if (g.status === 'resolved' || g.status === 'dismissed') return false;
      // Missing gear is high-urgency — always qualifies.
      if (g.kind === 'missing') return true;
      // Otherwise — only when a soldier in a near-term mission.
      return soldiersWithUpcomingMission.has(g.reportedBySoldierId);
    });
  }, [equipmentGaps, missions, ctx, currentUser]);

  return useMemo(() => {
    if (!currentUser) return [];
    return buildFocusItems(currentUser, currentRole, ctx, {
      activeEscalations,
      pendingLeaveRequests,
      blockingGaps,
    });
  }, [currentUser, currentRole, ctx, activeEscalations, pendingLeaveRequests, blockingGaps]);
}
