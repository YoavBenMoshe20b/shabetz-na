// TimelineCard — shared between CC + PC dashboards.
//
// Renders a single operational event from buildPlatoonTimeline as a card
// with an accent dot, eyebrow timestamp, title, optional detail, and an
// inline CTA when one is provided.

import { Body, Muted } from '../../../components/ui';
import type { OpsEvent } from '../../../utils/timeline';

export function TimelineCard({ event, onCta }: { event: OpsEvent; onCta: () => void }) {
  const dot =
    event.severity === 'alert' ? 'bg-mil-alert' :
    event.severity === 'warn'  ? 'bg-mil-warn'  :
    'bg-mil-olive';
  const labelTone =
    event.severity === 'alert' ? 'text-mil-alert' :
    event.severity === 'warn'  ? 'text-mil-warn'  :
    'text-mil-olive';

  return (
    <div className="bg-mil-card border border-mil-border rounded-xl-soft shadow-card hover:shadow-card-hover transition-shadow duration-200 ease-out-soft">
      <div className="px-4 py-3.5 flex items-start gap-3">
        <span className={`w-2 h-2 rounded-full ${dot} flex-shrink-0 mt-2 ring-4 ring-mil-card`} aria-hidden />
        <div className="flex-1 min-w-0">
          <p className={`text-xxs font-semibold tracking-wide uppercase ${labelTone}`}>{event.whenLabel}</p>
          <Body className="font-semibold mt-1 leading-tight">{event.title}</Body>
          {event.detail && <Muted className="mt-1">{event.detail}</Muted>}
          {event.ctaLabel && (
            <button
              onClick={onCta}
              className="mt-2.5 text-tiny font-semibold text-mil-olive hover:text-mil-olive-dim transition-colors"
            >
              {event.ctaLabel} ←
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
