// Sheet — the canonical modal/dialog surface.
//
// Reused by every page that opens a modal (new order, leave request,
// delegation grant, equipment defect, etc.). One primitive, one
// visual language: glass backdrop, dark sheet with a subtle sticky
// header, soft pop shadow. No coloured header strips — the calm
// dark surface IS the language.
//
// Behaviour:
//   • Mobile: sheet slides from bottom (`items-end`).
//   • Desktop (sm+): centred dialog (`sm:items-center`).
//   • Click on backdrop closes (via the dedicated close button only
//     when an explicit handler is passed; the surface intentionally
//     does not steal taps from the children).
//   • Title is sticky inside the sheet so it stays in view while the
//     body scrolls.

import type { ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional subtitle under the title. */
  subtitle?: string;
  /** Optional inline action on the right of the header (e.g. "ערוך"). */
  headerAction?: ReactNode;
  children: ReactNode;
  /** Tighter max-width when the content is intentionally narrow. */
  size?: 'md' | 'lg';
}

export function Sheet({
  open, onClose, title, subtitle, headerAction, children, size = 'md',
}: SheetProps) {
  if (!open) return null;
  const maxW = size === 'lg' ? 'max-w-2xl' : 'max-w-md';
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-mil-bg/70 backdrop-blur-glass animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      dir="rtl"
    >
      {/* Backdrop catcher */}
      <button
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        aria-label="סגור"
        tabIndex={-1}
      />

      <div
        className={`relative w-full ${maxW} bg-mil-card border border-mil-border-strong rounded-t-2xl sm:rounded-2xl shadow-pop max-h-[90vh] flex flex-col sm:mx-4 overflow-hidden`}
      >
        {/* Sticky sheet header — calm, not coloured. */}
        <header className="sticky top-0 z-10 bg-mil-card/95 backdrop-blur-glass border-b border-mil-border px-5 py-3.5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-mil-text leading-tight truncate">
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
            className="w-8 h-8 flex items-center justify-center rounded-lg text-mil-muted hover:text-mil-text hover:bg-mil-card-hover transition-colors duration-200 ease-out-soft"
            aria-label="סגור חלונית"
          >
            ✕
          </button>
        </header>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
