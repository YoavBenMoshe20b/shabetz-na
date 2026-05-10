import type { ShiftWarning } from '../types';

const icons: Record<ShiftWarning['type'], string> = {
  overlap:              '⚠',
  missingRole:          '✕',
  insufficientRest:     '◑',
  unavailable:          '⊘',
  onLeave:              '⊖',
  understaffed:         '↓',
  unfairDistribution:   '⚖',
  classViolation:       '⊠',
  commanderMissing:     '★',
  medicMissing:         '✚',
  confusionViolation:   '◌',
  impossibleConstraint: '✖',
  conflictMission:      '⊗',
};

export default function WarningBadge({ warning }: { warning: ShiftWarning }) {
  return (
    <div className="flex items-start gap-1.5 text-xs text-mil-alert bg-mil-alert-bg border border-mil-alert/30 rounded px-2 py-1 mt-1">
      <span className="font-bold mt-px">{icons[warning.type]}</span>
      <span>{warning.message}</span>
    </div>
  );
}
