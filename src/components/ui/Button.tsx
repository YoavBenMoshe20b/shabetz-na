// Button primitive.
//
// Three design choices baked into the new operational language:
//
//   1) PRIMARY is intentionally heavier than the rest. Under pressure
//      the user must know in <1 s "this is the thing to press now."
//      Visual weight does that. The primary now uses the indigo accent
//      with a hairline highlight on top to read as "premium button"
//      and not "filled rectangle".
//
//   2) Tap targets ≥ 44 px on `md` and `lg` so a tired thumb hits clean.
//
//   3) Soft geometry (12 / 14 / 16 px radii) — matches the card system.

import type { ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
type Size    = 'sm' | 'md' | 'lg';

// The button gradient is rendered with an inset highlight so the surface
// reads as a physical chip rather than a flat block. This is the ONLY
// place gradients appear in the system — keeps them feeling deliberate.
const VARIANT: Record<Variant, string> = {
  primary:
    'bg-mil-olive text-white shadow-card-hover ' +
    'hover:bg-mil-olive-light hover:shadow-glow-accent ' +
    'active:bg-mil-olive-dim',
  secondary:
    'bg-mil-card border border-mil-border text-mil-text ' +
    'hover:border-mil-olive/60 hover:bg-mil-card-hover',
  ghost:
    'bg-transparent text-mil-olive-light ' +
    'hover:bg-mil-olive-bg',
  quiet:
    'bg-transparent text-mil-muted ' +
    'hover:text-mil-text hover:bg-mil-card-hover',
  danger:
    'bg-mil-alert-bg border border-mil-alert/40 text-mil-alert ' +
    'hover:bg-mil-alert hover:text-white hover:border-mil-alert',
};

const SIZE: Record<Size, string> = {
  sm: 'text-tiny px-3 py-2 rounded-lg font-semibold',
  md: 'text-sm px-4 py-3 rounded-xl-soft font-semibold',
  lg: 'text-base px-6 py-4 rounded-2xl font-bold',
};

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}

export function Button({
  children, onClick, variant = 'primary', size = 'md',
  fullWidth = false, disabled = false, type = 'button', className = '',
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        VARIANT[variant],
        SIZE[size],
        fullWidth ? 'w-full' : '',
        disabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-[0.985]',
        'inline-flex items-center justify-center gap-2',
        'transition-all duration-200 ease-out-soft',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-mil-olive/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mil-bg',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  );
}
