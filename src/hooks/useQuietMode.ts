// useQuietMode — per-user QuietMode preference persisted in localStorage.
//
// The hook is the SINGLE place that does I/O for QuietMode. All pure
// logic lives in `utils/alerts/quietMode.ts`. This keeps the engine
// boundary clean: callers that need to filter alerts can call the pure
// function directly with the preference + a known `nowIso`.
//
// Storage shape:
//   localStorage["shavatz-na:quietMode:<userId>"] = JSON.stringify(pref)
//
// Re-evaluation strategy (avoids the cascading-renders anti-pattern of
// setState-in-effect):
//   • `pref` is derived via `useMemo` from (userId, version).
//   • `version` is a counter bumped on write or external storage event.
//   • `nowIso` ticks every 30s while mounted — coarse enough for
//     30m/1h/2h/4h durations, fine enough that auto-expiry is timely.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { QuietModeDuration, QuietModePreference } from '../types';
import {
  activateQuietMode,
  isQuietModeActive,
  quietModeRemainingMinutes,
} from '../utils/alerts/quietMode';

const STORAGE_PREFIX = 'shavatz-na:quietMode:';
const RECHECK_INTERVAL_MS = 30_000;

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function readPref(userId: string): QuietModePreference | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuietModePreference;
    if (!parsed.duration || !parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePref(userId: string, pref: QuietModePreference | null): void {
  try {
    if (pref === null) localStorage.removeItem(storageKey(userId));
    else localStorage.setItem(storageKey(userId), JSON.stringify(pref));
  } catch {
    // localStorage unavailable (private mode / quota) — silently no-op.
    // Per design: QuietMode is a comfort feature, not load-bearing.
  }
}

export interface UseQuietModeReturn {
  pref: QuietModePreference | null;
  isActive: boolean;
  remainingMinutes: number;
  activate: (duration: QuietModeDuration) => void;
  deactivate: () => void;
  /** Latest ISO timestamp used for active-checks. Pass into pure
   *  utility functions so the hook + utils agree on the same `now`. */
  nowIso: string;
}

export function useQuietMode(): UseQuietModeReturn {
  const { currentUser } = useApp();
  const userId = currentUser?.id;

  // `version` triggers a re-read of localStorage. Bumped on:
  //   • activate / deactivate (this tab)
  //   • storage event (other tabs)
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  // `nowIso` ticks every 30s so expiry is detected without re-querying
  // storage. The pure logic decides isActive from (pref, nowIso).
  const [nowIso, setNowIso] = useState<string>(() => new Date().toISOString());
  useEffect(() => {
    const id = window.setInterval(() => {
      setNowIso(new Date().toISOString());
    }, RECHECK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  // Cross-tab sync.
  useEffect(() => {
    if (!userId) return;
    const handler = (e: StorageEvent) => {
      if (e.key !== storageKey(userId)) return;
      bump();
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [userId, bump]);

  // Derived: latest pref keyed by (userId, version).
  // `version` is the re-evaluation tickler — not referenced in the body
  // but its change invalidates the memo so we re-read localStorage.
  const pref = useMemo<QuietModePreference | null>(() => {
    void version;
    return userId ? readPref(userId) : null;
  }, [userId, version]);

  const activate = useCallback(
    (duration: QuietModeDuration) => {
      if (!userId) return;
      const fresh = activateQuietMode(duration, new Date().toISOString());
      writePref(userId, fresh);
      setNowIso(new Date().toISOString());
      bump();
    },
    [userId, bump],
  );

  const deactivate = useCallback(() => {
    if (!userId) return;
    writePref(userId, null);
    bump();
  }, [userId, bump]);

  const isActive = isQuietModeActive(pref, nowIso);
  const remainingMinutes = quietModeRemainingMinutes(pref, nowIso);

  return {
    pref: isActive ? pref : null,
    isActive,
    remainingMinutes,
    activate,
    deactivate,
    nowIso,
  };
}
