// focus.ts — "what requires a decision RIGHT NOW".
//
// Pure function: (role, viewerUser, ctx) → FocusItem[].
//
// CRITICAL distinction from alerts:
//   • Alert  = "this happened" / "this needs attention"
//   • Focus  = "you must decide something, here's the decision"
//
// Filtering rules (Phase 6.0 review):
//   • Item must require HUMAN judgment (engine cannot resolve alone)
//   • Item must have operational impact within next 24h
//   • Item must surface a SPECIFIC primary action
//
// Display: max 5 items, sorted by decisionRequiredBy ascending.
// Items past deadline are auto-promoted to AlertsPage as critical.

import type {
  EngineContext, FocusItem, MockUser, UserRole,
  Mission, EscalationEvent, LeaveRequest, EquipmentGap,
} from '../../types';

const MS_PER_HOUR = 60 * 60 * 1000;
const HORIZON_HOURS = 24;
const MAX_FOCUS_ITEMS = 5;

/**
 * Build the focus list for a viewer. Different roles see different
 * items because their decisions differ:
 *
 *   CC / Deputy CC — escalations, recall non-compliance, mission staffing,
 *                    coverage gaps, escalations.
 *   PC / PS        — same scoped to their commanded platoon.
 *   Rasap          — equipment-blocking gaps + recall non-compliance.
 *   Soldier        — none (they don't make staffing decisions).
 */
export function buildFocusItems(
  viewer: MockUser,
  role: UserRole,
  ctx: EngineContext,
  extras: {
    /** Active escalations the viewer is in audience of. */
    activeEscalations: EscalationEvent[];
    /** Leave requests pending the viewer's approval. */
    pendingLeaveRequests: LeaveRequest[];
    /** Equipment gaps blocking near-term missions. */
    blockingGaps: EquipmentGap[];
  },
): FocusItem[] {
  const items: FocusItem[] = [];
  const nowMs = Date.parse(ctx.computedAt);
  const horizonMs = nowMs + HORIZON_HOURS * MS_PER_HOUR;

  const isCompanyTier = role === 'companyCommander'
    || role === 'deputyCompanyCommander'
    || role === 'owner';
  const isPlatoonTier = role === 'platoonCommander' || role === 'platoonSergeant';

  // ── 1. Active escalations (highest priority) ─────────────────────
  for (const esc of extras.activeEscalations) {
    items.push({
      id: `close-esc-${esc.id}`,
      kind: 'close-active-escalation',
      decisionPrompt: `הקפצה "${esc.reason}" פעילה — להמשיך או לסגור?`,
      context: `נפתחה ב-${esc.openedAt.slice(0, 16).replace('T', ' ')} · ${esc.audience.kind}`,
      decisionRequiredBy: ctx.computedAt, // immediate
      severity: 'critical',
      primaryAction: { label: 'פתח הקפצה', command: 'open-close-escalation' },
      secondaryActions: [{ label: 'דחה ב-2 שעות', href: '/alerts' }],
      source: { kind: 'escalation', id: esc.id },
    });
  }

  // ── 2. Recall non-compliance ─────────────────────────────────────
  // Leaves with wasRecalled=true where recalledAt > 24h ago AND the
  // soldier is still at status='home' (didn't return). The CC/PC must
  // decide what to do.
  if (isCompanyTier || isPlatoonTier) {
    const nonCompliantSoldiers = findNonCompliantRecalls(ctx, nowMs);
    for (const { soldier, leave } of nonCompliantSoldiers) {
      items.push({
        id: `recall-${soldier.id}-${leave.id}`,
        kind: 'recall-non-compliant',
        decisionPrompt: `${soldier.name} לא חזר מהקפצה — מה ההמשך?`,
        context: `נקרא ב-${leave.recalledAt?.slice(0, 16).replace('T', ' ')} · עדיין בבית`,
        decisionRequiredBy: addHours(leave.recalledAt ?? ctx.computedAt, 6),
        severity: 'critical',
        primaryAction: { label: 'עדכן סטטוס', command: 'open-recall-followup' },
        source: { kind: 'soldier-status', soldierId: soldier.id },
      });
    }
  }

  // ── 3. Missions starting soon with empty/short staffing ─────────
  const upcomingMissions = ctx.missions
    .filter((m) => {
      if (!m.startDate) return false;
      const start = Date.parse(`${m.startDate}T00:00:00`);
      return start > nowMs && start <= horizonMs;
    });

  for (const mission of upcomingMissions) {
    if (!isViewerInMissionScope(viewer, role, mission, ctx)) continue;
    if (mission.status !== 'partially-staffed' && mission.status !== 'active-unstaffed') continue;

    const startIso = `${mission.startDate}T00:00:00`;
    items.push({
      id: `staff-${mission.id}`,
      kind: 'staff-mission-now',
      decisionPrompt: `משימת ${mission.name} מתחילה ב-24 שעות הקרובות — חסרים שיבוצים`,
      context: `התחלה: ${formatRelative(startIso, ctx.computedAt)} · סטטוס: ${mission.status}`,
      decisionRequiredBy: startIso,
      severity: 'critical',
      primaryAction: { label: 'פתח איוש', command: 'open-staffing', href: `/mission/${mission.id}` },
      source: { kind: 'mission', id: mission.id },
    });
  }

  // ── 4. Pending leave requests > 8 hours old ─────────────────────
  if (isCompanyTier || isPlatoonTier) {
    const stale = extras.pendingLeaveRequests
      .filter((r) => r.status === 'pending')
      .filter((r) => nowMs - Date.parse(r.submittedAt) > 8 * MS_PER_HOUR);
    if (stale.length > 0) {
      items.push({
        id: `approve-pending-${stale.length}`,
        kind: 'approve-pending-leave',
        decisionPrompt: `${stale.length} בקשות יציאה ממתינות מעל 8 שעות`,
        context: `הראשונה: ${formatRelative(stale[0].submittedAt, ctx.computedAt)}`,
        decisionRequiredBy: addHours(ctx.computedAt, 4),
        severity: 'warning',
        primaryAction: { label: 'פתח בקשות', command: 'open-approve-leave', href: '/leaves' },
        source: { kind: 'leave', id: stale[0].id },
      });
    }
  }

  // ── 5. Critical equipment gaps blocking 24h missions ────────────
  for (const gap of extras.blockingGaps) {
    items.push({
      id: `gap-${gap.id}`,
      kind: 'resolve-critical-gap',
      decisionPrompt: `חסר ${gap.itemName} ל-${gap.reportedByName}`,
      context: `דווח: ${gap.createdAt.slice(0, 10)} · סטטוס: ${gap.status}`,
      decisionRequiredBy: addHours(gap.createdAt, 12),
      severity: 'warning',
      primaryAction: { label: 'פתח ליקוי', command: 'open-resolve-gap', href: '/rasap' },
      source: { kind: 'gap', id: gap.id },
    });
  }

  // ── Sort by decisionRequiredBy ascending, cap at 5 ──────────────
  items.sort((a, b) => Date.parse(a.decisionRequiredBy) - Date.parse(b.decisionRequiredBy));
  return items.slice(0, MAX_FOCUS_ITEMS);
}

// ─── Helpers ───────────────────────────────────────────────────────

function findNonCompliantRecalls(
  ctx: EngineContext,
  nowMs: number,
): Array<{ soldier: typeof ctx.soldiers[number]; leave: typeof ctx.leaves[number] }> {
  const out: Array<{ soldier: typeof ctx.soldiers[number]; leave: typeof ctx.leaves[number] }> = [];
  for (const lv of ctx.leaves) {
    if (!lv.wasRecalled || !lv.recalledAt) continue;
    const hoursSince = (nowMs - Date.parse(lv.recalledAt)) / MS_PER_HOUR;
    if (hoursSince < 6) continue;
    for (const soldierId of lv.soldierIds) {
      const soldier = ctx.soldiers.find((s) => s.id === soldierId);
      if (!soldier) continue;
      if (soldier.currentStatus === 'home') {
        out.push({ soldier, leave: lv });
      }
    }
  }
  return out;
}

function isViewerInMissionScope(
  viewer: MockUser,
  role: UserRole,
  mission: Mission,
  ctx: EngineContext,
): boolean {
  if (role === 'companyCommander' || role === 'deputyCompanyCommander' || role === 'owner') {
    return mission.companyId === viewer.companyId;
  }
  if (role === 'platoonCommander' || role === 'platoonSergeant') {
    const cmdedPlatoon = viewer.commandedPlatoonId;
    if (!cmdedPlatoon) return false;
    return mission.assignedPlatoonIds.includes(cmdedPlatoon);
  }
  // Soldier — only if explicitly assigned to a slot in this mission.
  // For now exclude soldiers from focus items entirely (no decisions to make).
  void ctx;
  return false;
}

function addHours(iso: string, hours: number): string {
  const d = new Date(Date.parse(iso) + hours * MS_PER_HOUR);
  return d.toISOString();
}

function formatRelative(targetIso: string, nowIso: string): string {
  const diffMs = Date.parse(targetIso) - Date.parse(nowIso);
  const absHours = Math.abs(diffMs / MS_PER_HOUR);
  if (absHours < 1) return diffMs > 0 ? 'בעוד פחות משעה' : 'לפני פחות משעה';
  if (absHours < 24) {
    const h = Math.round(absHours);
    return diffMs > 0 ? `בעוד ${h} שעות` : `לפני ${h} שעות`;
  }
  const d = Math.round(absHours / 24);
  return diffMs > 0 ? `בעוד ${d} ימים` : `לפני ${d} ימים`;
}
