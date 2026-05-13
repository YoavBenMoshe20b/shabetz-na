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
  Mission, MissionTimeModel, MissionManpowerSpec, MissionCommandSpec,
  CommandRank, CalendarEvent, CoverageEvent, Platoon, Squad,
  AbsentScope, CoveringScope,
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

// ─── Single combined timeline — day rows for the שבוע view ──────────────────
//
// Each day becomes one DayRow containing every operational FACT for that
// day as dot-prefixed text chips: state · missions · coverage events ·
// locked dates · announcements · derived risks. No grid, no swim lanes —
// the day is the unit; the chips are the journal.

export type ChipTone =
  | 'olive' | 'olive-dim' | 'sand'
  | 'warn'  | 'alert'
  | 'ghost' | 'muted';

export type DayChipKind =
  | 'state'
  | 'mission'
  | 'coverage-event'
  | 'locked-date'
  | 'announcement'
  | 'risk';

export interface DayChip {
  id: string;
  kind: DayChipKind;
  tone: ChipTone;
  /** Operational fact in operational language. */
  text: string;
  /** Optional softer trailing detail. */
  detail?: string;
}

export interface DayRow {
  date: Date;
  isToday: boolean;
  chips: DayChip[];
}

export interface BuildDayRowsInput {
  week:           DayPicture[];
  missions:       Mission[];
  calendarEvents: CalendarEvent[];
  coverageEvents: CoverageEvent[];
  policy:         LeaveRotationPolicy | null;
  platoons:       Platoon[];
  squads:         Squad[];
  soldiers:       Soldier[];
  todayMs:        number;
}

export function buildDayRows(input: BuildDayRowsInput): DayRow[] {
  return input.week.map((day) => {
    const chips: DayChip[] = [];

    // 1. State
    chips.push(stateChip(day, input.policy));

    // 2. Missions active today
    for (const m of input.missions) {
      if (m.status !== 'active') continue;
      if (!missionActiveOnDay(m.timeModel, day.date)) continue;
      chips.push(missionChip(m));
    }

    // 3. Coverage events overlapping today
    for (const ev of input.coverageEvents) {
      if (!overlapsDay(ev.start, ev.end, day.date)) continue;
      chips.push(coverageEventChip(ev, input.platoons, input.squads, input.soldiers));
    }

    // 4. Calendar events: locked-date + announcement (skip combat-block /
    //    platoon-time — those are within-day rhythm, not strategic timeline)
    for (const cev of input.calendarEvents) {
      if (!overlapsDay(cev.start, cev.end, day.date)) continue;
      if (cev.kind === 'locked-date') chips.push(lockedDateChip(cev));
      else if (cev.kind === 'announcement') chips.push(announcementChip(cev));
    }

    // 5. Derived risks — operational notes from simple counts
    chips.push(...riskChips(day, input.policy, chips));

    return {
      date: day.date,
      isToday: day.date.getTime() === input.todayMs,
      chips,
    };
  });
}

// ─── Chip builders ──────────────────────────────────────────────────────────

function stateChip(day: DayPicture, policy: LeaveRotationPolicy | null): DayChip {
  const onBase = day.onBase.length;
  const total  = day.totalSoldiers;
  const floor  = policy?.minSoldiersOnBase ?? 0;
  const tone: ChipTone =
    floor > 0 && onBase <  floor ? 'alert' :
    floor > 0 && onBase === floor ? 'warn'  :
    'olive';

  const parts: string[] = [`${onBase}/${total} בבסיס`];
  if (day.atHome.length   > 0) parts.push(`${day.atHome.length} בבית`);
  if (day.excluded.length > 0) parts.push(`${day.excluded.length} מחוץ לספירה`);

  return {
    id:   `state-${isoDate(day.date)}`,
    kind: 'state',
    tone,
    text: parts.join(' · '),
  };
}

function missionChip(m: Mission): DayChip {
  const tone: ChipTone =
    m.fatigue.intensity === 'ambush'         ? 'warn' :
    m.fatigue.intensity === 'active-patrol'  ? 'olive' :
    m.fatigue.intensity === 'standing-guard' ? 'olive-dim' :
    m.fatigue.intensity === 'readiness'      ? 'ghost' :
    m.fatigue.intensity === 'admin'          ? 'muted' :
    'olive-dim';

  return {
    id:     `mission-${m.id}`,
    kind:   'mission',
    tone,
    text:   m.name,
    detail: describeMissionManpower(m.manpower, m.command),
  };
}

function coverageEventChip(
  ev: CoverageEvent, platoons: Platoon[], squads: Squad[], soldiers: Soldier[],
): DayChip {
  const start = new Date(ev.start);
  const end   = new Date(ev.end);
  const timeLabel = `${formatHHmm(start)}–${formatHHmm(end)}`;
  const absentLabel = describeAbsentScope(ev.absent, platoons, squads, soldiers);
  const coveringLabel =
    ev.covering.kind === 'mission-already-covers'
      ? 'המשימות מכסות'
      : describeCoveringScopeShort(ev.covering, platoons, squads, soldiers);
  return {
    id:     `cv-${ev.id}`,
    kind:   'coverage-event',
    tone:   'sand',
    text:   `${absentLabel} יוצא · ${timeLabel}`,
    detail: coveringLabel,
  };
}

function lockedDateChip(cev: CalendarEvent): DayChip {
  const reason = cev.lockedDate?.reason ?? '';
  return {
    id:   `lock-${cev.id}`,
    kind: 'locked-date',
    tone: 'alert',
    text: reason ? `יום נעול · ${reason}` : 'יום נעול',
  };
}

function announcementChip(cev: CalendarEvent): DayChip {
  return {
    id:   `anno-${cev.id}`,
    kind: 'announcement',
    tone: 'muted',
    text: cev.title,
    detail: cev.detail,
  };
}

function riskChips(
  day: DayPicture,
  policy: LeaveRotationPolicy | null,
  existingChips: DayChip[],
): DayChip[] {
  const out: DayChip[] = [];

  // Floor risks
  if (policy) {
    const floor = policy.minSoldiersOnBase;
    if (day.onBase.length < floor) {
      out.push({
        id:   `risk-below-${isoDate(day.date)}`,
        kind: 'risk',
        tone: 'alert',
        text: 'מתחת לרצפת המינימום',
      });
    } else if (day.onBase.length === floor) {
      out.push({
        id:   `risk-floor-${isoDate(day.date)}`,
        kind: 'risk',
        tone: 'warn',
        text: 'על הסף — שקול לדחות יציאות',
      });
    }
  }

  // Mission-heavy day — ≥ 2 operationally demanding missions active
  const operationalChips = existingChips.filter((c) =>
    c.kind === 'mission' && (c.tone === 'warn' || c.tone === 'olive')
  );
  if (operationalChips.length >= 2) {
    out.push({
      id:   `risk-load-${isoDate(day.date)}`,
      kind: 'risk',
      tone: 'warn',
      text: 'עומס מבצעי — מספר משימות פעילות',
    });
  }

  return out;
}

// ─── Mission helpers ────────────────────────────────────────────────────────

function missionActiveOnDay(t: MissionTimeModel, day: Date): boolean {
  switch (t.kind) {
    case '24-7-continuous':
      return true;
    case 'on-demand':
      return false;                                              // not scheduled, no bar shown
    case 'one-time':
      return isoDate(new Date(t.start)) === isoDate(day);
    case 'daily-variable':
      return isoDate(day) in t.perDate;
    case 'fixed-hours':
      for (const w of t.windows) {
        if (w.recurring === 'every-day') return true;
        if (typeof w.recurring === 'object' && w.recurring.daysOfWeek.includes(day.getDay())) return true;
      }
      return false;
  }
}

function describeMissionManpower(m: MissionManpowerSpec, c: MissionCommandSpec): string {
  const commander = (() => {
    if (!c.fieldCommandRequired) return '';
    const ranks = (Object.entries(c.rankPolicy) as Array<[CommandRank, string]>)
      .filter(([, p]) => p === 'commander-only')
      .map(([r]) => commandRankLabel(r))
      .join('/');
    return ranks ? ` + ${ranks}` : ' + מפקד';
  })();
  switch (m.kind) {
    case 'exact':
      return `${m.count}${commander}`;
    case 'range':
      return `${m.min}–${m.max}${commander}`;
    case 'window-varies': {
      const parts = m.windows.map((w) => {
        const n = w.spec.kind === 'exact' ? `${w.spec.count}` : `${w.spec.min}–${w.spec.max}`;
        const lbl = w.label === 'day' ? 'יום' : w.label === 'night' ? 'לילה' : w.label;
        return `${n} ב${lbl}`;
      });
      return `${parts.join(' · ')}${commander}`;
    }
  }
}

function commandRankLabel(r: string): string {
  switch (r) {
    case 'soldier': return 'חייל';
    case 'mk':      return 'מ״כ';
    case 'samal':   return 'סמל';
    case 'mam':     return 'מ״מ';
    case 'officer': return 'קצין';
    default:        return r;
  }
}

// ─── Scope description helpers (reused from the L2 page) ────────────────────

function describeAbsentScope(
  scope: AbsentScope, platoons: Platoon[], squads: Squad[], soldiers: Soldier[],
): string {
  switch (scope.kind) {
    case 'platoon': return platoons.find((p) => p.id === scope.platoonId)?.name ?? 'מחלקה';
    case 'squad':   return squads.find((s) => s.id === scope.squadId)?.name ?? 'כיתה';
    case 'soldiers': {
      const names = scope.soldierIds.map((id) => soldiers.find((s) => s.id === id)?.name).filter(Boolean) as string[];
      if (names.length <= 2) return names.join(' · ');
      return `${names.slice(0, 2).join(' · ')} +${names.length - 2}`;
    }
  }
}

function describeCoveringScopeShort(
  scope: CoveringScope, platoons: Platoon[], squads: Squad[], soldiers: Soldier[],
): string {
  switch (scope.kind) {
    case 'mission-already-covers': return 'המשימות מכסות';
    case 'platoon': return platoons.find((p) => p.id === scope.platoonId)?.name ?? 'מחלקה';
    case 'squad':   return squads.find((s) => s.id === scope.squadId)?.name ?? 'כיתה';
    case 'soldiers': {
      const names = scope.soldierIds.map((id) => soldiers.find((s) => s.id === id)?.name).filter(Boolean) as string[];
      return names.join(' · ');
    }
  }
}

// ─── Time helpers ───────────────────────────────────────────────────────────

function overlapsDay(startIso: string, endIso: string, day: Date): boolean {
  const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(day); dayEnd.setHours(23, 59, 59, 999);
  const s = Date.parse(startIso);
  const e = Date.parse(endIso);
  if (isNaN(s) || isNaN(e)) return false;
  return s <= dayEnd.getTime() && e >= dayStart.getTime();
}

function formatHHmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── Date helpers (kept local — preview is the only consumer) ───────────────

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const HE_MONTHS_SHORT = ['ינו׳','פבר׳','מרץ','אפר׳','מאי','יוני','יולי','אוג׳','ספט׳','אוק׳','נוב׳','דצמ׳'];

function formatHebrewShort(d: Date): string {
  return `${d.getDate()} ב${HE_MONTHS_SHORT[d.getMonth()]}`;
}
