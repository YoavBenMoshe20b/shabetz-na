// Typography primitives. Use these instead of raw <h1>/<p> with inline
// Tailwind. Lets us tune the whole product's reading rhythm in one place.
//
// Hierarchy (top → bottom):
//   PageTitle      — once per screen, biggest text on the page
//   HeroTitle      — the one card that's the action target
//   SectionLabel   — small uppercase eyebrow before a group ("עכשיו")
//   CardTitle      — bold label inside a card row
//   Body           — primary readable text
//   Muted          — secondary info (time, dates, counts)
//   Hint           — tertiary metadata (smallest, lowest contrast)
//   Metric         — big tabular numbers

import type { ReactNode, ElementType } from 'react';

type AsProps = { as?: ElementType };

const cls = {
  pageTitle:     'text-hero font-extrabold text-mil-text tracking-tight',
  heroTitle:     'text-xl font-bold text-mil-text leading-snug',
  sectionLabel:  'text-tiny font-bold uppercase tracking-wider text-mil-muted',
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

export const PageTitle    = make(cls.pageTitle);
export const HeroTitle    = make(cls.heroTitle);
export const SectionLabel = make(cls.sectionLabel);
export const CardTitle    = make(cls.cardTitle);
export const Body         = make(cls.body);
export const Muted        = make(cls.muted);
export const Hint         = make(cls.hint);
export const Metric       = make(cls.metric);
