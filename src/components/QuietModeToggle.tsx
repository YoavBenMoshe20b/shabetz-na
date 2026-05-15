// QuietModeToggle — UI for the "מצב שקט" preference.
//
// Contract (per Phase 6.2.b review):
//   • Exactly four duration buttons: 30m / 1h / 2h / 4h.
//   • When active: show remaining time + "ביטול" button + a "critical
//     breakthrough" reassurance footnote.
//   • Activating while active REPLACES the window — not stacks.
//
// Visual model: inline within ProfilePage as a Section. Not a dedicated
// page — QuietMode is a tiny preference, doesn't warrant a route.

import { useQuietMode } from '../hooks/useQuietMode';
import {
  ALL_DURATIONS,
  DURATION_LABELS,
  formatRemaining,
} from '../utils/alerts/quietMode';
import type { QuietModeDuration } from '../types';
import { Body, Hint, Muted, Section } from './ui';

export default function QuietModeToggle() {
  const { isActive, remainingMinutes, activate, deactivate, pref } = useQuietMode();

  return (
    <Section label="מצב שקט">
      <div className="px-5 py-4 space-y-3">
        {isActive && pref ? (
          <ActiveState
            durationLabel={DURATION_LABELS[pref.duration]}
            remaining={formatRemaining(remainingMinutes)}
            expiresAt={pref.expiresAt}
            onCancel={deactivate}
          />
        ) : (
          <InactiveState onActivate={activate} />
        )}
        <Muted className="block text-tiny leading-snug pt-1">
          התראות קריטיות פורצות תמיד גם במצב שקט.
        </Muted>
      </div>
    </Section>
  );
}

// ─── States ─────────────────────────────────────────────────────────

function InactiveState({
  onActivate,
}: {
  onActivate: (duration: QuietModeDuration) => void;
}) {
  return (
    <>
      <Body className="text-sm leading-snug">
        השתק התראות שאינן קריטיות לפרק זמן קצוב.
      </Body>
      <div className="grid grid-cols-4 gap-2 pt-1">
        {ALL_DURATIONS.map((d) => (
          <button
            key={d}
            onClick={() => onActivate(d)}
            className="px-2.5 py-2 rounded-xl-soft bg-mil-card border border-mil-border text-mil-text font-semibold text-sm hover:border-mil-olive hover:text-mil-olive transition-all duration-200 ease-out-soft"
          >
            {DURATION_LABELS[d]}
          </button>
        ))}
      </div>
    </>
  );
}

function ActiveState({
  durationLabel,
  remaining,
  expiresAt,
  onCancel,
}: {
  durationLabel: string;
  remaining: string;
  expiresAt: string;
  onCancel: () => void;
}) {
  const expiresClock = formatClock(expiresAt);
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl-soft bg-mil-info-bg border border-mil-info-border">
        <span className="w-2 h-2 rounded-full bg-mil-info flex-shrink-0" aria-hidden />
        <div className="flex-1 min-w-0">
          <Body className="font-semibold text-sm leading-tight">
            מצב שקט פעיל · {durationLabel}
          </Body>
          <Hint className="block mt-0.5 text-mil-muted tabular-nums">
            נותרו {remaining} · עד {expiresClock}
          </Hint>
        </div>
      </div>
      <button
        onClick={onCancel}
        className="w-full px-4 py-2.5 rounded-xl-soft bg-mil-card border border-mil-border-strong text-mil-text font-semibold text-sm hover:border-mil-text transition-all duration-200 ease-out-soft"
      >
        ביטול
      </button>
    </div>
  );
}

function formatClock(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
