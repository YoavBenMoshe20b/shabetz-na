// Mission templates — quick-start presets for the authoring wizard.
//
// A template is a Partial<Mission> literal. Picking one populates the
// wizard's draft state; every step still renders the same component, just
// with a pre-filled value the CC can adjust. New operational shapes are
// added here as DATA — the wizard never branches on template kind.

import type { Mission, CommandRank, RankPolicy } from '../types';

export interface MissionTemplate {
  id:    string;
  name:  string;        // Hebrew display name
  hint:  string;        // one-line operational description
  draft: Partial<Mission>;
}

// Build a default rankPolicy where the given ranks are commander-only,
// 'soldier' and 'mk' are regular, and everyone else is excluded.
const policyFor = (commanderRanks: CommandRank[]): Record<CommandRank, RankPolicy> => {
  const all: CommandRank[] = ['soldier', 'mk', 'samal', 'mam', 'officer', 'custom'];
  const out = {} as Record<CommandRank, RankPolicy>;
  for (const r of all) {
    if (commanderRanks.includes(r))      out[r] = 'commander-only';
    else if (r === 'soldier' || r === 'mk') out[r] = 'regular';
    else if (r === 'samal' && !commanderRanks.includes('samal')) out[r] = 'regular';
    else                                 out[r] = 'excluded';
  }
  return out;
};

export const MISSION_TEMPLATES: MissionTemplate[] = [
  {
    id:   'static-guard',
    name: 'שמירה סטטית',
    hint: 'שער / מגדל — שעות קבועות, מחלקה קבועה',
    draft: {
      timeModel: { kind: '24-7-continuous' },
      manpower: {
        kind: 'window-varies',
        windows: [
          { label: 'day',   from: '06:00', to: '22:00', spec: { kind: 'exact', count: 1 } },
          { label: 'night', from: '22:00', to: '06:00', spec: { kind: 'exact', count: 2 } },
        ],
      },
      command: {
        fieldCommandRequired:      false,
        commandersPerSlot:         0,
        commanderCountsAsManpower: false,
        rankPolicy:                policyFor([]),
      },
      rotation: { kind: 'fixed-platoon', platoonId: '' },
      fatigue: {
        intensity:         'standing-guard',
        impactsSleep:      false,
        minRestAfterHours: 6,
        fatigueWeight:     3,
      },
    },
  },
  {
    id:   'rotating-guard',
    name: 'שמירה מתחלפת',
    hint: 'מתחלף בין מחלקות פעם בשבוע',
    draft: {
      timeModel: {
        kind: 'fixed-hours',
        windows: [{ startTime: '06:00', endTime: '22:00', shiftDurationMinutes: 120, recurring: 'every-day' }],
      },
      manpower: { kind: 'exact', count: 2 },
      command: {
        fieldCommandRequired:      false,
        commandersPerSlot:         0,
        commanderCountsAsManpower: false,
        rankPolicy:                policyFor([]),
      },
      rotation: { kind: 'rotate-platoons', period: 'weekly' },
      fatigue: {
        intensity:         'standing-guard',
        impactsSleep:      false,
        minRestAfterHours: 6,
        fatigueWeight:     3,
      },
    },
  },
  {
    id:   'night-ambush',
    name: 'מארב לילה',
    hint: 'משימה מבצעית — דורש מפקד, מנוחה ארוכה אחרי',
    draft: {
      timeModel: {
        kind: 'fixed-hours',
        windows: [{ startTime: '22:00', endTime: '04:00', shiftDurationMinutes: 360, recurring: 'every-day' }],
      },
      manpower: { kind: 'exact', count: 4 },
      command: {
        fieldCommandRequired:      true,
        commandersPerSlot:         1,
        commanderCountsAsManpower: true,
        rankPolicy:                policyFor(['samal', 'mam']),
      },
      rotation: { kind: 'rotate-squads', period: 'daily' },
      fatigue: {
        intensity:         'ambush',
        impactsSleep:      true,
        sleepWindowHours:  4,
        minRestAfterHours: 12,
        fatigueWeight:     9,
      },
      squadPolicy: { mode: 'no-mix' },
    },
  },
  {
    id:   'readiness',
    name: 'כוננות',
    hint: 'on-call — פעיל רק כשמופעלת',
    draft: {
      timeModel: { kind: 'on-demand' },
      manpower:  { kind: 'exact', count: 3 },
      command: {
        fieldCommandRequired:      true,
        commandersPerSlot:         1,
        commanderCountsAsManpower: false,
        rankPolicy:                policyFor(['mam']),
      },
      rotation: { kind: 'rotate-platoons', period: 'daily' },
      fatigue: {
        intensity:         'readiness',
        impactsSleep:      false,
        minRestAfterHours: 4,
        fatigueWeight:     2,
      },
    },
  },
  {
    id:   'patrol',
    name: 'סיור',
    hint: 'סיור פעיל בגזרה',
    draft: {
      timeModel: {
        kind: 'fixed-hours',
        windows: [{ startTime: '06:00', endTime: '22:00', shiftDurationMinutes: 180, recurring: 'every-day' }],
      },
      manpower: { kind: 'range', min: 3, max: 4, ideal: 4 },
      command: {
        fieldCommandRequired:      true,
        commandersPerSlot:         1,
        commanderCountsAsManpower: true,
        rankPolicy:                policyFor(['mk', 'samal']),
      },
      rotation: { kind: 'rotate-platoons', period: 'daily' },
      fatigue: {
        intensity:         'active-patrol',
        impactsSleep:      false,
        minRestAfterHours: 8,
        fatigueWeight:     5,
      },
    },
  },
  {
    id:   'one-time-op',
    name: 'מבצע חד-פעמי',
    hint: 'תאריך ושעה ספציפיים',
    draft: {
      // start/end filled by CC in Step 3
      manpower: { kind: 'exact', count: 5 },
      command: {
        fieldCommandRequired:      true,
        commandersPerSlot:         1,
        commanderCountsAsManpower: false,
        rankPolicy:                policyFor(['mam', 'officer']),
      },
      rotation: { kind: 'manual' },
      fatigue: {
        intensity:         'active-patrol',
        impactsSleep:      false,
        minRestAfterHours: 8,
        fatigueWeight:     5,
      },
    },
  },
  {
    id:   'twenty-four-seven',
    name: '24/7 רציפה',
    hint: 'ללא הפסקה, מצבה משתנה ביום/לילה',
    draft: {
      timeModel: { kind: '24-7-continuous' },
      manpower: {
        kind: 'window-varies',
        windows: [
          { label: 'day',   from: '06:00', to: '22:00', spec: { kind: 'exact', count: 2 } },
          { label: 'night', from: '22:00', to: '06:00', spec: { kind: 'exact', count: 3 } },
        ],
      },
      command: {
        fieldCommandRequired:      false,
        commandersPerSlot:         0,
        commanderCountsAsManpower: false,
        rankPolicy:                policyFor([]),
      },
      rotation: { kind: 'rotate-platoons', period: { everyHours: 12 } },
      fatigue: {
        intensity:         'standing-guard',
        impactsSleep:      false,
        minRestAfterHours: 6,
        fatigueWeight:     4,
      },
    },
  },
  {
    id:   'blank',
    name: 'התחל מאפס',
    hint: 'בלי תבנית — אני אגדיר מההתחלה',
    draft: {},
  },
];
