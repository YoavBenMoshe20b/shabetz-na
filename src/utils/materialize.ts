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
}

export function materializeWeek(input: MaterializeInput): MaterializedSlot[] {
  const days = input.days ?? 7;
  const slots: MaterializedSlot[] = [];

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

      windows.forEach((w, wIdx) => {
        const required = manpowerForWindow(mission.manpower, w);
        const commanderRequired = mission.command.fieldCommandRequired;
        const commanderRanks    = commanderOnlyRanks(mission.command.rankPolicy);

        const eligible = ownerPool.filter((s) => isAvailable(s, w.start, input.leaves, input.dutyExclusions));

        // Pick commander first (so soldier slots don't accidentally consume them).
        let commander: Soldier | undefined;
        if (commanderRequired && commanderRanks.length > 0) {
          commander = eligible.find((s) => commanderRanks.includes(soldierCommandRank(s)));
        }

        // Pick the rest from eligible pool minus commander.
        const restPool   = commander ? eligible.filter((s) => s.id !== commander!.id) : eligible;
        const needRegular = mission.command.commanderCountsAsManpower && commander
          ? Math.max(0, required - 1)
          : required;
        const assigned   = restPool.slice(0, needRegular);

        const totalCount = assigned.length + (commander ? 1 : 0);
        const status: AssignmentSlotStatus =
          totalCount === 0                              ? 'open'              :
          totalCount < required                         ? 'partially-staffed' :
          commanderRequired && !commander               ? 'partially-staffed' :
          'fully-staffed';

        slots.push({
          id:                `mat-${mission.id}-${isoDate(day)}-${wIdx}`,
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
