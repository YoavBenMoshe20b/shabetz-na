// LeavePlanningWizardPage — /coverage/planning
//
// The step-by-step planning surface the spec called for. Replaces
// nothing — the existing /coverage/platoons day-grid stays as the
// edit-mode view. This page is the GUIDED setup the operator runs
// when standing up (or revising) a new line.
//
// Four steps:
//   1. חסימות      — pick blocked dates + classify each
//   2. גופים        — body-separation policy (platoons / חפ״ק / מפלג)
//   3. מדיניות     — rotation rhythm + minimums + weekend / split rules
//   4. סקירה ופרסום — summary + recommendation text + commit
//
// HONEST scope disclosure (visible inside the wizard's review step):
//   • Recommendations are TEXT explanations, not computed rotation
//     plans. A real recommendation engine that emits multiple
//     candidate rotations is a future slice.
//   • The wizard writes CompanyLeavePolicy + CompanyBlockedDate
//     records. The leave-board day-grid is NOT auto-generated from
//     these — the operator still toggles platoon home days on
//     /coverage/platoons.
//   • The materializer respects existing PlatoonLeaveDay records as
//     before. Blocked-date wiring into the materializer + conflict
//     resolution flow is a separate slice.

import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp, useMyCompany } from '../context/AppContext';
import { isCompanyLeadership } from '../utils/permissions';
import Header from '../components/Header';
import type {
  CompanyBlockedDate, CompanyBlockedDateKind, CompanyLeavePolicy,
} from '../types';
import {
  Section, PageMain, PageTitle, Body, Muted, Hint, Eyebrow, Button,
} from '../components/ui';

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS: Record<Step, string> = {
  1: 'חסימות',
  2: 'גופים',
  3: 'מדיניות',
  4: 'סקירה ופרסום',
};

const BLOCKED_KIND_LABELS: Record<CompanyBlockedDateKind, string> = {
  'line-up':    'עליה לקו',
  'line-down':  'ירידה מהקו',
  'credit':     'זיכוי בסיס',
  'drill':      'תרגיל',
  'inspection': 'ביקורת',
  'op-event':   'אירוע מבצעי',
  'other':      'אחר',
};

export default function LeavePlanningWizardPage() {
  const navigate = useNavigate();
  const {
    currentUser, currentRole, companyBlockedDates, companyLeavePolicy,
    addCompanyBlockedDate, removeCompanyBlockedDate,
    updateCompanyLeavePolicy,
  } = useApp();
  const myCompany = useMyCompany();

  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<Partial<CompanyLeavePolicy>>({
    maxPlatoonsHome:        companyLeavePolicy.maxPlatoonsHome,
    homeStintDays:          companyLeavePolicy.homeStintDays,
    minBaseGapDays:         companyLeavePolicy.minBaseGapDays,
    mode:                   companyLeavePolicy.mode,
    bodySeparation:         companyLeavePolicy.bodySeparation ?? 'platoons-together',
    rotationPattern:        companyLeavePolicy.rotationPattern ?? '8-7',
    noWeekendTransition:    companyLeavePolicy.noWeekendTransition ?? true,
    minConsecutiveBaseDays: companyLeavePolicy.minConsecutiveBaseDays ?? 3,
    minConsecutiveHomeDays: companyLeavePolicy.minConsecutiveHomeDays ?? 3,
    allowSplitByPlatoon:    companyLeavePolicy.allowSplitByPlatoon ?? false,
  });
  const [savedToast, setSavedToast] = useState<string>('');

  const myBlocked = useMemo(
    () => companyBlockedDates
      .filter((d) => d.companyId === myCompany?.id)
      .sort((a, b) => a.dateIso.localeCompare(b.dateIso)),
    [companyBlockedDates, myCompany],
  );

  if (!currentUser) return <Navigate to="/login" replace />;
  if (!isCompanyLeadership(currentRole)) return <Navigate to="/home" replace />;
  if (!myCompany) return <Navigate to="/home" replace />;

  const goNext = () => setStep((s) => Math.min(4, s + 1) as Step);
  const goBack = () => setStep((s) => Math.max(1, s - 1) as Step);

  const commit = () => {
    updateCompanyLeavePolicy(draft);
    setSavedToast('המדיניות נשמרה. עבור ללוח היציאות הפלוגתי כדי לתפעל.');
    setTimeout(() => navigate('/coverage/platoons'), 1500);
  };

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="תכנון יציאות פלוגתיות" />
      <PageMain>

        <header>
          <Eyebrow>{myCompany.unitName ?? ''} · {myCompany.name}</Eyebrow>
          <PageTitle className="mt-1.5">תכנון יציאות פלוגתיות</PageTitle>
          <Muted className="mt-1.5 text-tiny">
            תהליך צעד-אחר-צעד להגדרת חסימות, גופים, מדיניות סבב והמלצות מערכת. הלוח עצמו נערך ידנית ב-״לוח יציאות פלוגתיות״.
          </Muted>
        </header>

        {savedToast && (
          <div className="bg-mil-success-bg border border-mil-success-border text-mil-success font-bold text-sm rounded-xl-soft px-4 py-3">
            ✓ {savedToast}
          </div>
        )}

        {/* Step indicator */}
        <nav className="flex items-center gap-1.5" aria-label="צעדי תהליך">
          {([1, 2, 3, 4] as const).map((n, i) => {
            const active = step === n;
            const done   = step > n;
            return (
              <div key={n} className="flex items-center gap-1.5 flex-1">
                <button
                  onClick={() => setStep(n)}
                  className={`flex items-baseline gap-1.5 flex-1 px-2.5 py-2 rounded-xl-soft text-tiny font-bold transition-colors min-w-0 ${
                    active
                      ? 'bg-mil-olive text-white'
                      : done
                        ? 'bg-mil-success-bg text-mil-success border border-mil-success-border'
                        : 'bg-mil-card border border-mil-border text-mil-muted hover:border-mil-olive'
                  }`}
                >
                  <span className="tabular-nums">{done ? '✓' : n}</span>
                  <span className="truncate">{STEP_LABELS[n]}</span>
                </button>
                {i < 3 && <span className="text-mil-ghost text-tiny">▸</span>}
              </div>
            );
          })}
        </nav>

        {step === 1 && (
          <Step1Blocked
            blocked={myBlocked}
            companyId={myCompany.id}
            createdByUserId={currentUser.id}
            onAdd={addCompanyBlockedDate}
            onRemove={removeCompanyBlockedDate}
          />
        )}

        {step === 2 && (
          <Step2Bodies draft={draft} setDraft={setDraft} />
        )}

        {step === 3 && (
          <Step3Policy draft={draft} setDraft={setDraft} />
        )}

        {step === 4 && (
          <Step4Review
            draft={draft}
            blocked={myBlocked}
            onCommit={commit}
            onOpenBoard={() => navigate('/coverage/platoons')}
          />
        )}

        {/* Wizard nav */}
        <div className="flex gap-2 sticky bottom-4">
          {step > 1 && (
            <Button variant="ghost" size="lg" onClick={goBack}>
              → חזור
            </Button>
          )}
          {step < 4 && (
            <Button variant="primary" size="lg" fullWidth onClick={goNext}>
              המשך
            </Button>
          )}
          {step === 4 && (
            <Button variant="primary" size="lg" fullWidth onClick={commit}>
              ✓ שמור מדיניות
            </Button>
          )}
        </div>

      </PageMain>
    </div>
  );
}

// ─── Step 1 — Blocked dates ─────────────────────────────────────────

function Step1Blocked({
  blocked, companyId, createdByUserId, onAdd, onRemove,
}: {
  blocked: CompanyBlockedDate[];
  companyId: string;
  createdByUserId: string;
  onAdd: (data: Omit<CompanyBlockedDate, 'id' | 'createdAt'>) => CompanyBlockedDate;
  onRemove: (id: string) => void;
}) {
  const [dateIso, setDateIso] = useState<string>(new Date().toISOString().slice(0, 10));
  const [kind, setKind] = useState<CompanyBlockedDateKind>('line-up');
  const [reason, setReason] = useState<string>('');
  const [requireAllInBase, setRequireAllInBase] = useState(true);
  const [addToCalendar, setAddToCalendar] = useState(true);
  const [blockLeaveRequests, setBlockLeaveRequests] = useState(true);
  const [countsForBalance, setCountsForBalance] = useState<boolean>(false);

  const submit = () => {
    if (!dateIso) return;
    onAdd({
      companyId,
      dateIso,
      kind,
      reason: reason.trim() || undefined,
      requireAllInBase,
      addToCalendar,
      blockLeaveRequests,
      countsForBalance,
      createdByUserId,
    });
    setReason('');
  };

  return (
    <>
      <Section label="תאריכים חסומים — תאריכים שלא נחשבים יום יציאה רגיל">
        <Muted className="text-tiny leading-snug mb-3">
          תאריכים אלו לא ייכללו בסבב הרגיל. עליה / ירידה מהקו ויום זיכוי בדרך כלל לא נחשבים לאיזון.
        </Muted>

        <div className="bg-mil-card border border-mil-border rounded-xl-soft p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-tiny">
              <Hint className="block mb-1">תאריך</Hint>
              <input
                type="date"
                value={dateIso}
                onChange={(e) => setDateIso(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="text-tiny">
              <Hint className="block mb-1">סוג</Hint>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as CompanyBlockedDateKind)}
                className={inputCls}
              >
                {(Object.keys(BLOCKED_KIND_LABELS) as CompanyBlockedDateKind[]).map((k) => (
                  <option key={k} value={k}>{BLOCKED_KIND_LABELS[k]}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="text-tiny block">
            <Hint className="block mb-1">סיבה (אופציונלי)</Hint>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder='לדוגמה: "תדריך פלוגתי + חתימת ציוד"'
              className={inputCls}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <Toggle label="כל הפלוגה בבסיס" value={requireAllInBase} onChange={setRequireAllInBase} />
            <Toggle label="הוסף ליומן חיילים" value={addToCalendar} onChange={setAddToCalendar} />
            <Toggle label="אסור בקשות יציאה" value={blockLeaveRequests} onChange={setBlockLeaveRequests} />
            <Toggle label="נספר לאיזון" value={countsForBalance} onChange={setCountsForBalance} />
          </div>

          <Button variant="primary" size="md" fullWidth onClick={submit}>
            הוסף תאריך חסום
          </Button>
        </div>
      </Section>

      {blocked.length > 0 && (
        <Section label={`חסומים · ${blocked.length}`}>
          <div className="bg-mil-card border border-mil-border rounded-xl-soft divide-y divide-mil-border overflow-hidden">
            {blocked.map((b) => (
              <div key={b.id} className="px-4 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <Body className="font-semibold tabular-nums">{b.dateIso}</Body>
                    <span className="text-xxs font-bold uppercase tracking-wide text-mil-olive-dim bg-mil-olive-bg px-2 py-0.5 rounded-full">
                      {BLOCKED_KIND_LABELS[b.kind]}
                    </span>
                  </div>
                  {b.reason && <Muted className="text-tiny mt-0.5">{b.reason}</Muted>}
                  <div className="flex gap-3 mt-1.5 flex-wrap text-tiny text-mil-muted">
                    {b.requireAllInBase   && <span>· כולם בבסיס</span>}
                    {b.addToCalendar      && <span>· ביומן</span>}
                    {b.blockLeaveRequests && <span>· חוסם יציאות</span>}
                    {!b.countsForBalance  && <span>· לא נספר לאיזון</span>}
                  </div>
                </div>
                <button
                  onClick={() => onRemove(b.id)}
                  className="text-mil-alert hover:text-mil-text text-xs font-bold"
                  aria-label="הסר"
                >
                  הסר
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

// ─── Step 2 — Body separation ───────────────────────────────────────

function Step2Bodies({
  draft, setDraft,
}: {
  draft: Partial<CompanyLeavePolicy>;
  setDraft: (fn: (prev: Partial<CompanyLeavePolicy>) => Partial<CompanyLeavePolicy>) => void;
}) {
  const OPTIONS: Array<{
    value: NonNullable<CompanyLeavePolicy['bodySeparation']>;
    label: string;
    hint: string;
  }> = [
    {
      value: 'platoons-together',
      label: 'מחלקות יחד עם הגוף שלהן',
      hint: 'חפ״ק / מפלג זזים בסבב יחד עם המחלקה שהם יושבים בה. הכי פשוט.',
    },
    {
      value: 'chpk-by-person',
      label: 'חפ״ק / מפלג לפי חיילים',
      hint: 'כל חייל בחפ״ק / מפלג מקבל סבב יציאות אישי. שומר תפקודים קריטיים בבסיס.',
    },
    {
      value: 'chpk-with-platoons',
      label: 'חפ״ק נצמד למחלקות',
      hint: 'חפ״ק מתחלף ביחד עם הסבב הפלוגתי אבל כקבוצה — לא לפי חיילים.',
    },
    {
      value: 'chpk-separate',
      label: 'חפ״ק / מפלג בסבב נפרד',
      hint: 'גוף עצמאי לחלוטין. דורש מינימום קבוע משלו.',
    },
  ];

  return (
    <Section label="גופים — איך חפ״ק ומפלג מתנהלים מול הסבב הפלוגתי">
      <Muted className="text-tiny leading-snug mb-3">
        מחלקות קרביות בדרך-כלל מתחלפות כיחידה. חפ״ק / מפלג שונים — לעתים חייבים להישאר בבסיס, או להתחלף לפי חיילים בודדים כדי לא לאבד תפקיד קריטי.
      </Muted>

      <div className="space-y-2">
        {OPTIONS.map((o) => {
          const active = draft.bodySeparation === o.value;
          return (
            <button
              key={o.value}
              onClick={() => setDraft((p) => ({ ...p, bodySeparation: o.value }))}
              className={`w-full text-right rounded-2xl border px-4 py-3.5 transition-colors ${
                active
                  ? 'bg-mil-olive-bg border-mil-olive ring-2 ring-mil-olive/30'
                  : 'bg-mil-card border-mil-border hover:border-mil-olive'
              }`}
            >
              <Body className="font-semibold">{o.label}</Body>
              <Muted className="text-tiny mt-1 leading-snug">{o.hint}</Muted>
            </button>
          );
        })}
      </div>

      <Muted className="text-tiny leading-snug mt-3 pt-3 border-t border-mil-border">
        הערה: בחירה זו נשמרת על המדיניות הפלוגתית ומשמשת את ההמלצות.
        כפיית הסבב על חפ״ק / מפלג ברמת המנוע היא slice עתידי — כרגע המערכת מציגה זאת רק כהמלצה.
      </Muted>
    </Section>
  );
}

// ─── Step 3 — Rotation policy ───────────────────────────────────────

function Step3Policy({
  draft, setDraft,
}: {
  draft: Partial<CompanyLeavePolicy>;
  setDraft: (fn: (prev: Partial<CompanyLeavePolicy>) => Partial<CompanyLeavePolicy>) => void;
}) {
  const PATTERNS: Array<{
    value: NonNullable<CompanyLeavePolicy['rotationPattern']>;
    label: string;
    hint: string;
  }> = [
    { value: 'weekly',   label: 'שבוע שבוע',  hint: 'מחלקה בבית שבוע, מחלקה בבסיס שבוע. סבב פשוט.' },
    { value: '10-5',     label: '10 / 5',     hint: '10 ימים בבסיס, 5 בבית. סבב ארוך, יציבות גבוהה.' },
    { value: '8-7',      label: '8 / 7',      hint: '8 ימים בבסיס, 7 בבית. איזון טוב לעומס.' },
    { value: 'one-home', label: 'מחלקה אחת בבית', hint: 'בכל זמן מחלקה אחת בלבד נמצאת בבית.' },
    { value: 'two-home', label: 'שתי מחלקות בבית', hint: 'סבב אגרסיבי יותר — דורש מילוי מהיר של חוסרים.' },
    { value: 'custom',   label: 'מותאם',     hint: 'תקבע ידנית בלוח. ההמלצות יהיו פחות חדות.' },
  ];

  return (
    <>
      <Section label="מדיניות סבב">
        <Muted className="text-tiny leading-snug mb-3">
          בחר את הקצב המבצעי שמתאים לקו. הסבב המומלץ נשמר על המדיניות וההמלצות בצעד הבא נגזרות ממנו.
        </Muted>

        <div className="grid grid-cols-2 gap-2">
          {PATTERNS.map((p) => {
            const active = draft.rotationPattern === p.value;
            return (
              <button
                key={p.value}
                onClick={() => setDraft((d) => ({ ...d, rotationPattern: p.value }))}
                className={`text-right rounded-2xl border px-3.5 py-3 transition-colors ${
                  active
                    ? 'bg-mil-olive-bg border-mil-olive ring-2 ring-mil-olive/30'
                    : 'bg-mil-card border-mil-border hover:border-mil-olive'
                }`}
              >
                <Body className="font-semibold">{p.label}</Body>
                <Muted className="text-tiny mt-1 leading-snug">{p.hint}</Muted>
              </button>
            );
          })}
        </div>
      </Section>

      <Section label="חוקים נוספים">
        <div className="bg-mil-card border border-mil-border rounded-xl-soft p-4 space-y-3">
          <Toggle
            label="לא להחליף בשישי / שבת"
            value={!!draft.noWeekendTransition}
            onChange={(v) => setDraft((d) => ({ ...d, noWeekendTransition: v }))}
            hint="ימי המעבר לא יהיו ב-Friday/Saturday"
          />

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="מינימום ימים רצופים בבסיס"
              value={draft.minConsecutiveBaseDays ?? 3}
              onChange={(v) => setDraft((d) => ({ ...d, minConsecutiveBaseDays: v }))}
            />
            <NumberField
              label="מינימום ימים רצופים בבית"
              value={draft.minConsecutiveHomeDays ?? 3}
              onChange={(v) => setDraft((d) => ({ ...d, minConsecutiveHomeDays: v }))}
            />
            <NumberField
              label="מקסימום מחלקות בבית בו זמנית"
              value={draft.maxPlatoonsHome ?? 1}
              onChange={(v) => setDraft((d) => ({ ...d, maxPlatoonsHome: v }))}
            />
            <NumberField
              label="ימי סבב הביתה"
              value={draft.homeStintDays ?? 4}
              onChange={(v) => setDraft((d) => ({ ...d, homeStintDays: v }))}
            />
          </div>

          <Toggle
            label="מותר לפצל מחלקה לפי כיתות"
            value={!!draft.allowSplitByPlatoon}
            onChange={(v) => setDraft((d) => ({ ...d, allowSplitByPlatoon: v }))}
            hint="חלק מהמחלקה בבית, חלק בבסיס באותו יום"
          />
        </div>
      </Section>
    </>
  );
}

// ─── Step 4 — Review + recommendations ──────────────────────────────

function Step4Review({
  draft, blocked, onOpenBoard,
}: {
  draft: Partial<CompanyLeavePolicy>;
  blocked: CompanyBlockedDate[];
  onCommit: () => void;
  onOpenBoard: () => void;
}) {
  // Recommendations are TEXT — derived from the draft. NOT a computed
  // multi-candidate rotation plan. This is the user's "basic
  // recommendation engine" — explanatory, not generative.
  const recs = useMemo(() => buildRecommendations(draft, blocked), [draft, blocked]);

  return (
    <>
      <Section label="סקירה">
        <div className="bg-mil-card border border-mil-border rounded-xl-soft p-4 space-y-2 text-sm">
          <Line label="סבב">{PATTERN_LABELS[draft.rotationPattern as keyof typeof PATTERN_LABELS] ?? '—'}</Line>
          <Line label="גופים">{BODY_LABELS[draft.bodySeparation as keyof typeof BODY_LABELS] ?? '—'}</Line>
          <Line label="מקסימום בית בו זמנית">{String(draft.maxPlatoonsHome ?? '—')}</Line>
          <Line label="ימי סבב הביתה">{String(draft.homeStintDays ?? '—')}</Line>
          <Line label="מינימום בסיס / בית רצוף">
            {String(draft.minConsecutiveBaseDays ?? '—')} / {String(draft.minConsecutiveHomeDays ?? '—')}
          </Line>
          <Line label="חסומים">{`${blocked.length} תאריכים`}</Line>
          <Line label="שישי / שבת">{draft.noWeekendTransition ? 'אין החלפות' : 'החלפות מותרות'}</Line>
          <Line label="פיצול לפי כיתות">{draft.allowSplitByPlatoon ? 'מותר' : 'אסור'}</Line>
        </div>
      </Section>

      <Section label="המלצות מערכת">
        <Muted className="text-tiny mb-3 leading-snug">
          ההמלצות נגזרות מהבחירות בלבד — לא ממנוע סבב מחושב. הן מנחות אותך לעבר תכנון מאוזן, אבל לא יוצרות לוח אוטומטי.
        </Muted>
        <ul className="space-y-2">
          {recs.map((r, i) => (
            <li
              key={i}
              className={`rounded-xl-soft px-3.5 py-2.5 text-tiny leading-snug border ${
                r.tone === 'warn'
                  ? 'bg-mil-warn-bg border-mil-warn text-mil-warn'
                  : r.tone === 'info'
                    ? 'bg-mil-info-bg border-mil-info-border text-mil-info'
                    : 'bg-mil-success-bg border-mil-success-border text-mil-success'
              }`}
            >
              <span className="font-bold uppercase tracking-wide ml-1.5">
                {r.tone === 'warn' ? 'אזהרה' : r.tone === 'info' ? 'הערה' : 'טוב'}
              </span>
              {r.text}
            </li>
          ))}
        </ul>
      </Section>

      <Section label="פעולות אחר־כך">
        <div className="bg-mil-info-bg border border-mil-info-border rounded-xl-soft p-4 space-y-2">
          <Body className="text-sm font-semibold text-mil-info">לאחר השמירה</Body>
          <ul className="space-y-1 text-tiny text-mil-text leading-snug list-disc pr-5">
            <li>המדיניות תיכנס לתוקף מיד.</li>
            <li>הלוח הפלוגתי עצמו ייערך ידנית — המערכת לא יוצרת לוח אוטומטי כרגע.</li>
            <li>החסימות יופיעו ב-״לוח יציאות פלוגתי״ ויקובלו ברקע ע״י הלוח.</li>
          </ul>
          <button
            onClick={onOpenBoard}
            className="mt-2 text-tiny font-bold text-mil-info hover:underline"
          >
            פתח לוח יציאות פלוגתי →
          </button>
        </div>
      </Section>
    </>
  );
}

// ─── Recommendation builder (text only — pure) ──────────────────────

interface Recommendation { tone: 'good' | 'info' | 'warn'; text: string; }

function buildRecommendations(
  draft: Partial<CompanyLeavePolicy>,
  blocked: CompanyBlockedDate[],
): Recommendation[] {
  const out: Recommendation[] = [];

  if (draft.rotationPattern === 'weekly') {
    out.push({
      tone: 'info',
      text: 'שבוע-שבוע פשוט וקל למעקב. בדוק שמינימום בסיס מתקיים כאשר שתי מחלקות בבית בו זמנית בימי חפיפה.',
    });
  }
  if (draft.rotationPattern === '8-7' || draft.rotationPattern === '10-5') {
    out.push({
      tone: 'good',
      text: `${draft.rotationPattern} שומר על איזון טוב בין עומס וזמן בבית. רוב הפלוגות הקרביות מעדיפות סבב כזה לקו ארוך.`,
    });
  }

  const lineDays = blocked.filter((b) => b.kind === 'line-up' || b.kind === 'line-down');
  if (lineDays.length > 0) {
    out.push({
      tone: 'info',
      text: `יום עליה / ירידה מהקו (${lineDays.map((d) => d.dateIso).join(' · ')}) מסומן ככזה שלא נספר לאיזון. וודא שלא תוכנן יום יציאה רגיל בתאריכים אלו.`,
    });
  }

  if (draft.noWeekendTransition === false) {
    out.push({
      tone: 'warn',
      text: 'החלפות בשישי / שבת עלולות לפגוע בזמינות החיילים בסוף שבוע. שקול להחזיר את החוק.',
    });
  }

  if ((draft.maxPlatoonsHome ?? 1) >= 2) {
    out.push({
      tone: 'warn',
      text: 'שתי מחלקות בבית בו זמנית מקטין משמעותית את הסד״כ הזמין. וודא שחוקי כיסוי הפיקוד עדיין מתקיימים.',
    });
  }

  if (draft.bodySeparation === 'platoons-together') {
    out.push({
      tone: 'info',
      text: 'חפ״ק / מפלג זזים יחד עם המחלקות — פשוט, אבל עלול לאבד תפקיד קריטי בבת אחת. שקול לעבור ל-״חפ״ק לפי חיילים״ אם זה קורה בפועל.',
    });
  }
  if (draft.bodySeparation === 'chpk-by-person') {
    out.push({
      tone: 'good',
      text: 'חפ״ק / מפלג לפי חיילים שומר על תפקודים קריטיים בבסיס. השתמש בחוק ״מרווח אישי״ כדי לאזן עם בקשות אישיות.',
    });
  }

  if ((draft.minConsecutiveBaseDays ?? 0) < 2) {
    out.push({
      tone: 'warn',
      text: 'מינימום ימים רצופים בבסיס נמוך מ-2. החיילים עלולים להגיע לחוסר מנוחה ביחס לעומס המבצעי.',
    });
  }

  if (blocked.length === 0) {
    out.push({
      tone: 'info',
      text: 'לא הוגדרו תאריכים חסומים. שקול להוסיף לפחות יום עליה / ירידה מהקו אם הם מתוכננים.',
    });
  }

  if (out.length === 0) {
    out.push({ tone: 'good', text: 'המדיניות נראית מאוזנת לפי החוקים שהוגדרו.' });
  }

  return out;
}

// ─── Small UI helpers ───────────────────────────────────────────────

const PATTERN_LABELS = {
  weekly: 'שבוע / שבוע', '10-5': '10 / 5', '8-7': '8 / 7',
  'one-home': 'מחלקה אחת בבית', 'two-home': 'שתי מחלקות בבית', custom: 'מותאם',
} as const;

const BODY_LABELS = {
  'platoons-together': 'מחלקות יחד', 'chpk-by-person': 'חפ״ק לפי חיילים',
  'chpk-with-platoons': 'חפ״ק נצמד למחלקה', 'chpk-separate': 'חפ״ק נפרד',
} as const;

const inputCls =
  'w-full bg-mil-bg-alt border border-mil-border rounded-xl-soft px-3.5 py-2 text-mil-text focus:outline-none focus:ring-2 focus:ring-mil-olive/40 focus:border-mil-olive text-sm';

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-mil-border last:border-0 pb-1.5 last:pb-0">
      <Hint className="text-mil-muted">{label}</Hint>
      <Body className="font-semibold">{children}</Body>
    </div>
  );
}

function Toggle({
  label, value, onChange, hint,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-mil-olive"
      />
      <div className="flex-1 min-w-0">
        <Body className="text-sm font-semibold leading-tight">{label}</Body>
        {hint && <Muted className="text-tiny mt-0.5 leading-snug">{hint}</Muted>}
      </div>
    </label>
  );
}

function NumberField({
  label, value, onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="text-tiny">
      <Hint className="block mb-1 leading-tight">{label}</Hint>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, parseInt(e.target.value || '0', 10)))}
        className={`${inputCls} font-mono tabular-nums`}
        dir="ltr"
      />
    </label>
  );
}
