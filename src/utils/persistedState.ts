// persistedState — useState wrapper that survives page refresh.
//
// Demo persistence layer for "הפלוגה שלי". Each slice of AppContext that
// the user can mutate (assignments, missions, notes, leaves, etc.) is
// snapshotted to localStorage on every change.
//
// Design notes:
//   • Storage key shape: `ha-pluga-sheli:state:<slice>:v<version>`
//     The version segment lets us invalidate old localStorage when the
//     seed shape changes (bump version → old data ignored, fresh seed
//     wins). Without this, code-side schema changes would never reach
//     users who already have stale localStorage.
//   • Hydration is best-effort: parse errors fall back to the supplied
//     initial value silently. We never block the app on bad storage.
//   • Storage is shared across mock users (not user-namespaced). The
//     demo persona is one human switching identities — they want their
//     world to be stable across all of them.
//   • Writes are eager (every state change). For small slices the cost
//     is negligible; for larger ones (soldiers, users) consider only
//     persisting when the array length or specific fields change. We
//     don't currently optimize — JSON.stringify of ~100 records on a
//     setState is well under a frame budget.

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

const STORAGE_PREFIX = 'ha-pluga-sheli:state:';

function storageKey(slice: string, version: number): string {
  return `${STORAGE_PREFIX}${slice}:v${version}`;
}

/**
 * `useState`-shaped hook that persists to localStorage.
 *
 * @param slice      unique slice name (e.g. "assignments", "missions")
 * @param version    bump when the seeded shape changes — invalidates
 *                   any older localStorage blobs and falls back to
 *                   `initial`. Defaults to 1.
 * @param initial    fallback when storage is empty / invalid / older
 */
export function usePersistedState<T>(
  slice: string,
  initial: T,
  version: number = 1,
): [T, Dispatch<SetStateAction<T>>] {
  const key = storageKey(slice, version);

  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Quota / private-browsing — silently no-op. The demo continues
      // to work; we just lose persistence for this slice.
    }
  }, [key, state]);

  return [state, setState];
}

/** Wipe ALL persisted demo state. Useful for a "reset demo" CTA. */
export function clearAllPersistedState(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    // ignore
  }
}
