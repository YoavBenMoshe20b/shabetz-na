// ─── Tour-of-duty / ימי קו — derived from status events ────────────────────
//
// "כמה ימים החייל עשה בקו הזה?" answered by intersecting the soldier's
// status event log with operational order windows. Pure projection — never
// stored. The event log is the source of truth.
//
// Algorithm per order window [start, end]:
//   1. Walk the soldier's status events sorted by setAt.
//   2. For each day in the window, find the status that was active at noon
//      that day (chosen to avoid edge-case events exactly on date boundaries).
//   3. Count days into the three buckets (in-base / home / inactive-temp).
//
// Why noon? Two reasons:
//   • It deterministically resolves "the soldier transitioned at 06:00" —
//     we count the post-transition day as the new status (operational truth).
//   • It avoids timezone drift on day boundaries from ISO timestamps.
//
// Complexity: O(events) per soldier (we walk events once and sweep dates).
// For a soldier with 200 events over 5 years × 365 ÷ avgGap, well-bounded.
// Cached at the viewer with useMemo so a profile page renders once per
// status-event change, not per render.
//
// Backend portability: when persistence lands, this same function runs on
// the server inside a per-user materialized view, refreshed on every status
// event write. The API signature here is the contract.

import type {
  Soldier, SoldierStatus, SoldierStatusEvent, OperationalOrder,
  SoldierTourSummary, TourOfDutyOrderBreakdown,
} from '../types';

const MS_PER_DAY = 86_400_000;

/** Status the soldier held at the given Date — or null when no events
 *  preceded that moment. */
function statusAt(
  events: SoldierStatusEvent[],   // sorted ascending by setAt
  at: Date,
): SoldierStatus | null {
  const atMs = at.getTime();
  let current: SoldierStatus | null = null;
  for (const ev of events) {
    if (Date.parse(ev.setAt) <= atMs) current = ev.value;
    else break;
  }
  return current;
}

/** Number of days in [start, end] inclusive. */
function dayCount(startIso: string, endIso: string): number {
  const s = new Date(startIso);  s.setHours(0, 0, 0, 0);
  const e = new Date(endIso);    e.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / MS_PER_DAY) + 1);
}

/** Iterate days inside [start, end] inclusive — at noon for status sampling. */
function eachDayNoon(startIso: string, endIso: string): Date[] {
  const out: Date[] = [];
  const s = new Date(startIso); s.setHours(12, 0, 0, 0);
  const e = new Date(endIso);   e.setHours(12, 0, 0, 0);
  for (let t = s.getTime(); t <= e.getTime(); t += MS_PER_DAY) {
    out.push(new Date(t));
  }
  return out;
}

function emptyBreakdown(orderId: string | undefined, orderName: string | undefined,
                       start: string, end: string): TourOfDutyOrderBreakdown {
  return {
    orderId, orderName,
    windowStart: start, windowEnd: end,
    daysOnBase: 0, daysAtHome: 0, daysInactive: 0,
  };
}

/** Compute the breakdown for ONE order window. */
function breakdownForOrder(
  soldier: Soldier,
  events: SoldierStatusEvent[],   // sorted ascending
  order: { id?: string; name?: string; startDate: string; endDate: string },
  asOf: Date,
): TourOfDutyOrderBreakdown {
  const b = emptyBreakdown(order.id, order.name, order.startDate, order.endDate);

  const endDate = new Date(order.endDate);  endDate.setHours(23, 59, 59, 999);
  const effectiveEnd = endDate.getTime() < asOf.getTime() ? endDate : asOf;
  const effectiveEndIso = effectiveEnd.toISOString();

  for (const noon of eachDayNoon(order.startDate, effectiveEndIso)) {
    const s = statusAt(events, noon) ?? soldier.currentStatus;
    if      (s === 'in-base')        b.daysOnBase   += 1;
    else if (s === 'home')           b.daysAtHome   += 1;
    else if (s === 'inactive-temp')  b.daysInactive += 1;
  }

  // Only set "days remaining" when the order is still active and asOf falls
  // inside its window.
  const orderEndMs = endDate.getTime();
  if (asOf.getTime() >= Date.parse(order.startDate) && asOf.getTime() <= orderEndMs) {
    b.daysRemainingInOrder = Math.max(0, Math.round(
      (orderEndMs - asOf.getTime()) / MS_PER_DAY,
    ));
  }

  return b;
}

export interface ComputeTourSummaryInput {
  soldier: Soldier;
  /** All status events for this soldier (any order). The function sorts
   *  defensively in case the caller passes them unsorted. */
  events: SoldierStatusEvent[];
  /** All operational orders for the company. The function filters by
   *  companyId match to `soldier.companyId` and sorts by startDate desc. */
  orders: OperationalOrder[];
  /** "Now" — defaults to actual current time. Injectable for testing. */
  asOf?: Date;
}

/** Compute a full SoldierTourSummary. */
export function computeTourSummary({
  soldier, events, orders, asOf,
}: ComputeTourSummaryInput): SoldierTourSummary {
  const now = asOf ?? new Date();

  const mineSorted = events
    .filter((e) => e.soldierId === soldier.id)
    .sort((a, b) => a.setAt.localeCompare(b.setAt));

  const ordersForCompany = orders
    .filter((o) => o.companyId === soldier.companyId)
    .sort((a, b) => b.startDate.localeCompare(a.startDate)); // newest first

  let current: TourOfDutyOrderBreakdown | null = null;
  const past: TourOfDutyOrderBreakdown[] = [];

  const nowMs = now.getTime();

  for (const o of ordersForCompany) {
    const startMs = Date.parse(o.startDate);
    const endMs   = Date.parse(o.endDate) + MS_PER_DAY - 1;
    const isCurrent = nowMs >= startMs && nowMs <= endMs;
    const isPast    = nowMs > endMs;

    if (isCurrent && !current) {
      current = breakdownForOrder(soldier, mineSorted, {
        id: o.id, name: o.name, startDate: o.startDate, endDate: o.endDate,
      }, now);
    } else if (isPast) {
      past.push(breakdownForOrder(soldier, mineSorted, {
        id: o.id, name: o.name, startDate: o.startDate, endDate: o.endDate,
      }, now));
    }
  }

  // Aggregate over storage. Sums current + past (skipping future orders).
  const total = {
    daysOnBase:   (current?.daysOnBase   ?? 0) + past.reduce((s, p) => s + p.daysOnBase,   0),
    daysAtHome:   (current?.daysAtHome   ?? 0) + past.reduce((s, p) => s + p.daysAtHome,   0),
    daysInactive: (current?.daysInactive ?? 0) + past.reduce((s, p) => s + p.daysInactive, 0),
  };

  return { soldierId: soldier.id, asOf: now.toISOString(), current, past, total };
}

/** Useful presentational helper — total length of order in days. */
export function orderLengthDays(order: { startDate: string; endDate: string }): number {
  return dayCount(order.startDate, order.endDate);
}
