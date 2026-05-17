// §4-§5 — calendar locking ↔ leave module.
//
// CompanyBlockedDate already carries a `blockLeaveRequests` flag. This
// helper enforces it: given a leave date range, returns whether the
// range touches a blocked day that disallows leave submissions, and
// which day fired the block (so the UI can name it in the rejection
// toast).
//
// Pure module — no React, no Date.now() — so it tests cleanly and the
// engine layer can reuse the same predicate.

import type { CompanyBlockedDate, CompanyBlockedDateKind } from '../types';

export interface LeaveBlockResult {
  blocked: boolean;
  /** YYYY-MM-DD that fired the block. Only set when blocked=true. */
  on?: string;
  /** Hebrew label of the block kind (e.g. "תרגיל", "יום עליה לקו"). */
  kindLabel?: string;
  /** Free-text reason copied from the blocked-date row, if present. */
  reason?: string;
}

const KIND_LABEL: Record<CompanyBlockedDateKind, string> = {
  'line-up':    'יום עליה לקו',
  'line-down':  'יום ירידה מהקו',
  'credit':     'זיכוי בסיס',
  'drill':      'תרגיל',
  'inspection': 'ביקורת',
  'op-event':   'אירוע מבצעי',
  'other':      'תאריך נעול',
};

/** Returns the first blocked day touching the range [startIso, endIso], or
 *  `{ blocked: false }` if the range is clear. Both ends are inclusive. */
export function isLeaveRangeBlocked(
  startIso: string,
  endIso: string,
  blockedDates: CompanyBlockedDate[],
): LeaveBlockResult {
  const start = parseIsoDate(startIso);
  const end   = parseIsoDate(endIso);
  if (start == null || end == null || end < start) return { blocked: false };

  // Index blocked dates that actually block leave for O(1) day lookups.
  const blocking = new Map<string, CompanyBlockedDate>();
  for (const b of blockedDates) {
    if (b.blockLeaveRequests) blocking.set(b.dateIso, b);
  }
  if (blocking.size === 0) return { blocked: false };

  for (let t = start; t <= end; t += DAY_MS) {
    const iso = isoFromTimestamp(t);
    const hit = blocking.get(iso);
    if (hit) {
      return {
        blocked:   true,
        on:        hit.dateIso,
        kindLabel: KIND_LABEL[hit.kind],
        reason:    hit.reason,
      };
    }
  }
  return { blocked: false };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDate(iso: string): number | null {
  // Accept "YYYY-MM-DD" or full ISO timestamps; we care about the date
  // portion only. Returns midnight UTC for that calendar date so the
  // loop stays stable regardless of host timezone.
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? t : null;
}

function isoFromTimestamp(t: number): string {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
