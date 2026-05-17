// Conflict resolution — turn validation errors into ACTIONABLE moves.
//
// The system has historically been good at saying "אי אפשר": filter
// codes, blocked buttons, leave warnings. That's a TOOL behavior, not
// an operational-system behavior. Real command-and-control software
// helps the operator FIX the conflict in the same surface, with the
// same data on screen.
//
// Each conflict carries:
//   • a kind discriminator      — so the UI can branch on shape
//   • a human summary           — Hebrew, one sentence
//   • a list of resolution
//     OPTIONS — each a value
//     the UI binds an action to
//
// The helper is pure: it computes the conflict + the option list. The
// caller wires actual mutations (updateMission, setPlatoonLeaveDay, …)
// to the option chosen. This keeps the engine clean and lets us test
// resolution generation without React.

import type {
  Platoon, PlatoonLeaveDay,
} from '../types';

// ─── Conflict shapes ────────────────────────────────────────────────

export type ConflictKind =
  | 'platoon-on-leave';
  // Future kinds (time-overlap, soldier-leave, readiness-conflict)
  // will be added here. The UI dispatches on `kind` — single point of
  // extension.

export interface PlatoonLeaveConflict {
  kind: 'platoon-on-leave';
  platoonId: string;
  platoonName: string;
  /** Sorted ISO dates inside the window where the platoon is home. */
  homeDayIsos: string[];
  firstHomeIso: string;
  lastHomeIso: string;
  /** Mission's effective time window (from/to ISO date). */
  windowFromIso: string;
  windowToIso: string;
  /** Human one-liner — the WHAT. */
  summary: string;
}

// ─── Resolution shapes ──────────────────────────────────────────────

export type ResolutionKind =
  | 'reassign-add-platoon'
  | 'reassign-swap-platoon'
  | 'override-keep-in-base'
  | 'override-partial'
  | 'shift-window-shorter'
  | 'open-leave-board'
  | 'allow-anyway';

export type ResolutionSeverity = 'safe' | 'override' | 'navigate';

export interface ConflictResolution {
  kind: ResolutionKind;
  label: string;
  hint?: string;
  severity: ResolutionSeverity;
  icon: string;
  /** Inputs the UI needs to actually carry out the action. The UI
   *  reads this and wires the call to AppContext. */
  payload?: {
    addPlatoonId?: string;
    removePlatoonId?: string;
    homeDayIsos?: string[];
  };
}

// ─── Detection ──────────────────────────────────────────────────────

/**
 * Identify every platoon whose home days fall inside the mission
 * window. The window comes from caller (mission dates → order dates
 * → caller-default).
 */
export function detectPlatoonLeaveConflicts(args: {
  selectedPlatoonIds: string[];
  windowFromIso: string;
  windowToIso: string;
  platoonLeaveDays: PlatoonLeaveDay[];
  platoons: Platoon[];
}): PlatoonLeaveConflict[] {
  const { selectedPlatoonIds, windowFromIso, windowToIso, platoonLeaveDays, platoons } = args;
  return selectedPlatoonIds.flatMap((pid): PlatoonLeaveConflict[] => {
    const days = platoonLeaveDays
      .filter((d) =>
        d.platoonId === pid
        && d.status === 'home'
        && d.dateIso >= windowFromIso
        && d.dateIso <= windowToIso,
      )
      .map((d) => d.dateIso)
      .sort();
    if (days.length === 0) return [];
    const platoon = platoons.find((p) => p.id === pid);
    const platoonName = platoon?.name ?? pid;
    const summary = days.length === 1
      ? `${platoonName} מתוכננת ליציאה ב־${days[0]} בתוך חלון המשימה.`
      : `${platoonName} בבית ${days.length} ימים (${days[0]} – ${days[days.length - 1]}) בחלון המשימה.`;
    return [{
      kind: 'platoon-on-leave',
      platoonId: pid,
      platoonName,
      homeDayIsos: days,
      firstHomeIso: days[0],
      lastHomeIso: days[days.length - 1],
      windowFromIso,
      windowToIso,
      summary,
    }];
  });
}

// ─── Resolution generation ──────────────────────────────────────────

/**
 * Build the action menu for a platoon-on-leave conflict. The caller
 * passes the universe of company platoons; we identify which are
 * actually free (not home) inside the window and propose them as
 * swap/add candidates.
 */
export function resolutionsForPlatoonLeave(args: {
  conflict: PlatoonLeaveConflict;
  selectedPlatoonIds: string[];
  companyPlatoons: Platoon[];
  platoonLeaveDays: PlatoonLeaveDay[];
}): ConflictResolution[] {
  const { conflict, selectedPlatoonIds, companyPlatoons, platoonLeaveDays } = args;

  // Identify platoons in the same company that have NO home days in
  // the window — those are clean swap candidates.
  const freePlatoons = companyPlatoons.filter((p) => {
    if (p.id === conflict.platoonId) return false;
    if (selectedPlatoonIds.includes(p.id)) return false;     // already assigned
    const collide = platoonLeaveDays.some((d) =>
      d.platoonId === p.id
      && d.status === 'home'
      && d.dateIso >= conflict.windowFromIso
      && d.dateIso <= conflict.windowToIso,
    );
    return !collide;
  });

  const out: ConflictResolution[] = [];

  // 1. ADD a free platoon — keeps the conflicting platoon, but adds
  //    a second one that's actually available so the mission is
  //    covered. Highest "safe" option.
  if (freePlatoons[0]) {
    out.push({
      kind: 'reassign-add-platoon',
      label: `הוסף את ${freePlatoons[0].name} לכיסוי`,
      hint: 'משאיר את המחלקה היוצאת — מוסיף אחת זמינה',
      severity: 'safe',
      icon: '➕',
      payload: { addPlatoonId: freePlatoons[0].id },
    });
  }

  // 2. SWAP — drop the conflicting platoon, replace with a free one.
  //    Most common operational fix.
  if (freePlatoons[0]) {
    out.push({
      kind: 'reassign-swap-platoon',
      label: `החלף ב־${freePlatoons[0].name}`,
      hint: 'מסיר את המחלקה היוצאת ומחליף בזמינה',
      severity: 'safe',
      icon: '⇄',
      payload: {
        addPlatoonId: freePlatoons[0].id,
        removePlatoonId: conflict.platoonId,
      },
    });
  }

  // 3. OVERRIDE — keep the platoon in base for the conflicting days
  //    (sets PlatoonLeaveDay.status = 'in-base'). The leave board
  //    reflects the change immediately.
  out.push({
    kind: 'override-keep-in-base',
    label: 'השאר בבסיס למשימה',
    hint: 'מבטל את היציאה לאותם ימים — מסומן בלוח היציאות',
    severity: 'override',
    icon: '🔒',
    payload: { homeDayIsos: conflict.homeDayIsos },
  });

  // 4. PARTIAL — the platoon goes home but with reduced strength
  //    (some soldiers stay). Sets status='partial'.
  out.push({
    kind: 'override-partial',
    label: 'יציאה חלקית',
    hint: 'חלק נשארים בבסיס למשימה, השאר יוצאים',
    severity: 'override',
    icon: '½',
    payload: { homeDayIsos: conflict.homeDayIsos },
  });

  // 5. NAVIGATE to the leave board for a free-form edit (move the
  //    window, change other platoons' days, etc.).
  out.push({
    kind: 'open-leave-board',
    label: 'פתח לוח יציאות פלוגתי',
    hint: 'לערוך חופשי את התכנון',
    severity: 'navigate',
    icon: '🗓',
  });

  // 6. ALLOW ANYWAY — dismiss the conflict and proceed. Explicit
  //    operator override, recorded in the audit by the caller.
  out.push({
    kind: 'allow-anyway',
    label: 'אפשר בכל זאת',
    hint: 'מבצעית — בידיעה שיש קונפליקט',
    severity: 'override',
    icon: '⚠',
  });

  return out;
}

// ─── Generic conflict union (for future extension) ──────────────────

export type OperationalConflict = PlatoonLeaveConflict;
// Future: | TimeOverlapConflict | SoldierOnLeaveConflict | ReadinessConflict
