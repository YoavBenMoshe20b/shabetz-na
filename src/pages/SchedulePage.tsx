// שבצ"ק — the operational scheduling surface.
//
// Renamed from "סידור". Restructured around the OperationalOrder (צו) —
// the duty period the company is in. Each order owns a set of missions;
// the CC reads the order, edits missions, opens/closes them, etc.
//
// Replaces the legacy SchedulePeriod editor entirely. Mission authoring
// runs through the existing /missions/new wizard.

import { useMemo, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useApp, useMyCompany } from '../context/AppContext';
import { isCompanyLeadership, isPlatoonLeadership } from '../utils/permissions';
import Header from '../components/Header';
import { buildMissionSummary } from '../utils/missionSummary';
import { materializeWeek } from '../utils/materialize';
import type {
  Mission, OperationalOrder, OperationalOrderStatus,
} from '../types';
import {
  Section, PageMain, PageTitle, Body, Muted, Hint, Eyebrow, Button, Sheet,
} from '../components/ui';

export default function SchedulePage() {
  const navigate = useNavigate();
  const {
    currentUser, currentRole, missions, orders,
    platoons, squads, soldiers, leaves, dutyExclusions, assignments,
    addOrder, setOrderStatus, setMissionStatus,
  } = useApp();

  const isCC = isCompanyLeadership(currentRole);
  const isPC = isPlatoonLeadership(currentRole);

  // Hooks first; route gates after.
  const myCompany = useMyCompany();
  const myOrders = useMemo(
    () => orders
      .filter((o) => o.companyId === myCompany?.id)
      .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [orders, myCompany],
  );

  // Selected order — defaults to the first published (current) one.
  const defaultOrderId = myOrders.find((o) => o.status === 'published')?.id ?? myOrders[0]?.id ?? null;
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(defaultOrderId);

  const selectedOrder = myOrders.find((o) => o.id === selectedOrderId) ?? null;
  const orderMissions = useMemo(
    () => missions.filter((m) => m.companyId === myCompany?.id && m.orderId === selectedOrderId),
    [missions, myCompany, selectedOrderId],
  );

  const [addOrderOpen, setAddOrderOpen] = useState(false);

  // For the "current owner" column we materialize the week once.
  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const weekSlots = useMemo(() => materializeWeek({
    missions: orderMissions, platoons, squads, soldiers, leaves, dutyExclusions,
    startDay: todayStart, days: 7,
    assignments,
  }), [orderMissions, platoons, squads, soldiers, leaves, dutyExclusions, todayStart, assignments]);

  // Route gates AFTER all hooks.
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!isCC && !isPC) return <Navigate to="/home" replace />;

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="משימות ושבצ״ק" />
      <PageMain>

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <header>
          <Eyebrow>{myCompany?.unitName ?? ''} · {myCompany?.name ?? ''}</Eyebrow>
          <PageTitle className="mt-1.5">משימות ושבצ״ק</PageTitle>
          <Muted className="mt-1.5">
            {myOrders.length === 0 ? 'אין צו פעיל — צור צו חדש כדי להתחיל' :
              `${myOrders.length} צווים · ${orderMissions.length} משימות בצו הנבחר`}
          </Muted>
          {/* "פתח שבצ״ק מלא" — only PC has a per-platoon week grid; CC stays
              on the missions table (the master view). */}
          {isPC && (
            <button
              onClick={() => navigate('/platoon')}
              className="mt-3 inline-flex items-baseline gap-2 px-3.5 py-2 rounded-xl-soft bg-mil-olive-bg/70 hover:bg-mil-olive-bg text-mil-olive-dim hover:text-mil-olive text-tiny font-bold transition-colors"
            >
              פתח שבצ״ק מלא (תצוגה שבועית)
              <span aria-hidden>←</span>
            </button>
          )}
        </header>

        {/* ── Orders list ──────────────────────────────────────────── */}
        <Section
          label="צווים"
          action={isCC && (
            <button
              onClick={() => setAddOrderOpen(true)}
              className="text-tiny font-semibold text-mil-olive hover:text-mil-olive-dim"
            >
              + הוספת צו חדש
            </button>
          )}
        >
          {myOrders.length === 0 ? (
            <div className="bg-mil-card border border-mil-border rounded-2xl shadow-card py-10 text-center">
              <p className="text-sm font-semibold text-mil-text">אין צווים</p>
              <p className="text-tiny text-mil-muted mt-1">פתח צו חדש כדי להגדיר את משימות התקופה</p>
            </div>
          ) : (
            <div className="bg-mil-card border border-mil-border rounded-2xl shadow-card divide-y divide-mil-border overflow-hidden">
              {myOrders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  missionCount={missions.filter((m) => m.orderId === order.id).length}
                  isSelected={order.id === selectedOrderId}
                  onSelect={() => setSelectedOrderId(order.id)}
                />
              ))}
            </div>
          )}
        </Section>

        {/* ── Missions table for selected order ────────────────────── */}
        {selectedOrder && (
          <Section
            label={`משימות · ${selectedOrder.name}`}
            action={(
              <button
                onClick={() => navigate(`/missions/new?orderId=${selectedOrder.id}`)}
                className="text-tiny font-bold text-mil-olive-dim hover:text-mil-olive"
              >
                + הוסף משימה
              </button>
            )}
          >
            {orderMissions.length === 0 ? (
              <div className="bg-mil-card border border-mil-border rounded-2xl shadow-card py-10 text-center">
                <p className="text-sm font-semibold text-mil-text">אין משימות בצו זה</p>
                <p className="text-tiny text-mil-muted mt-1">הוסף משימות לצו כדי להתחיל בשיבוץ</p>
              </div>
            ) : (
              <div className="space-y-2">
                {orderMissions.map((mission) => {
                  const todayIso = new Date().toISOString().slice(0, 10);
                  const todaySlots = weekSlots.filter((s) => s.missionId === mission.id && s.start.slice(0, 10) === todayIso);
                  const currentOwners = Array.from(new Set(todaySlots.map((s) => s.ownerPlatoonId).filter(Boolean)))
                    .map((pid) => platoons.find((p) => p.id === pid)?.name)
                    .filter(Boolean) as string[];
                  return (
                    <MissionTableRow
                      key={mission.id}
                      mission={mission}
                      currentOwners={currentOwners}
                      todaySlotCount={todaySlots.length}
                      onOpen={() => navigate(`/mission/${mission.id}`)}
                      canToggle={isCC}
                      onToggleStatus={(s) => setMissionStatus(mission.id, s)}
                    />
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {/* ── Order admin (CC only) ────────────────────────────────── */}
        {isCC && selectedOrder && (
          <Section label="ניהול הצו">
            <div className="bg-mil-card border border-mil-border rounded-2xl px-5 py-4 space-y-2.5">
              <div className="flex items-baseline gap-3">
                <Body className="font-semibold">{selectedOrder.name}</Body>
                <Hint className="mr-auto">{formatRange(selectedOrder.startDate, selectedOrder.endDate)}</Hint>
              </div>
              {selectedOrder.description && <Muted className="text-tiny">{selectedOrder.description}</Muted>}
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-mil-border">
                <StatusChip active={selectedOrder.status === 'planning'}  onClick={() => setOrderStatus(selectedOrder.id, 'planning')}>תכנון</StatusChip>
                <StatusChip active={selectedOrder.status === 'published'} onClick={() => setOrderStatus(selectedOrder.id, 'published')}>פעיל</StatusChip>
                <StatusChip active={selectedOrder.status === 'archived'}  onClick={() => setOrderStatus(selectedOrder.id, 'archived')}>בארכיון</StatusChip>
              </div>
            </div>
          </Section>
        )}

      </PageMain>

      {addOrderOpen && myCompany && (
        <AddOrderModal
          companyId={myCompany.id}
          currentUserId={currentUser.id}
          onClose={() => setAddOrderOpen(false)}
          onSubmit={(data) => {
            const created = addOrder(data);
            setSelectedOrderId(created.id);
            setAddOrderOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Order row ────────────────────────────────────────────────────────────

function OrderRow({
  order, missionCount, isSelected, onSelect,
}: {
  order: OperationalOrder;
  missionCount: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const statusTone =
    order.status === 'published' ? 'bg-mil-success' :
    order.status === 'planning'  ? 'bg-mil-warn'    :
    'bg-mil-ghost';
  const statusLabel =
    order.status === 'published' ? 'פעיל' :
    order.status === 'planning'  ? 'תכנון' :
    'בארכיון';

  return (
    <button
      onClick={onSelect}
      className={`w-full text-right px-5 py-4 flex items-start gap-3.5 transition-all duration-200 ease-out-soft ${
        isSelected ? 'bg-mil-olive-bg/60' : 'hover:bg-mil-card-hover'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${statusTone} flex-shrink-0 mt-2 ring-4 ${isSelected ? 'ring-mil-olive-bg' : 'ring-mil-card'}`} aria-hidden />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <Body className="font-semibold truncate">{order.name}</Body>
          <span className="text-xxs font-semibold text-mil-muted tracking-wide uppercase">{statusLabel}</span>
        </div>
        <Muted className="mt-1 text-tiny">
          {formatRange(order.startDate, order.endDate)}
          <span className="text-mil-ghost mx-1.5">·</span>
          <span className="tabular-nums font-semibold text-mil-text">{missionCount}</span> משימות
        </Muted>
      </div>
      {isSelected && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-mil-olive mt-2 flex-shrink-0">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}

// ─── Mission table row — operational columns ─────────────────────────────

function MissionTableRow({
  mission, currentOwners, todaySlotCount, onOpen, canToggle, onToggleStatus,
}: {
  mission: Mission;
  currentOwners: string[];
  todaySlotCount: number;
  onOpen: () => void;
  canToggle: boolean;
  onToggleStatus: (s: Mission['status']) => void;
}) {
  const { platoons, qualifications, equipmentItems } = useApp();
  const summary = useMemo(() => buildMissionSummary({
    mission, platoons, qualifications, equipmentItems,
  }), [mission, platoons, qualifications, equipmentItems]);
  const timeLine = summary[1] ?? '';                                // time sentence
  const manpowerLine = summary[2] ?? '';
  const commandLine = summary[3] ?? '';

  const intensityTone =
    mission.fatigue.intensity === 'ambush'         ? 'bg-mil-warn'  :
    mission.fatigue.intensity === 'active-patrol'  ? 'bg-mil-olive' :
    mission.fatigue.intensity === 'standing-guard' ? 'bg-mil-olive-dim' :
    mission.fatigue.intensity === 'readiness'      ? 'bg-mil-ghost' :
    'bg-mil-olive-dim';

  const ownerLabel = (() => {
    const r = mission.rotation;
    if (r.kind === 'fixed-platoon') {
      const p = platoons.find((pp) => pp.id === r.platoonId);
      return p ? `קבועה — ${p.name}` : 'קבועה';
    }
    if (r.kind === 'rotate-platoons')    return 'סבב מחלקות';
    if (r.kind === 'rotate-squads')      return 'סבב כיתות';
    if (r.kind === 'whichever-strongest') return 'הכי רעננה';
    if (r.kind === 'returning-from-home') return 'שחזרה מהבית';
    return 'ידני';
  })();

  return (
    <div className="bg-mil-card border border-mil-border rounded-2xl flex overflow-hidden">
      <div className={`w-1 ${intensityTone} flex-shrink-0`} aria-hidden />
      <div className="flex-1 px-4 py-3.5">

        {/* Row header — name + status pill + open arrow */}
        <button onClick={onOpen} className="w-full text-right flex items-baseline gap-2 group">
          <Body className="font-semibold">{mission.name}</Body>
          <MissionStatusInline status={mission.status} />
          <Hint className="mr-auto text-mil-olive-dim group-hover:text-mil-olive">פתח →</Hint>
        </button>

        {/* Two-column operational table */}
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
          <Cell label="מאויש על ידי" value={ownerLabel} />
          <Cell label="כרגע אצל"      value={currentOwners.length > 0 ? currentOwners.join(' · ') : '—'} extra={todaySlotCount > 0 ? `${todaySlotCount} משמרות היום` : undefined} />
          <Cell label="שעות"           value={timeLine.replace(/^המשימה רצה /, '').replace(/\.$/, '')} />
          <Cell label="כוח אדם"        value={manpowerLine.replace(/^כל משמרת /, '').replace(/^מצבה /, '').replace(/\.$/, '')} />
          <Cell label="מפקד"            value={mission.command.fieldCommandRequired ? commandLine.replace(/\.$/, '').replace(/^דורש /, '') : 'לא נדרש'} />
          <Cell
            label="ציוד / כשירות"
            value={[
              ...mission.qualifications.map((q) => qualifications.find((x) => x.id === q.qualificationId)?.name).filter(Boolean),
              ...mission.equipment.map((e) => equipmentItems.find((x) => x.id === e.equipmentItemId)?.name).filter(Boolean),
            ].join(' · ') || '—'}
          />
        </div>

        {/* Logistics alerts ribbon */}
        {mission.logisticsAlerts && mission.logisticsAlerts.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-baseline gap-1.5">
            {mission.logisticsAlerts.map((alert, i) => (
              <span
                key={i}
                className={`inline-flex items-baseline gap-1.5 px-2.5 py-1 rounded-full text-tiny font-semibold ${
                  alert.urgency === 'high'   ? 'bg-mil-alert-bg text-mil-alert' :
                  alert.urgency === 'medium' ? 'bg-mil-warn-bg  text-mil-warn'  :
                  'bg-mil-card-warm text-mil-muted'
                }`}
              >
                <span>📡</span>
                <span>{alert.itemName} → רס״פ</span>
              </span>
            ))}
          </div>
        )}

        {/* Quick toggle row (CC) */}
        {canToggle && (
          <div className="mt-3 pt-3 border-t border-mil-border flex flex-wrap gap-1.5">
            <ToggleChip active={mission.status === 'active'}   onClick={() => onToggleStatus('active')}>פעילה</ToggleChip>
            <ToggleChip active={mission.status === 'paused'}   onClick={() => onToggleStatus('paused')}>סגורה</ToggleChip>
            <ToggleChip active={mission.status === 'draft'}    onClick={() => onToggleStatus('draft')}>טיוטה</ToggleChip>
            <ToggleChip active={mission.status === 'archived'} onClick={() => onToggleStatus('archived')}>בארכיון</ToggleChip>
          </div>
        )}
      </div>
    </div>
  );
}

function Cell({ label, value, extra }: { label: string; value: string; extra?: string }) {
  return (
    <div>
      <Hint className="block">{label}</Hint>
      <Body className="text-sm leading-tight">{value}</Body>
      {extra && <Hint className="block text-tiny text-mil-olive-dim">{extra}</Hint>}
    </div>
  );
}

function MissionStatusInline({ status }: { status: Mission['status'] }) {
  const tone =
    status === 'active'                 ? 'text-mil-success' :
    status === 'staffed'                ? 'text-mil-success' :
    status === 'partially-staffed'      ? 'text-mil-warn'    :
    status === 'active-unstaffed'       ? 'text-mil-alert'   :
    status === 'staffing-pending'       ? 'text-mil-warn'    :
    status === 'assigned-to-platoon'    ? 'text-mil-info'    :
    status === 'paused'                 ? 'text-mil-warn'    :
    'text-mil-ghost';
  const STATUS_LABELS: Record<Mission['status'], string> = {
    'draft':                'טיוטה',
    'active-unstaffed':     'ללא איוש',
    'assigned-to-platoon':  'שויכה למחלקה',
    'staffing-pending':     'באיוש',
    'active':               'פעילה',
    'staffed':              'מאוישת',
    'partially-staffed':    'מאוישת חלקית',
    'paused':               'סגורה',
    'archived':             'בארכיון',
  };
  return <Hint className={`${tone} font-bold`}>{STATUS_LABELS[status]}</Hint>;
}

function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-tiny font-bold transition-colors ${
        active ? 'bg-mil-olive text-white' : 'bg-mil-card border border-mil-border text-mil-muted hover:border-mil-olive'
      }`}
    >
      {children}
    </button>
  );
}

function StatusChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-bold transition-colors ${
        active ? 'bg-mil-olive text-white' : 'bg-mil-card border border-mil-border text-mil-muted hover:border-mil-olive'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Add-order modal ─────────────────────────────────────────────────────

function AddOrderModal({
  companyId, currentUserId, onClose, onSubmit,
}: {
  companyId: string;
  currentUserId: string;
  onClose: () => void;
  onSubmit: (data: Omit<OperationalOrder, 'id' | 'createdAt'>) => void;
}) {
  const today = new Date();
  const inOneWeek = new Date(today.getTime() + 7 * 86400000);
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);

  const [name,        setName]        = useState('');
  const [startDate,   setStartDate]   = useState(isoDate(today));
  const [endDate,     setEndDate]     = useState(isoDate(inOneWeek));
  const [description, setDescription] = useState('');

  // Auto-suggest a name from the range if empty.
  const effectiveName = name.trim() || `צו ${formatRange(startDate, endDate)}`;
  const canSubmit = startDate <= endDate;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      companyId,
      name: effectiveName,
      startDate,
      endDate,
      description: description.trim() || undefined,
      status: 'planning' as OperationalOrderStatus,
      createdByUserId: currentUserId,
    });
  };

  return (
    <Sheet open onClose={onClose} title="צו חדש">
      <div className="px-5 py-5 space-y-4">
        <div>
          <Hint className="block mb-1.5">שם הצו</Hint>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={effectiveName}
            className={inputCls}
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Hint className="block mb-1.5">תחילת הצו</Hint>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <Hint className="block mb-1.5">סוף הצו</Hint>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <Hint className="block mb-1.5">כוונת מפקד (אופציונלי)</Hint>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="גזרה, אופי המשימה, מיקוד מבצעי..."
            className={`${inputCls} resize-none`}
          />
        </div>
        <Button variant="primary" size="lg" fullWidth onClick={submit} disabled={!canSubmit}>
          פתח צו
        </Button>
      </div>
    </Sheet>
  );
}

const inputCls =
  'w-full bg-mil-bg-alt border border-mil-border rounded-xl-soft px-3.5 py-3 text-mil-text focus:outline-none focus:ring-2 focus:ring-mil-olive/40 focus:border-mil-olive placeholder:text-mil-ghost text-base transition-colors duration-200 ease-out-soft';

function formatRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return `${start} – ${end}`;
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const sameYear  = s.getFullYear() === e.getFullYear();
  const monthOf   = (d: Date) => MONTHS[d.getMonth()];
  if (sameMonth) return `${s.getDate()} – ${e.getDate()} ב${monthOf(e)}`;
  if (sameYear)  return `${s.getDate()} ב${monthOf(s)} – ${e.getDate()} ב${monthOf(e)}`;
  return `${s.getDate()}/${s.getMonth() + 1}/${s.getFullYear()} – ${e.getDate()}/${e.getMonth() + 1}/${e.getFullYear()}`;
}

const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
