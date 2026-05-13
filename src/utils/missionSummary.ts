// Mission → Hebrew operational sentences.
//
// Used by the wizard's review step and reusable by any future surface
// (mission detail page, calendar tooltip, audit log entries). Mission is
// described as prose, not as a key/value table — the CC reads it back
// like a sentence: "המשימה רצה כל יום בשעות 22:00–04:00. כל משמרת
// מאוישת ב-4 חיילים, בהם מפקד בדרגת סמל ומעלה. ..."

import type {
  Mission, MissionCommandSpec, MissionFatigueProfile, MissionManpowerSpec,
  MissionRotation, MissionTimeModel, Platoon, Qualification, EquipmentItem,
  RotationPeriod, CommandRank,
} from '../types';

interface SummaryInput {
  mission:        Partial<Mission>;
  platoons:       Platoon[];
  qualifications: Qualification[];
  equipmentItems: EquipmentItem[];
}

export function buildMissionSummary(input: SummaryInput): string[] {
  const lines: string[] = [];
  const m = input.mission;

  // ── Identity (only if name is set) ──
  if (m.name) {
    const platoonNames = (m.assignedPlatoonIds ?? [])
      .map((id) => input.platoons.find((p) => p.id === id)?.name)
      .filter(Boolean);
    if (platoonNames.length > 0) {
      lines.push(`המשימה "${m.name}" — באחריות ${platoonNames.join(' · ')}.`);
    } else {
      lines.push(`המשימה "${m.name}".`);
    }
  }

  if (m.timeModel)  lines.push(timeSentence(m.timeModel));
  if (m.manpower)   lines.push(manpowerSentence(m.manpower));
  if (m.command)    lines.push(...commandSentences(m.command));
  if (m.rotation)   lines.push(rotationSentence(m.rotation, input.platoons));
  if (m.fatigue)    lines.push(...fatigueSentences(m.fatigue));

  if (m.qualifications && m.qualifications.length > 0) {
    const qs = m.qualifications
      .map((q) => {
        const name = input.qualifications.find((x) => x.id === q.qualificationId)?.name ?? 'כישור';
        return `${q.count} × ${name}`;
      })
      .join(' · ');
    lines.push(`כישורים נדרשים: ${qs}.`);
  }
  if (m.equipment && m.equipment.length > 0) {
    const es = m.equipment
      .map((e) => {
        const name = input.equipmentItems.find((x) => x.id === e.equipmentItemId)?.name ?? 'ציוד';
        return `${e.count} × ${name}${e.perSoldier ? ' לכל חייל' : ''}`;
      })
      .join(' · ');
    lines.push(`ציוד נדרש: ${es}.`);
  }

  if (m.requiresDailyConfirmation) {
    lines.push('דורש אישור יומי מהמ״מ.');
  }

  return lines;
}

// ─── Sub-sentence builders ────────────────────────────────────────────────

function timeSentence(t: MissionTimeModel): string {
  switch (t.kind) {
    case '24-7-continuous':
      return 'המשימה רצה ללא הפסקה.';
    case 'fixed-hours': {
      const w = t.windows[0];
      if (!w) return 'המשימה רצה בשעות קבועות.';
      return `המשימה רצה בשעות ${w.startTime}–${w.endTime} (משמרת ${minutesToLabel(w.shiftDurationMinutes)}).`;
    }
    case 'daily-variable':
      return 'המשימה רצה בלוח שונה בכל יום.';
    case 'one-time':
      return `מבצע חד-פעמי בתאריך ${isoToHebrewDate(t.start)}.`;
    case 'on-demand':
      return 'המשימה פעילה רק כשמופעלת (כוננות).';
  }
}

function manpowerSentence(m: MissionManpowerSpec): string {
  switch (m.kind) {
    case 'exact':
      return `כל משמרת מאוישת ב-${m.count} חיילים.`;
    case 'range': {
      const ideal = m.ideal ? ` (אידיאל: ${m.ideal})` : '';
      return `כל משמרת דורשת ${m.min}–${m.max} חיילים${ideal}.`;
    }
    case 'window-varies': {
      const parts = m.windows.map((w) => {
        const lbl = w.label === 'day' ? 'יום' : w.label === 'night' ? 'לילה' : w.label;
        const n = w.spec.kind === 'exact' ? `${w.spec.count}` : `${w.spec.min}–${w.spec.max}`;
        return `${lbl}: ${n}`;
      });
      return `מצבה משתנה — ${parts.join(' · ')}.`;
    }
  }
}

function commandSentences(c: MissionCommandSpec): string[] {
  const out: string[] = [];
  const commanderRanks = (Object.entries(c.rankPolicy) as Array<[CommandRank, string]>)
    .filter(([, p]) => p === 'commander-only')
    .map(([r]) => rankLabel(r));
  const fallbackRanks = (Object.entries(c.rankPolicy) as Array<[CommandRank, string]>)
    .filter(([, p]) => p === 'fallback')
    .map(([r]) => rankLabel(r));
  const excludedRanks = (Object.entries(c.rankPolicy) as Array<[CommandRank, string]>)
    .filter(([, p]) => p === 'excluded')
    .map(([r]) => rankLabel(r));

  if (c.fieldCommandRequired) {
    const countsAs = c.commanderCountsAsManpower ? ' (נחשב כחלק מהמצבה)' : '';
    const countsLabel = c.commandersPerSlot === 1 ? 'מפקד' : `${c.commandersPerSlot} מפקדים`;
    const ranksLabel = commanderRanks.length > 0 ? `מדרגת ${commanderRanks.join(' / ')}` : '';
    out.push(`דורש ${countsLabel} ${ranksLabel}${countsAs}.`.replace(/\s+/g, ' ').trim());
  } else {
    out.push('לא נדרש מפקד שטח.');
  }

  if (fallbackRanks.length > 0) {
    out.push(`${fallbackRanks.join(' / ')} מצטרפים רק כשהמצבה חסרה.`);
  }
  if (excludedRanks.length > 0) {
    out.push(`לא משתתפים ברוטציה: ${excludedRanks.join(' / ')}.`);
  }
  return out;
}

function rotationSentence(r: MissionRotation, platoons: Platoon[]): string {
  switch (r.kind) {
    case 'fixed-platoon': {
      const p = platoons.find((pp) => pp.id === r.platoonId);
      return p ? `האחריות קבועה — ${p.name}.` : 'האחריות קבועה למחלקה אחת.';
    }
    case 'rotate-platoons':
      return `האחריות מתחלפת בין מחלקות ${periodLabel(r.period)}.`;
    case 'rotate-squads':
      return `האחריות מתחלפת בין כיתות ${periodLabel(r.period)}.`;
    case 'whichever-strongest':
      return 'האחריות עוברת למחלקה הכי רעננה.';
    case 'returning-from-home':
      return 'האחריות עוברת למחלקה שחזרה מהבית.';
    case 'manual':
      return 'האחריות נקבעת ידנית בכל מחזור.';
  }
}

function fatigueSentences(f: MissionFatigueProfile): string[] {
  const out: string[] = [];
  out.push(`אופי: ${intensityLabel(f.intensity)} — מינימום ${f.minRestAfterHours} שעות מנוחה אחרי.`);
  if (f.impactsSleep) {
    out.push('המשימה פוגעת בשנת החיילים.');
  }
  return out;
}

// ─── Labels ──────────────────────────────────────────────────────────────

export function rankLabel(r: CommandRank): string {
  switch (r) {
    case 'soldier': return 'חייל';
    case 'mk':      return 'מ״כ';
    case 'samal':   return 'סמל';
    case 'mam':     return 'מ״מ';
    case 'officer': return 'קצין';
    case 'custom':  return 'מותאם';
  }
}

export function intensityLabel(i: MissionFatigueProfile['intensity']): string {
  switch (i) {
    case 'passive':         return 'פאסיבי';
    case 'standing-guard':  return 'שמירה סטטית';
    case 'active-patrol':   return 'סיור פעיל';
    case 'ambush':          return 'מארב / משימה לילית';
    case 'readiness':       return 'כוננות';
    case 'admin':           return 'אדמיניסטרציה';
  }
}

function periodLabel(p: RotationPeriod): string {
  if (p === 'daily')  return 'כל יום';
  if (p === 'weekly') return 'כל שבוע';
  if (typeof p === 'object' && 'everyHours' in p) return `כל ${p.everyHours} שעות`;
  return '';
}

function minutesToLabel(mins: number): string {
  if (mins < 60) return `${mins} דק׳`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}ש׳`;
  return `${h}:${m.toString().padStart(2, '0')}ש׳`;
}

function isoToHebrewDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}
