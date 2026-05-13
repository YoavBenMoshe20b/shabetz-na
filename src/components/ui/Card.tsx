// Card primitive — single source of truth for surface containers.
//
// Premium operational dark: surfaces lean on subtle border + soft inset
// highlight rather than heavy drop shadows. The hierarchy is:
//
//   muted      calmest — quiet container, used for asides + empty states
//   default    everyday card — bg-mil-card + hairline border
//   hero       the ONE primary surface per page — warmer bg, soft shadow,
//              accent-tinted border so the eye lands on it first
//   highlight  warning state — desaturated amber tint
//   critical   live operational issue — desaturated rose tint
//
// We deliberately avoid raised shadows for non-floating surfaces; the
// soft inset highlight on bg-mil-card-warm + the border ladder reads as
// elevation without descending into "gamer HUD" territory.

import type { ReactNode } from 'react';

type CardVariant = 'muted' | 'default' | 'hero' | 'highlight' | 'critical';

const VARIANT: Record<CardVariant, string> = {
  muted:     'bg-mil-bg-alt border border-mil-border/60',
  default:   'bg-mil-card border border-mil-border shadow-card',
  hero:      'bg-mil-card-warm border border-mil-olive/25 shadow-hero',
  highlight: 'bg-mil-warn-bg border border-mil-warn-border',
  critical:  'bg-mil-alert-bg border border-mil-alert-border',
};

interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, variant = 'default', className = '', onClick }: CardProps) {
  const base = `rounded-2xl overflow-hidden ${VARIANT[variant]}`;
  // Touch feel for interactive cards: a subtle accent-border bloom + an
  // almost imperceptible press. No 3-D pop (would feel gamer-y); no big
  // scale (would feel toy-like). The border bloom alone reads as tappable.
  const interactive = onClick
    ? 'text-right hover:border-mil-olive/55 hover:bg-mil-card-hover active:scale-[0.995] transition-all duration-200 ease-out-soft cursor-pointer'
    : '';
  if (onClick) {
    return (
      <button onClick={onClick} className={`${base} ${interactive} w-full ${className}`}>
        {children}
      </button>
    );
  }
  return <div className={`${base} ${className}`}>{children}</div>;
}
