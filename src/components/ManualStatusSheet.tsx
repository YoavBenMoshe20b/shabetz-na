// ManualStatusSheet — commander overrides a soldier's operational status.
//
// Used by CC/Deputy on any soldier in the company; by PC/PS on soldiers
// in their commanded platoon. The audit log captures actor + previous +
// reason on every commit (see writeStatusTransition in AppContext).
//
// Mandatory: a textual reason. The audit is meaningless without it, so
// the submit button is disabled until reason is provided.

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Sheet, Button, Body, Hint, Segment,
} from './ui';
import type { Soldier, SoldierStatus } from '../types';

interface ManualStatusSheetProps {
  open: boolean;
  onClose: () => void;
  soldier: Soldier;
}

const STATUS_OPTIONS: { value: SoldierStatus; label: string; hint: string }[] = [
  { value: 'in-base',       label: 'בבסיס',     hint: 'החייל נמצא וזמין לשיבוץ' },
  { value: 'home',          label: 'בבית',       hint: 'החייל בחופשה / סבב' },
  { value: 'inactive-temp', label: 'לא פעיל',   hint: 'לא זמין לשיבוץ זמנית' },
];

export default function ManualStatusSheet({ open, onClose, soldier }: ManualStatusSheetProps) {
  const { updateSoldierStatusByCommander } = useApp();
  const [next, setNext] = useState<SoldierStatus>(soldier.currentStatus);
  const [reason, setReason] = useState('');
  const [expectedUntil, setExpectedUntil] = useState('');

  const canSubmit = next !== soldier.currentStatus && reason.trim().length > 0;
  const selected = STATUS_OPTIONS.find((o) => o.value === next);

  const submit = () => {
    if (!canSubmit) return;
    updateSoldierStatusByCommander({
      soldierId: soldier.id,
      next,
      reason: reason.trim(),
      expectedUntil: expectedUntil || undefined,
    });
    setReason('');
    setExpectedUntil('');
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="עדכון סטטוס ידני"
      subtitle={soldier.name}
    >
      <div className="px-5 py-5 space-y-4">

        <div className="bg-mil-bg-alt border border-mil-border rounded-xl-soft px-3.5 py-3">
          <Hint className="text-tiny tracking-wide uppercase font-semibold text-mil-muted">מצב נוכחי</Hint>
          <Body className="font-semibold mt-0.5">
            {soldier.currentStatus === 'in-base' ? 'בבסיס' :
             soldier.currentStatus === 'home' ? 'בבית' : 'לא פעיל'}
          </Body>
        </div>

        <div>
          <Hint className="block mb-2 font-semibold">סטטוס חדש</Hint>
          <Segment
            value={next}
            onChange={setNext}
            fullWidth
            options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          {selected && (
            <Hint className="block mt-2 text-mil-muted">{selected.hint}</Hint>
          )}
        </div>

        {next === 'home' && (
          <div>
            <Hint className="block mb-1.5">חזרה צפויה (אופציונלי)</Hint>
            <input
              type="datetime-local"
              value={expectedUntil}
              onChange={(e) => setExpectedUntil(e.target.value)}
              className={INPUT}
            />
          </div>
        )}

        <div>
          <Hint className="block mb-1.5 font-semibold">סיבה (חובה)</Hint>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="לדוגמה: חזר ממילואים אחרים / אירוע משפחתי דחוף"
            className={`${INPUT} resize-none`}
          />
          <Hint className="block mt-1 text-mil-muted">
            הסיבה תישמר ביומן הביקורת לצד שם המעדכן וזמן השינוי.
          </Hint>
        </div>

        <div className="bg-mil-warn-bg border border-mil-warn-border rounded-xl-soft px-3.5 py-2.5">
          <p className="text-tiny text-mil-warn leading-relaxed">
            עדכון ידני עוקף את זרימת בקשת היציאה הרגילה. השתמש רק כאשר אין דרך אחרת.
          </p>
        </div>

        <Button variant="primary" size="lg" fullWidth onClick={submit} disabled={!canSubmit}>
          עדכן סטטוס
        </Button>
      </div>
    </Sheet>
  );
}

const INPUT = 'w-full bg-mil-bg-alt border border-mil-border rounded-xl-soft px-3.5 py-2.5 text-mil-text focus:outline-none focus:border-mil-olive focus:shadow-focus placeholder:text-mil-ghost text-base transition-all duration-200 ease-out-soft';
