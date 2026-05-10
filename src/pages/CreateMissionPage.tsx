import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Tooltip from '../components/Tooltip';
import { generateTimeSlots } from '../utils/scheduleAlgo';
import type {
  MissionCategory, OperationalRole, MissionType, SchedulePeriod,
  EquipmentRequirements, SoldierMixingPolicy, ClassMixingPolicy,
} from '../types';

const CATEGORIES: MissionCategory[] = ['שמירה', 'חמ״ל', 'מטבח', 'סיור', 'כוננות', 'עבודות רס״ר', 'אחר'];
const OP_ROLES: OperationalRole[]   = ['מ״פ', 'סמ״פ', 'מ״מ', 'קשר מ״מ', 'סמל', 'חובש', 'נגביסט', 'קלע', 'מאגיסט', 'רחפן'];
const NO_EQUIP: EquipmentRequirements = {
  fullUniform: false, kneePads: false, boots: false,
  vest: false, helmet: false, weapon: false,
};
const EQUIP_LABELS: Record<keyof EquipmentRequirements, string> = {
  fullUniform: 'מדים מלאים', kneePads: 'ברכיות', boots: 'נעליים',
  vest: 'אפוד', helmet: 'קסדה', weapon: 'נשק',
};

type Step = 1 | 2 | 3;

interface PeriodForm {
  selectExisting: boolean;
  existingId: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface MissionForm {
  name: string;
  category: MissionCategory;
  activeStartTime: string;
  activeEndTime: string;
  shiftDurationHours: number;
  minShiftMinutes: number;
  maxShiftMinutes: number;
  recurring: boolean;
  manualSlotDate: string;
  manualSlotStart: string;
  manualSlotEnd: string;
}

interface ConfigForm {
  minSoldiers: number;
  recommendedSoldiers: number;
  maxSoldiers: number;
  requiredRoles: OperationalRole[];
  needsCommander: boolean;
  needsMedic: boolean;
  soldierMixing: SoldierMixingPolicy;
  classMixing: ClassMixingPolicy;
  hasEquipment: boolean;
  equipmentRequired: EquipmentRequirements;
  enableCadar: boolean;
  enableConfusion: boolean;
  confusionDeviationMinutes: number;
}

export default function CreateMissionPage() {
  const { periods, updatePeriod, addPeriod, addAuditLog, currentUser, currentRole } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [saved, setSaved] = useState(false);

  const [periodForm, setPeriodForm] = useState<PeriodForm>({
    selectExisting: periods.length > 0,
    existingId: periods[0]?.id ?? '',
    name: '', startDate: '', endDate: '',
  });

  const [missionForm, setMissionForm] = useState<MissionForm>({
    name: '', category: 'שמירה',
    activeStartTime: '08:00', activeEndTime: '16:00',
    shiftDurationHours: 4,
    minShiftMinutes: 120, maxShiftMinutes: 360,
    recurring: false,
    manualSlotDate: '', manualSlotStart: '', manualSlotEnd: '',
  });

  const [configForm, setConfigForm] = useState<ConfigForm>({
    minSoldiers: 1, recommendedSoldiers: 2, maxSoldiers: 3,
    requiredRoles: [], needsCommander: false, needsMedic: false,
    soldierMixing: 'mix', classMixing: 'mix',
    hasEquipment: false, equipmentRequired: { ...NO_EQUIP },
    enableCadar: false, enableConfusion: false, confusionDeviationMinutes: 15,
  });

  const toggleRole = (r: OperationalRole) =>
    setConfigForm((f) => ({
      ...f,
      requiredRoles: f.requiredRoles.includes(r)
        ? f.requiredRoles.filter((x) => x !== r)
        : [...f.requiredRoles, r],
    }));

  const toggleEquip = (key: keyof EquipmentRequirements) =>
    setConfigForm((f) => ({ ...f, equipmentRequired: { ...f.equipmentRequired, [key]: !f.equipmentRequired[key] } }));

  const handleSave = () => {
    const existingPeriod = periodForm.selectExisting
      ? periods.find((p) => p.id === periodForm.existingId)
      : null;

    const pStart = existingPeriod?.startDate ?? periodForm.startDate;
    const pEnd   = existingPeriod?.endDate   ?? periodForm.endDate;

    const timeSlots = missionForm.recurring && pStart && pEnd
      ? generateTimeSlots(pStart, pEnd, missionForm.activeStartTime, missionForm.activeEndTime, missionForm.shiftDurationHours, configForm.requiredRoles)
      : missionForm.manualSlotDate
        ? [{ id: `ts-${Date.now()}`, date: missionForm.manualSlotDate, startTime: missionForm.manualSlotStart, endTime: missionForm.manualSlotEnd, assignedSoldierIds: [], requiredRoles: configForm.requiredRoles, status: 'open' as const }]
        : [];

    const mission: MissionType = {
      id:       `mt-${Date.now()}`,
      name:     missionForm.name,
      category: missionForm.category,
      minSoldiers:         configForm.minSoldiers,
      recommendedSoldiers: configForm.recommendedSoldiers,
      maxSoldiers:         configForm.maxSoldiers,
      requiredRoles:   configForm.requiredRoles,
      needsCommander:  configForm.needsCommander,
      needsMedic:      configForm.needsMedic,
      minShiftMinutes: missionForm.minShiftMinutes,
      maxShiftMinutes: missionForm.maxShiftMinutes,
      activeStartTime:    missionForm.activeStartTime,
      activeEndTime:      missionForm.activeEndTime,
      shiftDurationHours: missionForm.shiftDurationHours,
      recurring:          missionForm.recurring,
      conflictsWith: [],
      canOverlapWith: [],
      soldierMixing: configForm.soldierMixing,
      classMixing:   configForm.classMixing,
      hasEquipment:      configForm.hasEquipment,
      equipmentRequired: configForm.equipmentRequired,
      enableCadar:               configForm.enableCadar,
      enableConfusion:           configForm.enableConfusion,
      confusionDeviationMinutes: configForm.enableConfusion ? configForm.confusionDeviationMinutes : 0,
      pairings:  [],
      timeSlots,
    };

    if (existingPeriod) {
      updatePeriod({ ...existingPeriod, missionTypes: [...existingPeriod.missionTypes, mission] });
    } else {
      const newPeriod: SchedulePeriod = {
        id: `sp-${Date.now()}`,
        name: periodForm.name,
        startDate: periodForm.startDate,
        endDate:   periodForm.endDate,
        status: 'draft',
        missionTypes: [mission],
        managerNotes: [],
      };
      addPeriod(newPeriod);
    }

    addAuditLog({ actorName: currentUser!.name, actorRole: currentRole, action: 'יצר משימה', target: missionForm.name });
    setSaved(true);
    setTimeout(() => navigate('/schedule'), 1200);
  };

  const targetPeriod = periodForm.selectExisting
    ? periods.find((p) => p.id === periodForm.existingId)
    : null;

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      {/* Header */}
      <div className="bg-mil-surface border-b border-mil-border px-4 py-3 sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => step === 1 ? navigate(-1) : setStep((s) => (s - 1) as Step)} className="text-mil-ghost hover:text-mil-text-inv text-xl">←</button>
        <span className="text-mil-sand font-bold tracking-widest">שבץ־נא</span>
        <span className="text-mil-ghost">|</span>
        <span className="text-mil-text-inv/70 text-sm">הגדרת משימה</span>
        <div className="mr-auto flex gap-1">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className={`w-2 h-2 rounded-full transition-colors ${step >= s ? 'bg-mil-sand' : 'bg-mil-ghost'}`} />
          ))}
        </div>
      </div>

      <main className="px-4 py-4 pb-28 max-w-xl mx-auto space-y-3">
        {saved && <div className="bg-mil-success-bg border border-mil-success/40 text-mil-success rounded-xl px-4 py-3 text-sm">✓ נשמר — מועבר לשיבוץ...</div>}

        {/* ────── STEP 1: Period ────── */}
        {step === 1 && (
          <>
            <StepHeader n={1} title="שלב א׳ — תקופת שיבוץ" subtitle="בחר תקופה קיימת או צור חדשה" />

            <Card>
              <Toggle
                label="הוסף לתקופה קיימת"
                checked={periodForm.selectExisting}
                onChange={(v) => setPeriodForm((f) => ({ ...f, selectExisting: v }))}
                disabled={periods.length === 0}
              />
              {periodForm.selectExisting && periods.length > 0 ? (
                <Field label="בחר תקופה">
                  <select className={inp} value={periodForm.existingId} onChange={(e) => setPeriodForm((f) => ({ ...f, existingId: e.target.value }))}>
                    {periods.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.status === 'draft' ? 'טיוטה' : 'פורסם'})</option>
                    ))}
                  </select>
                </Field>
              ) : (
                <>
                  <Field label="שם התקופה">
                    <input className={inp} value={periodForm.name} onChange={(e) => setPeriodForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="שבוע 19–25 במאי / לו״ז כוננות סופ״ש" required />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="תאריך התחלה"><input type="date" className={inp} value={periodForm.startDate} onChange={(e) => setPeriodForm((f) => ({ ...f, startDate: e.target.value }))} required /></Field>
                    <Field label="תאריך סיום">  <input type="date" className={inp} value={periodForm.endDate}   onChange={(e) => setPeriodForm((f) => ({ ...f, endDate: e.target.value }))}   required /></Field>
                  </div>
                </>
              )}
            </Card>

            {targetPeriod && (
              <div className="bg-mil-card border border-mil-border rounded-xl p-4 text-sm text-mil-muted">
                <p className="text-mil-text font-medium mb-1">{targetPeriod.name}</p>
                <p>{targetPeriod.startDate} עד {targetPeriod.endDate} · {targetPeriod.missionTypes.length} משימות קיימות</p>
              </div>
            )}

            <NavBtn label="שלב הבא: הגדרת משימה ←" onClick={() => {
              if (periodForm.selectExisting || (periodForm.name && periodForm.startDate && periodForm.endDate)) setStep(2);
            }} />
          </>
        )}

        {/* ────── STEP 2: Mission basics ────── */}
        {step === 2 && (
          <>
            <StepHeader n={2} title="שלב ב׳ — סוג המשימה" subtitle="הגדר את המשימה ואת שעות הפעילות" />

            <Card>
              <Field label="שם המשימה">
                <input className={inp} value={missionForm.name} onChange={(e) => setMissionForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="שמירת שער צפון / כוננות / מטבח" required />
              </Field>
              <Field label="סוג">
                <select className={inp} value={missionForm.category} onChange={(e) => setMissionForm((f) => ({ ...f, category: e.target.value as MissionCategory }))}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </Card>

            <Card title="שעות פעילות">
              <div className="grid grid-cols-2 gap-3">
                <Field label="פתיחת חלון"><input type="time" className={inp} value={missionForm.activeStartTime} onChange={(e) => setMissionForm((f) => ({ ...f, activeStartTime: e.target.value }))} /></Field>
                <Field label="סגירת חלון"> <input type="time" className={inp} value={missionForm.activeEndTime}   onChange={(e) => setMissionForm((f) => ({ ...f, activeEndTime: e.target.value }))} /></Field>
              </div>
              <Field label="משך ברירת מחדל (שעות)">
                <input type="number" min={1} max={24} className={inp} value={missionForm.shiftDurationHours}
                  onChange={(e) => setMissionForm((f) => ({ ...f, shiftDurationHours: Number(e.target.value) }))} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="משמרת מינ׳ (דקות)">
                  <input type="number" min={30} step={15} className={inp} value={missionForm.minShiftMinutes}
                    onChange={(e) => setMissionForm((f) => ({ ...f, minShiftMinutes: Number(e.target.value) }))} />
                </Field>
                <Field label="משמרת מקס׳ (דקות)">
                  <input type="number" min={60} step={15} className={inp} value={missionForm.maxShiftMinutes}
                    onChange={(e) => setMissionForm((f) => ({ ...f, maxShiftMinutes: Number(e.target.value) }))} />
                </Field>
              </div>
            </Card>

            <Card>
              <Toggle
                label={<Tooltip text="המערכת תיצור משמרות אוטומטית לכל יום בתקופה על-פי שעות הפעילות ומשך המשמרת.">חזרתי — צור משמרות אוטומטית לכל יום</Tooltip>}
                checked={missionForm.recurring}
                onChange={(v) => setMissionForm((f) => ({ ...f, recurring: v }))}
              />
              {!missionForm.recurring && (
                <>
                  <p className="text-xs text-mil-muted mt-2">הוסף משמרת ידנית ראשונה:</p>
                  <Field label="תאריך"><input type="date" className={inp} value={missionForm.manualSlotDate} onChange={(e) => setMissionForm((f) => ({ ...f, manualSlotDate: e.target.value }))} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="שעת התחלה"><input type="time" className={inp} value={missionForm.manualSlotStart} onChange={(e) => setMissionForm((f) => ({ ...f, manualSlotStart: e.target.value }))} /></Field>
                    <Field label="שעת סיום">  <input type="time" className={inp} value={missionForm.manualSlotEnd}   onChange={(e) => setMissionForm((f) => ({ ...f, manualSlotEnd: e.target.value }))} /></Field>
                  </div>
                </>
              )}
              {missionForm.recurring && (
                <p className="text-xs text-mil-success mt-2">
                  ✓ ייווצרו משמרות של {missionForm.shiftDurationHours}ש׳ בין {missionForm.activeStartTime}–{missionForm.activeEndTime} לכל יום בתקופה
                </p>
              )}
            </Card>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className={outlineBtn}>← חזור</button>
              <NavBtn label="שלב הבא: קונפיגורציה ←" onClick={() => { if (missionForm.name) setStep(3); }} />
            </div>
          </>
        )}

        {/* ────── STEP 3: Configuration ────── */}
        {step === 3 && (
          <>
            <StepHeader n={3} title="שלב ג׳ — קונפיגורציה מבצעית" subtitle="כוח אדם, תפקידים ודרישות ציוד" />

            {/* Manpower */}
            <Card title="כוח אדם">
              <div className="grid grid-cols-3 gap-3">
                <Field label="מינימום">
                  <input type="number" min={0} max={50} className={inp} value={configForm.minSoldiers}
                    onChange={(e) => setConfigForm((f) => ({ ...f, minSoldiers: Number(e.target.value) }))} />
                </Field>
                <Field label="מומלץ">
                  <input type="number" min={0} max={50} className={inp} value={configForm.recommendedSoldiers}
                    onChange={(e) => setConfigForm((f) => ({ ...f, recommendedSoldiers: Number(e.target.value) }))} />
                </Field>
                <Field label="מקסימום">
                  <input type="number" min={0} max={50} className={inp} value={configForm.maxSoldiers}
                    onChange={(e) => setConfigForm((f) => ({ ...f, maxSoldiers: Number(e.target.value) }))} />
                </Field>
              </div>
            </Card>

            {/* Roles */}
            <Card title="תפקידים נדרשים">
              <div className="flex flex-wrap gap-2">
                {OP_ROLES.map((r) => (
                  <button key={r} type="button" onClick={() => toggleRole(r)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      configForm.requiredRoles.includes(r)
                        ? 'bg-mil-olive border-mil-olive text-white'
                        : 'bg-mil-bg border-mil-border text-mil-muted hover:border-mil-olive/50'
                    }`}>
                    {r}
                  </button>
                ))}
              </div>
              <div className="space-y-1 pt-2 border-t border-mil-border">
                <Toggle label="נדרש מפקד (מ״מ ומעלה)" checked={configForm.needsCommander} onChange={(v) => setConfigForm((f) => ({ ...f, needsCommander: v }))} />
                <Toggle label="נדרש חובש"              checked={configForm.needsMedic}     onChange={(v) => setConfigForm((f) => ({ ...f, needsMedic: v }))} />
              </div>
            </Card>

            {/* Mixing policy */}
            <Card title="מדיניות שיבוץ">
              <div>
                <p className="text-xs text-mil-muted mb-1.5">ערבוב חיילים</p>
                <div className="flex gap-2">
                  {([['mix', 'ערבוב חופשי'], ['dedicated', 'צוות קבוע']] as [SoldierMixingPolicy, string][]).map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setConfigForm((f) => ({ ...f, soldierMixing: v }))}
                      className={`flex-1 py-2 rounded-lg text-xs border transition-colors ${configForm.soldierMixing === v ? 'bg-mil-olive border-mil-olive text-white' : 'bg-mil-bg border-mil-border text-mil-muted'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-mil-muted mb-1.5">ערבוב כיתות</p>
                <div className="flex gap-2">
                  {([['mix', 'ערבוב כיתות'], ['no-mix', 'כיתה אחת בלבד']] as [ClassMixingPolicy, string][]).map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setConfigForm((f) => ({ ...f, classMixing: v }))}
                      className={`flex-1 py-2 rounded-lg text-xs border transition-colors ${configForm.classMixing === v ? 'bg-mil-olive border-mil-olive text-white' : 'bg-mil-bg border-mil-border text-mil-muted'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            {/* Equipment */}
            <Card title="ציוד נדרש">
              <Toggle label="משימה דורשת ציוד" checked={configForm.hasEquipment} onChange={(v) => setConfigForm((f) => ({ ...f, hasEquipment: v }))} />
              {configForm.hasEquipment && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-mil-border">
                  {(Object.keys(EQUIP_LABELS) as (keyof EquipmentRequirements)[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleEquip(key)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                        configForm.equipmentRequired[key]
                          ? 'bg-mil-olive-bg border-mil-olive text-mil-olive'
                          : 'bg-mil-bg border-mil-border text-mil-muted hover:border-mil-olive/50'
                      }`}
                    >
                      <span>{configForm.equipmentRequired[key] ? '✓' : '○'}</span>
                      <span>{EQUIP_LABELS[key]}</span>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {/* Advanced */}
            <Card title="הגדרות מתקדמות">
              <Toggle
                label={<Tooltip text="איזון עומסים בין חיילים כדי למנוע שחיקה וחלוקת שמירות לא הוגנת.">קאדר — איזון עומסים</Tooltip>}
                checked={configForm.enableCadar}
                onChange={(v) => setConfigForm((f) => ({ ...f, enableCadar: v }))}
              />
              <Toggle
                label={<Tooltip text="שינוי שעות, צוותים וסדרי שמירה כדי למנוע דפוס קבוע וצפוי.">בלבול אויב — הסתרת דפוסים</Tooltip>}
                checked={configForm.enableConfusion}
                onChange={(v) => setConfigForm((f) => ({ ...f, enableConfusion: v }))}
              />
              {configForm.enableConfusion && (
                <Field label="סטייה מרבית (דקות)">
                  <input type="number" min={5} max={60} step={5} className={inp} value={configForm.confusionDeviationMinutes}
                    onChange={(e) => setConfigForm((f) => ({ ...f, confusionDeviationMinutes: Number(e.target.value) }))} />
                </Field>
              )}
            </Card>

            {/* Summary */}
            <div className="bg-mil-card border border-mil-olive/40 rounded-xl p-4 text-sm space-y-1">
              <p className="font-bold text-mil-olive mb-2">סיכום</p>
              <Row label="תקופה"   value={targetPeriod?.name ?? periodForm.name} />
              <Row label="משימה"   value={`${missionForm.name} (${missionForm.category})`} />
              <Row label="כוח אדם" value={`${configForm.minSoldiers}–${configForm.maxSoldiers} חיילים`} />
              <Row label="משמרת"   value={`${missionForm.minShiftMinutes}–${missionForm.maxShiftMinutes} דקות`} />
              <Row label="משמרות"  value={missionForm.recurring ? 'חזרתי — אוטומטי' : 'ידני'} />
              <Row label="ערבוב"   value={`${configForm.soldierMixing === 'mix' ? 'חופשי' : 'קבוע'} · כיתות: ${configForm.classMixing === 'mix' ? 'ערוב' : 'נפרד'}`} />
              {configForm.hasEquipment && Object.values(configForm.equipmentRequired).some(Boolean) && (
                <Row label="ציוד" value={
                  (Object.keys(EQUIP_LABELS) as (keyof EquipmentRequirements)[])
                    .filter((k) => configForm.equipmentRequired[k])
                    .map((k) => EQUIP_LABELS[k])
                    .join(', ')
                } />
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className={outlineBtn}>← חזור</button>
              <button onClick={handleSave} className="flex-1 bg-mil-olive hover:bg-mil-olive-light text-white font-bold py-4 rounded-xl text-base transition-colors">
                שמור משימה ✓
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function StepHeader({ n, title, subtitle }: { n: number; title: string; subtitle: string }) {
  return (
    <div className="mb-1">
      <span className="text-xs text-mil-muted tracking-widest uppercase">שלב {n} מתוך 3</span>
      <h2 className="text-mil-text font-bold text-lg">{title}</h2>
      <p className="text-mil-muted text-sm">{subtitle}</p>
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-mil-card border border-mil-border rounded-xl overflow-hidden">
      {title && (
        <div className="bg-mil-surface border-b border-mil-border px-4 py-2">
          <p className="text-xs font-bold tracking-widest text-mil-text-inv/70">{title}</p>
        </div>
      )}
      <div className="px-4 py-3 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs text-mil-muted mb-1.5">{label}</label>{children}</div>;
}

function Toggle({ label, checked, onChange, disabled }: {
  label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <label className={`flex items-center justify-between py-1 ${disabled ? 'opacity-40' : 'cursor-pointer'}`}>
      <span className="text-sm text-mil-text flex items-center gap-1">{label}</span>
      <div onClick={() => !disabled && onChange(!checked)}
        className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${checked ? 'bg-mil-olive' : 'bg-mil-border'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'right-0.5' : 'right-5'}`} />
      </div>
    </label>
  );
}

function NavBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex-1 bg-mil-olive hover:bg-mil-olive-light text-white font-bold py-3.5 rounded-xl text-sm transition-colors">
      {label}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-mil-muted min-w-[60px]">{label}:</span>
      <span className="text-mil-text">{value}</span>
    </div>
  );
}

const inp = 'w-full bg-mil-bg border border-mil-border rounded-lg px-3 py-2.5 text-sm text-mil-text focus:outline-none focus:ring-1 focus:ring-mil-olive focus:border-mil-olive placeholder:text-mil-ghost';
const outlineBtn = 'flex-1 bg-mil-card border border-mil-border hover:border-mil-olive/50 text-mil-muted hover:text-mil-text font-medium py-3.5 rounded-xl text-sm transition-colors';
