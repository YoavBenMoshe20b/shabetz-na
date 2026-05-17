// missionImport.ts — pure helpers for "don't start from scratch" flow.
//
// The PC / CC shouldn't rebuild a static-guard at שער צפון for every
// new order. They should pull the previous order's missions, REVIEW
// what stayed and what changed, and publish with edits. This module
// is the data layer for that flow:
//
//   • reviewMissionImport(...)  → ImportReviewItem[]
//       Diff a source mission against a target order. Flags stale
//       qualifications/equipment, leave conflicts, soldier
//       availability — all the things a blind duplicate would miss.
//
//   • buildImportedMission(...) → fields to feed into addMission
//       Produces the actual payload, honoring operator overrides
//       (new dates, new platoons, etc.).
//
// Pure: no React, no Date.now(), no DB. UI layers wire mutations.

import type {
  Mission, OperationalOrder, Qualification, EquipmentItem, Platoon,
  PlatoonLeaveDay, Soldier, Assignment,
} from '../types';

// ─── Review item ────────────────────────────────────────────────────

export type ImportReviewField =
  | 'dates'
  | 'platoons'
  | 'qualifications'
  | 'equipment'
  | 'assignments'
  | 'rally-point'
  | 'response-teams'
  | 'order';

export type ImportReviewSeverity = 'info' | 'warn' | 'error';

export interface ImportReviewItem {
  field:    ImportReviewField;
  severity: ImportReviewSeverity;
  /** Hebrew one-liner — what the operator should know. */
  message:  string;
  /** Optional auto-action description: what we WILL do unless the
   *  operator intervenes (e.g. "תאריכים יותאמו לחלון הצו"). */
  autoAction?: string;
}

// ─── Review computation ─────────────────────────────────────────────

/**
 * Build the human-readable diff between a source mission and the
 * (optional) target order. Returns the list in priority order:
 * errors first, warns second, infos last.
 */
export function reviewMissionImport(args: {
  sourceMission:     Mission;
  targetOrder?:      OperationalOrder;
  qualifications:    Qualification[];
  equipmentItems:    EquipmentItem[];
  platoons:          Platoon[];
  platoonLeaveDays:  PlatoonLeaveDay[];
  soldiers:          Soldier[];
  assignmentsForSourceMission: Assignment[];
}): ImportReviewItem[] {
  const out: ImportReviewItem[] = [];
  const src = args.sourceMission;

  // ── Dates ─────────────────────────────────────────────────────────
  if (args.targetOrder) {
    if (src.startDate || src.endDate) {
      out.push({
        field: 'dates',
        severity: 'info',
        message: `המשימה המקור נושאת תאריך ${src.startDate ?? '—'} → ${src.endDate ?? '—'}.`,
        autoAction: 'תאריכי המשימה יותאמו אוטומטית לחלון הצו החדש',
      });
    } else {
      out.push({
        field: 'dates',
        severity: 'info',
        message: `המשימה תרץ במהלך הצו "${args.targetOrder.name}" (${args.targetOrder.startDate} → ${args.targetOrder.endDate}).`,
      });
    }
  }

  // ── Platoons ──────────────────────────────────────────────────────
  const stillExistingPlatoons = src.assignedPlatoonIds.filter((pid) =>
    args.platoons.some((p) => p.id === pid),
  );
  if (stillExistingPlatoons.length < src.assignedPlatoonIds.length) {
    out.push({
      field: 'platoons',
      severity: 'warn',
      message: `${src.assignedPlatoonIds.length - stillExistingPlatoons.length} מחלקות מהמשימה המקורית לא קיימות יותר — יוסרו.`,
    });
  }

  // Leave conflict on the TARGET window.
  if (args.targetOrder) {
    const fromIso = args.targetOrder.startDate;
    const toIso   = args.targetOrder.endDate;
    const conflictingPlatoons = stillExistingPlatoons.filter((pid) =>
      args.platoonLeaveDays.some((d) =>
        d.platoonId === pid
        && d.status === 'home'
        && d.dateIso >= fromIso
        && d.dateIso <= toIso,
      ),
    );
    if (conflictingPlatoons.length > 0) {
      const names = conflictingPlatoons
        .map((pid) => args.platoons.find((p) => p.id === pid)?.name)
        .filter(Boolean)
        .join(' · ');
      out.push({
        field: 'platoons',
        severity: 'warn',
        message: `${names} מתוכננות ליציאה הביתה בחלון הצו החדש — תידרש פתרון קונפליקטים בעת השיוך.`,
      });
    }
  }

  // ── Qualifications ────────────────────────────────────────────────
  const missingQuals = src.qualifications.filter((q) =>
    !args.qualifications.some((x) => x.id === q.qualificationId),
  );
  if (missingQuals.length > 0) {
    out.push({
      field: 'qualifications',
      severity: 'error',
      message: `${missingQuals.length} כישורים שהמשימה דרשה לא קיימים יותר במערכת — יוסרו מהדרישות.`,
    });
  }

  // ── Equipment ─────────────────────────────────────────────────────
  const missingEquip = src.equipment.filter((e) =>
    !args.equipmentItems.some((x) => x.id === e.equipmentItemId),
  );
  if (missingEquip.length > 0) {
    out.push({
      field: 'equipment',
      severity: 'error',
      message: `${missingEquip.length} פריטי ציוד שהמשימה דרשה לא קיימים יותר — יוסרו.`,
    });
  }

  // ── Assignments (won't be carried — never blind-copy a staffing) ─
  if (args.assignmentsForSourceMission.length > 0) {
    out.push({
      field: 'assignments',
      severity: 'info',
      message: `${args.assignmentsForSourceMission.length} שיבוצי חיילים מהמשימה המקור — לא יועתקו. תאייש את המשימה החדשה לפי הצו.`,
      autoAction: 'שיבוצים אישיים נשמרים נפרדים — תמיד מתחילים נקי לאיוש חדש',
    });
  } else if (src.archetypeKind === 'readiness' && (src.responseTeams ?? []).length > 0) {
    // Readiness with explicit soldier-mode teams may reference soldiers
    // who left / on leave — flag.
    const refSoldierIds = (src.responseTeams ?? [])
      .filter((t) => t.selectionMode === 'soldiers')
      .flatMap((t) => t.soldierIds ?? []);
    const stale = refSoldierIds.filter((sid) =>
      !args.soldiers.some((s) => s.id === sid && s.status === 'active'),
    );
    if (stale.length > 0) {
      out.push({
        field: 'response-teams',
        severity: 'warn',
        message: `${stale.length} חיילים בצוותי התגובה כבר לא פעילים — נדרש עדכון לפני פרסום.`,
      });
    }
  }

  // ── Rally point — surface so operator knows it was carried ─────
  if (src.rallyPoint?.trim()) {
    out.push({
      field: 'rally-point',
      severity: 'info',
      message: `נקודת ריכוז "${src.rallyPoint}" תועתק. ערוך אם הקו השתנה.`,
    });
  }

  // Sort: errors first, warns second, infos last (stable within tier).
  const order: Record<ImportReviewSeverity, number> = { error: 0, warn: 1, info: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

// ─── Build the imported mission payload ─────────────────────────────

export interface ImportedMissionInput {
  sourceMission:    Mission;
  targetOrderId?:   string;
  /** Override the mission name (auto-suggested with " (העתק)" suffix
   *  when absent). */
  newName?:         string;
  /** Override the assigned platoons. Falls back to the source's
   *  surviving platoons (filtered for existence). */
  newAssignedPlatoonIds?: string[];
  qualifications:   Qualification[];
  equipmentItems:   EquipmentItem[];
  platoons:         Platoon[];
}

/**
 * Returns the payload to pass into `addMission` — pre-cleaned of
 * stale qualifications / equipment / platoons. Identity (id, createdAt,
 * createdByUserId) is the caller's responsibility (AppContext fills).
 */
export function buildImportedMission(input: ImportedMissionInput): Omit<
  Mission,
  'id' | 'createdAt' | 'createdByUserId' | 'companyId'
> {
  const src = input.sourceMission;
  const platoons = (input.newAssignedPlatoonIds ?? src.assignedPlatoonIds)
    .filter((pid) => input.platoons.some((p) => p.id === pid));
  const qualifications = src.qualifications
    .filter((q) => input.qualifications.some((x) => x.id === q.qualificationId));
  const equipment = src.equipment
    .filter((e) => input.equipmentItems.some((x) => x.id === e.equipmentItemId));

  return {
    name:               input.newName?.trim() || `${src.name} (העתק)`,
    description:        src.description,
    ownerRole:          src.ownerRole,
    orderId:            input.targetOrderId,
    assignedPlatoonIds: platoons,
    timeModel:          src.timeModel,
    manpower:           src.manpower,
    command:            src.command,
    rotation:           src.rotation,
    fatigue:            src.fatigue,
    cycleProfile:       src.cycleProfile,
    overlapPolicy:      src.overlapPolicy,
    qualifications,
    equipment,
    logisticsAlerts:    src.logisticsAlerts,
    conflictsWith:      [],     // start clean — don't carry stale conflict
    canOverlapWith:     [],     //               references between orders
    pairings:           src.pairings,
    squadPolicy:        src.squadPolicy,
    requiresDailyConfirmation: src.requiresDailyConfirmation,
    status:             'active-unstaffed' as const,
    difficulty:         src.difficulty,
    fatigueOverride:    src.fatigueOverride,
    archetypeKind:      src.archetypeKind,
    dayNightProfile:    src.dayNightProfile,
    allowPCOverride:    src.allowPCOverride,
    shiftDurationLocked: src.shiftDurationLocked,
    rallyPoint:         src.rallyPoint,
    routeDescription:   src.routeDescription,
    hasVehicle:         src.hasVehicle,
    responseInstructions: src.responseInstructions,
    responseTeams:      src.responseTeams,
  };
}
