// Equipment Inventory — full ledger surface.
//
// Two tabs:
//   • קטלוג — the company's EquipmentItem inventory
//   • חתום — every active SignedEquipment with the holder soldier
//
// Filters: search by name/serial, status, category.
// Actions (Rasap-only):
//   • + פריט (catalog page)
//   • החתם (per-item drill-in from catalog)
//   • קלוט (return) per signed row
//   • ייבוא CSV
//
// Scale: pre-indexed for ~1000 rows. For larger inventories the same
// search/filter pipeline ports to a server endpoint.

import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp, useMyCompany } from '../context/AppContext';
import { canManageEquipment, canViewInventory } from '../utils/permissions';
import Header from '../components/Header';
import SignOutSheet from '../components/SignOutSheet';
import ReturnEquipmentSheet from '../components/ReturnEquipmentSheet';
import CsvImportSheet from '../components/CsvImportSheet';
import {
  Eyebrow, PageMain, Body, Muted, Hint, Button, Segment, EmptyState,
} from '../components/ui';
import { CollapsibleSection } from '../components/ui/Section';
import type {
  SignedEquipment, EquipmentItem, SignedEquipmentStatus, SignedEquipmentCategory,
} from '../types';

// §8-§9 — canonical category buckets used for the signed list. Hebrew
// labels keep the surface readable for operators; misc catches anything
// that doesn't fit a canonical bucket.
const SIGNED_CATEGORY_LABEL: Record<SignedEquipmentCategory, string> = {
  weapon:     'נשק',
  optic:      'אופטיקה',
  comms:      'תקשורת',
  protection: 'הגנה',
  navigation: 'ניווט',
  medical:    'רפואה',
  misc:       'ציוד נוסף',
};

// Canonical category ordering. We render in this order regardless of
// data, so the operator always finds the same bucket in the same place.
const SIGNED_CATEGORY_ORDER: SignedEquipmentCategory[] = [
  'weapon', 'optic', 'comms', 'protection', 'navigation', 'medical', 'misc',
];

const UNCATEGORIZED = 'ללא קטגוריה';

const STATUS_LABEL: Record<SignedEquipmentStatus, string> = {
  active:      'חתום',
  returned:    'הוחזר',
  lost:        'אבד',
  'in-repair': 'בתיקון',
};

const STATUS_TONE: Record<SignedEquipmentStatus, string> = {
  active:      'text-mil-success bg-mil-success-bg border-mil-success-border',
  returned:    'text-mil-muted   bg-mil-bg-alt    border-mil-border',
  lost:        'text-mil-alert   bg-mil-alert-bg  border-mil-alert-border',
  'in-repair': 'text-mil-warn    bg-mil-warn-bg   border-mil-warn-border',
};

type Tab = 'catalog' | 'signed';

export default function EquipmentInventoryPage() {
  const navigate = useNavigate();
  const {
    currentUser, delegations,
    equipmentItems, signedEquipment, soldiers,
  } = useApp();
  const myCompany = useMyCompany();

  const [tab, setTab] = useState<Tab>('catalog');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SignedEquipmentStatus>('all');
  const [signOutFor, setSignOutFor] = useState<EquipmentItem | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [returnItem, setReturnItem] = useState<SignedEquipment | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  // §8-§9 — accordion state per tab. Empty = all collapsed.
  // We track explicit open keys (not a "closed" set) because the default
  // is collapsed; expanding ~7 categories at once would defeat the point
  // of the accordion (scanability).
  const [catalogOpen, setCatalogOpen] = useState<Set<string>>(new Set());
  const [signedOpen,  setSignedOpen]  = useState<Set<string>>(new Set());

  const items = useMemo(() => {
    const q = search.trim();
    return equipmentItems
      .filter((i) => i.companyId === myCompany?.id)
      .filter((i) => !q || i.name.includes(q) || (i.category ?? '').includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'he'));
  }, [equipmentItems, myCompany, search]);

  const signed = useMemo(() => {
    const q = search.trim();
    return signedEquipment
      .filter((s) => s.companyId === myCompany?.id)
      .filter((s) => statusFilter === 'all' ? true : s.status === statusFilter)
      .filter((s) => {
        if (!q) return true;
        if (s.itemName.includes(q)) return true;
        if (s.serialNumber?.includes(q)) return true;
        const holder = soldiers.find((sx) => sx.id === s.soldierId);
        return !!holder && holder.name.includes(q);
      })
      .sort((a, b) => b.signedAt.localeCompare(a.signedAt));
  }, [signedEquipment, myCompany, statusFilter, search, soldiers]);

  // §8-§9 — group catalog by free-text category (the field operators
  // actually typed in). Items with no category fall into UNCATEGORIZED.
  const catalogGroups = useMemo(() => {
    const groups = new Map<string, EquipmentItem[]>();
    for (const i of items) {
      const key = (i.category ?? '').trim() || UNCATEGORIZED;
      const arr = groups.get(key) ?? [];
      arr.push(i);
      groups.set(key, arr);
    }
    // Stable alpha order; UNCATEGORIZED always last.
    return [...groups.entries()].sort((a, b) => {
      if (a[0] === UNCATEGORIZED) return 1;
      if (b[0] === UNCATEGORIZED) return -1;
      return a[0].localeCompare(b[0], 'he');
    });
  }, [items]);

  // §8-§9 — group signed list by canonical SignedEquipmentCategory enum.
  const signedGroups = useMemo(() => {
    const groups: Record<SignedEquipmentCategory, SignedEquipment[]> = {
      weapon: [], optic: [], comms: [], protection: [],
      navigation: [], medical: [], misc: [],
    };
    for (const s of signed) groups[s.category].push(s);
    return SIGNED_CATEGORY_ORDER
      .map((k) => [k, groups[k]] as const)
      .filter(([, arr]) => arr.length > 0);
  }, [signed]);

  // When the operator has typed a search query, force every group open
  // so results aren't hidden behind collapsed headers. The toggle state
  // is preserved for when search clears.
  const searchActive = search.trim().length > 0;
  const isCatalogOpen = (key: string) => searchActive || catalogOpen.has(key);
  const isSignedOpen  = (key: string) => searchActive || signedOpen.has(key);
  const toggleCatalog = (key: string) => setCatalogOpen((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const toggleSigned = (key: string) => setSignedOpen((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  if (!currentUser) return <Navigate to="/login" replace />;
  if (!canViewInventory(currentUser, delegations)) return <Navigate to="/home" replace />;

  const canManage = canManageEquipment(currentUser, delegations);

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="מלאי ציוד" />
      <PageMain>

        <section className="bg-mil-card border border-mil-border rounded-2xl-soft shadow-hero p-6">
          <Eyebrow>{myCompany?.name ?? '—'}</Eyebrow>
          <h1 className="text-hero font-extrabold text-mil-text tracking-tightish mt-1.5">
            מלאי ציוד
          </h1>
          <Body className="mt-1.5 text-mil-muted text-sm">
            קטלוג הציוד הפלוגתי, חתימות חיים, ומעקב מצב.
          </Body>

          {canManage && (
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button variant="primary" size="md" onClick={() => navigate('/rasap')}>
                ← לוח רס״פ
              </Button>
              <Button variant="secondary" size="md" onClick={() => setCsvOpen(true)}>
                ייבוא CSV
              </Button>
            </div>
          )}
        </section>

        <Segment
          value={tab}
          onChange={setTab}
          fullWidth
          options={[
            { value: 'catalog', label: `קטלוג · ${items.length}` },
            { value: 'signed',  label: `חתום · ${signed.length}` },
          ]}
        />

        <div className="space-y-2.5">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש פריט / חייל / מס׳ סידורי…"
            className="w-full bg-mil-card border border-mil-border rounded-xl-soft px-3.5 py-2.5 text-mil-text focus:outline-none focus:border-mil-olive focus:shadow-focus placeholder:text-mil-ghost text-sm transition-all duration-200 ease-out-soft"
          />
          {tab === 'signed' && (
            <Segment
              value={statusFilter}
              onChange={setStatusFilter}
              fullWidth
              options={[
                { value: 'all',        label: 'הכל' },
                { value: 'active',     label: 'חתום' },
                { value: 'in-repair',  label: 'בתיקון' },
                { value: 'returned',   label: 'הוחזר' },
                { value: 'lost',       label: 'אבד' },
              ]}
            />
          )}
        </div>

        {tab === 'catalog' ? (
          items.length === 0 ? (
            <EmptyState
              title={search ? 'לא נמצאו פריטים תואמים' : 'אין פריטים בקטלוג'}
              hint={search ? 'נקה את החיפוש' : canManage ? 'ייבא CSV או צור פריטים בעת החתמה' : ''}
            />
          ) : (
            // §8-§9 — accordion by category. Header shows count;
            // body renders rows. Operator scans bucket → expands → acts.
            <div className="space-y-2">
              {catalogGroups.map(([cat, group]) => (
                <CollapsibleSection
                  key={cat}
                  label={cat}
                  count={group.length}
                  open={isCatalogOpen(cat)}
                  onToggle={() => toggleCatalog(cat)}
                >
                  <div className="bg-mil-card border border-mil-border rounded-2xl shadow-card divide-y divide-mil-border overflow-hidden">
                    {group.map((i) => {
                      const deployed = signedEquipment.filter((s) =>
                        s.companyId === myCompany?.id && s.equipmentItemId === i.id && s.status === 'active',
                      ).length;
                      return (
                        <div key={i.id} className="px-5 py-3.5 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <Body className="font-semibold truncate">{i.name}</Body>
                            <Hint className="text-mil-muted text-tiny mt-0.5">
                              {i.defaultLocation ?? 'מחסן רס״פ'}
                            </Hint>
                          </div>
                          <div className="text-left">
                            <Hint className="text-xxs uppercase tracking-wide text-mil-muted">חתום</Hint>
                            <p className="text-base font-bold tabular-nums text-mil-text">
                              <span className="text-mil-olive">{deployed}</span>
                              <span className="text-mil-ghost">/{i.unitCount}</span>
                            </p>
                          </div>
                          {canManage && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => { setSignOutFor(i); setSignOutOpen(true); }}
                            >
                              החתם
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleSection>
              ))}
            </div>
          )
        ) : signed.length === 0 ? (
          <EmptyState
            title="אין ציוד חתום תואם"
            hint="נסה לשנות את סינון הסטטוס או החיפוש"
          />
        ) : (
          // §8-§9 — canonical category accordions. A 2000-row flat list
          // is unreadable; bucketed it tells the operator which class of
          // equipment is sitting where without forcing a scroll-hunt.
          <div className="space-y-2">
            {signedGroups.map(([cat, group]) => (
              <CollapsibleSection
                key={cat}
                label={SIGNED_CATEGORY_LABEL[cat]}
                count={group.length}
                open={isSignedOpen(cat)}
                onToggle={() => toggleSigned(cat)}
              >
                <div className="space-y-2">
                  {group.map((se) => (
                    <SignedItemCard
                      key={se.id}
                      item={se}
                      soldierName={soldiers.find((s) => s.id === se.soldierId)?.name ?? '—'}
                      onReturn={() => setReturnItem(se)}
                      canManage={canManage}
                    />
                  ))}
                </div>
              </CollapsibleSection>
            ))}
          </div>
        )}

      </PageMain>

      {signOutOpen && (
        <SignOutSheet
          open
          onClose={() => { setSignOutOpen(false); setSignOutFor(null); }}
          // Sheet uses its own catalog selector — we don't pre-fill an item here,
          // but the operator already knows what they wanted via signOutFor.
        />
      )}
      {returnItem && (
        <ReturnEquipmentSheet
          open
          onClose={() => setReturnItem(null)}
          item={returnItem}
        />
      )}
      {csvOpen && <CsvImportSheet open onClose={() => setCsvOpen(false)} />}

      {/* signOutFor is read by the SignOutSheet composer in a future pass
          when we wire pre-selected item ids through. Until then we keep
          the state hook so the catalog → sheet handoff is in place. */}
      <span hidden>{signOutFor?.id}</span>
    </div>
  );
}

function SignedItemCard({ item, soldierName, onReturn, canManage }: {
  item: SignedEquipment;
  soldierName: string;
  onReturn: () => void;
  canManage: boolean;
}) {
  return (
    <div className="bg-mil-card border border-mil-border rounded-xl-soft shadow-card p-4">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={`inline-flex items-center text-xxs font-semibold px-2 py-0.5 rounded-md border ${STATUS_TONE[item.status]}`}>
          {STATUS_LABEL[item.status]}
        </span>
        <Body className="font-semibold flex-1 truncate">{item.itemName}</Body>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5 text-tiny text-mil-muted flex-wrap">
        <span>{soldierName}</span>
        {item.serialNumber && (
          <>
            <span className="text-mil-ghost">·</span>
            <span className="tabular-nums">{item.serialNumber}</span>
          </>
        )}
        {item.currentLocation && (
          <>
            <span className="text-mil-ghost">·</span>
            <span>{item.currentLocation}</span>
          </>
        )}
        {item.condition && (
          <>
            <span className="text-mil-ghost">·</span>
            <span className="font-medium">
              {item.condition === 'new' ? 'חדש' :
               item.condition === 'good' ? 'תקין' :
               item.condition === 'worn' ? 'בלאי קל' :
               item.condition === 'damaged' ? 'פגום' :
               'לא שמיש'}
            </span>
          </>
        )}
      </div>
      {item.notes && <Muted className="mt-2 text-tiny">{item.notes}</Muted>}
      {canManage && item.status === 'active' && (
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" size="sm" onClick={onReturn}>קלוט החזרה</Button>
        </div>
      )}
    </div>
  );
}
