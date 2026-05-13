// ─── Design-system layout tokens ─────────────────────────────────────────
//
// Centralised spacing + elevation rhythm. Every operational surface uses
// these so the entire app reads as one product, not a stack of pages.
//
// Three concerns are encoded here:
//
//   1. Spacing rhythm — how much air sits BETWEEN elements
//   2. Internal padding — how much room INSIDE containers
//   3. Surface elevation — which card style for which job
//
// The vocabulary is physical (page / hero / row) not abstract (S/M/L) so
// future readers can guess the right token at a glance.

export const layout = {
  // ── Vertical rhythm ─────────────────────────────────────────
  // 28 px between major sections — operational beat that says "new topic"
  pageSection: 'space-y-7',
  // 12 px between sibling cards inside a section
  cardStack:   'space-y-3',
  // 16 px between hero card and follow-ups
  heroStack:   'space-y-4',
  // 6 px — tight pair (label above value)
  pairStack:   'space-y-1.5',

  // ── Internal padding ────────────────────────────────────────
  cardPadHero: 'px-5 py-5',    // 20 px — hero / single primary card
  cardPadLg:   'px-5 py-4',    // 20/16 — important card
  cardPad:     'px-4 py-3.5',  // 16/14 — standard card row
  cardPadSm:   'px-3.5 py-3',  // 14/12 — list row
  cardPadXs:   'px-3 py-2',    // 12/8  — chip row

  // ── Page container ──────────────────────────────────────────
  // px-5 (20 px) gives breathing room on phones — was px-4 before
  page: 'px-5 py-5 pb-32 max-w-xl mx-auto',
};

// ─── Surface elevation ───────────────────────────────────────────────────
//
// Three tiers of card surface. Lower tier = quieter, less attention.
// Higher tier = more emphasis, "this is the thing on this page".
//
//   quiet   — list rows, sub-cards. Subtle bg, hairline border.
//   base    — the default operational card. The workhorse.
//   raised  — hero / emphasised. Slightly warmer bg + stronger border.
//   glass   — for floating chrome (header, bottom nav, sticky bars).
//
// Use these by composition: `${surface.base} ${layout.cardPad}` etc.

export const surface = {
  quiet:  'bg-mil-bg-alt border border-mil-border/60 rounded-xl-soft',
  base:   'bg-mil-card border border-mil-border rounded-2xl shadow-card',
  raised: 'bg-mil-card-warm border border-mil-border-strong rounded-2xl shadow-hero',
  glass:  'bg-mil-surface/80 backdrop-blur-glass border border-mil-border/60',
  // For interactive list rows where hover should bring it forward.
  interactive: 'bg-mil-card border border-mil-border rounded-xl-soft hover:bg-mil-card-hover hover:border-mil-border-strong transition-colors duration-150 ease-out-soft',
};

// ─── Text utility shortcuts (semantic) ───────────────────────────────────
//
// For places where the <Body>/<Muted>/<Hint> components are too heavy
// — for example inside a flex row where we want raw control.

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
  // Default eased transition for any hover/focus state.
  transitionBase: 'transition-all duration-200 ease-out-soft',
  // Entrance for surfaces (sheets, modals, banners).
  fadeIn: 'animate-fade-in',
};
