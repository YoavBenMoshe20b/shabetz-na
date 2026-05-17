// MissionImportSheet — the "don't start from scratch" surface.
//
// Two flows, one sheet:
//   • Single-mission duplicate (from MissionDetailPage / a mission row)
//   • Bulk import from a previous order (from SchedulePage's order
//     section) — multi-select source missions
//
// In BOTH flows, the operator sees a review screen BEFORE the missions
// are created:
//   • dates auto-adjust to the new order's window
//   • qualifications / equipment that no longer exist are flagged
//   • leave conflicts with the target window are surfaced (re-uses
//     the existing platoon-leave detector — same data shape)
//   • response-team soldiers who left are flagged
//
// The sheet keeps mutations OUT — it produces the import payload, the
// caller (MissionDetailPage / SchedulePage) calls AppContext.addMission
// and navigates to /missions/:id/assign so the existing conflict
// resolution flow gets to run on the freshly-created mission too.

import { useMemo, useState } from 'react';
import type {
  Mission, OperationalOrder, Qualification, EquipmentItem, Platoon,
  PlatoonLeaveDay, Soldier, Assignment,
} from '../types';
import {
  reviewMissionImport, buildImportedMission,
} from '../utils/missionImport';
import { Sheet, Body, Hint, Muted, Button } from './ui';

interface Props {
  open: boolean;
  onClose: () => void;
  /** The mission(s) being imported. One = single duplicate; many =
   *  bulk import from a previous order. */
  sourceMissions: Mission[];
  /** The destination order. May be undefined for a "free" duplicate
   *  (no order — evergreen mission); the review will say so. */
  targetOrder?: OperationalOrder;

  // ── Data the review needs (passed in to keep the component pure) ─
  qualifications:    Qualification[];
  equipmentItems:    EquipmentItem[];
  platoons:          Platoon[];
  platoonLeaveDays:  PlatoonLeaveDay[];
  soldiers:          Soldier[];
  assignments:       Assignment[];

  /** Callback fires for EACH mission the operator confirmed — the
   *  caller wires this to AppContext.addMission and the resulting
   *  Mission id is what the caller routes on. */
  onConfirm: (payloads: Array<ReturnType<typeof buildImportedMission>>) => void;
}

export default function MissionImportSheet({
  open, onClose, sourceMissions, targetOrder,
  qualifications, equipmentItems, platoons, platoonLeaveDays,
  soldiers, assignments, onConfirm,
}: Props) {
  // Which sources are selected for the import (all on by default).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(sourceMissions.map((m) => m.id)),
  );

  // Per-source operator overrides — name only for now.
  const [namesById, setNamesById] = useState<Record<string, string>>({});

  // Compute review items per selected source.
  const reviews = useMemo(() => {
    return sourceMissions
      .filter((m) => selectedIds.has(m.id))
      .map((mission) => ({
        mission,
        items: reviewMissionImport({
          sourceMission: mission,
          targetOrder,
          qualifications,
          equipmentItems,
          platoons,
          platoonLeaveDays,
          soldiers,
          assignmentsForSourceMission: assignments.filter((a) =>
            // Heuristic — assignments don't carry missionId directly,
            // they carry slotId. We pass the count via slotId prefix
            // match (slot ids are mat-<missionId>-…). Approximate but
            // useful: the review surfaces "N שיבוצים יקבלו איפוס".
            a.slotId.startsWith(`mat-${mission.id}-`),
          ),
        }),
      }));
  }, [
    sourceMissions, selectedIds, targetOrder, qualifications,
    equipmentItems, platoons, platoonLeaveDays, soldiers, assignments,
  ]);

  const totalErrors = reviews.reduce(
    (acc, r) => acc + r.items.filter((i) => i.severity === 'error').length,
    0,
  );
  const totalWarns = reviews.reduce(
    (acc, r) => acc + r.items.filter((i) => i.severity === 'warn').length,
    0,
  );

  const confirm = () => {
    const payloads = reviews.map(({ mission }) =>
      buildImportedMission({
        sourceMission:    mission,
        targetOrderId:    targetOrder?.id,
        newName:          namesById[mission.id],
        qualifications,
        equipmentItems,
        platoons,
      }),
    );
    onConfirm(payloads);
  };

  const canConfirm = reviews.length > 0;

  if (!open) return null;
  const isBulk = sourceMissions.length > 1;

  return (
    <Sheet
      open
      onClose={onClose}
      title={isBulk ? 'משוך משימות מצו קודם' : 'שכפול משימה'}
      subtitle={
        targetOrder
          ? `יעד: ${targetOrder.name}`
          : 'ללא צו מקושר (משימה חופשית)'
      }
      size="lg"
    >
      <div className="px-5 py-5 space-y-5">

        {/* Bulk select banner */}
        {isBulk && (
          <div className="bg-mil-info-bg border border-mil-info-border rounded-xl-soft px-4 py-3">
            <Body className="font-semibold text-mil-info text-sm">
              {selectedIds.size}/{sourceMissions.length} משימות סומנו להעתקה
            </Body>
            <Muted className="mt-1 text-tiny leading-snug">
              בטל סימון של משימות שלא רלוונטיות. שאר ההגדרות (לוחות זמנים, פיקוד, רוטציה, ציוד) ייוצרו אוטומטית.
            </Muted>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setSelectedIds(new Set(sourceMissions.map((m) => m.id)))}
                className="text-tiny font-semibold text-mil-info hover:text-mil-text underline"
              >
                סמן הכל
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-tiny font-semibold text-mil-muted hover:text-mil-text underline"
              >
                נקה
              </button>
            </div>
          </div>
        )}

        {/* Per-mission cards: select + name override + review */}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {sourceMissions.map((m) => {
            const on = selectedIds.has(m.id);
            const review = reviews.find((r) => r.mission.id === m.id);
            return (
              <div
                key={m.id}
                className={`rounded-2xl border px-4 py-3.5 transition-colors ${
                  on ? 'bg-mil-card border-mil-border' : 'bg-mil-bg-alt border-mil-border opacity-60'
                }`}
              >
                <div className="flex items-baseline gap-2">
                  {isBulk && (
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(m.id); else next.delete(m.id);
                          return next;
                        });
                      }}
                      className="w-4 h-4 accent-mil-olive"
                    />
                  )}
                  <Body className="font-semibold flex-1">{m.name}</Body>
                  {m.archetypeKind && m.archetypeKind !== 'custom' && (
                    <Hint className="text-tiny text-mil-olive-dim shrink-0">
                      {ARCHETYPE_LABEL[m.archetypeKind]}
                    </Hint>
                  )}
                </div>

                {on && (
                  <>
                    {/* Name override */}
                    <div className="mt-3">
                      <Hint className="block mb-1">שם חדש (אופציונלי)</Hint>
                      <input
                        type="text"
                        value={namesById[m.id] ?? ''}
                        onChange={(e) => setNamesById((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        placeholder={`${m.name} (העתק)`}
                        className="w-full bg-mil-bg-alt border border-mil-border rounded-lg px-2.5 py-1.5 text-sm"
                      />
                    </div>

                    {/* Review items */}
                    {review && review.items.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {review.items.map((it, i) => (
                          <li
                            key={i}
                            className={`rounded-xl-soft px-3 py-2 text-tiny leading-snug border ${
                              it.severity === 'error'
                                ? 'bg-mil-alert-bg border-mil-alert text-mil-alert'
                                : it.severity === 'warn'
                                  ? 'bg-mil-warn-bg border-mil-warn text-mil-warn'
                                  : 'bg-mil-info-bg border-mil-info-border text-mil-info'
                            }`}
                          >
                            <span className="font-bold uppercase tracking-wide ml-1.5">
                              {it.severity === 'error' ? 'בעיה' : it.severity === 'warn' ? 'שים לב' : 'הערה'}
                            </span>
                            <span className="font-semibold">{it.message}</span>
                            {it.autoAction && (
                              <div className="mt-1 text-xxs text-mil-muted">
                                ↳ {it.autoAction}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Aggregate footer */}
        {(totalErrors + totalWarns) > 0 && (
          <div className="text-tiny text-mil-muted">
            {totalErrors > 0 && (
              <span className="font-bold text-mil-alert">{totalErrors} בעיות · </span>
            )}
            {totalWarns > 0 && (
              <span className="font-bold text-mil-warn">{totalWarns} אזהרות · </span>
            )}
            <span>הבעיות יטופלו אוטומטית. את האזהרות תפתור במסך השיוך.</span>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!canConfirm}
            onClick={confirm}
          >
            {isBulk ? `צור ${selectedIds.size} משימות` : 'צור עותק'}
          </Button>
          <Button variant="ghost" size="lg" onClick={onClose}>
            ביטול
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

const ARCHETYPE_LABEL: Record<string, string> = {
  'static-guard': '👁 שמירה סטטית',
  'patrol':       '🚶 סיור',
  'readiness':    '🛡 כוננות',
  'one-time-op':  '🎯 חד-פעמי',
};
