// StaffingSheet — the staffing surface where the engine becomes visible.
//
// Opens from MissionDetailPage when a PC/PS or CC clicks "Staff this slot".
// Renders:
//   • slot context (time, mission, required count)
//   • candidate list with score badges + tooltip breakdown
//   • clean candidates vs forced (CLEAR visual distinction)
//   • selector reasoning ("3 שיבוצים נקיים, חסר 1 — דרוש override")
//   • per-candidate burden headline
//   • action buttons: assign / force-assign / cancel
//
// The engine is consulted via selectCandidates(slot, candidatePool, ctx).
// The component is a thin renderer over the SelectorOutcome.

import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useEngineContext } from '../hooks/useEngineContext';
import { selectCandidates } from '../utils/engine/selector';
import type {
  CandidateScore, CandidateScoreDimension, SelectorOutcome, Soldier,
  HardFilterCode,
} from '../types';
import type { MaterializedSlot } from '../utils/materialize';
import { Sheet, Body, Hint, Muted, Button } from './ui';

interface StaffingSheetProps {
  open: boolean;
  onClose: () => void;
  slot: MaterializedSlot;
  /** Soldiers eligible to be considered for this slot. The caller
   *  pre-filters to the right scope (e.g. soldiers from the platoons in
   *  mission.assignedPlatoonIds). */
  candidatePool: Soldier[];
  /** Called when the operator confirms an assignment. The engine has
   *  already produced the recommendation; this fires the actual write. */
  onAssign: (soldierIds: string[], forcedReason?: string) => void;
}

export default function StaffingSheet({
  open, onClose, slot, candidatePool, onAssign,
}: StaffingSheetProps) {
  const ctx = useEngineContext();
  const { missions } = useApp();
  const mission = missions.find((m) => m.id === slot.missionId);

  // Compute the engine outcome. acceptForced=false: clean picks only.
  // Operator must opt-in to forced fills.
  const outcomeClean: SelectorOutcome = useMemo(
    () => selectCandidates(slot, candidatePool, ctx, {
      requiredCount: slot.requiredCount,
      acceptForced: false,
    }),
    [slot, candidatePool, ctx],
  );

  // Operator opt-in toggle for forced fills.
  const [showForced, setShowForced] = useState(false);
  const outcome: SelectorOutcome = useMemo(
    () => showForced
      ? selectCandidates(slot, candidatePool, ctx, {
          requiredCount: slot.requiredCount,
          acceptForced: true,
          forcedReason: 'אישור מ״פ — דחיפות מבצעית',
        })
      : outcomeClean,
    [showForced, slot, candidatePool, ctx, outcomeClean],
  );

  // Rejected candidates — anyone in the pool who isn't in picked/alternates
  // and has at least one hard filter failure. Surfaced as a collapsible
  // "מועמדים שנדחו" section so the operator sees WHY OTHERS weren't
  // even considered (per Phase 6.2 "why not" refinement).
  const rejectedCandidates = useMemo(() => {
    const surfacedIds = new Set<string>([
      ...outcome.picked.map((p) => p.soldierId),
      ...outcome.alternates.map((a) => a.soldierId),
    ]);
    // Score every non-surfaced soldier from the pool. Engine call is
    // cheap and we want full hard-filter explanations.
    return candidatePool
      .filter((s) => !surfacedIds.has(s.id))
      .map((s) => {
        const scored = selectCandidates(slot, [s], ctx, { requiredCount: 1, acceptForced: true });
        // The lone candidate is in picked[0] (forced) or alternates;
        // either way we get its CandidateScore.
        return scored.picked[0]?.score ?? scored.alternates[0];
      })
      .filter((c): c is NonNullable<typeof c> => !!c && c.hardFiltersFailed.length > 0)
      .sort((a, b) => b.score - a.score);
  }, [candidatePool, outcome, slot, ctx]);

  const [showRejected, setShowRejected] = useState(false);

  // Selected soldier ids (operator can tweak the engine's picks).
  const [pickedIds, setPickedIds] = useState<Set<string>>(
    () => new Set(outcomeClean.picked.map((p) => p.soldierId)),
  );

  const togglePick = (id: string, fromAlt: boolean, hardFails: HardFilterCode[]) => {
    const next = new Set(pickedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (next.size >= slot.requiredCount) {
        // Replace the lowest-scored existing pick.
        const all = [...next];
        const sorted = all
          .map((sid) => outcome.picked.find((p) => p.soldierId === sid)?.score.score ?? 0)
          .map((s, i) => ({ id: all[i], s }))
          .sort((a, b) => a.s - b.s);
        if (sorted.length > 0) next.delete(sorted[0].id);
      }
      next.add(id);
      // If selecting a forced candidate, surface the forced state.
      if ((fromAlt || hardFails.length > 0) && !showForced) {
        setShowForced(true);
      }
    }
    setPickedIds(next);
  };

  if (!open) return null;

  return (
    <Sheet
      open
      onClose={onClose}
      title="איוש משבצת"
      subtitle={`${mission?.name ?? 'משימה'} · ${formatSlotTime(slot)}`}
      size="lg"
    >
      <div className="px-5 py-5 space-y-5">

        {/* ── Slot context ────────────────────────────────────────── */}
        <SlotHeader slot={slot} />

        {/* ── Selector summary ────────────────────────────────────── */}
        <SelectorSummary outcome={outcome} requiredCount={slot.requiredCount} />

        {/* ── Picked + clean candidates ──────────────────────────── */}
        <section>
          <Hint className="block mb-2 text-mil-muted">מועמדים נקיים</Hint>
          <div className="space-y-2">
            {outcome.picked
              .filter((p) => !p.forcedReason)
              .map((p) => (
                <CandidateRow
                  key={p.soldierId}
                  score={p.score}
                  soldiers={ctx.soldiers}
                  burden={ctx.burdens[p.soldierId]}
                  selected={pickedIds.has(p.soldierId)}
                  onToggle={() => togglePick(p.soldierId, false, p.score.hardFiltersFailed)}
                  badge="picked"
                />
              ))}
            {outcome.alternates.map((s) => (
              <CandidateRow
                key={s.soldierId}
                score={s}
                soldiers={ctx.soldiers}
                burden={ctx.burdens[s.soldierId]}
                selected={pickedIds.has(s.soldierId)}
                onToggle={() => togglePick(s.soldierId, true, s.hardFiltersFailed)}
                badge="alternate"
              />
            ))}
            {outcome.picked.filter((p) => !p.forcedReason).length === 0
              && outcome.alternates.length === 0 && (
              <Muted className="block px-1">אין מועמדים נקיים זמינים — דרוש override.</Muted>
            )}
          </div>
        </section>

        {/* ── Forced candidates section (collapsed by default) ───── */}
        <ForcedCandidatesToggle
          visible={showForced || outcome.picked.some((p) => p.forcedReason)}
          forcedPickedFromOutcome={outcome.picked.filter((p) => p.forcedReason)}
          onShow={() => setShowForced(true)}
          onHide={() => setShowForced(false)}
          ctx={ctx}
          pickedIds={pickedIds}
          onTogglePick={(id, fails) => togglePick(id, true, fails)}
        />

        {/* ── Rejected candidates ("Why not") ─────────────────────── */}
        <RejectedCandidatesToggle
          rejected={rejectedCandidates}
          visible={showRejected}
          onShow={() => setShowRejected(true)}
          onHide={() => setShowRejected(false)}
          ctx={ctx}
        />

        {/* ── Bottom action bar ───────────────────────────────────── */}
        <div className="sticky bottom-0 bg-mil-card border-t border-mil-border -mx-5 px-5 pt-4 pb-3 flex items-center gap-2">
          <Body className="font-semibold flex-1">
            {pickedIds.size} מתוך {slot.requiredCount} משובצים
          </Body>
          <Button variant="secondary" size="md" onClick={onClose}>
            ביטול
          </Button>
          <Button
            variant="primary"
            size="md"
            disabled={pickedIds.size === 0}
            onClick={() => {
              const forced = [...pickedIds].some((id) => {
                const picked = outcome.picked.find((p) => p.soldierId === id);
                if (picked) return picked.score.hardFiltersFailed.length > 0;
                const alt = outcome.alternates.find((a) => a.soldierId === id);
                return alt ? alt.hardFiltersFailed.length > 0 : false;
              });
              onAssign(
                [...pickedIds],
                forced ? 'אישור מ״פ — שיבוץ בכפייה דרך StaffingSheet' : undefined,
              );
            }}
          >
            אשר שיבוץ
          </Button>
        </div>

      </div>
    </Sheet>
  );
}

// ─── Slot header ─────────────────────────────────────────────────────

function SlotHeader({ slot }: { slot: MaterializedSlot }) {
  return (
    <div className="bg-mil-bg-alt border border-mil-border rounded-xl-soft p-3.5">
      <Hint>משבצת</Hint>
      <Body className="font-semibold mt-0.5">{slot.missionName}</Body>
      <Muted className="block mt-0.5 font-mono tabular-nums">
        {formatSlotTime(slot)} · נדרשים {slot.requiredCount}
      </Muted>
    </div>
  );
}

// ─── Selector summary (clean vs forced + reasoning + confidence) ─────

function SelectorSummary({
  outcome, requiredCount,
}: {
  outcome: SelectorOutcome;
  requiredCount: number;
}) {
  const filled = outcome.picked.length;
  const cleanCount = outcome.picked.filter((p) => !p.forcedReason).length;
  const forcedCount = outcome.picked.filter((p) => p.forcedReason).length;
  const shortfall = filled < requiredCount;

  return (
    <section className="bg-mil-card border border-mil-border rounded-xl-soft p-4 shadow-card">
      <ConfidenceBadge
        confidence={outcome.confidence}
        forced={outcome.forced}
        shortfall={shortfall}
        decayReasons={outcome.decayReasons}
      />
      <Body className="text-sm leading-relaxed mt-3">{outcome.reasoning}</Body>

      {(cleanCount > 0 || forcedCount > 0) && (
        <div className="mt-3 flex items-baseline gap-3 text-tiny">
          {cleanCount > 0 && (
            <span className="text-mil-success font-semibold tabular-nums">
              ✓ {cleanCount} נקיים
            </span>
          )}
          {forcedCount > 0 && (
            <span className="text-mil-warn font-semibold tabular-nums">
              ⚠ {forcedCount} בכפייה
            </span>
          )}
          {outcome.violations.length > 0 && (
            <span className="text-mil-muted tabular-nums">
              {outcome.violations.length} חריגות
            </span>
          )}
        </div>
      )}

      {/* Inline alerts list — keep tight, max 3 visible */}
      {outcome.alerts.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {outcome.alerts.slice(0, 3).map((a, i) => (
            <div
              key={i}
              className={`text-tiny rounded-md px-2 py-1.5 border ${
                a.severity === 'critical'
                  ? 'bg-mil-alert-bg text-mil-alert border-mil-alert-border'
                  : 'bg-mil-warn-bg text-mil-warn border-mil-warn-border'
              }`}
            >
              {a.message}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Confidence badge — visual tier ─────────────────────────────────
//
// Per-Phase 6.2 refinement: confidence is NOT a number. It's a
// 4-tier color signal the operator reads in < 1 second:
//   • HIGH    (≥ 0.7, no forced)  → green   "ביטחון גבוה"
//   • MEDIUM  (≥ 0.4, no forced)  → amber   "ביטחון בינוני"
//   • LOW     (< 0.4, no forced)  → red     "ביטחון נמוך"
//   • FORCED  (any forced=true)   → purple  "שיבוץ בכפייה"
//   • SHORTFALL (slot not full)   → red+ring "חוסר איוש"
// The numeric % stays available as a small subtitle for transparency.

function ConfidenceBadge({
  confidence, forced, shortfall, decayReasons,
}: {
  confidence: number;
  forced: boolean;
  shortfall: boolean;
  decayReasons?: string[];
}) {
  const conf = Math.round(confidence * 100);

  // Tier precedence: shortfall > forced > confidence band
  const tier =
    shortfall ? 'shortfall' :
    forced    ? 'forced'    :
    confidence >= 0.7 ? 'high' :
    confidence >= 0.4 ? 'medium' :
    'low';

  const tiers = {
    high:      { label: 'ביטחון גבוה',  bar: 'bg-mil-success', text: 'text-mil-success', bg: 'bg-mil-success-bg', border: 'border-mil-success-border' },
    medium:    { label: 'ביטחון בינוני', bar: 'bg-mil-warn',    text: 'text-mil-warn',    bg: 'bg-mil-warn-bg',    border: 'border-mil-warn-border' },
    low:       { label: 'ביטחון נמוך',   bar: 'bg-mil-alert',   text: 'text-mil-alert',   bg: 'bg-mil-alert-bg',   border: 'border-mil-alert-border' },
    forced:    { label: 'שיבוץ בכפייה',  bar: 'bg-mil-sand',    text: 'text-mil-sand',    bg: 'bg-mil-sand-bg',    border: 'border-mil-sand/40' },
    shortfall: { label: 'חוסר איוש',     bar: 'bg-mil-alert',   text: 'text-mil-alert',   bg: 'bg-mil-alert-bg',   border: 'border-mil-alert-border' },
  } as const;
  const t = tiers[tier];

  // Bar width: forced/shortfall always full-red bar; otherwise = conf%
  const widthPct = tier === 'forced' || tier === 'shortfall' ? 100 : Math.max(8, conf);

  const hasDecay = decayReasons && decayReasons.length > 0;

  return (
    <div className={`-mx-1 -mt-1 mb-0.5 px-3 py-2.5 rounded-lg ${t.bg} border ${t.border}`}>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className={`text-tiny font-bold ${t.text}`}>{t.label}</span>
        <span className="text-xxs tabular-nums text-mil-muted font-mono">{conf}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-mil-bg-alt overflow-hidden">
        <div className={`h-full ${t.bar} transition-[width] duration-300`} style={{ width: `${widthPct}%` }} />
      </div>

      {/* Decay reasons — surfaced explicitly so confidence is never a
          "magic number". Operator sees the exact stressors that lowered
          it (forced fills, shortfall, override chain, etc). */}
      {hasDecay && (
        <ul className="mt-2 space-y-0.5">
          {decayReasons!.map((reason, i) => (
            <li key={i} className={`text-xxs ${t.text} flex items-baseline gap-1`}>
              <span aria-hidden>↓</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Candidate row with hover-tooltip score breakdown ────────────────

function CandidateRow({
  score, soldiers, burden, selected, onToggle, badge,
}: {
  score: CandidateScore;
  soldiers: Soldier[];
  burden?: import('../types').SoldierBurden;
  selected: boolean;
  onToggle: () => void;
  badge: 'picked' | 'alternate' | 'forced';
}) {
  const soldier = soldiers.find((s) => s.id === score.soldierId);
  const [open, setOpen] = useState(false);

  const tone =
    badge === 'forced'    ? 'border-mil-alert-border bg-mil-alert-bg' :
    badge === 'alternate' ? 'border-mil-border bg-mil-card' :
    selected              ? 'border-mil-olive bg-mil-olive-bg' :
    'border-mil-border bg-mil-card';

  return (
    <div className={`rounded-xl-soft border ${tone} overflow-hidden transition-colors`}>
      <button
        onClick={onToggle}
        className="w-full text-right px-3.5 py-3 flex items-center gap-3 hover:bg-mil-card-hover transition-colors"
        type="button"
      >
        <span
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
            selected ? 'bg-mil-olive border-mil-olive text-white' : 'border-mil-border-strong'
          }`}
        >
          {selected && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>
        <div className="flex-1 min-w-0">
          <Body className="font-semibold leading-tight">{soldier?.name ?? score.soldierId}</Body>
          {burden && (
            <Hint className="block mt-0.5 text-tiny truncate">{burden.headline}</Hint>
          )}
        </div>
        <ScoreBadge score={score.score} />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          className="w-7 h-7 flex items-center justify-center rounded-md text-mil-muted hover:text-mil-text hover:bg-mil-bg-alt transition-colors"
          aria-label="הסבר ציון"
        >
          <span className="text-tiny font-mono">{open ? '−' : '+'}</span>
        </button>
      </button>

      {open && <ScoreBreakdown score={score} />}

      {score.hardFiltersFailed.length > 0 && !open && (
        <div className="px-3.5 pb-2 -mt-1 flex flex-wrap gap-1.5">
          {score.hardFiltersFailed.map((code) => (
            <span
              key={code}
              className="text-xxs font-semibold bg-mil-alert/10 text-mil-alert border border-mil-alert/30 px-1.5 py-0.5 rounded-md"
            >
              {hardFilterLabel(code)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 70 ? 'bg-mil-success text-white' :
    score >= 40 ? 'bg-mil-warn   text-white' :
    'bg-mil-alert text-white';
  return (
    <span className={`text-tiny font-bold tabular-nums rounded-md px-2 py-1 ${tone}`}>
      {Math.round(score)}
    </span>
  );
}

function ScoreBreakdown({ score }: { score: CandidateScore }) {
  return (
    <div className="border-t border-mil-border bg-mil-bg-alt/50 px-3.5 py-3 space-y-2">
      {score.dimensions.map((d) => (
        <DimensionRow key={d.key} dim={d} />
      ))}
      {score.hardFiltersFailed.length > 0 && (
        <div className="pt-2 border-t border-mil-border">
          <Hint className="block mb-1.5 text-mil-alert font-semibold">
            סיבות לאי-זכאות
          </Hint>
          <div className="flex flex-wrap gap-1.5">
            {score.hardFiltersFailed.map((code) => (
              <span
                key={code}
                className="text-tiny font-semibold bg-mil-alert/10 text-mil-alert border border-mil-alert/30 px-2 py-0.5 rounded-md"
              >
                {hardFilterLabel(code)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DimensionRow({ dim }: { dim: CandidateScoreDimension }) {
  const labels = {
    load:      'עומס',
    fatigue:   'מנוחה',
    qualMatch: 'כשירויות',
    cohesion:  'לכידות כיתה',
    burden:    'שחיקה',
  } as const;
  const isBurden = dim.key === 'burden';
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xxs font-semibold text-mil-muted w-20 flex-shrink-0">
        {labels[dim.key]}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-mil-bg-alt overflow-hidden">
        <div
          className={`h-full transition-[width] duration-300 ${
            isBurden
              ? dim.value > 60 ? 'bg-mil-alert' : dim.value > 30 ? 'bg-mil-warn' : 'bg-mil-success'
              : dim.value >= 70 ? 'bg-mil-success' : dim.value >= 40 ? 'bg-mil-warn' : 'bg-mil-alert'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, dim.value))}%` }}
        />
      </div>
      <Hint className="text-tiny tabular-nums w-32 flex-shrink-0 text-left">
        {dim.explain}
      </Hint>
    </div>
  );
}

// ─── Forced candidates section ───────────────────────────────────────

function ForcedCandidatesToggle({
  visible, forcedPickedFromOutcome, onShow, onHide, ctx, pickedIds, onTogglePick,
}: {
  visible: boolean;
  forcedPickedFromOutcome: SelectorOutcome['picked'];
  onShow: () => void;
  onHide: () => void;
  ctx: ReturnType<typeof useEngineContext>;
  pickedIds: Set<string>;
  onTogglePick: (id: string, fails: HardFilterCode[]) => void;
}) {
  if (!visible) {
    return (
      <button
        type="button"
        onClick={onShow}
        className="w-full text-tiny font-semibold text-mil-alert hover:text-mil-alert/80 py-2"
      >
        + הצג מועמדים בכפייה (override)
      </button>
    );
  }
  return (
    <section className="bg-mil-alert-bg border border-mil-alert-border rounded-xl-soft p-3.5">
      <div className="flex items-baseline justify-between mb-2">
        <Hint className="text-mil-alert font-semibold">
          ⚠ מועמדים בכפייה — דורש אישור מ״פ
        </Hint>
        <button
          type="button"
          onClick={onHide}
          className="text-xxs text-mil-muted hover:text-mil-text"
        >
          הסתר
        </button>
      </div>
      {forcedPickedFromOutcome.length === 0 ? (
        <Muted className="block text-tiny">אין מועמדים בכפייה זמינים.</Muted>
      ) : (
        <div className="space-y-2">
          {forcedPickedFromOutcome.map((p) => (
            <CandidateRow
              key={p.soldierId}
              score={p.score}
              soldiers={ctx.soldiers}
              burden={ctx.burdens[p.soldierId]}
              selected={pickedIds.has(p.soldierId)}
              onToggle={() => onTogglePick(p.soldierId, p.score.hardFiltersFailed)}
              badge="forced"
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Rejected candidates ("Why not") ─────────────────────────────────
//
// Phase 6.2 refinement: operators want to see not only WHO was picked,
// but also WHY OTHERS WEREN'T. Otherwise they assume the engine has
// overlooked a candidate. This section surfaces every pool member that
// the engine filtered out, with the SPECIFIC hard-filter reasons shown
// as pills (e.g. "בבית", "חסר ציוד critical").
//
// Collapsed by default — keeps the StaffingSheet lean. One tap opens.

function RejectedCandidatesToggle({
  rejected, visible, onShow, onHide, ctx,
}: {
  rejected: CandidateScore[];
  visible: boolean;
  onShow: () => void;
  onHide: () => void;
  ctx: ReturnType<typeof useEngineContext>;
}) {
  if (rejected.length === 0) return null;

  if (!visible) {
    return (
      <button
        type="button"
        onClick={onShow}
        className="w-full text-tiny font-semibold text-mil-muted hover:text-mil-text py-2"
      >
        + הצג {rejected.length} מועמדים שנדחו (למה לא?)
      </button>
    );
  }
  return (
    <section className="bg-mil-bg-alt border border-mil-border rounded-xl-soft p-3.5">
      <div className="flex items-baseline justify-between mb-2">
        <Hint className="text-mil-muted font-semibold">
          מועמדים שנדחו · {rejected.length}
        </Hint>
        <button
          type="button"
          onClick={onHide}
          className="text-xxs text-mil-muted hover:text-mil-text"
        >
          הסתר
        </button>
      </div>
      <Muted className="block mb-3 text-xxs">
        ה-engine סינן אותם בעקבות hard filter. ניתן לעקוף דרך &quot;מועמדים בכפייה&quot;.
      </Muted>
      <div className="space-y-1.5">
        {rejected.slice(0, 20).map((s) => {
          const soldier = ctx.soldiers.find((sld) => sld.id === s.soldierId);
          return (
            <div
              key={s.soldierId}
              className="bg-mil-card border border-mil-border rounded-md px-3 py-2 flex items-baseline gap-2"
            >
              <Body className="font-semibold text-sm flex-shrink-0">
                {soldier?.name ?? s.soldierId}
              </Body>
              <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                {s.hardFiltersFailed.map((code) => (
                  <span
                    key={code}
                    className="text-xxs font-semibold bg-mil-alert/10 text-mil-alert border border-mil-alert/30 px-1.5 py-0.5 rounded-md"
                  >
                    {hardFilterLabel(code)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        {rejected.length > 20 && (
          <Hint className="block text-tiny pt-1">+{rejected.length - 20} נוספים</Hint>
        )}
      </div>
    </section>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatSlotTime(slot: MaterializedSlot): string {
  const s = new Date(slot.start);
  const e = new Date(slot.end);
  const day = s.toISOString().slice(0, 10);
  const hh = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${day} · ${hh(s)}–${hh(e)}`;
}

function hardFilterLabel(code: HardFilterCode): string {
  const labels: Record<HardFilterCode, string> = {
    'soldier-home':              'בבית',
    'soldier-inactive':          'לא פעיל',
    'on-leave':                  'בחופשה',
    'in-leave-cycle-home':       'בסבב הביתה',
    'duty-exclusion':            'פטור מסבב',
    'missing-qualifications':    'חסר הכשרות',
    'wrong-platoon':             'לא במחלקה',
    'time-conflict':             'התנגשות זמן',
    'squad-policy-violation':    'מפר מדיניות כיתה',
    'critical-equipment-missing': 'חסר ציוד critical',
  };
  return labels[code] ?? code;
}
