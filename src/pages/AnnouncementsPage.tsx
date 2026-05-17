// AnnouncementsPage — CC/Deputy creates + manages company announcements.
//
// Three kinds live in one CRUD surface:
//   • message     — short note; appears on home strip
//   • schedule    — schedule item; ALSO appears on the calendar
//   • operational — urgent guidance; appears prominently on home + calendar
//
// Soldiers / PCs reach this page via the home strip ("ראה את כל ההודעות").
// Read access is open; create/edit/delete gated by canCreateAnnouncement.
//
// Scale: list grows to maybe ~500 items per company per year. Filter-as-
// you-type covers usability up to thousands. Server-side this becomes a
// paginated list with a sticky-top "active" partition.

import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp, useMyCompany } from '../context/AppContext';
import { canCreateAnnouncement } from '../utils/permissions';
import { visibleAnnouncementsFor } from '../utils/announcementProjection';
import { describeAudience } from '../utils/audience';
import Header from '../components/Header';
import { AudiencePicker } from '../components/AudiencePicker';
import type { Announcement, AnnouncementKind, AnnouncementStatus, Audience } from '../types';
import {
  Eyebrow, Section, PageMain, Body, Muted, Hint, Button, Sheet, Segment,
} from '../components/ui';

const KIND_LABEL: Record<AnnouncementKind, string> = {
  message:     'הודעה',
  schedule:    'לו"ז',
  operational: 'מבצעי',
};

const KIND_TONE: Record<AnnouncementKind, { tag: string; dot: string }> = {
  message:     { tag: 'text-mil-info  bg-mil-info-bg  border-mil-info-border',  dot: 'bg-mil-info' },
  schedule:    { tag: 'text-mil-olive bg-mil-olive-bg border-mil-olive/30',     dot: 'bg-mil-olive' },
  operational: { tag: 'text-mil-alert bg-mil-alert-bg border-mil-alert-border', dot: 'bg-mil-alert' },
};

export default function AnnouncementsPage() {
  const {
    currentUser, currentRole, announcements,
    soldiers, platoons, squads, delegations,
    closeAnnouncement, deleteAnnouncement,
  } = useApp();
  const myCompany = useMyCompany();

  // Hooks always at top — early-return moved below so React Hook rules pass.
  const [filter, setFilter] = useState<AnnouncementStatus | 'all'>('active');
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);

  const canManage = !!currentUser && canCreateAnnouncement(currentUser, delegations);
  const isCommander = currentRole !== 'soldier';

  const visible = useMemo(() => {
    if (!currentUser) return [];
    const all = announcements.filter((a) => a.companyId === myCompany?.id);
    if (canManage) {
      return filter === 'all' ? all : all.filter((a) => a.status === filter);
    }
    return visibleAnnouncementsFor(all, {
      soldierProfileId: currentUser.soldierProfileId,
      isCommander,
    }, { soldiers, platoons, squads }, {
      statuses: filter === 'all' ? ['active', 'closed', 'archived'] : [filter],
    });
  }, [announcements, myCompany, filter, canManage, isCommander, currentUser, soldiers, platoons, squads]);

  if (!currentUser) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="הודעות פלוגתיות" />
      <PageMain>

        <section className="bg-mil-card border border-mil-border rounded-2xl-soft shadow-hero p-6">
          <Eyebrow>{myCompany?.name ?? '—'}</Eyebrow>
          <h1 className="text-hero font-extrabold text-mil-text tracking-tightish mt-1.5">הודעות פלוגתיות</h1>
          <Muted className="mt-1.5">
            הודעות מבצעיות, לו״ז פלוגתי וסידור — מנגנון רשמי מהפיקוד.
          </Muted>

          {canManage && (
            <div className="mt-5">
              <Button variant="primary" size="md" onClick={() => { setEditing(null); setComposerOpen(true); }}>
                + הודעה חדשה
              </Button>
            </div>
          )}
        </section>

        <Segment
          value={filter}
          onChange={setFilter}
          fullWidth
          options={[
            { value: 'active',   label: 'פעילות' },
            { value: 'closed',   label: 'סגורות' },
            { value: 'archived', label: 'בארכיון' },
            { value: 'all',      label: 'הכל' },
          ]}
        />

        {visible.length === 0 ? (
          <div className="bg-mil-card border border-mil-border rounded-xl-soft py-10 text-center">
            <p className="text-sm font-semibold text-mil-text">אין הודעות</p>
            <p className="text-tiny text-mil-muted mt-1">
              {canManage ? 'צור הודעה ראשונה' : 'הפלוגה שקטה כרגע'}
            </p>
          </div>
        ) : (
          <Section label={`${visible.length} הודעות`}>
            <div className="space-y-2.5">
              {visible.map((a) => (
                <AnnouncementCard
                  key={a.id}
                  announcement={a}
                  canManage={canManage}
                  audienceLabel={describeAudience(a.audience, { platoons, squads })}
                  onEdit={() => { setEditing(a); setComposerOpen(true); }}
                  onClose={() => closeAnnouncement(a.id)}
                  onDelete={() => { if (window.confirm('למחוק הודעה?')) deleteAnnouncement(a.id); }}
                />
              ))}
            </div>
          </Section>
        )}

      </PageMain>

      {composerOpen && (
        <AnnouncementSheet
          open
          onClose={() => { setComposerOpen(false); setEditing(null); }}
          editing={editing}
        />
      )}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────

function AnnouncementCard({
  announcement, canManage, audienceLabel, onEdit, onClose, onDelete,
}: {
  announcement: Announcement;
  canManage: boolean;
  audienceLabel: string;
  onEdit: () => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const a = announcement;
  const tone = KIND_TONE[a.kind];

  return (
    <div className="bg-mil-card border border-mil-border rounded-xl-soft shadow-card p-4">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 text-xxs font-semibold px-2 py-0.5 rounded-md border ${tone.tag}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} aria-hidden />
          {KIND_LABEL[a.kind]}
        </span>
        {a.pinned && <span className="text-xxs font-semibold text-mil-olive">⊕ נעוץ</span>}
        <Body className="font-semibold leading-tight flex-1 min-w-0 truncate">{a.title}</Body>
        {a.status !== 'active' && (
          <span className="text-xxs font-semibold text-mil-muted">
            {a.status === 'closed' ? 'סגור' : 'בארכיון'}
          </span>
        )}
      </div>

      {a.body && <Muted className="mt-2 leading-relaxed">{a.body}</Muted>}

      <div className="mt-3 flex items-baseline gap-1.5 flex-wrap text-tiny text-mil-muted">
        <span className="font-medium">{audienceLabel}</span>
        {(a.startDate || a.startTime) && (
          <>
            <span className="text-mil-ghost">·</span>
            <span className="tabular-nums">
              {a.startDate}
              {a.startTime && ` ${a.startTime}`}
              {a.endDate && a.endDate !== a.startDate && ` – ${a.endDate}`}
              {a.endTime && ` ${a.endTime}`}
            </span>
          </>
        )}
        {a.showOnCalendar && (
          <>
            <span className="text-mil-ghost">·</span>
            <span>בלו״ז השנה</span>
          </>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2 text-xxs text-mil-ghost">
        <span>נכתב ע״י {a.createdByName}</span>
      </div>

      {canManage && a.status === 'active' && (
        <div className="mt-3 pt-3 border-t border-mil-border flex flex-wrap gap-2">
          <button onClick={onEdit} className="text-tiny font-semibold text-mil-olive hover:text-mil-olive-dim">
            ערוך
          </button>
          <button onClick={onClose} className="text-tiny font-semibold text-mil-muted hover:text-mil-text">
            סגור
          </button>
          <button onClick={onDelete} className="text-tiny font-semibold text-mil-alert hover:text-mil-alert-bg mr-auto">
            מחק
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Composer Sheet ───────────────────────────────────────────────────────

function AnnouncementSheet({
  open, onClose, editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: Announcement | null;
}) {
  const { soldiers, platoons, squads, addAnnouncement, updateAnnouncement } = useApp();
  const myCompany = useMyCompany();

  const isEdit = !!editing;

  const [kind,       setKind]       = useState<AnnouncementKind>(editing?.kind ?? 'message');
  const [title,      setTitle]      = useState(editing?.title ?? '');
  const [body,       setBody]       = useState(editing?.body ?? '');
  const [startDate,  setStartDate]  = useState(editing?.startDate ?? new Date().toISOString().slice(0, 10));
  const [endDate,    setEndDate]    = useState(editing?.endDate ?? '');
  const [startTime,  setStartTime]  = useState(editing?.startTime ?? '');
  const [endTime,    setEndTime]    = useState(editing?.endTime ?? '');
  const [audience,   setAudience]   = useState<Audience>(editing?.audience ?? { kind: 'company' });
  const [showOnCalendar, setShowOnCalendar] = useState(editing?.showOnCalendar ?? false);
  const [pinned,     setPinned]     = useState(editing?.pinned ?? false);

  // Kind defaults — schedule and operational both default to calendar
  // visibility on first selection. Operator can still uncheck.
  const handleKind = (k: AnnouncementKind) => {
    setKind(k);
    if (!isEdit) {
      setShowOnCalendar(k !== 'message');
    }
  };

  const canSubmit = title.trim().length > 0;

  const submit = () => {
    if (!canSubmit || !myCompany) return;
    if (isEdit && editing) {
      updateAnnouncement(editing.id, {
        kind, title: title.trim(), body: body.trim() || undefined,
        startDate: startDate || undefined,
        endDate:   endDate   || undefined,
        startTime: startTime || undefined,
        endTime:   endTime   || undefined,
        audience, showOnCalendar, pinned,
      });
    } else {
      addAnnouncement({
        companyId: myCompany.id,
        kind, title: title.trim(), body: body.trim() || undefined,
        startDate: startDate || undefined,
        endDate:   endDate   || undefined,
        startTime: startTime || undefined,
        endTime:   endTime   || undefined,
        audience, showOnCalendar, pinned,
      });
    }
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={isEdit ? 'עריכת הודעה' : 'הודעה חדשה'} size="lg">
      <div className="px-5 py-5 space-y-5">

        {/* Kind */}
        <div>
          <Hint className="block mb-2 font-semibold">סוג הודעה</Hint>
          <Segment
            value={kind}
            onChange={handleKind}
            fullWidth
            options={[
              { value: 'message',     label: 'הודעה' },
              { value: 'schedule',    label: 'לו"ז' },
              { value: 'operational', label: 'מבצעי' },
            ]}
          />
        </div>

        {/* Title + body */}
        <div>
          <Hint className="block mb-1.5">כותרת</Hint>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="לדוגמה: בריפינג מ״מים שבועי"
            autoFocus
            className="w-full bg-mil-bg-alt border border-mil-border rounded-xl-soft px-3.5 py-2.5 text-mil-text focus:outline-none focus:border-mil-olive focus:shadow-focus placeholder:text-mil-ghost text-base transition-all duration-200 ease-out-soft"
          />
        </div>
        <div>
          <Hint className="block mb-1.5">תוכן</Hint>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="פירוט נוסף, מיקום, הוראות..."
            className="w-full bg-mil-bg-alt border border-mil-border rounded-xl-soft px-3.5 py-2.5 text-mil-text focus:outline-none focus:border-mil-olive focus:shadow-focus placeholder:text-mil-ghost text-base resize-none transition-all duration-200 ease-out-soft"
          />
        </div>

        {/* Dates + times */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Hint className="block mb-1.5">תאריך התחלה</Hint>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={modalInputCls} />
          </div>
          <div>
            <Hint className="block mb-1.5">תאריך סיום</Hint>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={modalInputCls} />
          </div>
          <div>
            <Hint className="block mb-1.5">שעת התחלה</Hint>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={modalInputCls} />
          </div>
          <div>
            <Hint className="block mb-1.5">שעת סיום</Hint>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={modalInputCls} />
          </div>
        </div>

        {/* Audience */}
        <div>
          <Hint className="block mb-2 font-semibold">קהל יעד</Hint>
          <AudiencePicker
            value={audience}
            onChange={setAudience}
            platoons={platoons}
            squads={squads}
            soldiers={soldiers}
          />
        </div>

        {/* Toggles */}
        <div className="space-y-2 bg-mil-bg-alt/60 border border-mil-border rounded-xl-soft p-3.5">
          <Toggle
            label="הצג בלו״ז השנה"
            hint="ההודעה תופיע גם בתצוגת היומן של כל מי שב-קהל היעד."
            value={showOnCalendar}
            onChange={setShowOnCalendar}
          />
          <Toggle
            label="הצמד למעלה"
            hint="ההודעה תקפוץ ראשונה ברצועת ההודעות בעמוד הבית."
            value={pinned}
            onChange={setPinned}
          />
        </div>

        <Button variant="primary" size="lg" fullWidth onClick={submit} disabled={!canSubmit}>
          {isEdit ? 'שמור שינויים' : 'פרסם הודעה'}
        </Button>
      </div>
    </Sheet>
  );
}

function Toggle({
  label, hint, value, onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="w-full text-right flex items-start gap-3 py-1.5 group"
    >
      <span className={`mt-0.5 w-9 h-5 rounded-full flex-shrink-0 transition-colors duration-200 ease-out-soft ${value ? 'bg-mil-olive' : 'bg-mil-border-strong'}`}>
        <span className={`block w-4 h-4 rounded-full bg-white shadow-card mt-0.5 transition-transform duration-200 ease-out-soft ${value ? 'translate-x-[-16px]' : 'translate-x-[-2px]'}`} />
      </span>
      <div className="flex-1 min-w-0">
        <Body className="font-semibold leading-tight text-sm">{label}</Body>
        {hint && <Hint className="block mt-0.5">{hint}</Hint>}
      </div>
    </button>
  );
}

const modalInputCls =
  'w-full bg-mil-bg-alt border border-mil-border rounded-xl-soft px-3.5 py-2.5 text-mil-text focus:outline-none focus:border-mil-olive focus:shadow-focus placeholder:text-mil-ghost text-base transition-all duration-200 ease-out-soft';
