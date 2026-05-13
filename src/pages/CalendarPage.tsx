// Calendar — Today view.
//
// Slice 1 of the calendar spine: read-only Today projection for the current
// viewer. No week view, no create/edit UI, no platoon-time fill flow yet.
//
// What the user sees:
//   • Day header — Hebrew day name + date
//   • All-day strip — birthdays, locked-dates, announcements
//   • Timed agenda — combat blocks, platoon-time slots, guard shifts,
//                    mission entries, leave-period markers
//
// Everyone gets the same screen layout. The projection layer (utils/calendar)
// applies viewer-scoped visibility — a soldier sees only their own personal
// entries plus their platoon's + company's; a PC sees their commanded
// platoon and any staffing-relevant personals; a CC sees the whole company.

import { useMemo } from 'react';
import { useApp, useActivePeriod } from '../context/AppContext';
import Header from '../components/Header';
import { buildDayEntries } from '../utils/calendar';
import type { CalendarEntry, CalendarEntryKind } from '../types';
import {
  Section, PageMain, PageTitle, Body, Muted, Hint,
} from '../components/ui';

export default function CalendarPage() {
  const {
    currentUser, currentRole,
    calendarEvents, leaves, soldiers, platoons, squads,
  } = useApp();
  const period = useActivePeriod();

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const entries = useMemo(() => buildDayEntries({
    day: today,
    viewer: {
      soldierProfileId:   currentUser?.soldierProfileId,
      platoonId:          currentUser?.platoonId,
      commandedPlatoonId: currentUser?.commandedPlatoonId,
      companyId:          currentUser?.companyId,
      role:               currentRole,
    },
    sources: { calendarEvents, leaves, soldiers, platoons, squads, period },
  }), [today, currentUser, currentRole, calendarEvents, leaves, soldiers, platoons, squads, period]);

  const allDay = entries.filter((e) => e.allDay);
  const timed  = entries.filter((e) => !e.allDay);

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="לוח" />
      <PageMain>

        {/* ── Day header — typographic, calm ────────────────────────────── */}
        <header>
          <Hint className="tracking-widest uppercase">{formatHebrewDayName(today)}</Hint>
          <PageTitle className="mt-1">{formatHebrewDate(today)}</PageTitle>
        </header>

        {/* ── All-day strip ───────────────────────────────────────────── */}
        {allDay.length > 0 && (
          <Section label="כל היום">
            <div className="flex flex-col gap-1.5">
              {allDay.map((e) => <AllDayRow key={e.id} entry={e} />)}
            </div>
          </Section>
        )}

        {/* ── Timed agenda ────────────────────────────────────────────── */}
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

      </PageMain>
    </div>
  );
}

// ─── Agenda row ───────────────────────────────────────────────────────────
// Reads as: severity stripe · time range · kind tag · title · detail.
// Same visual idiom as TimelineCard, but the time prefix is explicit (the
// calendar is about WHEN, not "how soon").

function AgendaRow({ entry }: { entry: CalendarEntry }) {
  const accent = ACCENT[entry.kind];
  const label  = KIND_LABEL[entry.kind];
  const start  = new Date(entry.start);
  const end    = new Date(entry.end);

  return (
    <div className="bg-mil-card border border-mil-border rounded-2xl flex overflow-hidden">
      <div className={`w-1 ${accent} flex-shrink-0`} aria-hidden />
      <div className="flex-1 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="text-tiny font-mono tabular-nums text-mil-text font-semibold">
            {formatTime(start)}–{formatTime(end)}
          </span>
          <span className="text-tiny text-mil-ghost tracking-wide">{label}</span>
        </div>
        <Body className="font-semibold mt-1">{entry.title}</Body>
        {entry.detail && <Muted className="mt-0.5">{entry.detail}</Muted>}
      </div>
    </div>
  );
}

// ─── All-day row ──────────────────────────────────────────────────────────
// Compact single-line treatment for birthdays / locked-dates / announcements.

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
// Olive = operational/baseline · Sand = home/away · Warn = staffing pressure
// Alert = restrictive (locked date) · Ghost = empty/pending.
// Calm by default; red only for hard restrictions.

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

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HE_MONTHS = [
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
