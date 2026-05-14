// EscalationActiveBanner — slim global indicator when an escalation is
// active and the viewer's audience covers them.
//
// Phase 5 redesign: was a multi-line strip with two buttons that
// dominated the top of every screen. Now a single-line glyph + tap
// target that routes to /alerts (or /home for soldiers). Closing the
// event happens in /alerts (the operational center), not from chrome.

import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import type { EscalationEvent } from '../types';

function formatReportTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const today = new Date();
  if (d.getFullYear() === today.getFullYear()
   && d.getMonth() === today.getMonth()
   && d.getDate() === today.getDate()) {
    return `היום ${time}`;
  }
  const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${date} ${time}`;
}

export default function EscalationActiveBanner() {
  const navigate = useNavigate();
  const { activeEscalationsForViewer } = useApp();
  const active = activeEscalationsForViewer();
  if (active.length === 0) return null;

  // Show only the most-recently-opened active event. The /alerts page
  // surfaces the full queue when there are multiple.
  const ev: EscalationEvent = active[0];

  return (
    <button
      type="button"
      onClick={() => navigate('/alerts')}
      role="alert"
      className="w-full bg-mil-alert text-white px-4 py-2 sticky top-0 z-50 flex items-center gap-2.5 shadow-sticky"
      dir="rtl"
    >
      <span className="flex-shrink-0 relative">
        <span className="w-1.5 h-1.5 rounded-full bg-white block" />
        <span className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-white animate-ping opacity-70" />
      </span>
      <span className="text-tiny font-bold truncate min-w-0 flex-1 text-right">
        הקפצה פעילה · {ev.reason} · התייצבות {formatReportTime(ev.reportTime)}
      </span>
      <span className="text-tiny font-semibold flex-shrink-0">פרטים ←</span>
    </button>
  );
}
