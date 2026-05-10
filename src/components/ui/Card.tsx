// Card primitive — single source of truth for the surface containers
// used across operational screens. New code should reach for this
// instead of writing `bg-mil-card border border-mil-border ...` inline.

import type { ReactNode } from 'react';

type CardVariant =
  | 'default'    // white, light border — the everyday card
  | 'soft'       // olive-tinted background, subtle border — calm/informational
  | 'hero'       // olive 2-px border + white — the hero card on a screen
  | 'highlight'  // sand-tinted, warning ambience — attention-needed cards
  | 'critical';  // red-tinted — only for live operational issues

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default:   'bg-mil-card border border-mil-border',
  soft:      'bg-mil-olive-bg border border-mil-olive/20',
  hero:      'bg-mil-card border-2 border-mil-olive/40',
  highlight: 'bg-mil-warn-bg border border-mil-warn-border',
  critical:  'bg-mil-alert-bg border-2 border-mil-alert/60',
};

interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, variant = 'default', className = '', onClick }: CardProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`rounded-2xl overflow-hidden ${VARIANT_CLASSES[variant]} ${onClick ? 'text-right hover:border-mil-olive/50 transition-colors cursor-pointer' : ''} ${className}`}
    >
      {children}
    </Tag>
  );
}
