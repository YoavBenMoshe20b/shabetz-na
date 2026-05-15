// SlotOperationsSheet — Mission Operations Layer UI for a single slot.
//
// Opens from a slot row in MissionDetailPage. Lets the PC manipulate
// state that SURVIVES recompute. The sheet is squad-aware: every
// assigned-soldier list shows the soldier's squad (כיתה א / ב / ג /
// non-combat name) inline, and the excuse picker groups its dropdown
// by squad so the PC stays inside their operational mental model.
//
// Operations exposed:
//   • Lock soldier (lockedSoldierIds) — protected from auto-rebalance
//   • Pin commander (lockedCommander) — explicit commander for the slot
//   • Lock pair (lockedPair) — atomic two-soldier guarantee
//   • Replace soldier — quick swap to another candidate from same squad
//   • Excuse soldier until cutoff (excusedUntil) — drops from pool
//   • Operational note (operationalNotes) — PC's free-form note
//
// Reads + writes via AppContext.

import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Sheet, Body, Muted, Hint, Button, Toast } from './ui';
import type { Soldier } from '../types';
import type { MaterializedSlot } from '../utils/materialize';

interface SlotOperationsSheetProps {
  open: boolean;
  onClose: () => void;
  slot: MaterializedSlot;
  /** Soldiers in the slot's owner platoon — pool for excuse / replace. */
  candidatePool: Soldier[];
}

export default function SlotOperationsSheet({
  open, onClose, slot, candidatePool,
}: SlotOperationsSheetProps) {
  const {
    soldiers, squads, slotOperationalState,
    toggleSlotSoldierLock, addSlotExcuse, removeSlotExcuse, setSlotOps,
    setSlotAssignment, assignments,
  } = useApp();

  const ops = useMemo(
    () => slotOperationalState.find((s) => s.slotId === slot.id),
    [slotOperationalState, slot.id],
  );

  const lockedIds = ops?.lockedSoldierIds ?? [];
  const lockedCommander = ops?.lockedCommander;
  const lockedPair = ops?.lockedPair;
  const excuses = ops?.excusedUntil ?? [];

  // The soldiers currently assigned to this slot (commander + roster).
  const assignedSoldiers = useMemo(() => {
    const ids = [...slot.assignedSoldierIds];
    if (slot.commanderSoldierId) ids.push(slot.commanderSoldierId);
    return ids
      .map((id) => soldiers.find((s) => s.id === id))
      .filter((s): s is Soldier => !!s);
  }, [slot, soldiers]);

  const squadOf = (soldierId: string): string => {
    const s = soldiers.find((x) => x.id === soldierId);
    if (!s?.squadId) return '—';
    return squads.find((sq) => sq.id === s.squadId)?.name ?? s.teamClass ?? '—';
  };

  // Group assigned soldiers by squad so the PC sees the כיתה breakdown.
  const assignedBySquad = useMemo(() => {
    const map = new Map<string, Soldier[]>();
    for (const s of assignedSoldiers) {
      const sqName = squadOf(s.id);
      const arr = map.get(sqName) ?? [];
      arr.push(s);
      map.set(sqName, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedSoldiers]);

  // ─── Picker states ──────────────────────────────────────────────────

  const [pickerSoldierId, setPickerSoldierId] = useState<string>('');
  const [pickerUntil, setPickerUntil] = useState<string>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 24);
    return d.toISOString().slice(0, 16);
  });
  const [pickerReason, setPickerReason] = useState<string>('');
  const [noteDraft, setNoteDraft] = useState<string>(ops?.operationalNotes ?? '');
  const [noteSaved, setNoteSaved] = useState<string>('');

  // Replace-soldier state: which assigned soldier is being replaced
  const [replacingId, setReplacingId] = useState<string | null>(null);

  // Pair-lock state: which soldier is being paired
  const [pairFirstId, setPairFirstId] = useState<string>('');
  const [pairSecondId, setPairSecondId] = useState<string>('');

  // ─── Mutations ─────────────────────────────────────────────────────

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

  const handleSetCommander = (soldierId: string) => {
    // Toggle: if already the locked commander, clear; else set.
    setSlotOps(slot.id, {
      lockedCommander: lockedCommander === soldierId ? undefined : soldierId,
    });
  };

  /** Atomic swap — replace `outId` with `inId` in the current
   *  assignment for this slot. Preserves the assignment shape via
   *  setSlotAssignment(allSoldierIdsOnThisSlot). */
  const handleReplace = (outId: string, inId: string) => {
    const currentIds = assignments
      .filter((a) => a.slotId === slot.id)
      .map((a) => a.soldierId);
    const fallbackIds = [...slot.assignedSoldierIds];
    if (slot.commanderSoldierId) fallbackIds.push(slot.commanderSoldierId);
    const base = currentIds.length > 0 ? currentIds : fallbackIds;
    const nextIds = base.filter((id) => id !== outId).concat(inId);
    setSlotAssignment(slot.id, nextIds);
    setReplacingId(null);
  };

  const handleSetPair = () => {
    if (!pairFirstId || !pairSecondId || pairFirstId === pairSecondId) return;
    setSlotOps(slot.id, { lockedPair: [pairFirstId, pairSecondId] });
    setPairFirstId('');
    setPairSecondId('');
  };

  const handleClearPair = () => {
    setSlotOps(slot.id, { lockedPair: undefined });
  };

  // ─── Pool helpers ──────────────────────────────────────────────────

  const excusedSet = new Set(excuses.map((e) => e.soldierId));
  const excusablePool = candidatePool.filter((s) => !excusedSet.has(s.id));

  // Group the entire candidate pool by squad — used in excuse + pair
  // dropdowns + replace picker.
  const groupedPool = useMemo(() => {
    const map = new Map<string, Soldier[]>();
    for (const s of candidatePool) {
      const key = squadOf(s.id);
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidatePool]);

  const groupedExcusablePool = useMemo(() => {
    const map = new Map<string, Soldier[]>();
    for (const s of excusablePool) {
      const key = squadOf(s.id);
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excusablePool]);

  // ─── Render ────────────────────────────────────────────────────────

  const subtitle = (() => {
    const s = new Date(slot.start);
    const e = new Date(slot.end);
    const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${slot.missionName} · ${hhmm(s)}–${hhmm(e)}`;
  })();

  return (
    <Sheet open={open} onClose={onClose} title="ניהול תפעולי" subtitle={subtitle}>
      <div className="px-5 py-5 space-y-5">

        {/* Squad-by-squad assignment view */}
        <section>
          <Hint className="block uppercase tracking-wide font-bold text-mil-muted mb-2">
            איוש לפי כיתות
          </Hint>
          {assignedSoldiers.length === 0 ? (
            <Muted className="text-tiny">אין חיילים משובצים למשבצת זו.</Muted>
          ) : (
            <div className="space-y-2.5">
              {assignedBySquad.map(([sqName, soldiersList]) => (
                <div key={sqName} className="bg-mil-card border border-mil-border rounded-xl-soft overflow-hidden">
                  <header className="px-4 py-2 bg-mil-bg-alt border-b border-mil-border flex items-baseline justify-between">
                    <Body className="font-bold text-sm">{sqName}</Body>
                    <Hint className="text-mil-muted tabular-nums">{soldiersList.length}</Hint>
                  </header>
                  <div className="divide-y divide-mil-border">
                    {soldiersList.map((s) => {
                      const isLocked = lockedIds.includes(s.id);
                      const isCommander = lockedCommander === s.id || slot.commanderSoldierId === s.id;
                      const isReplacing = replacingId === s.id;
                      return (
                        <div key={s.id} className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <Body className="font-semibold leading-tight">{s.name}</Body>
                              {s.operationalRoles.length > 0 && (
                                <Hint className="text-mil-muted">{s.operationalRoles.slice(0, 3).join(' · ')}</Hint>
                              )}
                            </div>
                            {isCommander && (
                              <span className="text-xxs font-bold px-2 py-0.5 rounded-md bg-mil-olive-bg text-mil-olive border border-mil-olive/30">
                                מפקד
                              </span>
                            )}
                          </div>
                          {/* Action row */}
                          <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
                            <button
                              onClick={() => toggleSlotSoldierLock(slot.id, s.id)}
                              className={`text-xxs font-semibold px-2 py-1 rounded-md border transition-colors ${
                                isLocked
                                  ? 'bg-mil-olive text-white border-mil-olive'
                                  : 'bg-mil-card text-mil-muted border-mil-border hover:border-mil-olive'
                              }`}
                            >
                              🔒 {isLocked ? 'נעול' : 'נעל'}
                            </button>
                            <button
                              onClick={() => handleSetCommander(s.id)}
                              className={`text-xxs font-semibold px-2 py-1 rounded-md border transition-colors ${
                                lockedCommander === s.id
                                  ? 'bg-mil-olive text-white border-mil-olive'
                                  : 'bg-mil-card text-mil-muted border-mil-border hover:border-mil-olive'
                              }`}
                            >
                              ⭐ {lockedCommander === s.id ? 'מפקד נעול' : 'נעל כמפקד'}
                            </button>
                            <button
                              onClick={() => setReplacingId(isReplacing ? null : s.id)}
                              className={`text-xxs font-semibold px-2 py-1 rounded-md border transition-colors ${
                                isReplacing
                                  ? 'bg-mil-warn text-white border-mil-warn'
                                  : 'bg-mil-card text-mil-muted border-mil-border hover:border-mil-warn'
                              }`}
                            >
                              ↔ {isReplacing ? 'סגור' : 'החלף'}
                            </button>
                          </div>
                          {/* Replace picker */}
                          {isReplacing && (
                            <div className="mt-2 pt-2 border-t border-mil-border space-y-2">
                              <Hint className="block font-semibold text-mil-muted">החלף את {s.name} ב…</Hint>
                              <div className="max-h-48 overflow-y-auto bg-mil-bg-alt rounded-md divide-y divide-mil-border">
                                {groupedPool.map(([sqName2, list]) => (
                                  <div key={sqName2}>
                                    <p className="text-xxs font-semibold uppercase tracking-wide text-mil-muted px-3 py-1.5 bg-mil-card sticky top-0">
                                      {sqName2}
                                    </p>
                                    {list
                                      .filter((cand) => cand.id !== s.id && !slot.assignedSoldierIds.includes(cand.id) && slot.commanderSoldierId !== cand.id)
                                      .map((cand) => (
                                        <button
                                          key={cand.id}
                                          onClick={() => handleReplace(s.id, cand.id)}
                                          className="w-full text-right px-3 py-2 hover:bg-mil-card transition-colors flex items-baseline gap-2"
                                        >
                                          <Body className="text-sm font-medium flex-1">{cand.name}</Body>
                                          {cand.operationalRoles.length > 0 && (
                                            <Hint className="text-mil-muted">{cand.operationalRoles[0]}</Hint>
                                          )}
                                        </button>
                                      ))}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Muted className="block text-tiny mt-2 leading-snug">
            חייל נעול ומפקד נעול שמורים משינוי אוטומטי בעת recompute עתידי.
          </Muted>
        </section>

        {/* Pair lock */}
        <section>
          <Hint className="block uppercase tracking-wide font-bold text-mil-muted mb-2">
            צמד נעול (זוגות קבועים)
          </Hint>
          {lockedPair ? (
            <div className="bg-mil-card border border-mil-olive/30 bg-mil-olive-bg rounded-xl-soft px-4 py-3 flex items-center gap-3">
              <span className="text-lg">🔗</span>
              <div className="flex-1 min-w-0">
                <Body className="font-semibold leading-tight">
                  {soldiers.find((s) => s.id === lockedPair[0])?.name ?? lockedPair[0]}
                  {' · '}
                  {soldiers.find((s) => s.id === lockedPair[1])?.name ?? lockedPair[1]}
                </Body>
                <Hint className="text-mil-muted">השניים נשמרים יחד בשיבוצים עתידיים</Hint>
              </div>
              <button
                onClick={handleClearPair}
                className="text-tiny font-semibold text-mil-alert hover:bg-mil-alert-bg px-2 py-1 rounded-md"
              >
                שחרר
              </button>
            </div>
          ) : (
            <div className="bg-mil-bg-alt border border-mil-border rounded-xl-soft p-3 space-y-2">
              <Hint className="block font-semibold text-mil-muted">בחר שני חיילים לקבע יחד</Hint>
              <SoldierGroupSelect
                value={pairFirstId}
                onChange={setPairFirstId}
                groups={groupedPool}
                placeholder="חייל ראשון"
                excludeIds={pairSecondId ? [pairSecondId] : []}
              />
              <SoldierGroupSelect
                value={pairSecondId}
                onChange={setPairSecondId}
                groups={groupedPool}
                placeholder="חייל שני"
                excludeIds={pairFirstId ? [pairFirstId] : []}
              />
              <Button
                variant="primary"
                size="md"
                fullWidth
                onClick={handleSetPair}
                disabled={!pairFirstId || !pairSecondId || pairFirstId === pairSecondId}
              >
                נעל צמד
              </Button>
            </div>
          )}
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
          <div className="mt-3 bg-mil-bg-alt border border-mil-border rounded-xl-soft p-3 space-y-2">
            <Hint className="block font-semibold text-mil-muted">+ הוצא חייל מהמשבצת</Hint>
            <SoldierGroupSelect
              value={pickerSoldierId}
              onChange={setPickerSoldierId}
              groups={groupedExcusablePool}
              placeholder="בחר חייל מהמחלקה"
            />
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

// ─── Squad-grouped soldier select ────────────────────────────────────

function SoldierGroupSelect({
  value, onChange, groups, placeholder, excludeIds = [],
}: {
  value: string;
  onChange: (id: string) => void;
  groups: Array<[string, Soldier[]]>;
  placeholder: string;
  excludeIds?: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-mil-card border border-mil-border rounded-md px-3 py-2 text-sm text-mil-text"
    >
      <option value="">{placeholder}</option>
      {groups.map(([sqName, list]) => (
        <optgroup key={sqName} label={sqName}>
          {list
            .filter((s) => !excludeIds.includes(s.id))
            .map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}
