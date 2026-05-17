// Operational summary report (סד״כ) — §18.
//
// One screen the מ״פ / שליש can glance at to brief the battalion. It
// answers the questions a commander gets asked between 06:30 and 08:00
// every morning, without having to open four other surfaces:
//
//   • How many soldiers does the company have, and where are they?
//   • What roles are short, what roles are over-staffed?
//   • Equipment posture — what's deployed, what's still in stock.
//   • Quartermaster heads-up: size distribution per platoon (B + civ).
//   • Age cohorts — who's the older half, who's the younger half.
//
// Everything on this page derives from existing entities — there's no
// new state. The report is a view, not a model. If a number looks
// wrong, the source row is wrong; fix it there.

import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp, useMyCompany } from '../context/AppContext';
import Header from '../components/Header';
import type {
  Platoon, SignedEquipmentCategory, OperationalRole,
} from '../types';
import {
  Eyebrow, PageMain, Section, Body, Muted, Hint, EmptyState,
} from '../components/ui';

const CATEGORY_LABEL: Record<SignedEquipmentCategory, string> = {
  weapon:     'נשק',
  optic:      'אופטיקה',
  comms:      'תקשורת',
  protection: 'הגנה',
  navigation: 'ניווט',
  medical:    'רפואה',
  misc:       'ציוד נוסף',
};

const CATEGORY_ORDER: SignedEquipmentCategory[] = [
  'weapon', 'optic', 'comms', 'protection', 'navigation', 'medical', 'misc',
];

const AGE_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '18–19', min: 18, max: 19 },
  { label: '20–21', min: 20, max: 21 },
  { label: '22–23', min: 22, max: 23 },
  { label: '24+',   min: 24, max: 200 },
];

export default function OperationalSummaryPage() {
  const { currentUser, soldiers, platoons, signedEquipment, equipmentItems } = useApp();
  const myCompany = useMyCompany();

  // ── Head-count (סד״כ) ──────────────────────────────────────────────
  const headcount = useMemo(() => {
    const total    = soldiers.length;
    const inBase   = soldiers.filter((s) => s.currentStatus === 'in-base').length;
    const home     = soldiers.filter((s) => s.currentStatus === 'home').length;
    const inactive = soldiers.filter((s) => s.currentStatus === 'inactive-temp').length;
    return { total, inBase, home, inactive };
  }, [soldiers]);

  const perPlatoon = useMemo(() => {
    return platoons.map((p) => {
      const members = soldiers.filter((s) => p.memberIds?.includes(s.id));
      return {
        platoon:  p,
        total:    members.length,
        inBase:   members.filter((s) => s.currentStatus === 'in-base').length,
        home:     members.filter((s) => s.currentStatus === 'home').length,
        inactive: members.filter((s) => s.currentStatus === 'inactive-temp').length,
      };
    });
  }, [platoons, soldiers]);

  // ── Operational role distribution ─────────────────────────────────
  const rolesDistribution = useMemo(() => {
    const counts = new Map<OperationalRole, number>();
    for (const s of soldiers) {
      for (const r of s.operationalRoles ?? []) {
        counts.set(r, (counts.get(r) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [soldiers]);

  // ── Equipment summary ─────────────────────────────────────────────
  const equipmentByCategory = useMemo(() => {
    const groups: Record<SignedEquipmentCategory, { signed: number; active: number }> = {
      weapon: { signed: 0, active: 0 }, optic: { signed: 0, active: 0 },
      comms:  { signed: 0, active: 0 }, protection: { signed: 0, active: 0 },
      navigation: { signed: 0, active: 0 }, medical: { signed: 0, active: 0 },
      misc:   { signed: 0, active: 0 },
    };
    for (const e of signedEquipment) {
      groups[e.category].signed += 1;
      if (e.status === 'active') groups[e.category].active += 1;
    }
    return CATEGORY_ORDER.map((k) => ({ category: k, ...groups[k] }));
  }, [signedEquipment]);

  const inventoryTotals = useMemo(() => {
    const total     = equipmentItems.reduce((sum, i) => sum + (i.unitCount ?? 0), 0);
    const activeOut = signedEquipment.filter((s) => s.status === 'active').length;
    return { total, activeOut, inStock: Math.max(0, total - activeOut) };
  }, [equipmentItems, signedEquipment]);

  // ── Sizes (per-platoon quartermaster view) ────────────────────────
  // Shows the spread of working-uniform (Class B) shirt sizes per
  // platoon. Civilian sizes get their own row.
  const sizesByPlatoon = useMemo(() => {
    return platoons.map((p) => {
      const members = soldiers.filter((s) => p.memberIds?.includes(s.id));
      const shirtB = bucket(members.map((s) => s.shirtSizeB));
      const pantsB = bucket(members.map((s) => s.pantsSizeB));
      return { platoon: p, shirtB, pantsB, members: members.length };
    });
  }, [platoons, soldiers]);

  // ── Age distribution ─────────────────────────────────────────────
  const today = useMemo(() => new Date(), []);
  const ageBuckets = useMemo(() => {
    const buckets = AGE_BUCKETS.map((b) => ({ ...b, count: 0 }));
    let unknown = 0;
    for (const s of soldiers) {
      if (!s.dateOfBirth) { unknown += 1; continue; }
      const age = calcAge(s.dateOfBirth, today);
      if (age == null) { unknown += 1; continue; }
      const b = buckets.find((b) => age >= b.min && age <= b.max);
      if (b) b.count += 1; else unknown += 1;
    }
    return { buckets, unknown };
  }, [soldiers, today]);

  if (!currentUser) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="סד״כ ודוחות מבצעיים" />
      <PageMain>

        <section className="bg-mil-card border border-mil-border rounded-2xl-soft shadow-hero p-6">
          <Eyebrow>{myCompany?.name ?? '—'}</Eyebrow>
          <h1 className="text-hero font-extrabold text-mil-text tracking-tightish mt-1.5">
            תמונת מצב פלוגתית
          </h1>
          <Body className="mt-1.5 text-mil-muted text-sm">
            סד״כ · תפקידים · ציוד · מידות · גילאים — נכון לעכשיו.
          </Body>
        </section>

        {/* ── סד״כ ─────────────────────────────────────────────── */}
        <Section label="סד״כ פלוגתי">
          <div className="bg-mil-card border border-mil-border rounded-2xl shadow-card divide-y divide-mil-border overflow-hidden">
            <HeadcountTotalsRow {...headcount} />
            {perPlatoon.map((p) => (
              <HeadcountRow key={p.platoon.id} name={p.platoon.name} {...p} />
            ))}
          </div>
        </Section>

        {/* ── תפקידים מבצעיים ────────────────────────────────── */}
        <Section label="תפקידים מבצעיים">
          {rolesDistribution.length === 0 ? (
            <EmptyState title="אין תפקידים מבצעיים מוגדרים" />
          ) : (
            <div className="bg-mil-card border border-mil-border rounded-xl-soft shadow-card p-4 grid grid-cols-2 gap-2">
              {rolesDistribution.map(([role, count]) => (
                <RolePill key={role} role={role} count={count} />
              ))}
            </div>
          )}
        </Section>

        {/* ── ציוד ───────────────────────────────────────────── */}
        <Section label="ציוד · מצב מצרפי">
          <div className="bg-mil-card border border-mil-border rounded-xl-soft shadow-card p-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <MiniMetric label="במלאי" value={inventoryTotals.total} />
              <MiniMetric label="חתום" value={inventoryTotals.activeOut} tone="olive" />
              <MiniMetric label="פנוי" value={inventoryTotals.inStock} tone="muted" />
            </div>
            <div className="bg-mil-bg-alt border border-mil-border/60 rounded-lg divide-y divide-mil-border/60 overflow-hidden">
              {equipmentByCategory.map((c) => (
                <div key={c.category} className="px-3.5 py-2 flex items-baseline gap-2">
                  <Body className="text-tiny font-semibold flex-1 truncate">
                    {CATEGORY_LABEL[c.category]}
                  </Body>
                  <Hint className="text-tiny">{c.signed} רשומות</Hint>
                  <span className="tabular-nums text-sm font-bold text-mil-olive">
                    {c.active} חתום
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── מידות ──────────────────────────────────────────── */}
        <Section label="מידות חולצה ומכנס ב' לפי מחלקה">
          {sizesByPlatoon.length === 0 ? (
            <EmptyState title="אין נתוני מידות" hint="חיילים עדיין לא מילאו מידות בפרופיל" />
          ) : (
            <div className="space-y-2">
              {sizesByPlatoon.map((s) => (
                <SizesCard key={s.platoon.id} {...s} />
              ))}
            </div>
          )}
        </Section>

        {/* ── גילאים ─────────────────────────────────────────── */}
        <Section label="התפלגות גילאים">
          <div className="bg-mil-card border border-mil-border rounded-xl-soft shadow-card p-4 space-y-2">
            {ageBuckets.buckets.map((b) => (
              <AgeBucketRow key={b.label} label={b.label} count={b.count} total={headcount.total} />
            ))}
            {ageBuckets.unknown > 0 && (
              <Muted className="text-tiny">
                {ageBuckets.unknown} חיילים ללא תאריך לידה
              </Muted>
            )}
          </div>
        </Section>

      </PageMain>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────

function HeadcountTotalsRow({ total, inBase, home, inactive }: {
  total: number; inBase: number; home: number; inactive: number;
}) {
  return (
    <div className="px-5 py-4 bg-mil-bg-alt">
      <div className="flex items-baseline gap-2">
        <Body className="font-bold">הפלוגה</Body>
        <span className="mr-auto text-2xl font-bold tabular-nums text-mil-text">{total}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-3 text-tiny">
        <Stat label="בבסיס"   value={inBase}   tone="olive" />
        <Stat label="בבית"    value={home}     tone="sand"  />
        <Stat label="לא פעיל" value={inactive} tone="muted" />
      </div>
    </div>
  );
}

function HeadcountRow({ name, total, inBase, home, inactive }: {
  name: string; total: number; inBase: number; home: number; inactive: number;
}) {
  return (
    <div className="px-5 py-3.5">
      <div className="flex items-baseline gap-2">
        <Body className="font-semibold">{name}</Body>
        <span className="mr-auto text-base font-bold tabular-nums text-mil-text">{total}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-3 text-tiny">
        <Stat label="בבסיס"   value={inBase}   tone="olive" />
        <Stat label="בבית"    value={home}     tone="sand"  />
        <Stat label="לא פעיל" value={inactive} tone="muted" />
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'olive' | 'sand' | 'muted' }) {
  const cls =
    tone === 'olive' ? 'text-mil-olive' :
    tone === 'sand'  ? 'text-mil-sand'  :
    'text-mil-muted';
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-mil-muted">{label}</span>
      <span className={`tabular-nums font-bold ${cls}`}>{value}</span>
    </span>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: number; tone?: 'olive' | 'muted' }) {
  const cls =
    tone === 'olive' ? 'text-mil-olive' :
    tone === 'muted' ? 'text-mil-muted' :
    'text-mil-text';
  return (
    <div className="bg-mil-bg-alt border border-mil-border/60 rounded-lg px-3 py-2">
      <Hint className="block uppercase tracking-wide text-xxs text-mil-muted">{label}</Hint>
      <p className={`text-xl font-bold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}

function RolePill({ role, count }: { role: OperationalRole; count: number }) {
  return (
    <div className="bg-mil-bg-alt border border-mil-border/60 rounded-lg px-3 py-2 flex items-baseline gap-2">
      <Body className="text-tiny font-semibold flex-1 truncate">{role}</Body>
      <span className="tabular-nums text-sm font-bold text-mil-olive">{count}</span>
    </div>
  );
}

function SizesCard({ platoon, members, shirtB, pantsB }: {
  platoon: Platoon; members: number;
  shirtB: { size: string; count: number }[];
  pantsB: { size: string; count: number }[];
}) {
  return (
    <div className="bg-mil-card border border-mil-border rounded-xl-soft shadow-card p-4">
      <div className="flex items-baseline gap-2">
        <Body className="font-semibold">{platoon.name}</Body>
        <Hint className="mr-auto">{members} חיילים</Hint>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <SizesGroup title="חולצה ב'" rows={shirtB} />
        <SizesGroup title="מכנס ב'"   rows={pantsB} />
      </div>
    </div>
  );
}

function SizesGroup({ title, rows }: { title: string; rows: { size: string; count: number }[] }) {
  return (
    <div>
      <Hint className="block mb-1.5 uppercase tracking-wide text-xxs text-mil-muted">{title}</Hint>
      {rows.length === 0 ? (
        <Muted className="text-tiny">—</Muted>
      ) : (
        <div className="space-y-0.5">
          {rows.map((r) => (
            <div key={r.size} className="flex items-baseline gap-2 text-tiny">
              <span className="text-mil-text font-semibold tabular-nums w-12">{r.size}</span>
              <span className="mr-auto tabular-nums text-mil-olive font-bold">{r.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgeBucketRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-sm font-semibold text-mil-text w-16 tabular-nums">{label}</span>
      <div className="flex-1 h-2 bg-mil-bg-alt rounded-full overflow-hidden">
        <div className="h-full bg-mil-olive" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-bold tabular-nums text-mil-text w-10 text-left">{count}</span>
      <span className="text-tiny text-mil-muted w-10 tabular-nums">{pct}%</span>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

// Builds a frequency table from an array of free-text sizes. Empty /
// undefined entries are dropped. Result is sorted by count desc.
function bucket(values: (string | undefined)[]): { size: string; count: number }[] {
  const m = new Map<string, number>();
  for (const v of values) {
    const norm = (v ?? '').trim();
    if (!norm) continue;
    m.set(norm, (m.get(norm) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([size, count]) => ({ size, count }))
    .sort((a, b) => b.count - a.count);
}

function calcAge(iso: string, now: Date): number | null {
  const dob = new Date(iso);
  if (isNaN(dob.getTime())) return null;
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

