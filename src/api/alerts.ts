// Alerts API.
//
// Two sources today:
//   1. OverrideAlert — events emitted by the override audit pipeline.
//   2. Projected alerts — derived from current state (unstaffed missions,
//      manpower shortfalls, active escalations, etc.) at read-time.
//
// The Alert type below unifies them so consumers don't care about origin.

import type {
  Alert, AlertSeverity, AlertKind,
  Mission, Platoon, Soldier, Squad, EscalationEvent, OverrideAlert, Leave,
} from '../types';
import { read, simulate } from './_adapter';

interface ProjectionInputs {
  companyId: string;
  /** When set, narrow projections to a single platoon scope. */
  platoonId?: string;
}

/** Project the operational state into a sorted Alert[] for the viewer. */
export function listForCompany(inputs: ProjectionInputs): Promise<Alert[]> {
  const { companyId, platoonId } = inputs;

  const missions   = read.missions().filter((m) => m.companyId === companyId);
  const platoons   = read.platoons().filter((p) => p.companyId === companyId);
  const soldiers   = read.soldiers().filter((s) => s.companyId === companyId);
  const squads     = read.squads();
  const overrides  = read.overrideAlerts().filter((a) => a.companyId === companyId);
  const escs       = read.escalationEvents().filter((e) => e.companyId === companyId);
  const leaves     = read.leaves();

  const out: Alert[] = [];

  // 1. Active escalations — highest priority
  for (const e of escs.filter((x) => x.status === 'active')) {
    out.push(escalationToAlert(e));
  }

  // 2. Unstaffed missions
  for (const m of missions) {
    if (m.status === 'active-unstaffed' || m.status === 'staffing-pending') {
      if (platoonId && !m.assignedPlatoonIds.includes(platoonId)) continue;
      out.push(unstaffedMissionToAlert(m));
    }
  }

  // 3. Open override alerts (existing pipeline)
  for (const ov of overrides.filter((o) => o.status === 'open')) {
    if (platoonId && ov.platoonId !== platoonId) continue;
    out.push(overrideToAlert(ov));
  }

  // 4. Platoon-floor shortfalls (today)
  for (const p of platoons) {
    if (platoonId && p.id !== platoonId) continue;
    const shortfall = computePlatoonShortfall(p, squads, soldiers, leaves);
    if (shortfall) {
      out.push(shortfallToAlert(p, shortfall));
    }
  }

  // Sort by severity then time
  const sevRank: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  out.sort((a, b) => {
    if (a.severity !== b.severity) return sevRank[a.severity] - sevRank[b.severity];
    return b.occurredAt.localeCompare(a.occurredAt);
  });

  return simulate(out);
}

// ─── Projections ─────────────────────────────────────────────────────────

function escalationToAlert(e: EscalationEvent): Alert {
  return {
    id:          `alert-esc-${e.id}`,
    companyId:   e.companyId,
    kind:        'escalation-active',
    severity:    'critical',
    title:       `הקפצה פעילה · ${e.reason}`,
    message:     e.location ? `התייצבות ${e.location}` : 'התייצבות',
    occurredAt:  e.openedAt,
    source:      { kind: 'escalation', id: e.id },
    suggestedAction: 'פתח את ההקפצה',
    actionHref:  '/home',
  };
}

function unstaffedMissionToAlert(m: Mission): Alert {
  return {
    id:          `alert-mission-${m.id}`,
    companyId:   m.companyId,
    kind:        'mission-unstaffed',
    severity:    'warning',
    title:       `${m.name} ללא איוש`,
    message:     'המשימה פעילה אך אין חיילים משובצים אליה',
    occurredAt:  m.createdAt,
    source:      { kind: 'mission', id: m.id },
    suggestedAction: 'אייש משימה',
    actionHref:  `/mission/${m.id}`,
  };
}

function overrideToAlert(ov: OverrideAlert): Alert {
  return {
    id:          `alert-override-${ov.id}`,
    companyId:   ov.companyId,
    kind:        'override-open',
    severity:    ov.riskLevel === 'high' ? 'critical' : 'warning',
    title:       ov.description,
    message:     ov.suggestedAction,
    occurredAt:  ov.timestamp,
    source:      { kind: 'override-alert', id: ov.id },
    actionHref:  '/schedule',
  };
}

function shortfallToAlert(p: Platoon, shortfall: { onBase: number; required: number }): Alert {
  return {
    id:          `alert-floor-${p.id}-${new Date().toISOString().slice(0, 10)}`,
    companyId:   p.companyId,
    kind:        'manpower-shortfall',
    severity:    'critical',
    title:       `${p.name} מתחת לסד״כ`,
    message:     `${shortfall.onBase}/${shortfall.required} בבסיס`,
    occurredAt:  new Date().toISOString(),
    source:      { kind: 'platoon', id: p.id },
    suggestedAction: 'פתח שיבוץ',
    actionHref:  '/schedule',
  };
}

function computePlatoonShortfall(
  p: Platoon, squads: Squad[], soldiers: Soldier[], leaves: Leave[],
): { onBase: number; required: number } | null {
  const required = p.minSoldiersOnBase ?? 0;
  if (required === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  const sqIds = new Set(squads.filter((s) => s.platoonId === p.id).map((s) => s.id));
  const ps    = soldiers.filter((s) => s.squadId && sqIds.has(s.squadId));
  const onLeaveIds = new Set<string>();
  for (const lv of leaves) {
    if (today < lv.startDate || today > lv.endDate) continue;
    if (lv.scope === 'individual') lv.soldierIds.forEach((id) => onLeaveIds.add(id));
    else if (lv.scope === 'squad') ps.filter((s) => s.squadId === lv.squadId).forEach((s) => onLeaveIds.add(s.id));
  }
  const onBase = ps.filter((s) => s.currentStatus === 'in-base' && !onLeaveIds.has(s.id)).length;
  return onBase < required ? { onBase, required } : null;
}

// Provide kind enum for callers that need to filter
export const ALERT_KINDS: AlertKind[] = [
  'escalation-active', 'mission-unstaffed', 'override-open',
  'manpower-shortfall', 'announcement-operational',
];
