// Coverage preview projection.
//
// Pure read-only — classifies each (soldier, day) into one of three states:
// base / home / excluded. The classification reads existing entities:
//
//   • DutyExclusion        → excluded (the soldier is outside the count)
//   • Leave overlap         → home
//   • Soldier.currentStatus → home (today only, falls back when no Leave)
//   • Soldier.statusExpectedUntil → home (until the planned return)
//   • Otherwise             → base
//
// L2 (this slice) does NOT consult LeaveBlocks or LeaveRotationPlans —
// those are wired in L9 when the engine produces them.
// L2 does NOT compute fairness — only floor-vs-on-base notes for the day.

import type {
  Soldier, Leave, DutyExclusion, LeaveRotationPolicy,
} from '../types';

export type DayState = 'base' | 'home' | 'excluded';

export interface DayPicture {
  date:           Date;
  onBase:         Soldier[];
  atHome:         Soldier[];
  excluded:       Soldier[];
  totalSoldiers:  number;
}

export type PreviewNoteKind =
  | 'below-floor'              // on-base < company floor on this day
  | 'at-floor'                 // on-base === company floor — fragile
  | 'coverage-event-soon'      // a CoverageEvent is starting today/tomorrow
  | 'limited-data';            // no LeaveRotationPlan yet — picture is "current state only"

export interface PreviewNote {
  id:       string;
  kind:     PreviewNoteKind;
  severity: 'info' | 'warning' | 'critical';
  message:  string;
  date?:    Date;
}

// ─── Classification ─────────────────────────────────────────────────────────

export function classify(
  soldier: Soldier,
  day: Date,
  leaves: Leave[],
  dutyExclusions: DutyExclusion[],
  todayMs: number,
): DayState {
  const dayIso = isoDate(day);

  // 1. DutyExclusion overlap → 'excluded'
  for (const e of dutyExclusions) {
    if (e.soldierId !== soldier.id) continue;
    const sIso = e.startIso.slice(0, 10);
    const eIso = e.endIso.slice(0, 10);
    if (sIso <= dayIso && dayIso <= eIso) return 'excluded';
  }

  // 2. Leave overlap (individual / squad scope only — machlaka skipped
  //    for L2 to avoid swamping the picture when one community-wide
  //    leave is on file)
  for (const lv of leaves) {
    if (dayIso < lv.startDate || dayIso > lv.endDate) continue;
    if (lv.scope === 'individual' && lv.soldierIds.includes(soldier.id)) return 'home';
    if (lv.scope === 'squad' && soldier.squadId && soldier.squadId === lv.squadId) return 'home';
  }

  // 3. currentStatus fallback — today only (we don't extrapolate beyond
  //    statusExpectedUntil unless one is set).
  if (soldier.currentStatus === 'home') {
    if (day.getTime() === todayMs) return 'home';
    if (soldier.statusExpectedUntil) {
      const back = new Date(soldier.statusExpectedUntil);
      if (day.getTime() < back.getTime()) return 'home';
    }
  }

  // 4. inactive-temp on today (without exclusion) — fold to 'home' for the
  //    preview's 3-state model.
  if (soldier.currentStatus === 'inactive-temp' && day.getTime() === todayMs) {
    return 'home';
  }

  return 'base';
}

export function buildDayPicture(
  day: Date,
  soldiers: Soldier[],
  leaves: Leave[],
  dutyExclusions: DutyExclusion[],
  todayMs: number,
): DayPicture {
  const onBase:   Soldier[] = [];
  const atHome:   Soldier[] = [];
  const excluded: Soldier[] = [];

  for (const s of soldiers) {
    const state = classify(s, day, leaves, dutyExclusions, todayMs);
    if      (state === 'base')     onBase.push(s);
    else if (state === 'home')     atHome.push(s);
    else                            excluded.push(s);
  }

  return { date: day, onBase, atHome, excluded, totalSoldiers: soldiers.length };
}

export function buildWeekPicture(
  startDay: Date,
  soldiers: Soldier[],
  leaves: Leave[],
  dutyExclusions: DutyExclusion[],
): DayPicture[] {
  const todayMs = startDay.getTime();
  return [0, 1, 2, 3, 4, 5, 6].map((offset) => {
    const d = new Date(startDay);
    d.setDate(d.getDate() + offset);
    return buildDayPicture(d, soldiers, leaves, dutyExclusions, todayMs);
  });
}

// ─── Notes (the soft signals — NOT engine warnings) ─────────────────────────
//
// Distinct from CoverageWarning declared in types/index.ts: that is the
// engine's algorithm output. These are simple, derived-from-counts signals
// the preview surface emits so the CC has *some* feedback before the real
// algorithm lands in L6+.

export function computePreviewNotes(
  week: DayPicture[],
  policy: LeaveRotationPolicy | null,
  hasAnyPlan: boolean,
): PreviewNote[] {
  const out: PreviewNote[] = [];

  if (!hasAnyPlan) {
    out.push({
      id: 'no-plan',
      kind: 'limited-data',
      severity: 'info',
      message: 'אין תוכנית רוטציה מאושרת — תצוגה מבוססת על מצב נוכחי בלבד.',
    });
  }

  if (policy) {
    const floor = policy.minSoldiersOnBase;
    for (const day of week) {
      const onBase = day.onBase.length;
      if (onBase < floor) {
        out.push({
          id: `below-${isoDate(day.date)}`,
          kind: 'below-floor',
          severity: 'critical',
          message: `${formatHebrewShort(day.date)} · ${onBase}/${floor} בבסיס — מתחת לרצפה`,
          date: day.date,
        });
      } else if (onBase === floor) {
        out.push({
          id: `at-${isoDate(day.date)}`,
          kind: 'at-floor',
          severity: 'warning',
          message: `${formatHebrewShort(day.date)} · רגישות — בדיוק על הרצפה`,
          date: day.date,
        });
      }
    }
  }

  return out;
}

// ─── Date helpers (kept local — preview is the only consumer) ───────────────

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const HE_MONTHS_SHORT = ['ינו׳','פבר׳','מרץ','אפר׳','מאי','יוני','יולי','אוג׳','ספט׳','אוק׳','נוב׳','דצמ׳'];

function formatHebrewShort(d: Date): string {
  return `${d.getDate()} ב${HE_MONTHS_SHORT[d.getMonth()]}`;
}
