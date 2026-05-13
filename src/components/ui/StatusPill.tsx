// Operational status indicators.
//
// Four pill states (added `info` for "neutral but notable"):
//   ready    = emerald (healthy / on-target / מוכן)
//   warning  = amber   (something needs attention but isn't immediate)
//   critical = rose    (live operational issue right now)
//   info     = sky     (neutral signal — delegations, etc.)
//
// Each pill carries a tinted background + matching border + a tiny inline
// dot so the same status reads at a glance whether the user is scanning
// the page or staring at one row. Dots and pills share the same tone
// vocabulary so they're interchangeable depending on row density.

import type { ReactNode } from 'react';

type Status = 'ready' | 'warning' | 'critical' | 'info';

const PILL: Record<Status, string> = {
  ready:    'bg-mil-success-bg text-mil-success border-mil-success-border',
  warning:  'bg-mil-warn-bg    text-mil-warn    border-mil-warn-border',
  critical: 'bg-mil-alert-bg   text-mil-alert   border-mil-alert-border',
  info:     'bg-mil-info-bg    text-mil-info    border-mil-info-border',
};

const DOT: Record<Status, string> = {
  ready:    'bg-mil-success',
  warning:  'bg-mil-warn',
  critical: 'bg-mil-alert',
  info:     'bg-mil-info',
};

export function StatusPill({ status, children }: { status: Status; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xxs font-semibold px-2 py-0.5 rounded-md border ${PILL[status]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${DOT[status]}`} aria-hidden />
      {children}
    </span>
  );
}

// Small status dot — for inline list rows where a full pill would be noise.
// Sized at 8px with a subtle ring so it still reads against dark surfaces.
export function StatusDot({ status, className = '' }: { status: Status; className?: string }) {
  return (
    <span
      className={`w-2 h-2 rounded-full flex-shrink-0 ring-2 ring-mil-bg ${DOT[status]} ${className}`}
      aria-hidden
    />
  );
}
