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
  Section, PageMain, PageTitle, Body, Muted, Hint,
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
      {/* Hierarchy hero: battalion → company */}
      <header>
        <Hint className="tracking-widest uppercase">{myCompany?.unitName ?? 'גדוד'}</Hint>
        <PageTitle className="mt-1">{myCompany?.name ?? 'פלוגה'}</PageTitle>
        <Muted className="mt-1.5 tabular-nums">
          {myPlatoons.length} מחלקות · {soldiers.length} חיילים
        </Muted>
      </header>

      {myPlatoons.map((platoon) => {
        const psoldiers = platoonSoldiers(platoon.id);
        const inBase = psoldiers.filter((s) => s.currentStatus === 'in-base').length;
        const isOpen = openPlatoons.has(platoon.id);
        return (
          <section key={platoon.id}>
            <button
              onClick={() => togglePlatoon(platoon.id)}
              className="w-full flex items-baseline gap-3 text-right py-2"
            >
              <Body className="font-semibold">{platoon.name}</Body>
              {platoon.kind === 'forward-command' && <Hint className="text-mil-muted">מיוחדת</Hint>}
              <Hint className="mr-auto tabular-nums">
                <span className="font-bold text-mil-text">{inBase}</span>/{psoldiers.length} בבסיס
              </Hint>
              <span className="text-mil-ghost text-tiny">{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && (
              <div className="bg-mil-card border border-mil-border rounded-2xl overflow-hidden">
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
          <div className="bg-mil-card border border-mil-border rounded-2xl divide-y divide-mil-border overflow-hidden">
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
      <header>
        {myPlatoon.unitName && <Hint className="tracking-widest uppercase">{myPlatoon.unitName}</Hint>}
        <PageTitle className="mt-1">{myPlatoon.name}</PageTitle>
        <Muted className="mt-1.5 tabular-nums">
          {inBase} בבסיס · {atHome} בבית{inactive > 0 ? ` · ${inactive} לא פעיל` : ''}
        </Muted>
      </header>

      <Section label="כיתות">
        {mySquads.length === 0 ? (
          <Muted className="text-tiny">אין כיתות מוגדרות</Muted>
        ) : (
          <div className="bg-mil-card border border-mil-border rounded-2xl overflow-hidden">
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
      <div className="px-5 py-2.5 bg-mil-card-warm/40 flex items-baseline gap-2">
        <Body className="font-semibold">{squad.name}</Body>
        <Hint className="mr-auto tabular-nums">{soldiers.length}</Hint>
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
    soldier.currentStatus === 'in-base'        ? 'bg-mil-olive' :
    soldier.currentStatus === 'home'           ? 'bg-mil-sand'  :
    soldier.currentStatus === 'inactive-temp'  ? 'bg-mil-ghost' :
    'bg-mil-ghost';

  return (
    <button
      onClick={onClick}
      className="w-full text-right px-5 py-3 flex items-center gap-3 hover:bg-mil-card-warm/40 transition-colors"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot} flex-shrink-0`} aria-hidden />
      <div className="flex-1 min-w-0">
        <Body className="font-semibold truncate">{soldier.name}</Body>
        {soldier.operationalRoles.length > 0 && (
          <Hint className="block mt-0.5 truncate text-mil-muted">
            {soldier.operationalRoles.join(' · ')}
          </Hint>
        )}
      </div>
      <Hint className="text-mil-ghost text-tiny">{STATUS_LABEL[soldier.currentStatus]}</Hint>
      <span className="text-mil-ghost">←</span>
    </button>
  );
}

const STATUS_LABEL: Record<SoldierStatus, string> = {
  'in-base':       'בבסיס',
  'home':          'בבית',
  'inactive-temp': 'לא פעיל',
};
