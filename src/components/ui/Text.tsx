// Typography primitives.
//
// Premium light language: deep ink for primary text, warm grays for
// secondary, and a confident -0.02em letter-spacing on display titles
// so the type lands with weight (Inter + Heebo both tighten beautifully).
// Hebrew titles never carry `uppercase` (no case) and never
// `tracking-widest` (spreads letters awkwardly).
//
// Hierarchy (top → bottom):
//   Eyebrow        — quiet context label (date, breadcrumb)
//   PageTitle      — once per screen, biggest text
//   HeroTitle      — the one card that's the action target
//   SectionLabel   — same as Section's internal label
//   CardTitle      — bold label inside a card row
//   Body           — primary readable text
//   Muted          — secondary (time, dates, counts)
//   Hint           — tertiary metadata
//   Metric         — big tabular numbers

import type { ReactNode, ElementType } from 'react';

type AsProps = { as?: ElementType };

const cls = {
  eyebrow:       'text-tiny font-semibold text-mil-muted tracking-wide uppercase',
  pageTitle:     'text-hero font-extrabold text-mil-text tracking-tightish',
  heroTitle:     'text-xl font-bold text-mil-text leading-snug tracking-tightish',
  sectionLabel:  'text-tiny font-semibold text-mil-muted tracking-wide uppercase',
  cardTitle:     'text-base font-semibold text-mil-text leading-tight',
  body:          'text-sm text-mil-text leading-relaxed',
  muted:         'text-tiny text-mil-muted leading-relaxed',
  hint:          'text-xxs text-mil-ghost',
  metric:        'text-metric font-extrabold tabular-nums text-mil-text tracking-tightish',
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
