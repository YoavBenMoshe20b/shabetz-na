// Platoon weekly assignment view — the PC/PS שבצ"ק surface.
//
// Read-only first pass. Shows the upcoming week of materialized slots
// owned by the viewer's commanded platoon. Each day is a section listing
// that day's slots chronologically. Each slot row carries: time range ·
// mission · status · assigned soldier names (commander marked).
//
// Editing (re-assign, swap, drag) is a future slice. This page is the
// operational picture first; the editing affordances layer on top.

import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useEngineContext } from '../hooks/useEngineContext';
import { isPlatoonLeadership, isRasap } from '../utils/permissions';
import Header from '../components/Header';
import StaffingSheet from '../components/StaffingSheet';
import { materializeWeek, type MaterializedSlot } from '../utils/materialize';
import type { Soldier, MissionNote, SoldierBurden } from '../types';
import {
  Eyebrow, Section, PageMain, PageTitle, Body, Muted, Hint, StatusPill,
} from '../components/ui';

export default function PlatoonWeekPage() {
  const navigate = useNavigate();
  const {
    currentRole, currentUser,
    soldiers, leaves, platoons, squads, missions, dutyExclusions, missionNotes, assignments,
    setSlotAssignment, recordSelectorOutcome,
    slotOperationalState,
  } = useApp();
  const engineCtx = useEngineContext();

  // Hooks first; route gate after.
  const myPlatoon = useMemo(() =>
    platoons.find((p) => p.id === currentUser?.commandedPlatoonId)
    ?? platoons.find((p) => p.memberIds.includes(currentUser?.id ?? '')),
    [platoons, currentUser],
  );

  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  const materializedSlots = useMemo(() => materializeWeek({
    missions, platoons, squads, soldiers, leaves, dutyExclusions,
    startDay: todayStart, days: 7,
    assignments,
    slotOperationalState,
  }), [missions, platoons, squads, soldiers, leaves, dutyExclusions, todayStart, assignments, slotOperationalState]);

  const myPlatoonSlots = useMemo(() => myPlatoon
    ? materializedSlots.filter((s) => s.ownerPlatoonId === myPlatoon.id)
    : [],
    [materializedSlots, myPlatoon],
  );

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayStart); d.setDate(d.getDate() + i); return d;
  }), [todayStart]);

  const slotsByDay = useMemo(() => days.map((d) => {
    const dayIso = d.toISOString().slice(0, 10);
    const daySlots = myPlatoonSlots.filter((s) => s.start.slice(0, 10) === dayIso);
    return { date: d, slots: daySlots };
  }), [days, myPlatoonSlots]);

  // Period label — first day → last day
  const periodLabel = `${days[0].getDate()} – ${days[6].getDate()} ב${HE_MONTHS[days[6].getMonth()]}`;

  // Quick total for the hero
  const totalSlots = myPlatoonSlots.length;
  const understaffed = myPlatoonSlots.filter((s) => s.status === 'partially-staffed' || s.status === 'open').length;

  // Inline staffing: clicking "אייש" on a slot opens the StaffingSheet
  // without leaving this page. Candidate pool is the platoon's soldiers
  // (engine adds hard filters and scoring on top).
  const [staffingSlot, setStaffingSlot] = useState<MaterializedSlot | null>(null);
  const candidatePool = useMemo(() => {
    if (!myPlatoon) return [];
    const sqIds = new Set(squads.filter((sq) => sq.platoonId === myPlatoon.id).map((sq) => sq.id));
    return soldiers.filter((s) => s.squadId && sqIds.has(s.squadId));
  }, [myPlatoon, squads, soldiers]);

  // Route gate AFTER hooks. רס״פ also qualifies — page scopes to his
  // commandedPlatoonId (the logistics platoon) automatically.
  if (!isPlatoonLeadership(currentRole) && !(currentUser && isRasap(currentUser))) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="שבצ״ק מחלקה" />
      <PageMain>

        <header>
          <Eyebrow>{myPlatoon?.name ?? 'מחלקה'}</Eyebrow>
          <PageTitle className="mt-1">{periodLabel}</PageTitle>
          <div className="mt-3 flex items-baseline gap-3 text-tiny text-mil-muted">
            <span>
              <span className="tabular-nums font-bold text-mil-text">{totalSlots}</span> משמרות
            </span>
            {understaffed > 0 && (
              <span className="text-mil-warn font-semibold">
                <span className="tabular-nums">{understaffed}</span> חסרות איוש
              </span>
            )}
          </div>
        </header>

        {totalSlots === 0 ? (
          <Section label="השבוע">
            <div className="py-8 text-center">
              <p className="text-sm font-bold text-mil-olive-dim">השבוע פנוי</p>
              <p className="text-tiny text-mil-muted mt-1">אין משימות פעילות למחלקה</p>
            </div>
          </Section>
        ) : (
          <div className="space-y-5">
            {slotsByDay.map(({ date, slots }) => (
              <DaySection
                key={date.toISOString()}
                date={date}
                isToday={date.getTime() === todayStart.getTime()}
                slots={slots}
                soldiers={soldiers}
                burdens={engineCtx.burdens}
                missionNotes={missionNotes}
                myPlatoonId={myPlatoon?.id}
                onSlotClick={(slot) => navigate(`/mission/${slot.missionId}`)}
                onStaffClick={(slot) => setStaffingSlot(slot)}
              />
            ))}
          </div>
        )}

      </PageMain>

      {staffingSlot && (
        <StaffingSheet
          open
          onClose={() => setStaffingSlot(null)}
          slot={staffingSlot}
          candidatePool={candidatePool}
          onAssign={(soldierIds, outcome, forcedReason) => {
            const mission = missions.find((m) => m.id === staffingSlot.missionId);
            if (currentUser && mission) {
              setSlotAssignment(staffingSlot.id, soldierIds);
              recordSelectorOutcome({
                companyId: mission.companyId,
                slotId: staffingSlot.id,
                missionId: mission.id,
                outcome,
                finalSoldierIds: soldierIds,
                actorUserId: currentUser.id,
                actorRole: currentRole,
              });
              void forcedReason;
            }
            setStaffingSlot(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Day section ──────────────────────────────────────────────────────────

function DaySection({
  date, isToday, slots, soldiers, burdens, missionNotes, myPlatoonId, onSlotClick, onStaffClick,
}: {
  date: Date; isToday: boolean; slots: MaterializedSlot[]; soldiers: Soldier[];
  burdens: Record<string, SoldierBurden>;
  missionNotes: MissionNote[]; myPlatoonId?: string;
  onSlotClick: (slot: MaterializedSlot) => void;
  onStaffClick: (slot: MaterializedSlot) => void;
}) {
  const dayName = HE_DAYS[date.getDay()];
  const dateLabel = `${date.getDate()} ב${HE_MONTHS[date.getMonth()]}`;

  return (
    <section className={isToday ? 'border-r-2 border-mil-olive pr-3' : ''}>
      <div className="flex items-baseline gap-2 mb-2.5">
        {isToday && (
          <span className="text-tiny font-bold text-mil-olive-dim">היום</span>
        )}
        <Body className="font-semibold">{dayName}</Body>
        <Muted className="text-tiny">· {dateLabel}</Muted>
        <Hint className="mr-auto tabular-nums">{slots.length} משמרות</Hint>
      </div>

      {slots.length === 0 ? (
        <Muted className="text-tiny">יום פנוי</Muted>
      ) : (
        <div className="bg-mil-card border border-mil-border rounded-2xl divide-y divide-mil-border overflow-hidden">
          {slots.map((slot) => {
            // Notes relevant to this slot in this platoon context
            const slotNotes = missionNotes.filter((n) =>
              n.missionId === slot.missionId && (
                n.scope === 'company' || (n.scope === 'platoon' && n.platoonId === myPlatoonId)
              )
            );
            return (
              <SlotRow
                key={slot.id}
                slot={slot}
                soldiers={soldiers}
                burdens={burdens}
                notes={slotNotes}
                onClick={() => onSlotClick(slot)}
                onStaff={() => onStaffClick(slot)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

function SlotRow({
  slot, soldiers, burdens, notes, onClick, onStaff,
}: {
  slot: MaterializedSlot;
  soldiers: Soldier[];
  burdens: Record<string, SoldierBurden>;
  notes: MissionNote[];
  onClick: () => void;
  onStaff: () => void;
}) {
  const start = new Date(slot.start);
  const end   = new Date(slot.end);
  const timeRange = `${hhmm(start)}–${hhmm(end)}`;
  const assignedSoldiers = slot.assignedSoldierIds
    .map((id) => soldiers.find((s) => s.id === id))
    .filter(Boolean) as Soldier[];
  const commander = slot.commanderSoldierId
    ? soldiers.find((s) => s.id === slot.commanderSoldierId)
    : null;
  const assignedCount = assignedSoldiers.length + (commander ? 1 : 0);

  // Fatigue indicators — any assigned soldier with burden in upper p75
  // gets a yellow dot on their name.
  const isOverburdened = (id: string): boolean => {
    const b = burdens[id];
    return !!b && b.overShoot;
  };

  const understaffed = slot.status === 'partially-staffed' || slot.status === 'open';

  // Stripe color encodes intensity
  const stripe =
    slot.missionIntensity === 'ambush'         ? 'bg-mil-warn'  :
    slot.missionIntensity === 'active-patrol'  ? 'bg-mil-olive' :
    slot.missionIntensity === 'standing-guard' ? 'bg-mil-olive-dim' :
    slot.missionIntensity === 'readiness'      ? 'bg-mil-ghost' :
    'bg-mil-olive-dim';

  return (
    <div className="flex overflow-hidden hover:bg-mil-card-warm/40 transition-colors">
      <div className={`w-1 ${stripe} flex-shrink-0`} aria-hidden />
      <button
        type="button"
        onClick={onClick}
        className="flex-1 text-right px-4 py-3.5"
      >
        {/* First line: time range · mission name · status · staff CTA */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-tiny font-mono tabular-nums text-mil-text font-semibold">{timeRange}</span>
          <Body className="font-semibold flex-1 truncate">{slot.missionName}</Body>
          <StatusInline slot={slot} count={assignedCount} />
          {understaffed && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onStaff(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onStaff(); } }}
              className="text-tiny font-semibold text-mil-olive bg-mil-olive-bg px-2 py-0.5 rounded-md hover:bg-mil-olive-bg/80 cursor-pointer"
            >
              אייש
            </span>
          )}
        </div>

        {/* Second line: assigned names — with fatigue dots on over-burdened */}
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {commander && (
            <span className="text-tiny text-mil-text inline-flex items-center gap-1">
              {isOverburdened(commander.id) && (
                <span className="w-1.5 h-1.5 rounded-full bg-mil-warn" aria-label="עומס מעל הממוצע" />
              )}
              <span className="font-bold">{commander.name}</span>
              <span className="text-mil-olive-dim text-[10px] mr-1">מפקד</span>
            </span>
          )}
          {assignedSoldiers.length > 0 ? (
            <span className="text-tiny text-mil-muted inline-flex flex-wrap items-baseline gap-x-1.5">
              {assignedSoldiers.map((s, i) => (
                <span key={s.id} className="inline-flex items-center gap-1">
                  {isOverburdened(s.id) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-mil-warn" aria-label="עומס מעל הממוצע" />
                  )}
                  <span>{s.name}</span>
                  {i < assignedSoldiers.length - 1 && <span className="text-mil-ghost">·</span>}
                </span>
              ))}
            </span>
          ) : (
            !commander && <span className="text-tiny text-mil-warn font-semibold">לא מאוייש</span>
          )}
        </div>

        {/* Requirements summary line */}
        <Hint className="mt-1 block">
          {slot.requiredCount} חיילים נדרשים
          {slot.commanderRequired && ' · מפקד נדרש'}
          {slot.qualifications.length > 0 && ` · ${slot.qualifications.length} כישורים`}
        </Hint>

        {/* Notes preview — top 2 lines */}
        {notes.length > 0 && (
          <div className="mt-2 pt-2 border-t border-mil-border space-y-1">
            {notes.slice(0, 2).map((n) => (
              <div key={n.id} className="flex items-baseline gap-2">
                <span className={`w-1 h-1 rounded-full ${n.scope === 'company' ? 'bg-mil-olive-dim' : 'bg-mil-sand'} flex-shrink-0 self-center mt-0.5`} aria-hidden />
                <span className="text-tiny text-mil-muted line-clamp-1 leading-snug">{n.text}</span>
              </div>
            ))}
            {notes.length > 2 && (
              <Hint className="text-mil-olive-dim font-bold">+ {notes.length - 2} הערות</Hint>
            )}
          </div>
        )}

      </button>
    </div>
  );
}

function StatusInline({ slot, count }: { slot: MaterializedSlot; count: number }) {
  if (slot.status === 'fully-staffed') {
    return <StatusPill status="ready">מאוייש</StatusPill>;
  }
  if (slot.status === 'partially-staffed') {
    return <StatusPill status="warning">{count}/{slot.requiredCount}</StatusPill>;
  }
  if (slot.status === 'open') {
    return <StatusPill status="critical">פתוח</StatusPill>;
  }
  return <Hint className="text-mil-ghost">{slot.status}</Hint>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const HE_DAYS   = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
