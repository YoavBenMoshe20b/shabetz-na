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
import { isCompanyLeadership, isPlatoonLeadership } from '../utils/permissions';
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
    qualifications, equipmentItems,
    addMissionNote, editMissionNote, deleteMissionNote,
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

        {/* Identity hero */}
        <header>
          <button onClick={() => navigate(-1)} className="text-tiny font-bold text-mil-muted hover:text-mil-text">
            → חזרה
          </button>
          <div className="mt-2 flex items-baseline gap-3 flex-wrap">
            <PageTitle>{mission.name}</PageTitle>
            <MissionStatusPill status={mission.status} />
          </div>
          {mission.description && <Muted className="mt-1.5">{mission.description}</Muted>}
          <Hint className="mt-2 block tracking-wide">
            {myCompany?.name ?? '—'}
            {mission.assignedPlatoonIds.length > 0 && (
              <> · {mission.assignedPlatoonIds.map((pid) => platoons.find((p) => p.id === pid)?.name).filter(Boolean).join(' · ')}</>
            )}
          </Hint>
        </header>

        {/* Structured summary (operational prose) */}
        <Section label="הגדרה מבצעית">
          <div className="bg-mil-card border border-mil-border rounded-2xl px-5 py-4 space-y-2">
            {summaryLines.slice(1).map((line, i) => (        /* slice(1) drops the identity line */
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

function ScopeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
        active ? 'bg-mil-text text-mil-card' : 'bg-mil-card border border-mil-border text-mil-muted hover:border-mil-olive'
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
