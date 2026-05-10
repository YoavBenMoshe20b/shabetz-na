// Button primitive — primary / secondary / ghost / danger variants in
// three sizes. All new buttons should go through this. Inline-styled
// `<button>` elements are still used in legacy pages and are kept until
// those pages are migrated.

import type { ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size    = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:   'bg-mil-olive hover:bg-mil-olive-light text-white',
  secondary: 'bg-mil-card border border-mil-border hover:border-mil-olive text-mil-text',
  ghost:     'bg-transparent text-mil-olive hover:bg-mil-olive-bg',
  danger:    'bg-mil-alert-bg border border-mil-alert/40 text-mil-alert hover:bg-mil-alert hover:text-white',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'text-xs px-3 py-1.5 rounded-lg',
  md: 'text-sm px-4 py-2.5 rounded-xl',
  lg: 'text-base px-5 py-4 rounded-2xl font-bold',
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
      className={`
        ${VARIANT_CLASSES[variant]}
        ${SIZE_CLASSES[size]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
        font-medium transition-colors
        ${className}
      `.replace(/\s+/g, ' ').trim()}
    >
      {children}
    </button>
  );
}
