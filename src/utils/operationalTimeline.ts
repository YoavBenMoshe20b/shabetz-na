// operationalTimeline.ts — role-scoped time-flow awareness layer.
//
// Sits ABOVE the existing layers (missions / archetypes / templates /
// conflicts / fatigue / readiness / leave) and converts the live state
// into a stream of TimelineEvent[]: "in 2 hours the guard hands over",
// "מחלקה 2 חוזרת ב-06:00", "no שבצ״ק published for tomorrow".
//
// SCOPING DISCIPLINE
// Every event declares the scope(s) it belongs to. The selection
// helper filters by viewer + page so:
//   • a soldier never sees platoon-wide noise on their home page;
//   • a PC sees their platoon's pressure, not other platoons';
//   • the home page renders ONLY the critical handful per role.
//
// PURE
// No React, no Date.now() at module level — `nowIso` is passed in.
// The legacy src/utils/timeline.ts (platoon-only ops events) stays
// untouched; this file is the company-wide derivation that drives
// the new strip + role-scoped surfaces.

import type {
  Mission, Platoon, Soldier, PlatoonLeaveDay, Announcement,
} from '../types';
import type { MaterializedSlot } from './materialize';

// ─── Event kinds ────────────────────────────────────────────────────

export type TimelineEventKind =
  | 'next-shift'
  | 'shift-end-now'
  | 'shift-handover'
  | 'readiness-on'
  | 'platoon-leaving-home'
  | 'platoon-returning'
  | 'publish-deadline'
  | 'staffing-pressure'
  | 'concurrent-critical'
  | 'leave-conflict-imminent';

export type TimelineSeverity = 'info' | 'warn' | 'alert' | 'critical';

export type TimelineScope =
  | { kind: 'soldier'; soldierId: string }
  | { kind: 'platoon'; platoonId: string }
  | { kind: 'company'; companyId: string };

export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  /** When the event "happens" on the strip (ISO). */
  atIso: string;
  /** When the event becomes irrelevant — drives auto-dismiss. ISO. */
  expiresAtIso?: string;
  title: string;
  description?: string;
  severity: TimelineSeverity;
  /** SPA route the operator should go to from this event. */
  href?: string;
  /** Whom this event is RELEVANT to. The selection helper matches
   *  every viewer-scope; events appear in every matching context. */
  scopes: TimelineScope[];
  missionId?: string;
  platoonId?: string;
  soldierId?: string;
}

// ─── Derivation inputs ──────────────────────────────────────────────

export interface DeriveTimelineInput {
  /** ISO timestamp of "now" — passed in, never read from Date.now(). */
  nowIso: string;
  /** How far into the future to look. Default 48h. */
  horizonHours?: number;
  slots: MaterializedSlot[];
  missions: Mission[];
  platoons: Platoon[];
  soldiers: Soldier[];
  platoonLeaveDays: PlatoonLeaveDay[];
  announcements: Announcement[];
  companyId: string;
  /** Stale-publish threshold. Default 18h. */
  publishWindowHours?: number;
}

// ─── Derive ─────────────────────────────────────────────────────────

const MS_HOUR = 60 * 60 * 1000;

export function deriveTimelineEvents(input: DeriveTimelineInput): TimelineEvent[] {
  const now = Date.parse(input.nowIso);
  const horizon = (input.horizonHours ?? 48) * MS_HOUR;
  const horizonEnd = now + horizon;
  const out: TimelineEvent[] = [];

  // 1. Slot lifecycle: next-shift / shift-end / staffing-pressure /
  //    handover / readiness-on.
  for (const slot of input.slots) {
    const startMs = Date.parse(slot.start);
    const endMs = Date.parse(slot.end);
    const mission = input.missions.find((m) => m.id === slot.missionId);
    if (!mission) continue;

    // Upcoming shifts within the horizon → next-shift per soldier.
    if (startMs > now && startMs <= horizonEnd) {
      const minsTo = Math.round((startMs - now) / 60_000);

      for (const sid of slot.assignedSoldierIds) {
        out.push(makeNextShiftEvent({ slot, mission, soldierId: sid, minsTo }));
      }
      if (slot.commanderSoldierId) {
        out.push(makeNextShiftEvent({ slot, mission, soldierId: slot.commanderSoldierId, minsTo, asCommander: true }));
      }
      // Platoon handover — single per slot.
      if (slot.ownerPlatoonId) {
        out.push({
          id: `handover-${slot.id}`,
          kind: 'shift-handover',
          atIso: slot.start,
          expiresAtIso: slot.end,
          title: `חילוף ב־${formatHHmm(startMs)} · ${mission.name}`,
          description: `${slot.requiredCount} חיילים, ${Math.round((endMs - startMs) / 60_000)} דק׳`,
          severity: minsTo <= 60 ? 'warn' : 'info',
          href: `/mission/${mission.id}`,
          scopes: [
            { kind: 'platoon', platoonId: slot.ownerPlatoonId },
            { kind: 'company', companyId: input.companyId },
          ],
          missionId: mission.id,
          platoonId: slot.ownerPlatoonId,
        });
      }
    }

    // Currently-on → shift-end-now (within next 90 min).
    if (startMs <= now && now < endMs && endMs - now <= 90 * 60_000) {
      const minsTo = Math.max(0, Math.round((endMs - now) / 60_000));
      for (const sid of slot.assignedSoldierIds) {
        out.push({
          id: `end-${slot.id}-${sid}`,
          kind: 'shift-end-now',
          atIso: slot.end,
          expiresAtIso: new Date(endMs + 30 * 60_000).toISOString(),
          title: `המשמרת מסתיימת בעוד ${minsTo} דק׳`,
          description: mission.name,
          severity: minsTo <= 30 ? 'warn' : 'info',
          href: `/mission/${mission.id}`,
          scopes: [{ kind: 'soldier', soldierId: sid }],
          missionId: mission.id,
          soldierId: sid,
        });
      }
    }

    // Staffing pressure: open/partial in next 12h.
    if (
      startMs > now && startMs <= now + 12 * MS_HOUR
      && (slot.status === 'open' || slot.status === 'partially-staffed')
      && slot.ownerPlatoonId
    ) {
      const minsTo = Math.round((startMs - now) / 60_000);
      out.push({
        id: `staffing-${slot.id}`,
        kind: 'staffing-pressure',
        atIso: slot.start,
        expiresAtIso: slot.start,
        title: `${mission.name} ללא איוש בעוד ${formatRelativeMinutes(minsTo)}`,
        description: slot.status === 'open'
          ? 'לא הוקצו חיילים'
          : `${slot.assignedSoldierIds.length}/${slot.requiredCount} בלבד`,
        severity: minsTo <= 120 ? 'critical' : minsTo <= 360 ? 'alert' : 'warn',
        href: `/platoon/missions`,
        scopes: [
          { kind: 'platoon', platoonId: slot.ownerPlatoonId },
          { kind: 'company', companyId: input.companyId },
        ],
        missionId: mission.id,
        platoonId: slot.ownerPlatoonId,
      });
    }

    // Readiness "on" → rally + countdown for assigned soldiers + platoon.
    if (mission.archetypeKind === 'readiness' && startMs > now && startMs <= horizonEnd) {
      const minsTo = Math.round((startMs - now) / 60_000);
      const soldierScopes: TimelineScope[] = slot.assignedSoldierIds.map((sid) =>
        ({ kind: 'soldier', soldierId: sid }),
      );
      out.push({
        id: `readiness-on-${slot.id}`,
        kind: 'readiness-on',
        atIso: slot.start,
        expiresAtIso: slot.end,
        title: `${mission.name} בעוד ${formatRelativeMinutes(minsTo)}`,
        description: mission.rallyPoint ? `נקודת ריכוז: ${mission.rallyPoint}` : undefined,
        severity: 'warn',
        href: `/mission/${mission.id}`,
        scopes: [
          { kind: 'platoon', platoonId: slot.ownerPlatoonId },
          { kind: 'company', companyId: input.companyId },
          ...soldierScopes,
        ],
        missionId: mission.id,
        platoonId: slot.ownerPlatoonId,
      });
    }
  }

  // 2. Platoon leave transitions.
  const todayIso = isoDate(new Date(now));
  const tomorrowIso = isoDate(new Date(now + 24 * MS_HOUR));
  for (const platoon of input.platoons.filter((p) => p.companyId === input.companyId)) {
    const days = input.platoonLeaveDays
      .filter((d) => d.platoonId === platoon.id)
      .sort((a, b) => a.dateIso.localeCompare(b.dateIso));
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      const prev = i > 0 ? days[i - 1] : null;
      const isLeavingToday = d.status === 'home' && d.dateIso === todayIso;
      const isLeavingTomorrow = d.status === 'home' && d.dateIso === tomorrowIso;
      const isTransitionIntoHome = !prev || prev.status !== 'home' || prev.dateIso !== prevDay(d.dateIso);

      if ((isLeavingToday || isLeavingTomorrow) && isTransitionIntoHome) {
        out.push({
          id: `leave-out-${platoon.id}-${d.dateIso}`,
          kind: 'platoon-leaving-home',
          atIso: `${d.dateIso}T06:00:00`,
          expiresAtIso: `${d.dateIso}T23:59:00`,
          title: `${platoon.name} יוצאת הביתה ב־${d.dateIso}`,
          description: d.notes,
          severity: isLeavingToday ? 'warn' : 'info',
          href: '/coverage/platoons',
          scopes: [
            { kind: 'platoon', platoonId: platoon.id },
            { kind: 'company', companyId: input.companyId },
          ],
          platoonId: platoon.id,
        });
      }

      // Returning to base after a home stint.
      if (prev?.status === 'home' && d.status !== 'home') {
        if (d.dateIso === todayIso || d.dateIso === tomorrowIso) {
          out.push({
            id: `leave-back-${platoon.id}-${d.dateIso}`,
            kind: 'platoon-returning',
            atIso: `${d.dateIso}T06:00:00`,
            expiresAtIso: `${d.dateIso}T23:59:00`,
            title: `${platoon.name} חוזרת לבסיס ב־${d.dateIso}`,
            severity: 'info',
            href: '/coverage/platoons',
            scopes: [
              { kind: 'platoon', platoonId: platoon.id },
              { kind: 'company', companyId: input.companyId },
            ],
            platoonId: platoon.id,
          });
        }
      }
    }
  }

  // 3. Publish-deadline staleness per platoon.
  const PUBLISH_PREFIX = 'שבצ״ק עודכן · ';
  const publishWindowMs = (input.publishWindowHours ?? 18) * MS_HOUR;
  for (const platoon of input.platoons.filter((p) => p.companyId === input.companyId)) {
    const recentPublish = input.announcements
      .filter((a) =>
        a.kind === 'operational'
        && a.title.startsWith(PUBLISH_PREFIX)
        && a.audience.kind === 'platoons'
        && a.audience.platoonIds.includes(platoon.id),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const lastPublishMs = recentPublish ? Date.parse(recentPublish.createdAt) : 0;
    if (now - lastPublishMs > publishWindowMs) {
      out.push({
        id: `publish-${platoon.id}-${tomorrowIso}`,
        kind: 'publish-deadline',
        atIso: input.nowIso,
        expiresAtIso: `${tomorrowIso}T06:00:00`,
        title: `${platoon.name}: שבצ״ק לא פורסם ${formatRelativeHours(Math.round((now - lastPublishMs) / MS_HOUR))}`,
        description: 'חיילי המחלקה רואים מידע מיושן בלו״ז שלהם.',
        severity: 'warn',
        href: '/platoon/missions',
        scopes: [
          { kind: 'platoon', platoonId: platoon.id },
          { kind: 'company', companyId: input.companyId },
        ],
        platoonId: platoon.id,
      });
    }
  }

  // 4. Concurrent critical missions.
  const upcomingSorted = [...input.slots]
    .filter((s) => Date.parse(s.start) > now && Date.parse(s.start) <= horizonEnd)
    .sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 0; i < upcomingSorted.length - 1; i++) {
    const a = upcomingSorted[i];
    const b = upcomingSorted[i + 1];
    const aMission = input.missions.find((m) => m.id === a.missionId);
    const bMission = input.missions.find((m) => m.id === b.missionId);
    if (!aMission || !bMission) continue;
    const aCrit = aMission.fatigue.intensity === 'ambush' || aMission.fatigue.intensity === 'active-patrol';
    const bCrit = bMission.fatigue.intensity === 'ambush' || bMission.fatigue.intensity === 'active-patrol';
    if (!aCrit || !bCrit) continue;
    if (a.missionId === b.missionId) continue;
    const gapMin = (Date.parse(b.start) - Date.parse(a.start)) / 60_000;
    if (gapMin > 30) continue;
    out.push({
      id: `concurrent-${a.id}-${b.id}`,
      kind: 'concurrent-critical',
      atIso: a.start,
      expiresAtIso: a.end,
      title: `2 משימות קריטיות בו זמנית: ${aMission.name} + ${bMission.name}`,
      description: `התחלה בהפרש ${Math.round(gapMin)} דק׳ — בדוק שהכוח מספיק.`,
      severity: 'alert',
      href: '/schedule',
      scopes: [{ kind: 'company', companyId: input.companyId }],
    });
  }

  // 5. Leave conflict imminent — mission still active when its
  //    assigned platoon starts a home stint.
  for (const m of input.missions) {
    if (!m.endDate) continue;
    if (m.assignedPlatoonIds.length === 0) continue;
    for (const pid of m.assignedPlatoonIds) {
      const homeDay = input.platoonLeaveDays
        .filter((d) =>
          d.platoonId === pid && d.status === 'home'
          && d.dateIso <= m.endDate! && d.dateIso >= isoDate(new Date(now)),
        )
        .sort((a, b) => a.dateIso.localeCompare(b.dateIso))[0];
      if (!homeDay) continue;
      const platoon = input.platoons.find((p) => p.id === pid);
      out.push({
        id: `leave-imminent-${m.id}-${pid}`,
        kind: 'leave-conflict-imminent',
        atIso: `${homeDay.dateIso}T06:00:00`,
        expiresAtIso: `${homeDay.dateIso}T23:59:00`,
        title: `${platoon?.name ?? pid} יוצאת ב־${homeDay.dateIso} אך ${m.name} עוד פעילה`,
        severity: 'alert',
        href: `/missions/${m.id}/assign`,
        scopes: [
          { kind: 'platoon', platoonId: pid },
          { kind: 'company', companyId: input.companyId },
        ],
        missionId: m.id,
        platoonId: pid,
      });
    }
  }

  // De-dup by id; later instances overwrite.
  const seen = new Map<string, TimelineEvent>();
  for (const e of out) seen.set(e.id, e);
  return Array.from(seen.values()).sort((a, b) => a.atIso.localeCompare(b.atIso));
}

// ─── Role / scope selection ─────────────────────────────────────────

export interface SelectArgs {
  events: TimelineEvent[];
  viewerSoldierId?: string;
  viewerPlatoonId?: string;
  viewerCompanyId?: string;
  /** Max items to return — used to keep home strips short. */
  limit?: number;
  /** Only include severities at or above this threshold. */
  minSeverity?: TimelineSeverity;
}

const SEVERITY_ORDER: Record<TimelineSeverity, number> = {
  info: 0, warn: 1, alert: 2, critical: 3,
};

/**
 * Filter events to a viewer's scope. An event is included when at
 * least one of its scopes matches the viewer. The home page passes
 * minSeverity='warn' to keep the strip from being noise.
 */
export function selectTimelineFor(args: SelectArgs): TimelineEvent[] {
  const min = args.minSeverity ? SEVERITY_ORDER[args.minSeverity] : -1;
  const matches = args.events.filter((e) => {
    if (SEVERITY_ORDER[e.severity] < min) return false;
    return e.scopes.some((s) =>
      (s.kind === 'soldier' && s.soldierId === args.viewerSoldierId)
      || (s.kind === 'platoon' && s.platoonId === args.viewerPlatoonId)
      || (s.kind === 'company' && s.companyId === args.viewerCompanyId),
    );
  });
  return args.limit ? matches.slice(0, args.limit) : matches;
}

// ─── Internal helpers ───────────────────────────────────────────────

function makeNextShiftEvent(args: {
  slot: MaterializedSlot;
  mission: Mission;
  soldierId: string;
  minsTo: number;
  asCommander?: boolean;
}): TimelineEvent {
  const { slot, mission, soldierId, minsTo, asCommander } = args;
  return {
    id: `next-shift-${slot.id}-${soldierId}`,
    kind: 'next-shift',
    atIso: slot.start,
    expiresAtIso: slot.end,
    title: `${mission.name} בעוד ${formatRelativeMinutes(minsTo)}${asCommander ? ' (מ״כ)' : ''}`,
    description: mission.rallyPoint || mission.routeDescription || undefined,
    severity: minsTo <= 120 ? 'warn' : 'info',
    href: `/mission/${mission.id}`,
    scopes: [{ kind: 'soldier', soldierId }],
    missionId: mission.id,
    soldierId,
  };
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function prevDay(iso: string): string {
  const d = new Date(iso);
  d.setDate(d.getDate() - 1);
  return isoDate(d);
}

function formatHHmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatRelativeMinutes(mins: number): string {
  if (mins < 60) return `${mins} דק׳`;
  const h = Math.floor(mins / 60);
  const rest = mins - h * 60;
  if (rest === 0) return `${h} שעות`;
  return `${h}ש׳ ${rest}ד׳`;
}

function formatRelativeHours(h: number): string {
  if (h < 24) return `${h} שעות`;
  return `${Math.floor(h / 24)} ימים`;
}
