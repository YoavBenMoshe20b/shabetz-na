// alerts/grouping.ts — pure dedup + aggregation for the alerts feed.
//
// Per the operational UX principles for Shabetz-Na:
//   • critical → visible immediately, NEVER aggregated. Each one is its
//     own row so the operator can act on each individually.
//   • warning / info → aggregated by (kind + platoonId). When 3 platoons
//     each have a mission-unstaffed warning, that's ONE row in the
//     center labeled "3 משימות ללא איוש" — not three separate rows.
//
// Pure function: same input → same output. No React, no Date.now().

import type { Alert, AlertKind, AlertSeverity } from '../../types';

/**
 * One row in the alerts surface. May represent a single Alert (when
 * `count === 1`) or several alerts of the same kind+platoon collapsed
 * into one (when `count > 1`).
 */
export interface AlertGroup {
  /** Stable key derived from kind+platoon (or the alert id when solo). */
  key: string;
  severity: AlertSeverity;
  kind: AlertKind;
  /** How many underlying alerts this group represents. */
  count: number;
  /** Either the alert title (solo) or an aggregated headline like
   *  "3 משימות ללא איוש". */
  title: string;
  /** Either the alert message (solo) or an aggregated subtitle
   *  describing the multi-target context. */
  message?: string;
  /** ISO timestamp of the MOST RECENT alert in the group. */
  latestOccurredAt: string;
  /** Suggested action label of the representative alert. */
  suggestedAction?: string;
  /** Action href of the representative alert. */
  actionHref?: string;
  /** Underlying alerts — sorted by occurredAt desc. Operators can drill
   *  in to see each individually in the AlertsSheet. */
  members: Alert[];
}

/**
 * Group alerts for display.
 *
 * Returns groups in order:
 *   1. All critical alerts (each as its own group)
 *   2. Non-critical groups sorted by latestOccurredAt desc
 */
export function groupAlerts(alerts: Alert[]): AlertGroup[] {
  const critical: AlertGroup[] = [];
  const nonCriticalBuckets = new Map<string, Alert[]>();

  for (const a of alerts) {
    if (a.severity === 'critical') {
      // Each critical is its own group. No dedup — the operator MUST
      // see every critical individually.
      critical.push(soloGroup(a));
      continue;
    }

    const bucketKey = bucketKeyFor(a);
    const arr = nonCriticalBuckets.get(bucketKey) ?? [];
    arr.push(a);
    nonCriticalBuckets.set(bucketKey, arr);
  }

  const nonCritical: AlertGroup[] = [];
  for (const [key, members] of nonCriticalBuckets) {
    members.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    if (members.length === 1) {
      nonCritical.push(soloGroup(members[0]));
    } else {
      nonCritical.push(aggregateGroup(key, members));
    }
  }

  nonCritical.sort((a, b) =>
    b.latestOccurredAt.localeCompare(a.latestOccurredAt),
  );

  return [...critical, ...nonCritical];
}

// ─── Internal helpers ────────────────────────────────────────────────

function bucketKeyFor(a: Alert): string {
  // Critical alerts NEVER bucket (handled before this is called).
  return `${a.kind}::${a.platoonId ?? '_'}`;
}

function soloGroup(a: Alert): AlertGroup {
  return {
    key: a.id,
    severity: a.severity,
    kind: a.kind,
    count: 1,
    title: a.title,
    message: a.message,
    latestOccurredAt: a.occurredAt,
    suggestedAction: a.suggestedAction,
    actionHref: a.actionHref,
    members: [a],
  };
}

function aggregateGroup(key: string, members: Alert[]): AlertGroup {
  const head = members[0]; // most recent
  return {
    key,
    severity: head.severity,
    kind: head.kind,
    count: members.length,
    title: aggregateTitle(head.kind, members.length),
    message: aggregateMessage(members),
    latestOccurredAt: head.occurredAt,
    // Aggregated groups never auto-deep-link. Tapping opens the sheet
    // and the operator drills into the specific alert from there.
    suggestedAction: head.suggestedAction,
    actionHref: undefined,
    members,
  };
}

function aggregateTitle(kind: AlertKind, count: number): string {
  switch (kind) {
    case 'mission-unstaffed':
      return `${count} משימות ללא איוש`;
    case 'override-open':
      return `${count} חריגות פתוחות`;
    case 'manpower-shortfall':
      return `${count} מחלקות מתחת לסד״כ`;
    case 'announcement-operational':
      return `${count} הודעות מבצעיות`;
    case 'escalation-active':
      // Escalations should be critical → shouldn't reach here, but
      // fall back gracefully.
      return `${count} הקפצות פעילות`;
  }
}

function aggregateMessage(members: Alert[]): string | undefined {
  // Stitch together a brief subtitle — first 2 titles, then "+N נוספים".
  const visible = members.slice(0, 2).map((m) => m.title);
  if (members.length === 2) return visible.join(' · ');
  return `${visible.join(' · ')} · +${members.length - 2} נוספים`;
}
