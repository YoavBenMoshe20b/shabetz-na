// Mission detail — structured definition + free operational notes.
//
// The "structured rules + free operational extensions" idea made visible.
// What the algorithm consumes (time / manpower / command / fatigue /
// requirements) appears as operational prose; what the algorithm IGNORES
// (notes) appears as a separate, role-scoped notes layer:
//
//   CC adds company-scope notes — visible to anyone running the mission
//   PC/PS add platoon-scope notes — visible only inside that platoon
//   Soldiers see the company notes + their own platoon's notes
//
// Viewer scopes:
//   CC/Deputy → everything + can author company notes
//   PC/PS     → everything + can author/edit own platoon's notes
//   Soldier   → identity + summary + applicable notes (read-only)

import { useState, useMemo } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useApp, useMyCompany } from '../context/AppContext';
import { isCompanyLeadership, isPlatoonLeadership, canEditMission } from '../utils/permissions';
import { buildMissionSummary } from '../utils/missionSummary';
import { materializeWeek, type MaterializedSlot } from '../utils/materialize';
import { MISSION_ARCHETYPES } from '../utils/missionArchetypes';
import { getArchetypeBehavior, type ImplStatus } from '../utils/archetypeBehavior';
import type { MissionArchetypeKind } from '../types';
import Header from '../components/Header';
import StaffingSheet from '../components/StaffingSheet';
import SlotOperationsSheet from '../components/SlotOperationsSheet';
import ChecklistRunSheet from '../components/ChecklistRunSheet';
import MissionImportSheet from '../components/MissionImportSheet';
import type { MissionNote, Platoon, UserRole, SelectorOutcomeRecord, Soldier } from '../types';
import {
  Section, PageMain, PageTitle, Body, Muted, Hint, Button, StatusPill,
} from '../components/ui';

export default function MissionDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const {
    currentUser, currentRole,
    missions, missionNotes, platoons, squads, soldiers, leaves, dutyExclusions,
    qualifications, equipmentItems, delegations,
    addMissionNote, editMissionNote, deleteMissionNote,
    setMissionStatus, updateMission, addMission,
    orders, platoonLeaveDays,
    assignments, setSlotAssignment,
    selectorOutcomes, recordSelectorOutcome,
    slotOperationalState,
    checklistTemplates, checklistRuns, createChecklistRun,
    addMissionTemplate,
  } = useApp();
  const [importOpen, setImportOpen] = useState(false);
  const [savedAsTemplate, setSavedAsTemplate] = useState(false);
  const myCompany = useMyCompany();

  // ── Hooks first; route gates after. ──────────────────────────────
  const mission = useMemo(() => missions.find((m) => m.id === id) ?? null, [missions, id]);

  // The viewer's platoon (for platoon-scope note authoring + filtering)
  const viewerPlatoon = useMemo(() => {
    if (!currentUser) return undefined;
    if (isPlatoonLeadership(currentRole) && currentUser.commandedPlatoonId) {
      return platoons.find((p) => p.id === currentUser.commandedPlatoonId);
    }
    return platoons.find((p) => p.id === currentUser.platoonId);
  }, [platoons, currentUser, currentRole]);

  const isCC = isCompanyLeadership(currentRole);
  const isPC = isPlatoonLeadership(currentRole);

  // Notes the viewer is allowed to see (when there IS a mission).
  const visibleNotes = useMemo(() => {
    if (!mission) return [] as MissionNote[];
    const all = missionNotes.filter((n) => n.missionId === mission.id);
    return all.filter((n) => {
      if (n.scope === 'company') return true;
      if (isCC) return true;
      return viewerPlatoon ? n.platoonId === viewerPlatoon.id : false;
    });
  }, [missionNotes, mission, isCC, viewerPlatoon]);

  const summaryLines = useMemo(
    () => mission
      ? buildMissionSummary({ mission, platoons, qualifications, equipmentItems })
      : [],
    [mission, platoons, qualifications, equipmentItems],
  );

  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const weekSlots = useMemo(() => mission ? materializeWeek({
    missions: [mission],
    platoons, squads, soldiers, leaves, dutyExclusions,
    startDay: todayStart, days: 7,
    assignments,
    slotOperationalState,
  }) : [], [mission, platoons, squads, soldiers, leaves, dutyExclusions, todayStart, assignments, slotOperationalState]);

  /** Candidate pool for StaffingSheet — soldiers from platoons assigned
   *  to this mission. Engine layer applies hard filters; we only need
   *  to scope by platoon membership here. */
  const candidatePool = useMemo(() => {
    if (!mission) return [];
    const platoonIds = new Set(mission.assignedPlatoonIds);
    const squadIds = new Set(
      squads.filter((sq) => platoonIds.has(sq.platoonId)).map((sq) => sq.id),
    );
    return soldiers.filter((s) => s.squadId && squadIds.has(s.squadId));
  }, [mission, squads, soldiers]);

  const [draftScope, setDraftScope] = useState<'company' | 'platoon'>(
    isCC ? 'company' : 'platoon'
  );
  const [draftText, setDraftText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  /** Slot currently open in the StaffingSheet (null = sheet closed). */
  const [staffingSlot, setStaffingSlot] = useState<MaterializedSlot | null>(null);
  /** Slot currently open in the SlotOperationsSheet — Mission Operations Layer. */
  const [opsSlot, setOpsSlot] = useState<MaterializedSlot | null>(null);
  /** Active checklist run sheet open for this mission. */
  const [activeChecklistRunId, setActiveChecklistRunId] = useState<string | null>(null);

  // ── Route gates AFTER all hooks have run. ────────────────────────
  if (!currentUser) return <Navigate to="/login" replace />;

  if (!mission) {
    return (
      <div className="min-h-screen bg-mil-bg" dir="rtl">
        <Header title="משימה" />
        <PageMain>
          <header>
            <PageTitle>משימה לא נמצאה</PageTitle>
          </header>
        </PageMain>
      </div>
    );
  }

  const canEdit = canEditMission(currentUser, mission, delegations);
  const companyNotes = visibleNotes.filter((n) => n.scope === 'company');
  const platoonNotes = visibleNotes.filter((n) => n.scope === 'platoon');
  const canAddPlatoonNote = isPC && !!viewerPlatoon;
  const canAddCompanyNote = isCC;

  const submitNew = () => {
    const text = draftText.trim();
    if (!text) return;
    addMissionNote({
      missionId: mission.id,
      scope:     draftScope,
      platoonId: draftScope === 'platoon' ? viewerPlatoon?.id : undefined,
      text,
    });
    setDraftText('');
  };

  const startEdit = (n: MissionNote) => {
    setEditingId(n.id);
    setEditText(n.text);
  };
  const saveEdit = () => {
    if (editingId && editText.trim()) {
      editMissionNote(editingId, editText.trim());
      setEditingId(null);
      setEditText('');
    }
  };

  const canEditNote = (n: MissionNote): boolean => {
    if (n.authorUserId === currentUser.id) return true;
    if (isCC) return true;                              // CC can edit/delete any
    return false;
  };

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="משימה" />
      <PageMain>

        {/* Identity hero — premium composition */}
        <section className="bg-mil-card border border-mil-border rounded-2xl-soft shadow-hero p-6">
          <button
            onClick={() => navigate(-1)}
            className="text-tiny font-semibold text-mil-muted hover:text-mil-text inline-flex items-center gap-1.5 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            חזרה
          </button>
          <div className="mt-3 flex items-baseline gap-3 flex-wrap">
            <h1 className="text-hero font-extrabold text-mil-text tracking-tightish leading-[1.1]">{mission.name}</h1>
            <MissionStatusPill status={mission.status} />
          </div>
          {mission.description && <Muted className="mt-2">{mission.description}</Muted>}
          <div className="mt-3 flex items-baseline gap-2 text-tiny text-mil-muted flex-wrap">
            <span className="font-medium">{myCompany?.name ?? '—'}</span>
            {mission.assignedPlatoonIds.length > 0 && (
              <>
                <span className="text-mil-ghost">·</span>
                <span>{mission.assignedPlatoonIds.map((pid) => platoons.find((p) => p.id === pid)?.name).filter(Boolean).join(' · ')}</span>
              </>
            )}
            {(mission.archetypeKind && mission.archetypeKind !== 'custom') && (
              <>
                <span className="text-mil-ghost">·</span>
                <span className="font-semibold text-mil-olive-dim">
                  {MISSION_ARCHETYPES[mission.archetypeKind as MissionArchetypeKind].icon}
                  {' '}
                  {MISSION_ARCHETYPES[mission.archetypeKind as MissionArchetypeKind].label}
                </span>
              </>
            )}
          </div>

          {/* Archetype-specific operational fields. Each archetype
              surfaces only what it declared support for in Step 1. */}
          {(mission.rallyPoint || mission.routeDescription || mission.responseInstructions) && (
            <div className="mt-4 pt-4 border-t border-mil-border space-y-2">
              {mission.rallyPoint && (
                <div className="flex items-baseline gap-2">
                  <Hint className="font-bold tracking-wide uppercase text-mil-muted shrink-0">נקודת ריכוז</Hint>
                  <Muted className="text-sm text-mil-text">{mission.rallyPoint}</Muted>
                </div>
              )}
              {mission.routeDescription && (
                <div className="flex items-baseline gap-2">
                  <Hint className="font-bold tracking-wide uppercase text-mil-muted shrink-0">מסלול / סקטור</Hint>
                  <Muted className="text-sm text-mil-text">{mission.routeDescription}</Muted>
                </div>
              )}
              {mission.responseInstructions && (
                <div className="mt-1">
                  <Hint className="font-bold tracking-wide uppercase text-mil-muted block mb-1">הוראות תגובה בעת אירוע</Hint>
                  <Muted className="text-sm text-mil-text leading-snug whitespace-pre-line">
                    {mission.responseInstructions}
                  </Muted>
                </div>
              )}
            </div>
          )}

          {canEdit && (
            <div className="mt-5 pt-5 border-t border-mil-border flex items-center justify-between gap-3 flex-wrap">
              <div>
                <Hint className="font-semibold tracking-wide uppercase text-mil-muted">עריכה מבצעית</Hint>
                <Muted className="text-tiny mt-1">שינויים יחולו מיד על השבצ״ק.</Muted>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="ghost"
                  size="md"
                  disabled={savedAsTemplate}
                  onClick={() => {
                    if (!myCompany || !currentUser) return;
                    addMissionTemplate({
                      companyId: myCompany.id,
                      name: mission.name,
                      description: mission.description,
                      category: archetypeToCategory(mission.archetypeKind ?? 'custom'),
                      isFavorite: false,
                      createdByUserId: currentUser.id,
                      forkedFromMissionId: mission.id,
                      payload: {
                        archetypeKind:      mission.archetypeKind ?? 'custom',
                        timeModel:          mission.timeModel,
                        manpower:           mission.manpower,
                        command:            mission.command,
                        rotation:           mission.rotation,
                        fatigue:            mission.fatigue,
                        cycleProfile:       mission.cycleProfile,
                        overlapPolicy:      mission.overlapPolicy,
                        qualifications:    mission.qualifications,
                        equipment:          mission.equipment,
                        logisticsAlerts:   mission.logisticsAlerts,
                        squadPolicy:        mission.squadPolicy,
                        pairings:           mission.pairings,
                        requiresDailyConfirmation: mission.requiresDailyConfirmation,
                        difficulty:         mission.difficulty,
                        fatigueOverride:    mission.fatigueOverride,
                        dayNightProfile:    mission.dayNightProfile,
                        allowPCOverride:    mission.allowPCOverride,
                        shiftDurationLocked: mission.shiftDurationLocked,
                        rallyPoint:         mission.rallyPoint,
                        routeDescription:   mission.routeDescription,
                        hasVehicle:         mission.hasVehicle,
                        responseInstructions: mission.responseInstructions,
                        responseTeams:      mission.responseTeams,
                      },
                    });
                    setSavedAsTemplate(true);
                  }}
                >
                  {savedAsTemplate ? '✓ נשמרה כתבנית' : 'שמור כתבנית'}
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setImportOpen(true)}
                >
                  שכפל
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => navigate(`/missions/${mission.id}/assign`)}
                >
                  שיוך מחלקות
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => navigate(`/missions/new?missionId=${mission.id}`)}
                >
                  ערוך משימה
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Phase 7.3 — archetype warnings + honest implementation status.
            We surface BOTH so the operator knows what the engine is and
            isn't enforcing. The warnings tell them about misconfig
            (missing rally point, etc.). The status panel is the
            "what's actually wired" disclosure the user asked for. */}
        <ArchetypeStatusPanel mission={mission} canEdit={canEdit} />

        {/* Readiness response teams — visible whenever the mission has
            teams, editable by anyone who can edit the mission. The
            viewer's own team is highlighted ("הצוות שלך"). */}
        {mission.archetypeKind === 'readiness' && (
          <ResponseTeamsSection
            mission={mission}
            viewer={currentUser}
            squads={squads}
            soldiers={soldiers}
            canEdit={canEdit}
            onSave={(teams) => updateMission(mission.id, { responseTeams: teams })}
          />
        )}

        {/* Round 5 — staffing CTA when the mission has no staffing yet.
            This appears IMMEDIATELY below the hero, before any other
            section, because it's the most important next operational
            step for an unstaffed mission. */}
        {(mission.status === 'active-unstaffed' || mission.status === 'staffing-pending') && canEdit && (
          <Section label="איוש משימה">
            <div className="bg-mil-warn-bg border border-mil-warn-border rounded-xl-soft p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-mil-warn" aria-hidden />
                <p className="text-xxs font-semibold tracking-wide uppercase text-mil-warn">
                  {mission.status === 'staffing-pending' ? 'באיוש' : 'ללא איוש'}
                </p>
              </div>
              <Body className="font-semibold text-mil-text">
                המשימה הוגדרה אבל עדיין אין חיילים משובצים אליה.
              </Body>
              <Hint className="mt-1 text-mil-muted">
                {isCC
                  ? 'אפשר לאייש דרך הסידור או לבחור מחלקה אחראית ולעבור לאיוש פר־חייל.'
                  : 'פתח את הסידור כדי לאייש את המשימה.'}
              </Hint>
              <div className="mt-3 flex gap-2 flex-wrap">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate(`/schedule?missionId=${mission.id}`)}
                >
                  פתח סידור
                </Button>
                {isCC && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setMissionStatus(mission.id, 'active')}
                  >
                    סמן כפעילה
                  </Button>
                )}
              </div>
            </div>
          </Section>
        )}

        {/* CC-only status toggle — pause/activate/archive */}
        {isCC && (
          <Section label="מצב משימה">
            <div className="flex gap-1.5 flex-wrap">
              <StatusToggleBtn active={mission.status === 'active' || mission.status === 'staffed'}
                onClick={() => setMissionStatus(mission.id, 'active')}>פעילה</StatusToggleBtn>
              <StatusToggleBtn active={mission.status === 'paused'}
                onClick={() => setMissionStatus(mission.id, 'paused')}>מושהית</StatusToggleBtn>
              <StatusToggleBtn active={mission.status === 'draft'}
                onClick={() => setMissionStatus(mission.id, 'draft')}>טיוטה</StatusToggleBtn>
              <StatusToggleBtn active={mission.status === 'archived'}
                onClick={() => setMissionStatus(mission.id, 'archived')}>בארכיון</StatusToggleBtn>
            </div>
            <Hint className="block mt-2 text-mil-muted">
              משימה מושהית/בארכיון אינה מייצרת משמרות במנוע השיבוץ.
            </Hint>
          </Section>
        )}

        {/* Current rotation owner — shows today's responsible platoon */}
        {(mission.status === 'active' || mission.status === 'staffed' || mission.status === 'partially-staffed') && weekSlots.length > 0 && (() => {
          const todayIso = new Date().toISOString().slice(0, 10);
          const todaySlots = weekSlots.filter((s) => s.start.slice(0, 10) === todayIso);
          const owners = Array.from(new Set(todaySlots.map((s) => s.ownerPlatoonId).filter(Boolean)))
            .map((pid) => platoons.find((p) => p.id === pid)?.name)
            .filter(Boolean);
          if (owners.length === 0) return null;
          return (
            <Section label="אחריות היום">
              <div className="bg-mil-card border border-mil-border rounded-xl-soft shadow-card px-5 py-4 flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-mil-success flex-shrink-0 ring-4 ring-mil-card" aria-hidden />
                <Body className="font-semibold">{owners.join(' · ')}</Body>
                <Hint className="mr-auto tabular-nums font-semibold text-mil-text">{todaySlots.length} משמרות</Hint>
              </div>
            </Section>
          );
        })()}

        {/* Structured summary (operational prose) */}
        <Section label="הגדרה מבצעית">
          <div className="bg-mil-card border border-mil-border rounded-xl-soft shadow-card px-5 py-5 space-y-2.5">
            {summaryLines.slice(1).map((line, i) => (
              <Body key={i} className="leading-relaxed">{line}</Body>
            ))}
          </div>
        </Section>

        {/* Company-scope notes */}
        <Section label="הערות פלוגתיות">
          {companyNotes.length === 0 ? (
            <Muted className="text-tiny">אין הערות פלוגתיות</Muted>
          ) : (
            <div className="space-y-2">
              {companyNotes.map((n) => (
                <NoteCard
                  key={n.id}
                  note={n}
                  canEdit={canEditNote(n)}
                  isEditing={editingId === n.id}
                  editText={editText}
                  onStartEdit={() => startEdit(n)}
                  onCancelEdit={() => { setEditingId(null); setEditText(''); }}
                  onEditText={setEditText}
                  onSaveEdit={saveEdit}
                  onDelete={() => deleteMissionNote(n.id)}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Platoon-scope notes — visible to relevant viewer only */}
        {(platoonNotes.length > 0 || canAddPlatoonNote) && (
          <Section label={isCC ? 'הערות ביצוע (לפי מחלקה)' : `הערות ביצוע — ${viewerPlatoon?.name ?? 'המחלקה שלך'}`}>
            {platoonNotes.length === 0 ? (
              <Muted className="text-tiny">אין הערות ביצוע</Muted>
            ) : (
              <div className="space-y-2">
                {platoonNotes.map((n) => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    canEdit={canEditNote(n)}
                    isEditing={editingId === n.id}
                    editText={editText}
                    onStartEdit={() => startEdit(n)}
                    onCancelEdit={() => { setEditingId(null); setEditText(''); }}
                    onEditText={setEditText}
                    onSaveEdit={saveEdit}
                    onDelete={() => deleteMissionNote(n.id)}
                    platoonName={isCC ? platoons.find((p) => p.id === n.platoonId)?.name : undefined}
                  />
                ))}
              </div>
            )}
          </Section>
        )}

        {/* Add note */}
        {(canAddCompanyNote || canAddPlatoonNote) && (
          <Section label="הוסף הערה">
            <div className="bg-mil-card border border-mil-border rounded-2xl p-4 space-y-3">
              {canAddCompanyNote && canAddPlatoonNote && (
                <div className="flex gap-1.5">
                  <ScopeBtn active={draftScope === 'company'} onClick={() => setDraftScope('company')}>פלוגתית</ScopeBtn>
                  <ScopeBtn active={draftScope === 'platoon'} onClick={() => setDraftScope('platoon')}>{viewerPlatoon?.name ?? 'מחלקתי'}</ScopeBtn>
                </div>
              )}
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={3}
                placeholder="לדוגמה: לבדוק קשר לפני יציאה · יוסי אחראי · להחליף כל שעה"
                className="w-full bg-mil-bg border border-mil-border rounded-xl px-3 py-3 text-mil-text focus:outline-none focus:ring-2 focus:ring-mil-olive/30 focus:border-mil-olive placeholder:text-mil-ghost text-base resize-none"
              />
              <Button variant="primary" size="md" fullWidth onClick={submitNew} disabled={!draftText.trim()}>
                הוסף הערה
              </Button>
            </div>
          </Section>
        )}

        {/* Sustained-manpower hint (only for 24/7 missions with cycleProfile) */}
        {(() => {
          const withSustained = weekSlots.find((s) => s.sustainedManpower);
          if (!withSustained) return null;
          return (
            <Section label="סד״כ מינימלי לתחזוקת המשימה 24/7">
              <div className="bg-mil-card border border-mil-border rounded-2xl px-5 py-4">
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  <span className="text-3xl font-extrabold tabular-nums text-mil-text">
                    {withSustained.sustainedManpower}
                  </span>
                  <span className="text-sm font-semibold text-mil-text">חיילים ברוטציה</span>
                  {mission.cycleProfile && (
                    <Hint className="mr-auto text-mil-muted">
                      {mission.cycleProfile.guardMinutes}/{mission.cycleProfile.restMinutes} דק׳ קצב שמירה/מנוחה
                    </Hint>
                  )}
                </div>
                <Muted className="mt-2 text-tiny">
                  כדי לשמור על {withSustained.requiredCount} חיילים במקום ברצף, נדרשת רוטציה של {withSustained.sustainedManpower} חיילים.
                </Muted>
              </div>
            </Section>
          );
        })()}

        {/* This week's slots */}
        {/* Assignment audit — Phase 6.3.d. Shows the history of staffing
            decisions for this mission, newest first. Each row carries
            the engine's outcome at decision time + actor + timestamp. */}
        {(() => {
          const missionAudit = selectorOutcomes.filter((r) => r.missionId === mission.id);
          if (missionAudit.length === 0) return null;
          return (
            <Section label={`היסטוריית שיבוץ · ${missionAudit.length}`}>
              <AssignmentAuditList records={missionAudit} soldiers={soldiers} platoons={platoons} />
            </Section>
          );
        })()}

        {/* צל״ם — Phase 6.2.c. Start a readiness check for the soldiers
            assigned to this week's slots. Active runs are listed for
            quick resume. */}
        {(isCC || isPC) && weekSlots.length > 0 && (() => {
          const missionRuns = checklistRuns.filter((r) => r.missionId === mission.id);
          const activeRuns = missionRuns.filter((r) => r.status === 'open');
          const handleStart = () => {
            if (checklistTemplates.length === 0) return;
            const tpl = checklistTemplates[0];
            const soldierIds = Array.from(new Set(
              weekSlots.flatMap((s) => [
                ...s.assignedSoldierIds,
                ...(s.commanderSoldierId ? [s.commanderSoldierId] : []),
              ]),
            ));
            if (soldierIds.length === 0) return;
            const run = createChecklistRun({
              templateId: tpl.id,
              scope: { kind: 'soldiers', soldierIds },
              missionId: mission.id,
              notes: `${tpl.name} למשימה ${mission.name}`,
              soldierIds,
            });
            if (run) setActiveChecklistRunId(run.id);
          };
          return (
            <Section label={`צל״ם · ${activeRuns.length} פעיל`}>
              <div className="bg-mil-card border border-mil-border rounded-xl-soft p-4">
                {activeRuns.length === 0 ? (
                  <>
                    <Body className="font-semibold leading-tight">אין ריצת צל״ם פעילה</Body>
                    <Hint className="block mt-1 text-mil-muted leading-snug">
                      התחל בדיקת ציוד וקריטיות לחיילים המשובצים.
                    </Hint>
                  </>
                ) : (
                  <div className="space-y-2 mb-3">
                    {activeRuns.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setActiveChecklistRunId(r.id)}
                        className="w-full text-right px-3 py-2.5 rounded-md bg-mil-bg-alt border border-mil-border hover:border-mil-olive"
                      >
                        <Body className="font-semibold text-sm">
                          {checklistTemplates.find((t) => t.id === r.templateId)?.name ?? 'צל״ם'}
                        </Body>
                        <Hint className="text-mil-muted">
                          {r.notes || `התחיל ${formatRelative(r.createdAt)}`}
                        </Hint>
                      </button>
                    ))}
                  </div>
                )}
                <Button variant="primary" size="md" fullWidth onClick={handleStart}>
                  + התחל צל״ם חדש
                </Button>
              </div>
            </Section>
          );
        })()}

        {weekSlots.length > 0 && (
          <Section label="משמרות השבוע">
            <div className="bg-mil-card border border-mil-border rounded-2xl divide-y divide-mil-border overflow-hidden">
              {weekSlots.map((slot) => {
                const start = new Date(slot.start);
                const end   = new Date(slot.end);
                const platoon = platoons.find((p) => p.id === slot.ownerPlatoonId);
                const assignedCount = slot.assignedSoldierIds.length + (slot.commanderSoldierId ? 1 : 0);
                const understaffed = assignedCount < slot.requiredCount;
                // Mission Operations Layer — chips for any persisted state.
                const ops = slotOperationalState.find((s) => s.slotId === slot.id);
                const lockedCount = ops?.lockedSoldierIds?.length ?? 0;
                const activeExcuses = (ops?.excusedUntil ?? []).filter(
                  (e) => e.untilIso > new Date().toISOString(),
                ).length;
                const hasNote = !!ops?.operationalNotes;
                return (
                  <div key={slot.id} className="flex flex-col">
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => canEdit && setStaffingSlot(slot)}
                        disabled={!canEdit}
                        className="flex-1 text-right px-5 py-3 flex items-center gap-3 hover:bg-mil-card-hover transition-colors disabled:cursor-default disabled:hover:bg-transparent"
                      >
                        <Hint className="text-tiny font-mono tabular-nums w-24 flex-shrink-0">
                          {formatDate(start)} · {hhmm(start)}–{hhmm(end)}
                        </Hint>
                        <Body className="flex-1 truncate">{platoon?.name ?? '—'}</Body>
                        <Hint className={`tabular-nums ${understaffed ? 'text-mil-alert font-semibold' : ''}`}>
                          {assignedCount}/{slot.requiredCount}
                        </Hint>
                        {canEdit && (
                          <span className="text-mil-olive-dim text-tiny font-semibold flex-shrink-0">
                            איוש ←
                          </span>
                        )}
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setOpsSlot(slot); }}
                          className="px-3 py-3 hover:bg-mil-card-hover transition-colors border-r border-mil-border flex-shrink-0"
                          aria-label="ניהול תפעולי"
                          title="ניהול תפעולי"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-mil-muted">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {(lockedCount > 0 || activeExcuses > 0 || hasNote) && (
                      <div className="px-5 pb-2.5 flex items-baseline gap-1.5 flex-wrap">
                        {lockedCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-xxs font-semibold px-2 py-0.5 rounded-md bg-mil-olive-bg text-mil-olive border border-mil-olive/30">
                            🔒 {lockedCount} נעולים
                          </span>
                        )}
                        {activeExcuses > 0 && (
                          <span className="inline-flex items-center gap-1 text-xxs font-semibold px-2 py-0.5 rounded-md bg-mil-warn-bg text-mil-warn border border-mil-warn-border">
                            🚫 {activeExcuses} הוצאות
                          </span>
                        )}
                        {hasNote && (
                          <span className="inline-flex items-center gap-1 text-xxs font-semibold px-2 py-0.5 rounded-md bg-mil-info-bg text-mil-info border border-mil-info-border">
                            ✎ הערת תפעול
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        )}

      </PageMain>

      {importOpen && (
        <MissionImportSheet
          open
          onClose={() => setImportOpen(false)}
          sourceMissions={[mission]}
          targetOrder={mission.orderId ? orders.find((o) => o.id === mission.orderId) : undefined}
          qualifications={qualifications}
          equipmentItems={equipmentItems}
          platoons={platoons}
          platoonLeaveDays={platoonLeaveDays}
          soldiers={soldiers}
          assignments={assignments}
          onConfirm={(payloads) => {
            if (!myCompany || !currentUser) return;
            const created = payloads.map((p) =>
              addMission({
                ...p,
                companyId: myCompany.id,
                createdByUserId: currentUser.id,
              }),
            );
            setImportOpen(false);
            if (created[0]) navigate(`/missions/${created[0].id}/assign`);
          }}
        />
      )}

      {staffingSlot && (
        <StaffingSheet
          open
          onClose={() => setStaffingSlot(null)}
          slot={staffingSlot}
          candidatePool={candidatePool}
          onAssign={(soldierIds, outcome, forcedReason) => {
            // Phase 6.3.d — persist BOTH the assignment AND the audit
            // record. The SelectorOutcomeRecord captures alternatives,
            // violations, confidence, decayReasons at decision time —
            // immutable evidence of WHY this assignment was made.
            if (staffingSlot && mission) {
              setSlotAssignment(staffingSlot.id, soldierIds);
              recordSelectorOutcome({
                companyId: mission.companyId,
                slotId: staffingSlot.id,
                missionId: mission.id,
                outcome,
                finalSoldierIds: soldierIds,
                actorUserId: currentUser.id,
                actorRole: currentRole,
                ...(forcedReason ? {} : {}),
              });
              void forcedReason;
            }
            setStaffingSlot(null);
          }}
        />
      )}

      {opsSlot && (
        <SlotOperationsSheet
          open
          onClose={() => setOpsSlot(null)}
          slot={opsSlot}
          candidatePool={candidatePool}
        />
      )}

      {activeChecklistRunId && (() => {
        const run = checklistRuns.find((r) => r.id === activeChecklistRunId);
        return run ? (
          <ChecklistRunSheet
            open
            onClose={() => setActiveChecklistRunId(null)}
            run={run}
          />
        ) : null;
      })()}
    </div>
  );
}

// ─── Note card ────────────────────────────────────────────────────────────

function NoteCard({
  note, canEdit, isEditing, editText, onStartEdit, onCancelEdit, onEditText, onSaveEdit, onDelete, platoonName,
}: {
  note: MissionNote;
  canEdit: boolean;
  isEditing: boolean;
  editText: string;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onEditText: (s: string) => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  platoonName?: string;
}) {
  return (
    <div className="bg-mil-card border border-mil-border rounded-2xl px-5 py-4">
      {isEditing ? (
        <>
          <textarea
            value={editText}
            onChange={(e) => onEditText(e.target.value)}
            rows={3}
            className="w-full bg-mil-bg border border-mil-border rounded-xl px-3 py-2 text-mil-text focus:outline-none focus:ring-2 focus:ring-mil-olive/30 focus:border-mil-olive text-base resize-none"
            autoFocus
          />
          <div className="mt-2 flex gap-2">
            <Button variant="primary" size="sm" onClick={onSaveEdit}>שמור</Button>
            <Button variant="ghost"   size="sm" onClick={onCancelEdit}>בטל</Button>
          </div>
        </>
      ) : (
        <>
          <Body className="whitespace-pre-wrap leading-relaxed">{note.text}</Body>
          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
            <Hint className="text-mil-muted">
              {note.authorName} · {ROLE_HEBREW[note.authorRole] ?? note.authorRole}
            </Hint>
            {platoonName && <Hint className="text-mil-muted">· {platoonName}</Hint>}
            <Hint className="text-mil-ghost">· {formatRelative(note.createdAt)}</Hint>
            {note.updatedAt && <Hint className="text-mil-ghost">· נערך</Hint>}
            {canEdit && (
              <div className="mr-auto flex gap-2">
                <button onClick={onStartEdit} className="text-tiny font-bold text-mil-olive-dim hover:text-mil-olive">ערוך</button>
                <button
                  onClick={() => { if (window.confirm('למחוק הערה?')) onDelete(); }}
                  className="text-tiny font-bold text-mil-alert hover:text-mil-alert"
                >מחק</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Assignment audit ─────────────────────────────────────────────────────
//
// Renders a list of SelectorOutcomeRecord entries — one per staffing
// decision the operator confirmed. Each card is collapsed by default;
// tap expands to reveal alternatives + violations + decay reasons.

function AssignmentAuditList({
  records, soldiers, platoons,
}: {
  records: SelectorOutcomeRecord[];
  soldiers: Soldier[];
  platoons: Platoon[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const soldierName = (id: string) => soldiers.find((s) => s.id === id)?.name ?? id;
  void platoons; // reserved for slot-platoon labeling in a later slice

  return (
    <div className="space-y-2">
      {records.map((r) => {
        const expanded = expandedId === r.id;
        const finalNames = r.finalSoldierIds.map(soldierName).join(' · ');
        const ts = formatRelative(r.decidedAt);
        const conf = Math.round(r.outcome.confidence * 100);
        const confTone =
          conf >= 75 ? 'text-mil-success' :
          conf >= 50 ? 'text-mil-warn' :
          'text-mil-alert';
        return (
          <div key={r.id} className="bg-mil-card border border-mil-border rounded-xl-soft overflow-hidden">
            <button
              onClick={() => setExpandedId(expanded ? null : r.id)}
              className="w-full text-right px-4 py-3 hover:bg-mil-card-warm/40 transition-colors"
            >
              <div className="flex items-baseline gap-2 flex-wrap">
                <Hint className="font-mono tabular-nums text-mil-muted">{ts}</Hint>
                <Hint className="text-mil-muted">·</Hint>
                <Hint className="font-semibold">
                  {r.actorRole === 'companyCommander' ? 'מ״פ'
                    : r.actorRole === 'deputyCompanyCommander' ? 'סמ״פ'
                    : r.actorRole === 'platoonCommander' ? 'מ״מ'
                    : r.actorRole === 'platoonSergeant' ? 'סמל'
                    : 'חייל'}
                </Hint>
                <Hint className={`mr-auto font-semibold tabular-nums ${confTone}`}>
                  ביטחון {conf}%
                </Hint>
              </div>
              <Body className="text-sm mt-1 leading-snug font-medium">
                {finalNames || <span className="text-mil-warn">שובץ ריק</span>}
              </Body>
              <Hint className="block mt-0.5 text-mil-muted">
                {expanded ? 'הסתר פרטים' : 'הצג פרטים'} ←
              </Hint>
            </button>

            {expanded && (
              <div className="border-t border-mil-border bg-mil-bg-alt px-4 py-3 space-y-2.5">
                {/* Confidence decay reasons */}
                {r.outcome.decayReasons.length > 0 && (
                  <div>
                    <Hint className="font-semibold uppercase tracking-wide text-mil-muted">סיבות לירידת ביטחון</Hint>
                    <ul className="mt-1 space-y-0.5">
                      {r.outcome.decayReasons.map((reason, i) => (
                        <li key={i} className="text-tiny text-mil-muted leading-snug">↓ {reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Alternates considered */}
                {r.outcome.alternates.length > 0 && (
                  <div>
                    <Hint className="font-semibold uppercase tracking-wide text-mil-muted">חלופות שנשקלו</Hint>
                    <p className="text-tiny text-mil-muted mt-1 leading-snug">
                      {r.outcome.alternates.slice(0, 5).map((a) => soldierName(a.soldierId)).join(' · ')}
                      {r.outcome.alternates.length > 5 && ` · +${r.outcome.alternates.length - 5} נוספים`}
                    </p>
                  </div>
                )}

                {/* Violations on the picks */}
                {r.outcome.violations.length > 0 && (
                  <div>
                    <Hint className="font-semibold uppercase tracking-wide text-mil-alert">חריגות</Hint>
                    <ul className="mt-1 space-y-0.5">
                      {r.outcome.violations.map((v, i) => (
                        <li key={i} className="text-tiny text-mil-alert leading-snug">
                          {soldierName(v.soldierId)} — {v.explain}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Picks with forced reason */}
                {r.outcome.picked.filter((p) => p.forcedReason).length > 0 && (
                  <div>
                    <Hint className="font-semibold uppercase tracking-wide text-mil-warn">שיבוצים בכפייה</Hint>
                    <ul className="mt-1 space-y-0.5">
                      {r.outcome.picked.filter((p) => p.forcedReason).map((p) => (
                        <li key={p.soldierId} className="text-tiny text-mil-warn leading-snug">
                          {soldierName(p.soldierId)} — {p.forcedReason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function StatusToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-tiny font-semibold border transition-all duration-200 ease-out-soft ${
        active
          ? 'bg-mil-olive text-white border-mil-olive shadow-card'
          : 'bg-mil-card text-mil-muted border-mil-border hover:text-mil-text hover:border-mil-border-strong'
      }`}
    >
      {children}
    </button>
  );
}

function ScopeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold border transition-all duration-200 ease-out-soft ${
        active
          ? 'bg-mil-olive-bg text-mil-olive border-mil-olive/30'
          : 'bg-mil-card text-mil-muted border-mil-border hover:text-mil-text hover:border-mil-border-strong'
      }`}
    >
      {children}
    </button>
  );
}

function MissionStatusPill({ status }: { status: string }) {
  switch (status) {
    case 'active':   return <StatusPill status="ready">פעילה</StatusPill>;
    case 'draft':    return <Hint className="text-mil-ghost">טיוטה</Hint>;
    case 'paused':   return <StatusPill status="warning">מושהית</StatusPill>;
    case 'archived': return <Hint className="text-mil-ghost">בארכיון</Hint>;
    default:         return null;
  }
}

const ROLE_HEBREW: Partial<Record<UserRole, string>> = {
  companyCommander:       'מ״פ',
  deputyCompanyCommander: 'סמ״פ',
  platoonCommander:       'מ״מ',
  platoonSergeant:        'סמל',
  soldier:                'חייל',
  owner:                  'מ״פ',
  manager:                'מ״מ',
};

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function formatDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function formatRelative(iso: string): string {
  const then = Date.parse(iso);
  if (isNaN(then)) return '';
  const now = Date.now();
  const diffMin = Math.round((now - then) / 60000);
  if (diffMin < 1)   return 'הרגע';
  if (diffMin < 60)  return `לפני ${diffMin} דק׳`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24)    return `לפני ${hours} שעות`;
  return `לפני ${Math.floor(hours / 24)} ימים`;
}

// Keep Platoon type referenced for the platoonName lookup pattern.
void (null as unknown as Platoon);

function archetypeToCategory(kind: import('../types').MissionArchetypeKind): string {
  switch (kind) {
    case 'static-guard': return 'שמירות';
    case 'patrol':       return 'סיורים';
    case 'readiness':    return 'כוננויות';
    case 'one-time-op':  return 'משימות מבצעיות';
    default:             return 'אחר';
  }
}

// ─── Archetype status panel (Phase 7.3) ─────────────────────────────
//
// Two halves:
//   1. Warnings — misconfiguration the operator can fix (missing rally
//      point on a readiness mission, etc.). Visible to everyone.
//   2. Implementation status — honest map of which archetype behaviors
//      the engine ACTUALLY enforces vs. which are still data-only.
//      Visible only to commanders (who care about engine truth).
//
// The status panel exists because we explicitly promised the user we
// would NOT pretend a behavior is wired when it isn't.

function ArchetypeStatusPanel({
  mission, canEdit,
}: {
  mission: Parameters<typeof getArchetypeBehavior>[0];
  canEdit: boolean;
}) {
  const behavior = useMemo(() => getArchetypeBehavior(mission), [mission]);
  if (behavior.kind === 'custom' && behavior.warnings.length === 0) return null;
  return (
    <Section label="התנהגות לפי תבנית">
      <div className="space-y-2.5">
        {behavior.warnings.length > 0 && (
          <ul className="space-y-1.5">
            {behavior.warnings.map((w) => (
              <li
                key={w.code}
                className={`flex items-baseline gap-2 rounded-xl-soft px-3.5 py-2.5 border ${
                  w.severity === 'error'
                    ? 'bg-mil-alert-bg border-mil-alert text-mil-alert'
                    : w.severity === 'warn'
                      ? 'bg-mil-warn-bg border-mil-warn text-mil-warn'
                      : 'bg-mil-info-bg border-mil-info-border text-mil-info'
                }`}
              >
                <span className="text-tiny font-bold uppercase tracking-wide shrink-0">
                  {w.severity === 'error' ? 'חסר קריטי' : w.severity === 'warn' ? 'אזהרה' : 'מידע'}
                </span>
                <span className="text-sm font-semibold leading-snug">{w.message}</span>
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <div className="bg-mil-card border border-mil-border rounded-xl-soft px-4 py-3">
            <Hint className="font-bold tracking-wide uppercase block mb-2">מצב מימוש בפועל</Hint>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-tiny">
              <StatusRow label="פיצול יום/לילה"      v={behavior.implementationStatus.slotSplitting} />
              <StatusRow label="עייפות לפי תבנית"   v={behavior.implementationStatus.fatigueWeighting} />
              <StatusRow label="חפיפות"             v={behavior.implementationStatus.overlapEnforcement} />
              <StatusRow label="איוש מקבילי"        v={behavior.implementationStatus.parallelAllowance} />
              <StatusRow label="חשיפה לחייל"        v={behavior.implementationStatus.responseSurface} />
              <StatusRow label="אזהרות בזמן יצירה" v={behavior.implementationStatus.warningSurface} />
            </div>
            <Muted className="mt-2 text-tiny leading-snug">
              ״ממומש״ = המנוע אוכף את ההתנהגות. ״חלקי״ = ערכים זורמים, אין כלל ייעודי. ״ממתין״ = עוד לא מומש — אל תסמוך על כך.
            </Muted>
          </div>
        )}
      </div>
    </Section>
  );
}

function StatusRow({ label, v }: { label: string; v: ImplStatus }) {
  const tone =
    v === 'wired'   ? 'text-mil-success font-bold' :
    v === 'partial' ? 'text-mil-warn font-bold' :
    'text-mil-alert font-bold';
  const word =
    v === 'wired'   ? 'ממומש' :
    v === 'partial' ? 'חלקי' :
    'ממתין';
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-mil-muted">{label}</span>
      <span className={`tabular-nums ${tone}`}>{word}</span>
    </div>
  );
}

// ─── Response teams (readiness archetype) ───────────────────────────
//
// READ view: list every team with its name / rally / count / WHO /
// instructions. The viewer's own team gets a tinted highlight + the
// label "הצוות שלך" so a soldier opening the page sees the answer
// to "where do I go" immediately.
//
// EDIT view: a CC-only inline editor lets them add/remove/edit teams
// without leaving the page. Tiny — three modes: by-soldiers / by-
// squad / by-role. Per-team rally + instructions are optional and
// fall back to the mission-level values when blank.

import type { ReadinessResponseTeam } from '../types';

function ResponseTeamsSection({
  mission, viewer, squads, soldiers, canEdit, onSave,
}: {
  mission: import('../types').Mission;
  viewer: { id: string } | null;
  squads: import('../types').Squad[];
  soldiers: Soldier[];
  canEdit: boolean;
  onSave: (teams: ReadinessResponseTeam[]) => void;
}) {
  const teams = mission.responseTeams ?? [];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ReadinessResponseTeam[]>(teams);

  // Find the team the current viewer belongs to (if any). Membership
  // resolves in priority order: explicit soldierIds → squad → role.
  const viewerSoldier = soldiers.find((s) => s.id === viewer?.id);
  const viewerTeamId = teams.find((t) => {
    if (t.selectionMode === 'soldiers') return t.soldierIds?.includes(viewer?.id ?? '');
    if (t.selectionMode === 'squad')    return t.squadId && viewerSoldier?.squadId === t.squadId;
    if (t.selectionMode === 'role')
      return t.operationalRole
        && Array.isArray(viewerSoldier?.operationalRoles)
        && viewerSoldier!.operationalRoles.includes(t.operationalRole);
    return false;
  })?.id;

  if (teams.length === 0 && !canEdit) return null;

  return (
    <Section
      label="צוותי תגובה"
      action={canEdit ? (
        <button
          onClick={() => { setDraft(teams); setEditing(true); }}
          className="text-tiny font-bold text-mil-olive-dim hover:text-mil-olive"
        >
          {teams.length === 0 ? '+ הגדר צוותים' : 'ערוך'}
        </button>
      ) : undefined}
    >
      {teams.length === 0 ? (
        <Muted className="text-tiny">לא הוגדרו צוותי תגובה. בלי צוותים, כל החיילים מקבלים את הוראת התגובה של המשימה.</Muted>
      ) : (
        <div className="space-y-2">
          {teams.map((t) => (
            <TeamCard
              key={t.id}
              team={t}
              mission={mission}
              squads={squads}
              soldiers={soldiers}
              isYours={t.id === viewerTeamId}
            />
          ))}
        </div>
      )}
      {editing && (
        <ResponseTeamsEditor
          draft={draft}
          squads={squads}
          soldiers={soldiers}
          platoonIds={mission.assignedPlatoonIds}
          onClose={() => setEditing(false)}
          onSave={(t) => { onSave(t); setEditing(false); }}
        />
      )}
    </Section>
  );
}

function TeamCard({
  team, mission, squads, soldiers, isYours,
}: {
  team: ReadinessResponseTeam;
  mission: import('../types').Mission;
  squads: import('../types').Squad[];
  soldiers: Soldier[];
  isYours: boolean;
}) {
  const whoLabel = (() => {
    if (team.selectionMode === 'soldiers') {
      const names = (team.soldierIds ?? [])
        .map((id) => soldiers.find((s) => s.id === id)?.name)
        .filter(Boolean);
      return names.length > 0 ? names.join(' · ') : '—';
    }
    if (team.selectionMode === 'squad') {
      return squads.find((sq) => sq.id === team.squadId)?.name ?? '—';
    }
    if (team.selectionMode === 'role') {
      return team.operationalRole ?? '—';
    }
    return '—';
  })();
  const rally = team.rallyPoint || mission.rallyPoint || '—';
  const instructions = team.instructions || mission.responseInstructions || '';

  return (
    <div
      className={`rounded-2xl border px-4 py-3.5 ${
        isYours
          ? 'bg-mil-olive-bg/70 border-mil-olive ring-2 ring-mil-olive/30'
          : 'bg-mil-card border-mil-border'
      }`}
    >
      <div className="flex items-baseline gap-2 flex-wrap">
        <Body className="font-semibold">{team.name}</Body>
        {isYours && (
          <span className="text-xxs font-bold uppercase tracking-wide text-mil-olive bg-mil-card px-2 py-0.5 rounded-full">
            הצוות שלך
          </span>
        )}
        <Hint className="mr-auto tabular-nums">{team.targetCount} חיילים</Hint>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-tiny">
        <div>
          <Hint>נקודת ריכוז</Hint>
          <Body className="text-sm leading-tight">{rally}</Body>
        </div>
        <div>
          <Hint>{team.selectionMode === 'soldiers' ? 'חיילים' : team.selectionMode === 'squad' ? 'כיתה' : 'תפקיד'}</Hint>
          <Body className="text-sm leading-tight">{whoLabel}</Body>
        </div>
      </div>
      {instructions && (
        <Muted className="mt-2 text-tiny leading-snug whitespace-pre-line border-t border-mil-border pt-2">
          {instructions}
        </Muted>
      )}
    </div>
  );
}

function ResponseTeamsEditor({
  draft, squads, soldiers, platoonIds, onClose, onSave,
}: {
  draft: ReadinessResponseTeam[];
  squads: import('../types').Squad[];
  soldiers: Soldier[];
  platoonIds: string[];
  onClose: () => void;
  onSave: (t: ReadinessResponseTeam[]) => void;
}) {
  const [teams, setTeams] = useState<ReadinessResponseTeam[]>(draft);

  const platoonSquads = squads.filter((sq) => platoonIds.includes(sq.platoonId));
  const platoonSoldiers = soldiers.filter((s) =>
    s.squadId && platoonSquads.some((sq) => sq.id === s.squadId),
  );

  const addTeam = () => {
    setTeams((prev) => [...prev, {
      id: `team-${Date.now()}-${prev.length}`,
      name: `צוות ${String.fromCharCode(0x05D0 + prev.length)}`,  // א/ב/ג…
      targetCount: 2,
      selectionMode: 'squad',
      squadId: platoonSquads[0]?.id,
    }]);
  };

  const updateTeam = (id: string, patch: Partial<ReadinessResponseTeam>) => {
    setTeams((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
  };

  const removeTeam = (id: string) => {
    setTeams((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-mil-text/20 backdrop-blur-glass-strong"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)', paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
      role="dialog"
      aria-modal="true"
      dir="rtl"
    >
      <button onClick={onClose} className="absolute inset-0 cursor-default" aria-label="סגור" tabIndex={-1} />
      <div
        className="relative w-full max-w-xl bg-mil-card border border-mil-border rounded-t-2xl-soft sm:rounded-2xl-soft shadow-pop flex flex-col sm:mx-4 overflow-hidden"
        style={{ maxHeight: '100%' }}
      >
        <header className="sticky top-0 z-10 bg-mil-card/95 backdrop-blur-glass border-b border-mil-border px-5 py-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-mil-text leading-tight tracking-tightish">צוותי תגובה</h2>
            <p className="text-tiny text-mil-muted leading-snug mt-0.5">{teams.length} צוותים מוגדרים</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-mil-muted hover:text-mil-text hover:bg-mil-bg-alt" aria-label="סגור חלונית">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3 L11 11 M11 3 L3 11" />
            </svg>
          </button>
        </header>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {teams.map((t) => (
            <div key={t.id} className="bg-mil-bg-alt border border-mil-border rounded-xl-soft px-3.5 py-3 space-y-2">
              <div className="flex items-baseline gap-2">
                <input
                  value={t.name}
                  onChange={(e) => updateTeam(t.id, { name: e.target.value })}
                  className="flex-1 bg-mil-card border border-mil-border rounded-lg px-2.5 py-1.5 text-sm font-bold text-mil-text"
                />
                <button
                  onClick={() => removeTeam(t.id)}
                  className="text-tiny font-bold text-mil-alert hover:text-mil-text"
                >
                  הסר
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-tiny">
                  <Hint className="block mb-1">כמות</Hint>
                  <input
                    type="number"
                    min={1}
                    value={t.targetCount}
                    onChange={(e) => updateTeam(t.id, { targetCount: Math.max(1, Number(e.target.value)) })}
                    className="w-full bg-mil-card border border-mil-border rounded-lg px-2.5 py-1.5 text-sm tabular-nums"
                  />
                </label>
                <label className="text-tiny">
                  <Hint className="block mb-1">נקודת ריכוז</Hint>
                  <input
                    value={t.rallyPoint ?? ''}
                    onChange={(e) => updateTeam(t.id, { rallyPoint: e.target.value })}
                    placeholder="ברירת מחדל = של המשימה"
                    className="w-full bg-mil-card border border-mil-border rounded-lg px-2.5 py-1.5 text-sm"
                  />
                </label>
              </div>
              <div>
                <Hint className="block mb-1">חלוקה לפי</Hint>
                <div className="flex gap-1.5">
                  {(['squad', 'soldiers', 'role'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => updateTeam(t.id, { selectionMode: m })}
                      className={`px-2.5 py-1 rounded-lg text-tiny font-bold ${
                        t.selectionMode === m
                          ? 'bg-mil-olive text-white'
                          : 'bg-mil-card border border-mil-border text-mil-muted'
                      }`}
                    >
                      {m === 'squad' ? 'כיתה' : m === 'soldiers' ? 'חיילים' : 'תפקיד'}
                    </button>
                  ))}
                </div>
              </div>
              {t.selectionMode === 'squad' && (
                <select
                  value={t.squadId ?? ''}
                  onChange={(e) => updateTeam(t.id, { squadId: e.target.value })}
                  className="w-full bg-mil-card border border-mil-border rounded-lg px-2.5 py-1.5 text-sm"
                >
                  <option value="">— בחר כיתה —</option>
                  {platoonSquads.map((sq) => (
                    <option key={sq.id} value={sq.id}>{sq.name}</option>
                  ))}
                </select>
              )}
              {t.selectionMode === 'soldiers' && (
                <div className="flex flex-wrap gap-1">
                  {platoonSoldiers.map((s) => {
                    const on = (t.soldierIds ?? []).includes(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => updateTeam(t.id, {
                          soldierIds: on
                            ? (t.soldierIds ?? []).filter((x) => x !== s.id)
                            : [...(t.soldierIds ?? []), s.id],
                        })}
                        className={`px-2 py-1 rounded text-tiny font-semibold ${
                          on
                            ? 'bg-mil-olive text-white'
                            : 'bg-mil-card border border-mil-border text-mil-muted'
                        }`}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              )}
              {t.selectionMode === 'role' && (
                <input
                  value={t.operationalRole ?? ''}
                  onChange={(e) => updateTeam(t.id, { operationalRole: e.target.value as import('../types').OperationalRole })}
                  placeholder="לדוגמה: קלע / נגב / קשר"
                  className="w-full bg-mil-card border border-mil-border rounded-lg px-2.5 py-1.5 text-sm"
                />
              )}
              <textarea
                value={t.instructions ?? ''}
                onChange={(e) => updateTeam(t.id, { instructions: e.target.value })}
                placeholder="הוראות תגובה לצוות (ברירת מחדל = של המשימה)"
                rows={2}
                className="w-full bg-mil-card border border-mil-border rounded-lg px-2.5 py-1.5 text-sm resize-none"
              />
            </div>
          ))}
          <button
            onClick={addTeam}
            className="w-full py-2.5 rounded-xl-soft border border-dashed border-mil-border text-mil-muted hover:text-mil-text text-tiny font-bold"
          >
            + הוסף צוות
          </button>
        </div>
        <footer className="px-5 py-3 border-t border-mil-border flex gap-2">
          <Button variant="primary" size="md" fullWidth onClick={() => onSave(teams)}>שמור</Button>
          <Button variant="ghost" size="md" onClick={onClose}>ביטול</Button>
        </footer>
      </div>
    </div>
  );
}
