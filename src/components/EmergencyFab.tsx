// EmergencyFab — the "הקפצה" floating affordance.
//
// Mounted globally for users who can declare an escalation.
//
// ROLE COVERAGE (audit: Phase 7.3 UI consistency pass)
// canDeclareEscalation grants 'escalation.declare' to
// COMPANY_LEADERSHIP_TOKENS only (CC + סמ״פ). This is operationally
// correct for a COMPANY-wide הקפצה — מ״מ-level events are platoon-
// scope and would need a separate "platoon contact / casualty" path
// that the current UI does not yet model. Delegated operators (with
// a CommandDelegation granting 'escalation.declare') also see the
// FAB through the same gate.
//
// Z-INDEX
// FAB is z-35 — above the BottomNav (z-30) and the sticky page Header
// (z-30), below any open Sheet (z-50). Audit confirmed both z-30
// surfaces were ambiguous; z-35 makes the FAB unambiguously the
// top-most fixed control until a sheet opens.
//
// Two modes:
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
        // Position math:
        //   FAB sits above the BottomNav (~70px tall + bottom-4 = ~86px
        //   from edge, plus safe-area-inset-bottom on iOS ~34px = ~120px).
        //   We pin at 7rem + safe-area, giving a stable 16-24px gap.
        style={{ bottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
        className={`
          fixed right-5 z-[35]
          h-14 px-4 sm:px-5 rounded-full shadow-pop
          font-extrabold text-sm tracking-wide
          flex items-center gap-2 max-w-[min(80vw,260px)]
          transition-all duration-200 ease-out-soft active:scale-95
          ${hasActive
            ? 'bg-mil-alert text-white hover:bg-mil-alert/90 ring-2 ring-mil-alert/30'
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
        <span className="text-base leading-none shrink-0" aria-hidden>{hasActive ? '🛑' : '🚨'}</span>
        <span className="truncate">{hasActive ? `סיים אירוע (${active.length})` : 'הקפצה'}</span>
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
