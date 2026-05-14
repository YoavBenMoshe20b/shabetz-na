/* eslint-disable react-refresh/only-export-components -- co-locating hooks with their Provider is intentional */
// LeaveProvider — leaves + leave requests + coverage events.
//
// Reads are company-scoped. Writes route through AppContext (today) and
// will route through api/leaves.ts when USE_SUPABASE=true.

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Leave, LeaveRequest, CoverageEvent } from '../types';
import { useApp, useApprovableLeaveRequests } from '../context/AppContext';
import { useAuth } from './AuthProvider';
import { useRoster } from './RosterProvider';
import { invalidate } from '../api/queryClient';

export interface LeaveApi {
  leaves:         Leave[];
  leaveRequests:  LeaveRequest[];
  coverageEvents: CoverageEvent[];

  /** Requests that the current user is authorized to approve. */
  approvableRequests: LeaveRequest[];

  /** Soldier submits a new request. */
  submitLeaveRequest: ReturnType<typeof useApp>['addLeaveRequest'];
  /** Commander approves a request. */
  approveLeaveRequest: ReturnType<typeof useApp>['approveLeaveRequest'];
  /** Commander rejects a request. */
  rejectLeaveRequest: ReturnType<typeof useApp>['rejectLeaveRequest'];

  /** Direct leave creation by commander. */
  addLeave:    ReturnType<typeof useApp>['addLeave'];
  removeLeave: ReturnType<typeof useApp>['removeLeave'];
}

const LeaveCtx = createContext<LeaveApi | null>(null);

export function LeaveProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  const { currentUser } = useAuth();
  const { soldiers } = useRoster();
  const companyId = currentUser?.companyId;

  const soldierIdsInCompany = useMemo(() => new Set(soldiers.map((s) => s.id)), [soldiers]);

  const leaves = useMemo(() =>
    app.leaves.filter((l) => l.soldierIds.some((id) => soldierIdsInCompany.has(id))),
    [app.leaves, soldierIdsInCompany],
  );

  const leaveRequests = useMemo(() =>
    app.leaveRequests.filter((r) => soldierIdsInCompany.has(r.soldierId)),
    [app.leaveRequests, soldierIdsInCompany],
  );

  const coverageEvents = useMemo(() => {
    if (!companyId) return app.coverageEvents;
    return app.coverageEvents.filter((ev) => ev.companyId === companyId);
  }, [app.coverageEvents, companyId]);

  // Routing handled by the existing approvable-requests hook in AppContext.
  const approvableRequests = useApprovableLeaveRequests();

  const wrap = <F extends (...args: never[]) => unknown>(fn: F): F =>
    ((...args: Parameters<F>) => {
      const result = fn(...args);
      if (companyId) invalidate.leaveRequests(companyId);
      return result;
    }) as F;

  const value: LeaveApi = {
    leaves,
    leaveRequests,
    coverageEvents,
    approvableRequests,
    submitLeaveRequest:   wrap(app.addLeaveRequest),
    approveLeaveRequest:  wrap(app.approveLeaveRequest),
    rejectLeaveRequest:   wrap(app.rejectLeaveRequest),
    addLeave:             wrap(app.addLeave),
    removeLeave:          wrap(app.removeLeave),
  };

  return <LeaveCtx.Provider value={value}>{children}</LeaveCtx.Provider>;
}

export function useLeave(): LeaveApi {
  const v = useContext(LeaveCtx);
  if (!v) throw new Error('useLeave must be used inside <LeaveProvider>');
  return v;
}
