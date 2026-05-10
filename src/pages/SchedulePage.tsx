import { useState } from 'react';
import { useApp, useVisiblePeriods } from '../context/AppContext';
import Header from '../components/Header';
import { canPublishSchedule, canRecalculate, canViewCommanderNotes, isPlatoonLeadership } from '../utils/permissions';
import { generateSchedule, generateTimeSlots, regenerateSlot } from '../utils/scheduleAlgo';
import type {
  MissionCategory, OperationalRole, MissionType, SchedulePeriod, TimeSlot,
  EquipmentRequirements, SoldierMixingPolicy, ClassMixingPolicy, TimeSlotStatus,
  ShiftWarning, FairnessScore,
} from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: MissionCategory[] = ['שמירה', 'חמ״ל', 'מטבח', 'סיור', 'כוננות', 'עבודות רס״ר', 'אחר'];
const OP_ROLES: OperationalRole[]   = ['מ״פ', 'סמ״פ', 'מ״מ', 'קשר מ״מ', 'סמל', 'חובש', 'נגביסט', 'קלע', 'מאגיסט', 'רחפן'];
const NO_EQUIP: EquipmentRequirements = { fullUniform: false, kneePads: false, boots: false, vest: false, helmet: false, weapon: false };
const EQUIP_LABELS: Record<keyof EquipmentRequirements, string> = { fullUniform: 'מדים מלאים', kneePads: 'ברכיות', boots: 'נעליים', vest: 'אפוד', helmet: 'קסדה', weapon: 'נשק' };

const statusStyle: Record<TimeSlotStatus, string> = {
  filled:   'bg-mil-success-bg text-mil-success border-mil-success-border',
  conflict: 'bg-mil-alert-bg text-mil-alert border-mil-alert-border',
  open:     'bg-mil-bg text-mil-muted border-mil-border',
};

// ─── Mission form state ───────────────────────────────────────────────────────

interface MissionDraft {
  id?: string;  // set when editing
  name: string;
  category: MissionCategory;
  minSoldiers: number; recommendedSoldiers: number; maxSoldiers: number;
  activeStartTime: string; activeEndTime: string;
  shiftDurationHours: number; minShiftMinutes: number; maxShiftMinutes: number;
  recurring: boolean;
  manualSlotDate: string; manualSlotStart: string; manualSlotEnd: string;
  requiredRoles: OperationalRole[]; needsCommander: boolean; needsMedic: boolean;
  conflictsWith: string[];  // mission IDs in same period
  canOverlapWith: string[];
  soldierMixing: SoldierMixingPolicy; classMixing: ClassMixingPolicy;
  hasEquipment: boolean; equipmentRequired: EquipmentRequirements;
  enableCadar: boolean; enableConfusion: boolean; confusionDeviationMinutes: number;
}

const defaultDraft = (): MissionDraft => ({
  name: '', category: 'שמירה',
  minSoldiers: 1, recommendedSoldiers: 2, maxSoldiers: 3,
  activeStartTime: '08:00', activeEndTime: '20:00',
  shiftDurationHours: 4, minShiftMinutes: 120, maxShiftMinutes: 360,
  recurring: false,
  manualSlotDate: '', manualSlotStart: '', manualSlotEnd: '',
  requiredRoles: [], needsCommander: false, needsMedic: false,
  conflictsWith: [], canOverlapWith: [],
  soldierMixing: 'mix', classMixing: 'mix',
  hasEquipment: false, equipmentRequired: { ...NO_EQUIP },
  enableCadar: false, enableConfusion: false, confusionDeviationMinutes: 15,
});

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const {
    soldiers, leaves, updatePeriod, addPeriod, addAuditLog, currentUser, currentRole,
    soldierHistory, lastWarnings, lastFairness, lastGeneratedPeriodId, setGenerationResult,
    platoons, recordOverrideAlert,
  } = useApp();
  const visiblePeriods = useVisiblePeriods();
  const isManager = isPlatoonLeadership(currentRole);
  const myProfile = soldiers.find((s) => s.id === currentUser?.soldierProfileId);

  const [selectedId, setSelectedId] = useState(visiblePeriods[0]?.id ?? '');
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [flash,      setFlash]      = useState('');
  const [viewMode,   setViewMode]   = useState<'my' | 'all'>('all');

  // Manager warnings/fairness — only show for the period last generated
  const [showFairness, setShowFairness] = useState(false);

  // Manual override modal state
  const [overrideTarget, setOverrideTarget] = useState<{ missionId: string; slotId: string } | null>(null);

  // New period form
  const [showNewPeriod, setShowNewPeriod] = useState(false);
  const [periodForm, setPeriodForm] = useState({ name: '', startDate: '', endDate: '' });

  // Mission wizard
  const [wizardOpen, setWizardOpen]     = useState(false);
  const [wizardStep, setWizardStep]     = useState(1);
  const [draft, setDraft]               = useState<MissionDraft>(defaultDraft());
  const [editingMissionId, setEditingMissionId] = useState<string | null>(null);

  const period = visiblePeriods.find((p) => p.id === selectedId) ?? visiblePeriods[0];

  const showFlash = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(''), 2500); };

  // ── Period actions ───────────────────────────────────────────────────────────

  const handleCreatePeriod = () => {
    if (!periodForm.name || !periodForm.startDate || !periodForm.endDate) return;
    const newPeriod: SchedulePeriod = {
      id: `sp-${Date.now()}`,
      name: periodForm.name,
      startDate: periodForm.startDate,
      endDate: periodForm.endDate,
      status: 'draft',
      missionTypes: [],
      commanderNotes: [],
    };
    addPeriod(newPeriod);
    addAuditLog({ actorName: currentUser!.name, actorRole: currentRole, action: 'יצר תקופת שיבוץ', target: periodForm.name });
    setSelectedId(newPeriod.id);
    setShowNewPeriod(false);
    setPeriodForm({ name: '', startDate: '', endDate: '' });
    showFlash('תקופה חדשה נוצרה');
  };

  const handleRecalculate = () => {
    if (!period) return;
    const result = generateSchedule({
      missionTypes: period.missionTypes,
      soldiers,
      leaves,
      history: soldierHistory,
    });
    updatePeriod({ ...period, missionTypes: result.missionTypes });
    setGenerationResult(period.id, result.warnings, result.fairness);
    addAuditLog({ actorName: currentUser!.name, actorRole: currentRole, action: 'חישב שיבוץ מחדש', target: period.name });
    const critical = result.warnings.filter((w) => w.severity === 'critical').length;
    showFlash(critical > 0 ? `השיבוץ חושב — ${critical} אזהרות קריטיות` : 'השיבוץ חושב בהצלחה');
  };

  // ── Manual override actions ───────────────────────────────────────────────────
  // Per spec: these MUST NOT block. The action always succeeds; an override
  // alert is recorded upward so company leadership has visibility.

  const platoonOfCurrentPeriod = (): string | undefined => {
    // Heuristic for now: the period belongs to the user's commanded platoon
    // if they have one, otherwise to the first platoon they're a member of.
    if (currentUser?.commandedPlatoonId) return currentUser.commandedPlatoonId;
    return platoons.find((g) => g.memberIds.includes(currentUser?.id ?? ''))?.id;
  };

  const handleAssign = (missionId: string, slotId: string, soldierId: string) => {
    if (!period) return;
    const mt = period.missionTypes.find((m) => m.id === missionId);
    const ts = mt?.timeSlots.find((s) => s.id === slotId);
    const wouldExceedRecommended = mt && ts && ts.assignedSoldierIds.length >= mt.recommendedSoldiers;

    updatePeriod({
      ...period,
      missionTypes: period.missionTypes.map((m) => m.id !== missionId ? m : ({
        ...m,
        timeSlots: m.timeSlots.map((s) => s.id !== slotId ? s : ({
          ...s,
          assignedSoldierIds: s.assignedSoldierIds.includes(soldierId)
            ? s.assignedSoldierIds
            : [...s.assignedSoldierIds, soldierId],
          status: 'filled',
        })),
      })),
    });
    addAuditLog({ actorName: currentUser!.name, actorRole: currentRole, action: 'שיבץ ידנית', target: soldiers.find((s) => s.id === soldierId)?.name ?? soldierId });

    // Upward alert: extra soldier or off-engine manual edit.
    const platoonId = platoonOfCurrentPeriod();
    if (currentUser && platoonId && mt) {
      const soldierName = soldiers.find((s) => s.id === soldierId)?.name ?? soldierId;
      recordOverrideAlert({
        companyId:   currentUser.companyId ?? '',
        platoonId,
        kind:        wouldExceedRecommended ? 'extraSoldiersAssigned' : 'manualSlotEdit',
        description: wouldExceedRecommended
          ? `${currentUser.name} שיבץ חייל נוסף מעבר למומלץ ב-"${mt.name}" (${ts?.date} ${ts?.startTime}). חייל: ${soldierName}.`
          : `${currentUser.name} שיבץ ידנית את ${soldierName} ב-"${mt.name}" (${ts?.date} ${ts?.startTime}).`,
        actorUserId: currentUser.id,
        actorName:   currentUser.name,
        affectedMissionIds: [missionId],
        affectedSoldierIds: [soldierId],
        riskLevel: wouldExceedRecommended ? 'low' : 'low',
      });
    }
  };

  const handleUnassign = (missionId: string, slotId: string, soldierId: string) => {
    if (!period) return;
    const mt = period.missionTypes.find((m) => m.id === missionId);
    const ts = mt?.timeSlots.find((s) => s.id === slotId);
    const willDropBelowMin = mt && ts && (ts.assignedSoldierIds.length - 1) < mt.minSoldiers;

    updatePeriod({
      ...period,
      missionTypes: period.missionTypes.map((m) => m.id !== missionId ? m : ({
        ...m,
        timeSlots: m.timeSlots.map((s) => s.id !== slotId ? s : ({
          ...s,
          assignedSoldierIds: s.assignedSoldierIds.filter((id) => id !== soldierId),
        })),
      })),
    });

    // Upward alert: dropping below minimum manpower is operationally significant.
    const platoonId = platoonOfCurrentPeriod();
    if (currentUser && platoonId && mt && willDropBelowMin) {
      const soldierName = soldiers.find((s) => s.id === soldierId)?.name ?? soldierId;
      recordOverrideAlert({
        companyId:   currentUser.companyId ?? '',
        platoonId,
        kind:        'belowMinManpower',
        description: `${currentUser.name} הסיר את ${soldierName} מ-"${mt.name}" — המשמרת מתחת למינימום (${ts!.assignedSoldierIds.length - 1}/${mt.minSoldiers}).`,
        actorUserId: currentUser.id,
        actorName:   currentUser.name,
        affectedMissionIds: [missionId],
        affectedSoldierIds: [soldierId],
        riskLevel: 'medium',
        requiresImmediateAttention: true,
        suggestedAction: 'שקול שיבוץ חייל נוסף או הקטנת דרישת המינימום למשימה זו.',
      });
    }
  };

  const handleRegenerateSlot = (missionId: string, slotId: string) => {
    if (!period) return;
    const mt = period.missionTypes.find((m) => m.id === missionId);
    const ts = mt?.timeSlots.find((s) => s.id === slotId);
    if (!mt || !ts) return;
    const newSlot = regenerateSlot(ts, mt, { missionTypes: period.missionTypes, soldiers, leaves, history: soldierHistory });
    updatePeriod({
      ...period,
      missionTypes: period.missionTypes.map((m) => m.id !== missionId ? m : ({
        ...m,
        timeSlots: m.timeSlots.map((s) => s.id !== slotId ? s : newSlot),
      })),
    });
    showFlash('המשמרת חושבה מחדש');
  };

  const handlePublish = () => {
    if (!period || period.status === 'published') return;
    updatePeriod({ ...period, status: 'published' });
    addAuditLog({ actorName: currentUser!.name, actorRole: currentRole, action: 'פרסם שיבוץ', target: period.name });
    showFlash('השיבוץ פורסם לחיילים');
  };

  // ── Mission actions ──────────────────────────────────────────────────────────

  const openAddMission = () => {
    setDraft(defaultDraft());
    setEditingMissionId(null);
    setWizardStep(1);
    setWizardOpen(true);
  };

  const openEditMission = (mt: MissionType) => {
    setDraft({
      id: mt.id, name: mt.name, category: mt.category,
      minSoldiers: mt.minSoldiers, recommendedSoldiers: mt.recommendedSoldiers, maxSoldiers: mt.maxSoldiers,
      activeStartTime: mt.activeStartTime, activeEndTime: mt.activeEndTime,
      shiftDurationHours: mt.shiftDurationHours, minShiftMinutes: mt.minShiftMinutes, maxShiftMinutes: mt.maxShiftMinutes,
      recurring: mt.recurring,
      manualSlotDate: '', manualSlotStart: '', manualSlotEnd: '',
      requiredRoles: [...mt.requiredRoles], needsCommander: mt.needsCommander, needsMedic: mt.needsMedic,
      conflictsWith: [...mt.conflictsWith], canOverlapWith: [...mt.canOverlapWith],
      soldierMixing: mt.soldierMixing, classMixing: mt.classMixing,
      hasEquipment: mt.hasEquipment, equipmentRequired: { ...mt.equipmentRequired },
      enableCadar: mt.enableCadar, enableConfusion: mt.enableConfusion, confusionDeviationMinutes: mt.confusionDeviationMinutes,
    });
    setEditingMissionId(mt.id);
    setWizardStep(1);
    setWizardOpen(true);
  };

  const deleteMission = (mtId: string) => {
    if (!period) return;
    const updated = { ...period, missionTypes: period.missionTypes.filter((m) => m.id !== mtId) };
    updatePeriod(updated);
    addAuditLog({ actorName: currentUser!.name, actorRole: currentRole, action: 'מחק משימה', target: mtId });
    showFlash('המשימה נמחקה');
  };

  const saveMission = () => {
    if (!period || !draft.name) return;

    const periodStart = period.startDate;
    const periodEnd   = period.endDate;

    const timeSlots = draft.recurring && periodStart && periodEnd
      ? generateTimeSlots(periodStart, periodEnd, draft.activeStartTime, draft.activeEndTime, draft.shiftDurationHours, draft.requiredRoles)
      : draft.manualSlotDate
        ? [{ id: `ts-${Date.now()}`, date: draft.manualSlotDate, startTime: draft.manualSlotStart, endTime: draft.manualSlotEnd, assignedSoldierIds: [], requiredRoles: draft.requiredRoles, status: 'open' as const }]
        : [];

    // Validate confusion deviation stays within shift bounds
    const confusionOk = !draft.enableConfusion || draft.confusionDeviationMinutes <= (draft.maxShiftMinutes - draft.minShiftMinutes) / 2;

    const mission: MissionType = {
      id:       editingMissionId ?? `mt-${Date.now()}`,
      name:     draft.name,
      category: draft.category,
      minSoldiers:         draft.minSoldiers,
      recommendedSoldiers: draft.recommendedSoldiers,
      maxSoldiers:         draft.maxSoldiers,
      requiredRoles:   draft.requiredRoles,
      needsCommander:  draft.needsCommander,
      needsMedic:      draft.needsMedic,
      minShiftMinutes: draft.minShiftMinutes,
      maxShiftMinutes: draft.maxShiftMinutes,
      activeStartTime:    draft.activeStartTime,
      activeEndTime:      draft.activeEndTime,
      shiftDurationHours: draft.shiftDurationHours,
      recurring:          draft.recurring,
      conflictsWith: draft.conflictsWith,
      canOverlapWith: draft.canOverlapWith,
      soldierMixing: draft.soldierMixing,
      classMixing:   draft.classMixing,
      hasEquipment:      draft.hasEquipment,
      equipmentRequired: draft.equipmentRequired,
      enableCadar:               draft.enableCadar,
      enableConfusion:           draft.enableConfusion,
      confusionDeviationMinutes: confusionOk ? draft.confusionDeviationMinutes : Math.floor((draft.maxShiftMinutes - draft.minShiftMinutes) / 2),
      pairings:  [],
      timeSlots: editingMissionId
        ? (period.missionTypes.find((m) => m.id === editingMissionId)?.timeSlots ?? timeSlots)
        : timeSlots,
    };

    const updatedMissions = editingMissionId
      ? period.missionTypes.map((m) => m.id === editingMissionId ? mission : m)
      : [...period.missionTypes, mission];

    updatePeriod({ ...period, missionTypes: updatedMissions });
    addAuditLog({ actorName: currentUser!.name, actorRole: currentRole, action: editingMissionId ? 'ערך משימה' : 'הוסיף משימה', target: draft.name });
    setWizardOpen(false);
    showFlash(editingMissionId ? 'המשימה עודכנה' : 'המשימה נוספה לתקופה');
  };

  // ── Filtered missions for soldiers ───────────────────────────────────────────

  const filteredMissions = (() => {
    if (isManager || viewMode === 'all' || !myProfile) return period?.missionTypes ?? [];
    return (period?.missionTypes ?? [])
      .map((mt) => ({ ...mt, timeSlots: mt.timeSlots.filter((ts) => ts.assignedSoldierIds.includes(myProfile.id)) }))
      .filter((mt) => mt.timeSlots.length > 0);
  })();

  const getSoldierName = (id: string) => soldiers.find((s) => s.id === id)?.name ?? id;
  const totalConflicts = period?.missionTypes.flatMap((mt) => mt.timeSlots).filter((ts) => ts.status === 'conflict').length ?? 0;

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="שיבוץ" />

      <main className="px-4 py-4 pb-28 max-w-xl mx-auto space-y-3">

        {flash && <div className="bg-mil-success-bg border border-mil-success-border text-mil-success rounded-xl px-4 py-2.5 text-sm">✓ {flash}</div>}

        {/* My / All toggle for soldiers */}
        {!isManager && (
          <div className="flex bg-mil-card border border-mil-border rounded-xl overflow-hidden">
            {(['my', 'all'] as const).map((m) => (
              <button key={m} onClick={() => setViewMode(m)}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${viewMode === m ? 'bg-mil-olive text-white' : 'text-mil-muted hover:text-mil-text'}`}>
                {m === 'my' ? 'השיבוץ שלי' : 'כל השיבוץ'}
              </button>
            ))}
          </div>
        )}

        {/* ── Period Selector ─────────────────────────────────────────────────── */}
        <div className="bg-mil-card border border-mil-border rounded-xl overflow-hidden">
          <div className="bg-mil-surface border-b border-mil-border px-4 py-2.5 flex items-center gap-2">
            <span className="text-xs font-bold tracking-widest text-mil-text-inv/80">תקופות שיבוץ</span>
          </div>
          <div className="flex gap-2 p-3 overflow-x-auto">
            {visiblePeriods.map((p) => {
              const conflicts = p.missionTypes.flatMap((mt) => mt.timeSlots).filter((ts) => ts.status === 'conflict').length;
              return (
                <button key={p.id} onClick={() => setSelectedId(p.id)}
                  className={`flex-shrink-0 flex flex-col items-start px-3 py-2 rounded-lg border text-right transition-colors relative ${
                    selectedId === p.id ? 'bg-mil-olive border-mil-olive text-white' : 'bg-mil-bg border-mil-border text-mil-muted hover:border-mil-olive/40'
                  }`}>
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="text-xs opacity-70">{p.status === 'draft' ? 'טיוטה' : 'פורסם'} · {p.missionTypes.length} משימות</span>
                  {conflicts > 0 && <span className={`absolute -top-1 -right-1 text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold ${selectedId === p.id ? 'bg-white text-mil-olive' : 'bg-mil-alert text-white'}`}>{conflicts}</span>}
                </button>
              );
            })}
            {isManager && (
              <button onClick={() => setShowNewPeriod((v) => !v)}
                className="flex-shrink-0 flex flex-col items-center justify-center px-3 py-2 rounded-lg border border-dashed border-mil-olive/40 text-mil-olive hover:bg-mil-olive-bg transition-colors">
                <span className="text-lg leading-none">+</span>
                <span className="text-[10px]">תקופה</span>
              </button>
            )}
          </div>

          {/* New period form */}
          {showNewPeriod && isManager && (
            <div className="border-t border-mil-border px-4 py-3 space-y-3 bg-mil-bg">
              <p className="text-xs font-medium text-mil-muted">תקופת שיבוץ חדשה</p>
              <input className={inp} placeholder="שבוע 19–25 במאי / כוננות סופ״ש" value={periodForm.name}
                onChange={(e) => setPeriodForm((f) => ({ ...f, name: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className={inp} value={periodForm.startDate}
                  onChange={(e) => setPeriodForm((f) => ({ ...f, startDate: e.target.value }))} />
                <input type="date" className={inp} value={periodForm.endDate}
                  onChange={(e) => setPeriodForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowNewPeriod(false)} className="flex-1 py-2 rounded-lg text-sm text-mil-muted border border-mil-border hover:border-mil-olive/40 transition-colors">ביטול</button>
                <button onClick={handleCreatePeriod} disabled={!periodForm.name || !periodForm.startDate || !periodForm.endDate}
                  className="flex-1 py-2 rounded-lg text-sm text-white font-medium bg-mil-olive hover:bg-mil-olive-light disabled:opacity-40 transition-colors">צור תקופה</button>
              </div>
            </div>
          )}
        </div>

        {/* ── Period content ──────────────────────────────────────────────────── */}
        {period ? (
          <>
            {/* Period header + stats */}
            <div className="bg-mil-card border border-mil-border rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="font-bold text-mil-text text-base">{period.name}</h2>
                  <p className="text-xs text-mil-muted">{period.startDate} – {period.endDate}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded border ${period.status === 'published' ? 'bg-mil-success-bg text-mil-success border-mil-success-border' : 'bg-mil-warn-bg text-mil-warn border-mil-warn-border'}`}>
                  {period.status === 'published' ? 'פורסם' : 'טיוטה'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div><p className="text-xl font-bold text-mil-olive">{period.missionTypes.length}</p><p className="text-xs text-mil-muted">משימות</p></div>
                <div><p className="text-xl font-bold text-mil-text">{period.missionTypes.flatMap((mt) => mt.timeSlots).length}</p><p className="text-xs text-mil-muted">משמרות</p></div>
                <div><p className={`text-xl font-bold ${totalConflicts > 0 ? 'text-mil-alert' : 'text-mil-ghost'}`}>{totalConflicts}</p><p className="text-xs text-mil-muted">בעיות</p></div>
              </div>

              {isManager && (
                <div className="flex gap-2">
                  <button onClick={openAddMission}
                    className="flex-1 bg-mil-olive hover:bg-mil-olive-light text-white text-sm font-medium py-2 rounded-lg transition-colors">
                    + הוסף משימה
                  </button>
                  {canRecalculate(currentRole) && (
                    <button onClick={handleRecalculate}
                      className="flex-1 bg-mil-card border border-mil-border hover:border-mil-olive text-mil-text text-sm py-2 rounded-lg transition-colors">
                      חשב שיבוץ
                    </button>
                  )}
                  {canPublishSchedule(currentRole) && period.status === 'draft' && (
                    <button onClick={handlePublish}
                      className="flex-1 bg-mil-sand-bg border border-mil-sand/40 text-mil-warn text-sm font-medium py-2 rounded-lg hover:bg-mil-sand hover:text-white transition-colors">
                      פרסם
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Draft notice */}
            {period.status === 'draft' && (
              <div className="bg-mil-warn-bg border border-mil-warn-border text-mil-warn rounded-lg px-3 py-2 text-xs">
                ⚑ טיוטה — חיילים אינם רואים שיבוץ זה עד לפרסום
              </div>
            )}

            {/* Manager-only warnings panel */}
            {isManager && lastGeneratedPeriodId === period.id && lastWarnings.length > 0 && (
              <ManagerWarningsPanel warnings={lastWarnings} />
            )}

            {/* Manager-only fairness panel (collapsible) */}
            {isManager && lastGeneratedPeriodId === period.id && lastFairness.length > 0 && (
              <FairnessPanel
                fairness={lastFairness}
                expanded={showFairness}
                onToggle={() => setShowFairness((v) => !v)}
              />
            )}

            {/* Manager notes */}
            {canViewCommanderNotes(currentRole) && period.commanderNotes.length > 0 && (
              <div className="bg-mil-card border border-mil-olive/20 rounded-xl overflow-hidden">
                <div className="bg-mil-surface border-b border-mil-border px-4 py-2.5 flex items-center gap-2">
                  <span className="text-xs font-bold tracking-widest text-mil-sand">הערות מנהל</span>
                  <span className="text-xs text-mil-text-inv/40">(מוסתר מחיילים)</span>
                </div>
                <div className="px-4 py-3 space-y-1.5">
                  {period.commanderNotes.map((n) => (
                    <div key={n.id} className="flex gap-2 text-xs">
                      <span className="text-mil-olive mt-0.5">▸</span>
                      <span className="text-mil-text">{n.text}</span>
                      <span className="text-mil-ghost mr-auto">— {n.authorName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Missions ──────────────────────────────────────────────────── */}
            {filteredMissions.length === 0 ? (
              <div className="text-center py-12 text-mil-ghost">
                <p className="text-4xl mb-2">▦</p>
                <p>{viewMode === 'my' ? 'אין משמרות משובצות עבורך' : 'אין משימות בתקופה זו'}</p>
                {isManager && (
                  <button onClick={openAddMission} className="mt-3 text-mil-olive hover:text-mil-olive-light text-sm transition-colors">
                    + הוסף משימה ראשונה
                  </button>
                )}
              </div>
            ) : (
              filteredMissions.map((mt) => {
                const isOpen    = expanded === mt.id;
                const conflicts = mt.timeSlots.filter((ts) => ts.status === 'conflict').length;

                return (
                  <div key={mt.id} className="bg-mil-card border border-mil-border rounded-xl overflow-hidden">
                    {/* Mission header */}
                    <div className="flex items-center gap-2 px-4 py-3">
                      <button onClick={() => setExpanded(isOpen ? null : mt.id)} className="flex-1 flex items-start justify-between text-right hover:opacity-80 transition-opacity">
                        <div>
                          <p className="font-bold text-mil-text text-sm">{mt.name}</p>
                          <p className="text-xs text-mil-muted">{mt.category} · {mt.timeSlots.length} משמרות</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {conflicts > 0 && <span className="text-xs bg-mil-alert-bg text-mil-alert px-2 py-0.5 rounded border border-mil-alert-border">{conflicts} בעיות</span>}
                          <span className="text-mil-ghost">{isOpen ? '▲' : '▼'}</span>
                        </div>
                      </button>
                      {isManager && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => openEditMission(mt)}
                            className="text-xs px-2 py-1 rounded border border-mil-border text-mil-muted hover:border-mil-olive hover:text-mil-olive transition-colors">ערוך</button>
                          <button onClick={() => { if (confirm(`מחק את "${mt.name}"?`)) deleteMission(mt.id); }}
                            className="text-xs px-2 py-1 rounded border border-mil-alert/30 text-mil-alert hover:bg-mil-alert hover:text-white transition-colors">מחק</button>
                        </div>
                      )}
                    </div>

                    {/* Time slots */}
                    {isOpen && (
                      <div className="border-t border-mil-border divide-y divide-mil-border">
                        {mt.timeSlots.length === 0 && (
                          <p className="px-4 py-3 text-xs text-mil-ghost">אין משמרות — הוסף ידנית או השתמש בחזרתי</p>
                        )}
                        {mt.timeSlots.map((ts) => (
                          <div
                            key={ts.id}
                            className={`px-4 py-2.5 ${isManager ? 'cursor-pointer hover:bg-mil-olive-bg/30 transition-colors' : ''}`}
                            onClick={() => isManager && setOverrideTarget({ missionId: mt.id, slotId: ts.id })}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm text-mil-muted">{ts.date} · {ts.startTime}–{ts.endTime}</span>
                              <span className={`text-xs px-2 py-0.5 rounded border ${statusStyle[ts.status]}`}>
                                {{ filled: 'מאויש', conflict: 'בעיה', open: 'פתוח' }[ts.status]}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {ts.assignedSoldierIds.length === 0 ? (
                                <span className="text-xs text-mil-ghost">{isManager ? 'לחץ לשיבוץ ידני' : 'אין חיילים משובצים'}</span>
                              ) : ts.assignedSoldierIds.map((sid) => (
                                <span key={sid} className={`text-xs px-2 py-0.5 rounded border ${sid === myProfile?.id ? 'bg-mil-olive-bg border-mil-olive/40 text-mil-olive font-medium' : 'bg-mil-bg border-mil-border text-mil-text'}`}>
                                  {getSoldierName(sid)}
                                </span>
                              ))}
                              {isManager && ts.assignedSoldierIds.length > 0 && (
                                <span className="text-xs text-mil-ghost">לחץ לעריכה</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        ) : (
          <div className="text-center py-16 text-mil-ghost">
            <p className="text-5xl mb-3">▦</p>
            <p className="text-base">אין תקופות שיבוץ</p>
            {isManager && (
              <button onClick={() => setShowNewPeriod(true)} className="mt-3 text-mil-olive hover:text-mil-olive-light text-sm transition-colors">
                + צור תקופה ראשונה
              </button>
            )}
          </div>
        )}
      </main>

      {/* ── Mission Wizard Modal ─────────────────────────────────────────────── */}
      {wizardOpen && (
        <MissionWizard
          draft={draft}
          setDraft={setDraft}
          step={wizardStep}
          setStep={setWizardStep}
          period={period}
          editingId={editingMissionId}
          onSave={saveMission}
          onClose={() => setWizardOpen(false)}
        />
      )}

      {/* ── Manual Override Modal ────────────────────────────────────────────── */}
      {overrideTarget && period && isManager && (() => {
        const mt = period.missionTypes.find((m) => m.id === overrideTarget.missionId);
        const ts = mt?.timeSlots.find((s) => s.id === overrideTarget.slotId);
        if (!mt || !ts) return null;
        return (
          <OverrideModal
            mission={mt}
            slot={ts}
            allSoldiers={soldiers}
            onAssign={(sid) => handleAssign(mt.id, ts.id, sid)}
            onUnassign={(sid) => handleUnassign(mt.id, ts.id, sid)}
            onRegenerate={() => handleRegenerateSlot(mt.id, ts.id)}
            onClose={() => setOverrideTarget(null)}
          />
        );
      })()}
    </div>
  );
}

// ─── Mission Wizard ───────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

function MissionWizard({
  draft, setDraft, step, setStep, period, editingId, onSave, onClose,
}: {
  draft: MissionDraft;
  setDraft: React.Dispatch<React.SetStateAction<MissionDraft>>;
  step: number; setStep: (n: number) => void;
  period?: SchedulePeriod;
  editingId: string | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const otherMissions = (period?.missionTypes ?? []).filter((m) => m.id !== (editingId ?? ''));

  const canNext = () => {
    if (step === 1) return draft.name.trim().length >= 2;
    return true;
  };

  const confusionValid = !draft.enableConfusion ||
    draft.confusionDeviationMinutes <= (draft.maxShiftMinutes - draft.minShiftMinutes) / 2;

  const toggleRole = (r: OperationalRole) =>
    setDraft((d) => ({ ...d, requiredRoles: d.requiredRoles.includes(r) ? d.requiredRoles.filter((x) => x !== r) : [...d.requiredRoles, r] }));

  const toggleEquip = (key: keyof EquipmentRequirements) =>
    setDraft((d) => ({ ...d, equipmentRequired: { ...d.equipmentRequired, [key]: !d.equipmentRequired[key] } }));

  const toggleConflict = (id: string) =>
    setDraft((d) => ({ ...d, conflictsWith: d.conflictsWith.includes(id) ? d.conflictsWith.filter((x) => x !== id) : [...d.conflictsWith, id] }));

  const toggleOverlap = (id: string) =>
    setDraft((d) => ({ ...d, canOverlapWith: d.canOverlapWith.includes(id) ? d.canOverlapWith.filter((x) => x !== id) : [...d.canOverlapWith, id] }));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center" dir="rtl">
      <div className="w-full max-w-lg bg-mil-card rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col">
        {/* Wizard header */}
        <div className="bg-mil-surface rounded-t-2xl px-5 py-4 flex items-center gap-3 flex-shrink-0">
          <button onClick={onClose} className="text-mil-text-inv/70 hover:text-mil-text-inv text-xl leading-none">✕</button>
          <div className="flex-1">
            <p className="text-mil-text-inv font-bold text-sm">{editingId ? 'עריכת משימה' : 'הוסף משימה'}</p>
            <p className="text-mil-text-inv/60 text-xs">שלב {step} מתוך {TOTAL_STEPS}</p>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div key={i} className={`h-1 rounded-full transition-all ${i < step ? 'bg-mil-sand w-5' : i === step - 1 ? 'bg-white/80 w-5' : 'bg-white/20 w-2'}`} />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Step 1: Name + Category */}
          {step === 1 && (
            <WizSection title="שם ומסווג המשימה">
              <Field label="שם המשימה">
                <input className={winp} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="שמירת שער צפון / חמ״ל / מטבח" autoFocus />
              </Field>
              <Field label="קטגוריה">
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button key={c} type="button" onClick={() => setDraft((d) => ({ ...d, category: c }))}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${draft.category === c ? 'bg-mil-olive border-mil-olive text-white' : 'bg-mil-bg border-mil-border text-mil-muted hover:border-mil-olive/40'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </Field>
            </WizSection>
          )}

          {/* Step 2: Manpower + Timing */}
          {step === 2 && (
            <>
              <WizSection title="כוח אדם">
                <div className="grid grid-cols-3 gap-2">
                  <Field label="מינימום"><input type="number" min={0} max={50} className={winp} value={draft.minSoldiers} onChange={(e) => setDraft((d) => ({ ...d, minSoldiers: Number(e.target.value) }))} /></Field>
                  <Field label="מומלץ">  <input type="number" min={0} max={50} className={winp} value={draft.recommendedSoldiers} onChange={(e) => setDraft((d) => ({ ...d, recommendedSoldiers: Number(e.target.value) }))} /></Field>
                  <Field label="מקסימום"><input type="number" min={0} max={50} className={winp} value={draft.maxSoldiers} onChange={(e) => setDraft((d) => ({ ...d, maxSoldiers: Number(e.target.value) }))} /></Field>
                </div>
              </WizSection>
              <WizSection title="זמני פעילות">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="חלון פתיחה"><input type="time" className={winp} value={draft.activeStartTime} onChange={(e) => setDraft((d) => ({ ...d, activeStartTime: e.target.value }))} /></Field>
                  <Field label="חלון סגירה"> <input type="time" className={winp} value={draft.activeEndTime}   onChange={(e) => setDraft((d) => ({ ...d, activeEndTime: e.target.value }))} /></Field>
                </div>
                <Field label="משך משמרת (שעות)">
                  <input type="number" min={1} max={24} className={winp} value={draft.shiftDurationHours}
                    onChange={(e) => setDraft((d) => ({ ...d, shiftDurationHours: Number(e.target.value) }))} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="משמרת מינ׳ (דקות)"><input type="number" min={30} step={15} className={winp} value={draft.minShiftMinutes} onChange={(e) => setDraft((d) => ({ ...d, minShiftMinutes: Number(e.target.value) }))} /></Field>
                  <Field label="משמרת מקס׳ (דקות)"><input type="number" min={60} step={15} className={winp} value={draft.maxShiftMinutes} onChange={(e) => setDraft((d) => ({ ...d, maxShiftMinutes: Number(e.target.value) }))} /></Field>
                </div>
                <Toggle label="חזרתי — צור משמרות אוטומטית לכל יום"
                  checked={draft.recurring} onChange={(v) => setDraft((d) => ({ ...d, recurring: v }))} />
                {!draft.recurring && (
                  <>
                    <p className="text-xs text-mil-muted">משמרת ראשונה ידנית:</p>
                    <Field label="תאריך"><input type="date" className={winp} value={draft.manualSlotDate} onChange={(e) => setDraft((d) => ({ ...d, manualSlotDate: e.target.value }))} /></Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="שעת התחלה"><input type="time" className={winp} value={draft.manualSlotStart} onChange={(e) => setDraft((d) => ({ ...d, manualSlotStart: e.target.value }))} /></Field>
                      <Field label="שעת סיום">  <input type="time" className={winp} value={draft.manualSlotEnd}   onChange={(e) => setDraft((d) => ({ ...d, manualSlotEnd: e.target.value }))} /></Field>
                    </div>
                  </>
                )}
              </WizSection>
            </>
          )}

          {/* Step 3: Roles + Equipment */}
          {step === 3 && (
            <>
              <WizSection title="תפקידים נדרשים">
                <div className="flex flex-wrap gap-1.5">
                  {OP_ROLES.map((r) => (
                    <button key={r} type="button" onClick={() => toggleRole(r)}
                      className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${draft.requiredRoles.includes(r) ? 'bg-mil-olive border-mil-olive text-white' : 'bg-mil-bg border-mil-border text-mil-muted hover:border-mil-olive/40'}`}>
                      {r}
                    </button>
                  ))}
                </div>
                <div className="space-y-1 pt-2 border-t border-mil-border">
                  <Toggle label="נדרש מפקד (מ״מ ומעלה)" checked={draft.needsCommander} onChange={(v) => setDraft((d) => ({ ...d, needsCommander: v }))} />
                  <Toggle label="נדרש חובש"              checked={draft.needsMedic}     onChange={(v) => setDraft((d) => ({ ...d, needsMedic: v }))} />
                </div>
              </WizSection>
              <WizSection title="ציוד">
                <Toggle label="משימה דורשת ציוד מיוחד" checked={draft.hasEquipment} onChange={(v) => setDraft((d) => ({ ...d, hasEquipment: v }))} />
                {draft.hasEquipment && (
                  <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-mil-border">
                    {(Object.keys(EQUIP_LABELS) as (keyof EquipmentRequirements)[]).map((key) => (
                      <button key={key} type="button" onClick={() => toggleEquip(key)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${draft.equipmentRequired[key] ? 'bg-mil-olive-bg border-mil-olive text-mil-olive-dim' : 'bg-mil-bg border-mil-border text-mil-muted hover:border-mil-olive/40'}`}>
                        <span>{draft.equipmentRequired[key] ? '✓' : '○'}</span>
                        <span>{EQUIP_LABELS[key]}</span>
                      </button>
                    ))}
                  </div>
                )}
              </WizSection>
            </>
          )}

          {/* Step 4: Conflicts + Mixing */}
          {step === 4 && (
            <>
              {otherMissions.length > 0 && (
                <WizSection title="חפיפות עם משימות אחרות בתקופה">
                  <p className="text-xs text-mil-muted">סמן משימות שלא ניתן לשבץ בהן חייל בו-זמנית:</p>
                  {otherMissions.map((m) => (
                    <button key={m.id} type="button" onClick={() => toggleConflict(m.id)}
                      className={`w-full text-right px-3 py-2 rounded-lg border text-sm flex items-center gap-2 transition-colors ${draft.conflictsWith.includes(m.id) ? 'bg-mil-alert-bg border-mil-alert/40 text-mil-alert' : 'bg-mil-bg border-mil-border text-mil-muted hover:border-mil-border-strong'}`}>
                      <span className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 text-xs">
                        {draft.conflictsWith.includes(m.id) ? '✕' : '○'}
                      </span>
                      {m.name} <span className="text-xs opacity-60 mr-auto">{m.category}</span>
                    </button>
                  ))}
                  <p className="text-xs text-mil-muted mt-1">סמן משימות שמותר לשבץ חייל גם בהן:</p>
                  {otherMissions.map((m) => (
                    <button key={m.id + '-ov'} type="button" onClick={() => toggleOverlap(m.id)}
                      className={`w-full text-right px-3 py-2 rounded-lg border text-sm flex items-center gap-2 transition-colors ${draft.canOverlapWith.includes(m.id) ? 'bg-mil-success-bg border-mil-success/40 text-mil-success' : 'bg-mil-bg border-mil-border text-mil-muted hover:border-mil-border-strong'}`}>
                      <span className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 text-xs">
                        {draft.canOverlapWith.includes(m.id) ? '✓' : '○'}
                      </span>
                      {m.name} <span className="text-xs opacity-60 mr-auto">{m.category}</span>
                    </button>
                  ))}
                </WizSection>
              )}
              <WizSection title="מדיניות ערבוב">
                <div>
                  <p className="text-xs text-mil-muted mb-1.5">ערבוב חיילים</p>
                  <div className="flex gap-2">
                    {([['mix', 'ערבוב חופשי'], ['dedicated', 'צוות קבוע']] as [SoldierMixingPolicy, string][]).map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setDraft((d) => ({ ...d, soldierMixing: v }))}
                        className={`flex-1 py-2 rounded-lg text-xs border transition-colors ${draft.soldierMixing === v ? 'bg-mil-olive border-mil-olive text-white' : 'bg-mil-bg border-mil-border text-mil-muted'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-mil-muted mb-1.5">ערבוב כיתות</p>
                  <div className="flex gap-2">
                    {([['mix', 'ערבוב כיתות'], ['no-mix', 'כיתה אחת']] as [ClassMixingPolicy, string][]).map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setDraft((d) => ({ ...d, classMixing: v }))}
                        className={`flex-1 py-2 rounded-lg text-xs border transition-colors ${draft.classMixing === v ? 'bg-mil-olive border-mil-olive text-white' : 'bg-mil-bg border-mil-border text-mil-muted'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </WizSection>
            </>
          )}

          {/* Step 5: Advanced */}
          {step === 5 && (
            <WizSection title="הגדרות מתקדמות">
              <Toggle label="קאדר — איזון עומסים אוטומטי" checked={draft.enableCadar} onChange={(v) => setDraft((d) => ({ ...d, enableCadar: v }))} />
              <Toggle label="בלבול אויב — הסתרת דפוסים" checked={draft.enableConfusion} onChange={(v) => setDraft((d) => ({ ...d, enableConfusion: v }))} />
              {draft.enableConfusion && (
                <>
                  <Field label="סטייה מרבית (דקות)">
                    <input type="number" min={5} max={60} step={5} className={winp} value={draft.confusionDeviationMinutes}
                      onChange={(e) => setDraft((d) => ({ ...d, confusionDeviationMinutes: Number(e.target.value) }))} />
                  </Field>
                  {!confusionValid && (
                    <div className="bg-mil-warn-bg border border-mil-warn-border text-mil-warn rounded-lg px-3 py-2 text-xs">
                      ⚠ הסטייה חייבת להיות לכל היותר {Math.floor((draft.maxShiftMinutes - draft.minShiftMinutes) / 2)} דקות (כדי שהמשמרות יישארו בתוך גבולות {draft.minShiftMinutes}–{draft.maxShiftMinutes} דקות).
                      הערך יתוקן אוטומטית בשמירה.
                    </div>
                  )}
                </>
              )}

              {/* Summary */}
              <div className="bg-mil-olive-bg border border-mil-olive/20 rounded-xl p-3 text-xs space-y-1 mt-2">
                <p className="font-bold text-mil-olive-dim mb-1">סיכום</p>
                <SummRow label="משימה"   value={`${draft.name} (${draft.category})`} />
                <SummRow label="כוח אדם" value={`${draft.minSoldiers}–${draft.maxSoldiers} חיילים`} />
                <SummRow label="שעות"    value={`${draft.activeStartTime}–${draft.activeEndTime} · ${draft.shiftDurationHours}ש׳ משמרת`} />
                <SummRow label="גבולות"  value={`${draft.minShiftMinutes}–${draft.maxShiftMinutes} דקות`} />
                <SummRow label="משמרות"  value={draft.recurring ? 'חזרתי' : 'ידני'} />
                {draft.conflictsWith.length > 0 && <SummRow label="אינו עם" value={`${draft.conflictsWith.length} משימות`} />}
                {draft.hasEquipment && <SummRow label="ציוד" value="נדרש" />}
              </div>
            </WizSection>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-mil-border flex gap-2">
          {step > 1 ? (
            <button onClick={() => setStep(step - 1)}
              className="flex-1 py-2.5 rounded-xl border border-mil-border text-mil-muted hover:border-mil-olive/40 text-sm transition-colors">
              ← חזור
            </button>
          ) : (
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-mil-border text-mil-muted text-sm transition-colors">
              ביטול
            </button>
          )}
          {step < TOTAL_STEPS ? (
            <button onClick={() => canNext() && setStep(step + 1)} disabled={!canNext()}
              className="flex-1 py-2.5 rounded-xl bg-mil-olive hover:bg-mil-olive-light disabled:opacity-40 text-white font-medium text-sm transition-colors">
              המשך →
            </button>
          ) : (
            <button onClick={onSave} disabled={!draft.name}
              className="flex-1 py-2.5 rounded-xl bg-mil-olive hover:bg-mil-olive-light disabled:opacity-40 text-white font-bold text-sm transition-colors">
              {editingId ? 'עדכן משימה ✓' : 'שמור משימה ✓'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Wizard sub-components ────────────────────────────────────────────────────

function WizSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-mil-muted uppercase tracking-widest">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs text-mil-muted mb-1.5">{label}</label>{children}</div>;
}

function Toggle({ label, checked, onChange }: { label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-1 cursor-pointer">
      <span className="text-sm text-mil-text">{label}</span>
      <div onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${checked ? 'bg-mil-olive' : 'bg-mil-border'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'right-0.5' : 'right-5'}`} />
      </div>
    </label>
  );
}

function SummRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-mil-muted min-w-[60px]">{label}:</span>
      <span className="text-mil-text">{value}</span>
    </div>
  );
}

const inp  = 'w-full bg-mil-bg border border-mil-border rounded-lg px-3 py-2 text-sm text-mil-text focus:outline-none focus:ring-1 focus:ring-mil-olive focus:border-mil-olive placeholder:text-mil-ghost';
const winp = 'w-full bg-mil-bg border border-mil-border rounded-lg px-3 py-2 text-sm text-mil-text focus:outline-none focus:ring-1 focus:ring-mil-olive focus:border-mil-olive placeholder:text-mil-ghost';

// ─── Manager warnings panel (manager-only) ──────────────────────────────────

function ManagerWarningsPanel({ warnings }: { warnings: ShiftWarning[] }) {
  const critical = warnings.filter((w) => w.severity === 'critical');
  const warns    = warnings.filter((w) => w.severity === 'warning');
  const infos    = warnings.filter((w) => w.severity === 'info');

  return (
    <div className="bg-mil-card border border-mil-border rounded-xl overflow-hidden">
      <div className="bg-mil-surface border-b border-mil-border px-4 py-2.5 flex items-center gap-2">
        <span className="text-xs font-bold tracking-widest text-mil-text-inv/80">אזהרות מנהל</span>
        <span className="text-xs text-mil-text-inv/50">(מוסתר מחיילים)</span>
        <span className="text-xs text-mil-text-inv/70 mr-auto">{warnings.length} סה״כ</span>
      </div>
      <div className="divide-y divide-mil-border">
        {critical.length > 0 && (
          <WarnGroup label="קריטי"   tone="alert"   items={critical} />
        )}
        {warns.length > 0 && (
          <WarnGroup label="אזהרה"   tone="warn"    items={warns} />
        )}
        {infos.length > 0 && (
          <WarnGroup label="מידע"   tone="info"    items={infos} />
        )}
      </div>
    </div>
  );
}

function WarnGroup({ label, tone, items }: { label: string; tone: 'alert' | 'warn' | 'info'; items: ShiftWarning[] }) {
  const dot = tone === 'alert' ? 'bg-mil-alert' : tone === 'warn' ? 'bg-mil-warn' : 'bg-mil-ghost';
  const text = tone === 'alert' ? 'text-mil-alert' : tone === 'warn' ? 'text-mil-warn' : 'text-mil-muted';
  return (
    <div className="px-4 py-2.5 space-y-1.5">
      <p className={`text-xs font-bold ${text}`}>● {label} ({items.length})</p>
      {items.map((w, i) => (
        <div key={i} className="flex items-start gap-2 text-xs">
          <span className={`w-1.5 h-1.5 mt-1.5 rounded-full ${dot} flex-shrink-0`} />
          <span className="text-mil-text leading-relaxed">{w.message}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Fairness panel (manager-only) ──────────────────────────────────────────

function FairnessPanel({ fairness, expanded, onToggle }: { fairness: FairnessScore[]; expanded: boolean; onToggle: () => void }) {
  const overloaded   = fairness.filter((f) => f.flag === 'overloaded').length;
  const underloaded  = fairness.filter((f) => f.flag === 'underloaded').length;

  return (
    <div className="bg-mil-card border border-mil-border rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full bg-mil-surface px-4 py-2.5 flex items-center gap-2 hover:bg-mil-surface-hover transition-colors"
      >
        <span className="text-xs font-bold tracking-widest text-mil-text-inv/80">איזון עומסים</span>
        <span className="text-xs text-mil-text-inv/50">(מוסתר מחיילים)</span>
        {overloaded > 0 && <span className="text-xs bg-mil-alert/80 text-white px-1.5 py-0.5 rounded">{overloaded} עמוסים</span>}
        {underloaded > 0 && <span className="text-xs bg-mil-sand/80 text-white px-1.5 py-0.5 rounded">{underloaded} פנויים</span>}
        <span className="mr-auto text-mil-text-inv/70">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="divide-y divide-mil-border max-h-64 overflow-y-auto">
          {fairness.map((f) => {
            const tone = f.flag === 'overloaded' ? 'bg-mil-alert' : f.flag === 'underloaded' ? 'bg-mil-sand' : 'bg-mil-olive';
            return (
              <div key={f.soldierId} className="px-4 py-2.5 flex items-center gap-3 text-xs">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: f.flag === 'overloaded' ? '#cc2020' : f.flag === 'underloaded' ? '#c8a855' : '#5a8a3c' }} />
                <span className="text-sm text-mil-text flex-1">{f.soldierName}</span>
                <span className="text-mil-muted">{f.currentPeriodHours.toFixed(1)} שע׳ בתקופה</span>
                <span className="text-mil-ghost">·</span>
                <span className="text-mil-muted">{f.totalHours.toFixed(0)} סה״כ</span>
                <div className="w-20 h-1.5 bg-mil-bg rounded-full overflow-hidden flex-shrink-0">
                  <div className={`h-full ${tone}`} style={{ width: `${f.loadIndex}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Manual override modal ───────────────────────────────────────────────────

function OverrideModal({
  mission, slot, allSoldiers, onAssign, onUnassign, onRegenerate, onClose,
}: {
  mission: MissionType;
  slot: TimeSlot;
  allSoldiers: import('../types').Soldier[];
  onAssign: (id: string) => void;
  onUnassign: (id: string) => void;
  onRegenerate: () => void;
  onClose: () => void;
}) {
  const [picker, setPicker] = useState('');
  const assigned   = allSoldiers.filter((s) => slot.assignedSoldierIds.includes(s.id));
  const candidates = allSoldiers.filter((s) => s.availability && !slot.assignedSoldierIds.includes(s.id));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center" dir="rtl">
      <div className="w-full max-w-sm bg-mil-card rounded-t-2xl sm:rounded-2xl flex flex-col">
        <div className="bg-mil-surface rounded-t-2xl px-4 py-3 flex items-center gap-3">
          <button onClick={onClose} className="text-mil-text-inv/70 hover:text-mil-text-inv text-xl leading-none">✕</button>
          <div className="flex-1">
            <p className="text-mil-text-inv font-bold text-sm">עריכת משמרת ידנית</p>
            <p className="text-mil-text-inv/70 text-xs">{mission.name} · {slot.date} · {slot.startTime}–{slot.endTime}</p>
          </div>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-mil-muted mb-2">משובצים ({assigned.length}/{mission.recommendedSoldiers})</p>
            {assigned.length === 0 ? (
              <p className="text-xs text-mil-ghost">אין חיילים משובצים</p>
            ) : (
              <div className="space-y-1.5">
                {assigned.map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-mil-olive-bg border border-mil-olive/30 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm text-mil-text">{s.name}</p>
                      <p className="text-xs text-mil-muted">{s.teamClass} · {s.operationalRoles.join(', ') || '—'}</p>
                    </div>
                    <button
                      onClick={() => onUnassign(s.id)}
                      className="text-xs px-2 py-1 rounded border border-mil-alert/40 text-mil-alert hover:bg-mil-alert hover:text-white transition-colors"
                    >
                      הסר
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-mil-muted mb-2">הוסף חייל</p>
            <select
              value={picker}
              onChange={(e) => setPicker(e.target.value)}
              className={inp}
            >
              <option value="">בחר חייל...</option>
              {candidates.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.teamClass} {s.operationalRoles.length > 0 ? `(${s.operationalRoles.join(', ')})` : ''}
                </option>
              ))}
            </select>
            <button
              onClick={() => { if (picker) { onAssign(picker); setPicker(''); } }}
              disabled={!picker}
              className="w-full mt-2 bg-mil-olive hover:bg-mil-olive-light disabled:opacity-40 text-white font-medium py-2 rounded-lg text-sm transition-colors"
            >
              + שבץ ידנית
            </button>
          </div>

          <div className="border-t border-mil-border pt-3">
            <button
              onClick={onRegenerate}
              className="w-full bg-mil-card border border-mil-border hover:border-mil-olive text-mil-text font-medium py-2 rounded-lg text-sm transition-colors"
            >
              ↻ חשב משמרת זו מחדש
            </button>
            <p className="text-xs text-mil-ghost mt-1.5 text-center leading-relaxed">
              הסידור הוא עזר. ההחלטה הסופית בידי המפקד.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
