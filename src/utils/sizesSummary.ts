// sizesSummary.ts — aggregate per-soldier sizes into platoon/company totals.
//
// Logistics ordering needs counts per size (how many M, how many 42).
// Soldiers edit their own sizes in /profile; this util projects the
// roster into a {size: count} histogram per category.

import type { Soldier } from '../types';

export type SizeCategory = 'shirt' | 'pants' | 'shoe';

export interface SizeBucket {
  /** Free-text size label (e.g. "M", "L", "42", "44.5"). */
  size: string;
  count: number;
}

export interface SizesHistogram {
  shirt: SizeBucket[];
  pants: SizeBucket[];
  shoe:  SizeBucket[];
  /** Total soldiers with at least one size filled out. */
  reported: number;
  /** Total soldiers we considered (active roster size). */
  total: number;
}

/**
 * Build a sizes histogram over the given soldiers. Buckets are sorted
 * by count descending so the most-needed size leads the row.
 *
 * Missing sizes are counted under an `unfilled` bucket label so the
 * Rasap can see how many soldiers still need to fill out their sizes.
 */
export function buildSizesHistogram(soldiers: Soldier[]): SizesHistogram {
  const shirt = new Map<string, number>();
  const pants = new Map<string, number>();
  const shoe  = new Map<string, number>();

  let reported = 0;
  for (const s of soldiers) {
    const tags: Array<[Map<string, number>, string | undefined]> = [
      [shirt, s.shirtSize],
      [pants, s.pantsSize],
      [shoe,  s.shoeSize],
    ];
    let touched = false;
    for (const [bucket, raw] of tags) {
      const key = (raw ?? '').trim() || '—';
      bucket.set(key, (bucket.get(key) ?? 0) + 1);
      if (key !== '—') touched = true;
    }
    if (touched) reported += 1;
  }

  const toBuckets = (m: Map<string, number>): SizeBucket[] =>
    Array.from(m.entries())
      .map(([size, count]) => ({ size, count }))
      .sort((a, b) => {
        // Push the "—" (unfilled) bucket to the end so populated sizes lead.
        if (a.size === '—' && b.size !== '—') return  1;
        if (b.size === '—' && a.size !== '—') return -1;
        return b.count - a.count;
      });

  return {
    shirt: toBuckets(shirt),
    pants: toBuckets(pants),
    shoe:  toBuckets(shoe),
    reported,
    total: soldiers.length,
  };
}

export const CATEGORY_LABEL: Record<SizeCategory, string> = {
  shirt: 'חולצה',
  pants: 'מכנס',
  shoe:  'נעליים',
};
