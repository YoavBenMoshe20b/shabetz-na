// Section primitive — a labelled vertical grouping.
//
// Labels are quiet eyebrows above their content — small, semi-bold,
// muted, with light tracking. They earn attention by tone, not size.
// The optional action on the right uses an indigo accent so it reads
// as "clickable" without competing with the section content.

import type { ReactNode } from 'react';

interface SectionProps {
  label?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Section({ label, action, children, className = '' }: SectionProps) {
  return (
    <section className={className}>
      {label && (
        <div className="flex items-baseline justify-between mb-3 px-0.5">
          <p className="text-tiny font-semibold text-mil-muted tracking-wide uppercase">
            {label}
          </p>
          {action && (
            <div className="text-tiny font-semibold text-mil-olive">
              {action}
            </div>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

// Page-level main container. 32 px between sections gives operational
// breathing room — the deliberate "new topic" beat the user feels.
//
// §17 — bottom padding bumped from pb-32 (8rem) to pb-44 (11rem) so
// content always clears the BottomNav (z-30, ~70px tall + 16px from
// bottom + iOS safe-area) AND the EmergencyFab (h-14 = 56px, sitting
// at calc(7rem + safe-area-inset-bottom)). Without enough padding the
// last card of a long page sat under the nav.
//
// Plus an explicit safe-area-inset-bottom calc on the actual padding-
// bottom for iOS notch handling.
export function PageMain({ children }: { children: ReactNode }) {
  return (
    <main
      className="px-5 py-6 max-w-xl mx-auto space-y-8"
      style={{ paddingBottom: 'calc(11rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {children}
    </main>
  );
}

// Collapsible section — header always visible, body toggles.
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
        className="w-full bg-mil-card border border-mil-border rounded-xl-soft px-4 py-3.5 flex items-center gap-2 hover:border-mil-border-strong hover:bg-mil-card-hover shadow-card transition-all duration-200 ease-out-soft"
      >
        <span className="text-sm font-semibold text-mil-text">{label}</span>
        {count != null && (
          <span className="text-tiny font-semibold text-mil-muted bg-mil-bg-alt border border-mil-border/70 rounded-md px-1.5 py-0.5 tabular-nums">
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
