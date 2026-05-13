// Calendar projection — single source of truth for "what's on the calendar
// for this day, for this viewer". Every calendar screen calls buildDayEntries
// and renders the returned CalendarEntry[]. No screen reads CalendarEvent /
// Leave / TimeSlot directly.
//
// The projection layer is responsible for THREE things:
//   1. Merging storage events (CalendarEvent) with derived entries computed
//      from existing entities (Leave → leave-period, TimeSlot → guard-shift,
//      Soldier.dateOfBirth → birthday).
//   2. Applying viewer-scoped visibility — a soldier never sees another
//      soldier's personal entries; a PC sees only their platoon; a CC sees
//      the whole company.
//   3. Stamping priority so overlapping entries stack predictably
//      (mission > guard-shift > leave-period > platoon-time filled > ...).
//
// The legacy SchedulePeriod demo fallback that projected 2024-05 mock slots
// onto today is gone. Guard-shifts now come from materialized slots produced
// by utils/materialize.ts — the connector between the Mission engine
// foundation and visible surfaces.

import type {
  CalendarEntry, CalendarEvent, Leave, Soldier, Platoon, Squad,
  UserRole,
} from '../types';
import type { MaterializedSlot } from './materialize';

// ─── Inputs ──────────────────────────────────────────────────────────────────

export interface CalendarViewer {
  soldierProfileId?:   string;   // viewer's active Soldier.id
  platoonId?:          string;   // viewer's platoon membership
  commandedPlatoonId?: string;   // platoon the viewer commands (PC/PS)
  companyId?:          string;
  role:                UserRole;
}

export interface CalendarSources {
  calendarEvents:    CalendarEvent[];
  leaves:            Leave[];
  soldiers:          Soldier[];
  platoons:          Platoon[];
  squads:            Squad[];
  /** Pre-materialized AssignmentSlots for the visible window. The caller
   *  produces these via utils/materialize.ts → materializeWeek(). */
  materializedSlots: MaterializedSlot[];
}

export interface BuildDayEntriesInput {
  day:     Date;
  viewer:  CalendarViewer;
  sources: CalendarSources;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function buildDayEntries(input: BuildDayEntriesInput): CalendarEntry[] {
  const { day, viewer, sources } = input;
  const dayStart = startOfDay(day);
  const dayEnd   = endOfDay(day);
  const dayIso   = isoDate(dayStart);

  const out: CalendarEntry[] = [];

  // 1. Storage events (combat-block, locked-date, announcement)
  for (const ev of sources.calendarEvents) {
    if (!overlapsDay(ev.start, ev.end, dayStart, dayEnd)) continue;
    out.push(...calendarEventToEntries(ev));
  }

  // 2. Leave-periods overlapping today
  for (const lv of sources.leaves) {
    const lvStart = `${lv.startDate}T${lv.startTime || '00:00'}:00`;
    const lvEnd   = `${lv.endDate}T${lv.endTime   || '23:59'}:00`;
    if (!overlapsDay(lvStart, lvEnd, dayStart, dayEnd)) continue;
    for (const personalEntry of leaveToEntries(lv, sources.soldiers)) {
      out.push(personalEntry);
    }
  }

  // 3. Guard-shifts from materialized slots (Mission engine projection).
  for (const slot of sources.materializedSlots) {
    if (!overlapsDay(slot.start, slot.end, dayStart, dayEnd)) continue;
    out.push(...slotToEntries(slot));
  }

  // 4. Birthdays — any soldier whose dateOfBirth's MM-DD matches today
  const mmdd = dayIso.slice(5);
  for (const s of sources.soldiers) {
    if (!s.dateOfBirth) continue;
    if (s.dateOfBirth.slice(5) !== mmdd) continue;
    out.push({
      id:         `birthday-${s.id}-${dayIso}`,
      kind:       'birthday',
      scope:      'personal',
      scopeRefId: s.id,
      start:      `${dayIso}T00:00:00`,
      end:        `${dayIso}T23:59:59`,
      allDay:     true,
      title:      `יום הולדת — ${s.name}`,
      priority:   5,
      locked:     true,
      sourceRef:  { kind: 'soldier-dob', id: s.id },
    });
  }

  // 5. Visibility filter (viewer-aware)
  const visible = out.filter((e) => canSee(e, viewer, sources));

  // 6. Sort: all-day first (rendered in a strip), then by start ascending.
  //    Within the same time, higher priority first.
  visible.sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    if (a.start !== b.start)   return a.start.localeCompare(b.start);
    return b.priority - a.priority;
  });

  return visible;
}

// ─── Projection: CalendarEvent → CalendarEntry[] ─────────────────────────────

function calendarEventToEntries(ev: CalendarEvent): CalendarEntry[] {
  const base = {
    start: ev.start, end: ev.end, allDay: ev.allDay,
    scope: ev.scope, scopeRefId: ev.scopeRefId,
    sourceRef: { kind: 'calendar-event', id: ev.id },
  };

  if (ev.kind === 'combat-block') {
    const cb = ev.combatBlock;
    if (!cb) return [];

    // platoon-time gets its own visual kind so the page can render filled
    // vs empty differently and so PC sees their own fill prominently.
    if (cb.kind === 'platoon-time') {
      const filled = !!cb.platoonFill;
      return [{
        ...base,
        id: ev.id,
        kind: 'platoon-time',
        title: filled ? cb.platoonFill!.title : 'זמן מחלקה',
        detail: filled
          ? cb.platoonFill!.detail
          : 'טרם מולא — בהמתנה למ״מ',
        priority: filled ? 50 : 10,
        locked: false,
      }];
    }

    // Other combat-block sub-kinds → 'combat-block' entry. Operational
    // sub-kinds (training/briefing) get higher priority than background
    // ones (mess/rest/free) so an overlapping training reads on top of
    // an overlapping meal block.
    const operational = cb.kind === 'training' || cb.kind === 'briefing';
    return [{
      ...base,
      id: ev.id,
      kind: 'combat-block',
      title: ev.title,
      detail: ev.detail,
      priority: operational ? 40 : 20,
      locked: false,
    }];
  }

  if (ev.kind === 'locked-date') {
    return [{
      ...base,
      id: ev.id,
      kind: 'locked-date',
      title: ev.title,
      detail: ev.lockedDate?.reason,
      priority: 5,
      locked: true,
    }];
  }

  if (ev.kind === 'announcement') {
    return [{
      ...base,
      id: ev.id,
      kind: 'announcement',
      title: ev.title,
      detail: ev.detail,
      priority: 30,
      locked: false,
    }];
  }

  return [];
}

// ─── Projection: Leave → CalendarEntry[] ─────────────────────────────────────

function leaveToEntries(lv: Leave, soldiers: Soldier[]): CalendarEntry[] {
  const start = `${lv.startDate}T${lv.startTime || '00:00'}:00`;
  const end   = `${lv.endDate}T${lv.endTime     || '23:59'}:00`;

  // Resolve which soldiers this leave actually applies to. We emit ONE
  // personal entry per soldier so the visibility filter can scope per-
  // viewer correctly. (Aggregating across a whole squad/machlaka would
  // leak the leave to viewers who shouldn't see members of other squads.)
  let soldierIds: string[] = [];
  if (lv.scope === 'individual') {
    soldierIds = lv.soldierIds;
  } else if (lv.scope === 'squad') {
    soldierIds = soldiers
      .filter((s) => s.squadId === lv.squadId)
      .map((s) => s.id);
  } else {
    // machlaka — apply to all soldiers in the platoon. For demo purposes
    // we apply to all known soldiers; production code will scope by
    // platoonId when the Leave model carries it.
    soldierIds = soldiers.map((s) => s.id);
  }

  return soldierIds.map((sid) => {
    const s = soldiers.find((x) => x.id === sid);
    return {
      id:         `leave-${lv.id}-${sid}`,
      kind:       'leave-period' as const,
      scope:      'personal' as const,
      scopeRefId: sid,
      start, end,
      allDay:     true,    // leave-periods are calendar-day blocks
      title:      s ? `${s.name} בבית` : 'חופשה',
      detail:     lv.note,
      priority:   70,
      locked:     true,
      sourceRef:  { kind: 'leave', id: lv.id },
    };
  });
}

// ─── Projection: MaterializedSlot → CalendarEntry[] ──────────────────────────
//
// Each slot becomes:
//   1. One platoon-scoped summary entry (visible to anyone with access to
//      the owner platoon — commanders, soldiers in that platoon)
//   2. One personal entry per assigned soldier (so a soldier sees their own
//      shifts even when the company-wide visibility wouldn't include them)
//
// kind: 'mission' for slots whose Mission carries an operational intensity
// (ambush / active-patrol / readiness); kind: 'guard-shift' for the rest.

function slotToEntries(slot: MaterializedSlot): CalendarEntry[] {
  const out: CalendarEntry[] = [];
  const isOperational =
    slot.missionIntensity === 'ambush'        ||
    slot.missionIntensity === 'active-patrol' ||
    slot.missionIntensity === 'readiness';
  const kind = isOperational ? 'mission' : 'guard-shift';
  const priority = isOperational ? 100 : 90;

  const assignedCount = slot.assignedSoldierIds.length + (slot.commanderSoldierId ? 1 : 0);
  const summaryDetail = (() => {
    if (slot.status === 'open')              return 'לא מאוישת';
    if (slot.status === 'partially-staffed') return `${assignedCount}/${slot.requiredCount} מאוישים`;
    return `${assignedCount} מאוישים`;
  })();

  // Platoon-scoped summary
  out.push({
    id:         `slot-summary-${slot.id}`,
    kind,
    scope:      'platoon',
    scopeRefId: slot.ownerPlatoonId || '*',
    start:      slot.start,
    end:        slot.end,
    allDay:     false,
    title:      slot.missionName,
    detail:     summaryDetail,
    priority,
    locked:     true,
    sourceRef:  { kind: 'assignment-slot', id: slot.id },
  });

  // Personal entries — each assigned soldier + commander
  const personalIds = [...slot.assignedSoldierIds];
  if (slot.commanderSoldierId) personalIds.push(slot.commanderSoldierId);
  for (const sid of personalIds) {
    const isCommander = sid === slot.commanderSoldierId;
    out.push({
      id:         `slot-personal-${slot.id}-${sid}`,
      kind,
      scope:      'personal',
      scopeRefId: sid,
      start:      slot.start,
      end:        slot.end,
      allDay:     false,
      title:      slot.missionName,
      detail:     isCommander ? 'מפקד משמרת' : undefined,
      priority,
      locked:     true,
      sourceRef:  { kind: 'assignment-slot', id: slot.id },
    });
  }
  return out;
}

// ─── Visibility ──────────────────────────────────────────────────────────────

function canSee(entry: CalendarEntry, viewer: CalendarViewer, sources: CalendarSources): boolean {
  // Company-scoped events are seen by anyone in the company.
  if (entry.scope === 'company') {
    return entry.scopeRefId === viewer.companyId;
  }

  // Platoon-scoped events.
  if (entry.scope === 'platoon') {
    // Wildcard guard-shift summaries: any platoon-tier-or-above viewer in the
    // company can see them. Soldiers only see them via their personal entry.
    if (entry.scopeRefId === '*') {
      return isPlatoonOrAbove(viewer.role);
    }
    if (entry.scopeRefId === viewer.platoonId) return true;
    if (entry.scopeRefId === viewer.commandedPlatoonId) return true;
    // CC sees all platoons in their company.
    if (isCompanyTier(viewer.role)) {
      const p = sources.platoons.find((pp) => pp.id === entry.scopeRefId);
      return !!p && p.companyId === viewer.companyId;
    }
    return false;
  }

  // Personal-scoped events.
  // Soldier sees only their own.
  if (viewer.role === 'soldier') {
    return entry.scopeRefId === viewer.soldierProfileId;
  }

  // Commanders see "staffing-relevant" personal entries for soldiers in
  // scope — leave-period and birthday. Other personal kinds (e.g. personal
  // reminders, future "private notes") stay private.
  const staffingRelevant = entry.kind === 'leave-period' || entry.kind === 'birthday';
  if (!staffingRelevant) {
    // Own personal entries always visible.
    return entry.scopeRefId === viewer.soldierProfileId;
  }

  // PC sees personal staffing entries for soldiers in their commanded platoon.
  if (isPlatoonTier(viewer.role) && viewer.commandedPlatoonId) {
    const s = sources.soldiers.find((x) => x.id === entry.scopeRefId);
    if (!s) return false;
    const squad = sources.squads.find((sq) => sq.id === s.squadId);
    return squad?.platoonId === viewer.commandedPlatoonId;
  }

  // CC sees personal staffing entries for any soldier in their company.
  if (isCompanyTier(viewer.role) && viewer.companyId) {
    const s = sources.soldiers.find((x) => x.id === entry.scopeRefId);
    return !!s && s.companyId === viewer.companyId;
  }

  return false;
}

// ─── Role helpers ────────────────────────────────────────────────────────────

function isCompanyTier(role: UserRole): boolean {
  return role === 'companyCommander' || role === 'deputyCompanyCommander' || role === 'owner';
}
function isPlatoonTier(role: UserRole): boolean {
  return role === 'platoonCommander' || role === 'platoonSergeant' || role === 'manager';
}
function isPlatoonOrAbove(role: UserRole): boolean {
  return isCompanyTier(role) || isPlatoonTier(role);
}

// ─── Time helpers ────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const out = new Date(d); out.setHours(0, 0, 0, 0); return out;
}
function endOfDay(d: Date): Date {
  const out = new Date(d); out.setHours(23, 59, 59, 999); return out;
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function overlapsDay(startIso: string, endIso: string, dayStart: Date, dayEnd: Date): boolean {
  const s = Date.parse(startIso);
  const e = Date.parse(endIso);
  if (isNaN(s) || isNaN(e)) return false;
  return s <= dayEnd.getTime() && e >= dayStart.getTime();
}
