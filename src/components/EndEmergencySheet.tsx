// EndEmergencySheet — close an active escalation + minimal recovery
// capture.
//
// The user's spec called for a rich recovery flow: detect disrupted
// missions, identify soldiers who need rest, propose return-to-normal,
// re-publish a fresh schedule. The current slice ships a SMALLER scope
// and is honest about it:
//
// WIRED in this sheet
//   • Free-text closing reason
//   • Recovery notes the operator captures (which missions were
//     delayed, who needs rest) — stored on the closed EscalationEvent
//     via closeReason so the audit log carries it
//   • Optional follow-up announcement to the audience telling them
//     the event is over
//
// MOCK / NOT YET WIRED (clearly labelled in the sheet)
//   • No automatic mission rollback
//   • No automatic burden adjustment for soldiers who lost rest
//   • No automatic leave-board update
//   • No "publish a fresh שבצ״ק" action
//   These remain explicit operator actions on the existing surfaces.

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Sheet, Body, Hint, Muted, Button } from './ui';

interface Props {
  open: boolean;
  escalationId: string;
  onClose: () => void;
}

export default function EndEmergencySheet({ open, escalationId, onClose }: Props) {
  const {
    currentUser, escalationEvents, closeEscalation, addAnnouncement,
  } = useApp();

  const event = escalationEvents.find((e) => e.id === escalationId);
  const [closeReason, setCloseReason] = useState('');
  const [disruptedMissions, setDisruptedMissions] = useState('');
  const [needRest, setNeedRest] = useState('');
  const [returnToNormal, setReturnToNormal] = useState<'full' | 'partial' | 'new'>('full');
  const [publishUpdate, setPublishUpdate] = useState(true);

  if (!open || !event) return null;

  const submit = () => {
    const recoveryNotes = [
      closeReason.trim() && `סיבה: ${closeReason.trim()}`,
      disruptedMissions.trim() && `משימות שנפגעו: ${disruptedMissions.trim()}`,
      needRest.trim() && `דורש מנוחה: ${needRest.trim()}`,
      `החזרה: ${RETURN_LABEL[returnToNormal]}`,
    ].filter(Boolean).join(' · ');

    closeEscalation(event.id, recoveryNotes);

    if (publishUpdate && currentUser?.companyId) {
      addAnnouncement({
        companyId: currentUser.companyId,
        kind: 'operational',
        title: `✓ אירוע נסגר — ${event.reason}`,
        body: [
          closeReason.trim(),
          `חזרה: ${RETURN_LABEL[returnToNormal]}`,
        ].filter(Boolean).join(' · '),
        audience: event.audience,
        showOnCalendar: false,
      });
    }
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="סגירת אירוע"
      subtitle={event.reason}
      size="lg"
    >
      <div className="px-5 py-5 space-y-4">

        <Field label="סיבת סגירה">
          <input
            type="text"
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
            placeholder="האיום הוסר / האירוע הסתיים / שווא"
            className={inputCls}
            autoFocus
          />
        </Field>

        <Field label="אילו משימות נפגעו / זזו (אופציונלי)">
          <textarea
            value={disruptedMissions}
            onChange={(e) => setDisruptedMissions(e.target.value)}
            rows={2}
            placeholder="לדוגמה: סיור 04:00 לא בוצע, שמירת מגדל 7 הוחלפה ידנית"
            className={`${inputCls} resize-none`}
          />
        </Field>

        <Field label="חיילים שדורשים מנוחה (אופציונלי)">
          <textarea
            value={needRest}
            onChange={(e) => setNeedRest(e.target.value)}
            rows={2}
            placeholder="לדוגמה: צוות א — לפחות 6 שעות לפני המשמרת הבאה"
            className={`${inputCls} resize-none`}
          />
        </Field>

        <Field label="חזרה לשגרה">
          <div className="flex gap-1.5 flex-wrap">
            <Pick active={returnToNormal === 'full'}    onClick={() => setReturnToNormal('full')}>חזרה מלאה לסידור</Pick>
            <Pick active={returnToNormal === 'partial'} onClick={() => setReturnToNormal('partial')}>חזרה חלקית</Pick>
            <Pick active={returnToNormal === 'new'}     onClick={() => setReturnToNormal('new')}>סידור חדש</Pick>
          </div>
        </Field>

        <label className="flex items-baseline gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={publishUpdate}
            onChange={(e) => setPublishUpdate(e.target.checked)}
            className="w-4 h-4 accent-mil-olive"
          />
          <Body className="text-sm">פרסם הודעה לפלוגה שהאירוע נסגר</Body>
        </label>

        {/* HONEST disclosure of what the close action does NOT do. */}
        <div className="bg-mil-info-bg border border-mil-info-border rounded-xl-soft px-4 py-3">
          <Hint className="block uppercase tracking-wide font-bold text-mil-info mb-1.5">
            לתשומת לבך
          </Hint>
          <Muted className="text-tiny leading-snug">
            סגירת האירוע מתעדת את המידע למעלה ביומן + פרסום הודעה. <strong>החזרה לסידור הקודם, איוש מחדש, ועדכון יציאות פלוגתיות נעשים ידנית</strong> מהמסכים הרלוונטיים. הערות תיעוד אלה ישמשו לתחקיר אך אינן מבצעות שינויים אוטומטיים בשבצ״ק.
          </Muted>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="primary" size="lg" fullWidth onClick={submit}>
            ✓ סגור אירוע
          </Button>
          <Button variant="ghost" size="lg" onClick={onClose}>ביטול</Button>
        </div>
      </div>
    </Sheet>
  );
}

const RETURN_LABEL: Record<'full' | 'partial' | 'new', string> = {
  full:    'מלאה לסידור הקודם',
  partial: 'חלקית — לתעדכן בנפרד',
  new:     'בניית סידור חדש',
};

const inputCls =
  'w-full bg-mil-bg-alt border border-mil-border rounded-xl-soft px-3.5 py-2.5 text-mil-text focus:outline-none focus:ring-2 focus:ring-mil-olive/40 focus:border-mil-olive placeholder:text-mil-ghost text-base';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Hint className="block mb-1.5 tracking-wide">{label}</Hint>
      {children}
    </div>
  );
}

function Pick({ active, onClick, children }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl-soft text-tiny font-bold transition-colors ${
        active
          ? 'bg-mil-olive text-white'
          : 'bg-mil-card border border-mil-border text-mil-muted hover:border-mil-olive'
      }`}
    >
      {children}
    </button>
  );
}
