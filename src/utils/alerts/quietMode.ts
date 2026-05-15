// alerts/quietMode.ts — pure logic for the "מצב שקט" feature.
//
// QuietMode is a per-user, time-bounded suppression of non-critical
// alerts. The exact contract (per Phase 6.2 review):
//
//   • Exactly four durations: 30m / 1h / 2h / 4h. No "until 06:00".
//   • Critical alerts ALWAYS break through.
//   • Mode auto-expires at `expiresAt`. No background timer needed —
//     consumers re-evaluate against a fresh `nowIso`.
//   • Activating again while active REPLACES the window — no stacking.
//
// All functions here are pure: no React, no Date.now(), no localStorage.
// The hook layer (useQuietMode) handles I/O and time.

import type { Alert, QuietModeDuration, QuietModePreference } from '../../types';

const MS_PER_MINUTE = 60 * 1000;

const DURATION_MINUTES: Record<QuietModeDuration, number> = {
  '30m': 30,
  '1h':  60,
  '2h':  120,
  '4h':  240,
};

export const DURATION_LABELS: Record<QuietModeDuration, string> = {
  '30m': '30 דקות',
  '1h':  'שעה',
  '2h':  'שעתיים',
  '4h':  '4 שעות',
};

/** All valid durations in display order. The UI MUST render exactly these
 *  four — no more, no less. */
export const ALL_DURATIONS: QuietModeDuration[] = ['30m', '1h', '2h', '4h'];

/** Build a fresh QuietModePreference activated at `nowIso`. */
export function activateQuietMode(
  duration: QuietModeDuration,
  nowIso: string,
): QuietModePreference {
  const nowMs = Date.parse(nowIso);
  const expiresMs = nowMs + DURATION_MINUTES[duration] * MS_PER_MINUTE;
  return {
    duration,
    activatedAt: nowIso,
    expiresAt: new Date(expiresMs).toISOString(),
  };
}

/** Is the QuietMode preference currently active relative to `nowIso`? */
export function isQuietModeActive(
  pref: QuietModePreference | null | undefined,
  nowIso: string,
): boolean {
  if (!pref) return false;
  return Date.parse(pref.expiresAt) > Date.parse(nowIso);
}

/** Minutes remaining until QuietMode expires. Returns 0 when inactive. */
export function quietModeRemainingMinutes(
  pref: QuietModePreference | null | undefined,
  nowIso: string,
): number {
  if (!isQuietModeActive(pref, nowIso)) return 0;
  const diffMs = Date.parse(pref!.expiresAt) - Date.parse(nowIso);
  return Math.max(0, Math.ceil(diffMs / MS_PER_MINUTE));
}

/** Human label for the remaining time: "23 דק׳" or "1ש 12דק׳". */
export function formatRemaining(remainingMinutes: number): string {
  if (remainingMinutes <= 0) return '';
  if (remainingMinutes < 60) return `${remainingMinutes} דק׳`;
  const h = Math.floor(remainingMinutes / 60);
  const m = remainingMinutes % 60;
  if (m === 0) return h === 1 ? 'שעה' : `${h} שעות`;
  return `${h}ש ${m}דק׳`;
}

/**
 * Filter alerts by QuietMode. When active, ONLY critical alerts pass.
 * When inactive (or pref is null), all alerts pass.
 *
 * STRICT INVARIANT: critical alerts MUST break through. This function
 * never filters them out. If a future change adds a "deep quiet" mode
 * that suppresses critical, that must be a different code path AND must
 * require explicit per-mode-per-call opt-in by the caller, never default.
 */
export function filterByQuietMode(
  alerts: Alert[],
  pref: QuietModePreference | null | undefined,
  nowIso: string,
): Alert[] {
  if (!isQuietModeActive(pref, nowIso)) return alerts;
  return alerts.filter((a) => a.severity === 'critical');
}

/** Count how many non-critical alerts QuietMode is currently muting.
 *  Returns 0 when inactive. */
export function countMutedByQuietMode(
  alerts: Alert[],
  pref: QuietModePreference | null | undefined,
  nowIso: string,
): number {
  if (!isQuietModeActive(pref, nowIso)) return 0;
  return alerts.filter((a) => a.severity !== 'critical').length;
}
