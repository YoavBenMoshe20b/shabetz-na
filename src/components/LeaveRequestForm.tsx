// LeaveRequestForm — extracted from the legacy soldier dashboard so any
// role can submit a leave request through PersonalActionsFab.
//
// Pure form. The caller wires the submission (soldierId, soldierName...)
// and decides where to route the data.

import { useState } from 'react';
import { Button, Hint } from './ui';

interface LeaveRequestFormProps {
  onCancel: () => void;
  onSubmit: (data: {
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    reason: string;
  }) => void;
}

export default function LeaveRequestForm({ onCancel, onSubmit }: LeaveRequestFormProps) {
  const [form, setForm] = useState({
    startDate: '', startTime: '14:00',
    endDate:   '', endTime:   '08:00',
    reason:    '',
  });

  const canSubmit = form.startDate && form.endDate && form.reason.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Hint className="block mb-1.5 font-semibold">יציאה — תאריך</Hint>
          <input type="date" className={INPUT} value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
        </div>
        <div>
          <Hint className="block mb-1.5 font-semibold">שעה</Hint>
          <input type="time" className={INPUT} value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
        </div>
        <div>
          <Hint className="block mb-1.5 font-semibold">חזרה — תאריך</Hint>
          <input type="date" className={INPUT} value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
        </div>
        <div>
          <Hint className="block mb-1.5 font-semibold">שעה</Hint>
          <input type="time" className={INPUT} value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
        </div>
      </div>

      <div>
        <Hint className="block mb-1.5 font-semibold">סיבה</Hint>
        <textarea
          className={`${INPUT} resize-none`}
          rows={3}
          value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          placeholder="אירוע משפחתי / פגישה רפואית..."
        />
      </div>

      <div className="flex gap-2">
        <Button variant="primary" size="lg" fullWidth onClick={() => canSubmit && onSubmit(form)} disabled={!canSubmit}>
          שלח בקשה
        </Button>
        <Button variant="quiet" size="lg" onClick={onCancel}>
          ביטול
        </Button>
      </div>
    </div>
  );
}

const INPUT = 'w-full bg-mil-bg-alt border border-mil-border rounded-xl-soft px-3.5 py-3 text-mil-text focus:outline-none focus:ring-2 focus:ring-mil-olive/40 focus:border-mil-olive placeholder:text-mil-ghost text-base transition-colors duration-200 ease-out-soft';
