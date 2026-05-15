// selector.ts — greedy single-pass slot-staffing selection.
//
// Pure function: (slot, soldiers, ctx) → SelectorOutcome.
// Implements the Phase 6.0-approved approach:
//
//   greedy + scoring + alerts + override.
//
// Selection logic:
//   1. score every soldier (CandidateScore)
//   2. partition: clean candidates (no hard filter fails) vs forced candidates
//   3. pick top-N from clean. If clean < required, pick from forced
//      (only if the operator requested 'forced fill').
//   4. compute confidence from score gap between picks and runners-up
//   5. emit alerts for any shortfall / fatigue violation / etc.
//
// The selector NEVER applies a forced selection silently. When clean
// pool is short, it returns picked=cleanCandidates AND alerts +
// alternates=forced — the OPERATOR decides whether to fill the gap
// from alternates.

import type {
  EngineContext, CandidateScore, SelectorOutcome,
  PickedSoldier, SelectorViolation, SelectorAlert, Soldier,
} from '../../types';
import type { MaterializedSlot } from '../materialize';
import { scoreCandidate } from './scoring';

const MAX_ALTERNATES = 5;

/**
 * Build the full staffing outcome for one slot.
 *
 * The selector evaluates all eligible soldiers (those whose platoon
 * appears in mission.assignedPlatoonIds), produces CandidateScores,
 * and picks `required` soldiers greedily.
 *
 * `requiredCount` defaults to slot.requiredCount (or 1 if missing).
 *
 * `acceptForced` — when true, the selector will fill remaining empty
 * spots with the best `forced` candidates (hard-filter-failing). The
 * forcedReason is captured. Default false.
 */
export function selectCandidates(
  slot: MaterializedSlot,
  candidatePool: Soldier[],
  ctx: EngineContext,
  options: {
    requiredCount?: number;
    acceptForced?: boolean;
    forcedReason?: string;
  } = {},
): SelectorOutcome {
  const requiredCount = options.requiredCount ?? slot.requiredCount ?? 1;
  const acceptForced  = options.acceptForced ?? false;
  const forcedReason  = options.forcedReason ?? '';

  // 1. Score every candidate.
  const scored: CandidateScore[] = candidatePool.map((s) => scoreCandidate(s, slot, ctx));

  // 2. Partition into clean (no hard fails) and forced.
  const clean = scored
    .filter((c) => c.hardFiltersFailed.length === 0)
    .sort((a, b) => b.score - a.score);

  const forced = scored
    .filter((c) => c.hardFiltersFailed.length > 0)
    .sort((a, b) => b.score - a.score);

  // 3. Pick top-N from clean.
  const cleanPicks = clean.slice(0, requiredCount);

  // 3.5. If short and forced fill requested, fill the gap.
  let forcedPicks: CandidateScore[] = [];
  if (cleanPicks.length < requiredCount && acceptForced) {
    forcedPicks = forced.slice(0, requiredCount - cleanPicks.length);
  }

  const allPicks: PickedSoldier[] = [
    ...cleanPicks.map((s) => ({ soldierId: s.soldierId, score: s })),
    ...forcedPicks.map((s) => ({
      soldierId: s.soldierId,
      score: s,
      forcedReason,
    })),
  ];

  // 4. Compute base confidence from score gap.
  // Higher gap between picked and alternates = clearer winner.
  const alternates = clean.slice(requiredCount, requiredCount + MAX_ALTERNATES);
  const avgPicked  = avg(cleanPicks.map((p) => p.score));
  const avgAlt     = avg(alternates.map((a) => a.score));
  const baseConfidence = clamp((avgPicked - avgAlt) / 100, 0, 1);

  // 5. Violations + alerts.
  const violations: SelectorViolation[] = [];
  const alerts: SelectorAlert[] = [];

  // 5a. Manpower shortfall.
  if (allPicks.length < requiredCount) {
    alerts.push({
      kind: 'manpower-shortfall',
      severity: 'critical',
      message: `slot ${slot.id} חסר ${requiredCount - allPicks.length} חיילים`,
      affectedSoldierIds: allPicks.map((p) => p.soldierId),
    });
  }

  // 5b. Forced fills — every forced pick is a violation entry.
  for (const fp of forcedPicks) {
    for (const code of fp.hardFiltersFailed) {
      violations.push({
        code,
        soldierId: fp.soldierId,
        severity: 'override',
        explain: codeToExplain(code, fp.soldierId, ctx),
      });
      // Critical events also become alerts the UI surfaces.
      if (code === 'soldier-home') {
        alerts.push({
          kind: 'home-assignment',
          severity: 'critical',
          message: `חייל בבית שובץ ב-${slot.id} עם override`,
          affectedSoldierIds: [fp.soldierId],
        });
      } else if (code === 'critical-equipment-missing') {
        alerts.push({
          kind: 'critical-equipment-missing',
          severity: 'critical',
          message: `חייל חסר ציוד critical שובץ ב-${slot.id} עם override`,
          affectedSoldierIds: [fp.soldierId],
        });
      }
    }
  }

  // 5c. Fatigue violations among clean picks (soft).
  for (const pick of cleanPicks) {
    const fatigueDim = pick.dimensions.find((d) => d.key === 'fatigue');
    if (fatigueDim && fatigueDim.value < 50) {
      violations.push({
        code: 'fatigue-violation',
        soldierId: pick.soldierId,
        severity: 'soft',
        explain: fatigueDim.explain,
      });
      alerts.push({
        kind: 'fatigue-violation',
        severity: 'warning',
        message: `חייל שובץ עם מנוחה חלקית: ${fatigueDim.explain}`,
        affectedSoldierIds: [pick.soldierId],
      });
    }
  }

  // 6. Apply confidence decay — operational stressors compound into a
  //    visible reduction. EACH decay multiplier also writes a human-
  //    readable reason to `decayReasons` so the UI can surface the
  //    "why" — confidence must never feel like a magic number.
  let confidence = baseConfidence;
  const decayReasons: string[] = [];

  if (forcedPicks.length > 0) {
    confidence *= 0.5;
    decayReasons.push(
      forcedPicks.length === 1
        ? 'שיבוץ אחד בכפייה (-50%)'
        : `${forcedPicks.length} שיבוצים בכפייה (-50%)`,
    );
  }
  if (allPicks.length < requiredCount) {
    const missing = requiredCount - allPicks.length;
    const shortfallRatio = missing / requiredCount;
    if (shortfallRatio >= 0.5) {
      confidence *= 0.3;
      decayReasons.push(`חסרים ${missing} מתוך ${requiredCount} — קריסת סד״כ (-70%)`);
    } else {
      confidence *= 0.4;
      decayReasons.push(`חסרים ${missing} שיבוצים (-60%)`);
    }
  }
  const softViolations = violations.filter((v) => v.severity === 'soft').length;
  if (softViolations > 2) {
    confidence *= 0.7;
    decayReasons.push(`${softViolations} חריגות soft — שרשרת overrides (-30%)`);
  }
  if (alerts.some((a) => a.kind === 'critical-equipment-missing')) {
    confidence *= 0.6;
    decayReasons.push('חוסר ציוד critical (-40%)');
  }
  confidence = clamp(confidence, 0, 1);

  // 7. Reasoning — one or two sentences summarizing the outcome.
  const reasoning = buildReasoning({
    requiredCount,
    cleanCount: cleanPicks.length,
    forcedCount: forcedPicks.length,
    confidence,
    violations,
  });

  return {
    slotId: slot.id,
    picked: allPicks,
    confidence,
    forced: forcedPicks.length > 0,
    reasoning,
    violations,
    alternates,
    alerts,
    decayReasons,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function codeToExplain(code: string, soldierId: string, ctx: EngineContext): string {
  const s = ctx.soldiers.find((x) => x.id === soldierId);
  const name = s?.name ?? soldierId;
  switch (code) {
    case 'soldier-home':              return `${name} בבית`;
    case 'soldier-inactive':          return `${name} לא פעיל`;
    case 'on-leave':                  return `${name} בחופשה`;
    case 'in-leave-cycle-home':       return `${name} בבית בסבב הפלוגתי`;
    case 'duty-exclusion':            return `${name} עם פטור מסבב`;
    case 'missing-qualifications':    return `${name} חסר הכשרות נדרשות`;
    case 'wrong-platoon':              return `${name} ממחלקה שלא משויכת למשימה`;
    case 'time-conflict':              return `${name} משובץ כבר במשהו חופף`;
    case 'squad-policy-violation':    return `${name} מפר מדיניות כיתה`;
    case 'critical-equipment-missing': return `${name} חסר ציוד critical`;
    default:                           return `${name}: ${code}`;
  }
}

function buildReasoning(args: {
  requiredCount: number;
  cleanCount: number;
  forcedCount: number;
  confidence: number;
  violations: SelectorViolation[];
}): string {
  const { requiredCount, cleanCount, forcedCount, confidence, violations } = args;
  const filled = cleanCount + forcedCount;

  if (filled === 0) {
    return 'אין מועמדים זמינים — slot נשאר פתוח, נדרש override או החלפת תנאי המשימה.';
  }

  if (filled < requiredCount) {
    return `${filled} מתוך ${requiredCount} שיבוצים בלבד. חסרים ${requiredCount - filled} — מועמדים אלטרנטיביים זמינים עם override.`;
  }

  if (forcedCount > 0) {
    return `${cleanCount} שיבוצים נקיים + ${forcedCount} שיבוצים בכפייה (override). דרוש אישור מ״פ.`;
  }

  const softCount = violations.filter((v) => v.severity === 'soft').length;
  if (softCount > 0) {
    const conf = Math.round(confidence * 100);
    return `${filled} שיבוצים מאוישים. ${softCount} אזהרות soft (עייפות חלקית). ביטחון: ${conf}%.`;
  }

  const conf = Math.round(confidence * 100);
  if (confidence < 0.3) {
    return `${filled} שיבוצים מאוישים, אבל המועמדים הבאים קרובים בציון — ביטחון נמוך (${conf}%). שווה לבדוק את האלטרנטיבות.`;
  }
  return `${filled} שיבוצים מאוישים בביטחון ${conf}%.`;
}
