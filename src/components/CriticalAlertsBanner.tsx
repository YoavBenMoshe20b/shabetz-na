// CriticalAlertsBanner — top-of-dashboard critical alerts.
//
// Per the alerts-hierarchy principles for "הפלוגה שלי":
//   • critical → visible immediately, ALWAYS, breaks through QuietMode.
//   • medium / low → live in the alerts center (AlertsSheet), not here.
//
// This component fetches the company's alerts, surfaces ONLY criticals,
// each with a direct CTA. When there are no criticals, it renders
// nothing (no "all clear" noise — same finite-by-design rule as Focus).
//
// Distinct from FocusSection:
//   • Focus = decisions the operator must make (with a question).
//   • CriticalAlertsBanner = events that have already happened and need
//     immediate awareness (escalation active, manpower shortfall today,
//     critical override). Each maps to a SPECIFIC drill-in action.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { isPlatoonLeadership } from '../utils/permissions';
import { alertsApi } from '../api';
import { Body, Hint } from './ui';
import type { Alert } from '../types';

const AGGREGATED_REFRESH_MS = 30_000;

export default function CriticalAlertsBanner() {
  const navigate = useNavigate();
  const { currentUser, currentRole } = useApp();
  const [criticals, setCriticals] = useState<Alert[]>([]);

  useEffect(() => {
    if (!currentUser?.companyId) return;
    let cancelled = false;
    const isPlatoon =
      isPlatoonLeadership(currentRole) &&
      currentRole !== 'companyCommander' &&
      currentRole !== 'deputyCompanyCommander';
    const load = () => {
      alertsApi
        .listForCompany({
          companyId: currentUser.companyId!,
          platoonId: isPlatoon ? currentUser.commandedPlatoonId : undefined,
        })
        .then((list) => {
          if (cancelled) return;
          setCriticals(list.filter((a) => a.severity === 'critical'));
        });
    };
    load();
    const id = window.setInterval(load, AGGREGATED_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [currentUser, currentRole]);

  if (criticals.length === 0) return null;

  return (
    <div className="space-y-2">
      {criticals.map((a) => (
        <button
          key={a.id}
          onClick={() => {
            if (a.actionHref) navigate(a.actionHref);
          }}
          className="w-full text-right bg-mil-alert-bg border border-mil-alert-border rounded-xl-soft hover:shadow-card transition-all duration-200 ease-out-soft p-3.5"
        >
          <div className="flex items-baseline gap-2 mb-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full bg-mil-alert flex-shrink-0 mt-1"
              aria-hidden
            />
            <Hint className="font-semibold text-mil-alert tabular-nums">
              קריטי
            </Hint>
            {a.suggestedAction && (
              <Hint className="mr-auto text-mil-alert font-semibold">
                {a.suggestedAction} ←
              </Hint>
            )}
          </div>
          <Body className="font-semibold leading-snug text-sm">{a.title}</Body>
          {a.message && (
            <Hint className="block mt-1 text-mil-muted leading-snug">
              {a.message}
            </Hint>
          )}
        </button>
      ))}
    </div>
  );
}
