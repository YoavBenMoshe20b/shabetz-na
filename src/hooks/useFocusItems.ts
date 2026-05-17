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

// MS_PER_HOUR removed — equipment-gap blocking-soldier derivation
// is no longer in this hook (§2 moved gaps to the alerts feed).

/**
 * Build the Focus list for the current user + role.
 *
 * Returns empty array when:
 *   • no user signed in
 *   • role is 'soldier' (no decisions to make)
 *   • engine produced no items (everything is calm)
 */
export function useFocusItems(): FocusItem[] {
  const { currentUser, currentRole, escalationEvents } = useApp();
  const ctx = useEngineContext();
  const pendingLeaveRequests = useApprovableLeaveRequests();

  // Active escalations the viewer is in audience for.
  const activeEscalations = useMemo<EscalationEvent[]>(() => {
    if (!currentUser?.companyId) return [];
    return escalationEvents.filter((e) =>
      e.status === 'active' && e.companyId === currentUser.companyId,
    );
  }, [escalationEvents, currentUser]);

  // §2 — equipment gaps NO LONGER surface as Focus items.
  // "דורש החלטה" is reserved for genuine command decisions:
  //   - approve / reject leave request
  //   - respond to active escalation
  //   - publish / re-publish the schedule
  // Equipment shortages flow through the ALERTS layer (api/alerts.ts
  // emits them with kind 'equipment-gap'). The bell icon + AlertsSheet
  // is the right surface for logistics state; FocusSection stays focused
  // on operational decisions.
  const blockingGaps: EquipmentGap[] = [];

  return useMemo(() => {
    if (!currentUser) return [];
    return buildFocusItems(currentUser, currentRole, ctx, {
      activeEscalations,
      pendingLeaveRequests,
      blockingGaps,
    });
  }, [currentUser, currentRole, ctx, activeEscalations, pendingLeaveRequests]);
}
