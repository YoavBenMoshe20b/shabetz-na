// Soldiers API — read + write paths for roster.
//
// Today: reads from the live mock snapshot. Writes are noop placeholders
// that resolve to the identity (real writes today still go through
// AppContext actions). When the backend lands, the writes here move to
// `supabase.from('soldiers').upsert(...)` and AppContext stops owning
// the mutations.

import type { Soldier, SoldierStatus, SoldierStatusEvent } from '../types';
import { read, simulate } from './_adapter';

export function listForCompany(companyId: string): Promise<Soldier[]> {
  return simulate(read.soldiers().filter((s) => s.companyId === companyId));
}

export function byId(id: string): Promise<Soldier | null> {
  return simulate(read.soldiers().find((s) => s.id === id) ?? null);
}

export function statusEventsFor(soldierId: string): Promise<SoldierStatusEvent[]> {
  return simulate(read.statusEvents().filter((e) => e.soldierId === soldierId));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function updateStatus(_input: {
  soldierId: string;
  next: SoldierStatus;
  expectedUntil?: string;
  reason?: string;
}): Promise<void> {
  // Placeholder — today the live mutation lives in AppContext.updateSoldierStatus.
  // Backend: POST /soldiers/:id/status. Server appends a SoldierStatusEvent +
  // denormalizes currentStatus + emits a realtime event.
  return simulate(undefined);
}
