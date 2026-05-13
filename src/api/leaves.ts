// Leaves + leave-cycle API.

import type {
  Leave, LeaveRequest, PlatoonLeaveCycle, PlatoonLeaveCycleSegment,
} from '../types';
import { read, simulate } from './_adapter';

/* eslint-disable @typescript-eslint/no-unused-vars */
// ─── Approved leaves + requests ──────────────────────────────────────────

export function listLeavesForCompany(_companyId: string): Promise<Leave[]> {
  // Leaves currently have no companyId field — they're per-soldier. For now
  // return all; backend will scope.
  return simulate(read.leaves());
}

export function listLeaveRequestsForReviewer(reviewerSoldierIds: string[]): Promise<LeaveRequest[]> {
  return simulate(
    read.leaveRequests().filter((r) => reviewerSoldierIds.includes(r.soldierId)),
  );
}

// ─── Platoon leave cycle ─────────────────────────────────────────────────

export function activeCycleForCompany(companyId: string): Promise<PlatoonLeaveCycle | null> {
  const c = read.platoonLeaveCycles()
    .filter((x) => x.companyId === companyId && x.status !== 'archived')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return simulate(c ?? null);
}

export function addSegment(_cycleId: string, _segment: Omit<PlatoonLeaveCycleSegment, 'id'>): Promise<void> {
  return simulate(undefined);
}

export function publishCycle(_cycleId: string): Promise<void> {
  return simulate(undefined);
}
