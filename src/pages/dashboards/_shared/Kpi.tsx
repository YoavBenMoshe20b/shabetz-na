// Kpi — compact tile used in CC + Soldier + Coverage heroes.
//
// Premium light language: large tabular number, small uppercase label,
// muted tone when value is zero.

import { Hint } from '../../../components/ui';

interface KpiProps {
  label: string;
  value: number;
  tone: 'success' | 'sand' | 'rest' | 'neutral';
  muted?: boolean;
}

export function Kpi({ label, value, tone, muted = false }: KpiProps) {
  const toneClass =
    tone === 'success' ? 'text-mil-success' :
    tone === 'sand'    ? 'text-mil-sand'    :
    tone === 'rest'    ? 'text-mil-rest'    :
    'text-mil-text';
  return (
    <div className="bg-mil-bg-alt/70 border border-mil-border/70 rounded-xl-soft px-3.5 py-3">
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-bold tabular-nums tracking-tightish ${muted ? 'text-mil-ghost' : toneClass}`}>
          {value}
        </span>
      </div>
      <Hint className="text-tiny font-medium text-mil-muted mt-0.5">{label}</Hint>
    </div>
  );
}
