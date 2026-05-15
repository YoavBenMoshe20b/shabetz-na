// FocusSection — "מה דורש החלטה עכשיו" on the dashboard.
//
// Surfaces FocusItems built by the engine. Each item carries:
//   • decisionPrompt — phrased as a question
//   • context — one-line "why now"
//   • severity — drives visual tone
//   • decisionRequiredBy — drives countdown / overdue badge
//   • primaryAction — the SPECIFIC action that opens a flow
//
// Design constraints (per Phase 6.2 review):
//   • This is NOT an alerts feed. Every item demands a decision.
//   • Max 5 items (engine enforces). The section is finite by design.
//   • Mobile-first: each item is a single card, one-tap to act.
//   • When the engine returns 0 items, the section is hidden entirely
//     (no "all clear" empty state — that's noise, not value).

import { useNavigate } from 'react-router-dom';
import { useFocusItems } from '../hooks/useFocusItems';
import type { FocusItem } from '../types';
import { Section, Body, Hint, Muted } from './ui';

export default function FocusSection() {
  const navigate = useNavigate();
  const items = useFocusItems();

  if (items.length === 0) return null;

  return (
    <Section
      label={`דורש החלטה · ${items.length}`}
      action={
        items.length >= 5 ? (
          <button
            onClick={() => navigate('/alerts')}
            className="text-tiny font-semibold text-mil-olive hover:text-mil-olive-dim"
          >
            עוד ←
          </button>
        ) : undefined
      }
    >
      <div className="space-y-2">
        {items.map((item) => (
          <FocusItemCard
            key={item.id}
            item={item}
            onAct={() => handlePrimaryAction(item, navigate)}
          />
        ))}
      </div>
    </Section>
  );
}

// ─── Single card ────────────────────────────────────────────────────

function FocusItemCard({
  item,
  onAct,
}: {
  item: FocusItem;
  onAct: () => void;
}) {
  const tone = severityTone(item.severity);
  const urgency = urgencyLabel(item.decisionRequiredBy);

  return (
    <button
      type="button"
      onClick={onAct}
      className={`w-full text-right ${tone.bg} border ${tone.border} rounded-xl-soft hover:shadow-card transition-all duration-200 ease-out-soft p-3.5`}
    >
      {/* Top row: severity dot + urgency timestamp */}
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${tone.dot} flex-shrink-0 mt-1`} aria-hidden />
        {urgency && (
          <Hint className={`tabular-nums ${tone.text}`}>{urgency}</Hint>
        )}
        <Hint className="mr-auto text-mil-olive-dim font-semibold">
          {item.primaryAction.label} ←
        </Hint>
      </div>

      {/* Decision prompt — phrased as a question */}
      <Body className="font-semibold leading-snug text-sm">
        {item.decisionPrompt}
      </Body>

      {/* Context — one line of "why now" */}
      {item.context && (
        <Muted className="block mt-1 text-tiny leading-snug">{item.context}</Muted>
      )}
    </button>
  );
}

// ─── Tone helpers ───────────────────────────────────────────────────

function severityTone(severity: FocusItem['severity']) {
  if (severity === 'critical') {
    return {
      bg: 'bg-mil-alert-bg',
      border: 'border-mil-alert-border',
      dot: 'bg-mil-alert',
      text: 'text-mil-alert',
    };
  }
  if (severity === 'warning') {
    return {
      bg: 'bg-mil-warn-bg',
      border: 'border-mil-warn-border',
      dot: 'bg-mil-warn',
      text: 'text-mil-warn',
    };
  }
  return {
    bg: 'bg-mil-card',
    border: 'border-mil-border',
    dot: 'bg-mil-info',
    text: 'text-mil-info',
  };
}

function urgencyLabel(decisionRequiredByIso: string): string | null {
  const targetMs = Date.parse(decisionRequiredByIso);
  if (Number.isNaN(targetMs)) return null;
  const diffMs = targetMs - Date.now();
  const absHours = Math.abs(diffMs / 3_600_000);

  if (diffMs < 0) {
    // Overdue — surface prominently.
    if (absHours < 1) return 'איחור';
    if (absHours < 24) return `איחור ${Math.round(absHours)} שעות`;
    return `איחור ${Math.round(absHours / 24)} ימים`;
  }
  if (absHours < 1) return 'עכשיו';
  if (absHours < 24) return `בעוד ${Math.round(absHours)} שעות`;
  return `בעוד ${Math.round(absHours / 24)} ימים`;
}

// ─── Primary action routing ─────────────────────────────────────────
//
// Each FocusItem.primaryAction has either `href` (navigate) or
// `command` (open a Sheet/Modal). Commands are dispatched here.
// In Phase 6.2.b-1 we route HREF-style only — Sheet commands wire in
// 6.2.b-2 when the Alerts hierarchy lands its action dispatcher.

function handlePrimaryAction(
  item: FocusItem,
  navigate: ReturnType<typeof useNavigate>,
): void {
  const { primaryAction } = item;
  if (primaryAction.href) {
    navigate(primaryAction.href);
    return;
  }
  // Command fallback — navigate to a reasonable surface for now.
  // Phase 6.2.b-2 replaces this with proper Sheet opening.
  if (primaryAction.command === 'define-coverage') navigate('/coverage');
  else if (primaryAction.command === 'open-staffing') navigate(item.source.kind === 'mission' ? `/mission/${item.source.id}` : '/missions');
  else if (primaryAction.command === 'open-approve-leave') navigate('/leaves');
  else if (primaryAction.command === 'open-resolve-gap') navigate('/rasap');
  else if (primaryAction.command === 'open-close-escalation') navigate('/alerts');
  else if (primaryAction.command === 'open-recall-followup') navigate('/coverage');
  else if (primaryAction.command === 'open-replace') navigate('/missions');
  else navigate('/alerts');
}
