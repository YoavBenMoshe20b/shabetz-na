// PKAL (פק״ל) management — §19, §20, §21.
//
// Foundation surface: list all company PKALs (load-out bundles), surface
// their items + quotas, and call out gaps where a quota is unmet. Edit
// affordances and item-level CRUD land in a follow-up slice; this page
// proves the data model + makes the seeded vocabulary visible to the
// operator.
//
// Gap analysis: a soldier "holds" PKAL X when their operationalRoles
// include X.role. We don't yet track an explicit Soldier ↔ PKAL join —
// the operationalRoles inference covers the common case and keeps the
// foundation slice tight.

import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp, useMyCompany } from '../context/AppContext';
import Header from '../components/Header';
import type { Pkal, PkalQuota, Soldier, Squad, OperationalRole, Platoon } from '../types';
import {
  Eyebrow, PageMain, Body, Muted, Hint, EmptyState, Section,
} from '../components/ui';

interface QuotaRow {
  label: string;       // "פלוגה" / "מחלקה 1" / "כיתה 2"
  required: number;
  holders: number;
  shortBy: number;     // 0 when met
}

interface PkalRow {
  pkal: Pkal;
  totalHolders: number;
  quotaRows: QuotaRow[];
  hasGap: boolean;     // any quota row with shortBy > 0
}

export default function PkalimPage() {
  const {
    currentUser, soldiers, platoons, squads,
    pkalim, pkalQuotas, qualifications,
  } = useApp();
  const myCompany = useMyCompany();

  const rows: PkalRow[] = useMemo(() => {
    if (!myCompany) return [];
    const platoonsById = new Map(platoons.map((p) => [p.id, p]));
    const squadsById   = new Map(squads.map((s) => [s.id, s]));

    // Soldier → platoon lookup. The canonical link is via squad
    // (Soldier.squadId → Squad.platoonId); we also accept the inverse
    // Platoon.memberIds for older seed data that hasn't migrated yet.
    const platoonIdBySoldier = new Map<string, string>();
    for (const p of platoons) {
      for (const sid of p.memberIds ?? []) platoonIdBySoldier.set(sid, p.id);
    }
    for (const s of soldiers) {
      if (s.squadId) {
        const sq = squadsById.get(s.squadId);
        if (sq) platoonIdBySoldier.set(s.id, sq.platoonId);
      }
    }

    return pkalim
      .filter((p) => p.companyId === myCompany.id)
      .map((pkal) => {
        const holders = pkal.role
          ? soldiers.filter((s) => s.operationalRoles?.includes(pkal.role as OperationalRole))
          : [];

        const quotas = pkalQuotas.filter((q) => q.pkalId === pkal.id);
        const quotaRows: QuotaRow[] = quotas.map((q) =>
          buildQuotaRow(q, holders, platoonsById, squadsById, platoonIdBySoldier)
        );

        const hasGap = quotaRows.some((r) => r.shortBy > 0);
        return {
          pkal,
          totalHolders: holders.length,
          quotaRows,
          hasGap,
        };
      })
      // PKALs with gaps surface first — that's where operator attention is needed.
      .sort((a, b) => {
        if (a.hasGap !== b.hasGap) return a.hasGap ? -1 : 1;
        return a.pkal.name.localeCompare(b.pkal.name, 'he');
      });
  }, [pkalim, pkalQuotas, soldiers, platoons, squads, myCompany]);

  const totals = useMemo(() => {
    const open = rows.filter((r) => r.hasGap).length;
    return { total: rows.length, open };
  }, [rows]);

  if (!currentUser) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="פק״לים" />
      <PageMain>

        <section className="bg-mil-card border border-mil-border rounded-2xl-soft shadow-hero p-6">
          <Eyebrow>{myCompany?.name ?? '—'}</Eyebrow>
          <h1 className="text-hero font-extrabold text-mil-text tracking-tightish mt-1.5">
            פק״לי הפלוגה
          </h1>
          <Body className="mt-1.5 text-mil-muted text-sm">
            ערכות התפקיד הסטנדרטיות + מכסות חובה לפי מחלקה / כיתה.
          </Body>
          <div className="mt-4 flex items-baseline gap-4">
            <Metric label="פק״לים בקטלוג" value={totals.total} tone="default" />
            <Metric label="עם פערים פתוחים" value={totals.open} tone={totals.open > 0 ? 'alert' : 'success'} />
          </div>
        </section>

        {rows.length === 0 ? (
          <EmptyState
            title="אין פק״לים מוגדרים"
            hint="המ״פ עדיין לא הגדיר ערכות תפקיד לפלוגה זו"
          />
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <PkalCard
                key={row.pkal.id}
                row={row}
                qualName={
                  row.pkal.qualificationId
                    ? qualifications.find((q) => q.id === row.pkal.qualificationId)?.name
                    : undefined
                }
              />
            ))}
          </div>
        )}

      </PageMain>
    </div>
  );
}

function buildQuotaRow(
  quota: PkalQuota,
  holders: Soldier[],
  platoonsById: Map<string, Platoon>,
  squadsById: Map<string, Squad>,
  platoonIdBySoldier: Map<string, string>,
): QuotaRow {
  const scope = quota.scope;
  if (scope.kind === 'company') {
    return {
      label:    'פלוגה',
      required: quota.required,
      holders:  holders.length,
      shortBy:  Math.max(0, quota.required - holders.length),
    };
  }
  if (scope.kind === 'platoon') {
    const p = platoonsById.get(scope.platoonId);
    const count = holders.filter((s) => platoonIdBySoldier.get(s.id) === scope.platoonId).length;
    return {
      label:    p?.name ?? 'מחלקה',
      required: quota.required,
      holders:  count,
      shortBy:  Math.max(0, quota.required - count),
    };
  }
  // squad scope
  const sq = squadsById.get(scope.squadId);
  const count = holders.filter((sd) => sd.squadId === scope.squadId).length;
  return {
    label:    sq?.name ?? 'כיתה',
    required: quota.required,
    holders:  count,
    shortBy:  Math.max(0, quota.required - count),
  };
}

function PkalCard({ row, qualName }: { row: PkalRow; qualName?: string }) {
  const { pkal, totalHolders, quotaRows, hasGap } = row;
  const accent = hasGap
    ? 'border-mil-alert/40 shadow-card'
    : 'border-mil-border shadow-card';
  return (
    <Section label={pkal.name}>
      <div className={`bg-mil-card border ${accent} rounded-xl-soft p-5 space-y-4`}>

        {/* Identity row */}
        <div className="flex items-baseline gap-2 flex-wrap">
          {pkal.role && (
            <span className="inline-flex items-center text-xxs font-semibold px-2 py-0.5 rounded-md bg-mil-olive-bg text-mil-olive-light border border-mil-olive/40">
              {pkal.role}
            </span>
          )}
          {qualName && (
            <span className="inline-flex items-center text-xxs font-semibold px-2 py-0.5 rounded-md bg-mil-bg-alt text-mil-text border border-mil-border">
              דרישה: {qualName}
            </span>
          )}
          <Hint className="mr-auto">
            {totalHolders} מחזיקים בפלוגה
          </Hint>
        </div>

        {pkal.description && (
          <Muted className="text-tiny">{pkal.description}</Muted>
        )}

        {/* Quota rows — gap analysis. Empty when no quotas defined. */}
        {quotaRows.length > 0 && (
          <div>
            <Hint className="block mb-1.5 uppercase tracking-wide text-xxs text-mil-muted">
              מכסות חובה
            </Hint>
            <div className="bg-mil-bg-alt border border-mil-border/60 rounded-lg divide-y divide-mil-border/60 overflow-hidden">
              {quotaRows.map((q, i) => (
                <div key={i} className="px-3.5 py-2 flex items-baseline gap-2">
                  <Body className="text-tiny font-semibold flex-1 truncate">{q.label}</Body>
                  <span className={`tabular-nums text-sm font-bold ${q.shortBy > 0 ? 'text-mil-alert' : 'text-mil-success'}`}>
                    {q.holders} / {q.required}
                  </span>
                  {q.shortBy > 0 && (
                    <span className="inline-flex items-center text-xxs font-semibold px-1.5 py-0.5 rounded-md bg-mil-alert-bg text-mil-alert border border-mil-alert-border">
                      חסר {q.shortBy}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Items in the kit */}
        {pkal.items.length > 0 && (
          <div>
            <Hint className="block mb-1.5 uppercase tracking-wide text-xxs text-mil-muted">
              תכולת הפק״ל
            </Hint>
            <ul className="space-y-1">
              {pkal.items.map((it) => (
                <li key={it.id} className="flex items-baseline gap-2 text-tiny">
                  <span className="text-mil-ghost">•</span>
                  <span className="flex-1 truncate text-mil-text font-medium">{it.itemName}</span>
                  <span className="tabular-nums text-mil-muted font-semibold">×{it.quantity}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Section>
  );
}

// Tiny inline metric used in the hero. Three lines of text in a small
// box — purposefully simpler than the design-system Metric so the hero
// stays compact on mobile.
function Metric({ label, value, tone }: { label: string; value: number; tone: 'default' | 'success' | 'alert' }) {
  const cls =
    tone === 'alert'   ? 'text-mil-alert'   :
    tone === 'success' ? 'text-mil-success' :
    'text-mil-text';
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-2xl font-bold tabular-nums tracking-tightish ${cls}`}>{value}</span>
      <Muted className="text-sm">{label}</Muted>
    </div>
  );
}
