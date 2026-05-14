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
  OverrideAlertStatus,
} from '../types';
import { read, simulate, USE_SUPABASE, supabase } from './_adapter';

type OverrideRisk = NonNullable<OverrideAlert['riskLevel']>;

// ─── Override alerts table reads / writes ──────────────────────────────
//
// The Alert union surfaced in the UI is a projection over multiple
// sources (missions, escalations, gaps, platoon floor, override_alerts).
// `listOverrideAlerts` exposes the raw override_alerts table for the
// engine and admin surfaces.

export async function listOverrideAlerts(companyId: string): Promise<OverrideAlert[]> {
  if (USE_SUPABASE) {
    const { data, error } = await supabase()
      .from('override_alerts')
      .select('*')
      .eq('company_id', companyId);
    if (error) throw error;
    return (data ?? []).map(mapOverrideAlert);
  }
  return simulate(read.overrideAlerts().filter((a) => a.companyId === companyId));
}

export async function acknowledgeOverride(id: string, byUserId: string): Promise<void> {
  if (!USE_SUPABASE) return simulate(undefined);
  const { error } = await supabase()
    .from('override_alerts')
    .update({
      status: 'acknowledged' satisfies OverrideAlertStatus,
      acknowledged_by_user_id: byUserId,
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

export async function resolveOverride(id: string, byUserId: string): Promise<void> {
  if (!USE_SUPABASE) return simulate(undefined);
  const { error } = await supabase()
    .from('override_alerts')
    .update({
      status: 'resolved' satisfies OverrideAlertStatus,
      resolved_by_user_id: byUserId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

interface OverrideRow {
  id: string; company_id: string; platoon_id: string | null;
  kind: string; description: string; suggested_action: string | null;
  risk_level: OverrideRisk; status: OverrideAlertStatus;
  acknowledged_by_user_id: string | null; acknowledged_at: string | null;
  resolved_by_user_id: string | null; resolved_at: string | null;
  created_at: string;
}

function mapOverrideAlert(r: OverrideRow): OverrideAlert {
  return {
    id: r.id,
    companyId: r.company_id,
    platoonId: r.platoon_id ?? '',
    kind: r.kind as OverrideAlert['kind'],
    description: r.description,
    actorUserId: '',                       // not persisted yet — engine fills client-side
    actorName: '',
    suggestedAction: r.suggested_action ?? undefined,
    riskLevel: r.risk_level,
    status: r.status,
    acknowledgedByUserId: r.acknowledged_by_user_id ?? undefined,
    acknowledgedAt: r.acknowledged_at ?? undefined,
    resolvedByUserId: r.resolved_by_user_id ?? undefined,
    resolvedAt: r.resolved_at ?? undefined,
    timestamp: r.created_at,
  } as OverrideAlert;
}

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

  // 5. Open equipment gaps awaiting Rasap attention (round 6)
  const gaps = read.signedEquipment(); void gaps; // touch to keep adapter happy
  for (const g of read.equipmentGaps?.() ?? []) {
    if (g.companyId !== companyId) continue;
    if (platoonId && g.reportedByPlatoonId !== platoonId) continue;
    if (g.status === 'resolved' || g.status === 'dismissed') continue;
    out.push({
      id:        `alert-gap-${g.id}`,
      companyId: g.companyId,
      kind:      'override-open', // reuse kind — UI groups by source
      severity:  g.status === 'forwarded-to-rasap' ? 'warning' : 'info',
      title:     `ליקוי ציוד · ${g.itemName}`,
      message:   g.description ?? g.reportedByName,
      occurredAt: g.createdAt,
      source:    { kind: 'override-alert', id: g.id },
      suggestedAction: 'פתח רס״פ',
      actionHref: '/rasap',
      platoonId:  g.reportedByPlatoonId,
    });
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
