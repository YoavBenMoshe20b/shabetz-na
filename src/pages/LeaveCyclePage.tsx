// LeaveCyclePage — CC/Deputy edits the platoon-leave rotation cycle.
//
// One concrete cycle per company per order. The page shows:
//   • A header with the cycle name + status (draft / published)
//   • A segments table grouped by platoon, sorted by startDate
//   • Floor-violation warnings underneath (when projected on-base drops
//     below minSoldiersOnBase the system surfaces the specific days)
//   • A segment composer sheet for add / edit
//
// Conflicts vs individual leaves are NOT errors — they're "exceptions"
// rendered as a small chip on the segment row. The cycle is the planned
// rhythm; individual leaves are explicit overrides on top.

import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp, useMyCompany, useMyPlatoons } from '../context/AppContext';
import { canEditLeaveCycle } from '../utils/permissions';
import { floorViolations } from '../utils/leaveCycleProjection';
import Header from '../components/Header';
import type {
  PlatoonLeaveCycleSegment, LeaveCycleSegmentKind,
  LeaveCycleSegmentScope, Soldier, Squad, Leave,
} from '../types';
import {
  Eyebrow, Section, PageMain, Body, Muted, Hint, Button, Sheet, Segment,
} from '../components/ui';

const SEGMENT_KIND_LABEL: Record<LeaveCycleSegmentKind, string> = {
  'home':         'בבית',
  'base-locked':  'בבסיס חובה',
};
const SEGMENT_KIND_TONE: Record<LeaveCycleSegmentKind, string> = {
  'home':        'text-mil-sand bg-mil-sand-bg border-mil-sand/30',
  'base-locked': 'text-mil-info bg-mil-info-bg border-mil-info-border',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function describeScope(
  scope: LeaveCycleSegmentScope,
  { platoons, squads, soldiers }: { platoons: ReturnType<typeof useMyPlatoons>; squads: Squad[]; soldiers: Soldier[] },
): string {
  switch (scope.kind) {
    case 'platoon': {
      const p = platoons.find((x) => x.id === scope.platoonId);
      return p?.name ?? 'מחלקה לא ידועה';
    }
    case 'squad': {
      const sq = squads.find((x) => x.id === scope.squadId);
      return sq ? `כיתה: ${sq.name}` : 'כיתה לא ידועה';
    }
    case 'soldiers': {
      const n = scope.soldierIds.length;
      if (n === 1) {
        const s = soldiers.find((x) => x.id === scope.soldierIds[0]);
        return s?.name ?? 'חייל לא ידוע';
      }
      return `${n} חיילים`;
    }
  }
}

export default function LeaveCyclePage() {
  const {
    currentUser, platoonLeaveCycles, platoons, squads, soldiers, leaves, leaveRotationPolicy,
    delegations,
    addPlatoonLeaveCycle, updatePlatoonLeaveCycle,
    addLeaveCycleSegment, updateLeaveCycleSegment, removeLeaveCycleSegment, publishLeaveCycle,
  } = useApp();
  const myCompany = useMyCompany();
  const myPlatoons = useMyPlatoons();

  // Hooks first — early returns after.
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<PlatoonLeaveCycleSegment | null>(null);

  // Most-recently-created active cycle for this company
  const activeCycle = useMemo(
    () => platoonLeaveCycles
      .filter((c) => c.companyId === myCompany?.id && c.status !== 'archived')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null,
    [platoonLeaveCycles, myCompany],
  );

  // Floor violations recompute on segment changes
  const violations = useMemo(() => {
    if (!activeCycle) return [];
    const floor = leaveRotationPolicy?.minSoldiersOnBase ?? myCompany?.settings?.minSoldiersOnBase ?? 0;
    if (floor === 0) return [];
    return floorViolations(activeCycle, floor, { soldiers, squads, leaves });
  }, [activeCycle, leaveRotationPolicy, myCompany, soldiers, squads, leaves]);

  // Segments grouped by month-of-start for visual rhythm
  const segmentsByDate = useMemo(() => {
    if (!activeCycle) return [];
    return [...activeCycle.segments].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [activeCycle]);

  if (!currentUser) return <Navigate to="/login" replace />;
  if (!canEditLeaveCycle(currentUser, delegations)) return <Navigate to="/home" replace />;

  const createCycle = () => {
    if (!myCompany) return;
    addPlatoonLeaveCycle({
      companyId: myCompany.id,
      name: `סבב יציאות — ${myCompany.name}`,
    });
  };

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="יציאות פלוגתיות" />
      <PageMain>

        <section className="bg-mil-card border border-mil-border rounded-2xl-soft shadow-hero p-6">
          <Eyebrow>{myCompany?.name ?? '—'}</Eyebrow>
          <h1 className="text-hero font-extrabold text-mil-text tracking-tightish mt-1.5">סבב יציאות פלוגתי</h1>
          <Muted className="mt-1.5">
            הסבב הכללי של הפלוגה — מי בבית, מתי, ומתי כולם חייבים נוכחות.
          </Muted>

          {!activeCycle && (
            <div className="mt-5">
              <Button variant="primary" size="md" onClick={createCycle}>
                + פתח סבב חדש
              </Button>
            </div>
          )}
        </section>

        {!activeCycle ? (
          <div className="bg-mil-card border border-mil-border rounded-xl-soft py-10 text-center">
            <p className="text-sm font-semibold text-mil-text">אין סבב פעיל</p>
            <p className="text-tiny text-mil-muted mt-1">צור סבב חדש כדי להתחיל לתכנן יציאות</p>
          </div>
        ) : (
          <>
            {/* Cycle header — name + status + publish */}
            <Section
              label="סבב פעיל"
              action={(
                <button
                  onClick={() => { setEditingSegment(null); setComposerOpen(true); }}
                  className="text-tiny font-semibold text-mil-olive hover:text-mil-olive-dim"
                >
                  + הוסף סגמנט
                </button>
              )}
            >
              <div className="bg-mil-card border border-mil-border rounded-xl-soft shadow-card p-4">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <Body className="font-semibold flex-1">{activeCycle.name}</Body>
                  <span className={`text-xxs font-semibold px-2 py-0.5 rounded-md border ${
                    activeCycle.status === 'published'
                      ? 'text-mil-success bg-mil-success-bg border-mil-success-border'
                      : 'text-mil-muted bg-mil-bg-alt border-mil-border'
                  }`}>
                    {activeCycle.status === 'published' ? 'פורסם' : 'טיוטה'}
                  </span>
                </div>
                <Hint className="mt-1 text-mil-muted">
                  <span className="tabular-nums font-semibold text-mil-text">{activeCycle.segments.length}</span> סגמנטים
                </Hint>

                {activeCycle.status !== 'published' && activeCycle.segments.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-mil-border">
                    <Button variant="primary" size="sm" onClick={() => publishLeaveCycle(activeCycle.id)}>
                      פרסם סבב
                    </Button>
                    <Hint className="block mt-1.5 text-mil-muted">
                      פרסום הופך את הסבב לגלוי לחיילים בעמוד הבית ובלוח השנה.
                    </Hint>
                  </div>
                )}

                {activeCycle.status === 'published' && (
                  <div className="mt-3 pt-3 border-t border-mil-border">
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() => updatePlatoonLeaveCycle(activeCycle.id, { status: 'draft' })}
                    >
                      החזר לטיוטה
                    </Button>
                  </div>
                )}
              </div>
            </Section>

            {/* Floor violations */}
            {violations.length > 0 && (
              <Section label="פגיעה בסד״כ">
                <div className="bg-mil-alert-bg border border-mil-alert-border rounded-xl-soft p-4">
                  <p className="text-sm font-semibold text-mil-alert mb-2">
                    {violations.length} ימים מתחת לסף המינימום
                  </p>
                  <div className="space-y-1.5">
                    {violations.slice(0, 6).map((v) => (
                      <div key={v.dayIso} className="text-tiny text-mil-text flex items-baseline gap-2 flex-wrap">
                        <span className="font-bold tabular-nums">{formatDate(v.dayIso)}</span>
                        <span className="text-mil-muted">
                          <span className="tabular-nums text-mil-alert font-semibold">{v.soldiersOnBaseProjected}</span>
                          /{v.totalSoldiers} בבסיס
                        </span>
                        <span className="text-mil-ghost">·</span>
                        <span className="text-mil-alert">חסר {v.shortfall}</span>
                      </div>
                    ))}
                    {violations.length > 6 && (
                      <Hint className="text-mil-alert mt-2">+ {violations.length - 6} ימים נוספים</Hint>
                    )}
                  </div>
                </div>
              </Section>
            )}

            {/* Segments list */}
            <Section label="סגמנטים">
              {segmentsByDate.length === 0 ? (
                <div className="bg-mil-card border border-mil-border rounded-xl-soft py-10 text-center">
                  <p className="text-sm font-semibold text-mil-text">אין סגמנטים</p>
                  <p className="text-tiny text-mil-muted mt-1">הוסף סגמנט ראשון כדי להגדיר את הסבב</p>
                </div>
              ) : (
                <div className="bg-mil-card border border-mil-border rounded-2xl shadow-card divide-y divide-mil-border overflow-hidden">
                  {segmentsByDate.map((seg) => (
                    <div key={seg.id} className="px-5 py-3.5">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className={`inline-flex items-center text-xxs font-semibold px-2 py-0.5 rounded-md border ${SEGMENT_KIND_TONE[seg.kind]}`}>
                          {SEGMENT_KIND_LABEL[seg.kind]}
                        </span>
                        <Body className="font-semibold flex-1 min-w-0">
                          {describeScope(seg.scope, { platoons, squads, soldiers })}
                        </Body>
                        <span className="text-tiny font-mono tabular-nums text-mil-muted">
                          {formatDate(seg.startDate)} – {formatDate(seg.endDate)}
                        </span>
                      </div>
                      {seg.note && <Muted className="mt-1.5 text-tiny">{seg.note}</Muted>}
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => { setEditingSegment(seg); setComposerOpen(true); }}
                          className="text-tiny font-semibold text-mil-olive hover:text-mil-olive-dim"
                        >
                          ערוך
                        </button>
                        <button
                          onClick={() => { if (window.confirm('למחוק סגמנט?')) removeLeaveCycleSegment(activeCycle.id, seg.id); }}
                          className="text-tiny font-semibold text-mil-alert hover:text-mil-alert/80 mr-auto"
                        >
                          מחק
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </>
        )}

      </PageMain>

      {composerOpen && activeCycle && (
        <LeaveCycleSegmentSheet
          open
          onClose={() => { setComposerOpen(false); setEditingSegment(null); }}
          editing={editingSegment}
          onSubmit={(seg) => {
            if (editingSegment) {
              updateLeaveCycleSegment(activeCycle.id, editingSegment.id, seg);
            } else {
              addLeaveCycleSegment(activeCycle.id, seg);
            }
            setComposerOpen(false);
            setEditingSegment(null);
          }}
          platoons={myPlatoons}
          squads={squads}
          soldiers={soldiers}
          leaves={leaves}
        />
      )}
    </div>
  );
}

// ─── Segment composer ──────────────────────────────────────────────────────

interface LeaveCycleSegmentSheetProps {
  open: boolean;
  onClose: () => void;
  editing: PlatoonLeaveCycleSegment | null;
  onSubmit: (seg: Omit<PlatoonLeaveCycleSegment, 'id'>) => void;
  platoons: ReturnType<typeof useMyPlatoons>;
  squads: Squad[];
  soldiers: Soldier[];
  leaves: Leave[];
}

function LeaveCycleSegmentSheet({
  open, onClose, editing, onSubmit, platoons, squads,
}: LeaveCycleSegmentSheetProps) {
  type ScopeKind = LeaveCycleSegmentScope['kind'];

  const [kind,      setKind]      = useState<LeaveCycleSegmentKind>(editing?.kind ?? 'home');
  const [scopeKind, setScopeKind] = useState<ScopeKind>(editing?.scope.kind ?? 'platoon');
  const [platoonId, setPlatoonId] = useState<string>(
    editing?.scope.kind === 'platoon' ? editing.scope.platoonId : (platoons[0]?.id ?? ''),
  );
  const [squadId,   setSquadId]   = useState<string>(
    editing?.scope.kind === 'squad' ? editing.scope.squadId : (squads[0]?.id ?? ''),
  );
  const [startDate, setStartDate] = useState<string>(editing?.startDate ?? new Date().toISOString().slice(0, 10));
  const [endDate,   setEndDate]   = useState<string>(editing?.endDate ?? new Date().toISOString().slice(0, 10));
  const [note,      setNote]      = useState<string>(editing?.note ?? '');

  const canSubmit = startDate && endDate && startDate <= endDate
    && (scopeKind === 'platoon' ? !!platoonId : scopeKind === 'squad' ? !!squadId : false);

  const handleSubmit = () => {
    if (!canSubmit) return;
    let scope: LeaveCycleSegmentScope;
    if (scopeKind === 'platoon')      scope = { kind: 'platoon', platoonId };
    else if (scopeKind === 'squad')   scope = { kind: 'squad',   squadId };
    else                              scope = { kind: 'soldiers', soldierIds: [] };
    onSubmit({ kind, scope, startDate, endDate, note: note.trim() || undefined });
  };

  const inputCls = 'w-full bg-mil-bg-alt border border-mil-border rounded-xl-soft px-3.5 py-2.5 text-mil-text focus:outline-none focus:border-mil-olive focus:shadow-focus placeholder:text-mil-ghost text-base transition-all duration-200 ease-out-soft';

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'עריכת סגמנט' : 'סגמנט חדש'}>
      <div className="px-5 py-5 space-y-4">

        <div>
          <Hint className="block mb-2 font-semibold">סוג</Hint>
          <Segment
            value={kind}
            onChange={setKind}
            fullWidth
            options={[
              { value: 'home',         label: 'בבית' },
              { value: 'base-locked',  label: 'בבסיס חובה' },
            ]}
          />
        </div>

        <div>
          <Hint className="block mb-2 font-semibold">תחולה</Hint>
          <Segment
            value={scopeKind}
            onChange={(v) => setScopeKind(v as ScopeKind)}
            fullWidth
            options={[
              { value: 'platoon', label: 'מחלקה' },
              { value: 'squad',   label: 'כיתה' },
            ]}
          />
        </div>

        {scopeKind === 'platoon' && (
          <div>
            <Hint className="block mb-1.5">בחר מחלקה</Hint>
            <select value={platoonId} onChange={(e) => setPlatoonId(e.target.value)} className={inputCls}>
              {platoons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        {scopeKind === 'squad' && (
          <div>
            <Hint className="block mb-1.5">בחר כיתה</Hint>
            <select value={squadId} onChange={(e) => setSquadId(e.target.value)} className={inputCls}>
              {squads.map((s) => {
                const p = platoons.find((px) => px.id === s.platoonId);
                return <option key={s.id} value={s.id}>{p?.name ? `${p.name} · ${s.name}` : s.name}</option>;
              })}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Hint className="block mb-1.5">מתאריך</Hint>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <Hint className="block mb-1.5">עד תאריך</Hint>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <Hint className="block mb-1.5">הערה</Hint>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="לדוגמה: מחלקה 1 בבית, מחלקה 2 מכסה"
            className={inputCls}
          />
        </div>

        <Button variant="primary" size="lg" fullWidth onClick={handleSubmit} disabled={!canSubmit}>
          {editing ? 'שמור שינויים' : 'הוסף סגמנט'}
        </Button>
      </div>
    </Sheet>
  );
}
