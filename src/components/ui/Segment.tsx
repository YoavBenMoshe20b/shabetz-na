// Segmented control — the canonical option-toggle.
//
// Reused for: calendar day/week/month, coverage today/week, mission
// status toggles, sheet form-option groups. One visual language across
// every "pick one of N" interaction. Two density variants:
//
//   • md — the default. 40 px high, fits in a header.
//   • sm — compact, for inside dense rows.
//
// Active state uses the indigo tint background + accent text so it
// reads as the selected operational option without looking like a
// filled button.

import type { ReactNode } from 'react';

interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

interface SegmentProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: SegmentOption<T>[];
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  className?: string;
}

export function Segment<T extends string>({
  value, onChange, options, size = 'md', fullWidth = false, className = '',
}: SegmentProps<T>) {
  const pad = size === 'sm' ? 'px-3 py-1.5 text-tiny' : 'px-4 py-2 text-sm';
  return (
    <div
      className={`inline-flex items-center gap-1 bg-mil-bg-alt border border-mil-border rounded-xl-soft p-1 ${fullWidth ? 'w-full' : ''} ${className}`}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={[
              fullWidth ? 'flex-1' : '',
              pad,
              'rounded-lg font-semibold whitespace-nowrap inline-flex items-center justify-center gap-1.5',
              'transition-all duration-200 ease-out-soft',
              active
                ? 'bg-mil-card text-mil-olive shadow-card border border-mil-border/80'
                : 'text-mil-muted hover:text-mil-text border border-transparent',
            ].join(' ')}
          >
            <span>{opt.label}</span>
            {opt.count != null && (
              <span className={`tabular-nums text-xxs px-1 rounded ${active ? 'text-mil-olive' : 'text-mil-ghost'}`}>
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Lightweight chip toggle — for rapid yes/no or filter chips that don't
// need a full segmented control. Single-state, no container.
export function Chip({
  active, onClick, children, tone = 'default',
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  tone?: 'default' | 'accent';
}) {
  const tones = {
    default: active
      ? 'bg-mil-card text-mil-text border-mil-border-strong shadow-card'
      : 'bg-mil-bg-alt text-mil-muted border-mil-border hover:text-mil-text hover:border-mil-border-strong',
    accent: active
      ? 'bg-mil-olive-bg text-mil-olive border-mil-olive/30 shadow-card'
      : 'bg-mil-bg-alt text-mil-muted border-mil-border hover:text-mil-text hover:border-mil-border-strong',
  };
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-tiny font-semibold border transition-all duration-200 ease-out-soft ${tones[tone]}`}
    >
      {children}
    </button>
  );
}
