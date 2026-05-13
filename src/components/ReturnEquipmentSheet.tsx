// ReturnEquipmentSheet — Rasap accepts a return.
//
// Full return: item back, condition reset to 'good'.
// Partial return: item back but damaged — transitions to in-repair.

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Sheet, Button, Body, Hint, Segment,
} from './ui';
import type { SignedEquipment, EquipmentCondition } from '../types';

interface ReturnSheetProps {
  open: boolean;
  onClose: () => void;
  item: SignedEquipment;
}

const CONDITION_OPTIONS: { value: EquipmentCondition; label: string }[] = [
  { value: 'good',     label: 'תקין' },
  { value: 'worn',     label: 'בלאי קל' },
  { value: 'damaged',  label: 'פגום' },
  { value: 'unusable', label: 'לא שמיש' },
];

export default function ReturnEquipmentSheet({ open, onClose, item }: ReturnSheetProps) {
  const { soldiers, returnEquipment } = useApp();
  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [condition, setCondition] = useState<EquipmentCondition>('good');
  const [description, setDescription] = useState('');

  const soldier = soldiers.find((s) => s.id === item.soldierId);

  const submit = () => {
    returnEquipment({
      signedEquipmentId: item.id,
      partial: mode === 'partial',
      damageDescription: description.trim() || undefined,
      finalCondition: condition,
    });
    setDescription('');
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="קליטת ציוד">
      <div className="px-5 py-5 space-y-4">

        <div className="bg-mil-bg-alt border border-mil-border rounded-xl-soft px-3.5 py-3">
          <Body className="font-semibold">{item.itemName}</Body>
          {item.serialNumber && (
            <Hint className="text-mil-muted tabular-nums mt-0.5">מס׳ סידורי: {item.serialNumber}</Hint>
          )}
          {soldier && (
            <Hint className="text-mil-muted mt-0.5">מ-{soldier.name}</Hint>
          )}
        </div>

        <div>
          <Hint className="block mb-2 font-semibold">סוג ההחזרה</Hint>
          <Segment
            value={mode}
            onChange={(v) => { setMode(v); if (v === 'full') setCondition('good'); else setCondition('damaged'); }}
            fullWidth
            options={[
              { value: 'full',     label: 'מלאה (תקין)' },
              { value: 'partial',  label: 'חלקית (בלאי / נזק)' },
            ]}
          />
        </div>

        <div>
          <Hint className="block mb-2 font-semibold">מצב הפריט</Hint>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as EquipmentCondition)}
            className={INPUT}
          >
            {CONDITION_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {mode === 'partial' && (
          <div>
            <Hint className="block mb-1.5 font-semibold">תיאור הנזק</Hint>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="מה לא בסדר? איפה הבלאי?"
              className={`${INPUT} resize-none`}
            />
          </div>
        )}

        <div className="bg-mil-info-bg border border-mil-info-border rounded-xl-soft px-3.5 py-2.5">
          <p className="text-tiny text-mil-info">
            {mode === 'full'
              ? 'הפריט יעבור למחסן רס״פ במצב תקין.'
              : 'הפריט יעבור למחסן תיקון עם תיעוד הנזק.'}
          </p>
        </div>

        <Button variant="primary" size="lg" fullWidth onClick={submit}>
          {mode === 'full' ? 'קלוט החזרה' : 'קלוט עם תיעוד נזק'}
        </Button>
      </div>
    </Sheet>
  );
}

const INPUT = 'w-full bg-mil-bg-alt border border-mil-border rounded-xl-soft px-3.5 py-2.5 text-mil-text focus:outline-none focus:border-mil-olive focus:shadow-focus placeholder:text-mil-ghost text-base transition-all duration-200 ease-out-soft';
