// Universal damage report sheet.
//
// Triggered from EquipmentPage (soldier), SoldierDetailPage (commander),
// Report1Page row (commander), and the Rasap dashboard (Rasap).
//
// Two modes:
//   • For a specific SignedEquipment: marks damage on that item +
//     creates an EquipmentGap report. Flow ends at Rasap pipeline.
//   • For free-text: creates an EquipmentGap with no item reference.
//
// Same UI shape regardless of caller. Permissions are checked by the
// caller before opening the sheet.

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Sheet, Button, Body, Hint, Segment,
} from './ui';
import type { SignedEquipment, EquipmentCondition, EquipmentGapKind } from '../types';

interface DamageReportSheetProps {
  open: boolean;
  onClose: () => void;
  /** When provided, sheet pre-fills item + offers the "mark damage on this
   *  item" transition. When undefined, sheet asks for free-text item name. */
  forItem?: SignedEquipment | null;
  /** Submitter soldierId. Defaults to currentUser's soldier profile. */
  reportedBySoldierId?: string;
}

const KIND_LABEL: Record<EquipmentGapKind, string> = {
  missing:           'חסר',
  damaged:           'בלאי / נזק',
  'logistics-issue': 'בעיה לוגיסטית',
};

const CONDITION_LABEL: Record<EquipmentCondition, string> = {
  'new':       'חדש',
  'good':      'תקין',
  'worn':      'בלאי קל',
  'damaged':   'פגום',
  'unusable':  'לא שמיש',
};

export default function DamageReportSheet({
  open, onClose, forItem, reportedBySoldierId,
}: DamageReportSheetProps) {
  const { currentUser, reportEquipmentGap, markEquipmentDamage } = useApp();

  const [kind,        setKind]        = useState<EquipmentGapKind>(forItem ? 'damaged' : 'missing');
  const [itemName,    setItemName]    = useState<string>(forItem?.itemName ?? '');
  const [description, setDescription] = useState('');
  const [condition,   setCondition]   = useState<EquipmentCondition>('damaged');

  const submitterId = reportedBySoldierId
    ?? currentUser?.soldierProfileId
    ?? '';

  const canSubmit = itemName.trim().length > 0 && description.trim().length > 0 && !!submitterId;

  const submit = () => {
    if (!canSubmit) return;
    // Always create an EquipmentGap (the Rasap-bound pipeline)
    reportEquipmentGap({
      soldierId: submitterId,
      kind,
      itemName: itemName.trim(),
      signedEquipmentId: forItem?.id,
      description: description.trim(),
    });
    // When the report references a SignedEquipment AND kind is 'damaged',
    // also update the item's condition via the state machine.
    if (forItem && kind === 'damaged') {
      markEquipmentDamage({
        signedEquipmentId: forItem.id,
        description: description.trim(),
        newCondition: condition,
      });
    }
    setDescription('');
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="דיווח בלאי / חוסר ציוד">
      <div className="px-5 py-5 space-y-4">

        <div>
          <Hint className="block mb-2 font-semibold">סוג הדיווח</Hint>
          <Segment
            value={kind}
            onChange={setKind}
            fullWidth
            options={[
              { value: 'damaged',           label: KIND_LABEL.damaged },
              { value: 'missing',           label: KIND_LABEL.missing },
              { value: 'logistics-issue',   label: KIND_LABEL['logistics-issue'] },
            ]}
          />
        </div>

        <div>
          <Hint className="block mb-1.5 font-semibold">פריט</Hint>
          {forItem ? (
            <div className="bg-mil-bg-alt border border-mil-border rounded-xl-soft px-3.5 py-3">
              <Body className="font-semibold">{forItem.itemName}</Body>
              {forItem.serialNumber && (
                <Hint className="text-mil-muted tabular-nums mt-1">מס׳ סידורי: {forItem.serialNumber}</Hint>
              )}
            </div>
          ) : (
            <input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="שם הפריט"
              className={INPUT}
            />
          )}
        </div>

        {forItem && kind === 'damaged' && (
          <div>
            <Hint className="block mb-2 font-semibold">מצב נוכחי של הפריט</Hint>
            <Segment
              value={condition}
              onChange={setCondition}
              fullWidth
              options={[
                { value: 'worn',     label: CONDITION_LABEL.worn },
                { value: 'damaged',  label: CONDITION_LABEL.damaged },
                { value: 'unusable', label: CONDITION_LABEL.unusable },
              ]}
            />
          </div>
        )}

        <div>
          <Hint className="block mb-1.5 font-semibold">תיאור</Hint>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="מה קרה? איפה הבלאי? מתי?"
            className={`${INPUT} resize-none`}
          />
        </div>

        <div className="bg-mil-info-bg border border-mil-info-border rounded-xl-soft px-3.5 py-2.5">
          <p className="text-tiny text-mil-info">
            הדיווח יישלח לסמל המחלקה, ומשם יעבור לרס״פ לטיפול.
          </p>
        </div>

        <Button variant="primary" size="lg" fullWidth onClick={submit} disabled={!canSubmit}>
          שלח דיווח
        </Button>
      </div>
    </Sheet>
  );
}

const INPUT = 'w-full bg-mil-bg-alt border border-mil-border rounded-xl-soft px-3.5 py-2.5 text-mil-text focus:outline-none focus:border-mil-olive focus:shadow-focus placeholder:text-mil-ghost text-base transition-all duration-200 ease-out-soft';
