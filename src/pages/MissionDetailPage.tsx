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
import { materializeWeek } from '../utils/materialize';
import Header from '../components/Header';
import type { MissionNote, Platoon, UserRole } from '../types';
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
    setMissionStatus,
  } = useApp();
  const myCompany = useMyCompany();

  if (!currentUser) return <Navigate to="/login" replace />;

  const mission = useMemo(() => missions.find((m) => m.id === id), [missions, id]);

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

  // The viewer's platoon (for platoon-scope note authoring + filtering)
  const viewerPlatoon = useMemo(() => {
    if (isPlatoonLeadership(currentRole) && currentUser.commandedPlatoonId) {
      return platoons.find((p) => p.id === currentUser.commandedPlatoonId);
    }
    return platoons.find((p) => p.id === currentUser.platoonId);
  }, [platoons, currentUser, currentRole]);

  const isCC = isCompanyLeadership(currentRole);
  const isPC = isPlatoonLeadership(currentRole);
  const canEdit = canEditMission(currentUser, mission, delegations);

  // Notes the viewer is allowed to see:
  //   • All company-scope notes for this mission
  //   • Platoon-scope notes whose platoonId === viewer's platoon (for CC: all)
  const visibleNotes = useMemo(() => {
    const all = missionNotes.filter((n) => n.missionId === mission.id);
    return all.filter((n) => {
      if (n.scope === 'company') return true;
      if (isCC) return true;                            // CC sees all platoon notes too
      return viewerPlatoon ? n.platoonId === viewerPlatoon.id : false;
    });
  }, [missionNotes, mission, isCC, viewerPlatoon]);

  const companyNotes = visibleNotes.filter((n) => n.scope === 'company');
  const platoonNotes = visibleNotes.filter((n) => n.scope === 'platoon');

  // Operational prose summary
  const summaryLines = useMemo(() => buildMissionSummary({
    mission,
    platoons,
    qualifications,
    equipmentItems,
  }), [mission, platoons, qualifications, equipmentItems]);

  // This week's materialized slots for this mission
  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const weekSlots = useMemo(() => materializeWeek({
    missions: [mission],
    platoons, squads, soldiers, leaves, dutyExclusions,
    startDay: todayStart, days: 7,
  }), [mission, platoons, squads, soldiers, leaves, dutyExclusions, todayStart]);

  // For PC: pre-fill new platoon note in their own platoon
  const canAddPlatoonNote = isPC && !!viewerPlatoon;
  const canAddCompanyNote = isCC;

  const [draftScope, setDraftScope] = useState<'company' | 'platoon'>(
    canAddCompanyNote ? 'company' : 'platoon'
  );
  const [draftText, setDraftText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

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
          </div>

          {canEdit && (
            <div className="mt-5 pt-5 border-t border-mil-border flex items-center justify-between gap-3 flex-wrap">
              <div>
                <Hint className="font-semibold tracking-wide uppercase text-mil-muted">עריכה מבצעית</Hint>
                <Muted className="text-tiny mt-1">שינויים יחולו מיד על השבצ״ק.</Muted>
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate(`/missions/new?missionId=${mission.id}`)}
              >
                ערוך משימה
              </Button>
            </div>
          )}
        </section>

        {/* CC-only status toggle — pause/activate/archive */}
        {isCC && (
          <Section label="מצב משימה">
            <div className="flex gap-1.5 flex-wrap">
              <StatusToggleBtn active={mission.status === 'active'}   onClick={() => setMissionStatus(mission.id, 'active')}>פעילה</StatusToggleBtn>
              <StatusToggleBtn active={mission.status === 'paused'}   onClick={() => setMissionStatus(mission.id, 'paused')}>מושהית</StatusToggleBtn>
              <StatusToggleBtn active={mission.status === 'draft'}    onClick={() => setMissionStatus(mission.id, 'draft')}>טיוטה</StatusToggleBtn>
              <StatusToggleBtn active={mission.status === 'archived'} onClick={() => setMissionStatus(mission.id, 'archived')}>בארכיון</StatusToggleBtn>
            </div>
            <Hint className="block mt-2 text-mil-muted">
              משימה מושהית/בארכיון אינה מייצרת משמרות במנוע השיבוץ.
            </Hint>
          </Section>
        )}

        {/* Current rotation owner — shows today's responsible platoon */}
        {mission.status === 'active' && weekSlots.length > 0 && (() => {
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
        {weekSlots.length > 0 && (
          <Section label="משמרות השבוע">
            <div className="bg-mil-card border border-mil-border rounded-2xl divide-y divide-mil-border overflow-hidden">
              {weekSlots.map((slot) => {
                const start = new Date(slot.start);
                const end   = new Date(slot.end);
                const platoon = platoons.find((p) => p.id === slot.ownerPlatoonId);
                const assignedCount = slot.assignedSoldierIds.length + (slot.commanderSoldierId ? 1 : 0);
                return (
                  <div key={slot.id} className="px-5 py-3 flex items-center gap-3">
                    <Hint className="text-tiny font-mono tabular-nums w-24 flex-shrink-0">
                      {formatDate(start)} · {hhmm(start)}–{hhmm(end)}
                    </Hint>
                    <Body className="flex-1 truncate">{platoon?.name ?? '—'}</Body>
                    <Hint className="tabular-nums">{assignedCount}/{slot.requiredCount}</Hint>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

      </PageMain>
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
