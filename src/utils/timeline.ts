// Operational timeline computation.
//
// A platoon/company commander needs to read TIME, not notifications.
// This module converts the schedule + leaves + waiting work + critical
// alerts into a single sorted event stream, ready to render as cards.
//
// Mock-data note: the published period's slots are dated 2024-05-12 etc.,
// but real wall-clock time is whatever date the user is running the demo.
// To make the timeline read naturally regardless, we treat "today" as the
// wall-clock date and project each slot's HH:MM onto it. Once a real
// backend exists this can use proper ISO timestamps end-to-end.

import type {
  SchedulePeriod, Leave, OverrideAlert, MissionType, TimeSlot, Soldier,
} from '../types';

export type OpsEventKind =
  | 'shiftEnd'
  | 'shiftStart'
  | 'leaveStart'         // soldier going home
  | 'soldierReturn'      // soldier returning from leave
  | 'manpowerDrop'       // computed: leave start that crosses the min
  | 'rotation'           // CompanyMission rotation event
  | 'pendingApprovals'   // virtual "right now" event
  | 'override';          // override alert that requires immediate attention

export interface OpsEvent {
  id: string;
  whenIso: string;                                  // sortable
  whenLabel: string;                                // "עוד 40 דק׳" · "22:00" · "מחר 06:00"
  kind: OpsEventKind;
  title: string;                                    // bold line
  detail?: string;                                  // helper line
  severity: 'normal' | 'warn' | 'alert';
  ctaLabel?: string;                                // optional inline button label
  ctaHref?: string;                                 // route or modal trigger
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

function parseHHmm(t: string): { h: number; m: number } {
  const [h, m] = t.split(':').map((x) => parseInt(x, 10));
  return { h: Math.max(0, h || 0), m: Math.max(0, m || 0) };
}

// Build a Date that uses `now`'s date-portion plus the supplied HH:MM, then
// shifts forward by N days if the event has already passed today.
function projectOnto(now: Date, hhmm: string, dayOffset = 0): Date {
  const { h, m } = parseHHmm(hhmm);
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d;
}

export function formatRelative(now: Date, when: Date): string {
  const diffMs = when.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin <= 0) return 'עכשיו';
  if (diffMin < 60) return `עוד ${diffMin} דק׳`;

  const sameDay     = when.getDate() === now.getDate() && when.getMonth() === now.getMonth() && when.getFullYear() === now.getFullYear();
  const tomorrow    = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow  = when.getDate() === tomorrow.getDate() && when.getMonth() === tomorrow.getMonth() && when.getFullYear() === tomorrow.getFullYear();
  const hh          = when.getHours().toString().padStart(2, '0');
  const mm          = when.getMinutes().toString().padStart(2, '0');

  if (sameDay)    return `${hh}:${mm}`;
  if (isTomorrow) return `מחר ${hh}:${mm}`;

  // Beyond tomorrow — DD/MM HH:MM (rare inside a 12h horizon, but safe)
  const d  = when.getDate().toString().padStart(2, '0');
  const mo = (when.getMonth() + 1).toString().padStart(2, '0');
  return `${d}/${mo} ${hh}:${mm}`;
}

function relativeAgo(isoTimestamp: string, now: Date = new Date()): string {
  const then = new Date(isoTimestamp);
  const diffMin = Math.round((now.getTime() - then.getTime()) / 60000);
  if (diffMin < 1)   return 'הרגע';
  if (diffMin < 60)  return `לפני ${diffMin} דק׳`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24)    return `לפני ${hours} שעות`;
  return `לפני ${Math.floor(hours / 24)} ימים`;
}

// ─── Slot derivations ─────────────────────────────────────────────────────────

interface SlotProjection {
  mt: MissionType;
  ts: TimeSlot;
  startsAt: Date;
  endsAt: Date;
}

// Project each slot's HH:MM onto the wall-clock date so we can sort and
// filter against `now`. Handles overnight slots (end time ≤ start time).
function projectAllSlots(period: SchedulePeriod, now: Date): SlotProjection[] {
  const out: SlotProjection[] = [];
  for (const mt of period.missionTypes) {
    for (const ts of mt.timeSlots) {
      const startsAt = projectOnto(now, ts.startTime);
      let endsAt     = projectOnto(now, ts.endTime);
      if (endsAt <= startsAt) endsAt = projectOnto(now, ts.endTime, 1);  // overnight
      out.push({ mt, ts, startsAt, endsAt });
    }
  }
  return out;
}

// ─── Main entry: platoon-scope timeline ──────────────────────────────────────

export interface PlatoonTimelineInput {
  now:               Date;
  period:            SchedulePeriod | null;
  leaves:            Leave[];
  soldiers:          Soldier[];
  pendingApprovals:  number;
  recentAlerts:      OverrideAlert[];     // only requiresImmediateAttention surface here
  horizonHours:      number;              // default 12
}

export function buildPlatoonTimeline(input: PlatoonTimelineInput): OpsEvent[] {
  const { now, period, leaves, pendingApprovals, recentAlerts } = input;
  const events: OpsEvent[] = [];
  const horizonEnd = new Date(now.getTime() + input.horizonHours * 3600 * 1000);

  // 1. Active shifts ending soon + upcoming shift starts within horizon
  if (period) {
    const slots = projectAllSlots(period, now);
    for (const sp of slots) {
      // Shift ending in window
      if (sp.endsAt > now && sp.endsAt <= horizonEnd) {
        events.push({
          id: `slot-end-${sp.ts.id}`,
          whenIso: sp.endsAt.toISOString(),
          whenLabel: formatRelative(now, sp.endsAt),
          kind: 'shiftEnd',
          title: `${sp.mt.name} מסתיימת`,
          detail: sp.ts.assignedSoldierIds.length > 0
            ? `${sp.ts.assignedSoldierIds.length} חיילים במשמרת`
            : undefined,
          severity: 'normal',
        });
      }
      // Shift starting in window (only if not currently running)
      if (sp.startsAt > now && sp.startsAt <= horizonEnd) {
        const understaffed = sp.ts.assignedSoldierIds.length < sp.mt.minSoldiers;
        events.push({
          id: `slot-start-${sp.ts.id}`,
          whenIso: sp.startsAt.toISOString(),
          whenLabel: formatRelative(now, sp.startsAt),
          kind: 'shiftStart',
          title: `${sp.mt.name} מתחילה`,
          detail: understaffed
            ? `לא מאוישת במלואה (${sp.ts.assignedSoldierIds.length}/${sp.mt.minSoldiers})`
            : undefined,
          severity: understaffed ? 'warn' : 'normal',
        });
      }
    }
  }

  // 2. Leave start / end events within horizon
  for (const lv of leaves) {
    if (lv.scope === 'individual' && lv.soldierIds.length === 0) continue;

    const lvStart = projectOnto(now, lv.startTime, daysFromTodayUntil(now, lv.startDate));
    const lvEnd   = projectOnto(now, lv.endTime,   daysFromTodayUntil(now, lv.endDate));

    if (lvStart > now && lvStart <= horizonEnd) {
      const who = describeLeaveScope(lv, input.soldiers);
      events.push({
        id: `lv-start-${lv.id}`,
        whenIso: lvStart.toISOString(),
        whenLabel: formatRelative(now, lvStart),
        kind: 'leaveStart',
        title: `${who} יוצא הביתה`,
        detail: lv.note,
        severity: 'warn',  // potential manpower impact
      });
    }
    if (lvEnd > now && lvEnd <= horizonEnd) {
      const who = describeLeaveScope(lv, input.soldiers);
      events.push({
        id: `lv-end-${lv.id}`,
        whenIso: lvEnd.toISOString(),
        whenLabel: formatRelative(now, lvEnd),
        kind: 'soldierReturn',
        title: `${who} חוזר לבסיס`,
        severity: 'normal',
      });
    }
  }

  // 3. Pending approvals — virtual event anchored at "now"
  if (pendingApprovals > 0) {
    events.push({
      id: 'pending-approvals',
      whenIso: now.toISOString(),
      whenLabel: 'ממתין',
      kind: 'pendingApprovals',
      title: `${pendingApprovals} בקשות יציאה ממתינות לטיפולך`,
      severity: 'warn',
      ctaLabel: 'פתח',
      ctaHref:  '/leaves',
    });
  }

  // 4. Critical override alerts (only those marked requiresImmediateAttention)
  for (const a of recentAlerts) {
    if (!a.requiresImmediateAttention || a.status !== 'open') continue;
    events.push({
      id: `alert-${a.id}`,
      whenIso: a.timestamp,
      whenLabel: relativeAgo(a.timestamp, now),
      kind: 'override',
      title: a.description,
      detail: a.suggestedAction,
      severity: a.riskLevel === 'high' ? 'alert' : 'warn',
    });
  }

  return events.sort((a, b) => a.whenIso.localeCompare(b.whenIso));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysFromTodayUntil(now: Date, dateStr: string): number {
  // Compares calendar dates only.
  const target = new Date(dateStr);
  const today  = new Date(now); today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function describeLeaveScope(lv: Leave, soldiers: Soldier[]): string {
  if (lv.scope === 'individual') {
    const names = lv.soldierIds.map((id) => soldiers.find((s) => s.id === id)?.name).filter(Boolean);
    return names.length > 0 ? names.join(' · ') : 'חייל';
  }
  if (lv.scope === 'squad') return `כיתה`;
  return 'כלל המחלקה';
}
