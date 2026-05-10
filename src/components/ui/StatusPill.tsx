// Operational status pill. Three states only:
//   ready    = green  (healthy / on-target / מוכן)
//   warning  = yellow (something needs attention but isn't immediate)
//   critical = red    (live operational issue right now)
//
// Per spec: red is reserved for immediate operational issues. Don't use
// red for "X% of platoon is on leave" — that's warning at most.

import type { ReactNode } from 'react';

type Status = 'ready' | 'warning' | 'critical';

const CLASSES: Record<Status, string> = {
  ready:    'bg-mil-success-bg text-mil-success border-mil-success/40',
  warning:  'bg-mil-warn-bg text-mil-warn border-mil-warn-border',
  critical: 'bg-mil-alert-bg text-mil-alert border-mil-alert/40',
};

export function StatusPill({ status, children }: { status: Status; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded border ${CLASSES[status]}`}>
      {children}
    </span>
  );
}

// Small status dot — for inline list rows where a full pill would be noise.
export function StatusDot({ status }: { status: Status }) {
  const tone = status === 'ready' ? 'bg-mil-success' : status === 'warning' ? 'bg-mil-warn' : 'bg-mil-alert';
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${tone}`} />;
}
