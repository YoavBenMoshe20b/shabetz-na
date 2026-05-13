// Rasap Dashboard — logistics command surface.
//
// Reads as the operational center for everything equipment-related:
//   1. Hero KPIs — total inventory, deployed, in-repair, open gaps
//   2. Open damage queue — gaps awaiting attention
//   3. Per-platoon damage rollup — where bills are accumulating
//   4. Recent lifecycle activity
//   5. Quick actions — sign-out + view inventory + import CSV
//
// Scope: CC/Deputy + soldiers carrying the Rasap role. Anyone else hits
// the route gate and is redirected.

import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp, useMyCompany } from '../context/AppContext';
import { canManageEquipment, canViewInventory } from '../utils/permissions';
import Header from '../components/Header';
import SignOutSheet from '../components/SignOutSheet';
import DamageReportSheet from '../components/DamageReportSheet';
import {
  Eyebrow, Section, PageMain, Body, Hint, Button, EmptyState,
} from '../components/ui';
import type { EquipmentGap, SignedEquipment } from '../types';

const STATUS_LABEL: Record<EquipmentGap['status'], string> = {
  reported:              'דווח',
  'reviewed-by-platoon': 'נראה ע״י מ״מ',
  'forwarded-to-rasap':  'הועבר לרס״פ',
  resolved:              'טופל',
  dismissed:             'נדחה',
};

const STATUS_TONE: Record<EquipmentGap['status'], string> = {
  reported:              'text-mil-warn  bg-mil-warn-bg  border-mil-warn-border',
  'reviewed-by-platoon': 'text-mil-info  bg-mil-info-bg  border-mil-info-border',
  'forwarded-to-rasap':  'text-mil-alert bg-mil-alert-bg border-mil-alert-border',
  resolved:              'text-mil-success bg-mil-success-bg border-mil-success-border',
  dismissed:             'text-mil-muted bg-mil-bg-alt    border-mil-border',
};

export default function RasapPage() {
  const navigate = useNavigate();
  const {
    currentUser, delegations,
    signedEquipment, equipmentGaps, equipmentItems, platoons, soldiers,
    resolveEquipmentGap, dismissEquipmentGap,
  } = useApp();
  const myCompany = useMyCompany();

  // Hooks first, gates after.
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [damageOpen,  setDamageOpen]  = useState(false);

  const companySigned = useMemo(
    () => signedEquipment.filter((s) => s.companyId === myCompany?.id),
    [signedEquipment, myCompany],
  );
  const companyItems = useMemo(
    () => equipmentItems.filter((i) => i.companyId === myCompany?.id),
    [equipmentItems, myCompany],
  );
  const companyGaps = useMemo(
    () => equipmentGaps.filter((g) => g.companyId === myCompany?.id),
    [equipmentGaps, myCompany],
  );

  // KPIs
  const kpi = useMemo(() => {
    const inventory = companyItems.reduce((acc, i) => acc + (i.unitCount ?? 0), 0);
    const deployed  = companySigned.filter((s) => s.status === 'active').length;
    const inRepair  = companySigned.filter((s) => s.status === 'in-repair').length;
    const openGaps  = companyGaps.filter((g) => g.status === 'reported' || g.status === 'reviewed-by-platoon' || g.status === 'forwarded-to-rasap').length;
    return { inventory, deployed, inRepair, openGaps };
  }, [companyItems, companySigned, companyGaps]);

  // Per-platoon damage rollup
  const perPlatoonDamage = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of companyGaps) {
      if (g.status === 'resolved' || g.status === 'dismissed') continue;
      const pid = g.reportedByPlatoonId;
      if (!pid) continue;
      map.set(pid, (map.get(pid) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([pid, count]) => ({
        platoon: platoons.find((p) => p.id === pid),
        count,
      }))
      .filter((r) => r.platoon)
      .sort((a, b) => b.count - a.count);
  }, [companyGaps, platoons]);

  // Open queue — sorted reverse-chronologically
  const openQueue = useMemo(
    () => companyGaps
      .filter((g) => g.status === 'reported' || g.status === 'reviewed-by-platoon' || g.status === 'forwarded-to-rasap')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [companyGaps],
  );

  // Permission gates — placed after hooks.
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!canManageEquipment(currentUser, delegations) && !canViewInventory(currentUser, delegations)) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="לוגיסטיקה ורס״פ" />
      <PageMain>

        <section className="bg-mil-card border border-mil-border rounded-2xl-soft shadow-hero p-6">
          <Eyebrow>{myCompany?.name ?? '—'}</Eyebrow>
          <h1 className="text-hero font-extrabold text-mil-text tracking-tightish mt-1.5">לוגיסטיקה ורס״פ</h1>
          <Body className="mt-1.5 text-mil-muted text-sm">
            מרכז לוגיסטי של הפלוגה — מלאי, החתמות, ליקויים.
          </Body>

          <div className="mt-5 grid grid-cols-4 gap-2.5">
            <RasapKpi label="במלאי" value={kpi.inventory} />
            <RasapKpi label="חתום" value={kpi.deployed} tone="success" />
            <RasapKpi label="בתיקון" value={kpi.inRepair} tone="warn" muted={kpi.inRepair === 0} />
            <RasapKpi label="ליקויים" value={kpi.openGaps} tone="alert" muted={kpi.openGaps === 0} />
          </div>

          {canManageEquipment(currentUser, delegations) && (
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button variant="primary" size="md" onClick={() => setSignOutOpen(true)}>
                + החתמת ציוד
              </Button>
              <Button variant="secondary" size="md" onClick={() => setDamageOpen(true)}>
                דווח בלאי
              </Button>
            </div>
          )}
        </section>

        <Section
          label={`תור ליקויים · ${openQueue.length}`}
          action={openQueue.length > 0 && (
            <button
              onClick={() => navigate('/equipment/inventory')}
              className="text-tiny font-semibold text-mil-olive hover:text-mil-olive-dim"
            >
              מלאי מלא ←
            </button>
          )}
        >
          {openQueue.length === 0 ? (
            <EmptyState title="אין ליקויים פתוחים" hint="כל הציוד תקין כרגע." />
          ) : (
            <div className="space-y-2">
              {openQueue.map((g) => (
                <GapRow
                  key={g.id}
                  gap={g}
                  soldierName={soldiers.find((s) => s.id === g.reportedBySoldierId)?.name ?? g.reportedByName}
                  platoonName={platoons.find((p) => p.id === g.reportedByPlatoonId)?.name}
                  onResolve={() => resolveEquipmentGap(g.id, 'טופל ע״י רס״פ')}
                  onDismiss={() => dismissEquipmentGap(g.id, 'נסגר ע״י רס״פ')}
                />
              ))}
            </div>
          )}
        </Section>

        {perPlatoonDamage.length > 0 && (
          <Section label="פגיעות פעילות לפי מחלקה">
            <div className="bg-mil-card border border-mil-border rounded-2xl shadow-card divide-y divide-mil-border overflow-hidden">
              {perPlatoonDamage.map(({ platoon, count }) => (
                <div key={platoon!.id} className="px-5 py-3.5 flex items-center gap-3">
                  <Body className="font-semibold flex-1">{platoon!.name}</Body>
                  <span className="tabular-nums font-bold text-mil-alert">{count}</span>
                  <span className="text-tiny text-mil-muted">פתוחים</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section label="ציוד חתום באופן פעיל">
          {companySigned.filter((s) => s.status === 'active').length === 0 ? (
            <EmptyState title="אין ציוד חתום" hint="לחץ + להחתמה ראשונה." />
          ) : (
            <div className="bg-mil-card border border-mil-border rounded-2xl shadow-card divide-y divide-mil-border overflow-hidden">
              {companySigned
                .filter((s) => s.status === 'active')
                .slice(0, 10)
                .map((se) => (
                  <SignedRow
                    key={se.id}
                    item={se}
                    soldierName={soldiers.find((s) => s.id === se.soldierId)?.name ?? '—'}
                    onClick={() => navigate('/equipment/inventory')}
                  />
                ))}
              {companySigned.filter((s) => s.status === 'active').length > 10 && (
                <button
                  onClick={() => navigate('/equipment/inventory')}
                  className="w-full px-5 py-3 text-tiny font-semibold text-mil-olive hover:bg-mil-card-hover transition-colors"
                >
                  הצג הכל ({companySigned.filter((s) => s.status === 'active').length}) ←
                </button>
              )}
            </div>
          )}
        </Section>

        <Section label="ניווט">
          <div className="grid grid-cols-1 gap-2.5">
            <button
              onClick={() => navigate('/equipment/inventory')}
              className="bg-mil-card border border-mil-border rounded-xl-soft shadow-card hover:shadow-card-hover hover:border-mil-border-strong transition-all duration-200 ease-out-soft px-5 py-4 flex items-center gap-3.5 text-right"
            >
              <span className="w-9 h-9 rounded-xl-soft bg-mil-olive-bg text-mil-olive flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 7l8-4 8 4M4 7v10l8 4 8-4V7M4 7l8 4 8-4M12 11v10" />
                </svg>
              </span>
              <div className="flex-1 min-w-0">
                <Body className="font-semibold leading-tight">מלאי ציוד</Body>
                <Hint className="block mt-0.5 text-mil-muted">קטלוג מלא, מיקומים, חתימות</Hint>
              </div>
              <span className="text-mil-ghost">←</span>
            </button>
          </div>
        </Section>

      </PageMain>

      {signOutOpen && <SignOutSheet open onClose={() => setSignOutOpen(false)} />}
      {damageOpen  && <DamageReportSheet open onClose={() => setDamageOpen(false)} />}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function RasapKpi({
  label, value, tone = 'neutral', muted = false,
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'success' | 'warn' | 'alert';
  muted?: boolean;
}) {
  const toneClass = {
    neutral:  'text-mil-text',
    success:  'text-mil-success',
    warn:     'text-mil-warn',
    alert:    'text-mil-alert',
  }[tone];
  return (
    <div className="bg-mil-bg-alt/70 border border-mil-border/70 rounded-xl-soft px-3 py-3">
      <span className={`text-2xl font-bold tabular-nums tracking-tightish ${muted ? 'text-mil-ghost' : toneClass}`}>
        {value}
      </span>
      <Hint className="block text-tiny font-medium text-mil-muted mt-0.5">{label}</Hint>
    </div>
  );
}

function GapRow({
  gap, soldierName, platoonName, onResolve, onDismiss,
}: {
  gap: EquipmentGap;
  soldierName: string;
  platoonName?: string;
  onResolve: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="bg-mil-card border border-mil-border rounded-xl-soft shadow-card p-4">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={`inline-flex items-center text-xxs font-semibold px-2 py-0.5 rounded-md border ${STATUS_TONE[gap.status]}`}>
          {STATUS_LABEL[gap.status]}
        </span>
        <Body className="font-semibold flex-1">{gap.itemName}</Body>
      </div>
      {gap.description && (
        <p className="mt-2 text-tiny text-mil-text leading-relaxed">{gap.description}</p>
      )}
      <div className="mt-2 flex items-baseline gap-1.5 text-tiny text-mil-muted flex-wrap">
        <span>{soldierName}</span>
        {platoonName && (
          <>
            <span className="text-mil-ghost">·</span>
            <span>{platoonName}</span>
          </>
        )}
        <span className="text-mil-ghost">·</span>
        <span className="tabular-nums">{gap.createdAt.slice(0, 10)}</span>
      </div>
      {gap.status !== 'resolved' && gap.status !== 'dismissed' && (
        <div className="mt-3 flex gap-2">
          <Button variant="primary" size="sm" onClick={onResolve}>טופל</Button>
          <Button variant="quiet"   size="sm" onClick={onDismiss}>סגור ללא טיפול</Button>
        </div>
      )}
    </div>
  );
}

function SignedRow({ item, soldierName, onClick }: {
  item: SignedEquipment;
  soldierName: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-right px-5 py-3 flex items-center gap-3 hover:bg-mil-card-hover transition-colors duration-200 ease-out-soft"
    >
      <div className="flex-1 min-w-0">
        <Body className="font-semibold truncate">{item.itemName}</Body>
        <Hint className="text-tiny text-mil-muted mt-0.5">
          {soldierName}
          {item.serialNumber && ` · ${item.serialNumber}`}
        </Hint>
      </div>
      <span className="text-mil-ghost">←</span>
    </button>
  );
}
