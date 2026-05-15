// burden.ts — fairness-aware burden computation.
//
// Pure function: (soldier, context) → SoldierBurden.
//
// Builds a 3-layer model:
//   1. signals   — 12 raw operational measurements from event log
//   2. factors   — 4 human-meaningful groupings, each with explain string
//   3. composite — weighted blend into burdenScore + headline
//
// The PC/CC UI surfaces layers 2-3. Layer 1 is queryable for audit.
// Engine never returns a number without an explanation.

import type {
  EngineContext, Soldier, SoldierBurden, BurdenSignals, BurdenFactor,
  BurdenWeights,
} from '../../types';
import type { MaterializedSlot } from '../materialize';
import { DEFAULT_BURDEN_WEIGHTS } from './defaults';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Compute the burden snapshot for one soldier. Pure: no side effects,
 * no async, no DB. The caller (typically a useMemo in the staffing UI
 * or a scheduling pass) builds the context once and calls this per
 * soldier.
 *
 * `allSlots` is passed in explicitly because EngineContext is currently
 * slot-focused (`alreadyPickedForSlot`). Burden needs the entire week
 * of slots to count shifts.
 */
export function computeBurden(
  soldier: Soldier,
  allSlots: MaterializedSlot[],
  ctx: EngineContext,
  weights: BurdenWeights = DEFAULT_BURDEN_WEIGHTS,
): SoldierBurden {
  const windowDays = ctx.fatiguePolicy.computationWindowDays ?? 30;
  const nowMs = Date.parse(ctx.computedAt);
  const horizonMs = nowMs - windowDays * MS_PER_DAY;

  const signals = computeSignals(soldier, allSlots, ctx, horizonMs, nowMs);

  const workIntensity   = computeWorkIntensity(signals, soldier);
  const recoveryDeficit = computeRecoveryDeficit(signals, ctx);
  const rotationPattern = computeRotationPattern(signals, soldier);
  const stressLoad      = computeStressLoad(signals);

  const burdenScore = clamp(
      weights.workIntensity   * workIntensity.score
    + weights.recoveryDeficit * recoveryDeficit.score
    + weights.rotationPattern * rotationPattern.score
    + weights.stressLoad      * stressLoad.score,
    0, 100,
  );

  const headline = buildHeadline({
    workIntensity, recoveryDeficit, rotationPattern, stressLoad,
  });

  return {
    soldierId: soldier.id,
    computedAt: ctx.computedAt,
    windowDays,
    signals,
    factors: {
      workIntensity,
      recoveryDeficit,
      rotationPattern,
      stressLoad,
    },
    burdenScore,
    headline,
    overShoot: false, // p75 comparison filled in by caller with platoon ctx
  };
}

// ─── Signal computation ────────────────────────────────────────────

function computeSignals(
  soldier: Soldier,
  allSlots: MaterializedSlot[],
  ctx: EngineContext,
  horizonMs: number,
  nowMs: number,
): BurdenSignals {
  // ── Days base / home / consecutive ──
  const events = ctx.statusEvents
    .filter((e) => e.soldierId === soldier.id && Date.parse(e.setAt) >= horizonMs)
    .sort((a, b) => a.setAt.localeCompare(b.setAt));

  let daysBase = 0;
  let daysHome = 0;
  let consecutiveBaseDays = 0;
  let runningStreak = 0;
  let mostRecentHomeMs: number | null = null;

  // Walk each day in the window, infer state from latest event ≤ that day.
  for (let d = 0; d < (ctx.fatiguePolicy.computationWindowDays ?? 30); d++) {
    const tDay = horizonMs + d * MS_PER_DAY;
    const evt = events.filter((e) => Date.parse(e.setAt) <= tDay).pop();
    const state = evt?.value ?? soldier.currentStatus;

    if (state === 'in-base') {
      daysBase++;
      runningStreak++;
      consecutiveBaseDays = Math.max(consecutiveBaseDays, runningStreak);
    } else if (state === 'home') {
      daysHome++;
      runningStreak = 0;
      mostRecentHomeMs = tDay;
    } else {
      runningStreak = 0;
    }
  }

  const daysSinceLastHome = mostRecentHomeMs !== null
    ? Math.floor((nowMs - mostRecentHomeMs) / MS_PER_DAY)
    : ctx.fatiguePolicy.computationWindowDays ?? 30;

  // ── Shift hours / hard hours / mission variety ──
  let totalShiftHours = 0;
  let hardShiftHours  = 0;
  let consecutiveHardShifts = 0;
  let prevWasHard = false;
  const missionTypeSet = new Set<string>();
  const missionTypeCounts = new Map<string, number>();

  const soldierSlots = allSlots
    .filter((slot) =>
      (slot.assignedSoldierIds.includes(soldier.id) || slot.commanderSoldierId === soldier.id)
      && Date.parse(slot.start) >= horizonMs
      && Date.parse(slot.start) <= nowMs,
    )
    .sort((a, b) => a.start.localeCompare(b.start));

  for (const slot of soldierSlots) {
    const durationHours = (Date.parse(slot.end) - Date.parse(slot.start)) / MS_PER_HOUR;
    totalShiftHours += durationHours;

    const mission = ctx.missions.find((m) => m.id === slot.missionId);
    if (mission) {
      const isHard = mission.difficulty === 'hard' || mission.difficulty === 'critical';
      if (isHard) {
        hardShiftHours += durationHours;
        if (prevWasHard) consecutiveHardShifts++;
        else consecutiveHardShifts = 1;
      } else {
        consecutiveHardShifts = 0;
      }
      prevWasHard = isHard;

      missionTypeSet.add(mission.name);
      missionTypeCounts.set(mission.name, (missionTypeCounts.get(mission.name) ?? 0) + 1);
    }
  }

  const missionVariety = missionTypeSet.size;
  // Repetition: same mission ≥ 4 times in last 7 days
  const sevenDaysAgo = nowMs - 7 * MS_PER_DAY;
  let repetitionFlag = false;
  for (const [name, count] of missionTypeCounts) {
    if (count >= 4) {
      const recentCount = soldierSlots
        .filter((s) => Date.parse(s.start) >= sevenDaysAgo)
        .filter((s) => ctx.missions.find((m) => m.id === s.missionId)?.name === name)
        .length;
      if (recentCount >= 4) {
        repetitionFlag = true;
        break;
      }
    }
  }

  // ── Rotation load ──
  const rotationLoad = ctx.logisticsRotations
    .filter((r) =>
      r.assignedSoldierIds.includes(soldier.id)
      && Date.parse(r.startIso) >= horizonMs
      && Date.parse(r.startIso) <= nowMs,
    )
    .length;

  // ── Recall events ──
  const recallLeaves = ctx.leaves.filter((lv) =>
    (lv.scope === 'individual' && lv.soldierIds.includes(soldier.id))
    && lv.wasRecalled === true
    && lv.recalledAt
    && Date.parse(lv.recalledAt) >= horizonMs,
  );
  const recentRecallEvents = recallLeaves.length;
  const mostRecentRecallMs = recallLeaves
    .map((lv) => Date.parse(lv.recalledAt ?? ''))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => b - a)[0];
  const daysSinceLastRecall = mostRecentRecallMs
    ? Math.floor((nowMs - mostRecentRecallMs) / MS_PER_DAY)
    : null;

  return {
    daysBase,
    daysHome,
    consecutiveBaseDays,
    daysSinceLastHome,
    totalShiftHours,
    hardShiftHours,
    rotationLoad,
    consecutiveHardShifts,
    missionVariety,
    repetitionFlag,
    recentRecallEvents,
    daysSinceLastRecall,
  };
}

// ─── Factor computations — each returns score + explain ────────────

function computeWorkIntensity(signals: BurdenSignals, _soldier: Soldier): BurdenFactor {
  // Score combines: total shift hours (60%) + hard hours (40%).
  // Normalization: assume a "heavy" 30-day window = 180 total shift hours.
  void _soldier;
  const totalNorm = clamp(signals.totalShiftHours / 180 * 100, 0, 100);
  const hardNorm  = clamp(signals.hardShiftHours  /  80 * 100, 0, 100);
  const score = clamp(0.6 * totalNorm + 0.4 * hardNorm, 0, 100);

  let explain: string;
  if (signals.hardShiftHours > 40) {
    explain = `${Math.round(signals.totalShiftHours)} שעות משמרת, מהן ${Math.round(signals.hardShiftHours)} שעות במשימות קשות`;
  } else if (signals.totalShiftHours > 100) {
    explain = `${Math.round(signals.totalShiftHours)} שעות משמרת — עומס גבוה`;
  } else if (signals.totalShiftHours > 50) {
    explain = `${Math.round(signals.totalShiftHours)} שעות משמרת — עומס בינוני`;
  } else {
    explain = `${Math.round(signals.totalShiftHours)} שעות משמרת — קליל`;
  }

  return {
    score,
    explain,
    signalKeys: ['totalShiftHours', 'hardShiftHours'],
  };
}

function computeRecoveryDeficit(signals: BurdenSignals, ctx: EngineContext): BurdenFactor {
  // Score: consecutiveBaseDays vs the cap + daysSinceLastHome penalty.
  const cap = ctx.fatiguePolicy.consecutiveBaseDaysCap ?? 14;
  const consecNorm = clamp(signals.consecutiveBaseDays / cap * 100, 0, 100);

  let homePenalty = 0;
  if (signals.daysSinceLastHome > 14) homePenalty = 50;
  else if (signals.daysSinceLastHome > 7) homePenalty = 25;

  const score = clamp(consecNorm + homePenalty, 0, 100);

  let explain: string;
  if (signals.consecutiveBaseDays >= cap) {
    explain = `${signals.consecutiveBaseDays} ימים רצופים בבסיס — מעל הסף`;
  } else if (signals.daysSinceLastHome > 14) {
    explain = `${signals.daysSinceLastHome} ימים לא היה בבית`;
  } else if (signals.daysSinceLastHome > 7) {
    explain = `${signals.daysSinceLastHome} ימים לא היה בבית`;
  } else {
    explain = `חזר הביתה לפני ${signals.daysSinceLastHome} ימים — תקין`;
  }

  return {
    score,
    explain,
    signalKeys: ['consecutiveBaseDays', 'daysSinceLastHome', 'daysBase', 'daysHome'],
  };
}

function computeRotationPattern(signals: BurdenSignals, _soldier: Soldier): BurdenFactor {
  void _soldier;
  // Score: high rotation count + repetition flag = high.
  // Low variety (same task many times) = high.
  const rotationNorm = clamp(signals.rotationLoad / 8 * 100, 0, 100);
  const varietyPenalty = signals.missionVariety <= 1 && signals.totalShiftHours > 20 ? 30 : 0;
  const repetitionPenalty = signals.repetitionFlag ? 40 : 0;
  const score = clamp(rotationNorm * 0.5 + varietyPenalty + repetitionPenalty, 0, 100);

  let explain: string;
  if (signals.repetitionFlag) {
    explain = `אותה משימה 4+ פעמים השבוע — עומס חוזר`;
  } else if (varietyPenalty > 0) {
    explain = `כל המשמרות מאותו סוג — חוסר גיוון`;
  } else if (signals.rotationLoad > 4) {
    explain = `${signals.rotationLoad} סבבים לוגיסטיים`;
  } else {
    explain = `שגרה — ${signals.rotationLoad} סבבים, ${signals.missionVariety} סוגים שונים`;
  }

  return {
    score,
    explain,
    signalKeys: ['rotationLoad', 'missionVariety', 'repetitionFlag'],
  };
}

function computeStressLoad(signals: BurdenSignals): BurdenFactor {
  // Score: weighted by recent recall events. 0 events = 0, 1 = 40, 2+ = 80.
  let score = 0;
  if (signals.recentRecallEvents === 1) score = 40;
  else if (signals.recentRecallEvents >= 2) score = 80;

  // Recovery bonus: very recent recall ratchets up (within 3 days).
  if (signals.daysSinceLastRecall !== null && signals.daysSinceLastRecall <= 3) {
    score = clamp(score + 20, 0, 100);
  }

  let explain: string;
  if (signals.recentRecallEvents === 0) {
    explain = `אין הקפצות אחרונות`;
  } else if (signals.daysSinceLastRecall !== null && signals.daysSinceLastRecall <= 3) {
    explain = `הוחזר מהקפצה לפני ${signals.daysSinceLastRecall} ימים — חוב מנוחה`;
  } else {
    explain = `${signals.recentRecallEvents} הקפצות ב-30 הימים האחרונים`;
  }

  return {
    score,
    explain,
    signalKeys: ['recentRecallEvents', 'daysSinceLastRecall'],
  };
}

// ─── Headline — single-sentence summary ────────────────────────────

function buildHeadline(factors: SoldierBurden['factors']): string {
  // Pick the factor with the highest score and return its explain.
  const entries: Array<[string, BurdenFactor]> = [
    ['work',     factors.workIntensity],
    ['recovery', factors.recoveryDeficit],
    ['pattern',  factors.rotationPattern],
    ['stress',   factors.stressLoad],
  ];
  entries.sort((a, b) => b[1].score - a[1].score);
  const [, top] = entries[0];

  if (top.score >= 80) return `טחן: ${top.explain}`;
  if (top.score >= 60) return `עומס גבוה: ${top.explain}`;
  if (top.score >= 40) return top.explain;
  return `קליל — ${top.explain}`;
}

// ─── Platoon-level p75 enrichment (post-process) ──────────────────

/**
 * Given a map of soldierId → SoldierBurden for one platoon, set
 * `overShoot=true` on the soldiers whose burdenScore is above the
 * platoon's p75. The caller passes the per-platoon burden map.
 */
export function markOverShoot(burdens: Record<string, SoldierBurden>): void {
  const scores = Object.values(burdens).map((b) => b.burdenScore).sort((a, b) => a - b);
  if (scores.length < 4) return; // need a real sample
  const p75Index = Math.floor(scores.length * 0.75);
  const p75 = scores[p75Index];
  for (const b of Object.values(burdens)) {
    b.overShoot = b.burdenScore > p75;
  }
}

// ─── Utility ───────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}
