// Section primitive — a labelled vertical grouping. Used everywhere
// the operational surfaces read "label · content" (עכשיו · השעות הקרובות
// · פעילות מחלקות אחרונה · הגדרות פלוגה).
//
// Visual language: section labels are micro-eyebrows — short, quiet,
// confident. They earn attention by tone, not size. The optional action
// on the right uses the `quiet` button vocabulary so it never competes
// with the section's content.

import type { ReactNode } from 'react';

interface SectionProps {
  label?: string;
  action?: ReactNode;            // optional inline action on the right of the label
  children: ReactNode;
  className?: string;
}

export function Section({ label, action, children, className = '' }: SectionProps) {
  return (
    <section className={className}>
      {label && (
        <div className="flex items-baseline justify-between mb-3 px-1">
          <p className="text-tiny font-semibold text-mil-muted tracking-wide">
            {label}
          </p>
          {action && (
            <div className="text-tiny font-semibold text-mil-olive-light">
              {action}
            </div>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

// Page-level main container. Centralised mobile-first padding +
// bottom-nav-clearing space + spacing rhythm between sections.
// 28 px between sections gives the eye a clear "new topic" beat.
export function PageMain({ children }: { children: ReactNode }) {
  return (
    <main className="px-5 py-5 pb-32 max-w-xl mx-auto space-y-7">
      {children}
    </main>
  );
}

// Collapsible section — header always visible, body toggles.
// Used for low-priority detail that shouldn't push primary content
// off the fold (per-platoon equipment breakdowns, advanced settings).
interface CollapsibleProps {
  label: string;
  open: boolean;
  onToggle: () => void;
  count?: number;
  children: ReactNode;
}

export function CollapsibleSection({ label, open, onToggle, count, children }: CollapsibleProps) {
  return (
    <section>
      <button
        onClick={onToggle}
        className="w-full bg-mil-card border border-mil-border rounded-xl-soft px-4 py-3.5 flex items-center gap-2 hover:bg-mil-card-hover hover:border-mil-border-strong transition-all duration-200 ease-out-soft"
      >
        <span className="text-sm font-bold text-mil-text">{label}</span>
        {count != null && (
          <span className="text-tiny font-semibold text-mil-muted bg-mil-bg-alt border border-mil-border/60 rounded-md px-1.5 py-0.5 tabular-nums">
            {count}
          </span>
        )}
        <span className={`mr-auto text-mil-ghost transition-transform duration-200 ease-out-soft ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>
      {open && <div className="mt-2 animate-fade-in">{children}</div>}
    </section>
  );
}
