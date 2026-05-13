// _adapter.ts — the seam between mock + real backend.
//
// All api/* modules import their data through this file. Today the
// adapter exports references to the in-memory mock arrays. Tomorrow it
// becomes the Supabase / Firebase / fetch client, with adapter functions
// that satisfy the same shapes.
//
// Why an adapter (not just direct mockData imports):
//   1. We can introduce caching, retries, and instrumentation in ONE
//      place when backend lands.
//   2. Tests can swap the adapter for a stub.
//   3. The api/* modules don't import mockData directly — they only see
//      this adapter — so the migration is a single-file change.
//
// IMPORTANT: When AppContext mutates state, the mockData arrays are NOT
// re-bound — AppContext keeps a React-local copy. The adapter therefore
// reads from a small live registry that AppContext populates on each
// render. This is a temporary shim — under a real backend the registry
// disappears and every call goes over the wire.

import * as mock from '../data/mockData';
import type {
  Soldier, Mission, Announcement, EscalationEvent, Leave, LeaveRequest,
  OverrideAlert, PlatoonLeaveCycle, Platoon, Squad, Company,
  OperationalOrder, SoldierStatusEvent,
  SignedEquipment, EquipmentGap, EquipmentItem,
} from '../types';

// ─── Live registry — populated by AppContext on mount ────────────────────
//
// When AppContext is alive in the app, its state is the truth, not the
// static mockData arrays. AppContext calls `setLiveSnapshot()` on each
// render to publish its current state to this registry. api/* modules
// read from here first and fall back to mockData when nothing is set.
//
// This is a deliberate trade-off: it lets new pages consume api/* with
// real reactivity, while we avoid a full migration of every page.

export interface LiveSnapshot {
  soldiers?:           Soldier[];
  missions?:           Mission[];
  announcements?:      Announcement[];
  escalationEvents?:   EscalationEvent[];
  leaves?:             Leave[];
  leaveRequests?:      LeaveRequest[];
  overrideAlerts?:     OverrideAlert[];
  platoonLeaveCycles?: PlatoonLeaveCycle[];
  platoons?:           Platoon[];
  squads?:             Squad[];
  companies?:          Company[];
  orders?:             OperationalOrder[];
  statusEvents?:       SoldierStatusEvent[];
  signedEquipment?:    SignedEquipment[];
  equipmentGaps?:      EquipmentGap[];
  equipmentItems?:     EquipmentItem[];
}

let live: LiveSnapshot = {};

export function setLiveSnapshot(snap: LiveSnapshot) {
  live = snap;
}

// ─── Read helpers ────────────────────────────────────────────────────────

export const read = {
  soldiers:           () => live.soldiers           ?? mock.mockSoldiers.filter((s) => s.status === 'active'),
  missions:           () => live.missions           ?? mock.mockMissions,
  announcements:      () => live.announcements      ?? mock.mockAnnouncements,
  escalationEvents:   () => live.escalationEvents   ?? mock.mockEscalationEvents,
  leaves:             () => live.leaves             ?? mock.mockLeaves,
  leaveRequests:      () => live.leaveRequests      ?? mock.mockLeaveRequests,
  overrideAlerts:     () => live.overrideAlerts     ?? mock.mockOverrideAlerts,
  platoonLeaveCycles: () => live.platoonLeaveCycles ?? mock.mockPlatoonLeaveCycles,
  platoons:           () => live.platoons           ?? mock.mockPlatoons,
  squads:             () => live.squads             ?? mock.mockSquads,
  companies:          () => live.companies          ?? mock.mockCompanies,
  orders:             () => live.orders             ?? mock.mockOperationalOrders,
  statusEvents:       () => live.statusEvents       ?? mock.mockSoldierStatusEvents,
  signedEquipment:    () => live.signedEquipment    ?? mock.mockSignedEquipment,
  equipmentGaps:      () => live.equipmentGaps      ?? mock.mockEquipmentGaps,
  equipmentItems:     () => live.equipmentItems     ?? mock.mockEquipmentItems,
};

// ─── Simulated network — used for write paths that resolve to identity ───
//
// During development we wrap every async function in `simulate()` so the
// caller sees a real Promise (microtask) and surfaces loading states.
// Set DEV_LATENCY_MS > 0 to artificially slow reads when testing skeletons.

const DEV_LATENCY_MS = 0;

export function simulate<T>(value: T): Promise<T> {
  if (DEV_LATENCY_MS > 0) {
    return new Promise((resolve) => setTimeout(() => resolve(value), DEV_LATENCY_MS));
  }
  return Promise.resolve(value);
}
