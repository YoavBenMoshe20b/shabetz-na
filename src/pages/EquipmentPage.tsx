// Equipment — per-soldier signed-gear ledger.
//
// Soldier-facing first surface. Shows every active SignedEquipment record
// for the viewing soldier: item · serial · who signed · source · status.
// Future: sign-in / transfer / lost-report workflows.

import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import type { SignedEquipment, SignedEquipmentCategory, SignedEquipmentStatus } from '../types';
import {
  Section, PageMain, PageTitle, Body, Muted, Hint,
} from '../components/ui';

export default function EquipmentPage() {
  const { currentUser, soldiers, signedEquipment } = useApp();
  if (!currentUser) return <Navigate to="/login" replace />;

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

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="ציוד אישי" />
      <PageMain>

        <header>
          <Hint className="tracking-widest uppercase">{currentUser.name}</Hint>
          <PageTitle className="mt-1">ציוד חתום</PageTitle>
          <Muted className="mt-1.5 tabular-nums">{totalActive} פריטים פעילים</Muted>
        </header>

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
                    {items.map((e) => <EquipmentRow key={e.id} item={e} />)}
                  </div>
                </Section>
              );
            })}
          </>
        )}

      </PageMain>
    </div>
  );
}

function EquipmentRow({ item }: { item: SignedEquipment }) {
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
