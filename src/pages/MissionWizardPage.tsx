// Mission authoring wizard — 6 steps, fact-based.
//
// One code path, one shape per step. Templates pre-fill the draft on
// Step 1 without changing the wizard's structure. Each step asks ONE
// operational question (Step 4 is the explicit command/participation
// stack the engine spec demands).
//
// State lives in component state + sessionStorage so a refresh doesn't
// lose progress. Cleared on publish.

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useApp, useMyCompany, useMyPlatoons } from '../context/AppContext';
import { isCompanyLeadership } from '../utils/permissions';
import { MISSION_TEMPLATES, type MissionTemplate } from '../utils/missionTemplates';
import { buildMissionSummary, rankLabel, intensityLabel } from '../utils/missionSummary';
import Header from '../components/Header';
import {
  Button, Body, Muted, Hint,
} from '../components/ui';
import type {
  MissionTimeModel, MissionManpowerSpec, MissionCommandSpec,
  MissionRotation, MissionFatigueProfile, MissionIntensity, CommandRank,
  RankPolicy, RotationPeriod, QualificationRequirement, EquipmentRequirement,
} from '../types';

// ─── Wizard draft ────────────────────────────────────────────────────────────

interface WizardDraft {
  templateId?:        string;
  name:               string;
  description:        string;
  assignedPlatoonIds: string[];
  timeModel?:         MissionTimeModel;
  manpower?:          MissionManpowerSpec;
  command?:           MissionCommandSpec;
  rotation?:          MissionRotation;
  fatigue?:           MissionFatigueProfile;
  qualifications:     QualificationRequirement[];
  equipment:          EquipmentRequirement[];
  /** Optional company-level operational notes — published as a single
   *  MissionNote with scope='company' alongside the mission. */
  companyNotes?:      string;
}

const EMPTY_DRAFT: WizardDraft = {
  name:               '',
  description:        '',
  assignedPlatoonIds: [],
  qualifications:     [],
  equipment:          [],
};

const SESSION_KEY = 'mission-wizard-draft';

// ─── Page ────────────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

export default function MissionWizardPage() {
  const navigate = useNavigate();
  const {
    currentRole, currentUser, addMission, addMissionNote,
    qualifications, equipmentItems, platoons,
  } = useApp();
  const myCompany = useMyCompany();
  const myPlatoons = useMyPlatoons();

  if (!isCompanyLeadership(currentRole)) return <Navigate to="/home" replace />;
  if (!myCompany || !currentUser)        return <Navigate to="/home" replace />;

  const [step, setStep] = useState<WizardStep>(1);
  const [draft, setDraft] = useState<WizardDraft>(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) return JSON.parse(raw) as WizardDraft;
    } catch { /* fall through */ }
    return EMPTY_DRAFT;
  });

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(draft));
  }, [draft]);

  const patch = (p: Partial<WizardDraft>) => setDraft((d) => ({ ...d, ...p }));

  const next = () => setStep((s) => Math.min(6, s + 1) as WizardStep);
  const back = () => {
    if (step === 1) {
      if (confirm('לבטל את המשימה החדשה?')) {
        sessionStorage.removeItem(SESSION_KEY);
        navigate('/missions');
      }
    } else {
      setStep((s) => Math.max(1, s - 1) as WizardStep);
    }
  };

  const stepValid = isStepValid(draft, step);

  const publish = (status: 'draft' | 'active') => {
    if (!myCompany || !currentUser) return;
    if (!draft.timeModel || !draft.manpower || !draft.command || !draft.rotation || !draft.fatigue) {
      return;                                                   // step 6 wouldn't be reachable
    }
    const created = addMission({
      companyId:          myCompany.id,
      name:               draft.name,
      description:        draft.description || undefined,
      createdByUserId:    currentUser.id,
      ownerRole:          'company',
      assignedPlatoonIds: draft.assignedPlatoonIds,
      timeModel:          draft.timeModel,
      manpower:           draft.manpower,
      command:            draft.command,
      rotation:           draft.rotation,
      fatigue:            draft.fatigue,
      qualifications:     draft.qualifications,
      equipment:          draft.equipment,
      conflictsWith:      [],
      canOverlapWith:     [],
      pairings:           [],
      squadPolicy:        { mode: 'mix' },
      requiresDailyConfirmation: false,
      status,
    });
    // Attach the free-text company note as a separate MissionNote so it
    // stays editable independent of the mission's structured definition.
    if (draft.companyNotes && draft.companyNotes.trim()) {
      addMissionNote({
        missionId: created.id,
        scope:     'company',
        text:      draft.companyNotes.trim(),
      });
    }
    sessionStorage.removeItem(SESSION_KEY);
    navigate('/missions');
  };

  return (
    <div className="min-h-screen bg-mil-bg flex flex-col" dir="rtl">
      <Header title="משימה חדשה" />

      {/* Progress + back row */}
      <div className="px-5 pt-4 pb-2 max-w-xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <button
            onClick={back}
            className="text-mil-muted hover:text-mil-text text-sm font-semibold"
          >
            {step === 1 ? 'ביטול' : '→ חזור'}
          </button>
          <div className="flex-1">
            <ProgressBar step={step} total={6} />
          </div>
          <Hint className="tabular-nums">{step}/6</Hint>
        </div>
      </div>

      <main className="flex-1 px-5 pb-32 max-w-xl mx-auto w-full pt-2">
        {step === 1 && (
          <Step1Identity
            draft={draft} patch={patch} myPlatoons={myPlatoons}
            onApplyTemplate={(t) => patch({
              ...t.draft,
              templateId:         t.id,
              name:               draft.name,                   // preserve already-typed name
              description:        draft.description,
              assignedPlatoonIds: draft.assignedPlatoonIds,
              qualifications:     draft.qualifications,
              equipment:          draft.equipment,
            })}
          />
        )}
        {step === 2 && <Step2Character draft={draft} patch={patch} />}
        {step === 3 && <Step3Timing    draft={draft} patch={patch} />}
        {step === 4 && <Step4Command   draft={draft} patch={patch} />}
        {step === 5 && <Step5Rotation  draft={draft} patch={patch} qualifications={qualifications} equipmentItems={equipmentItems} myPlatoons={myPlatoons} />}
        {step === 6 && (
          <Step6Review
            draft={draft}
            platoons={platoons}
            qualifications={qualifications}
            equipmentItems={equipmentItems}
            onPublish={() => publish('active')}
            onSaveDraft={() => publish('draft')}
          />
        )}
      </main>

      {step < 6 && (
        <div className="fixed bottom-0 inset-x-0 bg-mil-bg/95 backdrop-blur border-t border-mil-border z-20 safe-area-bottom">
          <div className="px-5 py-3 max-w-xl mx-auto">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={!stepValid}
              onClick={next}
            >
              המשך
            </Button>
            {!stepValid && (
              <Hint className="text-center mt-1.5 text-mil-muted">{stepValidHint(draft, step)}</Hint>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 1 — Identity & scope + quick-start chips ─────────────────────────

function Step1Identity({
  draft, patch, myPlatoons, onApplyTemplate,
}: {
  draft: WizardDraft;
  patch: (p: Partial<WizardDraft>) => void;
  myPlatoons: ReturnType<typeof useMyPlatoons>;
  onApplyTemplate: (t: MissionTemplate) => void;
}) {
  return (
    <div className="space-y-6">
      <QuestionHeader title="איך נקרא המבצע ומי מבצע אותו?" />

      <div>
        <Hint className="mb-1.5 block tracking-wide">שם המשימה</Hint>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="לדוגמה: שמירה בשער צפון"
          className={inputCls}
          autoFocus
        />
      </div>

      <div>
        <Hint className="mb-2 block tracking-wide">מחלקות באחריות</Hint>
        <div className="flex flex-wrap gap-2">
          {myPlatoons.map((p) => {
            const on = draft.assignedPlatoonIds.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => patch({
                  assignedPlatoonIds: on
                    ? draft.assignedPlatoonIds.filter((x) => x !== p.id)
                    : [...draft.assignedPlatoonIds, p.id],
                })}
                className={chipCls(on)}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {!draft.templateId && (
        <div>
          <Hint className="mb-2 block tracking-wide">התחל מתבנית (אופציונלי)</Hint>
          <div className="grid grid-cols-2 gap-2">
            {MISSION_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => onApplyTemplate(t)}
                className="text-right bg-mil-card border border-mil-border rounded-xl px-3 py-3 hover:border-mil-olive transition-colors"
              >
                <Body className="font-semibold">{t.name}</Body>
                <Hint className="block mt-1 leading-snug">{t.hint}</Hint>
              </button>
            ))}
          </div>
        </div>
      )}

      {draft.templateId && (
        <div className="bg-mil-olive-bg/40 border border-mil-olive/30 rounded-xl px-4 py-3">
          <Body className="font-semibold text-mil-olive-dim">
            תבנית: {MISSION_TEMPLATES.find((t) => t.id === draft.templateId)?.name}
          </Body>
          <Muted className="mt-1">השדות הוגדרו מראש לפי התבנית. תוכל לשנות בכל שלב.</Muted>
          <button
            onClick={() => patch({ templateId: undefined })}
            className="mt-2 text-tiny text-mil-muted hover:text-mil-text font-semibold"
          >
            הסר תבנית
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Step 2 — Operational character (fact-based) ───────────────────────────

const INTENSITY_CARDS: Array<{
  intensity: MissionIntensity;
  title:     string;
  hint:      string;
  rest:      string;
  fatigue:   MissionFatigueProfile;
}> = [
  {
    intensity: 'standing-guard',
    title: 'עומדים ושומרים',
    hint:  'מגדל / שער / נצפ״ה',
    rest:  'מנוחה קצרה אחרי',
    fatigue: { intensity: 'standing-guard', impactsSleep: false, minRestAfterHours: 6,  fatigueWeight: 3 },
  },
  {
    intensity: 'active-patrol',
    title: 'הולכים בסיור פעיל',
    hint:  'הולך-נע בגזרה',
    rest:  'מנוחה רגילה אחרי',
    fatigue: { intensity: 'active-patrol', impactsSleep: false, minRestAfterHours: 8,  fatigueWeight: 5 },
  },
  {
    intensity: 'ambush',
    title: 'במארב / חמ״ק לילי',
    hint:  'דריכות מלאה, בלי שינה',
    rest:  '12ש מנוחה אחרי',
    fatigue: { intensity: 'ambush', impactsSleep: true, sleepWindowHours: 4, minRestAfterHours: 12, fatigueWeight: 9 },
  },
  {
    intensity: 'readiness',
    title: 'כוננות',
    hint:  'פעילים רק כשמופעלת',
    rest:  'מנוחה רגילה',
    fatigue: { intensity: 'readiness', impactsSleep: false, minRestAfterHours: 4, fatigueWeight: 2 },
  },
  {
    intensity: 'admin',
    title: 'עבודות מטה / אדמין',
    hint:  'שולחנות, ניירת',
    rest:  'מנוחה קצרה',
    fatigue: { intensity: 'admin', impactsSleep: false, minRestAfterHours: 2, fatigueWeight: 1 },
  },
  {
    intensity: 'passive',
    title: 'אחר — מותאם',
    hint:  'הגדרה ידנית',
    rest:  '—',
    fatigue: { intensity: 'passive', impactsSleep: false, minRestAfterHours: 4, fatigueWeight: 2 },
  },
];

function Step2Character({ draft, patch }: { draft: WizardDraft; patch: (p: Partial<WizardDraft>) => void }) {
  return (
    <div className="space-y-5">
      <QuestionHeader title="מה החיילים עושים במשימה?" subtitle="האופי מגדיר את חוקי המנוחה." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {INTENSITY_CARDS.map((c) => {
          const on = draft.fatigue?.intensity === c.intensity;
          return (
            <button
              key={c.intensity}
              onClick={() => patch({ fatigue: c.fatigue })}
              className={`text-right rounded-2xl border px-4 py-3.5 transition-colors ${
                on
                  ? 'bg-mil-olive-bg border-mil-olive'
                  : 'bg-mil-card border-mil-border hover:border-mil-olive/50'
              }`}
            >
              <Body className="font-semibold">{c.title}</Body>
              <Hint className="block mt-1 text-mil-muted">{c.hint}</Hint>
              <Hint className="block mt-1.5 text-mil-olive-dim font-semibold">→ {c.rest}</Hint>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 3 — Timing + manpower (fact-based) ───────────────────────────────

function Step3Timing({ draft, patch }: { draft: WizardDraft; patch: (p: Partial<WizardDraft>) => void }) {
  return (
    <div className="space-y-7">
      <QuestionHeader title="מתי זה רץ וכמה חיילים בכל משמרת?" />

      {/* When */}
      <div>
        <Hint className="mb-2 block tracking-wide">מתי זה רץ?</Hint>
        <div className="grid grid-cols-2 gap-2">
          <TimeKindCard
            label="כל הזמן ללא הפסקה"
            hint="24/7"
            on={draft.timeModel?.kind === '24-7-continuous'}
            onClick={() => patch({ timeModel: { kind: '24-7-continuous' } })}
          />
          <TimeKindCard
            label="בשעות קבועות"
            hint="כל יום באותן שעות"
            on={draft.timeModel?.kind === 'fixed-hours'}
            onClick={() => patch({ timeModel: {
              kind: 'fixed-hours',
              windows: [{ startTime: '06:00', endTime: '22:00', shiftDurationMinutes: 120, recurring: 'every-day' }],
            }})}
          />
          <TimeKindCard
            label="רק כשמופעלת"
            hint="כוננות / on-call"
            on={draft.timeModel?.kind === 'on-demand'}
            onClick={() => patch({ timeModel: { kind: 'on-demand' } })}
          />
          <TimeKindCard
            label="תאריך אחד"
            hint="חד-פעמי"
            on={draft.timeModel?.kind === 'one-time'}
            onClick={() => {
              const now = new Date(); now.setMinutes(0, 0, 0);
              const end = new Date(now); end.setHours(end.getHours() + 4);
              patch({ timeModel: { kind: 'one-time', start: now.toISOString(), end: end.toISOString() } });
            }}
          />
        </div>

        {draft.timeModel?.kind === 'fixed-hours' && (
          <div className="mt-3 bg-mil-card border border-mil-border rounded-xl px-4 py-3">
            <div className="grid grid-cols-2 gap-3">
              <TimeField
                label="התחלה"
                value={draft.timeModel.windows[0].startTime}
                onChange={(v) => patch({ timeModel: { ...draft.timeModel!, kind: 'fixed-hours',
                  windows: [{ ...(draft.timeModel as Extract<MissionTimeModel,{kind:'fixed-hours'}>).windows[0], startTime: v }],
                }})}
              />
              <TimeField
                label="סיום"
                value={draft.timeModel.windows[0].endTime}
                onChange={(v) => patch({ timeModel: { ...draft.timeModel!, kind: 'fixed-hours',
                  windows: [{ ...(draft.timeModel as Extract<MissionTimeModel,{kind:'fixed-hours'}>).windows[0], endTime: v }],
                }})}
              />
            </div>
            <div className="mt-3">
              <Hint className="mb-1 block">משך משמרת בודדת</Hint>
              <Stepper
                value={draft.timeModel.windows[0].shiftDurationMinutes}
                onChange={(v) => patch({ timeModel: { ...draft.timeModel!, kind: 'fixed-hours',
                  windows: [{ ...(draft.timeModel as Extract<MissionTimeModel,{kind:'fixed-hours'}>).windows[0], shiftDurationMinutes: v }],
                }})}
                step={30} min={30} max={720} format={(v) => `${(v / 60).toFixed(1).replace('.0','')}ש׳`}
              />
            </div>
          </div>
        )}
      </div>

      {/* Manpower */}
      <div>
        <Hint className="mb-2 block tracking-wide">כמה חיילים בכל משמרת?</Hint>
        <div className="grid grid-cols-3 gap-2">
          <TimeKindCard
            label="מספר קבוע"
            hint="אותו מספר תמיד"
            on={draft.manpower?.kind === 'exact'}
            onClick={() => patch({ manpower: { kind: 'exact', count: 2 } })}
          />
          <TimeKindCard
            label="טווח גמיש"
            hint="מינ׳ — מקס׳"
            on={draft.manpower?.kind === 'range'}
            onClick={() => patch({ manpower: { kind: 'range', min: 2, max: 4, ideal: 3 } })}
          />
          <TimeKindCard
            label="יום / לילה"
            hint="משתנה בין שעות"
            on={draft.manpower?.kind === 'window-varies'}
            onClick={() => patch({ manpower: {
              kind: 'window-varies',
              windows: [
                { label: 'day',   from: '06:00', to: '22:00', spec: { kind: 'exact', count: 1 } },
                { label: 'night', from: '22:00', to: '06:00', spec: { kind: 'exact', count: 2 } },
              ],
            }})}
          />
        </div>

        {draft.manpower?.kind === 'exact' && (
          <div className="mt-3 bg-mil-card border border-mil-border rounded-xl px-4 py-3">
            <Hint className="mb-1.5 block">מספר חיילים</Hint>
            <Stepper
              value={draft.manpower.count}
              onChange={(v) => patch({ manpower: { kind: 'exact', count: v } })}
              min={1} max={20}
            />
          </div>
        )}

        {draft.manpower?.kind === 'range' && (() => {
          const cur = draft.manpower;     // narrowed to range
          const setRange = (p: Partial<Omit<typeof cur, 'kind'>>) =>
            patch({ manpower: { kind: 'range', min: cur.min, max: cur.max, ideal: cur.ideal, ...p } });
          return (
            <div className="mt-3 bg-mil-card border border-mil-border rounded-xl px-4 py-3 space-y-3">
              <RangeRow label="מינימום" value={cur.min}
                onChange={(v) => setRange({ min: v })} min={1} max={20} />
              <RangeRow label="מקסימום" value={cur.max}
                onChange={(v) => setRange({ max: v })} min={1} max={20} />
              <RangeRow label="אידיאל" value={cur.ideal ?? cur.min}
                onChange={(v) => setRange({ ideal: v })} min={1} max={20} />
            </div>
          );
        })()}

        {draft.manpower?.kind === 'window-varies' && (
          <div className="mt-3 bg-mil-card border border-mil-border rounded-xl px-4 py-3 space-y-3">
            {draft.manpower.windows.map((w, i) => (
              <RangeRow
                key={i}
                label={w.label === 'day' ? 'ביום' : 'בלילה'}
                value={w.spec.kind === 'exact' ? w.spec.count : 0}
                onChange={(v) => {
                  const next = { ...(draft.manpower as Extract<MissionManpowerSpec, { kind: 'window-varies' }>) };
                  next.windows = next.windows.map((ww, idx) => idx === i ? {
                    ...ww,
                    spec: { kind: 'exact', count: v },
                  } : ww);
                  patch({ manpower: next });
                }}
                min={1} max={10}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 4 — Command & participation (the explicit 7-question stack) ──────

const ALL_RANKS: CommandRank[] = ['soldier', 'mk', 'samal', 'mam', 'officer'];

function Step4Command({ draft, patch }: { draft: WizardDraft; patch: (p: Partial<WizardDraft>) => void }) {
  // Seed an empty command spec on entry if missing.
  useEffect(() => {
    if (!draft.command) {
      patch({ command: {
        fieldCommandRequired:      false,
        commandersPerSlot:         0,
        commanderCountsAsManpower: false,
        rankPolicy: {
          soldier: 'regular',
          mk:      'regular',
          samal:   'regular',
          mam:     'excluded',
          officer: 'excluded',
          custom:  'excluded',
        },
      }});
    }
  }, []);                                                       // eslint-disable-line react-hooks/exhaustive-deps

  const c = draft.command;
  if (!c) return null;
  const setCommand = (next: MissionCommandSpec) => patch({ command: next });

  const commanderRanks = (Object.entries(c.rankPolicy) as Array<[CommandRank, RankPolicy]>)
    .filter(([, p]) => p === 'commander-only')
    .map(([r]) => r);

  return (
    <div className="space-y-6">
      <QuestionHeader title="מי מפקד ומי משתתף?" />

      {/* Q1 — required? */}
      <ToggleRow
        label="האם נדרש מפקד שטח בכל משמרת?"
        value={c.fieldCommandRequired}
        onChange={(v) => setCommand({
          ...c,
          fieldCommandRequired: v,
          commandersPerSlot: v ? Math.max(1, c.commandersPerSlot) : 0,
        })}
      />

      {c.fieldCommandRequired && (
        <>
          {/* Q2 — who can command? + Q3 — how many? */}
          <div>
            <Hint className="mb-2 block tracking-wide">מי יכול לפקד?</Hint>
            <div className="flex flex-wrap gap-2">
              {ALL_RANKS.filter((r) => r !== 'soldier').map((r) => {
                const on = c.rankPolicy[r] === 'commander-only';
                return (
                  <button
                    key={r}
                    onClick={() => setCommand({
                      ...c,
                      rankPolicy: {
                        ...c.rankPolicy,
                        [r]: on ? 'regular' : 'commander-only',
                      },
                    })}
                    className={chipCls(on)}
                  >
                    {rankLabel(r)}
                  </button>
                );
              })}
            </div>
            <div className="mt-4">
              <Hint className="mb-1.5 block">כמה מפקדים בכל משמרת?</Hint>
              <Stepper
                value={c.commandersPerSlot}
                onChange={(v) => setCommand({ ...c, commandersPerSlot: v })}
                min={1} max={5}
              />
            </div>
          </div>

          {/* Q4 — counts as manpower? */}
          <ToggleRow
            label="המפקד נחשב כחלק מהמצבה?"
            value={c.commanderCountsAsManpower}
            onChange={(v) => setCommand({ ...c, commanderCountsAsManpower: v })}
          />
        </>
      )}

      {/* Q5, Q6, Q7 — per-rank policy (defaulted open when command required) */}
      <Accordion
        label="מי משתתף ברוטציה הרגילה?"
        defaultOpen={c.fieldCommandRequired}
        hint="ברירת המחדל מתאימה לרוב המשימות"
      >
        <div className="bg-mil-card border border-mil-border rounded-xl divide-y divide-mil-border overflow-hidden">
          {ALL_RANKS.map((r) => {
            const cur = c.rankPolicy[r];
            // For 'soldier', commander-only doesn't make sense — hide that option.
            const showCommanderOnly = r !== 'soldier';
            return (
              <div key={r} className="px-4 py-3">
                <Body className="font-semibold mb-2">{rankLabel(r)}</Body>
                <div className="flex flex-wrap gap-2">
                  <PolicyChip
                    on={cur === 'regular'}
                    onClick={() => setCommand({ ...c, rankPolicy: { ...c.rankPolicy, [r]: 'regular' } })}
                    label="משתתף ברגיל"
                  />
                  <PolicyChip
                    on={cur === 'fallback'}
                    onClick={() => setCommand({ ...c, rankPolicy: { ...c.rankPolicy, [r]: 'fallback' } })}
                    label="רק כשחסר"
                  />
                  <PolicyChip
                    on={cur === 'excluded'}
                    onClick={() => setCommand({ ...c, rankPolicy: { ...c.rankPolicy, [r]: 'excluded' } })}
                    label="לא משתתף"
                  />
                  {showCommanderOnly && (
                    <PolicyChip
                      on={cur === 'commander-only'}
                      onClick={() => setCommand({ ...c, rankPolicy: { ...c.rankPolicy, [r]: 'commander-only' } })}
                      label="מפקד בלבד"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Accordion>

      {/* Live validation hint */}
      {c.fieldCommandRequired && commanderRanks.length === 0 && (
        <Hint className="text-mil-warn font-semibold">
          בחר לפחות דרגה אחת שיכולה לפקד.
        </Hint>
      )}
    </div>
  );
}

// ─── Step 5 — Rotation + special needs ─────────────────────────────────────

function Step5Rotation({
  draft, patch, qualifications, equipmentItems, myPlatoons,
}: {
  draft: WizardDraft;
  patch: (p: Partial<WizardDraft>) => void;
  qualifications: ReturnType<typeof useApp>['qualifications'];
  equipmentItems: ReturnType<typeof useApp>['equipmentItems'];
  myPlatoons: ReturnType<typeof useMyPlatoons>;
}) {
  const { addEquipmentItem } = useApp();
  const [showAddEquip, setShowAddEquip] = useState(false);
  const [newEquipName, setNewEquipName] = useState('');
  const [newEquipCat,  setNewEquipCat]  = useState('');

  const commitNewEquip = () => {
    const name = newEquipName.trim();
    if (!name) return;
    const { id } = addEquipmentItem({
      name,
      category: newEquipCat.trim() || undefined,
    });
    patch({
      equipment: [
        ...draft.equipment,
        { equipmentItemId: id, count: 1, perSoldier: false },
      ],
    });
    setNewEquipName('');
    setNewEquipCat('');
    setShowAddEquip(false);
  };

  const rotationKinds: Array<{
    kind: MissionRotation['kind'];
    label: string;
    hint:  string;
  }> = [
    { kind: 'fixed-platoon',       label: 'מחלקה קבועה',           hint: 'אותה מחלקה תמיד' },
    { kind: 'rotate-platoons',     label: 'מתחלף בין מחלקות',       hint: 'יום/שבוע/Nש׳' },
    { kind: 'rotate-squads',       label: 'מתחלף בין כיתות',        hint: 'בתוך המחלקה' },
    { kind: 'whichever-strongest', label: 'הכי רעננה',              hint: 'המנוע בוחר' },
    { kind: 'returning-from-home', label: 'שחזרה מהבית',           hint: 'אחרי חופשה' },
    { kind: 'manual',              label: 'ידני בכל מחזור',         hint: 'אני אקבע' },
  ];

  return (
    <div className="space-y-6">
      <QuestionHeader title="איך מתחלקת האחריות וצרכים מיוחדים?" />

      <div>
        <Hint className="mb-2 block tracking-wide">איך מתחלקת האחריות?</Hint>
        <div className="grid grid-cols-2 gap-2">
          {rotationKinds.map((r) => {
            const on = draft.rotation?.kind === r.kind;
            return (
              <TimeKindCard
                key={r.kind}
                label={r.label}
                hint={r.hint}
                on={on}
                onClick={() => {
                  if (r.kind === 'fixed-platoon') patch({ rotation: { kind: 'fixed-platoon', platoonId: myPlatoons[0]?.id ?? '' } });
                  else if (r.kind === 'rotate-platoons') patch({ rotation: { kind: 'rotate-platoons', period: 'weekly' } });
                  else if (r.kind === 'rotate-squads')   patch({ rotation: { kind: 'rotate-squads',   period: 'daily' } });
                  else if (r.kind === 'whichever-strongest') patch({ rotation: { kind: 'whichever-strongest' } });
                  else if (r.kind === 'returning-from-home') patch({ rotation: { kind: 'returning-from-home' } });
                  else patch({ rotation: { kind: 'manual' } });
                }}
              />
            );
          })}
        </div>

        {draft.rotation?.kind === 'fixed-platoon' && myPlatoons.length > 1 && (
          <div className="mt-3 bg-mil-card border border-mil-border rounded-xl px-4 py-3">
            <Hint className="mb-2 block">איזו מחלקה?</Hint>
            <div className="flex flex-wrap gap-2">
              {myPlatoons.map((p) => {
                const on = draft.rotation?.kind === 'fixed-platoon' && draft.rotation.platoonId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => patch({ rotation: { kind: 'fixed-platoon', platoonId: p.id } })}
                    className={chipCls(on)}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(draft.rotation?.kind === 'rotate-platoons' || draft.rotation?.kind === 'rotate-squads') && (
          <div className="mt-3 bg-mil-card border border-mil-border rounded-xl px-4 py-3">
            <Hint className="mb-2 block">כל כמה זמן?</Hint>
            <div className="flex flex-wrap gap-2">
              {(['daily', 'weekly'] as RotationPeriod[]).map((p) => {
                const on = draft.rotation?.kind === 'rotate-platoons' || draft.rotation?.kind === 'rotate-squads'
                  ? draft.rotation.period === p
                  : false;
                return (
                  <button
                    key={String(p)}
                    onClick={() => patch({ rotation: { ...(draft.rotation as Extract<MissionRotation,{ kind: 'rotate-platoons' | 'rotate-squads'}>), period: p } })}
                    className={chipCls(on)}
                  >
                    {p === 'daily' ? 'כל יום' : 'כל שבוע'}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Accordion label="צרכים מיוחדים — כישורים וציוד" defaultOpen={false} hint="לרוב המשימות אין צורך">
        <div className="space-y-3">
          <div>
            <Hint className="mb-2 block">כישורים נדרשים</Hint>
            <div className="flex flex-wrap gap-2">
              {qualifications.map((q) => {
                const has = draft.qualifications.find((x) => x.qualificationId === q.id);
                return (
                  <button
                    key={q.id}
                    onClick={() => patch({
                      qualifications: has
                        ? draft.qualifications.filter((x) => x.qualificationId !== q.id)
                        : [...draft.qualifications, { qualificationId: q.id, count: 1 }],
                    })}
                    className={chipCls(!!has)}
                  >
                    {q.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Hint className="mb-2 block">ציוד נדרש</Hint>
            <div className="flex flex-wrap gap-2">
              {equipmentItems.map((e) => {
                const has = draft.equipment.find((x) => x.equipmentItemId === e.id);
                return (
                  <button
                    key={e.id}
                    onClick={() => patch({
                      equipment: has
                        ? draft.equipment.filter((x) => x.equipmentItemId !== e.id)
                        : [...draft.equipment, { equipmentItemId: e.id, count: 1, perSoldier: false }],
                    })}
                    className={chipCls(!!has)}
                  >
                    {e.name}
                  </button>
                );
              })}
              {!showAddEquip && (
                <button
                  onClick={() => setShowAddEquip(true)}
                  className="px-3 py-1.5 rounded-full text-sm font-semibold bg-mil-card border border-dashed border-mil-olive/40 text-mil-olive-dim hover:border-mil-olive transition-colors"
                >
                  + ציוד חדש
                </button>
              )}
            </div>

            {showAddEquip && (
              <div className="mt-3 bg-mil-card border border-mil-border rounded-xl px-4 py-3 space-y-3">
                <div>
                  <Hint className="block mb-1.5">שם הציוד</Hint>
                  <input
                    type="text"
                    value={newEquipName}
                    onChange={(e) => setNewEquipName(e.target.value)}
                    placeholder="לדוגמה: סולם / מפתחות חמ״ל / רחפן"
                    className={inputCls}
                    autoFocus
                  />
                </div>
                <div>
                  <Hint className="block mb-1.5">קטגוריה (אופציונלי)</Hint>
                  <input
                    type="text"
                    value={newEquipCat}
                    onChange={(e) => setNewEquipCat(e.target.value)}
                    placeholder="לדוגמה: ציוד פריצה / תקשורת"
                    className={inputCls}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={commitNewEquip}
                    disabled={!newEquipName.trim()}
                    className="flex-1 bg-mil-olive hover:bg-mil-olive-light disabled:opacity-40 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
                  >
                    הוסף ושמור
                  </button>
                  <button
                    onClick={() => { setShowAddEquip(false); setNewEquipName(''); setNewEquipCat(''); }}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-mil-muted hover:text-mil-text"
                  >
                    בטל
                  </button>
                </div>
                <Hint className="text-mil-muted">
                  פריט שיתווסף יישמר במאגר הציוד הפלוגתי וניתן יהיה לבחור בו במשימות אחרות.
                </Hint>
              </div>
            )}
          </div>
        </div>
      </Accordion>

      <Accordion label="הערות מבצעיות מ״פ" defaultOpen={!!draft.companyNotes} hint="הוראות שיתפסו על כל המחלקות שיריצו את המשימה">
        <textarea
          value={draft.companyNotes ?? ''}
          onChange={(e) => patch({ companyNotes: e.target.value })}
          rows={4}
          placeholder={'לדוגמה:\n• להחליף כל שעה\n• לא להכניס מי שחזר עכשיו מהבית\n• לבדוק קשר לפני יציאה'}
          className={`${inputCls} resize-none`}
        />
        <Hint className="mt-2 block text-mil-muted">
          ההערות נשמרות בנפרד מההגדרה המבנית. ניתן לערוך אותן בכל זמן מעמוד המשימה.
        </Hint>
      </Accordion>
    </div>
  );
}

// ─── Step 6 — Review (operational prose) ───────────────────────────────────

function Step6Review({
  draft, platoons, qualifications, equipmentItems, onPublish, onSaveDraft,
}: {
  draft: WizardDraft;
  platoons: ReturnType<typeof useApp>['platoons'];
  qualifications: ReturnType<typeof useApp>['qualifications'];
  equipmentItems: ReturnType<typeof useApp>['equipmentItems'];
  onPublish: () => void;
  onSaveDraft: () => void;
}) {
  const lines = useMemo(() => buildMissionSummary({
    mission: {
      name: draft.name,
      assignedPlatoonIds: draft.assignedPlatoonIds,
      timeModel: draft.timeModel,
      manpower:  draft.manpower,
      command:   draft.command,
      rotation:  draft.rotation,
      fatigue:   draft.fatigue,
      qualifications: draft.qualifications,
      equipment:      draft.equipment,
    },
    platoons, qualifications, equipmentItems,
  }), [draft, platoons, qualifications, equipmentItems]);

  // Quick visual cue if command spec is operationally suspicious
  const warning = useMemo(() => {
    if (!draft.command) return null;
    if (draft.command.fieldCommandRequired) {
      const hasCommander = Object.values(draft.command.rankPolicy).some((p) => p === 'commander-only');
      if (!hasCommander) return 'דורש מפקד אך לא נבחרה דרגת מפקד.';
    }
    if (draft.fatigue?.intensity === 'ambush' && draft.fatigue.minRestAfterHours < 8) {
      return 'מארב לילי עם פחות מ-8 שעות מנוחה — כדאי לבדוק שוב.';
    }
    return null;
  }, [draft]);

  return (
    <div className="space-y-5">
      <QuestionHeader title="בדיקה אחרונה" subtitle="כך המשימה תופיע במנוע השיבוץ." />

      <div className="bg-mil-card border border-mil-border rounded-2xl px-5 py-5 space-y-2.5">
        {lines.length === 0 ? (
          <Muted>אין מספיק מידע. חזור אחורה והשלם.</Muted>
        ) : (
          lines.map((l, i) => (
            <Body key={i} className="leading-relaxed">{l}</Body>
          ))
        )}
      </div>

      {warning && (
        <div className="bg-mil-warn-bg/40 border border-mil-warn/40 rounded-xl px-4 py-3">
          <Body className="text-mil-warn font-semibold">{warning}</Body>
        </div>
      )}

      <div className="flex flex-col gap-2.5 pt-2">
        <Button variant="primary" size="lg" fullWidth onClick={onPublish}>
          פרסם משימה
        </Button>
        <button
          onClick={onSaveDraft}
          className="w-full py-3 text-mil-muted hover:text-mil-text font-semibold text-sm"
        >
          שמור כטיוטה
        </button>
      </div>
    </div>
  );
}

// ─── Validation ────────────────────────────────────────────────────────────

function isStepValid(d: WizardDraft, step: WizardStep): boolean {
  switch (step) {
    case 1: return d.name.trim().length > 0 && d.assignedPlatoonIds.length > 0;
    case 2: return !!d.fatigue;
    case 3: return !!d.timeModel && !!d.manpower;
    case 4: {
      if (!d.command) return false;
      if (d.command.fieldCommandRequired) {
        const hasCommander = Object.values(d.command.rankPolicy).some((p) => p === 'commander-only');
        return hasCommander && d.command.commandersPerSlot >= 1;
      }
      return true;
    }
    case 5: return !!d.rotation;
    case 6: return true;
  }
}

function stepValidHint(d: WizardDraft, step: WizardStep): string {
  switch (step) {
    case 1:
      if (!d.name.trim())                  return 'הזן שם למשימה';
      if (d.assignedPlatoonIds.length === 0) return 'בחר לפחות מחלקה אחת';
      return '';
    case 2: return 'בחר את אופי המשימה';
    case 3:
      if (!d.timeModel) return 'בחר מתי המשימה רצה';
      if (!d.manpower)  return 'בחר את גודל המצבה';
      return '';
    case 4: {
      if (!d.command) return 'הגדר פיקוד';
      if (d.command.fieldCommandRequired) return 'בחר דרגת פיקוד';
      return '';
    }
    case 5: return 'בחר את אופן החלוקה';
    default: return '';
  }
}

// ─── Reusable primitives ───────────────────────────────────────────────────

function QuestionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-1">
      <h2 className="text-2xl font-extrabold text-mil-text leading-snug tracking-tight">{title}</h2>
      {subtitle && <Muted className="mt-1.5">{subtitle}</Muted>}
    </header>
  );
}

function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = (step / total) * 100;
  return (
    <div className="h-1 rounded-full bg-mil-border/60 overflow-hidden">
      <div className="h-full bg-mil-olive transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}

function TimeKindCard({ label, hint, on, onClick }: {
  label: string; hint?: string; on: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-right rounded-xl border px-3 py-3 transition-colors ${
        on
          ? 'bg-mil-olive-bg border-mil-olive'
          : 'bg-mil-card border-mil-border hover:border-mil-olive/50'
      }`}
    >
      <Body className="font-semibold leading-tight">{label}</Body>
      {hint && <Hint className="block mt-1 text-mil-muted">{hint}</Hint>}
    </button>
  );
}

function ToggleRow({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Body className="flex-1 font-semibold">{label}</Body>
      <div className="flex gap-1.5">
        <button
          onClick={() => onChange(false)}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
            !value ? 'bg-mil-text text-mil-card' : 'bg-mil-card border border-mil-border text-mil-muted'
          }`}
        >
          לא
        </button>
        <button
          onClick={() => onChange(true)}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
            value ? 'bg-mil-text text-mil-card' : 'bg-mil-card border border-mil-border text-mil-muted'
          }`}
        >
          כן
        </button>
      </div>
    </div>
  );
}

function Stepper({ value, onChange, min = 0, max = 99, step = 1, format }: {
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
  format?: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-10 h-10 rounded-full bg-mil-card border border-mil-border text-mil-text font-bold text-xl active:scale-95 transition-transform"
      >
        −
      </button>
      <span className="flex-1 text-center text-2xl font-extrabold tabular-nums text-mil-text">
        {format ? format(value) : value}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-10 h-10 rounded-full bg-mil-card border border-mil-border text-mil-text font-bold text-xl active:scale-95 transition-transform"
      >
        +
      </button>
    </div>
  );
}

function RangeRow({ label, value, onChange, min = 0, max = 99 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <Body className="font-semibold w-20">{label}</Body>
      <div className="flex-1">
        <Stepper value={value} onChange={onChange} min={min} max={max} />
      </div>
    </div>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Hint className="mb-1 block">{label}</Hint>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    </div>
  );
}

function Accordion({ label, hint, defaultOpen, children }: {
  label: string; hint?: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 text-right py-2"
      >
        <Body className="font-semibold flex-1">{label}</Body>
        <span className="text-mil-ghost text-sm">{open ? '▲' : '▼'}</span>
      </button>
      {hint && !open && <Hint className="text-mil-muted -mt-1 mb-1">{hint}</Hint>}
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

function PolicyChip({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className={chipCls(on)}>
      {label}
    </button>
  );
}

const chipCls = (on: boolean): string =>
  on
    ? 'px-3 py-1.5 rounded-full text-sm font-bold bg-mil-olive text-white'
    : 'px-3 py-1.5 rounded-full text-sm font-semibold bg-mil-card border border-mil-border text-mil-text hover:border-mil-olive transition-colors';

const inputCls = 'w-full bg-mil-card border border-mil-border rounded-xl px-3 py-3 text-mil-text focus:outline-none focus:ring-2 focus:ring-mil-olive/30 focus:border-mil-olive placeholder:text-mil-ghost text-base';

// Reference intensityLabel to keep the import alive; lint clean.
void intensityLabel;
