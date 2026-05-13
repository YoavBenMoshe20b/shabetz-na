// EscalationSheet — the composer for opening a new הקפצה.
//
// Five sections:
//   1. Reason — single most important field
//   2. Time — reportTime (required) + endTime/unknown
//   3. Location — free text
//   4. Audience — via AudiencePicker
//   5. Equipment + instructions — free text
//
// Submit calls declareEscalation. The flow ENDS by closing the sheet —
// the active banner takes over the visible surface afterwards.

import { useState } from 'react';
import { useApp, useMyCompany } from '../context/AppContext';
import { AudiencePicker } from './AudiencePicker';
import type { Audience, EscalationEndKind } from '../types';
import { Sheet, Button, Body, Hint, Segment } from './ui';

interface EscalationSheetProps {
  open: boolean;
  onClose: () => void;
}

export default function EscalationSheet({ open, onClose }: EscalationSheetProps) {
  const { soldiers, platoons, squads, declareEscalation } = useApp();
  const myCompany = useMyCompany();

  // Default reportTime: 30 minutes from now, rounded to next 5-minute boundary.
  const defaultReport = (() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    d.setMinutes(Math.round(d.getMinutes() / 5) * 5, 0, 0);
    return d.toISOString().slice(0, 16);  // 'YYYY-MM-DDTHH:MM'
  })();

  const [reason,     setReason]     = useState('');
  const [location,   setLocation]   = useState('');
  const [reportTime, setReportTime] = useState(defaultReport);
  const [endKind,    setEndKind]    = useState<EscalationEndKind>('unknown');
  const [endTime,    setEndTime]    = useState('');
  const [audience,   setAudience]   = useState<Audience>({ kind: 'company' });
  const [instructions, setInstructions] = useState('');
  const [equipmentText, setEquipmentText] = useState('');

  const canSubmit = reason.trim().length > 0 && reportTime.length > 0;

  const submit = () => {
    if (!canSubmit || !myCompany) return;
    const equipList = equipmentText.split(/[·,\n]/).map((s) => s.trim()).filter(Boolean);
    const reportIso = new Date(reportTime).toISOString();
    declareEscalation({
      companyId:     myCompany.id,
      reason:        reason.trim(),
      location:      location.trim() || undefined,
      reportTime:    reportIso,
      endKind,
      endTime:       endKind === 'planned' && endTime ? new Date(endTime).toISOString() : undefined,
      audience,
      instructions:  instructions.trim() || undefined,
      requiredEquipment: equipList.length > 0 ? equipList : undefined,
    });
    // Reset
    setReason(''); setLocation(''); setInstructions(''); setEquipmentText('');
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="פתיחת הקפצה" subtitle="מצב חירום מבצעי" size="lg">
      <div className="px-5 py-5 space-y-5">

        {/* Reason */}
        <div>
          <Hint className="block mb-1.5 font-semibold">סיבה</Hint>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="לדוגמה: התרעה צפונית"
            autoFocus
            className={inputCls}
          />
        </div>

        {/* Audience */}
        <div>
          <Hint className="block mb-2 font-semibold">את מי מקפיצים</Hint>
          <AudiencePicker
            value={audience}
            onChange={setAudience}
            platoons={platoons}
            squads={squads}
            soldiers={soldiers}
          />
        </div>

        {/* Time block */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Hint className="block mb-1.5 font-semibold">זמן התייצבות</Hint>
            <input type="datetime-local" value={reportTime} onChange={(e) => setReportTime(e.target.value)} className={inputCls} />
          </div>
          <div>
            <Hint className="block mb-1.5 font-semibold">מיקום</Hint>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="שער ראשי / חפ״ק / תעוז"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <Hint className="block mb-2 font-semibold">משך</Hint>
          <Segment
            value={endKind}
            onChange={setEndKind}
            options={[
              { value: 'unknown', label: 'לא ידוע' },
              { value: 'planned', label: 'מתוכנן' },
            ]}
          />
          {endKind === 'planned' && (
            <div className="mt-3">
              <Hint className="block mb-1.5">זמן סיום מתוכנן</Hint>
              <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
            </div>
          )}
        </div>

        {/* Equipment */}
        <div>
          <Hint className="block mb-1.5 font-semibold">ציוד נדרש</Hint>
          <input
            value={equipmentText}
            onChange={(e) => setEquipmentText(e.target.value)}
            placeholder="ווסט · קסדה · נשק אישי · מד״ר"
            className={inputCls}
          />
          <Hint className="block mt-1 text-mil-muted">הפרד בנקודה ( · ) או פסיק</Hint>
        </div>

        {/* Instructions */}
        <div>
          <Hint className="block mb-1.5 font-semibold">הוראות מיוחדות</Hint>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            placeholder="התייצבות מלאה. סבב נוכחות בידי המ״מים..."
            className={`${inputCls} resize-none`}
          />
        </div>

        <div className="bg-mil-alert-bg border border-mil-alert-border rounded-xl-soft px-4 py-3">
          <Body className="text-mil-alert font-semibold text-sm">
            עם פרסום, ההקפצה תופיע כבאנר חירום לכל קהל היעד ותישמר ביומן.
          </Body>
        </div>

        <Button variant="primary" size="lg" fullWidth onClick={submit} disabled={!canSubmit}>
          פרסם הקפצה
        </Button>
      </div>
    </Sheet>
  );
}

const inputCls =
  'w-full bg-mil-bg-alt border border-mil-border rounded-xl-soft px-3.5 py-2.5 text-mil-text focus:outline-none focus:border-mil-olive focus:shadow-focus placeholder:text-mil-ghost text-base transition-all duration-200 ease-out-soft';
