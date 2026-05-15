// PlatoonLeaveBoardPage — CC/DCC operational leave management.
//
// "ניהול יציאות פלוגתיות". A 30-day grid (rows = platoons, cols = days)
// with click-to-toggle home/base per cell. Coverage Rules listed below
// for CHAPAK/MAFLAG (small-unit invariants). Warnings strip surfaces
// rule violations + concurrent-home-cap breaches.
//
// Engine impact: when a platoon is `home` on a date, materializeWeek
// drops that platoon's soldiers from the eligible pool. Operators can
// override individual soldiers via SoldierLeaveOverride.
//
// Route: /coverage/platoons (CC + DCC + RasaP read-only of their own
// platoon).

import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { isCompanyLeadership } from '../utils/permissions';
import Header from '../components/Header';
import {
  Eyebrow, Section, PageMain, PageTitle, Body, Muted, Hint, Button,
} from '../components/ui';
import type { CoverageRule, Platoon, Soldier } from '../types';

const DAYS_FORWARD = 30;

function startOfTodayIso(): string {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function weekdayShort(iso: string): string {
  const days = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
  return days[new Date(iso).getDay()];
}

export default function PlatoonLeaveBoardPage() {
  const navigate = useNavigate();
  const {
    currentUser, currentRole, platoons, squads, soldiers,
    platoonLeaveDays, companyLeavePolicy, companyCoverageRules,
    setPlatoonLeaveDay, clearPlatoonLeaveDay, generatePlatoonRotation,
    updateCompanyLeavePolicy, removeCoverageRule,
  } = useApp();

  const myCompanyId = currentUser?.companyId;

  // Rows: combat + non-combat platoons of my company, sorted with
  // combat first then CHAPAK then MAFLAG.
  const platoonRows = useMemo(() => {
    const list = platoons.filter((p) => p.companyId === myCompanyId);
    const order: Record<Platoon['kind'], number> = {
      'combat': 0,
      'forward-command': 1,
      'hq': 2,
      'logistics': 3,
      'custom': 4,
    };
    return [...list].sort((a, b) => order[a.kind] - order[b.kind]);
  }, [platoons, myCompanyId]);

  const combatRows = platoonRows.filter((p) => p.kind === 'combat');
  const nonCombatRows = platoonRows.filter((p) => p.kind !== 'combat');

  // 30-day window starting today.
  const days = useMemo(() => {
    const start = startOfTodayIso();
    return Array.from({ length: DAYS_FORWARD }, (_, i) => addDaysIso(start, i));
  }, []);

  // O(1) lookup: status per (date, platoon).
  const leaveByKey = useMemo(() => {
    const m = new Map<string, 'home' | 'in-base' | 'partial'>();
    for (const d of platoonLeaveDays) {
      m.set(`${d.dateIso}::${d.platoonId}`, d.status);
    }
    return m;
  }, [platoonLeaveDays]);

  // Per-day analytics: how many combat platoons are home + total in-base
  // soldiers in company (rough — ignores per-soldier overrides for now).
  const platoonSoldiers = useMemo(() => {
    const m = new Map<string, Soldier[]>();
    for (const p of platoonRows) {
      const sqIds = new Set(squads.filter((sq) => sq.platoonId === p.id).map((sq) => sq.id));
      m.set(p.id, soldiers.filter((s) => s.squadId && sqIds.has(s.squadId)));
    }
    return m;
  }, [platoonRows, squads, soldiers]);

  const perDayStats = useMemo(() => {
    return days.map((iso) => {
      const platoonsHome = platoonRows.filter((p) => leaveByKey.get(`${iso}::${p.id}`) === 'home');
      const homeSoldierCount = platoonsHome.reduce(
        (acc, p) => acc + (platoonSoldiers.get(p.id)?.length ?? 0),
        0,
      );
      const totalCompanySoldiers = platoonRows.reduce(
        (acc, p) => acc + (platoonSoldiers.get(p.id)?.length ?? 0),
        0,
      );
      const inBaseSoldierCount = totalCompanySoldiers - homeSoldierCount;
      return {
        iso,
        platoonsHome: platoonsHome.map((p) => p.id),
        homeSoldierCount,
        inBaseSoldierCount,
        totalCompanySoldiers,
        // Warning: max-concurrent-home policy breach
        breachesConcurrentCap: platoonsHome.length > companyLeavePolicy.maxPlatoonsHome,
      };
    });
  }, [days, platoonRows, leaveByKey, platoonSoldiers, companyLeavePolicy.maxPlatoonsHome]);

  // Coverage rule evaluation per day — only the rules that map to
  // headcount/role minimums (cf. team-together / mutual-exclusion are
  // visualized but not auto-evaluated in this MVP).
  const coverageWarnings = useMemo(() => {
    const out: Array<{ iso: string; ruleLabel: string; detail: string }> = [];
    for (const iso of days) {
      const stats = perDayStats.find((s) => s.iso === iso);
      const homeSet = new Set(stats?.platoonsHome ?? []);
      const inBaseSoldiers: Soldier[] = [];
      for (const [pid, list] of platoonSoldiers.entries()) {
        if (!homeSet.has(pid)) inBaseSoldiers.push(...list);
      }
      for (const r of companyCoverageRules.rules) {
        if (r.kind === 'min-count-in-platoon') {
          const count = (platoonSoldiers.get(r.platoonId) ?? []).length
            - (homeSet.has(r.platoonId) ? (platoonSoldiers.get(r.platoonId)?.length ?? 0) : 0);
          if (count < r.min) {
            out.push({ iso, ruleLabel: r.label, detail: `${count}/${r.min} בבסיס` });
          }
        } else if (r.kind === 'min-with-functional-role') {
          const matches = inBaseSoldiers.filter((s) =>
            (s.functionalRoles ?? []).includes(r.functionalRole),
          );
          if (matches.length < r.min) {
            out.push({
              iso,
              ruleLabel: r.label,
              detail: `${matches.length}/${r.min}`,
            });
          }
        } else if (r.kind === 'min-with-operational-role') {
          const matches = inBaseSoldiers.filter((s) =>
            (s.operationalRoles ?? []).includes(r.operationalRole),
          );
          if (matches.length < r.min) {
            out.push({
              iso,
              ruleLabel: r.label,
              detail: `${matches.length}/${r.min}`,
            });
          }
        }
      }
    }
    return out;
  }, [days, perDayStats, companyCoverageRules.rules, platoonSoldiers]);

  // Worst-hit days (most warnings) — first 5
  const topWarningDays = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of coverageWarnings) counts.set(w.iso, (counts.get(w.iso) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([iso, count]) => ({ iso, count }));
  }, [coverageWarnings]);

  const [editingRulesOpen, setEditingRulesOpen] = useState(false);

  // ── Route gate ──────────────────────────────────────────────────
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!isCompanyLeadership(currentRole)) return <Navigate to="/home" replace />;

  // ── Mutations ───────────────────────────────────────────────────
  const handleToggleCell = (dateIso: string, platoonId: string) => {
    const current = leaveByKey.get(`${dateIso}::${platoonId}`);
    if (current === 'home') {
      clearPlatoonLeaveDay(dateIso, platoonId);
    } else {
      setPlatoonLeaveDay(dateIso, platoonId, 'home');
    }
  };

  const handleGenerateRotation = () => {
    const combatIds = combatRows.map((p) => p.id);
    if (combatIds.length === 0) return;
    generatePlatoonRotation({
      startDateIso: startOfTodayIso(),
      days: DAYS_FORWARD,
      order: combatIds,
    });
  };

  const handleClearAll = () => {
    if (!confirm('לאפס את כל מצב היציאות לעמודות הקדמיות?')) return;
    for (const d of platoonLeaveDays) {
      clearPlatoonLeaveDay(d.dateIso, d.platoonId);
    }
  };

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="ניהול יציאות פלוגתיות" />
      <PageMain>

        <header>
          <Eyebrow>ניהול תפעולי</Eyebrow>
          <PageTitle className="mt-1">יציאות הפלוגה</PageTitle>
          <Muted className="mt-1 text-tiny leading-relaxed">
            לוח 30 ימים קדימה. תא <strong>סגול</strong> = המחלקה בבית באותו יום. כשמחלקה בבית — המערכת לא תשבץ אותה למשימות (אלא אם תעשה override מודע).
          </Muted>
        </header>

        {/* Policy summary + actions */}
        <Section label="מדיניות">
          <div className="bg-mil-card border border-mil-border rounded-xl-soft p-4 space-y-3">
            <div className="flex items-baseline gap-2 flex-wrap">
              <Body className="font-bold">
                {companyLeavePolicy.mode === 'one-at-a-time' ? 'מחלקה אחת בבית בכל רגע'
                  : companyLeavePolicy.mode === 'two-at-a-time' ? 'שתי מחלקות בבית במקביל'
                  : 'סבב ידני'}
              </Body>
              <Hint className="text-mil-muted">
                · סטינט {companyLeavePolicy.homeStintDays} ימים · גאפ {companyLeavePolicy.minBaseGapDays} ימים
              </Hint>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => updateCompanyLeavePolicy({ mode: 'one-at-a-time', maxPlatoonsHome: 1 })}
                className={`text-tiny font-semibold px-3 py-1.5 rounded-md border transition-colors ${
                  companyLeavePolicy.mode === 'one-at-a-time'
                    ? 'bg-mil-olive text-white border-mil-olive'
                    : 'bg-mil-card text-mil-text border-mil-border hover:border-mil-olive'
                }`}
              >
                מחלקה אחת בבית
              </button>
              <button
                onClick={() => updateCompanyLeavePolicy({ mode: 'two-at-a-time', maxPlatoonsHome: 2 })}
                className={`text-tiny font-semibold px-3 py-1.5 rounded-md border transition-colors ${
                  companyLeavePolicy.mode === 'two-at-a-time'
                    ? 'bg-mil-olive text-white border-mil-olive'
                    : 'bg-mil-card text-mil-text border-mil-border hover:border-mil-olive'
                }`}
              >
                שתי מחלקות
              </button>
              <button
                onClick={() => updateCompanyLeavePolicy({ mode: 'manual' })}
                className={`text-tiny font-semibold px-3 py-1.5 rounded-md border transition-colors ${
                  companyLeavePolicy.mode === 'manual'
                    ? 'bg-mil-olive text-white border-mil-olive'
                    : 'bg-mil-card text-mil-text border-mil-border hover:border-mil-olive'
                }`}
              >
                ידני
              </button>
            </div>
            <div className="flex gap-2 flex-wrap pt-2 border-t border-mil-border">
              <Button variant="primary" size="sm" onClick={handleGenerateRotation}>
                ייצר סבב אוטומטי 30 ימים
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClearAll}>
                נקה הכל
              </Button>
            </div>
          </div>
        </Section>

        {/* Warnings strip */}
        {(topWarningDays.length > 0 || perDayStats.some((d) => d.breachesConcurrentCap)) && (
          <Section label="אזהרות כיסוי">
            <div className="bg-mil-warn-bg border border-mil-warn-border rounded-xl-soft p-4 space-y-2">
              {perDayStats.filter((d) => d.breachesConcurrentCap).slice(0, 3).map((d) => (
                <div key={d.iso} className="text-sm text-mil-warn">
                  <span className="font-bold">{shortDate(d.iso)}</span>
                  {' — '}
                  {d.platoonsHome.length} מחלקות בבית, המדיניות מתירה {companyLeavePolicy.maxPlatoonsHome}
                </div>
              ))}
              {topWarningDays.map(({ iso, count }) => (
                <div key={iso} className="text-sm text-mil-warn">
                  <span className="font-bold">{shortDate(iso)}</span>
                  {' — '}{count} חוקי כיסוי שבורים
                </div>
              ))}
              <Hint className="block text-tiny text-mil-muted pt-1 border-t border-mil-warn-border">
                לחץ על תא ביום כדי לערוך · עבור כל יום, המערכת בודקת את כל חוקי הכיסוי.
              </Hint>
            </div>
          </Section>
        )}

        {/* Combat platoons grid */}
        <Section label="לוח מחלקות קרביות">
          <div className="bg-mil-card border border-mil-border rounded-xl-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-tiny tabular-nums" dir="rtl">
                <thead>
                  <tr className="bg-mil-bg-alt border-b border-mil-border">
                    <th className="px-3 py-2 text-right font-semibold text-mil-muted whitespace-nowrap sticky right-0 bg-mil-bg-alt">
                      מחלקה
                    </th>
                    {days.map((iso) => (
                      <th key={iso} className="px-1 py-2 font-mono text-mil-muted min-w-[36px]">
                        <div className="text-xxs">{weekdayShort(iso)}</div>
                        <div>{shortDate(iso).slice(0, 5)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {combatRows.map((p) => (
                    <tr key={p.id} className="border-b border-mil-border">
                      <td className="px-3 py-2 font-semibold text-mil-text whitespace-nowrap sticky right-0 bg-mil-card">
                        {p.name}
                      </td>
                      {days.map((iso) => {
                        const status = leaveByKey.get(`${iso}::${p.id}`);
                        const isHome = status === 'home';
                        return (
                          <td
                            key={iso}
                            className="px-1 py-1 text-center"
                          >
                            <button
                              onClick={() => handleToggleCell(iso, p.id)}
                              className={`w-7 h-7 rounded-md text-xxs font-bold transition-all ${
                                isHome
                                  ? 'bg-mil-olive text-white shadow-card'
                                  : 'bg-mil-bg-alt text-mil-muted hover:bg-mil-card-warm'
                              }`}
                              title={`${p.name} · ${shortDate(iso)} · ${isHome ? 'בבית' : 'בבסיס'}`}
                            >
                              {isHome ? 'ב' : '·'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        {/* Non-combat platoons (CHAPAK / MAFLAG) — different model */}
        {nonCombatRows.length > 0 && (
          <Section label="חפ״ק / מפלג — כיסוי תפעולי">
            <div className="bg-mil-card border border-mil-border rounded-xl-soft p-4 space-y-2">
              <Hint className="block text-mil-muted leading-snug">
                חפ״ק ומפלג לא יוצאים כיחידה. הם פועלים לפי חוקי כיסוי (מינימום נוכחות, צוותים קבועים).
                ניתן לערוך חוקים למטה.
              </Hint>
              <div className="flex gap-2 flex-wrap pt-2">
                {nonCombatRows.map((p) => {
                  const members = platoonSoldiers.get(p.id) ?? [];
                  return (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1.5 text-xxs font-semibold px-2.5 py-1 rounded-md bg-mil-info-bg text-mil-info border border-mil-info-border"
                    >
                      {p.name} · {members.length} חיילים
                    </span>
                  );
                })}
              </div>
            </div>
          </Section>
        )}

        {/* Coverage Rules editor */}
        <Section
          label={`חוקי כיסוי · ${companyCoverageRules.rules.length}`}
          action={(
            <button
              onClick={() => setEditingRulesOpen((v) => !v)}
              className="text-tiny font-semibold text-mil-olive"
            >
              {editingRulesOpen ? 'סיום' : 'ערוך'}
            </button>
          )}
        >
          <div className="bg-mil-card border border-mil-border rounded-xl-soft divide-y divide-mil-border overflow-hidden">
            {companyCoverageRules.rules.map((r) => (
              <CoverageRuleRow
                key={r.id}
                rule={r}
                editing={editingRulesOpen}
                onRemove={() => removeCoverageRule(r.id)}
                platoons={platoonRows}
              />
            ))}
            {companyCoverageRules.rules.length === 0 && (
              <div className="px-4 py-3">
                <Muted className="text-tiny">לא הוגדרו חוקי כיסוי.</Muted>
              </div>
            )}
          </div>
        </Section>

        {/* Footer link */}
        <button
          onClick={() => navigate('/home')}
          className="w-full text-center text-tiny font-semibold text-mil-muted hover:text-mil-text py-2"
        >
          חזרה ←
        </button>
      </PageMain>
    </div>
  );
}

// ─── Coverage rule row ──────────────────────────────────────────────

function CoverageRuleRow({
  rule, editing, onRemove, platoons,
}: {
  rule: CoverageRule;
  editing: boolean;
  onRemove: () => void;
  platoons: Platoon[];
}) {
  const detail = (() => {
    if (rule.kind === 'min-count-in-platoon') {
      const p = platoons.find((x) => x.id === rule.platoonId);
      return `${p?.name ?? rule.platoonId} · מינימום ${rule.min}`;
    }
    if (rule.kind === 'min-with-functional-role') {
      return `תפקיד ${rule.functionalRole} · מינימום ${rule.min}${rule.scopePlatoonId ? ` ב-${platoons.find((p) => p.id === rule.scopePlatoonId)?.name}` : ''}`;
    }
    if (rule.kind === 'min-with-operational-role') {
      return `תפקיד ${rule.operationalRole} · מינימום ${rule.min}${rule.scopePlatoonId ? ` ב-${platoons.find((p) => p.id === rule.scopePlatoonId)?.name}` : ''}`;
    }
    if (rule.kind === 'team-together') {
      return `${rule.soldierIds.length} חיילים · נשארים יחד`;
    }
    if (rule.kind === 'mutual-exclusion') {
      return `${rule.soldierIds.length} חיילים · לא ביחד בבית`;
    }
    return '';
  })();
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <Body className="font-semibold leading-tight">{rule.label}</Body>
        <Hint className="text-mil-muted">{detail}</Hint>
      </div>
      {editing && (
        <button
          onClick={onRemove}
          className="text-tiny font-semibold text-mil-alert hover:bg-mil-alert-bg px-2 py-1 rounded-md"
        >
          מחק ←
        </button>
      )}
    </div>
  );
}
