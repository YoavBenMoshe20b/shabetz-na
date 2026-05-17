// Sheet — the canonical modal/dialog surface.
//
// Premium light language: soft frosted backdrop, clean white sheet,
// sticky header that reads as part of the surface. On mobile the sheet
// occupies most of the screen and slides up from the bottom; on tablet+
// it centres as a dialog sized to content.
//
// LAYOUT FIX (2026-05): the previous version used `flex items-end` +
// `maxHeight: 100%` on the inner sheet. Because the inner had no
// explicit height, `flex-1` on the body collapsed to 0 — only the
// sticky header rendered. The CommandMenu showed "תפריט" with no items
// underneath.
// New layout:
//   • On MOBILE the inner sheet uses `h-full` to stretch to the
//     outer's full available height (viewport minus safe-area padding).
//     The body has real height to grow into; `flex-1 min-h-0` lets it
//     scroll internally.
//   • On TABLET+ the inner uses `h-auto + max-h-[88vh]` so the dialog
//     fits its content but never exceeds the viewport.

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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-mil-text/30 backdrop-blur-glass-strong animate-fade-in"
      style={{
        // Top/bottom padding: keep the sheet off the iOS notch and the
        // home indicator. 12px minimum on devices without safe-area.
        paddingTop: 'max(env(safe-area-inset-top), 12px)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      dir="rtl"
    >
      {/* Backdrop — full-screen invisible button. Tapping outside the
          sheet calls onClose. */}
      <button
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        aria-label="סגור"
        tabIndex={-1}
      />

      <div
        className={`
          relative w-full ${maxW}
          h-full sm:h-auto sm:max-h-[88vh]
          bg-mil-card border border-mil-border
          rounded-t-2xl-soft sm:rounded-2xl-soft shadow-pop
          flex flex-col sm:mx-4 overflow-hidden animate-sheet-in
        `}
      >
        {/* Sticky header — refined, not a coloured strip. shrink-0
            prevents the header from collapsing when content is short. */}
        <header className="shrink-0 sticky top-0 z-10 bg-mil-card/95 backdrop-blur-glass border-b border-mil-border px-5 py-4 flex items-center gap-3">
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

        {/* Body — scrollable, takes remaining height. min-h-0 lets it
            actually shrink below its content's intrinsic size and
            engage the overflow scroller. */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
