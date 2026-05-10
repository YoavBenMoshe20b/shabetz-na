// Centralised spacing tokens for new screens. Naming follows physical
// rhythm not arbitrary scale (S/M/L) so the rest of the team — and
// future-us — can pattern-match what each token means at a glance.
//
// Two spacing axes:
//   1) Vertical rhythm BETWEEN cards / sections
//   2) Internal padding INSIDE cards / containers

export const layout = {
  // ── Vertical rhythm ─────────────────────────────────────────
  // 24 px between major sections; reads as a deliberate operational beat
  pageSection: 'space-y-6',
  // 12 px between sibling cards inside a section
  cardStack:   'space-y-3',
  // 16 px between hero card and follow-ups
  heroStack:   'space-y-4',

  // ── Internal padding ────────────────────────────────────────
  cardPadHero: 'px-5 py-5',    // 20 px — hero / single primary card
  cardPadLg:   'px-5 py-4',    // 20/16 — important card
  cardPad:     'px-4 py-3',    // 16/12 — standard card row
  cardPadSm:   'px-3 py-2.5',  // 12/10 — list row
  cardPadXs:   'px-3 py-2',    // 12/8  — chip row

  // ── Page container ──────────────────────────────────────────
  // px-5 (20 px) gives breathing room on phones — was px-4 before
  page: 'px-5 py-5 pb-32 max-w-xl mx-auto',
};
