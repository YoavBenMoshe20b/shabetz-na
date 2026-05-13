// Sheet — the canonical modal/dialog surface.
//
// Premium light language: a soft frosted backdrop, a clean white sheet
// with a strong long-cast shadow, and a sticky header that reads as part
// of the surface (not a coloured strip). On mobile the sheet slides up
// from the bottom; on tablet+ it centres as a dialog.

import type { ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerAction?: ReactNode;
  children: ReactNode;
  size?: 'md' | 'lg';
}

export function Sheet({
  open, onClose, title, subtitle, headerAction, children, size = 'md',
}: SheetProps) {
  if (!open) return null;
  const maxW = size === 'lg' ? 'max-w-2xl' : 'max-w-md';
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-mil-text/20 backdrop-blur-glass-strong animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      dir="rtl"
    >
      <button
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        aria-label="סגור"
        tabIndex={-1}
      />

      <div
        className={`relative w-full ${maxW} bg-mil-card border border-mil-border rounded-t-2xl-soft sm:rounded-2xl-soft shadow-pop max-h-[92vh] flex flex-col sm:mx-4 overflow-hidden animate-sheet-in`}
      >
        {/* Sticky sheet header — refined, not a coloured strip */}
        <header className="sticky top-0 z-10 bg-mil-card/95 backdrop-blur-glass border-b border-mil-border px-5 py-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-mil-text leading-tight truncate tracking-tightish">
              {title}
            </h2>
            {subtitle && (
              <p className="text-tiny text-mil-muted leading-snug mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
          {headerAction}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-mil-muted hover:text-mil-text hover:bg-mil-bg-alt transition-colors duration-200 ease-out-soft"
            aria-label="סגור חלונית"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3 L11 11 M11 3 L3 11" />
            </svg>
          </button>
        </header>

        <div className="overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
