// ─── Schedule generation engine ───────────────────────────────────────────────
//
// This is a constraint-aware mock engine. It is NOT production-ready and is
// designed to be replaced by a real solver / AI pipeline. The architecture:
//
//   1. Generate slot grids per mission type (recurring or manual).
//   2. Apply enemy confusion within configured min/max shift bounds.
//   3. For each slot, score every soldier candidate against:
//        - hard constraints (availability, leave, conflicts, class rules)
//        - soft fairness signals (past hours, night/difficult shifts,
//          mission-type repetition, rest gap, role match)
//      Lower score = higher priority. Pick top recommendedSoldiers.
//   4. Walk all slots after assignment and emit manager-only warnings:
//        understaffed, missingRole, commanderMissing, classViolation,
//        insufficientRest, unfairDistribution, etc.
//   5. Return updated mission types + warnings + per-soldier fairness scores.
//
// All warnings carry `managerOnly: true`. The soldier UI must filter them out.

import type {
  Soldier, MissionType, TimeSlot, OperationalRole, Leave,
  SoldierHistory, ShiftWarning, FairnessScore, ScheduleGenerationResult,
  TeamClass, MissionCategory,
} from '../types';

// ─── Time helpers ─────────────────────────────────────────────────────────────

function timeToMins(t: string): number {
  if (t === '24:00') return 24 * 60;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minsToTime(m: number): string {
  const wrapped = ((m % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = Math.floor(wrapped / 60).toString().padStart(2, '0');
  const mm = (wrapped % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function slotDurationMins(slot: TimeSlot): number {
  const s = timeToMins(slot.startTime);
  let e = timeToMins(slot.endTime);
  if (e <= s) e += 24 * 60;
  return e - s;
}

function isNightSlot(slot: TimeSlot): boolean {
  const startHour = parseInt(slot.startTime.split(':')[0], 10);
  return startHour >= 22 || startHour < 6;
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr).getDay();
  return d === 5 || d === 6; // Fri / Sat
}

function hoursBetween(isoA: string, isoB: string): number {
  return Math.abs(new Date(isoA).getTime() - new Date(isoB).getTime()) / 3600000;
}

// ─── Slot generation (recurring schedule) ─────────────────────────────────────

export function generateTimeSlots(
  startDate: string,
  endDate: string,
  activeStart: string,
  activeEnd: string,
  shiftHours: number,
  requiredRoles: OperationalRole[],
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const start = new Date(startDate);
  const end   = new Date(endDate);
  const activeStartMins = timeToMins(activeStart);
  const activeEndMins   = timeToMins(activeEnd);
  const shiftMins       = shiftHours * 60;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    let cursor    = activeStartMins;
    const limit   = activeEndMins > activeStartMins ? activeEndMins : activeEndMins + 24 * 60;

    while (cursor < limit) {
      const slotEnd = Math.min(cursor + shiftMins, limit);
      slots.push({
        id: `gen-${dateStr}-${cursor}`,
        date: dateStr,
        startTime: minsToTime(cursor),
        endTime:   minsToTime(slotEnd),
        assignedSoldierIds: [],
        requiredRoles,
        status: 'open',
      });
      cursor = slotEnd;
    }
  }
  return slots;
}

// ─── Enemy confusion (within bounds) ──────────────────────────────────────────
// Randomizes start time by ±deviationMinutes BUT enforces:
//   - new shift duration stays in [minShiftMinutes, maxShiftMinutes]
//   - deviation never exceeds (max - min) / 2
// Returns a new slot. Deterministic when `seed` is provided.

export function applyEnemyConfusion(
  slot: TimeSlot,
  mt: MissionType,
  deviationMinutes: number,
  seed?: number,
): { slot: TimeSlot; clamped: boolean } {
  if (!mt.enableConfusion || deviationMinutes <= 0) return { slot, clamped: false };

  const maxAllowed = Math.floor((mt.maxShiftMinutes - mt.minShiftMinutes) / 2);
  const dev        = Math.min(deviationMinutes, maxAllowed);
  const clamped    = dev < deviationMinutes;

  // Pseudo-random offset [-dev, +dev]. Use seed for reproducibility.
  const rand   = seed != null ? Math.sin(seed) * 10000 - Math.floor(Math.sin(seed) * 10000) : Math.random();
  const offset = Math.round((rand * 2 - 1) * dev);

  const origStart    = timeToMins(slot.startTime);
  const origDuration = slotDurationMins(slot);
  const newStart     = origStart + offset;
  const newDuration  = Math.max(mt.minShiftMinutes, Math.min(mt.maxShiftMinutes, origDuration));
  const newEnd       = newStart + newDuration;

  return {
    slot: { ...slot, startTime: minsToTime(newStart), endTime: minsToTime(newEnd) },
    clamped,
  };
}

// ─── Hard-constraint checks per slot/soldier ──────────────────────────────────

interface SoldierState {
  intervals: Array<{ date: string; start: number; end: number; missionId: string }>;
  missionAssignments: Set<string>;        // missionTypeIds soldier is on this period
  hoursThisPeriod: number;
  nightShiftsThisPeriod: number;
}

function isSoldierOnLeave(soldier: Soldier, leaves: Leave[], slot: TimeSlot): boolean {
  const slotStart = `${slot.date}T${slot.startTime}`;
  const slotEnd   = `${slot.date}T${slot.endTime}`;
  return leaves.some((lv) => {
    const lvStart = `${lv.startDate}T${lv.startTime}`;
    const lvEnd   = `${lv.endDate}T${lv.endTime}`;
    if (slotStart >= lvEnd || slotEnd <= lvStart) return false;
    if (lv.scope === 'individual') return lv.soldierIds.includes(soldier.id);
    if (lv.scope === 'class')      return soldier.teamClass === lv.teamClass;
    if (lv.scope === 'machlaka')   return true;
    return false;
  });
}

function classMixingOk(soldier: Soldier, mt: MissionType, alreadyAssigned: Soldier[]): boolean {
  if (mt.classMixing === 'specific') {
    if (!mt.allowedClasses || mt.allowedClasses.length === 0) return true;
    return mt.allowedClasses.includes(soldier.teamClass);
  }
  if (mt.classMixing === 'no-mix' && alreadyAssigned.length > 0) {
    return alreadyAssigned.every((s) => s.teamClass === soldier.teamClass);
  }
  return true;
}

function soldierMixingOk(_soldier: Soldier, mt: MissionType, state: SoldierState): boolean {
  if (mt.soldierMixing !== 'dedicated') return true;
  // 'dedicated' = soldier may only be in this mission for the period.
  // If soldier is already on a different mission, reject.
  if (state.missionAssignments.size === 0) return true;
  return state.missionAssignments.size === 1 && state.missionAssignments.has(mt.id);
}

function timeConflictOk(
  _soldier: Soldier, mt: MissionType, slot: TimeSlot, state: SoldierState,
): boolean {
  const start = timeToMins(slot.startTime);
  let end     = timeToMins(slot.endTime);
  if (end <= start) end += 24 * 60;

  for (const iv of state.intervals) {
    if (iv.date !== slot.date) continue;
    const overlap = start < iv.end && end > iv.start;
    if (!overlap) continue;
    // Overlap exists. Allowed only if the *other* mission appears in canOverlapWith
    // AND it does NOT appear in conflictsWith.
    if (mt.conflictsWith.includes(iv.missionId)) return false;
    if (!mt.canOverlapWith.includes(iv.missionId)) return false;
  }
  return true;
}

function restGapOk(slot: TimeSlot, state: SoldierState, minRestHours = 6): boolean {
  const slotStartIso = `${slot.date}T${slot.startTime}`;
  for (const iv of state.intervals) {
    const ivEndIso = `${iv.date}T${minsToTime(iv.end % (24 * 60))}`;
    if (hoursBetween(slotStartIso, ivEndIso) < minRestHours) return false;
  }
  return true;
}

// ─── Candidate scoring (fairness) ─────────────────────────────────────────────
// Lower score = higher priority. Composes past-period history with current-period
// load so the engine balances over time, not just within one period.

function scoreCandidate(
  soldier: Soldier,
  slot: TimeSlot,
  mt: MissionType,
  history: SoldierHistory | undefined,
  state: SoldierState,
): number {
  let score = 0;

  // Current-period load weighs heaviest — fresh data
  score += state.hoursThisPeriod * 1.5;

  // Long-term load nudges toward less-used soldiers
  score += (history?.totalAssignedHours ?? 0) * 0.25;

  // Mission-type repetition: avoid the same person on the same mission repeatedly
  score += (history?.missionTypeCount[mt.name] ?? 0) * 4;

  // Night fairness
  if (isNightSlot(slot)) {
    score += state.nightShiftsThisPeriod * 6;
    score += (history?.totalNightShifts ?? 0) * 1.5;
  }

  // Difficult shift fairness
  if (mt.category === 'שמירה' || mt.category === 'סיור' || isWeekend(slot.date)) {
    score += (history?.difficultShiftScore ?? 0) * 0.8;
  }

  // Recent assignment penalty (encourages rest)
  if (history?.lastAssignmentDate) {
    const hours = hoursBetween(history.lastAssignmentDate, `${slot.date}T${slot.startTime}`);
    if (hours < 24)   score += (24 - hours) * 1.5;
    if (hours < 12)   score += 30;
  }

  // Role match BONUS (negative score = prioritized)
  const required: OperationalRole[] = [
    ...mt.requiredRoles,
    ...(mt.needsCommander ? ['מ״מ' as OperationalRole] : []),
    ...(mt.needsMedic     ? ['חובש' as OperationalRole] : []),
  ];
  if (required.some((r) => soldier.operationalRoles.includes(r))) score -= 25;

  // Tiny tiebreaker noise so order isn't deterministic
  score += (parseInt(soldier.id.replace(/\D/g, ''), 10) || 0) * 0.001;

  return score;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export interface ScheduleGenerationContext {
  missionTypes:  MissionType[];
  soldiers:      Soldier[];
  leaves:        Leave[];
  history:       SoldierHistory[];
  globalConfusion?: { enabled: boolean; minutes: number };
  minRestHours?: number;
}

export function generateSchedule(ctx: ScheduleGenerationContext): ScheduleGenerationResult {
  const minRestHours = ctx.minRestHours ?? 6;
  const available    = ctx.soldiers.filter((s) => s.availability);
  const historyById  = new Map(ctx.history.map((h) => [h.soldierId, h]));

  // Per-soldier rolling state
  const state: Record<string, SoldierState> = {};
  available.forEach((s) => {
    state[s.id] = {
      intervals: [],
      missionAssignments: new Set(),
      hoursThisPeriod: 0,
      nightShiftsThisPeriod: 0,
    };
  });

  // Order missions by constraint difficulty: higher minSoldiers + more required roles first.
  const ordered = [...ctx.missionTypes].sort((a, b) => {
    const ax = a.minSoldiers + a.requiredRoles.length + (a.needsCommander ? 1 : 0) + (a.needsMedic ? 1 : 0);
    const bx = b.minSoldiers + b.requiredRoles.length + (b.needsCommander ? 1 : 0) + (b.needsMedic ? 1 : 0);
    return bx - ax;
  });

  // Build new mission types with assignments
  const built: MissionType[] = ordered.map((mt) => {
    const updatedSlots: TimeSlot[] = mt.timeSlots.map((rawSlot, idx) => {
      // Apply enemy confusion (clamped within bounds)
      const deviation = mt.enableConfusion
        ? mt.confusionDeviationMinutes
        : ctx.globalConfusion?.enabled ? ctx.globalConfusion.minutes : 0;
      const { slot } = applyEnemyConfusion(rawSlot, mt, deviation, idx);

      // Build candidate list with hard-constraint filtering
      const candidates = available.filter((s) => {
        if (isSoldierOnLeave(s, ctx.leaves, slot)) return false;
        if (!soldierMixingOk(s, mt, state[s.id])) return false;
        if (!timeConflictOk(s, mt, slot, state[s.id])) return false;
        if (!restGapOk(slot, state[s.id], minRestHours)) return false;
        return true;
      });

      // Pick `recommendedSoldiers` by ascending score (greedy)
      const selected: Soldier[] = [];
      const scored = candidates
        .map((s) => ({ s, score: scoreCandidate(s, slot, mt, historyById.get(s.id), state[s.id]) }))
        .sort((a, b) => a.score - b.score);

      for (const { s } of scored) {
        if (selected.length >= mt.recommendedSoldiers) break;
        if (!classMixingOk(s, mt, selected)) continue;
        selected.push(s);
        // Update soldier state
        const dur   = slotDurationMins(slot) / 60;
        const start = timeToMins(slot.startTime);
        let end     = timeToMins(slot.endTime);
        if (end <= start) end += 24 * 60;
        state[s.id].intervals.push({ date: slot.date, start, end, missionId: mt.id });
        state[s.id].missionAssignments.add(mt.id);
        state[s.id].hoursThisPeriod += dur;
        if (isNightSlot(slot)) state[s.id].nightShiftsThisPeriod += 1;
      }

      // Compute slot status
      const status: TimeSlot['status'] =
        selected.length === 0 ? 'open' :
        selected.length < mt.minSoldiers ? 'conflict' :
        'filled';

      return { ...slot, assignedSoldierIds: selected.map((s) => s.id), status };
    });

    return { ...mt, timeSlots: updatedSlots };
  });

  // Re-sort built back to the original order (preserve UI ordering)
  const builtById = new Map(built.map((mt) => [mt.id, mt]));
  const finalMissions = ctx.missionTypes.map((mt) => builtById.get(mt.id) ?? mt);

  // ── Generate warnings (manager-only) ───────────────────────────────────────
  const warnings: ShiftWarning[] = collectWarnings(finalMissions, ctx, state, minRestHours);

  // ── Compute fairness ───────────────────────────────────────────────────────
  const fairness: FairnessScore[] = computeFairness(ctx.soldiers, ctx.history, state);

  return { missionTypes: finalMissions, warnings, fairness };
}

// ─── Warning collection ───────────────────────────────────────────────────────

function collectWarnings(
  missions: MissionType[],
  ctx: ScheduleGenerationContext,
  state: Record<string, SoldierState>,
  minRestHours: number,
): ShiftWarning[] {
  const out: ShiftWarning[] = [];
  const soldiersById = new Map(ctx.soldiers.map((s) => [s.id, s]));

  for (const mt of missions) {
    for (const slot of mt.timeSlots) {
      const assignedSoldiers = slot.assignedSoldierIds
        .map((id) => soldiersById.get(id))
        .filter((s): s is Soldier => !!s);

      // Understaffed
      if (slot.assignedSoldierIds.length < mt.minSoldiers) {
        out.push({
          type: 'understaffed', severity: 'critical', managerOnly: true,
          message: `${mt.name} — חסרים ${mt.minSoldiers - slot.assignedSoldierIds.length} חיילים (${slot.date} ${slot.startTime})`,
          missionId: mt.id, timeSlotIds: [slot.id],
        });
      }

      // Missing required role
      for (const role of mt.requiredRoles) {
        if (!assignedSoldiers.some((s) => s.operationalRoles.includes(role))) {
          out.push({
            type: 'missingRole', severity: 'critical', managerOnly: true,
            message: `${mt.name} — חסר ${role} (${slot.date} ${slot.startTime})`,
            missionId: mt.id, timeSlotIds: [slot.id],
          });
        }
      }

      // Commander missing
      if (mt.needsCommander && !assignedSoldiers.some((s) =>
        s.operationalRoles.includes('מ״מ') || s.operationalRoles.includes('סמל'))) {
        out.push({
          type: 'commanderMissing', severity: 'warning', managerOnly: true,
          message: `${mt.name} — חסר מפקד (${slot.date} ${slot.startTime})`,
          missionId: mt.id, timeSlotIds: [slot.id],
        });
      }

      // Medic missing
      if (mt.needsMedic && !assignedSoldiers.some((s) => s.operationalRoles.includes('חובש'))) {
        out.push({
          type: 'medicMissing', severity: 'warning', managerOnly: true,
          message: `${mt.name} — חסר חובש (${slot.date} ${slot.startTime})`,
          missionId: mt.id, timeSlotIds: [slot.id],
        });
      }

      // Class violation
      if (mt.classMixing === 'no-mix' && assignedSoldiers.length > 1) {
        const classes = new Set(assignedSoldiers.map((s) => s.teamClass));
        if (classes.size > 1) {
          out.push({
            type: 'classViolation', severity: 'warning', managerOnly: true,
            message: `${mt.name} — ערבוב כיתות אסור (${[...classes].join(', ')})`,
            missionId: mt.id, timeSlotIds: [slot.id],
          });
        }
      }
      if (mt.classMixing === 'specific' && mt.allowedClasses && mt.allowedClasses.length > 0) {
        const violators = assignedSoldiers.filter((s) => !mt.allowedClasses!.includes(s.teamClass));
        if (violators.length > 0) {
          out.push({
            type: 'classViolation', severity: 'warning', managerOnly: true,
            message: `${mt.name} — חיילים מחוץ לכיתות המותרות: ${violators.map((s) => s.name).join(', ')}`,
            missionId: mt.id, timeSlotIds: [slot.id], soldierIds: violators.map((s) => s.id),
          });
        }
      }

      // Confusion clamp warning
      if (mt.enableConfusion && mt.confusionDeviationMinutes > Math.floor((mt.maxShiftMinutes - mt.minShiftMinutes) / 2)) {
        out.push({
          type: 'confusionViolation', severity: 'warning', managerOnly: true,
          message: `${mt.name} — סטיית בלבול אויב (${mt.confusionDeviationMinutes} דק׳) חורגת מגבולות המשמרת`,
          missionId: mt.id,
        });
      }

      // Soldier on leave at slot time
      for (const s of assignedSoldiers) {
        if (isSoldierOnLeave(s, ctx.leaves, slot)) {
          out.push({
            type: 'onLeave', severity: 'critical', managerOnly: true,
            message: `${s.name} משובץ ל-${mt.name} בזמן יציאה ביתית`,
            missionId: mt.id, timeSlotIds: [slot.id], soldierIds: [s.id],
          });
        }
      }
    }
  }

  // Insufficient rest (cross-slot)
  for (const sId in state) {
    const intervals = [...state[sId].intervals].sort((a, b) =>
      a.date === b.date ? a.start - b.start : a.date.localeCompare(b.date)
    );
    for (let i = 1; i < intervals.length; i++) {
      const prev = intervals[i - 1];
      const cur  = intervals[i];
      const prevEndIso = `${prev.date}T${minsToTime(prev.end % (24 * 60))}`;
      const curStartIso = `${cur.date}T${minsToTime(cur.start % (24 * 60))}`;
      const gap = hoursBetween(prevEndIso, curStartIso);
      if (gap < minRestHours) {
        const sName = soldiersById.get(sId)?.name ?? sId;
        out.push({
          type: 'insufficientRest', severity: 'warning', managerOnly: true,
          message: `${sName} — מנוחה קצרה מדי (${gap.toFixed(1)} שעות בין משמרות)`,
          soldierIds: [sId],
        });
      }
    }
  }

  // Unfair distribution (manager info)
  const loads = Object.entries(state).map(([id, st]) => ({ id, hours: st.hoursThisPeriod }));
  if (loads.length > 1) {
    const max = Math.max(...loads.map((l) => l.hours));
    const min = Math.min(...loads.map((l) => l.hours));
    if (max - min > 12) {
      out.push({
        type: 'unfairDistribution', severity: 'info', managerOnly: true,
        message: `חוסר איזון: פער של ${(max - min).toFixed(0)} שעות בין הטעון ביותר לפחות מבין החיילים`,
      });
    }
  }

  return out;
}

// ─── Fairness computation ─────────────────────────────────────────────────────

function computeFairness(
  soldiers: Soldier[],
  history: SoldierHistory[],
  state: Record<string, SoldierState>,
): FairnessScore[] {
  const historyById = new Map(history.map((h) => [h.soldierId, h]));
  const all = soldiers.map((s) => {
    const h  = historyById.get(s.id);
    const st = state[s.id] ?? { hoursThisPeriod: 0, nightShiftsThisPeriod: 0 } as SoldierState;
    return {
      soldier: s,
      currentPeriodHours: st.hoursThisPeriod,
      totalHours: (h?.totalAssignedHours ?? 0) + st.hoursThisPeriod,
      nightShifts: (h?.totalNightShifts ?? 0) + st.nightShiftsThisPeriod,
      difficultShiftScore: h?.difficultShiftScore ?? 0,
    };
  });
  const maxTotal = Math.max(1, ...all.map((a) => a.totalHours));
  const avgTotal = all.reduce((sum, a) => sum + a.totalHours, 0) / Math.max(1, all.length);

  return all.map((a) => {
    const loadIndex = Math.round((a.totalHours / maxTotal) * 100);
    const flag: FairnessScore['flag'] =
      a.totalHours > avgTotal * 1.25 ? 'overloaded' :
      a.totalHours < avgTotal * 0.75 ? 'underloaded' :
      'balanced';
    return {
      soldierId:           a.soldier.id,
      soldierName:         a.soldier.name,
      currentPeriodHours:  a.currentPeriodHours,
      totalHours:          a.totalHours,
      nightShifts:         a.nightShifts,
      difficultShiftScore: a.difficultShiftScore,
      loadIndex,
      flag,
    };
  }).sort((a, b) => b.loadIndex - a.loadIndex);
}

// ─── Single-slot regeneration (manager override "regenerate this slot") ───────

export function regenerateSlot(
  slot: TimeSlot,
  mt: MissionType,
  ctx: ScheduleGenerationContext,
  fixedSoldierIds: string[] = [],
): TimeSlot {
  // Mark fixed soldiers as already-assigned, then run the same scoring loop.
  const available = ctx.soldiers.filter((s) => s.availability);
  const historyById = new Map(ctx.history.map((h) => [h.soldierId, h]));

  const state: SoldierState = {
    intervals: [],
    missionAssignments: new Set([mt.id]),
    hoursThisPeriod: 0,
    nightShiftsThisPeriod: 0,
  };
  const fixed = available.filter((s) => fixedSoldierIds.includes(s.id));
  const pool  = available.filter((s) => !fixedSoldierIds.includes(s.id));

  const candidates = pool.filter((s) => {
    if (isSoldierOnLeave(s, ctx.leaves, slot)) return false;
    return true;
  });

  const scored = candidates
    .map((s) => ({ s, score: scoreCandidate(s, slot, mt, historyById.get(s.id), state) }))
    .sort((a, b) => a.score - b.score);

  const picked = [...fixed];
  for (const { s } of scored) {
    if (picked.length >= mt.recommendedSoldiers) break;
    if (!classMixingOk(s, mt, picked)) continue;
    picked.push(s);
  }

  const status: TimeSlot['status'] =
    picked.length === 0 ? 'open' :
    picked.length < mt.minSoldiers ? 'conflict' :
    'filled';

  return { ...slot, assignedSoldierIds: picked.map((s) => s.id), status };
}

// Re-export with category guard so consumers don't need to import the type
export type { MissionCategory, TeamClass };
