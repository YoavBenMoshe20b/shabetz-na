// Mission materialization — Mission policy → concrete AssignmentSlots.
//
// This is the CONNECTOR between the engine foundation (Mission, Qualification,
// AssignmentSlot — all typed but read-only until now) and every operational
// surface the user actually sees. The real engine (slices E3+) will replace
// this with eligibility + rotation + fairness + validation pipelines. For
// now, this is a deterministic projection that's good enough to make the
// product feel coherent: a mission created in the wizard appears on the
// calendar, on the soldier's "my next shift", on the PC's day-of view, etc.
//
// What this is NOT:
//   • not an optimizer
//   • not fairness-aware
//   • not rest-aware (no fatigue check)
//   • not the real engine
//
// What it IS:
//   • per active Mission, per day in window: emit slot(s) with snapshot fields
//   • resolve rotation deterministically per day
//   • pseudo-assign first-N-available soldiers from the owner platoon
//   • promote one assignee to commander when command is required

import type {
  Mission, MissionManpowerSpec,
  MissionRotation, RotationPeriod, AssignmentSlot, AssignmentSlotStatus,
  CommandRank, Soldier, Platoon, Squad, Leave, DutyExclusion,
  OperationalRole,
} from '../types';
import {
  getArchetypeBehavior, splitDayNightWindows, type ArchetypeBehavior,
} from './archetypeBehavior';

// Local alias — the engine declares MissionManpowerSpec as a discriminated
// union; this is the 'window-varies' variant.
type WindowVariesManpower = Extract<MissionManpowerSpec, { kind: 'window-varies' }>;

// Augmented slot — includes the pseudo-assignments produced at materialization
// time. Real AssignmentSlot doesn't carry assignees; the engine produces them
// as separate Assignment[] records. For this materializer, we attach them
// inline so every surface can render slot + assignees in one read.
export interface MaterializedSlot extends AssignmentSlot {
  assignedSoldierIds: string[];
  commanderSoldierId?: string;
  /** Mission name, frozen at materialization for cheap rendering. */
  missionName: string;
  /** Mission intensity, for tone selection downstream. */
  missionIntensity: Mission['fatigue']['intensity'];
  /** Sustained manpower estimate when the mission has a cycleProfile.
   *  Computed as base manpower × ceil((guard + rest) / guard) —
   *  approximation of how many soldiers in rotation are needed to
   *  staff this position continuously. Undefined for non-continuous
   *  missions and for continuous missions without a cycleProfile. */
  sustainedManpower?: number;

  // ── Phase 7.3 — archetype runtime tags ─────────────────────────────
  /** Which archetype produced this slot ('custom' for legacy). */
  archetypeKind: import('../types').MissionArchetypeKind;
  /** Day or night portion of the mission cycle. Used downstream for
   *  fatigue weighting, tone, and label rendering. */
  partOfDay: 'day' | 'night';
  /** Effective fatigue weight for THIS slot — archetype's base weight
   *  plus nightFatigueBoost when partOfDay='night' AND the day/night
   *  profile says fatigueDiffersByPeriod. */
  effectiveFatigueWeight: number;
}

interface MaterializeInput {
  missions:        Mission[];
  platoons:        Platoon[];
  squads:          Squad[];
  soldiers:        Soldier[];
  leaves:          Leave[];
  dutyExclusions:  DutyExclusion[];
  /** Inclusive — day 0 of the window. */
  startDay:        Date;
  /** Number of days to materialize, default 7. */
  days?:           number;
  /** Optional persisted assignments keyed by materialized slot.id
   *  (`mat-<missionId>-<isoDate>-<windowIdx>`). When provided, the
   *  materializer USES these assignments instead of its auto-pick
   *  heuristic. This is the bridge from operator-confirmed staffing
   *  back into the schedule everyone sees.
   *
   *  The Assignment shape (slotId, soldierId, role) lives in types.
   *  We accept a flat array here and group internally. */
  assignments?:    { slotId: string; soldierId: string; role: 'soldier' | 'commander' }[];
  /** Mission Operations Layer state — durable per-slot operator
   *  manipulations. Currently consumed for: excusedUntil (filters the
   *  eligible pool when auto-picking). `lockedSoldierIds` is recorded
   *  for future auto-restaff logic; today's materializer already
   *  respects all soldiers in `assignments` so explicit locks are
   *  visual + forward-compatible. */
  slotOperationalState?: Array<{
    slotId: string;
    lockedSoldierIds?: string[];
    excusedUntil?: { soldierId: string; untilIso: string }[];
    lockedCommander?: string;
  }>;
  /** Operational Leave Management — per-date per-platoon home/base.
   *  When a slot's ownerPlatoon is `home` on the slot's date, its
   *  soldiers are dropped from the eligible pool UNLESS a per-soldier
   *  override marks them in-base. Operator can still force them via
   *  the existing `assignments` channel — that bypasses materializer
   *  auto-pick entirely. */
  platoonLeaveDays?: Array<{
    dateIso: string;
    platoonId: string;
    status: 'home' | 'in-base' | 'partial';
  }>;
  /** Soldier-level overrides on top of platoon-day. Same keys. */
  soldierLeaveOverrides?: Array<{
    dateIso: string;
    soldierId: string;
    status: 'home' | 'in-base';
  }>;
}

export function materializeWeek(input: MaterializeInput): MaterializedSlot[] {
  const days = input.days ?? 7;
  const slots: MaterializedSlot[] = [];

  // Index assignments by slotId for O(1) lookup during slot construction.
  // Operator-confirmed staffing wins over the auto-pick heuristic — that's
  // the whole point of persistence.
  const assignmentsBySlot = new Map<string, { soldiers: string[]; commander?: string }>();
  for (const a of input.assignments ?? []) {
    const cur = assignmentsBySlot.get(a.slotId) ?? { soldiers: [] };
    if (a.role === 'commander') cur.commander = a.soldierId;
    else cur.soldiers.push(a.soldierId);
    assignmentsBySlot.set(a.slotId, cur);
  }

  // Index operational state by slotId. Excuses become per-slot hard
  // exclusions in the eligible pool; locks survive future auto-restaff.
  const opsBySlot = new Map<string, NonNullable<MaterializeInput['slotOperationalState']>[number]>();
  for (const op of input.slotOperationalState ?? []) {
    opsBySlot.set(op.slotId, op);
  }

  // Operational leave — index by `dateIso::platoonId`.
  const platoonLeaveBy = new Map<string, NonNullable<MaterializeInput['platoonLeaveDays']>[number]>();
  for (const d of input.platoonLeaveDays ?? []) {
    platoonLeaveBy.set(`${d.dateIso}::${d.platoonId}`, d);
  }
  // Per-soldier overrides — index by `dateIso::soldierId`.
  const soldierOverrideBy = new Map<string, NonNullable<MaterializeInput['soldierLeaveOverrides']>[number]>();
  for (const o of input.soldierLeaveOverrides ?? []) {
    soldierOverrideBy.set(`${o.dateIso}::${o.soldierId}`, o);
  }

  for (let offset = 0; offset < days; offset++) {
    const day = new Date(input.startDay);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + offset);

    for (const mission of input.missions) {
      if (mission.status !== 'active') continue;
      const windows = windowsForDay(mission, day);
      if (windows.length === 0) continue;

      const ownerPlatoonId = resolveRotation(mission.rotation, day, input.platoons);
      const ownerPool      = soldiersInPlatoon(ownerPlatoonId, input.soldiers, input.squads);

      // Phase 7.3 — archetype-driven behavior. ONE call per mission per
      // day; every per-slot decision downstream reads off this object.
      const behavior = getArchetypeBehavior(mission);

      // Expand each base window into archetype-shaped segments. For
      // static-guard with distinct day/night durations this multiplies
      // a single 24h window into multiple per-period slots. For every
      // other archetype it returns the window unchanged (tagged).
      const expanded: Array<{ w: ConcreteWindow; wIdx: number; segIdx: number; partOfDay: 'day' | 'night' }> = [];
      windows.forEach((w, wIdx) => {
        const segments = splitDayNightWindows(w.start, w.end, behavior);
        segments.forEach((seg, segIdx) => {
          expanded.push({
            w: { start: seg.start, end: seg.end },
            wIdx, segIdx, partOfDay: seg.partOfDay,
          });
        });
      });

      expanded.forEach(({ w, wIdx, segIdx, partOfDay }) => {
        const required = effectiveRequiredCount(mission.manpower, w, behavior, partOfDay);
        const commanderRequired = mission.command.fieldCommandRequired;
        const commanderRanks    = commanderOnlyRanks(mission.command.rankPolicy);

        // Slot id stability: legacy single-window missions emit
        // `mat-<id>-<iso>-<wIdx>` exactly as before. Day/night-split
        // slots get a trailing segment index so persisted assignments
        // for an unsplit mission keep working when archetypeKind is
        // backfilled later. The discriminator is "is segIdx > 0 OR
        // did the behavior decide to split", not the segment index
        // alone — that preserves existing ids for the common case.
        const slotId = behavior.splitsByDayNight
          ? `mat-${mission.id}-${isoDate(day)}-${wIdx}-${segIdx}`
          : `mat-${mission.id}-${isoDate(day)}-${wIdx}`;
        const persisted = assignmentsBySlot.get(slotId);
        const ops = opsBySlot.get(slotId);

        // Excused-until soldiers are dropped from this slot's eligible
        // pool when the excuse is still in effect at the slot's start.
        // Operator manipulations win over auto-pick.
        const slotStartIso = w.start.toISOString();
        const excusedHere = new Set(
          (ops?.excusedUntil ?? [])
            .filter((e) => e.untilIso > slotStartIso)
            .map((e) => e.soldierId),
        );

        // Operational Leave — drop soldiers whose platoon is `home` on
        // the slot's date, unless a per-soldier override says in-base.
        const dateIsoForSlot = isoDate(day);
        const ownerHome = platoonLeaveBy.get(`${dateIsoForSlot}::${ownerPlatoonId ?? ''}`);
        const platoonIsHome = ownerHome?.status === 'home';

        const eligible = ownerPool.filter((s) => {
          if (!isAvailable(s, w.start, input.leaves, input.dutyExclusions)) return false;
          if (excusedHere.has(s.id)) return false;
          if (platoonIsHome) {
            const override = soldierOverrideBy.get(`${dateIsoForSlot}::${s.id}`);
            if (override?.status !== 'in-base') return false;
          }
          // Per-soldier home override even if platoon is in-base.
          const sOverride = soldierOverrideBy.get(`${dateIsoForSlot}::${s.id}`);
          if (sOverride?.status === 'home') return false;
          return true;
        });

        // If we have operator-confirmed assignments for this slot, USE
        // THEM verbatim. Auto-pick only runs when nothing is persisted —
        // it's a placeholder for "what the engine would do", not a
        // decision that overrides the operator.
        let commander: Soldier | undefined;
        let assigned: Soldier[];

        if (persisted) {
          commander = persisted.commander
            ? input.soldiers.find((s) => s.id === persisted.commander)
            : undefined;
          assigned = persisted.soldiers
            .map((id) => input.soldiers.find((s) => s.id === id))
            .filter((s): s is Soldier => !!s);
        } else {
          // Auto-pick: commander first (so soldier slots don't accidentally consume them).
          if (commanderRequired && commanderRanks.length > 0) {
            commander = eligible.find((s) => commanderRanks.includes(soldierCommandRank(s)));
          }
          const restPool = commander ? eligible.filter((s) => s.id !== commander!.id) : eligible;
          const needRegular = mission.command.commanderCountsAsManpower && commander
            ? Math.max(0, required - 1)
            : required;
          assigned = restPool.slice(0, needRegular);
        }

        const totalCount = assigned.length + (commander ? 1 : 0);
        const status: AssignmentSlotStatus =
          totalCount === 0                              ? 'open'              :
          totalCount < required                         ? 'partially-staffed' :
          commanderRequired && !commander               ? 'partially-staffed' :
          'fully-staffed';

        // Sustained manpower — only meaningful for continuous missions
        // with a cycleProfile. Approximation: ceil((guard+rest)/guard)
        // shifts in rotation × per-shift manpower.
        let sustainedManpower: number | undefined;
        if (mission.cycleProfile && mission.timeModel.kind === '24-7-continuous') {
          const { guardMinutes, restMinutes } = mission.cycleProfile;
          if (guardMinutes > 0) {
            const shiftsPerCycle = Math.ceil((guardMinutes + restMinutes) / guardMinutes);
            sustainedManpower = required * shiftsPerCycle;
          }
        }

        // Effective fatigue weight per slot — archetype baseline plus
        // night boost when applicable. Used downstream for burden math
        // and tone selection.
        const effectiveFatigueWeight =
          behavior.fatigueWeight + (partOfDay === 'night' ? behavior.nightFatigueBoost : 0);

        slots.push({
          id:                slotId,
          companyId:         mission.companyId,
          missionId:         mission.id,
          start:             w.start.toISOString(),
          end:               w.end.toISOString(),
          requiredCount:     required,
          commanderRequired,
          commanderCount:    mission.command.commandersPerSlot,
          commanderRanks:    commanderRanks,
          commanderCountsAsManpower: mission.command.commanderCountsAsManpower,
          qualifications:    mission.qualifications,
          equipment:         mission.equipment,
          squadPolicy:       mission.squadPolicy,
          ownerPlatoonId:    ownerPlatoonId ?? '',
          status,
          generatedAt:       new Date().toISOString(),
          generatedBy:       'engine',
          assignedSoldierIds: assigned.map((s) => s.id),
          commanderSoldierId: commander?.id,
          missionName:        mission.name,
          missionIntensity:   mission.fatigue.intensity,
          sustainedManpower,
          archetypeKind:      behavior.kind,
          partOfDay,
          effectiveFatigueWeight,
        });
      });
    }
  }

  return slots.sort((a, b) => a.start.localeCompare(b.start));
}

// ─── Time window resolution ─────────────────────────────────────────────────

interface ConcreteWindow {
  start: Date;
  end:   Date;
}

function windowsForDay(mission: Mission, day: Date): ConcreteWindow[] {
  const t = mission.timeModel;
  switch (t.kind) {
    case '24-7-continuous': {
      // Treat as a single all-day slot; finer-grained shifts are a planner concern.
      const s = new Date(day); s.setHours(0, 0, 0, 0);
      const e = new Date(day); e.setHours(23, 59, 59, 0);
      return [{ start: s, end: e }];
    }
    case 'on-demand':
      return [];
    case 'one-time': {
      const s = new Date(t.start);
      const e = new Date(t.end);
      if (s.toDateString() !== day.toDateString()) return [];
      return [{ start: s, end: e }];
    }
    case 'daily-variable': {
      const iso = isoDate(day);
      const ws  = t.perDate[iso];
      if (!ws) return [];
      return ws.map((w) => toConcrete(day, w.startTime, w.endTime));
    }
    case 'fixed-hours': {
      const out: ConcreteWindow[] = [];
      for (const w of t.windows) {
        const recurs =
          w.recurring === 'every-day' ||
          (typeof w.recurring === 'object' && w.recurring.daysOfWeek.includes(day.getDay()));
        if (!recurs) continue;
        out.push(toConcrete(day, w.startTime, w.endTime));
      }
      return out;
    }
  }
}

function toConcrete(day: Date, startHHmm: string, endHHmm: string): ConcreteWindow {
  const [sh, sm] = startHHmm.split(':').map(Number);
  const [eh, em] = endHHmm.split(':').map(Number);
  const start = new Date(day); start.setHours(sh, sm, 0, 0);
  const end   = new Date(day); end.setHours(eh, em, 0, 0);
  if (end <= start) end.setDate(end.getDate() + 1);   // overnight
  return { start, end };
}

// ─── Manpower resolution ────────────────────────────────────────────────────

function manpowerForWindow(m: MissionManpowerSpec, w: ConcreteWindow): number {
  switch (m.kind) {
    case 'exact':  return m.count;
    case 'range':  return m.ideal ?? m.min;
    case 'window-varies':
      // Pick the window whose HH:MM range contains the slot's start time.
      return manpowerForVarying(m, w.start);
  }
}

/**
 * Required count for a slot, honoring archetype day/night overrides.
 * Falls back to the manpower spec when the archetype doesn't carry a
 * period-specific minimum.
 */
function effectiveRequiredCount(
  m: MissionManpowerSpec,
  w: ConcreteWindow,
  behavior: ArchetypeBehavior,
  partOfDay: 'day' | 'night',
): number {
  if (partOfDay === 'day'   && behavior.dayMinCount  !== undefined) return behavior.dayMinCount;
  if (partOfDay === 'night' && behavior.nightMinCount !== undefined) return behavior.nightMinCount;
  return manpowerForWindow(m, w);
}

function manpowerForVarying(m: WindowVariesManpower, atTime: Date): number {
  const hhmm = `${String(atTime.getHours()).padStart(2, '0')}:${String(atTime.getMinutes()).padStart(2, '0')}`;
  for (const win of m.windows) {
    if (hhmmInRange(hhmm, win.from, win.to)) {
      return win.spec.kind === 'exact' ? win.spec.count : win.spec.min;
    }
  }
  // Fallback to first window's count
  const first = m.windows[0];
  if (!first) return 1;
  return first.spec.kind === 'exact' ? first.spec.count : first.spec.min;
}

function hhmmInRange(hhmm: string, from: string, to: string): boolean {
  // Handles ranges that wrap midnight (e.g. 22:00 → 06:00).
  if (from <= to) return hhmm >= from && hhmm < to;
  return hhmm >= from || hhmm < to;
}

// ─── Rotation resolution ────────────────────────────────────────────────────

function resolveRotation(r: MissionRotation, day: Date, platoons: Platoon[]): string | null {
  switch (r.kind) {
    case 'fixed-platoon':
      return r.platoonId || (platoons[0]?.id ?? null);
    case 'rotate-platoons': {
      const order = (r.order && r.order.length > 0) ? r.order : platoons.map((p) => p.id);
      if (order.length === 0) return null;
      const idx = cycleIndex(day, r.period, order.length);
      return order[idx];
    }
    case 'rotate-squads':
      // Squad rotation resolves to "the platoon that contains the active squad".
      // For now, just cycle platoons by the same rule — squad selection is the
      // planner's concern (not this demo materializer).
      return platoons[cycleIndex(day, r.period, platoons.length)]?.id ?? null;
    case 'whichever-strongest':
    case 'returning-from-home':
      // No fatigue/rotation tracking in this materializer — pick first platoon.
      return platoons[0]?.id ?? null;
    case 'manual':
      // Without a manual plan, default to first platoon.
      return platoons[0]?.id ?? null;
  }
}

function cycleIndex(day: Date, period: RotationPeriod, length: number): number {
  if (length === 0) return 0;
  if (period === 'daily') {
    return daysSinceEpoch(day) % length;
  }
  if (period === 'weekly') {
    return Math.floor(daysSinceEpoch(day) / 7) % length;
  }
  // everyHours
  if (typeof period === 'object' && 'everyHours' in period) {
    const hours = Math.floor(day.getTime() / 3600000);
    return Math.floor(hours / Math.max(1, period.everyHours)) % length;
  }
  return 0;
}

function daysSinceEpoch(d: Date): number {
  const startOfDay = new Date(d); startOfDay.setHours(0, 0, 0, 0);
  return Math.floor(startOfDay.getTime() / 86400000);
}

// ─── Soldier eligibility (pseudo) ───────────────────────────────────────────

function isAvailable(s: Soldier, atTime: Date, leaves: Leave[], dutyExclusions: DutyExclusion[]): boolean {
  // DutyExclusion blocks everything in the window.
  for (const e of dutyExclusions) {
    if (e.soldierId !== s.id) continue;
    const sMs = Date.parse(e.startIso);
    const eMs = Date.parse(e.endIso);
    if (!isNaN(sMs) && !isNaN(eMs) && atTime.getTime() >= sMs && atTime.getTime() <= eMs) return false;
  }

  // currentStatus checks.
  if (s.currentStatus === 'inactive-temp') return false;
  if (s.currentStatus === 'home') {
    if (!s.statusExpectedUntil) return false;
    if (Date.parse(s.statusExpectedUntil) > atTime.getTime()) return false;
  }

  // Leave overlap.
  const dayIso = atTime.toISOString().slice(0, 10);
  for (const lv of leaves) {
    if (dayIso < lv.startDate || dayIso > lv.endDate) continue;
    if (lv.scope === 'individual' && lv.soldierIds.includes(s.id)) return false;
    if (lv.scope === 'squad' && s.squadId === lv.squadId) return false;
  }

  return true;
}

function soldiersInPlatoon(platoonId: string | null, soldiers: Soldier[], squads: Squad[]): Soldier[] {
  if (!platoonId) return [];
  const squadIds = new Set(squads.filter((s) => s.platoonId === platoonId).map((s) => s.id));
  return soldiers.filter((s) => s.squadId && squadIds.has(s.squadId));
}

// ─── Command-rank derivation from OperationalRole tags ──────────────────────
//
// Soldier.operationalRoles[] carries Hebrew rank tags like 'מ״כ', 'סמל', 'מ״מ'.
// CommandRank is the engine's abstract rank enum. This mapping picks the
// HIGHEST rank present.

const ROLE_TO_RANK: Array<[OperationalRole, CommandRank]> = [
  ['מ״פ',    'officer'],
  ['סמ״פ',   'officer'],
  ['מ״מ',    'mam'],
  ['סמל',    'samal'],
  ['מ״כ',    'mk'],
];

function soldierCommandRank(s: Soldier): CommandRank {
  for (const [role, rank] of ROLE_TO_RANK) {
    if (s.operationalRoles.includes(role)) return rank;
  }
  return 'soldier';
}

function commanderOnlyRanks(rankPolicy: Record<CommandRank, string>): CommandRank[] {
  return (Object.entries(rankPolicy) as Array<[CommandRank, string]>)
    .filter(([, p]) => p === 'commander-only')
    .map(([r]) => r);
}

// ─── Date helper ────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
