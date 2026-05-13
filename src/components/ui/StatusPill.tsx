// Operational status indicators.
//
// Five pill states on the premium light substrate:
//   ready    = mint/teal (healthy / on-target / מוכן)
//   warning  = amber     (needs attention, not immediate)
//   critical = coral     (live operational issue)
//   info     = soft blue (neutral notable signal)
//   rest     = muted purple (rest / recovery state — rare)
//
// Pills are soft-tinted chips with a hairline border + an inline dot —
// the dot is the universal "live indicator" vocabulary, the surrounding
// chip is the label. Density variants share the same tone vocabulary.

import type { ReactNode } from 'react';

type Status = 'ready' | 'warning' | 'critical' | 'info' | 'rest';

const PILL: Record<Status, string> = {
  ready:    'bg-mil-success-bg text-mil-success border-mil-success-border',
  warning:  'bg-mil-warn-bg    text-mil-warn    border-mil-warn-border',
  critical: 'bg-mil-alert-bg   text-mil-alert   border-mil-alert-border',
  info:     'bg-mil-info-bg    text-mil-info    border-mil-info-border',
  rest:     'bg-mil-rest-bg    text-mil-rest    border-mil-rest-border',
};

const DOT: Record<Status, string> = {
  ready:    'bg-mil-success',
  warning:  'bg-mil-warn',
  critical: 'bg-mil-alert',
  info:     'bg-mil-info',
  rest:     'bg-mil-rest',
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
export function StatusDot({ status, className = '' }: { status: Status; className?: string }) {
  return (
    <span
      className={`w-2 h-2 rounded-full flex-shrink-0 ring-2 ring-mil-card ${DOT[status]} ${className}`}
      aria-hidden
    />
  );
}
