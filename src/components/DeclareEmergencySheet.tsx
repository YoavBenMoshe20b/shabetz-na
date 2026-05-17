// DeclareEmergencySheet — the form behind the "הקפצה" FAB.
//
// Collects the minimum a real escalation needs:
//   • reason (free text)
//   • report location (where to assemble)
//   • report time (default = now + 15 min)
//   • audience (whole company by default, optionally narrowed to one
//     or more platoons — the existing Audience shape on EscalationEvent)
//   • instructions (free text — propagates to the audience)
//
// On confirm:
//   1. declareEscalation() persists the EscalationEvent
//   2. an Announcement is auto-published to the same audience so
//      everyone in scope sees the activation in the announcements
//      strip + their calendar
//
// Honest disclosure: the sheet does NOT yet:
//   - pause / freeze conflicting missions
//   - reassign soldiers automatically
//   - dispatch real push notifications
// The audit log + announcement are the operational signal.

import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Audience, EscalationEvent } from '../types';
import { Sheet, Body, Hint, Muted, Button } from './ui';

interface Props {
  open: boolean;
  onClose: () => void;
}

type EndKind = NonNullable<EscalationEvent['endKind']>;

export default function DeclareEmergencySheet({ open, onClose }: Props) {
  const {
    currentUser, platoons, declareEscalation, addAnnouncement,
  } = useApp();

  const companyPlatoons = useMemo(
    () => platoons.filter((p) => p.companyId === currentUser?.companyId),
    [platoons, currentUser],
  );

  const [reason, setReason] = useState('');
  const [location, setLocation] = useState('');
  const [reportInMinutes, setReportInMinutes] = useState(15);
  const [scope, setScope] = useState<'company' | 'platoons'>('company');
  const [selectedPlatoonIds, setSelectedPlatoonIds] = useState<string[]>([]);
  const [endKind, setEndKind] = useState<EndKind>('unknown');
  const [instructions, setInstructions] = useState('');

  if (!open) return null;

  const reportIso = new Date(Date.now() + reportInMinutes * 60_000).toISOString();
  const audience: Audience = scope === 'company'
    ? { kind: 'company' }
    : { kind: 'platoons', platoonIds: selectedPlatoonIds };

  const canSubmit =
    reason.trim().length > 0
    && (scope === 'company' || selectedPlatoonIds.length > 0);

  const submit = () => {
    if (!canSubmit || !currentUser?.companyId) return;
    const ev = declareEscalation({
      companyId: currentUser.companyId,
      reason: reason.trim(),
      location: location.trim() || undefined,
      reportTime: reportIso,
      endKind,
      audience,
      instructions: instructions.trim() || undefined,
    });
    if (!ev) {
      // Permission denied — the declareEscalation gate handles this.
      onClose();
      return;
    }
    // Auto-announce so the audience sees the activation immediately.
    addAnnouncement({
      companyId: currentUser.companyId,
      kind: 'operational',
      title: `🚨 הקפצה — ${reason.trim()}`,
      body: [
        location.trim() && `יעד: ${location.trim()}`,
        `דיווח: ${formatRelative(reportInMinutes)}`,
        instructions.trim() || undefined,
      ].filter(Boolean).join(' · '),
      audience,
      showOnCalendar: true,
    });
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="פתיחת הקפצה"
      subtitle="אירוע פעיל יסומן עד שיסגר ידנית"
      size="lg"
    >
      <div className="px-5 py-5 space-y-4">

        <Field label="סיבת ההקפצה">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="לדוגמה: התרעה צפונית"
            className={inputCls}
            autoFocus
          />
        </Field>

        <Field label="יעד התייצבות">
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="שער ראשי / תעוז 4 / מתחם החפ״ק"
            className={inputCls}
          />
        </Field>

        <Field label="דיווח בעוד">
          <div className="flex gap-1.5 flex-wrap">
            {[5, 15, 30, 60, 120].map((m) => (
              <button
                key={m}
                onClick={() => setReportInMinutes(m)}
                className={`px-3.5 py-2 rounded-xl-soft text-tiny font-bold transition-colors ${
                  reportInMinutes === m
                    ? 'bg-mil-alert text-white'
                    : 'bg-mil-card border border-mil-border text-mil-muted hover:border-mil-alert'
                }`}
              >
                {m < 60 ? `${m} דק׳` : `${m / 60} שעות`}
              </button>
            ))}
          </div>
        </Field>

        <Field label="מי מוקפץ?">
          <div className="flex gap-1.5 mb-2">
            <ScopeChip active={scope === 'company'} onClick={() => setScope('company')}>כל הפלוגה</ScopeChip>
            <ScopeChip active={scope === 'platoons'} onClick={() => setScope('platoons')}>מחלקות נבחרות</ScopeChip>
          </div>
          {scope === 'platoons' && (
            <div className="flex flex-wrap gap-1.5">
              {companyPlatoons.map((p) => {
                const on = selectedPlatoonIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlatoonIds((prev) =>
                      on ? prev.filter((x) => x !== p.id) : [...prev, p.id],
                    )}
                    className={`px-3 py-1.5 rounded-xl-soft text-tiny font-bold transition-colors ${
                      on
                        ? 'bg-mil-alert text-white'
                        : 'bg-mil-card border border-mil-border text-mil-muted hover:border-mil-alert'
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}
        </Field>

        <Field label="משך מתוכנן">
          <div className="flex gap-1.5">
            <ScopeChip active={endKind === 'unknown'} onClick={() => setEndKind('unknown')}>פתוח</ScopeChip>
            <ScopeChip active={endKind === 'planned'} onClick={() => setEndKind('planned')}>תכנון</ScopeChip>
          </div>
        </Field>

        <Field label="הוראות לחיילים">
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            placeholder="נשק ואפוד · קסדה · מים · נוהל פתיחה לפי הצבעת המ״כ"
            className={`${inputCls} resize-none`}
          />
        </Field>

        {/* Preview line — operator confirms the audience reads what
            they intend before publishing. */}
        <div className="bg-mil-alert-bg border border-mil-alert/40 rounded-xl-soft px-4 py-3">
          <Hint className="block uppercase tracking-wide font-bold text-mil-alert mb-1">
            תצוגה מקדימה
          </Hint>
          <Body className="text-sm font-bold text-mil-alert leading-snug">
            🚨 הקפצה — {reason.trim() || '<חסר>'}
          </Body>
          <Muted className="mt-1 text-tiny leading-snug">
            {[
              location.trim() && `יעד: ${location.trim()}`,
              `דיווח: ${formatRelative(reportInMinutes)}`,
            ].filter(Boolean).join(' · ')}
          </Muted>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="primary" size="lg" fullWidth disabled={!canSubmit} onClick={submit}>
            🚨 פתח הקפצה
          </Button>
          <Button variant="ghost" size="lg" onClick={onClose}>ביטול</Button>
        </div>

        <Muted className="text-tiny leading-snug pt-2 border-t border-mil-border">
          <strong>תוצאה מיידית:</strong> כל מי שבבית מסומן זמנית כבבסיס. היציאות הפלוגתיות מוקפאות, איוש משימות פתוח לכלל הפלוגה. הודעת הקפצה נשלחת לקהל היעד. סגירת האירוע נעשית מהכפתור הצף האדום ותפתח אשף לאיזון מחדש של היציאות.
        </Muted>
      </div>
    </Sheet>
  );
}

const inputCls =
  'w-full bg-mil-bg-alt border border-mil-border rounded-xl-soft px-3.5 py-2.5 text-mil-text focus:outline-none focus:ring-2 focus:ring-mil-alert/40 focus:border-mil-alert placeholder:text-mil-ghost text-base';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Hint className="block mb-1.5 tracking-wide">{label}</Hint>
      {children}
    </div>
  );
}

function ScopeChip({ active, onClick, children }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl-soft text-tiny font-bold transition-colors ${
        active
          ? 'bg-mil-alert text-white'
          : 'bg-mil-card border border-mil-border text-mil-muted hover:border-mil-alert'
      }`}
    >
      {children}
    </button>
  );
}

function formatRelative(mins: number): string {
  if (mins < 60) return `בעוד ${mins} דק׳`;
  return `בעוד ${mins / 60} שעות`;
}
