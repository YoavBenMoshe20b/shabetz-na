// Input + Textarea primitives — the canonical form fields.
//
// Premium light: refined surfaces with a hairline border, soft inner
// padding, and a confident indigo focus ring. No heavy borders, no
// "Material" floating labels — just a clean operational form field.

import { forwardRef } from 'react';
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';

const base =
  'w-full bg-mil-card border border-mil-border rounded-xl-soft px-3.5 py-2.5 text-mil-text ' +
  'placeholder:text-mil-ghost text-base ' +
  'focus:outline-none focus:border-mil-olive focus:shadow-focus ' +
  'hover:border-mil-border-strong ' +
  'transition-all duration-200 ease-out-soft ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...props }, ref) {
    return <input ref={ref} className={`${base} ${className}`} {...props} />;
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', rows = 3, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={`${base} resize-none leading-relaxed ${className}`} {...props} />;
  }
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={`${base} pr-9 appearance-none bg-no-repeat bg-[left_0.875rem_center] ${className}`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'><path d='M1 1.5L6 6.5L11 1.5' stroke='%23605c66' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
        }}
        {...props}
      >
        {children}
      </select>
    );
  }
);

// Inline label that sits above a form field.
export function FieldLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-tiny font-semibold text-mil-muted mb-1.5 ${className}`}>
      {children}
    </label>
  );
}
