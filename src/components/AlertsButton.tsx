// AlertsButton — bell icon for the alerts center.
//
// Visual rules (per Phase 6.2.b hierarchy):
//   • Badge ALWAYS counts critical separately from total.
//   • In QuietMode: bell shows a small "Z" indicator AND the badge
//     reflects critical-only count. Non-critical alerts are silent on
//     the dashboard layer until the operator opens the sheet.
//   • Tapping opens AlertsSheet (full grouped view).

import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { isPlatoonLeadership } from '../utils/permissions';
import { alertsApi } from '../api';
import { useQuietMode } from '../hooks/useQuietMode';
import AlertsSheet from './AlertsSheet';

export default function AlertsButton({ className = '' }: { className?: string }) {
  const { currentUser, currentRole } = useApp();
  const { isActive: quietActive } = useQuietMode();
  const [count, setCount] = useState({ critical: 0, total: 0 });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!currentUser?.companyId) return;
    let cancelled = false;
    const isPlatoon =
      isPlatoonLeadership(currentRole) &&
      currentRole !== 'companyCommander' &&
      currentRole !== 'deputyCompanyCommander';
    alertsApi.listForCompany({
      companyId: currentUser.companyId,
      platoonId: isPlatoon ? currentUser.commandedPlatoonId : undefined,
    }).then((list) => {
      if (cancelled) return;
      setCount({
        critical: list.filter((a) => a.severity === 'critical').length,
        total: list.length,
      });
    });
    return () => { cancelled = true; };
  }, [currentUser, currentRole, open]);

  const hasCritical = count.critical > 0;
  // In QuietMode the badge only reflects critical. Non-critical alerts
  // exist but should not visually nag the operator on the dashboard.
  const displayCount = quietActive ? count.critical : count.total;
  const showBadge = displayCount > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`relative inline-flex items-center justify-center w-10 h-10 rounded-xl-soft border transition-all duration-200 ease-out-soft ${
          hasCritical
            ? 'bg-mil-alert-bg border-mil-alert-border text-mil-alert hover:shadow-card'
            : quietActive
              ? 'bg-mil-card border-mil-border text-mil-muted opacity-70 hover:opacity-100'
              : 'bg-mil-card border-mil-border text-mil-muted hover:text-mil-text hover:border-mil-border-strong'
        } ${className}`}
        aria-label={`התראות${displayCount > 0 ? ` · ${displayCount}` : ''}${quietActive ? ' · מצב שקט' : ''}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9 a6 6 0 0 1 12 0 v5 l2 3 H4 l2-3 Z" />
          <path d="M10 20 a2 2 0 0 0 4 0" />
        </svg>
        {showBadge && (
          <span
            className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ring-2 ring-mil-bg ${
              hasCritical ? 'bg-mil-alert text-white' : 'bg-mil-warn text-white'
            }`}
            aria-hidden
          >
            {displayCount > 99 ? '99+' : displayCount}
          </span>
        )}
        {quietActive && !hasCritical && (
          <span
            className="absolute -bottom-1 -left-1 w-3.5 h-3.5 rounded-full bg-mil-info text-white text-[8px] font-bold flex items-center justify-center ring-2 ring-mil-bg"
            aria-hidden
            title="מצב שקט פעיל"
          >
            Z
          </span>
        )}
      </button>
      {open && <AlertsSheet open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
