// Mission Template Library — the data shape and helpers.
//
// The PRIMARY way a PC/CC creates a mission. Templates are user-data
// (lives in AppContext, persisted across sessions); the company's
// reusable repertoire grows with use: שמירה בש״ג, סיור לילה,
// כוננות כרמל א, תורנות מטבח, etc.
//
// A template captures everything about a mission EXCEPT the parts that
// must change per instance: name, dates, exact shift hours, location
// override, who-staffs-it. When the operator picks a template the
// creation form asks ONLY those variable fields.
//
// Important distinction from the archetype:
//   • An archetype is a TYPE classification (5 kinds, code-level).
//   • A template is a CONCRETE preset (many, user-data, per-company).
//   • Every template carries an archetypeKind — so engine behavior
//     stays consistent. The template inherits archetype defaults and
//     then specializes (specific rally point, specific time windows,
//     specific roster requirements).

import type {
  Mission, MissionArchetypeKind, DayNightProfile,
  MissionTimeModel, MissionManpowerSpec, MissionCommandSpec,
  MissionRotation, MissionFatigueProfile, MissionCycleProfile,
  MissionOverlapPolicy, QualificationRequirement, EquipmentRequirement,
  MissionLogisticsAlert, SoldierPairing, MissionDifficulty,
  ReadinessResponseTeam, FatiguePolicy,
  Qualification, EquipmentItem, Platoon, PlatoonLeaveDay,
} from '../types';

// ─── Categories (legacy) ────────────────────────────────────────────
// Kept for back-compat with templates created before families landed.
// New templates set `familyId`; legacy ones still carry `category`.
export const TEMPLATE_CATEGORIES = [
  'שמירות',
  'סיורים',
  'כוננויות',
  'משימות מבצעיות',
  'תורנויות',
  'לוגיסטיקה',
  'אחר',
] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

// ─── Template families — doctrine layer ─────────────────────────────
//
// A FAMILY is an operational grouping of templates that share doctrine
// (קווי שמירה / סיורי לילה / כוננויות). It's a first-class persisted
// entity, not just a string tag — so the company can rename, reorder,
// archive, and (later) bundle into Mission Packages without losing the
// reference graph.
//
// Why this matters for the future:
//   • Mission Package = ordered list of templates from N families
//     ("שבוע מלחמה" = guard line + night patrol + readiness pack).
//   • The Package layer reads familyId, so families MUST be stable
//     ids, not display strings.

export interface TemplateFamily {
  id: string;
  companyId: string;
  /** Stable code used by seed/back-compat lookup (e.g. 'guard-line'). */
  key: string;
  /** Display label — operator can rename. */
  label: string;
  description?: string;
  /** Single-glyph icon for the family chip + section header. */
  icon?: string;
  /** Mil-palette token: 'olive' (default), 'warn', 'info', 'alert', 'muted'. */
  color?: 'olive' | 'warn' | 'info' | 'alert' | 'muted';
  /** Sort order in the library — lower first. */
  order?: number;
  /** Soft-archived families don't show in the picker but keep their
   *  templates pointing to them (for audit + restoration). */
  isArchived?: boolean;
  createdAt: string;
  createdByUserId: string;
}

// ─── Template shape ─────────────────────────────────────────────────

/**
 * A user-saved mission template. The `payload` carries everything the
 * mission-creation flow needs as a seed; identity, dates, and per-
 * instance overrides are supplied at instantiation time.
 */
export interface MissionTemplate {
  id: string;
  companyId: string;

  // ── Identity ─────────────────────────────────────────────────────
  name: string;
  description?: string;
  /** Doctrine grouping — references TemplateFamily.id. The PRIMARY
   *  organizational axis for the library. */
  familyId?: string;
  /** Legacy free-form category, kept for back-compat with templates
   *  created before families landed. New templates set familyId. */
  category?: TemplateCategory | string;
  /** Soft favorite marker — UI sorts/pins favorites. */
  isFavorite?: boolean;
  /** Soft-delete flag — hidden templates don't show in the picker but
   *  remain in storage for audit / undo. */
  isHidden?: boolean;
  /** Usage count — incremented when a mission is created from this
   *  template. Drives "most used" ordering. */
  usageCount: number;
  /** ISO of the last successful instantiation — drives "recent" sort. */
  lastUsedAt?: string;
  createdAt: string;
  createdByUserId: string;
  /** When the template was saved from an existing mission, track the
   *  source for provenance. */
  forkedFromMissionId?: string;

  // ── Behavioral payload — everything the new mission will inherit ─
  payload: MissionTemplatePayload;
}

export interface MissionTemplatePayload {
  archetypeKind: MissionArchetypeKind;
  timeModel:     MissionTimeModel;
  manpower:      MissionManpowerSpec;
  command:       MissionCommandSpec;
  rotation:      MissionRotation;
  fatigue:       MissionFatigueProfile;
  cycleProfile?: MissionCycleProfile;
  overlapPolicy?: MissionOverlapPolicy;
  qualifications: QualificationRequirement[];
  equipment:      EquipmentRequirement[];
  logisticsAlerts?: MissionLogisticsAlert[];
  squadPolicy:    { mode: 'mix' | 'no-mix' | 'specific'; allowedSquadIds?: string[] };
  pairings:       SoldierPairing[];
  requiresDailyConfirmation: boolean;
  difficulty?:    MissionDifficulty;
  fatigueOverride?: FatiguePolicy;
  dayNightProfile?: DayNightProfile;
  allowPCOverride?:    boolean;
  shiftDurationLocked?: boolean;
  rallyPoint?:    string;
  routeDescription?: string;
  hasVehicle?:    boolean;
  responseInstructions?: string;
  responseTeams?: ReadinessResponseTeam[];
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Extract a payload from an existing mission — the "שמור כתבנית"
 * action calls this. Identity fields (id, companyId, createdAt,
 * assignedPlatoonIds, orderId, startDate/endDate) are NOT carried —
 * they're the instance fields the operator will set per use.
 */
export function payloadFromMission(m: Mission): MissionTemplatePayload {
  return {
    archetypeKind:      m.archetypeKind ?? 'custom',
    timeModel:          m.timeModel,
    manpower:           m.manpower,
    command:            m.command,
    rotation:           m.rotation,
    fatigue:            m.fatigue,
    cycleProfile:       m.cycleProfile,
    overlapPolicy:      m.overlapPolicy,
    qualifications:     m.qualifications,
    equipment:          m.equipment,
    logisticsAlerts:    m.logisticsAlerts,
    squadPolicy:        m.squadPolicy,
    pairings:           m.pairings,
    requiresDailyConfirmation: m.requiresDailyConfirmation,
    difficulty:         m.difficulty,
    fatigueOverride:    m.fatigueOverride,
    dayNightProfile:    m.dayNightProfile,
    allowPCOverride:    m.allowPCOverride,
    shiftDurationLocked: m.shiftDurationLocked,
    rallyPoint:         m.rallyPoint,
    routeDescription:   m.routeDescription,
    hasVehicle:         m.hasVehicle,
    responseInstructions: m.responseInstructions,
    responseTeams:      m.responseTeams,
  };
}

/**
 * Build the addMission payload from a template plus per-instance
 * overrides. Caller supplies the dynamic fields the operator just
 * typed (name, dates, platoons); the template provides the rest.
 */
export function buildMissionFromTemplate(args: {
  template: MissionTemplate;
  name: string;
  assignedPlatoonIds: string[];
  orderId?: string;
  startDate?: string;
  endDate?: string;
  rallyPointOverride?: string;
}): Omit<Mission, 'id' | 'companyId' | 'createdAt' | 'createdByUserId'> {
  const p = args.template.payload;
  return {
    name:              args.name,
    description:       undefined,
    ownerRole:         'platoon',
    orderId:           args.orderId,
    assignedPlatoonIds: args.assignedPlatoonIds,
    timeModel:         p.timeModel,
    manpower:          p.manpower,
    command:           p.command,
    rotation:          p.rotation,
    fatigue:           p.fatigue,
    cycleProfile:      p.cycleProfile,
    overlapPolicy:     p.overlapPolicy,
    qualifications:    p.qualifications,
    equipment:         p.equipment,
    logisticsAlerts:   p.logisticsAlerts,
    conflictsWith:     [],
    canOverlapWith:    [],
    pairings:          p.pairings,
    squadPolicy:       p.squadPolicy,
    requiresDailyConfirmation: p.requiresDailyConfirmation,
    status:            'active-unstaffed',
    startDate:         args.startDate,
    endDate:           args.endDate,
    difficulty:        p.difficulty,
    fatigueOverride:   p.fatigueOverride,
    archetypeKind:     p.archetypeKind,
    dayNightProfile:   p.dayNightProfile,
    allowPCOverride:   p.allowPCOverride,
    shiftDurationLocked: p.shiftDurationLocked,
    rallyPoint:        args.rallyPointOverride ?? p.rallyPoint,
    routeDescription:  p.routeDescription,
    hasVehicle:        p.hasVehicle,
    responseInstructions: p.responseInstructions,
    responseTeams:     p.responseTeams,
  };
}

// ─── Review of a template instantiation ─────────────────────────────

export interface TemplateInstantiationReview {
  field: 'name' | 'dates' | 'platoons' | 'rally' | 'response-instructions' | 'qualifications' | 'equipment';
  severity: 'info' | 'warn' | 'error';
  message: string;
}

export function reviewTemplateInstantiation(args: {
  template: MissionTemplate;
  proposedName: string;
  proposedStartDate?: string;
  proposedEndDate?: string;
  proposedPlatoonIds: string[];
  qualifications: Qualification[];
  equipmentItems: EquipmentItem[];
  platoons: Platoon[];
  platoonLeaveDays: PlatoonLeaveDay[];
}): TemplateInstantiationReview[] {
  const out: TemplateInstantiationReview[] = [];
  const p = args.template.payload;

  if (!args.proposedName.trim()) {
    out.push({ field: 'name', severity: 'error', message: 'חסר שם למשימה.' });
  }

  const stillExisting = args.proposedPlatoonIds.filter((pid) =>
    args.platoons.some((pl) => pl.id === pid),
  );
  if (stillExisting.length < args.proposedPlatoonIds.length) {
    out.push({
      field: 'platoons',
      severity: 'warn',
      message: 'חלק מהמחלקות שנבחרו לא קיימות יותר — יוסרו אוטומטית.',
    });
  }
  if (stillExisting.length === 0 && p.archetypeKind !== 'one-time-op') {
    out.push({
      field: 'platoons',
      severity: 'error',
      message: 'לא נבחרה אף מחלקה — המשימה תיווצר ללא אחריות פעילה.',
    });
  }

  if (args.proposedStartDate && args.proposedEndDate) {
    const conflicts = stillExisting.filter((pid) =>
      args.platoonLeaveDays.some((d) =>
        d.platoonId === pid
        && d.status === 'home'
        && d.dateIso >= args.proposedStartDate!
        && d.dateIso <= args.proposedEndDate!,
      ),
    );
    if (conflicts.length > 0) {
      const names = conflicts
        .map((pid) => args.platoons.find((pl) => pl.id === pid)?.name)
        .filter(Boolean)
        .join(' · ');
      out.push({
        field: 'dates',
        severity: 'warn',
        message: `${names} מתוכננת ליציאה בחלון הזמן — ייפתחו פתרונות בעת השיוך.`,
      });
    }
  }

  const missingQuals = p.qualifications.filter((q) =>
    !args.qualifications.some((x) => x.id === q.qualificationId),
  );
  if (missingQuals.length > 0) {
    out.push({
      field: 'qualifications',
      severity: 'warn',
      message: `${missingQuals.length} כישורים מהתבנית לא קיימים יותר — יוסרו.`,
    });
  }
  const missingEquip = p.equipment.filter((e) =>
    !args.equipmentItems.some((x) => x.id === e.equipmentItemId),
  );
  if (missingEquip.length > 0) {
    out.push({
      field: 'equipment',
      severity: 'warn',
      message: `${missingEquip.length} פריטי ציוד מהתבנית לא קיימים יותר — יוסרו.`,
    });
  }

  if (p.archetypeKind === 'readiness' && !p.responseInstructions?.trim()) {
    out.push({
      field: 'response-instructions',
      severity: 'warn',
      message: 'תבנית כוננות בלי הוראות תגובה — יוצגו כריקות לחיילים.',
    });
  }

  return out;
}

// ─── Library queries ────────────────────────────────────────────────

/**
 * Pick up to N templates that are operationally related to `template`.
 * Resolution order:
 *   1. Same family (other templates in the same doctrine group).
 *   2. Same archetypeKind (related shape — e.g. all patrol templates).
 *   3. Top-used templates in the company (operator's favorites).
 * Already-hidden templates are excluded. The source template itself
 * is excluded.
 */
export function findRelatedTemplates(
  template: MissionTemplate,
  all: MissionTemplate[],
  max: number = 4,
): MissionTemplate[] {
  const pool = all.filter((t) => !t.isHidden && t.id !== template.id && t.companyId === template.companyId);
  const seen = new Set<string>();
  const out: MissionTemplate[] = [];

  const push = (t: MissionTemplate) => {
    if (seen.has(t.id) || out.length >= max) return;
    seen.add(t.id);
    out.push(t);
  };

  // 1. Same family
  if (template.familyId) {
    for (const t of pool) {
      if (t.familyId === template.familyId) push(t);
    }
  }
  // 2. Same archetypeKind
  for (const t of pool) {
    if (t.payload.archetypeKind === template.payload.archetypeKind) push(t);
  }
  // 3. Top-used as fallback
  const byUsage = [...pool].sort((a, b) => b.usageCount - a.usageCount);
  for (const t of byUsage) push(t);

  return out;
}

// ─── Multi-axis filter ──────────────────────────────────────────────

export interface LibraryFilter {
  query?: string;
  familyIds?: string[];
  archetypes?: import('../types').MissionArchetypeKind[];
  /** Match templates whose payload carries an explicit day/night profile. */
  dayNightOnly?: boolean;
  /** Match templates whose timeModel is 'fixed-hours' or '24-7-continuous'
   *  (recurring) vs 'one-time'. */
  recurringOnly?: boolean;
  /** Match templates with hasVehicle === true. */
  vehicleOnly?: boolean;
  /** Match favorites only. */
  favoritesOnly?: boolean;
}

export function applyLibraryFilter(templates: MissionTemplate[], f: LibraryFilter): MissionTemplate[] {
  const q = f.query?.trim().toLowerCase() ?? '';
  return templates.filter((t) => {
    if (t.isHidden) return false;
    if (q && !`${t.name} ${t.description ?? ''}`.toLowerCase().includes(q)) return false;
    if (f.favoritesOnly && !t.isFavorite) return false;
    if (f.familyIds?.length && !(t.familyId && f.familyIds.includes(t.familyId))) return false;
    if (f.archetypes?.length && !f.archetypes.includes(t.payload.archetypeKind)) return false;
    if (f.dayNightOnly && !t.payload.dayNightProfile) return false;
    if (f.recurringOnly && t.payload.timeModel.kind === 'one-time') return false;
    if (f.vehicleOnly && !t.payload.hasVehicle) return false;
    return true;
  });
}
