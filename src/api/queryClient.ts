// queryClient.ts — singleton QueryClient + central query keys.
//
// One client for the whole app, mounted at the root in main.tsx. Query
// keys live HERE (not scattered across hooks) so invalidation is
// type-safe and grep-able. Bulk invalidation is exposed via helpers.

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale-while-revalidate: 30s of cache hits, then background refresh.
      staleTime: 30_000,
      // Don't refetch on window focus in dev — chatty + makes screenshots
      // jump. Enable per-query for liveness-sensitive paths.
      refetchOnWindowFocus: false,
      // Retry once for transient backend hiccups; never retry mock paths.
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

// ─── Query keys — single source of truth ───────────────────────────────
//
// Every async read uses one of these. Strict tuple typing protects
// against typos and gives invalidation precision (`['soldiers']` ⇒
// every soldier query; `['soldiers', companyId]` ⇒ just that company).

export const qk = {
  // Identity
  session:     () => ['session'] as const,
  profile:     (userId: string) => ['profile', userId] as const,
  membership:  (userId: string) => ['membership', userId] as const,

  // Org
  companies:   () => ['companies'] as const,
  company:     (id: string) => ['company', id] as const,
  platoons:    (companyId: string) => ['platoons', companyId] as const,
  squads:      (companyId: string) => ['squads', companyId] as const,

  // Roster
  soldiers:        (companyId: string) => ['soldiers', companyId] as const,
  soldier:         (id: string) => ['soldier', id] as const,
  statusEvents:    (soldierId: string) => ['statusEvents', soldierId] as const,
  statusEventsAll: (companyId: string) => ['statusEvents', 'company', companyId] as const,

  // Leave
  leaves:        (companyId: string) => ['leaves', companyId] as const,
  leaveRequests: (companyId: string) => ['leaveRequests', companyId] as const,

  // Coverage
  coverageEvents: (companyId: string) => ['coverageEvents', companyId] as const,

  // Operational surfaces
  announcements: (companyId: string) => ['announcements', companyId] as const,
  alerts:        (companyId: string) => ['alerts', companyId] as const,
  escalations:   (companyId: string) => ['escalations', companyId] as const,
} as const;

// ─── Invalidation helpers ──────────────────────────────────────────────
// Reduce boilerplate at mutation sites. Each helper takes the minimum it
// needs to invalidate every downstream cache. Adding a new query? Add
// the touched key here.

export const invalidate = {
  /** After ANY status change on a soldier. */
  soldierStatus(companyId: string, soldierId: string) {
    queryClient.invalidateQueries({ queryKey: qk.statusEvents(soldierId) });
    queryClient.invalidateQueries({ queryKey: qk.statusEventsAll(companyId) });
    queryClient.invalidateQueries({ queryKey: qk.soldiers(companyId) });
    queryClient.invalidateQueries({ queryKey: qk.soldier(soldierId) });
  },
  /** After creating / approving / rejecting a leave request. */
  leaveRequests(companyId: string) {
    queryClient.invalidateQueries({ queryKey: qk.leaveRequests(companyId) });
    queryClient.invalidateQueries({ queryKey: qk.alerts(companyId) });
  },
  /** After approving a leave. */
  leaves(companyId: string) {
    queryClient.invalidateQueries({ queryKey: qk.leaves(companyId) });
    queryClient.invalidateQueries({ queryKey: qk.coverageEvents(companyId) });
  },
  /** After announcement create/publish. */
  announcements(companyId: string) {
    queryClient.invalidateQueries({ queryKey: qk.announcements(companyId) });
  },
};
