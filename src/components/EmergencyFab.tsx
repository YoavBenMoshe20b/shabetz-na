// EmergencyFab — the "הקפצה" floating affordance.
//
// Mounted globally for users who can declare an escalation (PC / CC,
// guarded by canDeclareEscalation). Visually red and bottom-right
// (RTL: visual right via `right-5`). Two modes:
//
//   1. IDLE — bright red "הקפצה" button. Click opens the declare sheet.
//   2. ACTIVE — there's at least one open EscalationEvent for the
//      viewer's company. The button switches to "סיים אירוע" with a
//      pulsing badge so the operator knows the company is still in
//      emergency state. Click opens the end-event sheet.
//
// The fab uses the EXISTING EscalationEvent infrastructure
// (declareEscalation / closeEscalation / activeEscalationsForViewer
// in AppContext). No parallel state introduced.

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { canDeclareEscalation } from '../utils/permissions';
import DeclareEmergencySheet from './DeclareEmergencySheet';
import EndEmergencySheet from './EndEmergencySheet';

export default function EmergencyFab() {
  const { currentUser, delegations, activeEscalationsForViewer } = useApp();
  const [declareOpen, setDeclareOpen] = useState(false);
  const [endingId, setEndingId] = useState<string | null>(null);

  if (!currentUser) return null;
  if (!canDeclareEscalation(currentUser, delegations)) return null;

  const active = activeEscalationsForViewer();
  const hasActive = active.length > 0;

  return (
    <>
      <button
        onClick={() => {
          if (hasActive) setEndingId(active[0].id);
          else setDeclareOpen(true);
        }}
        aria-label={hasActive ? 'סיים אירוע הקפצה' : 'פתח אירוע הקפצה'}
        className={`
          fixed bottom-24 right-5 z-30 safe-area-bottom
          h-14 px-5 rounded-full shadow-pop
          font-extrabold text-sm tracking-wide
          flex items-center gap-2
          transition-all duration-200 ease-out-soft active:scale-95
          ${hasActive
            ? 'bg-mil-alert text-white hover:bg-mil-alert/90'
            : 'bg-mil-alert/95 text-white hover:bg-mil-alert shadow-[0_8px_24px_-4px_rgba(220,38,38,0.5)]'
          }
        `}
      >
        {hasActive && (
          <span className="relative flex h-2.5 w-2.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
          </span>
        )}
        <span className="text-base leading-none" aria-hidden>{hasActive ? '🛑' : '🚨'}</span>
        <span>{hasActive ? `סיים אירוע (${active.length})` : 'הקפצה'}</span>
      </button>

      {declareOpen && (
        <DeclareEmergencySheet
          open
          onClose={() => setDeclareOpen(false)}
        />
      )}

      {endingId && (
        <EndEmergencySheet
          open
          escalationId={endingId}
          onClose={() => setEndingId(null)}
        />
      )}
    </>
  );
}
