// Announcements API.
//
// Two modes:
//   • USE_SUPABASE=false (default) — reads from the live mock snapshot;
//     writes are no-ops (AppContext owns mutation today).
//   • USE_SUPABASE=true            — reads from `announcements` table,
//     writes through normal insert/update with RLS enforcing scope.

import type {
  Announcement, AnnouncementKind, AnnouncementStatus, Audience,
} from '../types';
import { read, simulate, USE_SUPABASE, supabase } from './_adapter';
import { invalidate } from './queryClient';

// ─── Reads ─────────────────────────────────────────────────────────────

export async function listForCompany(
  companyId: string,
  opts: { statuses?: AnnouncementStatus[] } = {},
): Promise<Announcement[]> {
  const statuses = opts.statuses ?? (['active'] as AnnouncementStatus[]);
  if (USE_SUPABASE) {
    const { data, error } = await supabase()
      .from('announcements')
      .select('*')
      .eq('company_id', companyId)
      .in('status', statuses);
    if (error) throw error;
    return (data ?? []).map(mapAnnouncement);
  }
  const set = new Set(statuses);
  return simulate(
    read.announcements().filter((a) => a.companyId === companyId && set.has(a.status)),
  );
}

export async function byId(id: string): Promise<Announcement | null> {
  if (USE_SUPABASE) {
    const { data, error } = await supabase()
      .from('announcements')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapAnnouncement(data) : null;
  }
  return simulate(read.announcements().find((a) => a.id === id) ?? null);
}

// ─── Writes ────────────────────────────────────────────────────────────

export interface CreateAnnouncementInput {
  companyId: string;
  kind: AnnouncementKind;
  title: string;
  body?: string;
  audience: Audience;
  startDate?: string;
  startTime?: string;
  endDate?:   string;
  endTime?:   string;
  pinned?:    boolean;
  showOnCalendar?: boolean;
  status?:    AnnouncementStatus;
  createdByUserId: string;
  createdByName:   string;
}

export async function create(input: CreateAnnouncementInput): Promise<Announcement | null> {
  if (!USE_SUPABASE) return simulate(null);
  const { data, error } = await supabase()
    .from('announcements')
    .insert({
      company_id: input.companyId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      audience: input.audience,
      start_date: input.startDate ?? null,
      start_time: input.startTime ?? null,
      end_date:   input.endDate   ?? null,
      end_time:   input.endTime   ?? null,
      pinned: input.pinned ?? false,
      status: input.status ?? 'active',
      created_by_user_id: input.createdByUserId,
      created_by_name: input.createdByName,
    })
    .select('*')
    .single();
  if (error) throw error;
  invalidate.announcements(input.companyId);
  return mapAnnouncement(data);
}

export async function close(id: string, companyId: string): Promise<void> {
  if (!USE_SUPABASE) return simulate(undefined);
  const { error } = await supabase()
    .from('announcements')
    .update({ status: 'closed' satisfies AnnouncementStatus })
    .eq('id', id);
  if (error) throw error;
  invalidate.announcements(companyId);
}

export async function remove(id: string, companyId: string): Promise<void> {
  if (!USE_SUPABASE) return simulate(undefined);
  const { error } = await supabase().from('announcements').delete().eq('id', id);
  if (error) throw error;
  invalidate.announcements(companyId);
}

// ─── Mapper ────────────────────────────────────────────────────────────

interface AnnouncementRow {
  id: string;
  company_id: string;
  kind: AnnouncementKind;
  status: AnnouncementStatus;
  title: string;
  body: string | null;
  audience: Audience;
  pinned: boolean | null;
  start_date: string | null;
  start_time: string | null;
  end_date:   string | null;
  end_time:   string | null;
  created_by_user_id: string | null;
  created_by_name:    string | null;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
}

function mapAnnouncement(r: AnnouncementRow): Announcement {
  return {
    id: r.id,
    companyId: r.company_id,
    kind: r.kind,
    status: r.status,
    title: r.title,
    body: r.body ?? undefined,
    audience: r.audience,
    pinned: r.pinned ?? false,
    showOnCalendar: true, // legacy default; not stored server-side yet
    startDate: r.start_date ?? undefined,
    startTime: r.start_time ?? undefined,
    endDate:   r.end_date   ?? undefined,
    endTime:   r.end_time   ?? undefined,
    createdByUserId: r.created_by_user_id ?? '',
    createdByName:   r.created_by_name   ?? '',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    closedAt:  r.closed_at ?? undefined,
  } as Announcement;
}
