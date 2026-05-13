// Announcements API.

import type { Announcement, AnnouncementStatus } from '../types';
import { read, simulate } from './_adapter';

export function listForCompany(
  companyId: string,
  opts: { statuses?: AnnouncementStatus[] } = {},
): Promise<Announcement[]> {
  const statuses = new Set(opts.statuses ?? (['active'] as AnnouncementStatus[]));
  return simulate(
    read.announcements().filter((a) => a.companyId === companyId && statuses.has(a.status)),
  );
}

export function byId(id: string): Promise<Announcement | null> {
  return simulate(read.announcements().find((a) => a.id === id) ?? null);
}

/* eslint-disable @typescript-eslint/no-unused-vars */
// Write paths are placeholders. The unused `_data`/`_id` parameters define
// the contract; the body is intentionally a no-op until a real backend
// adapter (Supabase / Firebase) replaces this module.
export function create(_data: Omit<Announcement, 'id' | 'createdAt' | 'createdByUserId' | 'createdByName' | 'status'>): Promise<Announcement> {
  return simulate({} as Announcement);
}

export function update(_id: string, _patch: Partial<Announcement>): Promise<void> {
  return simulate(undefined);
}

export function close(_id: string): Promise<void> {
  return simulate(undefined);
}

export function remove(_id: string): Promise<void> {
  return simulate(undefined);
}
