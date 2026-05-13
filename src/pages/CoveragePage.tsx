// Leave/coverage preview — CC-facing.
//
// First visible surface for the leave/coverage spine. Read-only.
// Reads existing entities (currentStatus, Leaves, DutyExclusions,
// CoverageEvents, LeaveRotationPolicy floors) and projects them as
// a 5-second-comprehensible picture: who's out, who stays, who covers,
// where coverage may break.
//
// Slice L2. Does NOT generate plans (lands in L6), does NOT run the
// fairness evaluator (L7), does NOT edit anything.

import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp, useMyCompany } from '../context/AppContext';
import { isCompanyLeadership } from '../utils/permissions';
import Header from '../components/Header';
import {
  Section, PageMain, Body, Muted, Hint,
} from '../components/ui';
import {
  buildWeekPicture, computePreviewNotes,
  type DayPicture, type PreviewNote,
} from '../utils/coverage';
import type {
  Soldier, Platoon, Squad, CoverageEvent, AbsentScope, CoveringScope,
  CoverageEventReason, LeaveRotationPolicy,
} from '../types';

export default function CoveragePage() {
  const {
    currentRole,
    soldiers, leaves, platoons, squads,
    coverageEvents, dutyExclusions,
    leaveRotationPolicy, leaveRotationPlans,
  } = useApp();
  const myCompany = useMyCompany();

  if (!isCompanyLeadership(currentRole)) return <Navigate to="/home" replace />;

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const week = useMemo(
    () => buildWeekPicture(today, soldiers, leaves, dutyExclusions),
    [today, soldiers, leaves, dutyExclusions],
  );

  const notes = useMemo(
    () => computePreviewNotes(week, leaveRotationPolicy, leaveRotationPlans.length > 0),
    [week, leaveRotationPolicy, leaveRotationPlans.length],
  );

  // Coverage events in the visible 7-day window
  const weekEndMs = useMemo(() => {
    const d = new Date(today); d.setDate(d.getDate() + 7); return d.getTime();
  }, [today]);
  const upcomingCoverageEvents = useMemo(() =>
    coverageEvents
      .filter((ev) => {
        const startMs = Date.parse(ev.start);
        return startMs >= today.getTime() && startMs < weekEndMs;
      })
      .sort((a, b) => a.start.localeCompare(b.start)),
    [coverageEvents, today, weekEndMs],
  );

  const todayPicture = week[0];

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="יציאות וכיסוי" />
      <PageMain>

        {/* ── Hero — 5-second readout ──────────────────────────────────── */}
        <header>
          <div className="text-tiny text-mil-muted">{myCompany?.name ?? '—'}</div>
          <div className="mt-3 flex items-baseline gap-2.5 flex-wrap">
            <span className="text-[44px] leading-[0.9] font-extrabold tabular-nums text-mil-text tracking-tight">
              {todayPicture.onBase.length}
            </span>
            <span className="text-mil-ghost text-lg tabular-nums">
              / {todayPicture.totalSoldiers}
            </span>
            <span className="text-sm font-semibold text-mil-text mr-1">בבסיס היום</span>
            <div className="mr-auto flex items-baseline gap-3">
              {todayPicture.atHome.length > 0 && (
                <span className="text-tiny text-mil-muted">
                  <span className="tabular-nums font-bold text-mil-text">{todayPicture.atHome.length}</span> בבית
                </span>
              )}
              {todayPicture.excluded.length > 0 && (
                <span className="text-tiny text-mil-muted">
                  <span className="tabular-nums font-bold text-mil-text">{todayPicture.excluded.length}</span> מחוץ לספירה
                </span>
              )}
            </div>
          </div>
        </header>

        {/* ── Soft signals — info + warnings before the algorithm ──────── */}
        {notes.length > 0 && <NotesStack notes={notes} />}

        {/* ── Week strip — at-a-glance picture per day ─────────────────── */}
        <Section label="השבוע">
          <WeekStrip week={week} policy={leaveRotationPolicy} />
        </Section>

        {/* ── Today's breakdown by state ───────────────────────────────── */}
        <Section label="היום">
          <div className="space-y-2">
            <StateGroup
              label="בבסיס"
              tone="olive"
              soldiers={todayPicture.onBase}
            />
            {todayPicture.atHome.length > 0 && (
              <StateGroup
                label="בבית"
                tone="sand"
                soldiers={todayPicture.atHome}
              />
            )}
            {todayPicture.excluded.length > 0 && (
              <StateGroup
                label="מחוץ לספירה"
                tone="ghost"
                soldiers={todayPicture.excluded}
              />
            )}
          </div>
        </Section>

        {/* ── Coverage events (only if any in the visible window) ──────── */}
        {upcomingCoverageEvents.length > 0 && (
          <Section label="אירועי כיסוי">
            <div className="space-y-2">
              {upcomingCoverageEvents.map((ev) => (
                <CoverageEventCard
                  key={ev.id}
                  event={ev}
                  platoons={platoons}
                  squads={squads}
                  soldiers={soldiers}
                  today={today}
                />
              ))}
            </div>
          </Section>
        )}

      </PageMain>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function NotesStack({ notes }: { notes: PreviewNote[] }) {
  return (
    <div className="space-y-1.5">
      {notes.map((n) => {
        const tone =
          n.severity === 'critical' ? 'bg-mil-alert' :
          n.severity === 'warning'  ? 'bg-mil-warn'  :
          'bg-mil-olive-dim';
        const textTone =
          n.severity === 'critical' ? 'text-mil-alert' :
          n.severity === 'warning'  ? 'text-mil-warn'  :
          'text-mil-muted';
        return (
          <div key={n.id} className="flex items-baseline gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${tone} flex-shrink-0 self-center`} aria-hidden />
            <p className={`text-sm font-semibold ${textTone}`}>{n.message}</p>
          </div>
        );
      })}
    </div>
  );
}

const HE_DAY_SHORT = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

function WeekStrip({ week, policy }: { week: DayPicture[]; policy: LeaveRotationPolicy | null }) {
  const floor = policy?.minSoldiersOnBase ?? 0;
  return (
    <div className="bg-mil-card border border-mil-border rounded-2xl overflow-hidden">
      <div className="grid grid-cols-7 divide-x divide-mil-border">
        {week.map((day, i) => {
          const isToday    = i === 0;
          const below      = floor > 0 && day.onBase.length < floor;
          const at         = floor > 0 && day.onBase.length === floor;
          const numTone    =
            below ? 'text-mil-alert' :
            at    ? 'text-mil-warn'  :
            'text-mil-text';
          return (
            <div
              key={day.date.toISOString()}
              className={`px-1.5 py-3 text-center ${isToday ? 'bg-mil-olive-bg/30' : ''}`}
            >
              <span className="block text-tiny text-mil-ghost tracking-wide">
                {HE_DAY_SHORT[day.date.getDay()]}
              </span>
              <span className="block mt-1 text-sm font-semibold tabular-nums text-mil-text">
                {day.date.getDate()}
              </span>
              <span className={`block mt-2 text-base font-extrabold tabular-nums ${numTone}`}>
                {day.onBase.length}
              </span>
              <span className="block text-[10px] text-mil-ghost tabular-nums leading-tight">
                /{day.totalSoldiers}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StateGroup({
  label, tone, soldiers,
}: {
  label: string;
  tone: 'olive' | 'sand' | 'ghost';
  soldiers: Soldier[];
}) {
  if (soldiers.length === 0) return null;
  const dotColor =
    tone === 'olive' ? 'bg-mil-olive' :
    tone === 'sand'  ? 'bg-mil-sand'  :
    'bg-mil-ghost';
  return (
    <div className="bg-mil-card border border-mil-border rounded-2xl px-5 py-4">
      <div className="flex items-baseline gap-2 mb-2.5">
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor} flex-shrink-0 self-center`} aria-hidden />
        <Body className="font-semibold">{label}</Body>
        <Hint className="tabular-nums mr-auto">{soldiers.length}</Hint>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {soldiers.map((s) => (
          <span key={s.id} className="text-sm text-mil-text">{s.name}</span>
        ))}
      </div>
    </div>
  );
}

function CoverageEventCard({
  event, platoons, squads, soldiers, today,
}: {
  event:    CoverageEvent;
  platoons: Platoon[];
  squads:   Squad[];
  soldiers: Soldier[];
  today:    Date;
}) {
  const start = new Date(event.start);
  const end   = new Date(event.end);
  const timeLabel = `${formatTime(start)}–${formatTime(end)}`;
  const whenLabel = relativeDayLabel(start, today);
  const absentLabel   = describeAbsent(event.absent, platoons, squads, soldiers);
  const coveringLabel = describeCovering(event.covering, platoons, squads, soldiers);

  return (
    <div className="bg-mil-card border border-mil-border rounded-2xl px-5 py-4">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-tiny font-mono tabular-nums text-mil-text font-semibold">
          {whenLabel} · {timeLabel}
        </span>
        <Hint className="text-mil-ghost tracking-wide mr-auto">{reasonLabel(event.reason)}</Hint>
      </div>
      <Body className="font-semibold">{absentLabel} יוצא</Body>
      <Muted className="mt-1">{coveringLabel}</Muted>
      {event.notes && <Muted className="mt-1">{event.notes}</Muted>}
    </div>
  );
}

// ─── Label helpers ───────────────────────────────────────────────────────

function describeAbsent(
  scope: AbsentScope,
  platoons: Platoon[],
  squads: Squad[],
  soldiers: Soldier[],
): string {
  switch (scope.kind) {
    case 'platoon': return platoons.find((p) => p.id === scope.platoonId)?.name ?? 'מחלקה';
    case 'squad':   return squads.find((s) => s.id === scope.squadId)?.name ?? 'כיתה';
    case 'soldiers': {
      const names = scope.soldierIds
        .map((id) => soldiers.find((s) => s.id === id)?.name)
        .filter(Boolean) as string[];
      if (names.length <= 3) return names.join(' · ');
      return `${names.slice(0, 3).join(' · ')} · עוד ${names.length - 3}`;
    }
  }
}

function describeCovering(
  scope: CoveringScope,
  platoons: Platoon[],
  squads: Squad[],
  soldiers: Soldier[],
): string {
  switch (scope.kind) {
    case 'mission-already-covers':
      return 'המשימות הקיימות מכסות את ההיעדרות';
    case 'platoon':
      return `מכוסה על ידי ${platoons.find((p) => p.id === scope.platoonId)?.name ?? 'מחלקה'}`;
    case 'squad':
      return `מכוסה על ידי ${squads.find((s) => s.id === scope.squadId)?.name ?? 'כיתה'}`;
    case 'soldiers': {
      const names = scope.soldierIds
        .map((id) => soldiers.find((s) => s.id === id)?.name)
        .filter(Boolean) as string[];
      return `מכוסה על ידי ${names.join(' · ')}`;
    }
  }
}

function reasonLabel(reason: CoverageEventReason): string {
  switch (reason) {
    case 'company-event': return 'אירוע פלוגה';
    case 'rest-activity': return 'מנוחה';
    case 'training':      return 'אימון';
    case 'logistics':     return 'לוגיסטיקה';
    case 'other':         return 'אחר';
  }
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function relativeDayLabel(d: Date, today: Date): string {
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'היום';
  if (diff === 1) return 'מחר';
  if (diff < 7)   return `עוד ${diff} ימים`;
  return `${d.getDate()}/${d.getMonth() + 1}`;
}
