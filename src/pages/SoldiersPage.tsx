// Soldiers — role-aware roster + hierarchy.
//
// Role variants:
//   COMPANY-TIER (CC/Deputy)        → CompanyHierarchyView
//                                     battalion → company → platoons → squads → soldiers
//   PLATOON-TIER (PC/PS)            → PlatoonRosterView, scoped to commanded platoon
//                                     squad-grouped sections + click → /soldier/:id
//   SOLDIER                         → PlatoonRosterView, scoped to own platoon, read-only
//
// Every list row clicks through to SoldierDetailPage (which gates content
// further based on the viewer's scope helper from utils/permissions).

import { useMemo, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useApp, useMyCompany, useMyPlatoons } from '../context/AppContext';
import { isCompanyLeadership, isPlatoonLeadership } from '../utils/permissions';
import Header from '../components/Header';
import type { Soldier, Squad, SoldierStatus } from '../types';
import {
  Eyebrow, Section, PageMain, PageTitle, Body, Muted, Hint,
} from '../components/ui';

export default function SoldiersPage() {
  const { currentUser, currentRole } = useApp();
  if (!currentUser) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="חיילים" />
      <PageMain>
        {isCompanyLeadership(currentRole) ? (
          <CompanyHierarchyView />
        ) : (
          <PlatoonRosterView />
        )}
      </PageMain>
    </div>
  );
}

// ─── Company hierarchy view (CC / Deputy) ────────────────────────────────

function CompanyHierarchyView() {
  const navigate = useNavigate();
  const { soldiers, squads } = useApp();
  const myCompany = useMyCompany();
  const myPlatoons = useMyPlatoons();
  const [openPlatoons, setOpenPlatoons] = useState<Set<string>>(() => new Set(myPlatoons.map((p) => p.id)));

  const togglePlatoon = (id: string) => setOpenPlatoons((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const platoonSquads = (platoonId: string): Squad[] =>
    squads.filter((s) => s.platoonId === platoonId);

  const platoonSoldiers = (platoonId: string): Soldier[] => {
    const sqIds = platoonSquads(platoonId).map((s) => s.id);
    return soldiers.filter((s) => s.squadId && sqIds.includes(s.squadId));
  };

  const unassigned = soldiers.filter((s) =>
    !s.squadId || !squads.find((sq) => sq.id === s.squadId)
  );

  return (
    <>
      <section className="bg-mil-card border border-mil-border rounded-2xl-soft shadow-hero p-6">
        <Eyebrow>{myCompany?.unitName ?? 'גדוד'}</Eyebrow>
        <h1 className="text-hero font-extrabold text-mil-text tracking-tightish mt-1.5">{myCompany?.name ?? 'פלוגה'}</h1>
        <div className="mt-2 flex items-baseline gap-2 text-tiny text-mil-muted">
          <span><span className="tabular-nums font-semibold text-mil-text">{myPlatoons.length}</span> מחלקות</span>
          <span className="text-mil-ghost">·</span>
          <span><span className="tabular-nums font-semibold text-mil-text">{soldiers.length}</span> חיילים</span>
        </div>
      </section>

      {myPlatoons.map((platoon) => {
        const psoldiers = platoonSoldiers(platoon.id);
        const inBase = psoldiers.filter((s) => s.currentStatus === 'in-base').length;
        const isOpen = openPlatoons.has(platoon.id);
        return (
          <section key={platoon.id}>
            <button
              onClick={() => togglePlatoon(platoon.id)}
              className="w-full flex items-baseline gap-3 text-right py-2 px-1 group"
            >
              <Body className="font-semibold">{platoon.name}</Body>
              {platoon.kind === 'forward-command' && (
                <span className="text-xxs font-semibold text-mil-sand bg-mil-sand-bg border border-mil-sand/30 rounded-md px-1.5 py-0.5">מיוחדת</span>
              )}
              <Hint className="mr-auto tabular-nums">
                <span className="font-bold text-mil-text">{inBase}</span>/{psoldiers.length} בבסיס
              </Hint>
              <span className={`text-mil-muted transition-transform duration-200 ease-out-soft ${isOpen ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {isOpen && (
              <div className="bg-mil-card border border-mil-border rounded-xl-soft shadow-card overflow-hidden">
                {platoonSquads(platoon.id).length === 0 ? (
                  <div className="px-5 py-4">
                    <Muted className="text-tiny">אין כיתות מוגדרות</Muted>
                  </div>
                ) : (
                  platoonSquads(platoon.id).map((squad, idx) => {
                    const ss = soldiers.filter((s) => s.squadId === squad.id);
                    return (
                      <SquadBlock
                        key={squad.id}
                        squad={squad}
                        soldiers={ss}
                        isFirst={idx === 0}
                        onSoldierClick={(id) => navigate(`/soldier/${id}`)}
                      />
                    );
                  })
                )}
              </div>
            )}
          </section>
        );
      })}

      {unassigned.length > 0 && (
        <Section label="ללא שיוך כיתה">
          <div className="bg-mil-card border border-mil-border rounded-xl-soft shadow-card divide-y divide-mil-border overflow-hidden">
            {unassigned.map((s) => (
              <SoldierRow key={s.id} soldier={s} onClick={() => navigate(`/soldier/${s.id}`)} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

// ─── Platoon roster view (PC / PS / Soldier) ─────────────────────────────

function PlatoonRosterView() {
  const navigate = useNavigate();
  const { currentUser, currentRole, soldiers, squads, platoons } = useApp();

  const myPlatoon = useMemo(() => {
    if (isPlatoonLeadership(currentRole) && currentUser?.commandedPlatoonId) {
      return platoons.find((p) => p.id === currentUser.commandedPlatoonId);
    }
    return platoons.find((p) => p.id === currentUser?.platoonId);
  }, [platoons, currentUser, currentRole]);

  const mySquads = useMemo(() =>
    myPlatoon ? squads.filter((s) => s.platoonId === myPlatoon.id) : [],
    [squads, myPlatoon],
  );

  const platoonSoldiers = useMemo(() => {
    const sqIds = new Set(mySquads.map((s) => s.id));
    return soldiers.filter((s) => s.squadId && sqIds.has(s.squadId));
  }, [soldiers, mySquads]);

  const inBase   = platoonSoldiers.filter((s) => s.currentStatus === 'in-base').length;
  const atHome   = platoonSoldiers.filter((s) => s.currentStatus === 'home').length;
  const inactive = platoonSoldiers.filter((s) => s.currentStatus === 'inactive-temp').length;

  if (!myPlatoon) {
    return (
      <header>
        <PageTitle>אין מחלקה</PageTitle>
        <Muted className="mt-1.5">המשתמש לא משוייך למחלקה</Muted>
      </header>
    );
  }

  return (
    <>
      <section className="bg-mil-card border border-mil-border rounded-2xl-soft shadow-hero p-6">
        {myPlatoon.unitName && <Eyebrow>{myPlatoon.unitName}</Eyebrow>}
        <h1 className="text-hero font-extrabold text-mil-text tracking-tightish mt-1.5">{myPlatoon.name}</h1>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="bg-mil-bg-alt/70 border border-mil-border/70 rounded-xl-soft px-3.5 py-3">
            <span className="text-2xl font-bold tabular-nums text-mil-success tracking-tightish">{inBase}</span>
            <Hint className="text-tiny font-medium text-mil-muted mt-0.5">בבסיס</Hint>
          </div>
          <div className="bg-mil-bg-alt/70 border border-mil-border/70 rounded-xl-soft px-3.5 py-3">
            <span className={`text-2xl font-bold tabular-nums tracking-tightish ${atHome === 0 ? 'text-mil-ghost' : 'text-mil-sand'}`}>{atHome}</span>
            <Hint className="text-tiny font-medium text-mil-muted mt-0.5">בבית</Hint>
          </div>
          <div className="bg-mil-bg-alt/70 border border-mil-border/70 rounded-xl-soft px-3.5 py-3">
            <span className={`text-2xl font-bold tabular-nums tracking-tightish ${inactive === 0 ? 'text-mil-ghost' : 'text-mil-rest'}`}>{inactive}</span>
            <Hint className="text-tiny font-medium text-mil-muted mt-0.5">לא פעיל</Hint>
          </div>
        </div>
      </section>

      <Section label="כיתות">
        {mySquads.length === 0 ? (
          <Muted className="text-tiny">אין כיתות מוגדרות</Muted>
        ) : (
          <div className="bg-mil-card border border-mil-border rounded-xl-soft shadow-card overflow-hidden">
            {mySquads.map((squad, idx) => {
              const ss = soldiers.filter((s) => s.squadId === squad.id);
              return (
                <SquadBlock
                  key={squad.id}
                  squad={squad}
                  soldiers={ss}
                  isFirst={idx === 0}
                  onSoldierClick={(id) => navigate(`/soldier/${id}`)}
                />
              );
            })}
          </div>
        )}
      </Section>
    </>
  );
}

// ─── Squad block — header + soldier rows ─────────────────────────────────

function SquadBlock({
  squad, soldiers, isFirst, onSoldierClick,
}: {
  squad: Squad;
  soldiers: Soldier[];
  isFirst: boolean;
  onSoldierClick: (id: string) => void;
}) {
  return (
    <div className={isFirst ? '' : 'border-t border-mil-border'}>
      <div className="px-5 py-2.5 bg-mil-bg-alt/60 flex items-baseline gap-2">
        <span className="text-xxs font-bold tracking-wide uppercase text-mil-muted">{squad.name}</span>
        <span className="mr-auto text-tiny tabular-nums font-semibold text-mil-text bg-mil-card border border-mil-border/70 rounded-md px-1.5">{soldiers.length}</span>
      </div>
      {soldiers.length === 0 ? (
        <div className="px-5 py-3">
          <Muted className="text-tiny">כיתה ריקה</Muted>
        </div>
      ) : (
        <div className="divide-y divide-mil-border">
          {soldiers.map((s) => (
            <SoldierRow key={s.id} soldier={s} onClick={() => onSoldierClick(s.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function SoldierRow({ soldier, onClick }: { soldier: Soldier; onClick: () => void }) {
  const dot =
    soldier.currentStatus === 'in-base'        ? 'bg-mil-success' :
    soldier.currentStatus === 'home'           ? 'bg-mil-sand'    :
    soldier.currentStatus === 'inactive-temp'  ? 'bg-mil-rest'    :
    'bg-mil-ghost';
  const initials = soldier.name.split(' ').map((p) => p[0]).slice(0, 2).join('');

  // §12 — row now includes the operational basics: name + phone (call
  // link) + PKAL/roles + squad/team + status. The "←" leads to the
  // full soldier detail page.
  return (
    <button
      onClick={onClick}
      className="w-full text-right px-5 py-3 flex items-center gap-3.5 hover:bg-mil-card-hover transition-colors duration-200 ease-out-soft"
    >
      <div className="relative flex-shrink-0">
        <div className="w-9 h-9 rounded-full bg-mil-bg-alt border border-mil-border text-mil-muted flex items-center justify-center text-xs font-semibold">
          {initials}
        </div>
        <span className={`absolute -bottom-0.5 -left-0.5 w-2.5 h-2.5 rounded-full ${dot} ring-2 ring-mil-card`} aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <Body className="font-semibold truncate">{soldier.name}</Body>
        <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
          {soldier.phone && (
            <Hint className="text-tiny text-mil-muted tabular-nums font-mono">
              {soldier.phone}
            </Hint>
          )}
          {soldier.operationalRoles.length > 0 && (
            <>
              {soldier.phone && <Hint className="text-mil-ghost">·</Hint>}
              <Hint className="text-tiny truncate text-mil-muted">
                {soldier.operationalRoles.slice(0, 2).join(' · ')}
                {soldier.operationalRoles.length > 2 && ` +${soldier.operationalRoles.length - 2}`}
              </Hint>
            </>
          )}
        </div>
      </div>
      <span className="text-xxs font-semibold text-mil-muted whitespace-nowrap">{STATUS_LABEL[soldier.currentStatus]}</span>
      <span className="text-mil-ghost">←</span>
    </button>
  );
}

const STATUS_LABEL: Record<SoldierStatus, string> = {
  'in-base':       'בבסיס',
  'home':          'בבית',
  'inactive-temp': 'לא פעיל',
};
