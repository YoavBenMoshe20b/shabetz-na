// דוח 1 — operational state report.
//
// Two scopes:
//   • company-wide — CC + Deputy + delegated. Shows all platoons.
//   • platoon       — PC/PS/Sergeant + delegated. Shows their commanded
//                     platoon only. Filters narrow accordingly.
//
// The page auto-resolves scope from the viewer: if they have a
// commandedPlatoonId AND lack the report.viewCompanyState token, they
// see the platoon-scoped variant. Otherwise company-wide.
//
// Performance: All filters apply to the active soldier set (boundary
// filter in AppContext keeps this small — only active membership).
// useMemo guards each computation. For a 200-soldier company, all
// projections execute in <5ms per render. Server-side this becomes a
// single materialized view RPC.

import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp, useMyCompany, useMyPlatoons } from '../context/AppContext';
import { canViewReport1, isPlatoonLeadership } from '../utils/permissions';
import Header from '../components/Header';
import type { Soldier, SoldierStatus, OperationalRole, Platoon, Squad, SoldierStatusEvent } from '../types';
import {
  Eyebrow, Section, PageMain, Body, Muted, Hint, Segment, EmptyState,
} from '../components/ui';

// ─── Local helpers ─────────────────────────────────────────────────────────

const STATUS_LABEL: Record<SoldierStatus, string> = {
  'in-base':       'בבסיס',
  'home':          'בבית',
  'inactive-temp': 'לא פעיל',
};

const STATUS_DOT: Record<SoldierStatus, string> = {
  'in-base':       'bg-mil-success',
  'home':          'bg-mil-sand',
  'inactive-temp': 'bg-mil-rest',
};

const ALL_OPERATIONAL_ROLES: OperationalRole[] = [
  'מ״פ', 'סמ״פ', 'מ״מ', 'קשר מ״מ', 'סמל', 'מ״כ',
  'חובש', 'נגביסט', 'קלע', 'מאגיסט', 'רחפן',
  'רס״פ', 'שליש', 'מש״ק קשר',
];

type StatusFilter = 'all' | SoldierStatus;

interface ReportRow {
  soldier: Soldier;
  platoon: Platoon | undefined;
  squad: Squad | undefined;
  latestEvent: SoldierStatusEvent | undefined;
}

function formatRelative(iso: string | undefined, now: Date): string {
  if (!iso) return '—';
  const then = Date.parse(iso);
  if (isNaN(then)) return '—';
  const mins = Math.round((now.getTime() - then) / 60000);
  if (mins < 1) return 'הרגע';
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'אתמול';
  return `לפני ${days} ימים`;
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function Report1Page() {
  const { currentUser, currentRole, soldiers, platoons, squads, soldierStatusEvents, delegations } = useApp();
  const myCompany = useMyCompany();
  const myPlatoons = useMyPlatoons();

  // Scope resolution — company vs platoon. Company wins when the viewer
  // has the company-wide token; otherwise we fall back to the platoon
  // they command. A pure soldier reaches `canViewReport1 === false` and
  // is redirected below.
  const isCompanyScope = !!currentUser && canViewReport1(currentUser, delegations) &&
    (currentRole === 'companyCommander' || currentRole === 'deputyCompanyCommander' || currentRole === 'owner');
  const isPlatoonScope = !!currentUser && !isCompanyScope &&
    isPlatoonLeadership(currentRole) && !!currentUser.commandedPlatoonId;

  // Scoped roster: company-wide vs the commanded platoon's roster only.
  const scopedSoldiers = useMemo(() => {
    if (isCompanyScope) return soldiers;
    if (isPlatoonScope) {
      const sqIds = new Set(squads.filter((sq) => sq.platoonId === currentUser!.commandedPlatoonId).map((sq) => sq.id));
      return soldiers.filter((s) => s.squadId && sqIds.has(s.squadId));
    }
    return [];
  }, [isCompanyScope, isPlatoonScope, soldiers, squads, currentUser]);

  const scopedPlatoons = useMemo(() => {
    if (isCompanyScope) return myPlatoons;
    if (isPlatoonScope) return myPlatoons.filter((p) => p.id === currentUser!.commandedPlatoonId);
    return [];
  }, [isCompanyScope, isPlatoonScope, myPlatoons, currentUser]);

  void currentRole;

  // Hooks always at top — early returns moved below.
  const now = useMemo(() => new Date(), []);
  const [platoonFilter, setPlatoonFilter] = useState<'all' | string>('all');
  const [squadFilter,   setSquadFilter]   = useState<'all' | string>('all');
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>('all');
  const [roleFilter,    setRoleFilter]    = useState<'all' | OperationalRole>('all');
  const [search,        setSearch]        = useState('');

  // KPI totals (over the scoped soldier set — company vs platoon).
  const totals = useMemo(() => {
    const inBase   = scopedSoldiers.filter((s) => s.currentStatus === 'in-base').length;
    const atHome   = scopedSoldiers.filter((s) => s.currentStatus === 'home').length;
    const inactive = scopedSoldiers.filter((s) => s.currentStatus === 'inactive-temp').length;
    return { inBase, atHome, inactive, total: scopedSoldiers.length };
  }, [scopedSoldiers]);

  // Per-platoon breakdown — over the scoped platoon set
  const perPlatoon = useMemo(() => {
    return scopedPlatoons.map((p) => {
      const platoonSquadIds = new Set(squads.filter((s) => s.platoonId === p.id).map((s) => s.id));
      const ps = scopedSoldiers.filter((s) => s.squadId && platoonSquadIds.has(s.squadId));
      return {
        platoon: p,
        total: ps.length,
        inBase:   ps.filter((s) => s.currentStatus === 'in-base').length,
        atHome:   ps.filter((s) => s.currentStatus === 'home').length,
        inactive: ps.filter((s) => s.currentStatus === 'inactive-temp').length,
      };
    });
  }, [scopedPlatoons, squads, scopedSoldiers]);

  // Pre-index latest status event per soldier (sorted descending by setAt)
  const latestEventBySoldier = useMemo(() => {
    const map = new Map<string, SoldierStatusEvent>();
    const sorted = [...soldierStatusEvents].sort((a, b) => b.setAt.localeCompare(a.setAt));
    for (const ev of sorted) {
      if (!map.has(ev.soldierId)) map.set(ev.soldierId, ev);
    }
    return map;
  }, [soldierStatusEvents]);

  // Filtered roster rows — sourced from scopedSoldiers
  const rows: ReportRow[] = useMemo(() => {
    const q = search.trim();
    return scopedSoldiers
      .filter((s) => {
        if (statusFilter !== 'all' && s.currentStatus !== statusFilter) return false;
        if (roleFilter !== 'all' && !s.operationalRoles.includes(roleFilter)) return false;
        if (squadFilter !== 'all' && s.squadId !== squadFilter) return false;
        if (platoonFilter !== 'all') {
          const sq = squads.find((sx) => sx.id === s.squadId);
          if (!sq || sq.platoonId !== platoonFilter) return false;
        }
        if (q && !s.name.includes(q)) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'he'))
      .map((s) => {
        const sq = squads.find((sx) => sx.id === s.squadId);
        const p  = sq ? platoons.find((px) => px.id === sq.platoonId) : undefined;
        return { soldier: s, platoon: p, squad: sq, latestEvent: latestEventBySoldier.get(s.id) };
      });
  }, [scopedSoldiers, squads, platoons, latestEventBySoldier, search, statusFilter, roleFilter, squadFilter, platoonFilter]);

  // Squad options for the filter — restricted to the chosen platoon when one is active.
  // For platoon scope, default to that platoon's squads.
  const squadOptions = useMemo(() => {
    if (isPlatoonScope) {
      return squads.filter((s) => s.platoonId === currentUser!.commandedPlatoonId);
    }
    if (platoonFilter === 'all') return squads;
    return squads.filter((s) => s.platoonId === platoonFilter);
  }, [squads, platoonFilter, isPlatoonScope, currentUser]);

  // Permission gates — placed AFTER all hooks per react-hooks/rules-of-hooks.
  if (!currentUser) return <Navigate to="/login" replace />;
  // Neither company-scope nor platoon-scope → not authorized.
  if (!isCompanyScope && !isPlatoonScope) return <Navigate to="/home" replace />;

  const myPlatoon = isPlatoonScope
    ? scopedPlatoons[0]
    : undefined;
  const scopeLabel = isCompanyScope
    ? (myCompany?.name ?? '—')
    : (myPlatoon?.name ?? '—');
  const scopeTitle = isCompanyScope ? 'דוח 1 · פלוגה' : 'דוח 1 · מחלקה';

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="דוח 1" />
      <PageMain>

        {/* Hero KPI strip */}
        <section className="bg-mil-card border border-mil-border rounded-2xl-soft shadow-hero p-6">
          <Eyebrow>{scopeLabel}</Eyebrow>
          <h1 className="text-hero font-extrabold text-mil-text tracking-tightish mt-1.5">{scopeTitle}</h1>
          <Muted className="mt-1.5">
            תמונת מצב חיה · עודכן {formatRelative(now.toISOString(), now)}
          </Muted>

          <div className="mt-5 grid grid-cols-4 gap-2.5">
            <KpiTile label="בבסיס"   value={totals.inBase}   tone="success" />
            <KpiTile label="בבית"     value={totals.atHome}   tone="sand"   muted={totals.atHome === 0} />
            <KpiTile label="לא פעיל" value={totals.inactive} tone="rest"   muted={totals.inactive === 0} />
            <KpiTile label="סך הכל"  value={totals.total}    tone="neutral" />
          </div>
        </section>

        {/* Per-platoon breakdown — only when company scope or multi-platoon */}
        {perPlatoon.length > 1 && (
        <Section label="חלוקה לפי מחלקות">
          <div className="bg-mil-card border border-mil-border rounded-2xl shadow-card divide-y divide-mil-border overflow-hidden">
            {perPlatoon.map((row) => (
              <div key={row.platoon.id} className="px-5 py-3.5 flex items-center gap-3.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ring-4 ring-mil-card ${row.inBase < (row.platoon.minSoldiersOnBase ?? 0) ? 'bg-mil-alert' : 'bg-mil-success'}`} aria-hidden />
                <div className="flex-1 min-w-0">
                  <Body className="font-semibold truncate">{row.platoon.name}</Body>
                  <div className="mt-1 flex items-baseline gap-2 flex-wrap text-tiny">
                    <span className="text-mil-success font-semibold tabular-nums">{row.inBase} בבסיס</span>
                    {row.atHome > 0 && (
                      <>
                        <span className="text-mil-ghost">·</span>
                        <span className="text-mil-sand font-semibold tabular-nums">{row.atHome} בבית</span>
                      </>
                    )}
                    {row.inactive > 0 && (
                      <>
                        <span className="text-mil-ghost">·</span>
                        <span className="text-mil-rest font-semibold tabular-nums">{row.inactive} לא פעיל</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-baseline flex-shrink-0 tabular-nums">
                  <span className="text-xl font-bold tracking-tightish text-mil-text">{row.inBase}</span>
                  <span className="text-mil-ghost text-sm">/{row.total}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
        )}

        {/* Filters */}
        <Section label="סינון">
          <div className="space-y-2.5">
            {/* Search */}
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חפש חייל…"
              className="w-full bg-mil-card border border-mil-border rounded-xl-soft px-3.5 py-2.5 text-mil-text focus:outline-none focus:border-mil-olive focus:shadow-focus placeholder:text-mil-ghost text-sm transition-all duration-200 ease-out-soft"
            />

            {/* Status segment */}
            <Segment
              value={statusFilter}
              onChange={setStatusFilter}
              fullWidth
              options={[
                { value: 'all',           label: 'הכל' },
                { value: 'in-base',       label: 'בבסיס' },
                { value: 'home',          label: 'בבית' },
                { value: 'inactive-temp', label: 'לא פעיל' },
              ]}
            />

            {/* Platoon + squad + role selects */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Platoon filter only when there's more than one platoon in scope */}
              {scopedPlatoons.length > 1 && (
                <FilterSelect
                  value={platoonFilter}
                  onChange={(v) => { setPlatoonFilter(v); setSquadFilter('all'); }}
                  options={[{ value: 'all', label: 'כל המחלקות' }, ...scopedPlatoons.map((p) => ({ value: p.id, label: p.name }))]}
                />
              )}
              <FilterSelect
                value={squadFilter}
                onChange={setSquadFilter}
                options={[{ value: 'all', label: 'כל הכיתות' }, ...squadOptions.map((s) => ({ value: s.id, label: s.name }))]}
              />
              <FilterSelect
                value={roleFilter}
                onChange={(v) => setRoleFilter(v as 'all' | OperationalRole)}
                options={[{ value: 'all', label: 'כל התפקידים' }, ...ALL_OPERATIONAL_ROLES.map((r) => ({ value: r, label: r }))]}
              />
            </div>
          </div>
        </Section>

        {/* Roster table */}
        <Section label={`חיילים · ${rows.length}`}>
          {rows.length === 0 ? (
            <EmptyState
              title="אין חיילים תואמים לסינון"
              hint="נקה את הפילטרים או חפש בשם אחר"
            />
          ) : (
            <div className="bg-mil-card border border-mil-border rounded-2xl shadow-card divide-y divide-mil-border overflow-hidden">
              {rows.map((row) => (
                <Report1Row key={row.soldier.id} row={row} now={now} />
              ))}
            </div>
          )}
        </Section>

      </PageMain>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function KpiTile({
  label, value, tone, muted = false,
}: {
  label: string;
  value: number;
  tone: 'success' | 'sand' | 'rest' | 'neutral';
  muted?: boolean;
}) {
  const toneClass = {
    success: 'text-mil-success',
    sand:    'text-mil-sand',
    rest:    'text-mil-rest',
    neutral: 'text-mil-text',
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

function FilterSelect<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full bg-mil-card border border-mil-border rounded-xl-soft px-3.5 py-2.5 text-mil-text focus:outline-none focus:border-mil-olive focus:shadow-focus text-sm transition-all duration-200 ease-out-soft"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function Report1Row({ row, now }: { row: ReportRow; now: Date }) {
  const s = row.soldier;
  const dot = STATUS_DOT[s.currentStatus];
  const initials = s.name.split(' ').map((p) => p[0]).slice(0, 2).join('');
  return (
    <div className="px-5 py-3 flex items-center gap-3.5">
      <div className="relative flex-shrink-0">
        <div className="w-9 h-9 rounded-full bg-mil-bg-alt border border-mil-border text-mil-muted flex items-center justify-center text-xs font-semibold">
          {initials}
        </div>
        <span className={`absolute -bottom-0.5 -left-0.5 w-2.5 h-2.5 rounded-full ${dot} ring-2 ring-mil-card`} aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <Body className="font-semibold truncate">{s.name}</Body>
          <span className="text-xxs font-semibold text-mil-muted">{STATUS_LABEL[s.currentStatus]}</span>
        </div>
        <div className="mt-0.5 flex items-baseline gap-1.5 text-tiny text-mil-muted flex-wrap">
          {row.platoon && <span>{row.platoon.name}</span>}
          {row.squad && (
            <>
              <span className="text-mil-ghost">·</span>
              <span>{row.squad.name}</span>
            </>
          )}
          {s.operationalRoles.length > 0 && (
            <>
              <span className="text-mil-ghost">·</span>
              <span className="truncate">{s.operationalRoles.join(' · ')}</span>
            </>
          )}
        </div>
      </div>
      <div className="text-left flex-shrink-0">
        <Hint className="block text-xxs text-mil-muted">עודכן</Hint>
        <Hint className="block text-tiny text-mil-text font-medium">
          {formatRelative(row.latestEvent?.setAt ?? s.statusSetAt, now)}
        </Hint>
      </div>
    </div>
  );
}
