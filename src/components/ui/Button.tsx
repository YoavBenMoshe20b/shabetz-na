// Button primitive.
//
// Premium light language: deep indigo primary that earns attention by
// confidence (saturated blurple + white) rather than by being heavy.
// Secondary is a clean white surface with a hairline border. Ghost is
// transparent until hover. Sizes hold a >=44 px touch target on md/lg
// so the product feels solid under a tired thumb.

import type { ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
type Size    = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-mil-olive text-white shadow-card hover:bg-mil-olive-light active:bg-mil-olive-dim',
  secondary:
    'bg-mil-card text-mil-text border border-mil-border-strong hover:bg-mil-card-hover hover:border-mil-olive shadow-card',
  ghost:
    'bg-transparent text-mil-olive hover:bg-mil-olive-bg',
  quiet:
    'bg-transparent text-mil-muted hover:text-mil-text hover:bg-mil-card-hover',
  danger:
    'bg-mil-alert-bg border border-mil-alert-border text-mil-alert hover:bg-mil-alert hover:text-white hover:border-mil-alert',
};

const SIZE: Record<Size, string> = {
  sm: 'text-tiny px-3 py-2 rounded-lg font-semibold',
  md: 'text-sm px-4 py-2.5 rounded-xl-soft font-semibold',
  lg: 'text-base px-6 py-3.5 rounded-2xl font-semibold',
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
        'inline-flex items-center justify-center gap-2 whitespace-nowrap',
        'transition-all duration-200 ease-out-soft',
        'focus:outline-none focus-visible:shadow-focus',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  );
}
