// CsvImportSheet — frontend-only CSV import for equipment inventory.
//
// Today: parses a pasted/uploaded CSV with a fixed schema and bulk-
// updates the in-memory inventory. Tomorrow (backend): same flow, but
// the file goes to /equipment/import which validates server-side +
// returns the parsed rows for the operator to confirm before commit.
//
// Schema (header row required):
//   name,category,unitCount,defaultLocation,manufacturer,serialPrefix
//
// `name` + `unitCount` required; everything else optional.

import { useState } from 'react';
import { useApp, useMyCompany } from '../context/AppContext';
import { newId } from '../utils/id';
import {
  Sheet, Button, Body, Hint,
} from './ui';
import type { EquipmentItem } from '../types';

interface CsvImportSheetProps {
  open: boolean;
  onClose: () => void;
}

interface ParsedRow {
  name: string;
  category?: string;
  unitCount: number;
  defaultLocation?: string;
  manufacturer?: string;
  serialPrefix?: string;
  error?: string;
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idxName  = header.indexOf('name');
  const idxCat   = header.indexOf('category');
  const idxUnits = header.indexOf('unitcount');
  const idxLoc   = header.indexOf('defaultlocation');
  const idxMfr   = header.indexOf('manufacturer');
  const idxSer   = header.indexOf('serialprefix');

  return lines.slice(1).map((line): ParsedRow => {
    const cells = line.split(',').map((c) => c.trim());
    const name = cells[idxName] ?? '';
    const unitStr = cells[idxUnits] ?? '';
    const unitCount = Number.parseInt(unitStr, 10);

    if (!name) return { name: '', unitCount: 0, error: 'חסר שם פריט' };
    if (Number.isNaN(unitCount) || unitCount < 0) {
      return { name, unitCount: 0, error: 'unitCount חייב להיות מספר חיובי' };
    }

    return {
      name,
      category:         idxCat   >= 0 ? cells[idxCat]   || undefined : undefined,
      unitCount,
      defaultLocation:  idxLoc   >= 0 ? cells[idxLoc]   || undefined : undefined,
      manufacturer:     idxMfr   >= 0 ? cells[idxMfr]   || undefined : undefined,
      serialPrefix:     idxSer   >= 0 ? cells[idxSer]   || undefined : undefined,
    };
  });
}

export default function CsvImportSheet({ open, onClose }: CsvImportSheetProps) {
  const { equipmentItems, setInventoryItems } = useApp();
  const myCompany = useMyCompany();

  const [pasted, setPasted] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [committed, setCommitted] = useState(false);

  const handleParse = () => {
    setRows(parseCsv(pasted));
    setCommitted(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setPasted(text);
    setRows(parseCsv(text));
    setCommitted(false);
  };

  const validRows = rows.filter((r) => !r.error);
  const errorCount = rows.length - validRows.length;

  const commit = () => {
    if (!myCompany || validRows.length === 0) return;
    // Strategy: replace items that match by name (case-insensitive); add new.
    const byName = new Map<string, EquipmentItem>(
      equipmentItems
        .filter((i) => i.companyId === myCompany.id)
        .map((i) => [i.name.toLowerCase(), i]),
    );
    const updated: EquipmentItem[] = [];
    for (const r of validRows) {
      const existing = byName.get(r.name.toLowerCase());
      if (existing) {
        updated.push({
          ...existing,
          unitCount: r.unitCount,
          category: r.category ?? existing.category,
          defaultLocation: r.defaultLocation ?? existing.defaultLocation,
          manufacturer: r.manufacturer ?? existing.manufacturer,
          serialPrefix: r.serialPrefix ?? existing.serialPrefix,
        });
        byName.delete(r.name.toLowerCase());
      } else {
        updated.push({
          id: newId('ei'),
          companyId: myCompany.id,
          name: r.name,
          category: r.category,
          isConsumable: false,
          unitCount: r.unitCount,
          defaultLocation: r.defaultLocation,
          manufacturer: r.manufacturer,
          serialPrefix: r.serialPrefix,
        });
      }
    }
    // Preserve items that weren't in the CSV but exist for the company
    const untouched = [...byName.values()];
    // Preserve items belonging to other companies (multi-tenant safety)
    const otherCompanies = equipmentItems.filter((i) => i.companyId !== myCompany.id);
    setInventoryItems([...untouched, ...updated, ...otherCompanies]);
    setCommitted(true);
  };

  return (
    <Sheet open={open} onClose={onClose} title="ייבוא CSV — מלאי ציוד" size="lg">
      <div className="px-5 py-5 space-y-4">

        {committed ? (
          <div className="bg-mil-success-bg border border-mil-success-border rounded-xl-soft p-4 text-center">
            <p className="text-sm font-semibold text-mil-success">הייבוא הושלם</p>
            <p className="text-tiny text-mil-text mt-1">{validRows.length} פריטים נוספו / עודכנו</p>
            <Button variant="primary" size="md" onClick={onClose} className="mt-3">
              חזור למלאי
            </Button>
          </div>
        ) : (
          <>
            <div>
              <Hint className="block mb-1.5 font-semibold">פורמט הקובץ</Hint>
              <pre className="text-xxs font-mono bg-mil-bg-alt border border-mil-border rounded-xl-soft p-3 overflow-x-auto leading-snug">
{`name,category,unitCount,defaultLocation,manufacturer,serialPrefix
M16,נשק,140,מחסן רס״פ,IMI,
ווסט,הגנה,150,מחסן רס״פ,,VST-`}
              </pre>
            </div>

            <div>
              <Hint className="block mb-1.5 font-semibold">העלאת קובץ CSV</Hint>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="block w-full text-tiny text-mil-text file:bg-mil-olive-bg file:text-mil-olive file:font-semibold file:border-0 file:px-3 file:py-2 file:rounded-lg file:cursor-pointer"
              />
            </div>

            <div>
              <Hint className="block mb-1.5 font-semibold">או הדבק את התוכן</Hint>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={6}
                placeholder="הדבק כאן..."
                className="w-full bg-mil-bg-alt border border-mil-border rounded-xl-soft px-3.5 py-2.5 text-mil-text focus:outline-none focus:border-mil-olive focus:shadow-focus placeholder:text-mil-ghost text-tiny font-mono resize-none transition-all duration-200 ease-out-soft"
              />
              <Button variant="secondary" size="sm" onClick={handleParse} className="mt-2">
                נתח נתונים
              </Button>
            </div>

            {rows.length > 0 && (
              <div>
                <Hint className="block mb-1.5 font-semibold">תצוגה מקדימה</Hint>
                <div className="bg-mil-bg-alt border border-mil-border rounded-xl-soft max-h-64 overflow-y-auto divide-y divide-mil-border">
                  {rows.map((r, i) => (
                    <div key={i} className={`px-3.5 py-2 flex items-center gap-2 text-tiny ${r.error ? 'bg-mil-alert-bg' : ''}`}>
                      <span className="font-medium flex-1 truncate">{r.name || '—'}</span>
                      <span className="tabular-nums text-mil-muted">{r.unitCount}</span>
                      {r.error && <span className="text-mil-alert text-xxs">{r.error}</span>}
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-tiny text-mil-muted">
                  {validRows.length} שורות תקינות
                  {errorCount > 0 && <span className="text-mil-alert mr-2">· {errorCount} עם שגיאה</span>}
                </div>
                <Button variant="primary" size="lg" fullWidth onClick={commit} disabled={validRows.length === 0} className="mt-3">
                  ייבא {validRows.length} פריטים
                </Button>
              </div>
            )}

            {/* Backend-future hint */}
            <div className="bg-mil-info-bg border border-mil-info-border rounded-xl-soft px-3.5 py-2.5">
              <Body className="text-tiny text-mil-info leading-relaxed">
                ייבוא Excel מלא יפעל לאחר חיבור ל-Backend. כרגע פועל כייבוא CSV מקומי.
              </Body>
            </div>
          </>
        )}

      </div>
    </Sheet>
  );
}
