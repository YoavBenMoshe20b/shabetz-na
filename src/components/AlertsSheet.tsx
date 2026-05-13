// AlertsSheet — quick-pop notification surface.
//
// Mounted from a dashboard icon (bell + badge). Shows current alerts
// sorted by severity. Tapping a row navigates to the relevant deep
// link via Alert.actionHref.
//
// This is a *view* — closing it doesn't dismiss alerts. Closure happens
// when the underlying condition resolves (mission staffed, escalation
// closed, manpower restored).

import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, Body, Hint, EmptyState } from './ui';
import { useApp } from '../context/AppContext';
import { isPlatoonLeadership } from '../utils/permissions';
import { alertsApi } from '../api';
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
  // Cache by companyId+platoonId so re-opening doesn't flash a skeleton.
  // `null` means "never fetched"; an empty array means "fetched, empty".
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const loading = alerts === null && open;

  useEffect(() => {
    if (!open || !currentUser?.companyId) return;
    let cancelled = false;
    const isPlatoon = isPlatoonLeadership(currentRole) && currentRole !== 'companyCommander' && currentRole !== 'deputyCompanyCommander';
    alertsApi.listForCompany({
      companyId: currentUser.companyId,
      platoonId: isPlatoon ? currentUser.commandedPlatoonId : undefined,
    }).then((list) => { if (!cancelled) setAlerts(list); });
    return () => { cancelled = true; };
  }, [open, currentUser, currentRole]);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, Alert[]>();
    for (const a of alerts ?? []) {
      const day = a.occurredAt.slice(0, 10);
      const arr = map.get(day) ?? [];
      arr.push(a);
      map.set(day, arr);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [alerts]);

  const list = alerts ?? [];

  return (
    <Sheet open={open} onClose={onClose} title="התראות" subtitle={list.length > 0 ? `${list.length} פעילות` : undefined}>
      <div className="px-5 py-5">
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
          <div className="space-y-5">
            {groupedByDay.map(([day, items]) => (
              <div key={day}>
                <p className="text-xxs font-semibold tracking-wide uppercase text-mil-muted px-1 mb-2">
                  {formatGroupDay(day)}
                </p>
                <div className="space-y-2">
                  {items.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        onClose();
                        if (a.actionHref) navigate(a.actionHref);
                      }}
                      className="w-full text-right bg-mil-card border border-mil-border rounded-xl-soft shadow-card hover:shadow-card-hover hover:border-mil-border-strong transition-all duration-200 ease-out-soft px-4 py-3.5"
                    >
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 text-xxs font-semibold px-2 py-0.5 rounded-md border ${SEV_TONE[a.severity].tag}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${SEV_TONE[a.severity].dot}`} aria-hidden />
                          {SEV_LABEL[a.severity]}
                        </span>
                        <span className="text-xxs font-semibold tracking-wide text-mil-muted">{KIND_LABEL[a.kind]}</span>
                      </div>
                      <Body className="font-semibold leading-tight mt-2">{a.title}</Body>
                      {a.message && <Hint className="mt-1 text-mil-muted">{a.message}</Hint>}
                      {a.suggestedAction && (
                        <p className="mt-2 text-tiny font-semibold text-mil-olive">{a.suggestedAction} ←</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function formatGroupDay(dayIso: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dayIso === today) return 'היום';
  if (dayIso === y)     return 'אתמול';
  return dayIso;
}
