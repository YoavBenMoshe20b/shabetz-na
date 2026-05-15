// SlotOperationsSheet — Mission Operations Layer UI for a single slot.
//
// Opens from a slot row in MissionDetailPage. Lets the PC manipulate
// state that SURVIVES recompute:
//   • Lock soldiers (lockedSoldierIds) — protected from auto-rebalance
//   • Excuse soldiers until a cutoff (excusedUntil) — removed from the
//     eligible pool for THIS slot until that time
//   • Operational note (operationalNotes) — PC's context-prose for the
//     slot, visible to anyone reading the mission
//
// Reads + writes via AppContext.{slotOperationalState, toggleSlotSoldierLock,
// addSlotExcuse, removeSlotExcuse, setSlotOps}.

import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Sheet, Body, Muted, Hint, Button, Toast } from './ui';
import type { Soldier } from '../types';
import type { MaterializedSlot } from '../utils/materialize';

interface SlotOperationsSheetProps {
  open: boolean;
  onClose: () => void;
  slot: MaterializedSlot;
  /** Soldiers in the slot's owner platoon — pool for excuse picker. */
  candidatePool: Soldier[];
}

export default function SlotOperationsSheet({
  open, onClose, slot, candidatePool,
}: SlotOperationsSheetProps) {
  const {
    soldiers, slotOperationalState,
    toggleSlotSoldierLock, addSlotExcuse, removeSlotExcuse, setSlotOps,
  } = useApp();

  const ops = useMemo(
    () => slotOperationalState.find((s) => s.slotId === slot.id),
    [slotOperationalState, slot.id],
  );

  // The soldiers currently assigned to this slot (commander + roster).
  const assignedSoldiers = useMemo(() => {
    const ids = [...slot.assignedSoldierIds];
    if (slot.commanderSoldierId) ids.push(slot.commanderSoldierId);
    return ids
      .map((id) => soldiers.find((s) => s.id === id))
      .filter((s): s is Soldier => !!s);
  }, [slot, soldiers]);

  const lockedIds = ops?.lockedSoldierIds ?? [];
  const excuses = ops?.excusedUntil ?? [];

  // Picker state for "+ הוצא חייל"
  const [pickerSoldierId, setPickerSoldierId] = useState<string>('');
  const [pickerUntil, setPickerUntil] = useState<string>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 24);
    return d.toISOString().slice(0, 16); // datetime-local format
  });
  const [pickerReason, setPickerReason] = useState<string>('');
  const [noteDraft, setNoteDraft] = useState<string>(ops?.operationalNotes ?? '');
  const [noteSaved, setNoteSaved] = useState<string>('');

  const handleAddExcuse = () => {
    if (!pickerSoldierId || !pickerUntil) return;
    addSlotExcuse(slot.id, {
      soldierId: pickerSoldierId,
      untilIso: new Date(pickerUntil).toISOString(),
      reason: pickerReason.trim() || undefined,
    });
    setPickerSoldierId('');
    setPickerReason('');
  };

  const handleSaveNote = () => {
    setSlotOps(slot.id, { operationalNotes: noteDraft.trim() || undefined });
    setNoteSaved('הערה נשמרה');
    setTimeout(() => setNoteSaved(''), 2500);
  };

  // Sub-title for the Sheet header — slot's time range.
  const subtitle = (() => {
    const s = new Date(slot.start);
    const e = new Date(slot.end);
    const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${slot.missionName} · ${hhmm(s)}–${hhmm(e)}`;
  })();

  // Excuse picker — only show pool members not already excused on this
  // slot, to avoid no-op writes.
  const excusedSet = new Set(excuses.map((e) => e.soldierId));
  const excusablePool = candidatePool.filter((s) => !excusedSet.has(s.id));

  return (
    <Sheet open={open} onClose={onClose} title="ניהול תפעולי" subtitle={subtitle}>
      <div className="px-5 py-5 space-y-5">

        {/* Locked soldiers section */}
        <section>
          <Hint className="block uppercase tracking-wide font-bold text-mil-muted mb-2">
            נעילות
          </Hint>
          {assignedSoldiers.length === 0 ? (
            <Muted className="text-tiny">אין חיילים משובצים למשבצת זו עדיין.</Muted>
          ) : (
            <div className="bg-mil-card border border-mil-border rounded-xl-soft divide-y divide-mil-border overflow-hidden">
              {assignedSoldiers.map((s) => {
                const isLocked = lockedIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleSlotSoldierLock(slot.id, s.id)}
                    className="w-full text-right px-4 py-3 flex items-center gap-3 hover:bg-mil-card-warm/40 transition-colors"
                  >
                    <span
                      className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
                        isLocked
                          ? 'bg-mil-olive text-white'
                          : 'bg-mil-bg-alt border border-mil-border text-mil-muted'
                      }`}
                      aria-label={isLocked ? 'נעול' : 'לא נעול'}
                    >
                      {/* Lock glyph */}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="5" y="11" width="14" height="10" rx="2" />
                        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                      </svg>
                    </span>
                    <div className="flex-1 min-w-0 text-right">
                      <Body className="font-semibold leading-tight">{s.name}</Body>
                      {s.operationalRoles.length > 0 && (
                        <Hint className="text-mil-muted">{s.operationalRoles.join(' · ')}</Hint>
                      )}
                    </div>
                    {isLocked && (
                      <span className="text-tiny font-semibold text-mil-olive">נעול</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <Muted className="block text-tiny mt-2 leading-snug">
            חייל נעול שמור משינוי אוטומטי בעת recompute עתידי.
          </Muted>
        </section>

        {/* Excused-until section */}
        <section>
          <Hint className="block uppercase tracking-wide font-bold text-mil-muted mb-2">
            הוצאות מהמשבצת
          </Hint>
          {excuses.length === 0 ? (
            <Muted className="text-tiny">אין הוצאות פעילות.</Muted>
          ) : (
            <div className="bg-mil-card border border-mil-border rounded-xl-soft divide-y divide-mil-border overflow-hidden">
              {excuses.map((ex) => {
                const sol = soldiers.find((s) => s.id === ex.soldierId);
                const until = new Date(ex.untilIso);
                const isExpired = Date.now() > until.getTime();
                return (
                  <div key={ex.soldierId} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <Body className="font-semibold leading-tight">{sol?.name ?? ex.soldierId}</Body>
                      <Hint className="text-mil-muted font-mono tabular-nums">
                        עד {until.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
                        {isExpired && <span className="text-mil-ghost"> · פג</span>}
                      </Hint>
                      {ex.reason && <Hint className="block mt-0.5 text-mil-muted">{ex.reason}</Hint>}
                    </div>
                    <button
                      onClick={() => removeSlotExcuse(slot.id, ex.soldierId)}
                      className="text-tiny font-semibold text-mil-alert hover:bg-mil-alert-bg px-2 py-1 rounded-md"
                    >
                      בטל ←
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add-excuse form */}
          <div className="mt-3 bg-mil-bg-alt border border-mil-border rounded-xl-soft p-3 space-y-2">
            <Hint className="block font-semibold text-mil-muted">+ הוצא חייל מהמשבצת</Hint>
            <select
              value={pickerSoldierId}
              onChange={(e) => setPickerSoldierId(e.target.value)}
              className="w-full bg-mil-card border border-mil-border rounded-md px-3 py-2 text-sm text-mil-text"
            >
              <option value="">בחר חייל מהמחלקה</option>
              {excusablePool.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={pickerUntil}
              onChange={(e) => setPickerUntil(e.target.value)}
              className="w-full bg-mil-card border border-mil-border rounded-md px-3 py-2 text-sm text-mil-text font-mono tabular-nums"
              dir="ltr"
            />
            <input
              type="text"
              value={pickerReason}
              onChange={(e) => setPickerReason(e.target.value)}
              placeholder="סיבה (אופציונלי) — לדוגמה: ועדה רפואית"
              className="w-full bg-mil-card border border-mil-border rounded-md px-3 py-2 text-sm text-mil-text"
            />
            <Button
              variant="primary"
              size="md"
              fullWidth
              onClick={handleAddExcuse}
              disabled={!pickerSoldierId || !pickerUntil}
            >
              הוצא
            </Button>
          </div>
        </section>

        {/* Operational notes */}
        <section>
          <Hint className="block uppercase tracking-wide font-bold text-mil-muted mb-2">
            הערת תפעול
          </Hint>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={3}
            placeholder="טקסט חופשי — דגשים תפעוליים שיופיעו על המשבצת"
            className="w-full bg-mil-card border border-mil-border rounded-md px-3 py-2.5 text-sm text-mil-text resize-none"
          />
          {noteSaved && <Toast tone="success">{noteSaved}</Toast>}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSaveNote}
            disabled={(noteDraft ?? '') === (ops?.operationalNotes ?? '')}
          >
            שמור הערה
          </Button>
        </section>

      </div>
    </Sheet>
  );
}
