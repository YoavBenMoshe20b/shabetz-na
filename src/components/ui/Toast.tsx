// Toast — inline success/info confirmation banner.
//
// Replaces the ad-hoc <div className="bg-mil-success-bg ..."> blocks
// scattered across dashboards and forms. Same visual language, single
// source of truth.
//
// Usage:
//   {savedFlag && <Toast tone="success">היציאה נשמרה</Toast>}
//   {statusMsg && <Toast tone="olive">{statusMsg}</Toast>}
//
// Animation: fades in from the top. Caller controls visibility +
// auto-dismiss timing (intentional — different surfaces want different
// timings).

import type { ReactNode } from 'react';
import { Body } from './Text';

export type ToastTone = 'success' | 'olive' | 'info' | 'warn' | 'alert';

const TONE: Record<ToastTone, { bg: string; border: string; fg: string; dot: string }> = {
  success: {
    bg: 'bg-mil-success-bg', border: 'border-mil-success-border',
    fg: 'text-mil-success', dot: 'bg-mil-success',
  },
  olive: {
    bg: 'bg-mil-olive-bg',   border: 'border-mil-olive/20',
    fg: 'text-mil-olive',    dot: 'bg-mil-olive',
  },
  info: {
    bg: 'bg-mil-info-bg',    border: 'border-mil-info-border',
    fg: 'text-mil-info',     dot: 'bg-mil-info',
  },
  warn: {
    bg: 'bg-mil-warn-bg',    border: 'border-mil-warn-border',
    fg: 'text-mil-warn',     dot: 'bg-mil-warn',
  },
  alert: {
    bg: 'bg-mil-alert-bg',   border: 'border-mil-alert-border',
    fg: 'text-mil-alert',    dot: 'bg-mil-alert',
  },
};

interface ToastProps {
  tone?: ToastTone;
  children: ReactNode;
  /** Optional trailing slot (e.g. an action button). */
  action?: ReactNode;
}

export function Toast({ tone = 'success', children, action }: ToastProps) {
  const t = TONE[tone];
  return (
    <div
      className={`${t.bg} border ${t.border} rounded-xl-soft px-4 py-3 flex items-center gap-2.5 animate-fade-in`}
      role="status"
      aria-live="polite"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${t.dot} flex-shrink-0`} aria-hidden />
      <Body className={`${t.fg} font-semibold flex-1 min-w-0`}>{children}</Body>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
