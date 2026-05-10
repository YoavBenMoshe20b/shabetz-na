// Button primitive. Two design choices baked in:
//
//   1) The PRIMARY variant is deliberately chunkier than the rest. In an
//      operational app the user must know in <1 s "this is the thing to
//      press now." Visual weight is what does that.
//
//   2) Tap targets >= 44 px on `md` and `lg` so a tired thumb hits clean.

import type { ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size    = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary:   'bg-mil-olive hover:bg-mil-olive-light active:bg-mil-olive-dim text-white shadow-card-hover',
  secondary: 'bg-mil-card border border-mil-border hover:border-mil-olive text-mil-text',
  ghost:     'bg-transparent text-mil-olive-dim hover:bg-mil-olive-bg',
  danger:    'bg-mil-alert-bg border border-mil-alert/40 text-mil-alert hover:bg-mil-alert hover:text-white',
};

const SIZE: Record<Size, string> = {
  sm: 'text-tiny px-3 py-2 rounded-lg font-medium',
  md: 'text-sm px-4 py-3 rounded-xl font-semibold',
  lg: 'text-base px-6 py-4 rounded-2xl font-bold tracking-wide',
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
        disabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-[0.98]',
        'inline-flex items-center justify-center gap-2 transition-all',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  );
}
