// hooks.ts — React Query hooks for the critical async paths.
//
// Each hook wraps an api/* function and binds it to a stable cache key
// from queryClient.ts. The hooks are the FIRST step in the
// "AppContext → React Query" migration: pages can adopt them one by one.
//
// Lifecycle:
//   • USE_SUPABASE=false → fetcher returns the live mock snapshot
//     (same source the existing AppContext uses). Hooks become a
//     reactivity boundary that doesn't introduce caching pain.
//   • USE_SUPABASE=true  → fetcher hits Supabase; React Query caches
//     and invalidates on the mutations defined in queryClient.ts.

import {
  useQuery, useMutation, type UseQueryOptions,
} from '@tanstack/react-query';
import { qk, invalidate } from './queryClient';
import * as soldiersApi from './soldiers';
import * as leavesApi from './leaves';
import { read } from './_adapter';
import type {
  Soldier, SoldierStatusEvent, Leave, LeaveRequest,
  OverrideAlert, Announcement,
} from '../types';

// ─── Soldiers ──────────────────────────────────────────────────────────

export function useSoldiers(companyId: string | undefined, opts?: Partial<UseQueryOptions<Soldier[]>>) {
  return useQuery<Soldier[]>({
    queryKey: companyId ? qk.soldiers(companyId) : ['soldiers', 'none'],
    queryFn: () => companyId ? soldiersApi.listForCompany(companyId) : Promise.resolve([]),
    enabled: !!companyId,
    ...opts,
  });
}

export function useSoldier(id: string | undefined) {
  return useQuery<Soldier | null>({
    queryKey: id ? qk.soldier(id) : ['soldier', 'none'],
    queryFn: () => id ? soldiersApi.byId(id) : Promise.resolve(null),
    enabled: !!id,
  });
}

// ─── Status events ─────────────────────────────────────────────────────

export function useStatusEvents(soldierId: string | undefined) {
  return useQuery<SoldierStatusEvent[]>({
    queryKey: soldierId ? qk.statusEvents(soldierId) : ['statusEvents', 'none'],
    queryFn: () => soldierId ? soldiersApi.statusEventsFor(soldierId) : Promise.resolve([]),
    enabled: !!soldierId,
  });
}

export function useUpdateSoldierStatus() {
  return useMutation({
    mutationFn: soldiersApi.updateStatus,
  });
}

// ─── Leaves + requests ─────────────────────────────────────────────────

export function useLeaves(companyId: string | undefined) {
  return useQuery<Leave[]>({
    queryKey: companyId ? qk.leaves(companyId) : ['leaves', 'none'],
    queryFn: () => companyId ? leavesApi.listLeavesForCompany(companyId) : Promise.resolve([]),
    enabled: !!companyId,
  });
}

export function useLeaveRequests(companyId: string | undefined) {
  return useQuery<LeaveRequest[]>({
    queryKey: companyId ? qk.leaveRequests(companyId) : ['leaveRequests', 'none'],
    queryFn: () => companyId ? leavesApi.listLeaveRequestsForCompany(companyId) : Promise.resolve([]),
    enabled: !!companyId,
  });
}

export function useSubmitLeaveRequest() {
  return useMutation({
    mutationFn: leavesApi.submitLeaveRequest,
  });
}

export function useReviewLeaveRequest() {
  return useMutation({
    mutationFn: leavesApi.reviewLeaveRequest,
  });
}

// ─── Alerts ────────────────────────────────────────────────────────────
//
// Mock-only for now — Supabase tables for these land in Phase 3.

export function useOverrideAlerts(companyId: string | undefined) {
  return useQuery<OverrideAlert[]>({
    queryKey: companyId ? qk.alerts(companyId) : ['alerts', 'none'],
    queryFn: () => Promise.resolve(read.overrideAlerts().filter((a) => !companyId || a.companyId === companyId)),
    enabled: !!companyId,
  });
}

// ─── Announcements ─────────────────────────────────────────────────────

export function useAnnouncements(companyId: string | undefined) {
  return useQuery<Announcement[]>({
    queryKey: companyId ? qk.announcements(companyId) : ['announcements', 'none'],
    queryFn: () => Promise.resolve(read.announcements().filter((a) => !companyId || a.companyId === companyId)),
    enabled: !!companyId,
  });
}

// ─── Invalidation re-export (so callers don't import 2 modules) ──────
export { invalidate };
