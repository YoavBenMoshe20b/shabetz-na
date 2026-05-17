// SquadDistributionSheet — "איך לחלק בתוך המחלקה?"
//
// The mandatory first question the PC answers when starting to staff a
// mission. The choice shapes the candidate pool every slot of the
// mission will draw from: should the engine pick from ONE squad, a
// few squads, the whole platoon, a hand-picked roster, or follow its
// own recommendation?
//
// The choice lives in session state inside PlatoonMissionsPage — once
// answered, the prompt does NOT re-ask for the same mission in the
// same session. The PC can change their mind from the StaffingSheet's
// own "שנה חלוקה" affordance (Phase 7.4 — not in this slice).

import { useMemo, useState } from 'react';
import type { Soldier, Squad } from '../types';
import { Sheet, Body, Hint, Muted, Button } from './ui';

export type SquadDistributionMode =
  | { kind: 'whole-platoon' }
  | { kind: 'by-squad'; squadId: string }
  | { kind: 'multi-squad'; squadIds: string[] }
  | { kind: 'specific-soldiers'; soldierIds: string[] }
  | { kind: 'system-recommendation' };

interface Props {
  open: boolean;
  onClose: () => void;
  /** Mission name for sub-title context. */
  missionName: string;
  /** Squads in the PC's platoon (passed in so this component stays
   *  decoupled from AppContext). */
  squads: Squad[];
  /** All soldiers in the PC's platoon — used for "specific soldiers"
   *  mode and to display per-squad counts. */
  platoonSoldiers: Soldier[];
  /** Fires with the chosen distribution and closes the sheet. */
  onChoose: (mode: SquadDistributionMode) => void;
}

type Tab = 'whole' | 'by-squad' | 'multi-squad' | 'specific' | 'recommendation';

export default function SquadDistributionSheet({
  open, onClose, missionName, squads, platoonSoldiers, onChoose,
}: Props) {
  const [tab, setTab] = useState<Tab>('whole');
  const [selectedSquadId, setSelectedSquadId] = useState<string>(squads[0]?.id ?? '');
  const [selectedSquadIds, setSelectedSquadIds] = useState<string[]>([]);
  const [selectedSoldierIds, setSelectedSoldierIds] = useState<string[]>([]);

  const squadCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const sq of squads) {
      map[sq.id] = platoonSoldiers.filter((s) => s.squadId === sq.id).length;
    }
    return map;
  }, [squads, platoonSoldiers]);

  if (!open) return null;

  const TABS: Array<{ key: Tab; label: string; hint: string; icon: string }> = [
    { key: 'whole',          label: 'כל המחלקה',           hint: 'הזמינים יוצעו ללא הגבלה', icon: '👥' },
    { key: 'by-squad',       label: 'כיתה אחת',             hint: 'בחר כיתה אחת לאיוש',       icon: '🔵' },
    { key: 'multi-squad',    label: 'כמה כיתות',             hint: 'מספר כיתות יחד',           icon: '🔷' },
    { key: 'specific',       label: 'חיילים ספציפיים',       hint: 'בחירה ידנית מהמחלקה',     icon: '🎯' },
    { key: 'recommendation', label: 'לפי המלצת המערכת',     hint: 'המנוע יבחר מהפול המלא',    icon: '✨' },
  ];

  const canConfirm =
    tab === 'whole'          ? true :
    tab === 'recommendation' ? true :
    tab === 'by-squad'       ? !!selectedSquadId :
    tab === 'multi-squad'    ? selectedSquadIds.length > 0 :
    tab === 'specific'       ? selectedSoldierIds.length > 0 :
    false;

  const confirm = () => {
    if (!canConfirm) return;
    switch (tab) {
      case 'whole':
        onChoose({ kind: 'whole-platoon' });
        break;
      case 'by-squad':
        onChoose({ kind: 'by-squad', squadId: selectedSquadId });
        break;
      case 'multi-squad':
        onChoose({ kind: 'multi-squad', squadIds: selectedSquadIds });
        break;
      case 'specific':
        onChoose({ kind: 'specific-soldiers', soldierIds: selectedSoldierIds });
        break;
      case 'recommendation':
        onChoose({ kind: 'system-recommendation' });
        break;
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="איך לחלק בתוך המחלקה?"
      subtitle={missionName}
      size="lg"
    >
      <div className="px-5 py-5 space-y-5">

        {/* Mode tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`text-right rounded-xl-soft border px-4 py-3 transition-colors ${
                  active
                    ? 'bg-mil-olive-bg border-mil-olive ring-2 ring-mil-olive/30'
                    : 'bg-mil-card border-mil-border hover:border-mil-olive'
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-base leading-none" aria-hidden>{t.icon}</span>
                  <Body className="font-semibold">{t.label}</Body>
                </div>
                <Hint className="block mt-1 text-tiny leading-snug">{t.hint}</Hint>
              </button>
            );
          })}
        </div>

        {/* Mode-specific configuration */}
        {tab === 'by-squad' && (
          <div>
            <Hint className="mb-2 block tracking-wide">בחר כיתה</Hint>
            <div className="flex flex-wrap gap-2">
              {squads.map((sq) => {
                const active = sq.id === selectedSquadId;
                return (
                  <button
                    key={sq.id}
                    onClick={() => setSelectedSquadId(sq.id)}
                    className={`px-3.5 py-2 rounded-xl-soft text-sm font-bold transition-colors ${
                      active
                        ? 'bg-mil-olive text-white'
                        : 'bg-mil-card border border-mil-border text-mil-muted hover:border-mil-olive'
                    }`}
                  >
                    {sq.name}
                    <span className="text-tiny font-medium mr-1.5 opacity-80">({squadCounts[sq.id] ?? 0})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'multi-squad' && (
          <div>
            <Hint className="mb-2 block tracking-wide">בחר כיתות (אחת או יותר)</Hint>
            <div className="flex flex-wrap gap-2">
              {squads.map((sq) => {
                const active = selectedSquadIds.includes(sq.id);
                return (
                  <button
                    key={sq.id}
                    onClick={() =>
                      setSelectedSquadIds((prev) =>
                        prev.includes(sq.id)
                          ? prev.filter((x) => x !== sq.id)
                          : [...prev, sq.id],
                      )
                    }
                    className={`px-3.5 py-2 rounded-xl-soft text-sm font-bold transition-colors ${
                      active
                        ? 'bg-mil-olive text-white'
                        : 'bg-mil-card border border-mil-border text-mil-muted hover:border-mil-olive'
                    }`}
                  >
                    {sq.name}
                    <span className="text-tiny font-medium mr-1.5 opacity-80">({squadCounts[sq.id] ?? 0})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'specific' && (
          <div>
            <Hint className="mb-2 block tracking-wide">בחר חיילים ידנית (לפי כיתה)</Hint>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {squads.map((sq) => {
                const sqSoldiers = platoonSoldiers
                  .filter((s) => s.squadId === sq.id)
                  .sort((a, b) => a.name.localeCompare(b.name, 'he'));
                if (sqSoldiers.length === 0) return null;
                return (
                  <div key={sq.id}>
                    <Hint className="block mb-1.5 text-tiny font-bold text-mil-text">{sq.name}</Hint>
                    <div className="flex flex-wrap gap-1.5">
                      {sqSoldiers.map((s) => {
                        const active = selectedSoldierIds.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            onClick={() =>
                              setSelectedSoldierIds((prev) =>
                                prev.includes(s.id)
                                  ? prev.filter((x) => x !== s.id)
                                  : [...prev, s.id],
                              )
                            }
                            className={`px-2.5 py-1.5 rounded-lg text-tiny font-semibold transition-colors ${
                              active
                                ? 'bg-mil-olive text-white'
                                : 'bg-mil-card border border-mil-border text-mil-muted hover:border-mil-olive'
                            }`}
                          >
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            {selectedSoldierIds.length > 0 && (
              <Muted className="mt-2 text-tiny">{selectedSoldierIds.length} חיילים נבחרו</Muted>
            )}
          </div>
        )}

        {tab === 'recommendation' && (
          <div className="bg-mil-info-bg border border-mil-info-border rounded-xl-soft px-4 py-3">
            <Body className="font-semibold text-mil-info text-sm">המנוע יקבע לבד</Body>
            <Muted className="mt-1 text-tiny leading-snug">
              המערכת תבחר מתוך כל המחלקה לפי עייפות, כשירויות, יציאות וניקוד מנוע — תקבל הצעה ותוכל לאשר או לדחות.
            </Muted>
          </div>
        )}

        {/* Confirm */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canConfirm}
          onClick={confirm}
        >
          המשך לאיוש ←
        </Button>
      </div>
    </Sheet>
  );
}

// ─── Filter helper ──────────────────────────────────────────────────
//
// Applies a SquadDistributionMode to a soldier pool. Callers use this
// to scope the StaffingSheet's candidatePool.

export function filterPoolByDistribution(
  pool: Soldier[],
  mode: SquadDistributionMode | undefined,
): Soldier[] {
  if (!mode) return pool;
  switch (mode.kind) {
    case 'whole-platoon':
    case 'system-recommendation':
      return pool;
    case 'by-squad':
      return pool.filter((s) => s.squadId === mode.squadId);
    case 'multi-squad':
      return pool.filter((s) => mode.squadIds.includes(s.squadId ?? ''));
    case 'specific-soldiers':
      return pool.filter((s) => mode.soldierIds.includes(s.id));
  }
}
