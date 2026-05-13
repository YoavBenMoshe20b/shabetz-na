// Soldier detail — scoped to viewer role.
//
// Reached from /soldiers (PC roster, CC hierarchy), from /platoon, or by
// direct URL. The page shows the soldier's full operational picture, but
// each section gates on the viewer's relationship to the soldier:
//
//   self        — everything (own record)
//   platoon-cmd — everything operational, plus edit-controls
//   company-cmd — everything operational, plus edit-controls
//   rasap       — equipment + sizes only
//   public      — name + squad only (restrictive fallback)

import { useMemo, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getSoldierDetailScope, canSeeSoldierSection } from '../utils/permissions';
import Header from '../components/Header';
import { materializeWeek } from '../utils/materialize';
import type {
  OperationalRole, SignedEquipmentCategory, SoldierStatus,
} from '../types';
import {
  Section, PageMain, PageTitle, Body, Muted, Hint, StatusPill,
} from '../components/ui';

// All operational roles for the multi-select edit affordance. Order
// reflects command hierarchy first, then specialty roles.
const ALL_OPERATIONAL_ROLES: OperationalRole[] = [
  'מ״פ','סמ״פ','מ״מ','סמל','מ״כ',
  'רס״פ','שליש','מש״ק קשר','קשר מ״מ',
  'חובש','נגביסט','קלע','מאגיסט','רחפן',
];

export default function SoldierDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const {
    currentUser, soldiers, allSoldiers, squads, platoons,
    qualifications, soldierQualifications,
    signedEquipment, soldierStatusEvents, leaves, missions, dutyExclusions,
    updateSoldierSquad, updateSoldierOperationalRoles,
  } = useApp();

  if (!currentUser) return <Navigate to="/login" replace />;

  const target = useMemo(
    () => allSoldiers.find((s) => s.id === id),
    [allSoldiers, id],
  );

  if (!target) {
    return (
      <div className="min-h-screen bg-mil-bg" dir="rtl">
        <Header title="חייל" />
        <PageMain>
          <header>
            <PageTitle>חייל לא נמצא</PageTitle>
            <Muted className="mt-1.5">המזהה שצוין אינו פעיל ברשומה</Muted>
          </header>
        </PageMain>
      </div>
    );
  }

  const scope = getSoldierDetailScope(currentUser, target, platoons);
  const can = (section: Parameters<typeof canSeeSoldierSection>[1]) => canSeeSoldierSection(scope, section);

  const mySquad   = squads.find((s) => s.id === target.squadId);
  const myPlatoon = platoons.find((p) => p.id === mySquad?.platoonId);

  const myQuals = soldierQualifications
    .filter((sq) => sq.soldierId === target.id)
    .map((sq) => qualifications.find((q) => q.id === sq.qualificationId))
    .filter(Boolean);

  const myEquipment = signedEquipment.filter((e) => e.soldierId === target.id);

  // History — derived from status events.
  const myStatusEvents = soldierStatusEvents
    .filter((e) => e.soldierId === target.id)
    .sort((a, b) => b.setAt.localeCompare(a.setAt));

  // Days at home / days on base (last 30 days, simple count)
  const statsLast30d = useMemo(() => {
    const events = soldierStatusEvents
      .filter((e) => e.soldierId === target.id)
      .sort((a, b) => a.setAt.localeCompare(b.setAt));
    const now = Date.now();
    const horizon = now - 30 * 86400000;
    let daysHome = 0;
    let daysBase = 0;
    // Walk timeline — for each day in window, infer the state from
    // the latest event ≤ that day. If no event yet, fall back to current
    // status (most demo data has stale status events).
    for (let day = 0; day < 30; day++) {
      const t = horizon + day * 86400000;
      const evt = events.filter((e) => Date.parse(e.setAt) <= t).pop();
      const state: SoldierStatus = evt?.value ?? target.currentStatus;
      if (state === 'home')         daysHome++;
      else if (state === 'in-base') daysBase++;
    }
    return { daysHome, daysBase };
  }, [soldierStatusEvents, target]);

  // Missions performed — derived from materialized slots (this week only;
  // future slice expands history beyond the visible window).
  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const weekSlots = useMemo(() => materializeWeek({
    missions, platoons, squads, soldiers, leaves, dutyExclusions,
    startDay: todayStart, days: 7,
  }), [missions, platoons, squads, soldiers, leaves, dutyExclusions, todayStart]);
  const myMissionSlots = weekSlots.filter((slot) =>
    slot.assignedSoldierIds.includes(target.id) || slot.commanderSoldierId === target.id
  );

  // Compute age
  const age = useMemo(() => {
    if (!target.dateOfBirth) return null;
    const birth = new Date(target.dateOfBirth);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--;
    return years;
  }, [target]);

  // Edit controls state
  const [editRolesOpen, setEditRolesOpen] = useState(false);
  const [editSquadOpen, setEditSquadOpen] = useState(false);
  const [rolesDraft, setRolesDraft] = useState<OperationalRole[]>(target.operationalRoles);
  const [squadDraft, setSquadDraft] = useState<string | null>(target.squadId ?? null);
  const saveRoles = () => { updateSoldierOperationalRoles(target.id, rolesDraft); setEditRolesOpen(false); };
  const saveSquad = () => { updateSoldierSquad(target.id, squadDraft); setEditSquadOpen(false); };

  // Sibling squads (same platoon) — for the squad-reassign affordance
  const platoonSquads = myPlatoon
    ? squads.filter((s) => s.platoonId === myPlatoon.id)
    : [];

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="חייל" />
      <PageMain>

        {/* Identity hero */}
        <header>
          <button onClick={() => navigate(-1)} className="text-tiny font-bold text-mil-muted hover:text-mil-text">
            → חזרה
          </button>
          <PageTitle className="mt-2">{target.name}</PageTitle>
          <Muted className="mt-1.5">
            {myPlatoon?.name ?? '—'}
            {mySquad && ` · ${mySquad.name}`}
            {age != null && ` · גיל ${age}`}
          </Muted>
          {scope === 'rasap' && (
            <Hint className="mt-2 text-mil-warn font-semibold">
              תצוגה לוגיסטית — ציוד ומידות בלבד
            </Hint>
          )}
          {scope === 'public' && (
            <Hint className="mt-2 text-mil-warn font-semibold">
              גישה מוגבלת
            </Hint>
          )}
        </header>

        {/* Operational status */}
        {can('operational-status') && (
          <Section label="מצב מבצעי">
            <div className="bg-mil-card border border-mil-border rounded-2xl px-5 py-4">
              <div className="flex items-baseline gap-3 flex-wrap">
                <StatusPill status={
                  target.currentStatus === 'in-base'        ? 'ready'   :
                  target.currentStatus === 'home'           ? 'warning' :
                  'critical'
                }>
                  {STATUS_LABEL[target.currentStatus]}
                </StatusPill>
                {target.statusExpectedUntil && (
                  <Hint className="text-mil-muted">
                    חזרה צפויה: {formatDate(new Date(target.statusExpectedUntil))}
                  </Hint>
                )}
              </div>
              <div className="mt-3 flex items-baseline gap-5 flex-wrap">
                <StatBlock label="ימים בבסיס · 30 יום אחרונים" value={statsLast30d.daysBase} />
                <StatBlock label="ימים בבית · 30 יום אחרונים" value={statsLast30d.daysHome} />
              </div>
            </div>
          </Section>
        )}

        {/* Roles + squad + edit controls */}
        {can('roles') && (
          <Section label="תפקידים ושיוך">
            <div className="bg-mil-card border border-mil-border rounded-2xl divide-y divide-mil-border overflow-hidden">

              <div className="px-5 py-4">
                <div className="flex items-baseline gap-3 mb-2">
                  <Body className="font-semibold">תפקידים מבצעיים</Body>
                  {can('edit-controls') && (
                    <button
                      onClick={() => { setRolesDraft(target.operationalRoles); setEditRolesOpen((v) => !v); }}
                      className="mr-auto text-tiny font-bold text-mil-olive-dim hover:text-mil-olive"
                    >
                      {editRolesOpen ? 'בטל' : 'ערוך'}
                    </button>
                  )}
                </div>
                {editRolesOpen ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {ALL_OPERATIONAL_ROLES.map((r) => {
                        const on = rolesDraft.includes(r);
                        return (
                          <button
                            key={r}
                            onClick={() => setRolesDraft((d) => on ? d.filter((x) => x !== r) : [...d, r])}
                            className={chipCls(on)}
                          >
                            {r}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={saveRoles}
                      className="mt-3 w-full bg-mil-olive hover:bg-mil-olive-light text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
                    >
                      שמור תפקידים
                    </button>
                  </>
                ) : (
                  target.operationalRoles.length === 0 ? (
                    <Muted className="text-tiny">אין תפקידים רשומים</Muted>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {target.operationalRoles.map((r) => (
                        <span key={r} className="px-3 py-1.5 rounded-full bg-mil-card-warm border border-mil-border text-sm font-semibold text-mil-text">
                          {r}
                        </span>
                      ))}
                    </div>
                  )
                )}
              </div>

              <div className="px-5 py-4">
                <div className="flex items-baseline gap-3 mb-2">
                  <Body className="font-semibold">כיתה</Body>
                  {can('edit-controls') && platoonSquads.length > 0 && (
                    <button
                      onClick={() => { setSquadDraft(target.squadId ?? null); setEditSquadOpen((v) => !v); }}
                      className="mr-auto text-tiny font-bold text-mil-olive-dim hover:text-mil-olive"
                    >
                      {editSquadOpen ? 'בטל' : 'העבר'}
                    </button>
                  )}
                </div>
                {editSquadOpen ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {platoonSquads.map((sq) => {
                        const on = squadDraft === sq.id;
                        return (
                          <button key={sq.id} onClick={() => setSquadDraft(sq.id)} className={chipCls(on)}>
                            {sq.name}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={saveSquad}
                      className="mt-3 w-full bg-mil-olive hover:bg-mil-olive-light text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
                    >
                      שמור שיוך
                    </button>
                  </>
                ) : (
                  <Body>{mySquad?.name ?? '—'}</Body>
                )}
              </div>

            </div>
          </Section>
        )}

        {/* Qualifications */}
        {can('qualifications') && (
          <Section label="כישורים מבצעיים">
            {myQuals.length === 0 ? (
              <Muted className="text-tiny">אין כישורים רשומים</Muted>
            ) : (
              <div className="flex flex-wrap gap-2">
                {myQuals.map((q) => (
                  <span key={q!.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-mil-olive-bg/40 border border-mil-olive/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-mil-olive flex-shrink-0" aria-hidden />
                    <span className="text-sm font-semibold text-mil-text">{q!.name}</span>
                  </span>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* Sizes */}
        {can('sizes') && (
          <Section label="מידות ופרטים אישיים">
            <div className="bg-mil-card border border-mil-border rounded-2xl px-5 py-4 grid grid-cols-2 gap-y-3 gap-x-6">
              <KV label="תאריך לידה"   value={target.dateOfBirth ? formatDate(new Date(target.dateOfBirth)) : '—'} />
              <KV label="גיל"           value={age != null ? `${age}` : '—'} />
              <KV label="יד דומיננטית"  value={target.dominantHand === 'left' ? 'שמאל' : target.dominantHand === 'right' ? 'ימין' : '—'} />
              <KV label="צד נשק"        value={target.weaponSide === 'left' ? 'שמאל' : target.weaponSide === 'right' ? 'ימין' : '—'} />
              <KV label="חולצה"         value={target.shirtSize ?? '—'} />
              <KV label="מכנס"          value={target.pantsSize ?? '—'} />
              <KV label="נעל"            value={target.shoeSize ?? '—'} />
            </div>
          </Section>
        )}

        {/* Equipment */}
        {can('equipment') && (
          <Section label="ציוד חתום">
            {myEquipment.length === 0 ? (
              <Muted className="text-tiny">אין ציוד חתום</Muted>
            ) : (
              <div className="bg-mil-card border border-mil-border rounded-2xl divide-y divide-mil-border overflow-hidden">
                {myEquipment.map((item) => (
                  <div key={item.id} className="px-5 py-3 flex items-baseline gap-3">
                    <Hint className="text-tiny tracking-wide w-16 flex-shrink-0">{EQUIPMENT_CAT[item.category]}</Hint>
                    <div className="flex-1 min-w-0">
                      <Body className="font-semibold truncate">{item.itemName}</Body>
                      {item.serialNumber && (
                        <Hint className="text-tiny font-mono tabular-nums">{item.serialNumber}</Hint>
                      )}
                    </div>
                    <Hint className="text-tiny">{item.source}</Hint>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* History */}
        {can('history') && (
          <>
            <Section label="משימות השבוע">
              {myMissionSlots.length === 0 ? (
                <Muted className="text-tiny">אין משימות מתוכננות השבוע</Muted>
              ) : (
                <div className="bg-mil-card border border-mil-border rounded-2xl divide-y divide-mil-border overflow-hidden">
                  {myMissionSlots.map((slot) => {
                    const s = new Date(slot.start);
                    return (
                      <div key={slot.id} className="px-5 py-3 flex items-baseline gap-3">
                        <Hint className="text-tiny font-mono tabular-nums w-20 flex-shrink-0">
                          {formatDate(s)} · {hhmm(s)}
                        </Hint>
                        <Body className="flex-1 truncate font-semibold">{slot.missionName}</Body>
                        {slot.commanderSoldierId === target.id && (
                          <Hint className="text-mil-olive-dim font-bold">מפקד</Hint>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            <Section label="היסטוריית מצב מבצעי">
              {myStatusEvents.length === 0 ? (
                <Muted className="text-tiny">אין רישומי מצב</Muted>
              ) : (
                <div className="bg-mil-card border border-mil-border rounded-2xl divide-y divide-mil-border overflow-hidden">
                  {myStatusEvents.slice(0, 10).map((ev) => (
                    <div key={ev.id} className="px-5 py-3 flex items-baseline gap-3">
                      <Hint className="text-tiny tabular-nums w-24 flex-shrink-0">
                        {formatDate(new Date(ev.setAt))}
                      </Hint>
                      <Body className="flex-1">{STATUS_LABEL[ev.value]}</Body>
                      {ev.reason && <Hint className="text-tiny text-mil-muted">{ev.reason}</Hint>}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </>
        )}

      </PageMain>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function StatBlock({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col">
      <span className="text-2xl font-extrabold tabular-nums text-mil-text">{value}</span>
      <Hint className="text-tiny">{label}</Hint>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Hint className="text-tiny tracking-wide">{label}</Hint>
      <Body className="mt-0.5">{value}</Body>
    </div>
  );
}

// ─── Constants ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<SoldierStatus, string> = {
  'in-base':       'בבסיס',
  'home':          'בבית',
  'inactive-temp': 'לא פעיל',
};

const EQUIPMENT_CAT: Record<SignedEquipmentCategory, string> = {
  weapon: 'נשק', optic: 'אופטיקה', comms: 'תקשורת',
  protection: 'הגנה', navigation: 'ניווט', medical: 'רפואה', misc: 'אחר',
};

const chipCls = (on: boolean): string =>
  on
    ? 'px-3 py-1.5 rounded-full text-sm font-bold bg-mil-olive text-white'
    : 'px-3 py-1.5 rounded-full text-sm font-semibold bg-mil-card border border-mil-border text-mil-text hover:border-mil-olive transition-colors';

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function formatDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
