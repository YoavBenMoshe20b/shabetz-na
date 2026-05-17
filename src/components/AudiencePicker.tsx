// AudiencePicker — canonical widget for selecting an Audience.
//
// Used by: Announcement composer, Escalation composer, Leave-cycle segment
// composer. One widget keeps the visual + behavioral language identical
// across the product so a CC who learns the picker in one place transfers
// the knowledge immediately to others.
//
// Modes:
//   • company           — single button toggle
//   • platoons          — multi-select platoon chips
//   • squads            — multi-select squad chips (grouped by platoon)
//   • soldiers          — chip + multi-select picker (collapsible)
//   • operational-roles — multi-select operational-role chips
//
// The picker NEVER decides for the consumer — it emits the Audience object
// and the consumer stores it. Validity rules (e.g. "at least one platoon
// when kind=platoons") are enforced by the consumer before submit.

import { useMemo, useState } from 'react';
import type { Audience, OperationalRole, Platoon, Soldier, Squad } from '../types';

const ALL_OPERATIONAL_ROLES: OperationalRole[] = [
  'מ״פ', 'סמ״פ', 'מ״מ', 'קשר מ״מ', 'סמל', 'מ״כ', 'מפקד מפלג',
  'חובש', 'נגביסט', 'קלע', 'מאגיסט', 'רחפן',
  'רס״פ', 'שליש', 'מש״ק קשר',
];

type AudienceKind = Audience['kind'];

interface AudiencePickerProps {
  value: Audience;
  onChange: (next: Audience) => void;
  /** Restrict which kinds the operator can choose. Defaults to all five. */
  allowedKinds?: AudienceKind[];
  /** Pass the company's actual roster so chips render correctly. */
  platoons: Platoon[];
  squads: Squad[];
  soldiers: Soldier[];
}

export function AudiencePicker({
  value, onChange,
  allowedKinds = ['company', 'platoons', 'squads', 'soldiers', 'operational-roles'],
  platoons, squads, soldiers,
}: AudiencePickerProps) {
  const [soldierFilter, setSoldierFilter] = useState('');

  // Pre-index squads by platoon for grouped rendering
  const squadsByPlatoon = useMemo(() => {
    const map = new Map<string, Squad[]>();
    for (const sq of squads) {
      const arr = map.get(sq.platoonId) ?? [];
      arr.push(sq);
      map.set(sq.platoonId, arr);
    }
    return map;
  }, [squads]);

  const filteredSoldiers = useMemo(() => {
    const q = soldierFilter.trim();
    if (!q) return soldiers;
    return soldiers.filter((s) => s.name.includes(q));
  }, [soldiers, soldierFilter]);

  const setKind = (kind: AudienceKind) => {
    switch (kind) {
      case 'company':           onChange({ kind: 'company' }); break;
      case 'platoons':          onChange({ kind: 'platoons',          platoonIds: [] }); break;
      case 'squads':            onChange({ kind: 'squads',            squadIds: [] }); break;
      case 'soldiers':          onChange({ kind: 'soldiers',          soldierIds: [] }); break;
      case 'operational-roles': onChange({ kind: 'operational-roles', operationalRoles: [] }); break;
    }
  };

  const toggleInSet = <T,>(set: Set<T>, item: T): void => {
    if (set.has(item)) set.delete(item); else set.add(item);
  };
  const togglePlatoon = (id: string) => {
    if (value.kind !== 'platoons') return;
    const set = new Set(value.platoonIds);
    toggleInSet(set, id);
    onChange({ kind: 'platoons', platoonIds: [...set] });
  };
  const toggleSquad = (id: string) => {
    if (value.kind !== 'squads') return;
    const set = new Set(value.squadIds);
    toggleInSet(set, id);
    onChange({ kind: 'squads', squadIds: [...set] });
  };
  const toggleSoldier = (id: string) => {
    if (value.kind !== 'soldiers') return;
    const set = new Set(value.soldierIds);
    toggleInSet(set, id);
    onChange({ kind: 'soldiers', soldierIds: [...set] });
  };
  const toggleRole = (r: OperationalRole) => {
    if (value.kind !== 'operational-roles') return;
    const set = new Set(value.operationalRoles);
    toggleInSet(set, r);
    onChange({ kind: 'operational-roles', operationalRoles: [...set] });
  };

  const KIND_LABEL: Record<AudienceKind, string> = {
    'company':           'כל הפלוגה',
    'platoons':          'מחלקות',
    'squads':            'כיתות',
    'soldiers':          'חיילים',
    'operational-roles': 'תפקידים',
  };

  return (
    <div className="space-y-3">
      {/* Kind selector */}
      <div className="flex flex-wrap gap-1.5 bg-mil-bg-alt border border-mil-border rounded-xl-soft p-1">
        {allowedKinds.map((k) => {
          const active = value.kind === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`flex-1 min-w-0 py-2 px-3 rounded-md text-tiny font-semibold transition-all duration-200 ease-out-soft ${
                active
                  ? 'bg-mil-card text-mil-olive shadow-card'
                  : 'text-mil-muted hover:text-mil-text'
              }`}
            >
              {KIND_LABEL[k]}
            </button>
          );
        })}
      </div>

      {/* Detail panel by kind */}
      {value.kind === 'company' && (
        <p className="text-tiny text-mil-muted px-1">
          ההודעה תופיע לכל החיילים, בעלי התפקידים והמפקדים בפלוגה.
        </p>
      )}

      {value.kind === 'platoons' && (
        <div className="flex flex-wrap gap-2">
          {platoons.map((p) => {
            const on = value.platoonIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePlatoon(p.id)}
                className={`px-3 py-1.5 rounded-full text-tiny font-semibold border transition-all duration-200 ease-out-soft ${
                  on
                    ? 'bg-mil-olive-bg text-mil-olive border-mil-olive/30'
                    : 'bg-mil-card text-mil-muted border-mil-border hover:border-mil-border-strong hover:text-mil-text'
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      )}

      {value.kind === 'squads' && (
        <div className="space-y-2.5">
          {platoons.map((p) => {
            const sqs = squadsByPlatoon.get(p.id) ?? [];
            if (sqs.length === 0) return null;
            return (
              <div key={p.id}>
                <p className="text-xxs font-semibold text-mil-muted tracking-wide uppercase mb-1.5 px-0.5">{p.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {sqs.map((sq) => {
                    const on = value.squadIds.includes(sq.id);
                    return (
                      <button
                        key={sq.id}
                        type="button"
                        onClick={() => toggleSquad(sq.id)}
                        className={`px-3 py-1 rounded-full text-tiny font-semibold border transition-all duration-200 ease-out-soft ${
                          on
                            ? 'bg-mil-olive-bg text-mil-olive border-mil-olive/30'
                            : 'bg-mil-card text-mil-muted border-mil-border hover:border-mil-border-strong hover:text-mil-text'
                        }`}
                      >
                        {sq.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {value.kind === 'soldiers' && (
        <div className="space-y-2">
          <input
            type="search"
            value={soldierFilter}
            onChange={(e) => setSoldierFilter(e.target.value)}
            placeholder="חפש חייל…"
            className="w-full bg-mil-card border border-mil-border rounded-xl-soft px-3.5 py-2 text-mil-text focus:outline-none focus:border-mil-olive focus:shadow-focus placeholder:text-mil-ghost text-sm transition-all duration-200 ease-out-soft"
          />
          <div className="max-h-56 overflow-y-auto border border-mil-border rounded-xl-soft divide-y divide-mil-border bg-mil-card">
            {filteredSoldiers.length === 0 ? (
              <p className="px-3.5 py-3 text-tiny text-mil-muted">אין חיילים תואמים</p>
            ) : (
              filteredSoldiers.map((s) => {
                const on = value.soldierIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSoldier(s.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-right transition-colors duration-200 ease-out-soft ${
                      on ? 'bg-mil-olive-bg' : 'hover:bg-mil-card-hover'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                      on ? 'bg-mil-olive border-mil-olive' : 'border-mil-border-strong'
                    }`}>
                      {on && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    <span className="text-sm text-mil-text font-medium flex-1">{s.name}</span>
                    {s.operationalRoles.length > 0 && (
                      <span className="text-xxs text-mil-muted truncate max-w-[40%]">{s.operationalRoles.join(' · ')}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
          {value.soldierIds.length > 0 && (
            <p className="text-tiny text-mil-muted px-1">
              נבחרו <span className="tabular-nums font-semibold text-mil-text">{value.soldierIds.length}</span> חיילים
            </p>
          )}
        </div>
      )}

      {value.kind === 'operational-roles' && (
        <div className="flex flex-wrap gap-1.5">
          {ALL_OPERATIONAL_ROLES.map((r) => {
            const on = value.operationalRoles.includes(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => toggleRole(r)}
                className={`px-3 py-1 rounded-full text-tiny font-semibold border transition-all duration-200 ease-out-soft ${
                  on
                    ? 'bg-mil-olive-bg text-mil-olive border-mil-olive/30'
                    : 'bg-mil-card text-mil-muted border-mil-border hover:border-mil-border-strong hover:text-mil-text'
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
