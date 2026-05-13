// EscalationActiveBanner — global banner rendered when an escalation is
// active and the viewer's audience covers them.
//
// Distinct from EmergencyBanner (which surfaces operational concerns like
// "platoon below minimum"). This is the escalation channel — call-up.
//
// Renders at the same z-index as EmergencyBanner. When both are active,
// EscalationActiveBanner wins (call-up > steady-state alert).

import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { isCompanyLeadership } from '../utils/permissions';
import type { EscalationEvent } from '../types';

function formatReportTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  // Show "היום HH:MM" when the date is today
  const today = new Date();
  if (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()) {
    return `היום · ${time}`;
  }
  return `${date} · ${time}`;
}

export default function EscalationActiveBanner() {
  const navigate = useNavigate();
  const { activeEscalationsForViewer, currentRole, closeEscalation } = useApp();
  const active = activeEscalationsForViewer();
  if (active.length === 0) return null;

  // Show only the most-recently-opened active event
  const ev: EscalationEvent = active[0];
  const canClose = isCompanyLeadership(currentRole);

  return (
    <div
      role="alert"
      className="bg-mil-alert-bg/95 backdrop-blur-glass border-b border-mil-alert-border px-5 py-3 sticky top-0 z-50 shadow-sticky"
      dir="rtl"
    >
      <div className="max-w-xl mx-auto flex items-start gap-3">
        {/* Pulsing indicator */}
        <span className="flex-shrink-0 mt-1 relative">
          <span className="w-2 h-2 rounded-full bg-mil-alert block" />
          <span className="absolute inset-0 w-2 h-2 rounded-full bg-mil-alert animate-ping opacity-60" />
        </span>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-mil-alert leading-snug">
            הקפצה · {ev.reason}
          </p>
          <p className="text-tiny text-mil-text mt-0.5 leading-snug">
            התייצבות {formatReportTime(ev.reportTime)}
            {ev.location && ` · ${ev.location}`}
          </p>
        </div>

        {canClose && (
          <button
            onClick={() => {
              if (window.confirm('לסגור את ההקפצה?')) {
                const reason = window.prompt('סיבת סגירה (אופציונלי)') ?? undefined;
                closeEscalation(ev.id, reason);
              }
            }}
            className="text-tiny font-semibold bg-mil-card border border-mil-alert-border text-mil-alert hover:bg-mil-alert hover:text-white hover:border-mil-alert px-3 py-1.5 rounded-lg flex-shrink-0 transition-all duration-200 ease-out-soft"
          >
            סגור
          </button>
        )}
        <button
          onClick={() => navigate('/home')}
          className="text-tiny font-semibold bg-mil-alert text-white hover:brightness-110 px-3 py-1.5 rounded-lg flex-shrink-0 transition-all duration-200 ease-out-soft shadow-card"
        >
          פרטים ←
        </button>
      </div>
    </div>
  );
}
