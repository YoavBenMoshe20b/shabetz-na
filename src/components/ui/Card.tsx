// Card primitive — single source of truth for surface containers.
//
// Design language: refined minimalism for an operational product.
// Shadows are reserved for floating elements (modals, FAB) — surfaces
// here rely on the warm border + subtle bg shift for layering. Calmer
// reads better under pressure than depth-via-shadow.
//
//   muted      calmest — warm tint, no border. Empty states + asides.
//   default    everyday card — bg-mil-card, hairline border, no shadow
//   hero       the ONE primary surface per page — slightly stronger
//              olive-tinted border + a single soft shadow (the only
//              shadow we still use in non-floating surfaces)
//   highlight  warning state — warm sand tint + sand border, no shadow
//   critical   live operational issue — alert tint + alert border

import type { ReactNode } from 'react';

type CardVariant = 'muted' | 'default' | 'hero' | 'highlight' | 'critical';

const VARIANT: Record<CardVariant, string> = {
  muted:     'bg-mil-card-warm border border-transparent',
  default:   'bg-mil-card border border-mil-border',
  hero:      'bg-mil-card border border-mil-olive/30 shadow-hero',
  highlight: 'bg-mil-warn-bg border border-mil-warn-border',
  critical:  'bg-mil-alert-bg border border-mil-alert/40',
};

interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, variant = 'default', className = '', onClick }: CardProps) {
  const base = `rounded-2xl overflow-hidden ${VARIANT[variant]}`;
  // Touch feel: subtle border shift + slight press. No shadow lift (would
  // betray the "calm" direction); no scale (would feel toy-like). The
  // border-olive transition is enough to read as "tappable".
  const interactive = onClick
    ? 'text-right hover:border-mil-olive/50 active:scale-[0.995] transition-colors duration-150 cursor-pointer'
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
