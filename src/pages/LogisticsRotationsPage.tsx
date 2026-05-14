// LogisticsRotationsPage — Rasap-owned chore board.
//
// Lists all rotations in the company, grouped by status. Rasap (and CC)
// can flip statuses and add new rotations. Access is gated upstream by
// the route guard (rasap + CC).

import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp, useMyCompany } from '../context/AppContext';
import { isCompanyLeadership, isRasap } from '../utils/permissions';
import Header from '../components/Header';
import {
  Eyebrow, Section, PageMain, PageTitle, Body, Muted, Hint, Button,
  Sheet, EmptyState, Toast,
} from '../components/ui';
import type {
  LogisticsRotation, LogisticsRotationKind, LogisticsRotationStatus,
} from '../types';
import { LOGISTICS_ROTATION_LABEL } from '../types';

const STATUS_LABEL: Record<LogisticsRotationStatus, string> = {
  planned:       'מתוכנן',
  'in-progress': 'בביצוע',
  done:          'הושלם',
  cancelled:     'בוטל',
};

const STATUS_TONE: Record<LogisticsRotationStatus, string> = {
  planned:       'bg-mil-info-bg  text-mil-info  border-mil-info-border',
  'in-progress': 'bg-mil-warn-bg  text-mil-warn  border-mil-warn-border',
  done:          'bg-mil-success-bg text-mil-success border-mil-success-border',
  cancelled:     'bg-mil-bg-alt    text-mil-muted  border-mil-border',
};

export default function LogisticsRotationsPage() {
  const navigate = useNavigate();
  const { currentUser, logisticsRotations, soldiers, squads, addLogisticsRotation, setLogisticsRotationStatus } = useApp();
  const myCompany = useMyCompany();

  // Hooks first; route gate after.
  const myRotations = useMemo(() =>
    logisticsRotations
      .filter((r) => !myCompany || r.companyId === myCompany.id)
      .sort((a, b) => b.startIso.localeCompare(a.startIso)),
    [logisticsRotations, myCompany],
  );

  const grouped = useMemo(() => ({
    active:    myRotations.filter((r) => r.status === 'planned' || r.status === 'in-progress'),
    done:      myRotations.filter((r) => r.status === 'done'),
    cancelled: myRotations.filter((r) => r.status === 'cancelled'),
  }), [myRotations]);

  const [composerOpen, setComposerOpen] = useState(false);
  const [toast, setToast] = useState<string>('');

  // Route gate — Rasap + CC tier.
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!isRasap(currentUser) && !isCompanyLeadership(currentUser.role)) {
    return <Navigate to="/home" replace />;
  }

  const soldierName = (id: string) => soldiers.find((s) => s.id === id)?.name ?? id;
  const squadName   = (id?: string) => id ? (squads.find((sq) => sq.id === id)?.name ?? id) : null;

  const handleSubmit = (data: { kind: LogisticsRotationKind; title: string; startIso: string; description?: string }) => {
    if (!myCompany) return;
    addLogisticsRotation({
      companyId: myCompany.id,
      kind: data.kind,
      title: data.title,
      description: data.description,
      assignedSoldierIds: [],
      startIso: data.startIso,
    });
    setComposerOpen(false);
    setToast('הסבב נוצר');
    setTimeout(() => setToast(''), 2500);
  };

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="סבבים לוגיסטיים" />
      <PageMain>

        <header>
          <Eyebrow>{myCompany?.name ?? 'פלוגה'}</Eyebrow>
          <PageTitle className="mt-1">סבבים לוגיסטיים</PageTitle>
          <Muted className="mt-1.5">
            {grouped.active.length} פעילים · {grouped.done.length} הושלמו
          </Muted>
        </header>

        {toast && <Toast tone="success">{toast}</Toast>}

        <Button variant="primary" size="lg" fullWidth onClick={() => setComposerOpen(true)}>
          + סבב חדש
        </Button>

        <Section label="פעילים">
          {grouped.active.length === 0 ? (
            <EmptyState title="אין סבבים פעילים" hint="הוסף סבב חדש או חכה לסבבים מתוכננים" />
          ) : (
            <div className="space-y-2.5">
              {grouped.active.map((r) => (
                <RotationCard
                  key={r.id} rotation={r}
                  assigneeText={describeAssignees(r, soldierName, squadName)}
                  onMarkInProgress={() => setLogisticsRotationStatus(r.id, 'in-progress')}
                  onMarkDone={() => { setLogisticsRotationStatus(r.id, 'done'); setToast('סבב סומן כהושלם'); setTimeout(() => setToast(''), 2500); }}
                  onCancel={() => setLogisticsRotationStatus(r.id, 'cancelled')}
                />
              ))}
            </div>
          )}
        </Section>

        {grouped.done.length > 0 && (
          <Section label="הושלמו לאחרונה">
            <div className="space-y-2.5">
              {grouped.done.slice(0, 5).map((r) => (
                <RotationCard
                  key={r.id} rotation={r}
                  assigneeText={describeAssignees(r, soldierName, squadName)}
                />
              ))}
            </div>
          </Section>
        )}

        <button
          onClick={() => navigate('/rasap')}
          className="block w-full text-center text-tiny text-mil-muted hover:text-mil-text underline"
        >
          חזרה ללוח רס״פ ←
        </button>
      </PageMain>

      {composerOpen && (
        <RotationComposer onClose={() => setComposerOpen(false)} onSubmit={handleSubmit} />
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function describeAssignees(
  r: LogisticsRotation,
  soldierName: (id: string) => string,
  squadName: (id?: string) => string | null,
): string {
  if (r.assignedSoldierIds.length > 0) {
    const names = r.assignedSoldierIds.map((id) => soldierName(id).split(' ')[0]);
    return names.join(' · ');
  }
  if (r.squadId) {
    return `כיתה: ${squadName(r.squadId) ?? '—'}`;
  }
  return 'לא שובץ';
}

function RotationCard({
  rotation, assigneeText,
  onMarkInProgress, onMarkDone, onCancel,
}: {
  rotation: LogisticsRotation;
  assigneeText: string;
  onMarkInProgress?: () => void;
  onMarkDone?:      () => void;
  onCancel?:        () => void;
}) {
  const start = new Date(rotation.startIso);
  const startLabel = `${start.toISOString().slice(0,10)} ${start.toISOString().slice(11,16)}`;

  return (
    <div className="bg-mil-card border border-mil-border rounded-xl-soft shadow-card p-4">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div className="flex items-baseline gap-2">
          <span className={`inline-flex text-xxs font-semibold px-2 py-0.5 rounded-md border ${STATUS_TONE[rotation.status]}`}>
            {STATUS_LABEL[rotation.status]}
          </span>
          <Hint className="text-mil-muted">{LOGISTICS_ROTATION_LABEL[rotation.kind]}</Hint>
        </div>
        <Hint className="font-mono tabular-nums">{startLabel}</Hint>
      </div>
      <Body className="font-semibold mt-2">{rotation.title}</Body>
      {rotation.description && <Muted className="block mt-1 text-tiny">{rotation.description}</Muted>}
      <Hint className="block mt-1.5 text-mil-olive-dim">{assigneeText}</Hint>

      {(onMarkInProgress || onMarkDone || onCancel) && (
        <div className="flex gap-1.5 mt-3">
          {onMarkInProgress && rotation.status === 'planned' && (
            <button
              onClick={onMarkInProgress}
              className="flex-1 py-1.5 rounded-md text-tiny font-semibold bg-mil-warn-bg text-mil-warn border border-mil-warn-border hover:bg-mil-warn hover:text-white transition-colors"
            >
              התחל
            </button>
          )}
          {onMarkDone && (rotation.status === 'planned' || rotation.status === 'in-progress') && (
            <button
              onClick={onMarkDone}
              className="flex-1 py-1.5 rounded-md text-tiny font-semibold bg-mil-success-bg text-mil-success border border-mil-success-border hover:bg-mil-success hover:text-white transition-colors"
            >
              סמן כהושלם
            </button>
          )}
          {onCancel && rotation.status !== 'cancelled' && rotation.status !== 'done' && (
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded-md text-tiny font-semibold text-mil-muted hover:text-mil-alert hover:bg-mil-alert-bg transition-colors"
            >
              בטל
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Composer sheet ─────────────────────────────────────────────────────

function RotationComposer({
  onClose, onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: { kind: LogisticsRotationKind; title: string; startIso: string; description?: string }) => void;
}) {
  const [kind, setKind] = useState<LogisticsRotationKind>('kitchen');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('08:00');

  const canSubmit = title.trim().length >= 2;

  return (
    <Sheet open onClose={onClose} title="סבב לוגיסטי חדש">
      <div className="px-5 py-5 space-y-4">

        <div>
          <label className="block text-tiny font-semibold text-mil-muted mb-2">סוג</label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(LOGISTICS_ROTATION_LABEL) as LogisticsRotationKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`px-3 py-1.5 rounded-md text-tiny font-semibold border transition-colors ${
                  kind === k
                    ? 'bg-mil-olive text-white border-mil-olive'
                    : 'bg-mil-card text-mil-text border-mil-border hover:border-mil-border-strong'
                }`}
              >
                {LOGISTICS_ROTATION_LABEL[k]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-tiny font-semibold text-mil-muted mb-1.5">כותרת</label>
          <input
            className="w-full bg-mil-card border border-mil-border rounded-lg px-3.5 py-2.5 text-sm text-mil-text focus:outline-none focus:border-mil-olive focus:shadow-focus"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='למשל "תורנות מטבח — ערב"'
          />
        </div>

        <div>
          <label className="block text-tiny font-semibold text-mil-muted mb-1.5">תיאור (אופציונלי)</label>
          <textarea
            className="w-full bg-mil-card border border-mil-border rounded-lg px-3.5 py-2.5 text-sm text-mil-text focus:outline-none focus:border-mil-olive focus:shadow-focus resize-none"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-tiny font-semibold text-mil-muted mb-1.5">תאריך</label>
            <input
              type="date"
              className="w-full bg-mil-card border border-mil-border rounded-lg px-3.5 py-2.5 text-sm text-mil-text focus:outline-none focus:border-mil-olive focus:shadow-focus"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-tiny font-semibold text-mil-muted mb-1.5">שעה</label>
            <input
              type="time"
              className="w-full bg-mil-card border border-mil-border rounded-lg px-3.5 py-2.5 text-sm text-mil-text focus:outline-none focus:border-mil-olive focus:shadow-focus"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canSubmit}
          onClick={() => onSubmit({
            kind, title: title.trim(),
            startIso: `${date}T${time}:00`,
            description: description.trim() || undefined,
          })}
        >
          צור סבב
        </Button>
      </div>
    </Sheet>
  );
}
