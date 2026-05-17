// OperationalTimelineStrip — the role-scoped timeline UI.
//
// A horizontal-scrolling band of compact event cards. Each card is
// severity-toned (info / warn / alert / critical) and tappable —
// clicking routes to the event's `href`. The caller is responsible
// for passing a PRE-FILTERED list (selectTimelineFor) so role / scope
// discipline lives in one place.

import { useNavigate } from 'react-router-dom';
import type { TimelineEvent, TimelineSeverity } from '../utils/operationalTimeline';

interface Props {
  events: TimelineEvent[];
  /** Title for the strip section ("ציר הזמן המבצעי" / "המשמרת שלי" / …). */
  label?: string;
  /** Short Hebrew empty-state label. Default: "אין אירועים קרובים". */
  emptyLabel?: string;
  /** When true, shows a compact two-line layout (for home strips). */
  compact?: boolean;
}

export default function OperationalTimelineStrip({
  events, label, emptyLabel = 'אין אירועים קרובים', compact,
}: Props) {
  const navigate = useNavigate();

  if (events.length === 0) {
    return (
      <div className="bg-mil-card border border-mil-border rounded-2xl px-4 py-3">
        {label && <p className="text-xxs font-bold uppercase tracking-wide text-mil-muted mb-1">{label}</p>}
        <p className="text-tiny text-mil-muted">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <section dir="rtl">
      {label && (
        <p className="text-xxs font-bold uppercase tracking-wide text-mil-muted mb-2">
          {label}
          <span className="text-mil-ghost mx-1.5">·</span>
          <span className="tabular-nums font-semibold">{events.length}</span>
        </p>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
        {events.map((e) => (
          <EventCard
            key={e.id}
            event={e}
            compact={compact}
            onClick={() => e.href && navigate(e.href)}
          />
        ))}
      </div>
    </section>
  );
}

function EventCard({
  event, compact, onClick,
}: {
  event: TimelineEvent;
  compact?: boolean;
  onClick: () => void;
}) {
  const tone = toneFor(event.severity);
  const time = formatHHmm(event.atIso);
  return (
    <button
      onClick={onClick}
      className={`
        flex-shrink-0
        ${compact ? 'min-w-[180px] max-w-[220px]' : 'min-w-[220px] max-w-[280px]'}
        text-right rounded-2xl border px-3.5 py-2.5
        transition-colors hover:shadow-card
        ${tone}
      `}
    >
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-xxs font-bold tracking-wide uppercase">{time}</span>
        <span className="text-tiny opacity-70 font-semibold">{kindLabel(event.kind)}</span>
      </div>
      <p className="text-sm font-bold leading-snug line-clamp-2">{event.title}</p>
      {!compact && event.description && (
        <p className="text-tiny opacity-80 leading-snug mt-1 line-clamp-2">{event.description}</p>
      )}
    </button>
  );
}

function toneFor(s: TimelineSeverity): string {
  switch (s) {
    case 'critical':
      return 'bg-mil-alert-bg border-mil-alert text-mil-alert';
    case 'alert':
      return 'bg-mil-alert-bg/60 border-mil-alert/40 text-mil-alert';
    case 'warn':
      return 'bg-mil-warn-bg border-mil-warn text-mil-warn';
    case 'info':
    default:
      return 'bg-mil-card border-mil-border text-mil-text';
  }
}

function kindLabel(k: TimelineEvent['kind']): string {
  switch (k) {
    case 'next-shift':              return 'משמרת';
    case 'shift-end-now':           return 'סיום';
    case 'shift-handover':          return 'חילוף';
    case 'readiness-on':            return 'כוננות';
    case 'platoon-leaving-home':    return 'יציאה';
    case 'platoon-returning':       return 'חזרה';
    case 'publish-deadline':        return 'פרסום';
    case 'staffing-pressure':       return 'איוש';
    case 'concurrent-critical':     return 'קריטי';
    case 'leave-conflict-imminent': return 'התנגשות';
  }
}

function formatHHmm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
