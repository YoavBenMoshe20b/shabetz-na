// SignOutSheet — Rasap signs an inventory item OUT to a specific soldier.
//
// Two modes:
//   • Pick from inventory (EquipmentItem) — most common; lets Rasap stay
//     anchored to the company catalogue.
//   • Free text — for personal weapons / one-offs that don't live in the
//     central inventory.
//
// Both paths feed into AppContext.signOutEquipment which validates the
// transition and appends a LifecycleEvent.

import { useMemo, useState } from 'react';
import { useApp, useMyCompany } from '../context/AppContext';
import {
  Sheet, Button, Body, Hint, Segment,
} from './ui';
import type { SignedEquipmentCategory, EquipmentCondition, Soldier } from '../types';

const CATEGORIES: { value: SignedEquipmentCategory; label: string }[] = [
  { value: 'weapon',     label: 'נשק' },
  { value: 'optic',      label: 'אופטיקה' },
  { value: 'comms',      label: 'תקשורת' },
  { value: 'protection', label: 'הגנה' },
  { value: 'navigation', label: 'ניווט' },
  { value: 'medical',    label: 'רפואה' },
  { value: 'misc',       label: 'שונות' },
];

interface SignOutSheetProps {
  open: boolean;
  onClose: () => void;
  /** Optional pre-selected soldier — when Rasap opens this from the
   *  soldier-detail surface, the target is fixed. */
  forSoldier?: Soldier;
}

export default function SignOutSheet({ open, onClose, forSoldier }: SignOutSheetProps) {
  const { soldiers, equipmentItems, signOutEquipment } = useApp();
  const myCompany = useMyCompany();

  const [mode,         setMode]         = useState<'catalog' | 'free'>('catalog');
  const [soldierId,    setSoldierId]    = useState<string>(forSoldier?.id ?? '');
  const [search,       setSearch]       = useState('');
  const [itemId,       setItemId]       = useState<string>('');
  const [freeName,     setFreeName]     = useState('');
  const [category,     setCategory]     = useState<SignedEquipmentCategory>('weapon');
  const [serial,       setSerial]       = useState('');
  const [notes,        setNotes]        = useState('');
  const [condition,    setCondition]    = useState<EquipmentCondition>('good');

  const companyItems = useMemo(
    () => equipmentItems.filter((i) => i.companyId === myCompany?.id),
    [equipmentItems, myCompany],
  );

  const filteredSoldiers = useMemo(() => {
    if (forSoldier) return [forSoldier];
    const q = search.trim();
    return q ? soldiers.filter((s) => s.name.includes(q)) : soldiers;
  }, [soldiers, search, forSoldier]);

  const canSubmit = soldierId && (
    (mode === 'catalog' && itemId) ||
    (mode === 'free'    && freeName.trim().length > 0)
  );

  const submit = () => {
    if (!canSubmit) return;
    if (mode === 'catalog') {
      const item = companyItems.find((i) => i.id === itemId);
      if (!item) return;
      signOutEquipment({
        soldierId,
        itemName: item.name,
        category,
        equipmentItemId: item.id,
        serialNumber: serial.trim() || undefined,
        notes: notes.trim() || undefined,
        initialCondition: condition,
      });
    } else {
      signOutEquipment({
        soldierId,
        itemName: freeName.trim(),
        category,
        serialNumber: serial.trim() || undefined,
        notes: notes.trim() || undefined,
        initialCondition: condition,
      });
    }
    setItemId(''); setFreeName(''); setSerial(''); setNotes('');
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="החתמת ציוד">
      <div className="px-5 py-5 space-y-4">

        {!forSoldier && (
          <div>
            <Hint className="block mb-1.5 font-semibold">חייל</Hint>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חפש לפי שם…"
              className={INPUT}
            />
            <div className="mt-2 max-h-40 overflow-y-auto border border-mil-border rounded-xl-soft divide-y divide-mil-border bg-mil-card">
              {filteredSoldiers.length === 0 ? (
                <p className="px-3.5 py-3 text-tiny text-mil-muted">אין חיילים תואמים</p>
              ) : (
                filteredSoldiers.slice(0, 50).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSoldierId(s.id)}
                    className={`w-full text-right px-3.5 py-2.5 transition-colors text-sm flex items-center gap-2 ${
                      soldierId === s.id ? 'bg-mil-olive-bg' : 'hover:bg-mil-card-hover'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-md border-2 flex-shrink-0 flex items-center justify-center ${
                      soldierId === s.id ? 'bg-mil-olive border-mil-olive' : 'border-mil-border-strong'
                    }`}>
                      {soldierId === s.id && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </span>
                    <span className="flex-1 font-medium text-mil-text">{s.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {forSoldier && (
          <div className="bg-mil-olive-bg border border-mil-olive/20 rounded-xl-soft px-3.5 py-2.5">
            <Hint className="text-tiny">חייל יעד</Hint>
            <Body className="font-semibold text-mil-olive mt-0.5">{forSoldier.name}</Body>
          </div>
        )}

        <div>
          <Hint className="block mb-2 font-semibold">בחירת פריט</Hint>
          <Segment
            value={mode}
            onChange={setMode}
            fullWidth
            options={[
              { value: 'catalog', label: 'מהקטלוג' },
              { value: 'free',    label: 'טקסט חופשי' },
            ]}
          />
        </div>

        {mode === 'catalog' ? (
          <div>
            <Hint className="block mb-1.5">בחר פריט</Hint>
            <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={INPUT}>
              <option value="">— בחר —</option>
              {companyItems.map((i) => (
                <option key={i.id} value={i.id}>{i.name} {i.category ? `· ${i.category}` : ''}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <Hint className="block mb-1.5">שם הפריט</Hint>
            <input value={freeName} onChange={(e) => setFreeName(e.target.value)} placeholder="לדוגמה: רובה אישי, מד״ר" className={INPUT} />
          </div>
        )}

        <div>
          <Hint className="block mb-2 font-semibold">קטגוריה</Hint>
          <select value={category} onChange={(e) => setCategory(e.target.value as SignedEquipmentCategory)} className={INPUT}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Hint className="block mb-1.5">מס׳ סידורי</Hint>
            <input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="אופציונלי" className={INPUT} />
          </div>
          <div>
            <Hint className="block mb-1.5">מצב</Hint>
            <select value={condition} onChange={(e) => setCondition(e.target.value as EquipmentCondition)} className={INPUT}>
              <option value="new">חדש</option>
              <option value="good">תקין</option>
              <option value="worn">בלאי קל</option>
            </select>
          </div>
        </div>

        <div>
          <Hint className="block mb-1.5">הערות</Hint>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="הערות מיוחדות" className={`${INPUT} resize-none`} />
        </div>

        <Button variant="primary" size="lg" fullWidth onClick={submit} disabled={!canSubmit}>
          החתם ציוד
        </Button>
      </div>
    </Sheet>
  );
}

const INPUT = 'w-full bg-mil-bg-alt border border-mil-border rounded-xl-soft px-3.5 py-2.5 text-mil-text focus:outline-none focus:border-mil-olive focus:shadow-focus placeholder:text-mil-ghost text-base transition-all duration-200 ease-out-soft';
