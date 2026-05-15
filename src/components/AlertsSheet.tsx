// AlertsSheet — alerts center surface (the "low/medium" home).
//
// Per the alerts hierarchy in Phase 6.2.b:
//   • Critical alerts: shown individually at the top, NEVER aggregated.
//     Each gets its own row with a direct CTA.
//   • Warning / info alerts: aggregated by (kind + platoonId) so multi-
//     target spam ("3 platoons under floor") collapses to one row.
//   • QuietMode active: a banner explains how many alerts are muted +
//     "ביטול מצב שקט" inline.
//
// This is the "center" — opened from the bell. Closing doesn't dismiss
// alerts. They resolve only when the underlying condition clears.

import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, Body, Hint, EmptyState } from './ui';
import { useApp } from '../context/AppContext';
import { isPlatoonLeadership } from '../utils/permissions';
import { alertsApi } from '../api';
import { groupAlerts, type AlertGroup } from '../utils/alerts/grouping';
import { formatRemaining } from '../utils/alerts/quietMode';
import { useQuietMode } from '../hooks/useQuietMode';
import type { Alert, AlertSeverity, AlertKind } from '../types';

const SEV_LABEL: Record<AlertSeverity, string> = {
  critical: 'קריטי',
  warning:  'דורש תשומת לב',
  info:     'מידע',
};
const SEV_TONE: Record<AlertSeverity, { tag: string; dot: string }> = {
  critical: { tag: 'text-mil-alert bg-mil-alert-bg border-mil-alert-border', dot: 'bg-mil-alert' },
  warning:  { tag: 'text-mil-warn  bg-mil-warn-bg  border-mil-warn-border',  dot: 'bg-mil-warn' },
  info:     { tag: 'text-mil-info  bg-mil-info-bg  border-mil-info-border',  dot: 'bg-mil-info' },
};

const KIND_LABEL: Record<AlertKind, string> = {
  'escalation-active':         'הקפצה',
  'mission-unstaffed':         'משימה ללא איוש',
  'override-open':             'חריגה פתוחה',
  'manpower-shortfall':        'חוסר בכ״א',
  'announcement-operational':  'הודעה מבצעית',
};

interface AlertsSheetProps {
  open: boolean;
  onClose: () => void;
}

export default function AlertsSheet({ open, onClose }: AlertsSheetProps) {
  const navigate = useNavigate();
  const { currentUser, currentRole } = useApp();
  const { isActive, remainingMinutes, deactivate } = useQuietMode();

  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const loading = alerts === null && open;

  useEffect(() => {
    if (!open || !currentUser?.companyId) return;
    let cancelled = false;
    const isPlatoon =
      isPlatoonLeadership(currentRole) &&
      currentRole !== 'companyCommander' &&
      currentRole !== 'deputyCompanyCommander';
    alertsApi
      .listForCompany({
        companyId: currentUser.companyId,
        platoonId: isPlatoon ? currentUser.commandedPlatoonId : undefined,
      })
      .then((list) => {
        if (!cancelled) setAlerts(list);
      });
    return () => {
      cancelled = true;
    };
  }, [open, currentUser, currentRole]);

  const list = useMemo(() => alerts ?? [], [alerts]);

  const groups = useMemo(() => groupAlerts(list), [list]);
  const critical = useMemo(
    () => groups.filter((g) => g.severity === 'critical'),
    [groups],
  );
  const nonCritical = useMemo(
    () => groups.filter((g) => g.severity !== 'critical'),
    [groups],
  );
  // When QuietMode is active, the non-critical alerts are "muted" — the
  // operator sees them only when they explicitly open this sheet. The
  // count is just len(non-critical).
  const mutedCount = useMemo(
    () => (isActive ? list.filter((a) => a.severity !== 'critical').length : 0),
    [list, isActive],
  );

  const subtitle =
    list.length === 0
      ? undefined
      : critical.length > 0
        ? `${critical.length} קריטי · ${list.length} סה״כ`
        : `${list.length} פעילות`;

  return (
    <Sheet open={open} onClose={onClose} title="מרכז התראות" subtitle={subtitle}>
      <div className="px-5 py-5 space-y-5">
        {isActive && (
          <QuietModeBanner
            remaining={formatRemaining(remainingMinutes)}
            mutedCount={mutedCount}
            onCancel={deactivate}
          />
        )}

        {loading ? (
          <div className="space-y-2">
            <div className="h-16 rounded-xl-soft bg-mil-bg-alt animate-pulse-soft" />
            <div className="h-16 rounded-xl-soft bg-mil-bg-alt animate-pulse-soft" />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            title="הכל רגוע"
            hint="אין התראות פעילות כרגע. ההתראות מופיעות אוטומטית כשמשהו דורש תשומת לב מבצעית."
          />
        ) : (
          <>
            {critical.length > 0 && (
              <GroupSection
                heading="קריטי — דורש תגובה מיידית"
                tone="alert"
                groups={critical}
                onAct={(g) => {
                  onClose();
                  if (g.actionHref) navigate(g.actionHref);
                }}
              />
            )}
            {nonCritical.length > 0 && (
              <GroupSection
                heading="מרכז התראות"
                tone="muted"
                groups={nonCritical}
                onAct={(g) => {
                  // Aggregated groups have no actionHref — they expand
                  // inline. Solo groups deep-link.
                  if (g.actionHref) {
                    onClose();
                    navigate(g.actionHref);
                  }
                }}
              />
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

// ─── Sections ────────────────────────────────────────────────────────

function GroupSection({
  heading,
  tone,
  groups,
  onAct,
}: {
  heading: string;
  tone: 'alert' | 'muted';
  groups: AlertGroup[];
  onAct: (g: AlertGroup) => void;
}) {
  return (
    <div>
      <p
        className={`text-xxs font-semibold tracking-wide uppercase px-1 mb-2 ${
          tone === 'alert' ? 'text-mil-alert' : 'text-mil-muted'
        }`}
      >
        {heading}
      </p>
      <div className="space-y-2">
        {groups.map((g) => (
          <GroupRow key={g.key} group={g} onAct={() => onAct(g)} />
        ))}
      </div>
    </div>
  );
}

function GroupRow({
  group,
  onAct,
}: {
  group: AlertGroup;
  onAct: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isAggregated = group.count > 1;

  return (
    <div className="bg-mil-card border border-mil-border rounded-xl-soft shadow-card hover:shadow-card-hover hover:border-mil-border-strong transition-all duration-200 ease-out-soft overflow-hidden">
      <button
        onClick={() => (isAggregated ? setExpanded((v) => !v) : onAct())}
        className="w-full text-right px-4 py-3.5"
      >
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 text-xxs font-semibold px-2 py-0.5 rounded-md border ${SEV_TONE[group.severity].tag}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${SEV_TONE[group.severity].dot}`}
              aria-hidden
            />
            {SEV_LABEL[group.severity]}
          </span>
          <span className="text-xxs font-semibold tracking-wide text-mil-muted">
            {KIND_LABEL[group.kind]}
          </span>
          {isAggregated && (
            <span className="mr-auto text-xxs font-semibold text-mil-muted tabular-nums">
              {expanded ? 'הסתר' : `הצג ${group.count}`} ←
            </span>
          )}
        </div>
        <Body className="font-semibold leading-tight mt-2">{group.title}</Body>
        {group.message && (
          <Hint className="mt-1 text-mil-muted">{group.message}</Hint>
        )}
        {!isAggregated && group.suggestedAction && (
          <p className="mt-2 text-tiny font-semibold text-mil-olive">
            {group.suggestedAction} ←
          </p>
        )}
      </button>

      {isAggregated && expanded && (
        <div className="border-t border-mil-border bg-mil-bg-alt px-4 py-2 space-y-1.5">
          {group.members.map((m) => (
            <button
              key={m.id}
              onClick={onAct}
              className="w-full text-right px-2 py-1.5 rounded-md hover:bg-mil-card transition-colors"
            >
              <Body className="text-sm font-medium leading-tight">{m.title}</Body>
              {m.message && (
                <Hint className="block mt-0.5 text-mil-muted leading-snug">
                  {m.message}
                </Hint>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function QuietModeBanner({
  remaining,
  mutedCount,
  onCancel,
}: {
  remaining: string;
  mutedCount: number;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl-soft bg-mil-info-bg border border-mil-info-border">
      <span
        className="w-2 h-2 rounded-full bg-mil-info flex-shrink-0"
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <Body className="font-semibold text-sm leading-tight">
          מצב שקט פעיל · נותרו {remaining}
        </Body>
        <Hint className="block mt-0.5 text-mil-muted">
          {mutedCount > 0
            ? `${mutedCount} התראות לא קריטיות מושתקות`
            : 'אין התראות לא קריטיות כרגע'}
        </Hint>
      </div>
      <button
        onClick={onCancel}
        className="px-3 py-1.5 rounded-md bg-mil-card border border-mil-info-border text-mil-info text-tiny font-semibold whitespace-nowrap"
      >
        ביטול
      </button>
    </div>
  );
}
