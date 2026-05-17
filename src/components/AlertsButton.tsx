// AlertsButton — bell icon for the alerts center.
//
// QuietMode REMOVED (§13). The bell now shows the full count of alerts
// without any user-controlled muting. Critical alerts are tinted red;
// non-critical use warn-yellow.
//
// Tapping opens AlertsSheet (full grouped view).

import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { isPlatoonLeadership } from '../utils/permissions';
import { alertsApi } from '../api';
import AlertsSheet from './AlertsSheet';

export default function AlertsButton({ className = '' }: { className?: string }) {
  const { currentUser, currentRole } = useApp();
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
  const displayCount = count.total;
  const showBadge = displayCount > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`relative inline-flex items-center justify-center w-10 h-10 rounded-xl-soft border transition-all duration-200 ease-out-soft ${
          hasCritical
            ? 'bg-mil-alert-bg border-mil-alert-border text-mil-alert hover:shadow-card'
            : 'bg-mil-card border-mil-border text-mil-muted hover:text-mil-text hover:border-mil-border-strong'
        } ${className}`}
        aria-label={`התראות${displayCount > 0 ? ` · ${displayCount}` : ''}`}
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
      </button>
      {open && <AlertsSheet open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
