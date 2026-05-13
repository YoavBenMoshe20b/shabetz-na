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
  Leave, OverrideAlert, Soldier,
  SoldierStatusEvent,
} from '../types';
import type { MaterializedSlot } from './materialize';

export type OpsEventKind =
  | 'shiftEnd'
  | 'shiftStart'
  | 'leaveStart'         // soldier going home
  | 'soldierReturn'      // soldier returning from leave
  | 'manpowerDrop'       // computed: leave start that crosses the min
  | 'rotation'           // CompanyMission rotation event
  | 'pendingApprovals'   // virtual "right now" event
  | 'override'           // override alert that requires immediate attention
  | 'statusTransition';  // soldier declared a status change — quiet operational signal

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

// ─── Main entry: platoon-scope timeline ──────────────────────────────────────

export interface PlatoonTimelineInput {
  now:               Date;
  /** Pre-materialized AssignmentSlots — produced by utils/materialize.ts. */
  materializedSlots: MaterializedSlot[];
  /** Optional scope filter — when set, only slots with this ownerPlatoonId
   *  contribute shiftStart/shiftEnd events. Used by PC home so the
   *  commander only sees their commanded platoon's shifts. */
  ownerPlatoonId?:   string;
  leaves:            Leave[];
  soldiers:          Soldier[];
  pendingApprovals:  number;
  recentAlerts:      OverrideAlert[];     // only requiresImmediateAttention surface here
  /** Soldier status declarations (יצאתי הביתה / חזרתי לבסיס / ...).
   *  Rendered as low-severity ambient signals — not banners, not notifications. */
  statusEvents?:     SoldierStatusEvent[];
  /** Only events newer than this point are shown. Defaults to 6h ago. */
  statusLookbackHours?: number;
  horizonHours:      number;
}

export function buildPlatoonTimeline(input: PlatoonTimelineInput): OpsEvent[] {
  const { now, materializedSlots, leaves, pendingApprovals, recentAlerts } = input;
  const events: OpsEvent[] = [];
  const horizonEnd = new Date(now.getTime() + input.horizonHours * 3600 * 1000);

  // 1. Active shifts ending soon + upcoming shift starts within horizon
  const inScope = input.ownerPlatoonId
    ? materializedSlots.filter((s) => s.ownerPlatoonId === input.ownerPlatoonId)
    : materializedSlots;

  for (const slot of inScope) {
    const startsAt = new Date(slot.start);
    const endsAt   = new Date(slot.end);
    const assignedCount = slot.assignedSoldierIds.length + (slot.commanderSoldierId ? 1 : 0);

    // Shift ending in window
    if (endsAt > now && endsAt <= horizonEnd) {
      events.push({
        id: `slot-end-${slot.id}`,
        whenIso: endsAt.toISOString(),
        whenLabel: formatRelative(now, endsAt),
        kind: 'shiftEnd',
        title: `${slot.missionName} מסתיימת`,
        detail: assignedCount > 0 ? `${assignedCount} חיילים במשמרת` : undefined,
        severity: 'normal',
      });
    }

    // Shift starting in window
    if (startsAt > now && startsAt <= horizonEnd) {
      const understaffed = assignedCount < slot.requiredCount;
      events.push({
        id: `slot-start-${slot.id}`,
        whenIso: startsAt.toISOString(),
        whenLabel: formatRelative(now, startsAt),
        kind: 'shiftStart',
        title: `${slot.missionName} מתחילה`,
        detail: understaffed
          ? `לא מאוישת במלואה (${assignedCount}/${slot.requiredCount})`
          : undefined,
        severity: understaffed ? 'warn' : 'normal',
      });
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

  // 4. Recent soldier status transitions — quiet ambient signal.
  // These are NOT alerts. They're the operational equivalent of "what
  // has changed in the last few hours" — same vocabulary the soldier
  // uses ("יצא הביתה" / "חזר לבסיס") so the commander sees the platoon
  // through the same words.
  if (input.statusEvents && input.statusEvents.length > 0) {
    const lookbackMs = (input.statusLookbackHours ?? 6) * 3600 * 1000;
    const cutoff = now.getTime() - lookbackMs;
    const soldiersById = new Map(input.soldiers.map((s) => [s.id, s]));
    for (const ev of input.statusEvents) {
      const setAtMs = Date.parse(ev.setAt);
      if (isNaN(setAtMs) || setAtMs < cutoff || setAtMs > now.getTime()) continue;
      const s = soldiersById.get(ev.soldierId);
      if (!s) continue;
      const verb =
        ev.value === 'home'           ? 'יצא הביתה' :
        ev.value === 'in-base'        ? 'חזר לבסיס' :
        ev.value === 'inactive-temp'  ? 'סומן לא פעיל' :
        'עדכן מצב';
      events.push({
        id: `status-${ev.id}`,
        whenIso: ev.setAt,
        whenLabel: relativeAgo(ev.setAt, now),
        kind: 'statusTransition',
        title: `${s.name} ${verb}`,
        severity: 'normal',
      });
    }
  }

  // 5. Critical override alerts (only those marked requiresImmediateAttention)
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
