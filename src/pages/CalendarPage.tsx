// Calendar — day / week / month for every role.
//
// The single calendar surface shared by soldier / PC / CC. Visibility is
// done in utils/calendar.ts — every viewer gets the entries scoped to them
// (own personal + their platoon + their company). The three tabs are just
// different time windows over the same projection:
//
//   יום    — full agenda for the chosen day
//   שבוע   — 7 day blocks vertically stacked (default)
//   חודש   — 6×7 grid with state-indicator cells; tap a day to switch to יום
//
// Mission slots now come from utils/materialize.ts (mission policy →
// AssignmentSlots), so a mission created in the wizard immediately shows
// up on the calendar.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import { buildDayEntries, type CalendarViewer, type CalendarSources } from '../utils/calendar';
import { materializeWeek } from '../utils/materialize';
import type { CalendarEntry, CalendarEntryKind } from '../types';
import {
  Eyebrow, Section, PageMain, PageTitle, Body, Muted, Hint, Segment,
} from '../components/ui';

type Tab = 'day' | 'week' | 'month';

export default function CalendarPage() {
  const {
    currentUser, currentRole,
    calendarEvents, leaves, soldiers, platoons, squads,
    missions, dutyExclusions,
    announcements, escalationEvents, platoonLeaveCycles,
  } = useApp();

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const [tab, setTab] = useState<Tab>('week');
  const [viewedDay, setViewedDay] = useState<Date>(today);

  // Materialize a wide window covering the month grid edge cases.
  // 6 weeks × 7 days = 42, anchored at the month grid's start (a Sunday).
  const monthGridStart = useMemo(() => monthGridFirstDay(viewedDay), [viewedDay]);
  const materializedSlots = useMemo(() => materializeWeek({
    missions, platoons, squads, soldiers, leaves, dutyExclusions,
    startDay: monthGridStart,
    days: 42,
  }), [missions, platoons, squads, soldiers, leaves, dutyExclusions, monthGridStart]);

  const viewer: CalendarViewer = {
    soldierProfileId:   currentUser?.soldierProfileId,
    platoonId:          currentUser?.platoonId,
    commandedPlatoonId: currentUser?.commandedPlatoonId,
    companyId:          currentUser?.companyId,
    role:               currentRole,
  };
  const sources: CalendarSources = {
    calendarEvents, leaves, soldiers, platoons, squads, materializedSlots,
    announcements, escalationEvents, leaveCycles: platoonLeaveCycles,
  };

  const pickDay = (d: Date) => { setViewedDay(d); setTab('day'); };

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="לוח" />
      <PageMain>

        {/* ── Tabs — segmented control ────────────────────────────── */}
        <Segment
          value={tab}
          onChange={setTab}
          fullWidth
          options={[
            { value: 'day',   label: 'יום' },
            { value: 'week',  label: 'שבוע' },
            { value: 'month', label: 'חודש' },
          ]}
        />

        {tab === 'day'   && <DayView day={viewedDay} viewer={viewer} sources={sources} today={today} />}
        {tab === 'week'  && <WeekView startDay={weekStart(viewedDay)} viewer={viewer} sources={sources} today={today} onPick={pickDay} />}
        {tab === 'month' && <MonthView anchor={viewedDay} viewer={viewer} sources={sources} today={today} onPick={pickDay} />}

      </PageMain>
    </div>
  );
}

// ─── Day view — full agenda for one day ───────────────────────────────────

function DayView({
  day, viewer, sources, today,
}: {
  day: Date; viewer: CalendarViewer; sources: CalendarSources; today: Date;
}) {
  const entries = useMemo(() => buildDayEntries({ day, viewer, sources }), [day, viewer, sources]);
  const allDay = entries.filter((e) => e.allDay);
  const timed  = entries.filter((e) => !e.allDay);
  const isToday = day.getTime() === today.getTime();

  return (
    <>
      <header>
        <Eyebrow>
          {isToday ? 'היום · ' : ''}{formatHebrewDayName(day)}
        </Eyebrow>
        <PageTitle className="mt-1">{formatHebrewDate(day)}</PageTitle>
      </header>

      {allDay.length > 0 && (
        <Section label="כל היום">
          <div className="flex flex-col gap-1.5">
            {allDay.map((e) => <AllDayRow key={e.id} entry={e} />)}
          </div>
        </Section>
      )}

      <Section label="מהלך היום">
        {timed.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm font-bold text-mil-olive-dim">היום פנוי</p>
            <p className="text-tiny text-mil-muted mt-1">אין אירועים מתוזמנים</p>
          </div>
        ) : (
          <div className="space-y-2">
            {timed.map((e) => <AgendaRow key={e.id} entry={e} />)}
          </div>
        )}
      </Section>
    </>
  );
}

// ─── Week view — 7 stacked day blocks ─────────────────────────────────────

function WeekView({
  startDay, viewer, sources, today, onPick,
}: {
  startDay: Date; viewer: CalendarViewer; sources: CalendarSources;
  today: Date; onPick: (d: Date) => void;
}) {
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startDay); d.setDate(d.getDate() + i); return d;
    });
  }, [startDay]);

  return (
    <div className="space-y-6">
      {days.map((d) => (
        <DayBlock
          key={d.toISOString()}
          day={d}
          isToday={d.getTime() === today.getTime()}
          entries={buildDayEntries({ day: d, viewer, sources })}
          onOpen={() => onPick(d)}
        />
      ))}
    </div>
  );
}

function DayBlock({
  day, isToday, entries, onOpen,
}: {
  day: Date; isToday: boolean; entries: CalendarEntry[]; onOpen: () => void;
}) {
  const allDay = entries.filter((e) => e.allDay);
  const timed  = entries.filter((e) => !e.allDay);
  const hasNothing = entries.length === 0;

  return (
    <section className={isToday ? 'border-r-2 border-mil-olive pr-4 -mr-1' : ''}>
      <button onClick={onOpen} className="w-full text-right flex items-baseline gap-2 mb-3 group">
        {isToday && (
          <span className="text-xxs font-bold text-white bg-mil-olive px-2 py-0.5 rounded-md shadow-card">היום</span>
        )}
        <Body className="font-semibold">{HE_DAYS[day.getDay()]}</Body>
        <Muted className="text-tiny">· {day.getDate()} ב{HE_MONTHS[day.getMonth()]}</Muted>
        <Hint className="mr-auto text-mil-ghost group-hover:text-mil-muted transition-colors">פתח ←</Hint>
      </button>

      {hasNothing ? (
        <Muted className="text-tiny">יום פנוי</Muted>
      ) : (
        <div className="space-y-1.5">
          {allDay.map((e) => <CompactRow key={e.id} entry={e} />)}
          {timed.map((e)  => <CompactRow key={e.id} entry={e} />)}
        </div>
      )}
    </section>
  );
}

// Compact entry row for week + month detail
function CompactRow({ entry }: { entry: CalendarEntry }) {
  const dot = ACCENT[entry.kind];
  const time = !entry.allDay ? `${formatTime(new Date(entry.start))}` : KIND_LABEL[entry.kind];
  return (
    <div className="flex items-baseline gap-2.5 py-1">
      <span className={`w-1.5 h-1.5 rounded-full ${dot} flex-shrink-0 self-center`} aria-hidden />
      <span className="text-tiny tabular-nums text-mil-text font-bold w-12 flex-shrink-0">
        {time}
      </span>
      <span className="text-sm text-mil-text truncate">{entry.title}</span>
      {entry.detail && <span className="text-tiny text-mil-muted truncate">· {entry.detail}</span>}
    </div>
  );
}

// ─── Month view — 6×7 grid ────────────────────────────────────────────────

function MonthView({
  anchor, viewer, sources, today, onPick,
}: {
  anchor: Date; viewer: CalendarViewer; sources: CalendarSources;
  today: Date; onPick: (d: Date) => void;
}) {
  const monthLabel = `${HE_MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
  const gridStart  = useMemo(() => monthGridFirstDay(anchor), [anchor]);
  const cells = useMemo(() => Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart); d.setDate(d.getDate() + i); return d;
  }), [gridStart]);

  // Per-day computed counts for the grid cells
  const dayInfo = useMemo(() => {
    const map = new Map<string, { state: 'base' | 'home' | 'mixed'; eventCount: number }>();
    for (const d of cells) {
      const entries = buildDayEntries({ day: d, viewer, sources });
      const hasLeave  = entries.some((e) => e.kind === 'leave-period');
      const hasMission = entries.some((e) => e.kind === 'guard-shift' || e.kind === 'mission');
      const eventCount = entries.filter((e) => !e.allDay).length;
      const state: 'base' | 'home' | 'mixed' =
        hasLeave && hasMission ? 'mixed' :
        hasLeave                ? 'home'  :
        'base';
      map.set(isoDate(d), { state, eventCount });
    }
    return map;
  }, [cells, viewer, sources]);

  return (
    <>
      <header>
        <Eyebrow>חודשי</Eyebrow>
        <PageTitle className="mt-1">{monthLabel}</PageTitle>
      </header>

      <div className="bg-mil-card border border-mil-border rounded-2xl-soft overflow-hidden shadow-card">
        {/* Header row with day-of-week labels */}
        <div className="grid grid-cols-7 bg-mil-bg-alt/70 border-b border-mil-border">
          {HE_DAYS_SHORT.map((d) => (
            <div key={d} className="px-1 py-3 text-center">
              <span className="text-xxs font-bold text-mil-ghost tracking-wider uppercase">{d}</span>
            </div>
          ))}
        </div>

        {/* 6 weeks */}
        <div className="grid grid-cols-7 divide-x divide-y divide-mil-border">
          {cells.map((d) => {
            const inMonth   = d.getMonth() === anchor.getMonth();
            const isToday   = d.getTime() === today.getTime();
            const info      = dayInfo.get(isoDate(d));
            const stateBg =
              !inMonth                 ? 'bg-mil-bg-alt/40' :
              info?.state === 'home'   ? 'bg-mil-sand-bg/60' :
              info?.state === 'mixed'  ? 'bg-mil-olive-bg/45' :
              'bg-transparent';
            const dotTone =
              info?.state === 'home'  ? 'bg-mil-sand' :
              info?.state === 'mixed' ? 'bg-mil-olive' :
              'bg-mil-olive';
            return (
              <button
                key={d.toISOString()}
                onClick={() => onPick(d)}
                className={`relative min-h-[68px] px-2 py-2.5 text-right transition-colors duration-200 ease-out-soft hover:bg-mil-card-hover ${stateBg}`}
              >
                <div className="flex items-baseline gap-1 justify-end">
                  {isToday ? (
                    <span className="w-7 h-7 rounded-full bg-mil-olive text-white text-sm tabular-nums font-bold flex items-center justify-center -mt-0.5 shadow-card">
                      {d.getDate()}
                    </span>
                  ) : (
                    <span className={`text-sm tabular-nums font-semibold ${
                      !inMonth ? 'text-mil-ghost' :
                      'text-mil-text'
                    }`}>
                      {d.getDate()}
                    </span>
                  )}
                </div>
                {info && info.eventCount > 0 && inMonth && (
                  <div className="mt-1.5 flex items-center gap-0.5 justify-end">
                    {[...Array(Math.min(3, info.eventCount))].map((_, i) => (
                      <span key={i} className={`w-1 h-1 rounded-full ${dotTone}`} aria-hidden />
                    ))}
                    {info.eventCount > 3 && <span className="text-[8px] text-mil-muted mr-0.5">+</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Hint className="text-center text-mil-muted">לחץ על יום לפתיחת תצוגה מפורטת</Hint>
    </>
  );
}

// ─── Agenda row + All-day row (used by Day view) ───────────────────────────

function AgendaRow({ entry }: { entry: CalendarEntry }) {
  const navigate = useNavigate();
  const accent = ACCENT[entry.kind];
  const label  = KIND_LABEL[entry.kind];
  const start  = new Date(entry.start);
  const end    = new Date(entry.end);
  const clickable = !!entry.missionId;

  const inner = (
    <div className="flex w-full">
      {/* Time column — left edge of the timeline */}
      <div className="w-16 flex-shrink-0 px-3 py-3 bg-mil-bg-alt/50 border-l border-mil-border flex flex-col items-center justify-center">
        <span className="text-sm font-bold tabular-nums text-mil-text leading-none">{formatTime(start)}</span>
        <span className="text-xxs tabular-nums text-mil-muted mt-1">{formatTime(end)}</span>
      </div>
      <div className="flex-1 px-4 py-3 flex items-start gap-2.5 min-w-0">
        <span className={`w-1 h-full self-stretch rounded-full ${accent} flex-shrink-0`} aria-hidden />
        <div className="flex-1 min-w-0">
          <span className="text-xxs font-semibold tracking-wide uppercase text-mil-muted">{label}</span>
          <Body className="font-semibold mt-0.5 leading-tight">{entry.title}</Body>
          {entry.detail && <Muted className="mt-1">{entry.detail}</Muted>}
        </div>
        {clickable && (
          <span className="text-mil-ghost text-tiny mt-0.5">←</span>
        )}
      </div>
    </div>
  );

  if (clickable) {
    return (
      <button
        onClick={() => navigate(`/mission/${entry.missionId}`)}
        className="w-full text-right bg-mil-card border border-mil-border rounded-xl-soft shadow-card flex overflow-hidden hover:border-mil-border-strong hover:shadow-card-hover transition-all duration-200 ease-out-soft"
      >
        {inner}
      </button>
    );
  }
  return (
    <div className="bg-mil-card border border-mil-border rounded-xl-soft shadow-card flex overflow-hidden">
      {inner}
    </div>
  );
}

function AllDayRow({ entry }: { entry: CalendarEntry }) {
  const dot = ACCENT[entry.kind];
  return (
    <div className="flex items-baseline gap-2.5 px-1">
      <span className={`w-1.5 h-1.5 rounded-full ${dot} flex-shrink-0 self-center`} aria-hidden />
      <span className="text-tiny text-mil-ghost tracking-wide flex-shrink-0">{KIND_LABEL[entry.kind]}</span>
      <Body className="font-semibold truncate">{entry.title}</Body>
      {entry.detail && <Hint className="truncate text-mil-muted">· {entry.detail}</Hint>}
    </div>
  );
}

// ─── Visual tokens per entry kind ─────────────────────────────────────────

const ACCENT: Record<CalendarEntryKind, string> = {
  'guard-shift':   'bg-mil-warn',
  'mission':       'bg-mil-warn',
  'leave-period':  'bg-mil-sand',
  'combat-block':  'bg-mil-olive',
  'platoon-time':  'bg-mil-olive',
  'locked-date':   'bg-mil-alert',
  'announcement':  'bg-mil-olive-dim',
  'birthday':      'bg-mil-olive-dim',
};

const KIND_LABEL: Record<CalendarEntryKind, string> = {
  'guard-shift':  'שמירה',
  'mission':      'משימה',
  'leave-period': 'חופשה',
  'combat-block': 'סדר יום',
  'platoon-time': 'זמן מחלקה',
  'locked-date':  'תאריך נעול',
  'announcement': 'הכרזה',
  'birthday':     'יום הולדת',
};

// ─── Date / time formatting ───────────────────────────────────────────────

const HE_DAYS       = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HE_DAYS_SHORT = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const HE_MONTHS     = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

function formatHebrewDayName(d: Date): string {
  return `יום ${HE_DAYS[d.getDay()]}`;
}
function formatHebrewDate(d: Date): string {
  return `${d.getDate()} ב${HE_MONTHS[d.getMonth()]}`;
}
function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Sunday-anchored week start (Israeli convention).
function weekStart(d: Date): Date {
  const out = new Date(d); out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - out.getDay());
  return out;
}

// First Sunday of the 6-week grid containing the given day's month.
function monthGridFirstDay(d: Date): Date {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  first.setHours(0, 0, 0, 0);
  first.setDate(first.getDate() - first.getDay());
  return first;
}
