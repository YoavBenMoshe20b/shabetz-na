// Typography primitives. Use these instead of raw <h1>/<p> with inline
// Tailwind. Lets us tune the whole product's reading rhythm in one place.
//
// Hierarchy (top → bottom):
//   Eyebrow        — small context tag above a PageTitle (gdood / company)
//   PageTitle      — once per screen, biggest text on the page
//   HeroTitle      — the one card that's the action target
//   SectionLabel   — quiet eyebrow above a section group
//   CardTitle      — bold label inside a card row
//   Body           — primary readable text
//   Muted          — secondary info (time, dates, counts)
//   Hint           — tertiary metadata (smallest, lowest contrast)
//   Metric         — big tabular numbers
//
// Design language: Hebrew labels never carry `uppercase` (no case in
// Hebrew) and never `tracking-widest` (spreads letters awkwardly).
// Confidence comes from weight + tone, not letterspacing.

import type { ReactNode, ElementType } from 'react';

type AsProps = { as?: ElementType };

const cls = {
  eyebrow:       'text-tiny font-bold text-mil-muted',
  pageTitle:     'text-hero font-extrabold text-mil-text tracking-tight',
  heroTitle:     'text-xl font-bold text-mil-text leading-snug',
  sectionLabel:  'text-xs font-bold text-mil-muted',
  cardTitle:     'text-base font-bold text-mil-text leading-tight',
  body:          'text-sm text-mil-text leading-relaxed',
  muted:         'text-tiny text-mil-muted leading-relaxed',
  hint:          'text-xxs text-mil-ghost',
  metric:        'text-metric font-extrabold tabular-nums text-mil-text',
};

function make(variantClass: string) {
  return function TextPrim({ children, className = '', as }: { children: ReactNode; className?: string } & AsProps) {
    const Tag = as ?? 'p';
    return <Tag className={`${variantClass} ${className}`}>{children}</Tag>;
  };
}

export const Eyebrow      = make(cls.eyebrow);
export const PageTitle    = make(cls.pageTitle);
export const HeroTitle    = make(cls.heroTitle);
export const SectionLabel = make(cls.sectionLabel);
export const CardTitle    = make(cls.cardTitle);
export const Body         = make(cls.body);
export const Muted        = make(cls.muted);
export const Hint         = make(cls.hint);
export const Metric       = make(cls.metric);
