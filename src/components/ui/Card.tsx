// Card primitive — single source of truth for the surface containers.
// Variants are arranged by VISUAL WEIGHT (calm → heavy) so the eye
// scans the screen in the intended order:
//
//   muted     calmest, no border, just a soft tint — purely informational
//   default   the everyday card — white, 1 px subtle border
//   hero      the one primary card per screen — olive 2 px border + soft shadow
//   highlight needs attention (warning state) — warm sand tint + border
//   critical  live operational issue — alert tint, prominent border, shadow

import type { ReactNode } from 'react';

type CardVariant = 'muted' | 'default' | 'hero' | 'highlight' | 'critical';

const VARIANT: Record<CardVariant, string> = {
  muted:     'bg-mil-card-warm border border-transparent',
  default:   'bg-mil-card border border-mil-border shadow-card',
  hero:      'bg-mil-card border-2 border-mil-olive/40 shadow-hero',
  highlight: 'bg-mil-warn-bg border border-mil-warn-border shadow-card',
  critical:  'bg-mil-alert-bg border-2 border-mil-alert/50 shadow-card',
};

interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, variant = 'default', className = '', onClick }: CardProps) {
  const base = `rounded-2xl overflow-hidden ${VARIANT[variant]}`;
  const interactive = onClick
    ? 'text-right hover:shadow-card-hover hover:border-mil-olive/40 active:scale-[0.99] transition-all cursor-pointer'
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
