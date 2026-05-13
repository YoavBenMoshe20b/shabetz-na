// Card primitive — single source of truth for surface containers.
//
// Premium light language: cards are clean white surfaces with a warm
// hairline border + the lightest of shadows. Hero earns a soft long-cast
// shadow so the eye lands on it first; muted is a quiet warm tint card
// with no border for asides + empty states.
//
//   muted      calmest — warm tint, no shadow. Asides + empty states.
//   default    everyday card — bg-mil-card + hairline + card shadow
//   hero       the ONE primary surface per page — soft long shadow,
//              accent-tinted border so the eye lands on it
//   highlight  warning state — restrained warm amber tint
//   critical   live operational issue — coral tint

import type { ReactNode } from 'react';

type CardVariant = 'muted' | 'default' | 'hero' | 'highlight' | 'critical';

const VARIANT: Record<CardVariant, string> = {
  muted:     'bg-mil-bg-alt border border-mil-border/60',
  default:   'bg-mil-card border border-mil-border shadow-card',
  hero:      'bg-mil-card border border-mil-olive/15 shadow-hero',
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
  // Interactive cards: subtle shadow lift + accent border tint. No scale
  // (would feel toy-like), no big elevation pop (would feel gamer).
  const interactive = onClick
    ? 'text-right hover:border-mil-olive/30 hover:shadow-card-hover active:scale-[0.997] transition-all duration-200 ease-out-soft cursor-pointer'
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
