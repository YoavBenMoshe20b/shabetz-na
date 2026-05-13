// State primitives — Empty / Loading / Error.
//
// Three small components every page reaches for. They live in ui/ so the
// design language is locked in one place. Every new screen consumes these
// instead of re-rolling its own.

import type { ReactNode } from 'react';
import { Body, Hint } from './Text';

// ─── Empty ────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  title: string;
  hint?: string;
  /** Optional inline action (Button or anchor). */
  action?: ReactNode;
  /** Optional SVG glyph (24×24). Defaults to a quiet dot. */
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, hint, action, icon, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`bg-mil-card border border-mil-border rounded-xl-soft py-10 px-5 text-center ${className}`}
    >
      <div className="mx-auto w-10 h-10 rounded-full bg-mil-bg-alt border border-mil-border flex items-center justify-center mb-3 text-mil-muted">
        {icon ?? <span className="w-1.5 h-1.5 rounded-full bg-mil-ghost" aria-hidden />}
      </div>
      <Body className="font-semibold">{title}</Body>
      {hint && <Hint className="mt-1.5 text-mil-muted">{hint}</Hint>}
      {action && <div className="mt-4 inline-flex">{action}</div>}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────
//
// Three variants:
//   pageDot — single small dot for route-suspense fallback
//   line    — one or more horizontal pulse bars
//   card    — a placeholder card matching standard surface chrome

export function LoadingDot({ className = '' }: { className?: string }) {
  return (
    <div className={`min-h-screen bg-mil-bg flex items-center justify-center ${className}`} dir="rtl">
      <div className="w-1.5 h-1.5 rounded-full bg-mil-olive animate-pulse" aria-hidden />
    </div>
  );
}

export function SkeletonLines({ count = 3, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded-md bg-mil-bg-alt animate-pulse-soft"
          style={{ width: `${70 + ((i * 7) % 30)}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-mil-card border border-mil-border rounded-xl-soft shadow-card p-4 animate-pulse-soft" aria-hidden>
      <div className="h-4 w-1/2 rounded-md bg-mil-bg-alt mb-3" />
      <div className="h-3 w-3/4 rounded-md bg-mil-bg-alt mb-2" />
      <div className="h-3 w-2/3 rounded-md bg-mil-bg-alt" />
    </div>
  );
}

// ─── Error state (in-page; the global one is ErrorBoundary) ───────────────

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'משהו השתבש',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="bg-mil-alert-bg border border-mil-alert-border rounded-xl-soft p-5" role="alert">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-mil-alert" aria-hidden />
        <p className="text-xxs font-semibold tracking-wide uppercase text-mil-alert">שגיאה</p>
      </div>
      <Body className="text-mil-alert font-semibold">{title}</Body>
      {message && <Hint className="mt-1 text-mil-text">{message}</Hint>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 text-tiny font-semibold text-mil-alert hover:text-mil-alert/80 underline underline-offset-2"
        >
          נסה שוב
        </button>
      )}
    </div>
  );
}
