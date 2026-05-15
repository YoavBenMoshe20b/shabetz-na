// PlatoonStructurePage — configurable structure for non-combat platoons.
//
// CHAPAK and MAFLAG don't have a fixed structure like combat platoons.
// Their responsibilities are operator-decided: "אסף is אחראי ציוד חפ״ק
// this week", "אוהד is the driver / water lead today". This page lets
// command (CC / רס״פ) assign or reassign FUNCTIONAL ROLE flags to each
// member with one tap.
//
// Visible to: CC, DCC, the platoon's commander (CHAPAK PC = CC, MAFLAG
// PC = רס״פ), and שליש. Read-only for everyone else who lands here.

import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { isCompanyLeadership, isRasap } from '../utils/permissions';
import Header from '../components/Header';
import {
  Eyebrow, Section, PageMain, PageTitle, Body, Muted, Hint,
} from '../components/ui';
import type { Soldier, Platoon } from '../types';

// Catalog of functional roles per platoon kind. New flags can be added
// here without schema changes — soldier.functionalRoles is string[].
const FUNCTIONAL_ROLE_CATALOG: Record<string, { id: string; label: string; desc?: string }[]> = {
  'forward-command': [
    { id: 'equipment-lead-chapack', label: 'אחראי ציוד חפ״ק', desc: 'אליו מוגשים חוסרי ציוד של החפ״ק' },
    { id: 'comms-lead',             label: 'אחראי קשר',       desc: 'תפעול קשר חפ״ק שוטף' },
    { id: 'drone-operator',         label: 'מפעיל רחפן',     desc: 'יציאה מסודרת לרחפן' },
    { id: 'driver',                 label: 'נהג רכב פיקוד', desc: 'אחראי על רכב המ״פ' },
    { id: 'ops-clerk',              label: 'מ״ק חפ״ק',       desc: 'מסמכים, הודעות, סיכומים' },
  ],
  'logistics': [
    { id: 'rasap',          label: 'רס״פ',            desc: 'מפקד המפלג ואחראי לוגיסטיקה' },
    { id: 'srasap',         label: 'סרס״פ',          desc: 'סגן רס״פ' },
    { id: 'shalish',        label: 'שליש',           desc: 'אחראי כוח אדם' },
    { id: 'kitchen-lead',   label: 'אחראי מטבח',    desc: 'תורנויות בישול ומנות' },
    { id: 'water-lead',     label: 'אחראי מים',      desc: 'מיכלים, בקבוקים, ניקיון מים' },
    { id: 'cleaning-lead',  label: 'אחראי ניקיון',  desc: 'משימות ניקיון כלליות' },
    { id: 'equipment-lead', label: 'אחראי ציוד',    desc: 'מחסן, חתימות, ספירות' },
    { id: 'driver',         label: 'נהג',             desc: 'רכב מפלג / משאית' },
  ],
};

export default function PlatoonStructurePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const {
    currentUser, currentRole,
    platoons, squads, allSoldiers,
    updateSoldierFunctionalRoles,
  } = useApp();

  const platoon = useMemo(() => platoons.find((p) => p.id === id) ?? null, [platoons, id]);

  const members = useMemo(() => {
    if (!platoon) return [] as Soldier[];
    const sqIds = new Set(squads.filter((sq) => sq.platoonId === platoon.id).map((sq) => sq.id));
    return allSoldiers.filter((s) =>
      s.companyId === platoon.companyId
      && s.status === 'active'
      && s.squadId
      && sqIds.has(s.squadId),
    );
  }, [platoon, squads, allSoldiers]);

  if (!currentUser) return <Navigate to="/login" replace />;
  if (!platoon) {
    return (
      <div className="min-h-screen bg-mil-bg" dir="rtl">
        <Header title="מבנה מחלקה" />
        <PageMain>
          <PageTitle>מחלקה לא נמצאה</PageTitle>
        </PageMain>
      </div>
    );
  }

  // Edit permission: CC/DCC always; PC of THIS platoon; or רס״פ when
  // viewing the logistics platoon.
  const canEdit =
    isCompanyLeadership(currentRole)
    || currentUser.commandedPlatoonId === platoon.id
    || (platoon.kind === 'logistics' && isRasap(currentUser));

  const catalog = FUNCTIONAL_ROLE_CATALOG[platoon.kind] ?? [];

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="מבנה מחלקה" />
      <PageMain>
        <header>
          <Eyebrow>מבנה {platoon.kind === 'forward-command' ? 'חפ״ק' : platoon.kind === 'logistics' ? 'מפלג' : 'מחלקה'}</Eyebrow>
          <PageTitle className="mt-1">{platoon.name}</PageTitle>
          <Muted className="mt-1 text-tiny leading-relaxed">
            {platoon.kind === 'forward-command'
              ? 'מ״פ + סמ״פ + צוות תומך. אחראי ציוד חפ״ק נבחר על־ידי המ״פ — הוא הכתובת לדיווחי ליקויים בחפ״ק.'
              : platoon.kind === 'logistics'
              ? 'מפלג לוגיסטי. תפקידים פונקציונליים מוגדרים על־פי הצורך המבצעי ולא בנפרד לכל אדם.'
              : 'מחלקה.'}
          </Muted>
        </header>

        <Section label={`חברים · ${members.length}`}>
          {members.length === 0 ? (
            <Muted className="text-tiny">אין חברים פעילים</Muted>
          ) : (
            <div className="bg-mil-card border border-mil-border rounded-2xl divide-y divide-mil-border overflow-hidden">
              {members.map((s) => (
                <MemberRow
                  key={s.id}
                  soldier={s}
                  platoon={platoon}
                  catalog={catalog}
                  canEdit={canEdit}
                  onChange={(roles) => updateSoldierFunctionalRoles(s.id, roles)}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Quick navigation back */}
        <button
          onClick={() => navigate(-1)}
          className="mt-4 text-tiny font-semibold text-mil-muted hover:text-mil-text"
        >
          ← חזרה
        </button>
      </PageMain>
    </div>
  );
}

// ─── Member row ──────────────────────────────────────────────────────

function MemberRow({
  soldier, platoon, catalog, canEdit, onChange,
}: {
  soldier: Soldier;
  platoon: Platoon;
  catalog: { id: string; label: string; desc?: string }[];
  canEdit: boolean;
  onChange: (roles: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const current = soldier.functionalRoles ?? [];
  void platoon;

  const toggle = (id: string) => {
    const next = current.includes(id)
      ? current.filter((r) => r !== id)
      : [...current, id];
    onChange(next);
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline gap-2 flex-wrap">
        <Body className="font-semibold">{soldier.name}</Body>
        {soldier.operationalRoles.length > 0 && (
          <Hint className="text-mil-muted">· {soldier.operationalRoles.join(' · ')}</Hint>
        )}
        {canEdit && (
          <button
            onClick={() => setEditing((v) => !v)}
            className="mr-auto text-tiny font-semibold text-mil-olive hover:text-mil-olive-dim"
          >
            {editing ? 'סיום' : 'ערוך תפקידים'}
          </button>
        )}
      </div>

      {/* Current functional role chips */}
      {current.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {current.map((id) => {
            const def = catalog.find((c) => c.id === id);
            return (
              <span
                key={id}
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-mil-olive-bg text-mil-olive text-tiny font-semibold border border-mil-olive/30"
              >
                {def?.label ?? id}
              </span>
            );
          })}
        </div>
      )}

      {/* Editor: chip palette */}
      {editing && canEdit && (
        <div className="mt-3 pt-3 border-t border-mil-border">
          <Hint className="block mb-2 text-mil-muted">בחר תפקידים פונקציונליים. ניתן לבחור כמה.</Hint>
          <div className="flex flex-wrap gap-1.5">
            {catalog.map((c) => {
              const active = current.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className={`px-2.5 py-1 rounded-md text-tiny font-semibold border transition-colors ${
                    active
                      ? 'bg-mil-olive text-white border-mil-olive'
                      : 'bg-mil-card text-mil-text border-mil-border hover:border-mil-olive'
                  }`}
                  title={c.desc}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
