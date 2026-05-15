// useChaosContext — simulation/debug overlay over the engine context.
//
// PURPOSE: pre-production verification that the engine reacts correctly
// to operational chaos (vanished soldiers, equipment shortfalls, sudden
// escalations, platoon-home cycles, fatigue spikes). The simulator lets
// CC/QA flip a switch and inject scenarios WITHOUT touching live data.
//
// ARCHITECTURE: chaos mode wraps the result of useEngineContext with a
// transformed snapshot. The engine itself remains pure — it cannot tell
// whether it received live data or a chaos injection. This means:
//   • the same engine code runs in both modes (no special branches)
//   • new scenarios are added as ChaosScenario types, not engine logic
//   • engine evolution is automatically tested by chaos simulations
//
// PRESENTATION: when chaos mode is active, the UI MUST show a yellow
// banner ("CHAOS MODE — נתונים סינתטיים") so users never confuse the
// simulation with reality. The banner is wired in the chaos page.

import { useMemo } from 'react';
import { useEngineContext } from './useEngineContext';
import type { EngineContext, Leave } from '../types';

export type ChaosScenarioKind =
  // ── Chaos (negative perturbations) ─────────────────────────────
  | 'soldier-vanished'    // mark N soldiers as inactive-temp
  | 'equipment-missing'   // strip the company of one equipment item
  | 'escalation-active'   // inject an active escalation entity
  | 'platoon-home'        // mark a whole platoon as currentStatus='home'
  | 'fatigue-spike'       // set high currentLoad on N soldiers
  | 'manpower-collapse'   // mark > 50% of soldiers home (stress test)
  // ── Recovery (positive perturbations) ──────────────────────────
  // Restore from a chaos state. Useful for verifying that the engine
  // stabilizes once disruption ends — that alerts clear, confidence
  // recovers, and replaced soldiers re-enter the candidate pool.
  | 'soldier-returned'    // restore all inactive-temp to in-base
  | 'equipment-found'     // restore signed equipment that was stripped
  | 'escalation-closed'   // resolve any injected escalation
  | 'platoon-returned';   // restore platoon-home soldiers to in-base

export interface ChaosScenarioOptions {
  kind: ChaosScenarioKind;
  /** When the scenario picks N soldiers, this caps how many. */
  count?: number;
  /** When the scenario targets a specific platoon, this is its id. */
  platoonId?: string;
  /** When equipment-missing, the item id to strip. */
  equipmentItemId?: string;
  /** Free-text label surfaced in the chaos banner. */
  label?: string;
}

export interface ChaosState {
  /** True when at least one scenario is active. The UI shows the
   *  warning banner only when this is true. */
  active: boolean;
  /** Currently-applied scenarios. Multiple can stack. */
  scenarios: ChaosScenarioOptions[];
}

/**
 * Build an EngineContext that has chaos overrides applied. When `state.
 * active === false`, this is identical to the live useEngineContext.
 */
export function useChaosContext(state: ChaosState): EngineContext {
  const base = useEngineContext();

  return useMemo(() => {
    if (!state.active || state.scenarios.length === 0) return base;

    let ctx = base;
    for (const scenario of state.scenarios) {
      ctx = applyScenario(ctx, scenario);
    }
    return ctx;
  }, [base, state]);
}

// ─── Scenario applicators — each returns a fresh EngineContext ──────

function applyScenario(ctx: EngineContext, scenario: ChaosScenarioOptions): EngineContext {
  switch (scenario.kind) {
    // Chaos
    case 'soldier-vanished':    return chaosSoldiersVanished(ctx, scenario.count ?? 1);
    case 'equipment-missing':   return chaosEquipmentMissing(ctx, scenario.equipmentItemId);
    case 'escalation-active':   return chaosEscalationActive(ctx);
    case 'platoon-home':        return chaosPlatoonHome(ctx, scenario.platoonId);
    case 'fatigue-spike':       return chaosFatigueSpike(ctx, scenario.count ?? 3);
    case 'manpower-collapse':   return chaosManpowerCollapse(ctx);
    // Recovery — applied last in the chain to verify engine re-stabilization
    case 'soldier-returned':    return recoverSoldiersReturned(ctx);
    case 'equipment-found':     return recoverEquipmentFound(ctx);
    case 'escalation-closed':   return recoverEscalationClosed(ctx);
    case 'platoon-returned':    return recoverPlatoonReturned(ctx, scenario.platoonId);
  }
}

function chaosSoldiersVanished(ctx: EngineContext, n: number): EngineContext {
  // Pick the first N active in-base soldiers and mark them inactive-temp.
  const active = ctx.soldiers.filter((s) => s.currentStatus === 'in-base').slice(0, n);
  const ids = new Set(active.map((s) => s.id));
  return {
    ...ctx,
    soldiers: ctx.soldiers.map((s) =>
      ids.has(s.id)
        ? { ...s, currentStatus: 'inactive-temp' as const, statusSetAt: ctx.computedAt }
        : s,
    ),
  };
}

function chaosEquipmentMissing(ctx: EngineContext, itemId: string | undefined): EngineContext {
  if (!itemId) return ctx;
  // Remove all signed equipment entries for that item — simulates the
  // company physically losing the item.
  return {
    ...ctx,
    signedEquipment: ctx.signedEquipment.filter((se) => se.equipmentItemId !== itemId),
  };
}

function chaosEscalationActive(ctx: EngineContext): EngineContext {
  // Inject is via the EscalationEvent layer, which isn't on the engine
  // context (escalations flow through extras to focus.ts). For now we
  // mark the chaos label and let downstream consumers (focus builder
  // and banners) pick it up via the chaos state. This is a stub — full
  // simulation lands when escalations are added to EngineContext.
  return ctx;
}

function chaosPlatoonHome(ctx: EngineContext, platoonId: string | undefined): EngineContext {
  if (!platoonId) return ctx;
  // Find squads of this platoon, then all soldiers in those squads.
  const squadIds = new Set(ctx.squads.filter((sq) => sq.platoonId === platoonId).map((sq) => sq.id));
  const affectedIds = new Set(ctx.soldiers
    .filter((s) => s.squadId && squadIds.has(s.squadId))
    .map((s) => s.id),
  );
  // Synthesize a Leave covering the next 7 days for each soldier so
  // the engine's on-leave hard filter activates naturally.
  const startIso = ctx.computedAt;
  const endIso = addDays(ctx.computedAt, 7);
  const startDate = startIso.slice(0, 10);
  const endDate = endIso.slice(0, 10);
  const synthLeaves: Leave[] = Array.from(affectedIds).map((id) => ({
    id: `chaos-leave-${id}`,
    scope: 'individual' as const,
    soldierIds: [id],
    startDate, startTime: '00:00',
    endDate,   endTime:   '23:59',
    createdBy: 'chaos-sim', createdByName: 'CHAOS SIMULATION',
    note: `מחלקה ${platoonId} בבית — סימולציה`,
    // Mark with synthetic flag so the UI can hide these in real views
  } as Leave & { _chaos?: true }));

  return {
    ...ctx,
    soldiers: ctx.soldiers.map((s) =>
      affectedIds.has(s.id)
        ? { ...s, currentStatus: 'home' as const, statusSetAt: ctx.computedAt }
        : s,
    ),
    leaves: [...ctx.leaves, ...synthLeaves],
  };
}

function chaosFatigueSpike(ctx: EngineContext, n: number): EngineContext {
  // Pick the first N active soldiers and bump their currentLoad to max.
  const active = ctx.soldiers.filter((s) => s.currentStatus === 'in-base').slice(0, n);
  const ids = new Set(active.map((s) => s.id));
  const maxLoad = Math.max(...ctx.soldiers.map((s) => s.currentLoad ?? 0), 10);
  return {
    ...ctx,
    soldiers: ctx.soldiers.map((s) =>
      ids.has(s.id) ? { ...s, currentLoad: maxLoad * 2 } : s,
    ),
  };
}

function chaosManpowerCollapse(ctx: EngineContext): EngineContext {
  // Mark > 50% of the company as home.
  const inBase = ctx.soldiers.filter((s) => s.currentStatus === 'in-base');
  const target = Math.ceil(inBase.length * 0.6);
  const affected = new Set(inBase.slice(0, target).map((s) => s.id));
  return {
    ...ctx,
    soldiers: ctx.soldiers.map((s) =>
      affected.has(s.id) ? { ...s, currentStatus: 'home' as const, statusSetAt: ctx.computedAt } : s,
    ),
  };
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString();
}

// ─── Recovery applicators — restore engine to a stable state ────────
//
// Each recovery scenario is an INVERSE of a chaos scenario. Applied
// last in the chain. The cleanest demonstration:
//   1. Activate `soldier-vanished` → see vacancy alerts + replacements
//   2. Activate `soldier-returned` → see alerts clear + candidates restored
// This verifies the engine actually re-stabilizes (not stuck in a
// "chaos memory").

function recoverSoldiersReturned(ctx: EngineContext): EngineContext {
  // Restore every inactive-temp soldier to in-base. The chaos applicator
  // for `soldier-vanished` flips them to 'inactive-temp'; this reverses.
  return {
    ...ctx,
    soldiers: ctx.soldiers.map((s) =>
      s.currentStatus === 'inactive-temp'
        ? { ...s, currentStatus: 'in-base' as const, statusSetAt: ctx.computedAt }
        : s,
    ),
  };
}

function recoverEquipmentFound(ctx: EngineContext): EngineContext {
  // This is a no-op without persistence of what was stripped. The chaos
  // applicator removes signed_equipment entries; we can't reconstruct
  // them here without a side channel. Documented as stub — the audit
  // history (Phase 6.3+) will let recovery actually replay from log.
  // For now, recovery is a "no further damage" signal rather than an undo.
  return ctx;
}

function recoverEscalationClosed(ctx: EngineContext): EngineContext {
  // Mirror of `chaosEscalationActive` which is itself a stub. When the
  // engine context gains an `escalations` field, this will mark all
  // synthetic escalations as closed.
  return ctx;
}

function recoverPlatoonReturned(ctx: EngineContext, platoonId: string | undefined): EngineContext {
  if (!platoonId) {
    // No specific platoon — restore ALL home soldiers to in-base. This
    // is the broad "recall everyone" simulation.
    return {
      ...ctx,
      soldiers: ctx.soldiers.map((s) =>
        s.currentStatus === 'home'
          ? { ...s, currentStatus: 'in-base' as const, statusSetAt: ctx.computedAt }
          : s,
      ),
      // Strip synthetic chaos leaves (id prefix 'chaos-leave-').
      leaves: ctx.leaves.filter((lv) => !lv.id.startsWith('chaos-leave-')),
    };
  }
  // Scope to one platoon.
  const squadIds = new Set(ctx.squads.filter((sq) => sq.platoonId === platoonId).map((sq) => sq.id));
  const affectedIds = new Set(ctx.soldiers
    .filter((s) => s.squadId && squadIds.has(s.squadId))
    .map((s) => s.id),
  );
  return {
    ...ctx,
    soldiers: ctx.soldiers.map((s) =>
      affectedIds.has(s.id) && s.currentStatus === 'home'
        ? { ...s, currentStatus: 'in-base' as const, statusSetAt: ctx.computedAt }
        : s,
    ),
    leaves: ctx.leaves.filter((lv) =>
      !(lv.id.startsWith('chaos-leave-') && lv.soldierIds.some((id) => affectedIds.has(id))),
    ),
  };
}

// ─── Catalog for the chaos picker UI ────────────────────────────────

export interface ScenarioCatalogEntry {
  kind: ChaosScenarioKind;
  /** 'chaos' = disrupts; 'recovery' = restores. Drives section grouping. */
  category: 'chaos' | 'recovery';
  label: string;
  description: string;
  defaults?: Partial<ChaosScenarioOptions>;
}

export const CHAOS_SCENARIOS: ScenarioCatalogEntry[] = [
  // ── Chaos ──────────────────────────────────────────────────────
  {
    kind: 'soldier-vanished', category: 'chaos',
    label: 'חייל נעלם',
    description: 'מסמן N חיילים פעילים כ-inactive-temp. בודק replacement flow.',
    defaults: { count: 1 },
  },
  {
    kind: 'fatigue-spike', category: 'chaos',
    label: 'עומס פתאומי',
    description: 'מעלה את ה-load של N חיילים למקסימום. בודק burden penalty.',
    defaults: { count: 3 },
  },
  {
    kind: 'platoon-home', category: 'chaos',
    label: 'מחלקה בבית',
    description: 'מסמן את כל חיילי מחלקה כ-home + יוצר leaves סינתטיות. בודק coverage gap detection.',
  },
  {
    kind: 'manpower-collapse', category: 'chaos',
    label: 'קריסת סד״כ',
    description: 'מסמן 60% מהפלוגה כ-home. בודק manpower-shortfall alerts.',
  },
  {
    kind: 'equipment-missing', category: 'chaos',
    label: 'חוסר ציוד',
    description: 'מוחק חתימות פעילות של פריט מסוים. בודק critical-equipment-missing.',
  },
  {
    kind: 'escalation-active', category: 'chaos',
    label: 'הקפצה פעילה',
    description: '[stub] להוסיף escalation ל-EngineContext + לבדוק focus builder.',
  },
  // ── Recovery ───────────────────────────────────────────────────
  {
    kind: 'soldier-returned', category: 'recovery',
    label: 'חיילים חזרו',
    description: 'משיב את כל inactive-temp ל-in-base. בודק שה-engine מתייצב.',
  },
  {
    kind: 'platoon-returned', category: 'recovery',
    label: 'מחלקה חזרה לבסיס',
    description: 'משיב מחלקה מ-home ל-in-base + מוחק leaves סינתטיות. בודק alert clearance.',
  },
  {
    kind: 'equipment-found', category: 'recovery',
    label: 'ציוד נמצא',
    description: '[stub] משיב signed_equipment שנמחק. דורש audit history של ה-chaos applicator.',
  },
  {
    kind: 'escalation-closed', category: 'recovery',
    label: 'הקפצה נסגרה',
    description: '[stub] סוגר escalation שהוזרק. דורש escalations ב-EngineContext.',
  },
];
