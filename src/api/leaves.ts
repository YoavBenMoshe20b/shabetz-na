// Leaves + leave-cycle API.

import type {
  Leave, LeaveRequest, LeaveRequestStatus, LeaveScope,
  PlatoonLeaveCycle, PlatoonLeaveCycleSegment,
} from '../types';
import { read, simulate, USE_SUPABASE, supabase } from './_adapter';
import { invalidate } from './queryClient';

// ─── Approved leaves + requests ──────────────────────────────────────────

export async function listLeavesForCompany(companyId: string): Promise<Leave[]> {
  if (USE_SUPABASE) {
    const { data, error } = await supabase()
      .from('leaves')
      .select('*')
      .eq('company_id', companyId);
    if (error) throw error;
    return (data ?? []).map(mapLeave);
  }
  return simulate(read.leaves());
}

export async function listLeaveRequestsForCompany(companyId: string): Promise<LeaveRequest[]> {
  if (USE_SUPABASE) {
    const { data, error } = await supabase()
      .from('leave_requests')
      .select('*')
      .eq('company_id', companyId)
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapLeaveRequest);
  }
  return simulate(read.leaveRequests());
}

// ─── Soldier submits a request ───────────────────────────────────────────

export interface SubmitLeaveRequestInput {
  companyId:           string;
  soldierId:           string;
  soldierName:         string;
  soldierTeamClass?:   string;
  soldierSquadId?:     string;
  soldierSquadName?:   string;
  startDate: string; startTime: string;
  endDate:   string; endTime:   string;
  reason: string;
}

export async function submitLeaveRequest(input: SubmitLeaveRequestInput): Promise<void> {
  if (!USE_SUPABASE) {
    // Mock: AppContext.addLeaveRequest owns it.
    return simulate(undefined);
  }
  const { error } = await supabase()
    .from('leave_requests')
    .insert({
      company_id:         input.companyId,
      soldier_id:         input.soldierId,
      soldier_name:       input.soldierName,
      soldier_team_class: input.soldierTeamClass ?? '',
      soldier_squad_id:   input.soldierSquadId ?? null,
      soldier_squad_name: input.soldierSquadName ?? null,
      start_date: input.startDate, start_time: input.startTime,
      end_date:   input.endDate,   end_time:   input.endTime,
      reason: input.reason,
      status: 'pending' satisfies LeaveRequestStatus,
    });
  if (error) throw error;
  invalidate.leaveRequests(input.companyId);
}

// ─── Approver decision ───────────────────────────────────────────────────

export interface ReviewLeaveRequestInput {
  companyId:        string;
  requestId:        string;
  decision:         'approved' | 'rejected';
  reviewerId:       string;
  reviewerName:     string;
}

export async function reviewLeaveRequest(input: ReviewLeaveRequestInput): Promise<void> {
  if (!USE_SUPABASE) {
    return simulate(undefined);
  }
  const { error } = await supabase()
    .from('leave_requests')
    .update({
      status: input.decision,
      reviewed_by: input.reviewerId,
      reviewed_by_name: input.reviewerName,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', input.requestId);
  if (error) throw error;
  invalidate.leaveRequests(input.companyId);
}

// ─── Platoon leave cycle (mock-only for now) ─────────────────────────────

export function activeCycleForCompany(companyId: string): Promise<PlatoonLeaveCycle | null> {
  const c = read.platoonLeaveCycles()
    .filter((x) => x.companyId === companyId && x.status !== 'archived')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return simulate(c ?? null);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function addSegment(_cycleId: string, _segment: Omit<PlatoonLeaveCycleSegment, 'id'>): Promise<void> {
  return simulate(undefined);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function publishCycle(_cycleId: string): Promise<void> {
  return simulate(undefined);
}

// ─── Mappers ─────────────────────────────────────────────────────────────

interface LeaveRow {
  id: string;
  company_id: string;
  scope: LeaveScope;
  soldier_ids: string[] | null;
  squad_id: string | null;
  team_class: string | null;
  start_date: string; start_time: string;
  end_date:   string; end_time:   string;
  note: string | null;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

function mapLeave(r: LeaveRow): Leave {
  return {
    id: r.id,
    scope: r.scope,
    soldierIds: r.soldier_ids ?? [],
    squadId: r.squad_id ?? undefined,
    teamClass: r.team_class ?? undefined,
    startDate: r.start_date, startTime: r.start_time,
    endDate:   r.end_date,   endTime:   r.end_time,
    note: r.note ?? undefined,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
  } as Leave;
}

interface LeaveReqRow {
  id: string;
  company_id: string;
  soldier_id: string;
  soldier_name: string;
  soldier_team_class: string;
  soldier_squad_id: string | null;
  soldier_squad_name: string | null;
  start_date: string; start_time: string;
  end_date:   string; end_time:   string;
  reason: string;
  status: LeaveRequestStatus;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  submitted_at: string;
}

function mapLeaveRequest(r: LeaveReqRow): LeaveRequest {
  return {
    id: r.id,
    soldierId: r.soldier_id,
    soldierName: r.soldier_name,
    soldierTeamClass: r.soldier_team_class as LeaveRequest['soldierTeamClass'],
    soldierSquadId: r.soldier_squad_id ?? undefined,
    soldierSquadName: r.soldier_squad_name ?? undefined,
    startDate: r.start_date, startTime: r.start_time,
    endDate:   r.end_date,   endTime:   r.end_time,
    reason: r.reason,
    status: r.status,
    reviewedBy: r.reviewed_by ?? undefined,
    reviewedByName: r.reviewed_by_name ?? undefined,
    reviewedAt: r.reviewed_at ?? undefined,
    submittedAt: r.submitted_at,
  } as LeaveRequest;
}
