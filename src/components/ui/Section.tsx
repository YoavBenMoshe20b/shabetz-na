// Section primitive — a labelled vertical grouping. Used everywhere
// the operational Home reads "label · content" (עכשיו · השעות הקרובות
// · פעילות מחלקות אחרונה · הגדרות פלוגה).

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
        // Hebrew labels: no uppercase (Hebrew has no case), no tracking-
        // widest (spreads letters awkwardly). Bold + muted-tone for a
        // confident-but-quiet section eyebrow that reads cleanly at any
        // size on mobile.
        <div className="flex items-baseline justify-between mb-2.5 px-1">
          <p className="text-xs font-bold text-mil-muted">{label}</p>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// Page-level main container. Centralised mobile-first padding +
// bottom-nav-clearing space + spacing rhythm between sections.
// Tokens come from ./tokens.ts so adjustments happen in one place.
export function PageMain({ children }: { children: ReactNode }) {
  return (
    <main className="px-5 py-5 pb-32 max-w-xl mx-auto space-y-6">
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
        className="w-full bg-mil-card border border-mil-border rounded-xl px-4 py-3 flex items-center gap-2 hover:bg-mil-card-hover transition-colors"
      >
        <span className="text-sm font-bold text-mil-text">{label}</span>
        {count != null && <span className="text-xs text-mil-ghost">({count})</span>}
        <span className="mr-auto text-mil-ghost">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="mt-2">{children}</div>}
    </section>
  );
}
