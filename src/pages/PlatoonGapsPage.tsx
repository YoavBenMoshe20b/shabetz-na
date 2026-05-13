// Platoon equipment gap list — PC/PS review surface.
//
// Soldiers submit gap reports from /equipment. They land here under the
// soldier's platoon. The PC/PS can:
//
//   reviewEquipmentGap   — acknowledge into the platoon list
//   forwardEquipmentGap  — push up to רס״פ
//   resolveEquipmentGap  — close as handled
//   dismissEquipmentGap  — close without action
//
// The pipeline is one-way (no reverts here); a future slice can add
// re-open / reassign actions.

import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { isPlatoonLeadership } from '../utils/permissions';
import Header from '../components/Header';
import type { EquipmentGap, EquipmentGapKind, EquipmentGapStatus } from '../types';
import {
  Eyebrow, Section, PageMain, PageTitle, Body, Muted, Hint, StatusPill, Button,
} from '../components/ui';

export default function PlatoonGapsPage() {
  const {
    currentRole, currentUser, equipmentGaps, platoons, squads, soldiers,
    reviewEquipmentGap, forwardEquipmentGap, resolveEquipmentGap, dismissEquipmentGap,
  } = useApp();

  if (!currentUser) return <Navigate to="/login" replace />;
  if (!isPlatoonLeadership(currentRole)) return <Navigate to="/home" replace />;

  const myPlatoon = useMemo(
    () => platoons.find((p) => p.id === currentUser.commandedPlatoonId)
       ?? platoons.find((p) => p.memberIds.includes(currentUser.id)),
    [platoons, currentUser],
  );

  // Filter to this platoon's gaps. Reporter's platoon link is on the gap
  // (reportedByPlatoonId), but we double-check via soldier.squadId →
  // squad.platoonId for legacy reports.
  const myGaps = useMemo(() => {
    if (!myPlatoon) return [];
    const platoonSquadIds = new Set(squads.filter((s) => s.platoonId === myPlatoon.id).map((s) => s.id));
    return equipmentGaps
      .filter((g) => {
        if (g.reportedByPlatoonId === myPlatoon.id) return true;
        const reporter = soldiers.find((s) => s.id === g.reportedBySoldierId);
        return !!(reporter?.squadId && platoonSquadIds.has(reporter.squadId));
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [equipmentGaps, myPlatoon, squads, soldiers]);

  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const visibleGaps = filter === 'open'
    ? myGaps.filter((g) => g.status !== 'resolved' && g.status !== 'dismissed')
    : myGaps;

  const counts = {
    reported:   myGaps.filter((g) => g.status === 'reported').length,
    reviewed:   myGaps.filter((g) => g.status === 'reviewed-by-platoon').length,
    forwarded:  myGaps.filter((g) => g.status === 'forwarded-to-rasap').length,
    resolved:   myGaps.filter((g) => g.status === 'resolved').length,
  };
  const openCount = counts.reported + counts.reviewed + counts.forwarded;

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="ליקויי ציוד" />
      <PageMain>

        <header>
          <Eyebrow>{myPlatoon?.name ?? 'מחלקה'}</Eyebrow>
          <PageTitle className="mt-1">ליקויי ציוד</PageTitle>
          <Muted className="mt-1.5 tabular-nums">
            {openCount} פתוחים · {counts.forwarded} נשלחו לרס״פ · {counts.resolved} נסגרו
          </Muted>
        </header>

        <div className="flex gap-1.5">
          <FilterBtn active={filter === 'open'} onClick={() => setFilter('open')}>פתוחים</FilterBtn>
          <FilterBtn active={filter === 'all'}  onClick={() => setFilter('all')}>הכל</FilterBtn>
        </div>

        {visibleGaps.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-bold text-mil-olive-dim">
              {filter === 'open' ? 'אין דיווחים פתוחים' : 'אין דיווחים'}
            </p>
            <p className="text-tiny text-mil-muted mt-1">
              {filter === 'open' ? 'כל הדיווחים טופלו' : 'אף חייל לא דיווח עדיין'}
            </p>
          </div>
        ) : (
          <Section label="דיווחים">
            <div className="space-y-2">
              {visibleGaps.map((gap) => (
                <GapCard
                  key={gap.id}
                  gap={gap}
                  onReview={()  => reviewEquipmentGap(gap.id)}
                  onForward={() => forwardEquipmentGap(gap.id)}
                  onResolve={() => {
                    const notes = window.prompt('הערה (אופציונלי):') ?? undefined;
                    resolveEquipmentGap(gap.id, notes || undefined);
                  }}
                  onDismiss={() => {
                    const notes = window.prompt('סיבה לדחיית הדיווח:') ?? undefined;
                    if (notes !== undefined) dismissEquipmentGap(gap.id, notes || undefined);
                  }}
                />
              ))}
            </div>
          </Section>
        )}

      </PageMain>
    </div>
  );
}

// ─── Gap card ─────────────────────────────────────────────────────────────

function GapCard({
  gap, onReview, onForward, onResolve, onDismiss,
}: {
  gap: EquipmentGap;
  onReview: () => void; onForward: () => void;
  onResolve: () => void; onDismiss: () => void;
}) {
  const isOpen   = gap.status === 'reported' || gap.status === 'reviewed-by-platoon' || gap.status === 'forwarded-to-rasap';

  return (
    <div className="bg-mil-card border border-mil-border rounded-2xl px-5 py-4">
      <div className="flex items-baseline gap-2 mb-2 flex-wrap">
        <Body className="font-semibold">{gap.itemName}</Body>
        <Hint className="text-mil-muted">{GAP_KIND_LABEL[gap.kind]}</Hint>
        <StatusInline status={gap.status} />
      </div>
      <Muted className="text-tiny">
        מ-{gap.reportedByName} · {relativeAgo(gap.createdAt)}
      </Muted>
      {gap.description && <Body className="mt-2 text-sm">{gap.description}</Body>}

      {isOpen && (
        <div className="mt-3 flex flex-wrap gap-2">
          {gap.status === 'reported' && (
            <Button variant="ghost" size="sm" onClick={onReview}>סמן כנצפה</Button>
          )}
          {(gap.status === 'reported' || gap.status === 'reviewed-by-platoon') && (
            <Button variant="primary" size="sm" onClick={onForward}>העבר לרס״פ</Button>
          )}
          <Button variant="ghost" size="sm" onClick={onResolve}>נסגר · טופל</Button>
          <Button variant="ghost" size="sm" onClick={onDismiss}>נסגר · נדחה</Button>
        </div>
      )}

      {(gap.status === 'resolved' || gap.status === 'dismissed') && gap.resolvedNotes && (
        <Muted className="mt-2 text-tiny">{gap.resolvedNotes}</Muted>
      )}
    </div>
  );
}

function StatusInline({ status }: { status: EquipmentGapStatus }) {
  switch (status) {
    case 'reported':              return <StatusPill status="critical">דווח</StatusPill>;
    case 'reviewed-by-platoon':   return <StatusPill status="warning">נצפה</StatusPill>;
    case 'forwarded-to-rasap':    return <StatusPill status="warning">ברס״פ</StatusPill>;
    case 'resolved':              return <StatusPill status="ready">טופל</StatusPill>;
    case 'dismissed':             return <Hint className="text-mil-ghost">נדחה</Hint>;
  }
}

// ─── Filter button ───────────────────────────────────────────────────────

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
        active ? 'bg-mil-text text-mil-card' : 'bg-mil-card border border-mil-border text-mil-muted hover:border-mil-olive'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

const GAP_KIND_LABEL: Record<EquipmentGapKind, string> = {
  missing:           'חסר',
  damaged:           'שבור',
  'logistics-issue': 'בעיה לוגיסטית',
};

function relativeAgo(isoTimestamp: string): string {
  const then = Date.parse(isoTimestamp);
  if (isNaN(then)) return '';
  const now = Date.now();
  const diffMin = Math.round((now - then) / 60000);
  if (diffMin < 1)   return 'הרגע';
  if (diffMin < 60)  return `לפני ${diffMin} דק׳`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24)    return `לפני ${hours} שעות`;
  return `לפני ${Math.floor(hours / 24)} ימים`;
}
