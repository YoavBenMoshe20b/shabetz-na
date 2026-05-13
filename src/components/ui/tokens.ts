// ─── Design-system layout tokens ─────────────────────────────────────────
//
// Centralised spacing + elevation rhythm. Every operational surface uses
// these so the entire app reads as one product.
//
//   1. Spacing rhythm — air BETWEEN elements
//   2. Internal padding — air INSIDE containers
//   3. Surface elevation — which card style for which job
//
// Vocabulary is physical (page / hero / row) not abstract.

export const layout = {
  // ── Vertical rhythm ─────────────────────────────────────────
  pageSection: 'space-y-8',     // 32px between major sections — confident operational beat
  cardStack:   'space-y-3',     // 12px between sibling cards
  heroStack:   'space-y-5',     // 20px between hero card and follow-ups
  pairStack:   'space-y-1.5',   // 6px — tight label/value pair

  // ── Internal padding ────────────────────────────────────────
  cardPadHero: 'px-6 py-5',     // 24/20 — hero / primary card
  cardPadLg:   'px-5 py-4',     // 20/16 — important card
  cardPad:     'px-5 py-4',     // 20/16 — standard card row
  cardPadSm:   'px-4 py-3',     // 16/12 — list row
  cardPadXs:   'px-3.5 py-2.5', // 14/10 — chip row

  // ── Page container ──────────────────────────────────────────
  // px-5 mobile, max-w-xl centred for tablet+. The bottom padding
  // clears the floating nav with extra room for the safe area.
  page: 'px-5 py-6 pb-32 max-w-xl mx-auto',
};

// ─── Surface elevation ───────────────────────────────────────────────────
//
// Five tiers. Use by composition: `${surface.base} ${layout.cardPad}`.
//
//   quiet       — list rows, sub-cards inside a card. Subtle bg, hairline.
//   base        — the default operational card. Workhorse.
//   raised      — hero / emphasised. Soft long shadow + slight warmth.
//   glass       — floating chrome (header, dock, sticky bars).
//   interactive — list rows where hover should bring it forward.

export const surface = {
  quiet:       'bg-mil-bg-alt border border-mil-border/70 rounded-xl-soft',
  base:        'bg-mil-card border border-mil-border rounded-2xl shadow-card',
  raised:      'bg-mil-card border border-mil-border rounded-2xl-soft shadow-hero',
  glass:       'bg-mil-card/85 backdrop-blur-glass border border-mil-border/70',
  interactive: 'bg-mil-card border border-mil-border rounded-xl-soft hover:border-mil-border-strong hover:shadow-card-hover transition-all duration-200 ease-out-soft',
};

// ─── Text utility shortcuts (semantic) ───────────────────────────────────

export const text = {
  hero:    'text-hero font-bold text-mil-text tracking-tightish',
  title:   'text-lg font-bold text-mil-text',
  body:    'text-base text-mil-text',
  meta:    'text-tiny text-mil-muted',
  ghost:   'text-tiny text-mil-ghost',
  metric:  'text-metric font-extrabold tabular-nums text-mil-text tracking-tightish',
};

// ─── Motion ──────────────────────────────────────────────────────────────

export const motion = {
  transitionBase: 'transition-all duration-200 ease-out-soft',
  fadeIn:         'animate-fade-in',
  sheetIn:        'animate-sheet-in',
};
