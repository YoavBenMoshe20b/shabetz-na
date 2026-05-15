// PlatoonMissionsPage — "משימות המחלקה שלי" for PC / PS / RasaP.
//
// The mission-centric counterpart to /platoon (which is the weekly grid
// view). Here the PC sees every mission the CC has targeted at THEIR
// platoon, with:
//   • New badge for missions created in the last 24h
//   • Status by slot (open / partial / fully-staffed)
//   • Assigned soldier list with hover-to-replace affordance via StaffingSheet
//   • Per-mission "אייש" CTA → opens StaffingSheet on the first slot needing help
//   • Top-of-page "פרסם שבצ״ק לחיילים" action when there are unpublished changes
//     (= latest assignment newer than the last published-schedule announcement)
//
// Routes: /platoon/missions

import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { isPlatoonLeadership, isRasap } from '../utils/permissions';
import Header from '../components/Header';
import StaffingSheet from '../components/StaffingSheet';
import { materializeWeek, type MaterializedSlot } from '../utils/materialize';
import type { Mission, Soldier, Platoon } from '../types';
import {
  Eyebrow, Section, PageMain, PageTitle, Body, Muted, Hint, Toast,
} from '../components/ui';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default function PlatoonMissionsPage() {
  const navigate = useNavigate();
  const {
    currentUser, currentRole,
    missions, platoons, squads, soldiers, leaves, dutyExclusions,
    assignments, setSlotAssignment, recordSelectorOutcome,
    announcements, addAnnouncement, selectorOutcomes,
    slotOperationalState,
  } = useApp();

  const myPlatoon = useMemo(
    () =>
      platoons.find((p) => p.id === currentUser?.commandedPlatoonId)
      ?? platoons.find((p) => p.memberIds.includes(currentUser?.id ?? '')),
    [platoons, currentUser],
  );

  const todayStart = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  // Materialize 14 days so the PC sees this week + next.
  const weekSlots = useMemo(() => materializeWeek({
    missions, platoons, squads, soldiers, leaves, dutyExclusions,
    startDay: todayStart, days: 14,
    assignments,
    slotOperationalState,
  }), [missions, platoons, squads, soldiers, leaves, dutyExclusions, todayStart, assignments, slotOperationalState]);

  // Missions assigned to the PC's platoon. Includes new and old.
  const platoonMissions = useMemo(() => {
    if (!myPlatoon) return [];
    return missions.filter((m) =>
      m.assignedPlatoonIds.includes(myPlatoon.id)
      && m.status !== 'archived'
      && m.status !== 'draft',
    );
  }, [missions, myPlatoon]);

  // Pair each mission with its materialized slots + counts.
  const missionsWithStats = useMemo(() => {
    if (!myPlatoon) return [];
    const nowMs = Date.now();
    return platoonMissions.map((m) => {
      const slots = weekSlots.filter((s) => s.missionId === m.id && s.ownerPlatoonId === myPlatoon.id);
      const total = slots.length;
      const fullyStaffed = slots.filter((s) => s.status === 'fully-staffed').length;
      const partial = slots.filter((s) => s.status === 'partially-staffed').length;
      const open = slots.filter((s) => s.status === 'open').length;
      const isNew = nowMs - Date.parse(m.createdAt) < ONE_DAY_MS;
      const firstNeedingHelp =
        slots.find((s) => s.status === 'open')
        ?? slots.find((s) => s.status === 'partially-staffed')
        ?? null;
      return { mission: m, slots, total, fullyStaffed, partial, open, isNew, firstNeedingHelp };
    });
  }, [platoonMissions, weekSlots, myPlatoon]);

  // "Dirty" = any selector-outcome record AFTER the latest publish
  // announcement for this platoon. Tracks the publish gesture without a
  // dedicated table — uses operational announcements with kind
  // 'operational' + title prefix as the marker.
  const PUBLISH_TITLE_PREFIX = 'שבצ״ק עודכן · ';
  const lastPublishAt = useMemo(() => {
    if (!myPlatoon) return null;
    const latest = announcements
      .filter((a) =>
        a.kind === 'operational'
        && a.title.startsWith(PUBLISH_TITLE_PREFIX)
        && a.audience.kind === 'platoons'
        && a.audience.platoonIds.includes(myPlatoon.id),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return latest?.createdAt ?? null;
  }, [announcements, myPlatoon]);

  const lastAssignmentChange = useMemo(() => {
    if (!myPlatoon) return null;
    // The selectorOutcomes audit is the canonical "I committed an
    // assignment" timestamp. Scope to this platoon's missions.
    const myMissionIds = new Set(platoonMissions.map((m) => m.id));
    const matched = selectorOutcomes
      .filter((r) => myMissionIds.has(r.missionId))
      .sort((a, b) => b.decidedAt.localeCompare(a.decidedAt))[0];
    return matched?.decidedAt ?? null;
  }, [selectorOutcomes, platoonMissions, myPlatoon]);

  const isDirty =
    lastAssignmentChange !== null
    && (lastPublishAt === null || lastAssignmentChange > lastPublishAt);

  const [staffingSlot, setStaffingSlot] = useState<MaterializedSlot | null>(null);
  const [toast, setToast] = useState<string>('');

  const candidatePool = useMemo(() => {
    if (!myPlatoon) return [];
    const sqIds = new Set(squads.filter((sq) => sq.platoonId === myPlatoon.id).map((sq) => sq.id));
    return soldiers.filter((s) => s.squadId && sqIds.has(s.squadId));
  }, [myPlatoon, squads, soldiers]);

  if (!currentUser) return <Navigate to="/login" replace />;
  if (!isPlatoonLeadership(currentRole) && !(currentUser && isRasap(currentUser))) {
    return <Navigate to="/home" replace />;
  }
  if (!myPlatoon) {
    return (
      <div className="min-h-screen bg-mil-bg" dir="rtl">
        <Header title="משימות המחלקה" />
        <PageMain>
          <PageTitle>אין מחלקה משויכת</PageTitle>
        </PageMain>
      </div>
    );
  }

  const newCount = missionsWithStats.filter((m) => m.isNew).length;
  const understaffedCount = missionsWithStats.filter((m) => m.open + m.partial > 0).length;

  const handlePublish = () => {
    const ann = addAnnouncement({
      companyId: myPlatoon.companyId,
      kind: 'operational',
      title: `${PUBLISH_TITLE_PREFIX}${myPlatoon.name}`,
      body: `${platoonMissions.length} משימות · ${missionsWithStats.reduce((acc, m) => acc + m.fullyStaffed, 0)} משבצות מאוישות`,
      audience: { kind: 'platoons', platoonIds: [myPlatoon.id] },
      showOnCalendar: false,
    });
    if (ann) {
      setToast('השבצ״ק פורסם · החיילים יראו עדכון בלו״ז');
      setTimeout(() => setToast(''), 4000);
    } else {
      setToast('שגיאה: אין הרשאת פרסום');
      setTimeout(() => setToast(''), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title={`משימות ${myPlatoon.name}`} />
      <PageMain>
        <header>
          <Eyebrow>{myPlatoon.unitName ?? ''}</Eyebrow>
          <PageTitle className="mt-1">המשימות שלי</PageTitle>
          <Muted className="mt-1 text-tiny leading-relaxed">
            {myPlatoon.name} · {candidatePool.length} חיילים · {platoonMissions.length} משימות פעילות
          </Muted>
        </header>

        {toast && <Toast tone="success">{toast}</Toast>}

        {/* Publish CTA — visible when there are unpublished assignment changes. */}
        {isDirty && (
          <section className="bg-mil-warn-bg border border-mil-warn-border rounded-xl-soft px-5 py-4">
            <div className="flex items-baseline gap-2 flex-wrap mb-2">
              <Hint className="font-bold uppercase tracking-wide text-mil-warn">שינויים שלא פורסמו</Hint>
            </div>
            <Body className="font-semibold text-sm leading-snug">
              ביצעת שינויי איוש מאז הפרסום האחרון. החיילים עדיין לא רואים את העדכון.
            </Body>
            <button
              onClick={handlePublish}
              className="mt-3 w-full bg-mil-olive hover:bg-mil-olive-light text-white px-5 py-3 rounded-xl-soft font-bold text-sm transition-colors"
            >
              פרסם שבצ״ק לחיילים ←
            </button>
          </section>
        )}

        {/* Inline summary chips */}
        <div className="flex items-baseline gap-2 flex-wrap">
          {newCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xxs font-bold px-2.5 py-1 rounded-md bg-mil-info-bg text-mil-info border border-mil-info-border">
              <span className="w-1.5 h-1.5 rounded-full bg-mil-info" />
              {newCount} חדשות
            </span>
          )}
          {understaffedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xxs font-bold px-2.5 py-1 rounded-md bg-mil-warn-bg text-mil-warn border border-mil-warn-border">
              <span className="w-1.5 h-1.5 rounded-full bg-mil-warn" />
              {understaffedCount} דורשות איוש
            </span>
          )}
          {!isDirty && lastPublishAt && (
            <Hint className="text-mil-muted">פורסם {formatRelative(lastPublishAt)}</Hint>
          )}
        </div>

        {/* Missions list */}
        {missionsWithStats.length === 0 ? (
          <Section label="ללא משימות">
            <div className="bg-mil-card border border-mil-border rounded-xl-soft px-5 py-6 text-center">
              <Body className="font-semibold">אין משימות פעילות למחלקה</Body>
              <Muted className="mt-1 text-tiny">כשמ״פ יוריד משימה למחלקה, היא תופיע כאן.</Muted>
            </div>
          </Section>
        ) : (
          <Section label={`רשימה · ${missionsWithStats.length}`}>
            <div className="space-y-3">
              {missionsWithStats.map((row) => (
                <MissionCard
                  key={row.mission.id}
                  row={row}
                  soldiers={soldiers}
                  platoon={myPlatoon}
                  onOpen={() => navigate(`/mission/${row.mission.id}`)}
                  onStaffSlot={(slot) => setStaffingSlot(slot)}
                  onOpenWeek={() => navigate('/platoon')}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Footer link to the weekly grid view */}
        <button
          onClick={() => navigate('/platoon')}
          className="w-full text-center text-tiny font-semibold text-mil-olive hover:text-mil-olive-dim py-2"
        >
          תצוגת שבצ״ק שבועית ←
        </button>
      </PageMain>

      {staffingSlot && (
        <StaffingSheet
          open
          onClose={() => setStaffingSlot(null)}
          slot={staffingSlot}
          candidatePool={candidatePool}
          onAssign={(soldierIds, outcome, forcedReason) => {
            const mission = missions.find((m) => m.id === staffingSlot.missionId);
            if (mission && currentUser) {
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

// ─── Mission card ────────────────────────────────────────────────────

interface MissionRow {
  mission: Mission;
  slots: MaterializedSlot[];
  total: number;
  fullyStaffed: number;
  partial: number;
  open: number;
  isNew: boolean;
  firstNeedingHelp: MaterializedSlot | null;
}

function MissionCard({
  row, soldiers, platoon, onOpen, onStaffSlot, onOpenWeek,
}: {
  row: MissionRow;
  soldiers: Soldier[];
  platoon: Platoon;
  onOpen: () => void;
  onStaffSlot: (slot: MaterializedSlot) => void;
  onOpenWeek: () => void;
}) {
  const { mission, total, fullyStaffed, partial, open, isNew, firstNeedingHelp } = row;
  const needsStaffing = open > 0 || partial > 0;
  const allStaffed = total > 0 && partial === 0 && open === 0;
  void platoon;

  // Surface up to 3 upcoming slots in this mission for context.
  const upcoming = useMemo(() => {
    return row.slots
      .filter((s) => Date.parse(s.start) > Date.now())
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, 3);
  }, [row.slots]);

  return (
    <article className={`bg-mil-card border rounded-xl-soft overflow-hidden shadow-card ${
      needsStaffing ? 'border-mil-warn-border' : 'border-mil-border'
    }`}>
      <header className="px-5 py-3.5 border-b border-mil-border flex items-baseline gap-2 flex-wrap">
        {isNew && (
          <span className="inline-flex items-center gap-1.5 text-xxs font-bold px-2 py-0.5 rounded-md bg-mil-info-bg text-mil-info border border-mil-info-border">
            <span className="w-1.5 h-1.5 rounded-full bg-mil-info" aria-hidden />
            חדשה
          </span>
        )}
        <Body className="font-bold leading-tight flex-1 min-w-0 truncate text-base">{mission.name}</Body>
        {allStaffed && (
          <span className="inline-flex items-center gap-1.5 text-xxs font-bold px-2 py-0.5 rounded-md bg-mil-success-bg text-mil-success border border-mil-success-border">
            הכל מאויש
          </span>
        )}
        {needsStaffing && (
          <span className={`inline-flex items-center gap-1.5 text-xxs font-bold px-2 py-0.5 rounded-md ${
            open > 0
              ? 'bg-mil-alert-bg text-mil-alert border border-mil-alert-border'
              : 'bg-mil-warn-bg text-mil-warn border border-mil-warn-border'
          }`}>
            {open > 0 ? 'דורש איוש' : 'חלקי'}
          </span>
        )}
      </header>

      <div className="px-5 py-3">
        {/* Mission description */}
        {mission.description && (
          <Muted className="text-tiny leading-snug">{mission.description}</Muted>
        )}

        {/* Slot counts */}
        <div className="mt-2 flex items-baseline gap-3 text-tiny tabular-nums">
          <span><span className="font-bold text-mil-text">{fullyStaffed}</span> <span className="text-mil-muted">מאויש</span></span>
          {partial > 0 && <span><span className="font-bold text-mil-warn">{partial}</span> <span className="text-mil-muted">חלקי</span></span>}
          {open > 0 && <span><span className="font-bold text-mil-alert">{open}</span> <span className="text-mil-muted">פתוח</span></span>}
          <span className="text-mil-ghost">·</span>
          <span className="text-mil-muted"><span className="tabular-nums">{total}</span> סה״כ</span>
        </div>

        {/* Upcoming slots preview */}
        {upcoming.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {upcoming.map((slot) => {
              const sD = new Date(slot.start);
              const eD = new Date(slot.end);
              const date = `${String(sD.getDate()).padStart(2, '0')}/${String(sD.getMonth() + 1).padStart(2, '0')}`;
              const time = `${String(sD.getHours()).padStart(2, '0')}:${String(sD.getMinutes()).padStart(2, '0')}–${String(eD.getHours()).padStart(2, '0')}:${String(eD.getMinutes()).padStart(2, '0')}`;
              const assignedNames = slot.assignedSoldierIds
                .concat(slot.commanderSoldierId ? [slot.commanderSoldierId] : [])
                .map((id) => soldiers.find((s) => s.id === id)?.name?.split(' ')[0])
                .filter(Boolean) as string[];
              const understaffed = slot.status === 'partially-staffed' || slot.status === 'open';
              const count = slot.assignedSoldierIds.length + (slot.commanderSoldierId ? 1 : 0);
              return (
                <div key={slot.id} className="flex items-baseline gap-2 text-tiny">
                  <span className="font-mono tabular-nums text-mil-muted">{date} · {time}</span>
                  <span className={`tabular-nums font-bold ${understaffed ? (slot.status === 'open' ? 'text-mil-alert' : 'text-mil-warn') : 'text-mil-success'}`}>
                    {count}/{slot.requiredCount}
                  </span>
                  {assignedNames.length > 0 && (
                    <span className="text-mil-text truncate">{assignedNames.slice(0, 3).join(' · ')}{assignedNames.length > 3 && ` +${assignedNames.length - 3}`}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action row */}
      <div className="grid grid-cols-2 gap-px bg-mil-border">
        <button
          onClick={onOpen}
          className="bg-mil-card hover:bg-mil-card-warm/40 px-4 py-2.5 text-tiny font-semibold text-mil-olive transition-colors"
        >
          ניהול משימה ←
        </button>
        {firstNeedingHelp ? (
          <button
            onClick={() => onStaffSlot(firstNeedingHelp)}
            className="bg-mil-olive hover:bg-mil-olive-light px-4 py-2.5 text-tiny font-bold text-white transition-colors"
          >
            אייש משבצת ←
          </button>
        ) : (
          <button
            onClick={onOpenWeek}
            className="bg-mil-card hover:bg-mil-card-warm/40 px-4 py-2.5 text-tiny font-semibold text-mil-muted transition-colors"
          >
            תצוגת שבוע ←
          </button>
        )}
      </div>
    </article>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const then = Date.parse(iso);
  if (isNaN(then)) return iso;
  const now = Date.now();
  const diffMin = Math.round((now - then) / 60000);
  if (diffMin < 1) return 'הרגע';
  if (diffMin < 60) return `לפני ${diffMin} דק׳`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  return `לפני ${Math.floor(hours / 24)} ימים`;
}
