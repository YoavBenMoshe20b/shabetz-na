// Equipment — per-soldier signed-gear ledger.
//
// Soldier-facing first surface. Shows every active SignedEquipment record
// for the viewing soldier: item · serial · who signed · source · status.
// Future: sign-in / transfer / lost-report workflows.

import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import type {
  SignedEquipment, SignedEquipmentCategory, SignedEquipmentStatus,
  EquipmentGapKind,
} from '../types';
import {
  Section, PageMain, PageTitle, Body, Muted, Hint, Button,
} from '../components/ui';

export default function EquipmentPage() {
  const { currentUser, soldiers, signedEquipment, equipmentGaps, reportEquipmentGap } = useApp();
  if (!currentUser) return <Navigate to="/login" replace />;

  const [reportOpen,  setReportOpen]  = useState(false);
  const [reportFor,   setReportFor]   = useState<SignedEquipment | null>(null);
  const [reportSaved, setReportSaved] = useState(false);

  const myProfile = useMemo(
    () => soldiers.find((s) => s.id === currentUser.soldierProfileId || s.userId === currentUser.id),
    [soldiers, currentUser],
  );

  const myEquipment = useMemo(() => {
    if (!myProfile) return [];
    return signedEquipment
      .filter((e) => e.soldierId === myProfile.id)
      .sort((a, b) => b.signedAt.localeCompare(a.signedAt));
  }, [signedEquipment, myProfile]);

  // Group by category for visual scan
  const byCategory = useMemo(() => {
    const groups: Record<SignedEquipmentCategory, SignedEquipment[]> = {
      weapon: [], optic: [], comms: [], protection: [],
      navigation: [], medical: [], misc: [],
    };
    for (const e of myEquipment) groups[e.category].push(e);
    return groups;
  }, [myEquipment]);

  const totalActive = myEquipment.filter((e) => e.status === 'active').length;

  // Gaps reported by this soldier (any status)
  const myGaps = useMemo(() => {
    if (!myProfile) return [];
    return equipmentGaps
      .filter((g) => g.reportedBySoldierId === myProfile.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [equipmentGaps, myProfile]);

  const handleSubmitReport = (data: { kind: EquipmentGapKind; itemName: string; description?: string }) => {
    if (!myProfile) return;
    reportEquipmentGap({
      soldierId:         myProfile.id,
      kind:              data.kind,
      itemName:          data.itemName,
      signedEquipmentId: reportFor?.id,
      description:       data.description,
    });
    setReportOpen(false);
    setReportFor(null);
    setReportSaved(true);
    setTimeout(() => setReportSaved(false), 3000);
  };

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="ציוד אישי" />
      <PageMain>

        <header>
          <Hint className="tracking-widest uppercase">{currentUser.name}</Hint>
          <PageTitle className="mt-1">ציוד חתום</PageTitle>
          <Muted className="mt-1.5 tabular-nums">{totalActive} פריטים פעילים</Muted>
        </header>

        {reportSaved && (
          <div className="bg-mil-success-bg border border-mil-success/40 rounded-xl px-4 py-3">
            <Body className="text-mil-success font-semibold">הדיווח נשלח לסמל המחלקה</Body>
          </div>
        )}

        {/* Gaps reported by this soldier */}
        {myGaps.length > 0 && (
          <Section label="דיווחים פתוחים">
            <div className="bg-mil-card border border-mil-border rounded-2xl divide-y divide-mil-border overflow-hidden">
              {myGaps.map((g) => (
                <div key={g.id} className="px-5 py-3">
                  <div className="flex items-baseline gap-2">
                    <Body className="font-semibold flex-1 truncate">{g.itemName}</Body>
                    <Hint className="text-mil-muted">{GAP_KIND_LABEL[g.kind]}</Hint>
                    <Hint className="text-mil-olive-dim font-bold">{GAP_STATUS_LABEL[g.status]}</Hint>
                  </div>
                  {g.description && <Muted className="mt-1 text-tiny">{g.description}</Muted>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {myEquipment.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-bold text-mil-olive-dim">אין ציוד חתום</p>
            <p className="text-tiny text-mil-muted mt-1">לא נחתם עליך ציוד עדיין</p>
          </div>
        ) : (
          <>
            {(Object.keys(byCategory) as SignedEquipmentCategory[]).map((cat) => {
              const items = byCategory[cat];
              if (items.length === 0) return null;
              return (
                <Section key={cat} label={CATEGORY_LABEL[cat]}>
                  <div className="bg-mil-card border border-mil-border rounded-2xl divide-y divide-mil-border overflow-hidden">
                    {items.map((e) => (
                      <EquipmentRow
                        key={e.id}
                        item={e}
                        onReport={() => { setReportFor(e); setReportOpen(true); }}
                      />
                    ))}
                  </div>
                </Section>
              );
            })}
          </>
        )}

        {/* Generic report (not tied to a specific item) */}
        <Button
          variant="ghost"
          size="lg"
          fullWidth
          onClick={() => { setReportFor(null); setReportOpen(true); }}
        >
          + דווח על ליקוי ציוד
        </Button>

      </PageMain>

      {reportOpen && (
        <ReportGapModal
          forItem={reportFor}
          onClose={() => { setReportOpen(false); setReportFor(null); }}
          onSubmit={handleSubmitReport}
        />
      )}
    </div>
  );
}

function EquipmentRow({ item, onReport }: { item: SignedEquipment; onReport: () => void }) {
  const dot =
    item.status === 'active'    ? 'bg-mil-olive' :
    item.status === 'in-repair' ? 'bg-mil-warn'  :
    item.status === 'lost'      ? 'bg-mil-alert' :
    'bg-mil-ghost';
  const dateLabel = (() => {
    const d = new Date(item.signedAt);
    if (isNaN(d.getTime())) return item.signedAt;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  })();

  return (
    <div className="px-5 py-3.5 flex items-start gap-3">
      <span className={`w-1.5 h-1.5 rounded-full ${dot} flex-shrink-0 mt-2`} aria-hidden />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <Body className="font-semibold truncate">{item.itemName}</Body>
          {item.serialNumber && (
            <span className="text-tiny font-mono tabular-nums text-mil-muted">{item.serialNumber}</span>
          )}
          <Hint className="mr-auto">{STATUS_LABEL[item.status]}</Hint>
        </div>
        <Muted className="mt-1 text-tiny">
          חתום על ידי {item.signedByName} · {item.source} · {dateLabel}
        </Muted>
        {item.notes && <Hint className="mt-1 block text-mil-muted">{item.notes}</Hint>}
        <button
          onClick={onReport}
          className="mt-2 text-tiny font-bold text-mil-olive-dim hover:text-mil-olive"
        >
          + דווח על ליקוי בפריט זה
        </button>
      </div>
    </div>
  );
}

// ─── Report-gap modal ──────────────────────────────────────────────────────

function ReportGapModal({
  forItem, onClose, onSubmit,
}: {
  forItem: SignedEquipment | null;
  onClose: () => void;
  onSubmit: (data: { kind: EquipmentGapKind; itemName: string; description?: string }) => void;
}) {
  const [kind, setKind] = useState<EquipmentGapKind>(forItem ? 'damaged' : 'missing');
  const [itemName, setItemName] = useState(forItem?.itemName ?? '');
  const [description, setDescription] = useState('');

  const submit = () => {
    if (!itemName.trim()) return;
    onSubmit({ kind, itemName: itemName.trim(), description: description.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center" dir="rtl">
      <div className="w-full max-w-md bg-mil-card rounded-t-2xl sm:rounded-2xl">
        <div className="bg-mil-olive rounded-t-2xl px-5 py-4 flex items-center gap-3">
          <button onClick={onClose} className="text-white/80 hover:text-white text-xl leading-none">✕</button>
          <h2 className="text-white font-bold flex-1">דיווח ליקוי ציוד</h2>
        </div>
        <div className="px-5 py-5 space-y-4">
          {forItem && (
            <div className="bg-mil-bg/50 rounded-xl px-3 py-2">
              <Hint className="text-tiny">פריט:</Hint>
              <Body className="font-semibold">{forItem.itemName}</Body>
              {forItem.serialNumber && <Hint className="text-tiny font-mono tabular-nums">{forItem.serialNumber}</Hint>}
            </div>
          )}

          <div>
            <Hint className="block mb-1.5">סוג הדיווח</Hint>
            <div className="flex gap-1.5 flex-wrap">
              {(['missing','damaged','logistics-issue'] as EquipmentGapKind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                    kind === k ? 'bg-mil-text text-mil-card' : 'bg-mil-card border border-mil-border text-mil-muted hover:border-mil-olive'
                  }`}
                >
                  {GAP_KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>

          {!forItem && (
            <div>
              <Hint className="block mb-1.5">פריט</Hint>
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="לדוגמה: ווסט / מכשיר קשר"
                className="w-full bg-mil-bg border border-mil-border rounded-xl px-3 py-3 text-mil-text focus:outline-none focus:ring-2 focus:ring-mil-olive/30 focus:border-mil-olive placeholder:text-mil-ghost text-base"
              />
            </div>
          )}

          <div>
            <Hint className="block mb-1.5">תיאור</Hint>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="פרט במה הליקוי..."
              className="w-full bg-mil-bg border border-mil-border rounded-xl px-3 py-3 text-mil-text focus:outline-none focus:ring-2 focus:ring-mil-olive/30 focus:border-mil-olive placeholder:text-mil-ghost text-base resize-none"
            />
          </div>

          <button
            onClick={submit}
            disabled={!itemName.trim()}
            className="w-full bg-mil-olive hover:bg-mil-olive-light disabled:opacity-40 text-white font-bold py-4 rounded-xl text-base transition-colors"
          >
            שלח לסמל המחלקה
          </button>
        </div>
      </div>
    </div>
  );
}

const CATEGORY_LABEL: Record<SignedEquipmentCategory, string> = {
  weapon:     'נשק',
  optic:      'אופטיקה',
  comms:      'תקשורת',
  protection: 'הגנה',
  navigation: 'ניווט',
  medical:    'רפואה',
  misc:       'ציוד נוסף',
};

const STATUS_LABEL: Record<SignedEquipmentStatus, string> = {
  active:    'פעיל',
  returned:  'הוחזר',
  lost:      'אבד',
  'in-repair': 'בתיקון',
};

const GAP_KIND_LABEL: Record<EquipmentGapKind, string> = {
  missing:           'חסר',
  damaged:           'שבור',
  'logistics-issue': 'בעיה לוגיסטית',
};

const GAP_STATUS_LABEL: Record<string, string> = {
  reported:              'דווח · ממתין',
  'reviewed-by-platoon': 'נצפה ע״י המחלקה',
  'forwarded-to-rasap':  'הועבר לרס״פ',
  resolved:              'נסגר · טופל',
  dismissed:             'נסגר · נדחה',
};
