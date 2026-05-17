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

// Blocked-date kind visuals — used in column headers + tooltips.
const BLOCKED_KIND_ICON: Record<import('../types').CompanyBlockedDateKind, string> = {
  'line-up':    '🎯',
  'line-down':  '🏁',
  'credit':     '🏖',
  'drill':      '🎖',
  'inspection': '🔍',
  'op-event':   '🚨',
  'other':      '📌',
};
const BLOCKED_KIND_LABEL: Record<import('../types').CompanyBlockedDateKind, string> = {
  'line-up':    'עליה לקו',
  'line-down':  'ירידה מהקו',
  'credit':     'זיכוי בסיס',
  'drill':      'תרגיל',
  'inspection': 'ביקורת',
  'op-event':   'אירוע מבצעי',
  'other':      'אחר',
};

export default function PlatoonLeaveBoardPage() {
  const navigate = useNavigate();
  const {
    currentUser, currentRole, platoons, squads, soldiers,
    platoonLeaveDays, companyLeavePolicy, companyCoverageRules,
    companyBlockedDates,
    setPlatoonLeaveDay, clearPlatoonLeaveDay, generatePlatoonRotation,
    updateCompanyLeavePolicy, removeCoverageRule, upsertCoverageRule,
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
        } else if (r.kind === 'command-coverage') {
          // OR-of-roles: a soldier counts if ANY of their operational
          // roles appears in the rule's anyOfRoles set.
          const scoped = r.scopePlatoonId
            ? inBaseSoldiers.filter((s) => {
                const squad = squads.find((sq) => sq.id === s.squadId);
                return squad?.platoonId === r.scopePlatoonId;
              })
            : inBaseSoldiers;
          const matches = scoped.filter((s) =>
            (s.operationalRoles ?? []).some((role) => r.anyOfRoles.includes(role)),
          );
          if (matches.length < r.min) {
            out.push({
              iso,
              ruleLabel: r.label,
              detail: `${matches.length}/${r.min}`,
            });
          }
        } else if (r.kind === 'personal-leave-buffer') {
          // Approximation: free buffer = in-base count in scope.
          // Mission demand is NOT yet subtracted — the rule represents
          // the operator's intent and warns when in-base count drops
          // below the configured buffer target. A future slice can
          // refine this once the leave board reads materializer demand.
          const scopeSize = r.scopePlatoonId
            ? (platoonSoldiers.get(r.scopePlatoonId)?.length ?? 0)
            : Array.from(platoonSoldiers.values()).reduce((sum, list) => sum + list.length, 0);
          const scoped = r.scopePlatoonId
            ? inBaseSoldiers.filter((s) => {
                const squad = squads.find((sq) => sq.id === s.squadId);
                return squad?.platoonId === r.scopePlatoonId;
              })
            : inBaseSoldiers;
          const target = r.asPercent
            ? Math.round((r.min / 100) * scopeSize)
            : r.min;
          if (scoped.length < target) {
            out.push({
              iso,
              ruleLabel: r.label,
              detail: r.asPercent
                ? `${scoped.length}/${target} (${r.min}%)`
                : `${scoped.length}/${target}`,
            });
          }
        }
      }
    }
    return out;
  }, [days, perDayStats, companyCoverageRules.rules, platoonSoldiers, squads]);

  // Worst-hit days (most warnings) — first 5
  const topWarningDays = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of coverageWarnings) counts.set(w.iso, (counts.get(w.iso) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([iso, count]) => ({ iso, count }));
  }, [coverageWarnings]);

  // ── Visual overlay indexes (Phase 7.3 control-center upgrade) ────
  // Blocked dates → per-date lookup so column headers can tint + show
  // the kind glyph. Per-day-per-platoon transition markers so cells
  // at the start/end of a home stint show ↗ entering or ↙ leaving.
  // Cell-level coverage warning lookup so the offending CELL itself
  // shows the warning ring, not just a worst-day list above the grid.

  const blockedByDate = useMemo(() => {
    const m = new Map<string, typeof companyBlockedDates[number]>();
    for (const d of companyBlockedDates.filter((b) => b.companyId === myCompanyId)) {
      m.set(d.dateIso, d);
    }
    return m;
  }, [companyBlockedDates, myCompanyId]);

  const todayIso = startOfTodayIso();

  const warningsByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of coverageWarnings) m.set(w.iso, (m.get(w.iso) ?? 0) + 1);
    return m;
  }, [coverageWarnings]);

  // Operational recommendations — derived from current state. Each is
  // a short Hebrew note the operator should see at the top of the
  // board. Pure, no engine call.
  const recommendations = useMemo(() => {
    const out: Array<{ tone: 'good' | 'info' | 'warn'; text: string }> = [];
    // Capacity breach summary
    const breaches = perDayStats.filter((d) => d.breachesConcurrentCap);
    if (breaches.length > 0) {
      out.push({
        tone: 'warn',
        text: `${breaches.length} ימים עם יותר מ-${companyLeavePolicy.maxPlatoonsHome} מחלקות בבית בו זמנית — שקול לפצל את הסבב.`,
      });
    }
    // Coverage rule heatmap
    const totalRuleBreaks = coverageWarnings.length;
    if (totalRuleBreaks > 0) {
      out.push({
        tone: 'warn',
        text: `${totalRuleBreaks} הפרות חוקי כיסוי לאורך החודש — בדוק את הימים המסומנים בלוח.`,
      });
    }
    // Fairness — most-home platoon vs least-home
    const homeCount = new Map<string, number>();
    for (const p of combatRows) homeCount.set(p.id, 0);
    for (const d of platoonLeaveDays) {
      if (d.status === 'home' && d.dateIso >= todayIso && homeCount.has(d.platoonId)) {
        homeCount.set(d.platoonId, (homeCount.get(d.platoonId) ?? 0) + 1);
      }
    }
    const counts = Array.from(homeCount.entries());
    if (counts.length >= 2) {
      counts.sort((a, b) => b[1] - a[1]);
      const top = counts[0], bottom = counts[counts.length - 1];
      const spread = top[1] - bottom[1];
      if (spread >= 4) {
        const topName = combatRows.find((p) => p.id === top[0])?.name ?? top[0];
        const botName = combatRows.find((p) => p.id === bottom[0])?.name ?? bottom[0];
        out.push({
          tone: 'info',
          text: `איזון: ${topName} בבית ${top[1]} ימים, ${botName} רק ${bottom[1]}. שקול להחליף כמה תאריכים.`,
        });
      } else if (spread <= 1 && top[1] > 0) {
        out.push({ tone: 'good', text: 'הסבב מאוזן בין המחלקות החודש.' });
      }
    }
    // Blocked dates summary
    const futureBlocked = Array.from(blockedByDate.values())
      .filter((b) => b.dateIso >= todayIso);
    if (futureBlocked.length > 0) {
      out.push({
        tone: 'info',
        text: `${futureBlocked.length} תאריכים חסומים מסומנים בלוח (עליה לקו, תרגיל, אירוע מבצעי...).`,
      });
    }
    if (out.length === 0) {
      out.push({ tone: 'good', text: 'הלוח נראה תקין. אין הפרות חוקים, סבב מאוזן.' });
    }
    return out;
  }, [perDayStats, coverageWarnings, combatRows, platoonLeaveDays, todayIso, companyLeavePolicy.maxPlatoonsHome, blockedByDate]);

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
          <button
            onClick={() => navigate('/coverage/planning')}
            className="mt-3 inline-flex items-baseline gap-2 px-3.5 py-2 rounded-xl-soft bg-mil-olive-bg/70 hover:bg-mil-olive-bg text-mil-olive-dim hover:text-mil-olive text-tiny font-bold transition-colors"
          >
            תכנון יציאות פלוגתיות (Wizard)
            <span aria-hidden>←</span>
          </button>
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

        {/* Recommendations + state summary — Phase 7.3 visual layer.
            Shows operator-facing notes derived from the current state
            before they look at the grid. Tonal, scannable. */}
        <Section label="המלצות מערכת">
          <div className="space-y-1.5">
            {recommendations.map((r, i) => (
              <div
                key={i}
                className={`rounded-xl-soft px-3.5 py-2 text-tiny leading-snug border ${
                  r.tone === 'warn'
                    ? 'bg-mil-warn-bg border-mil-warn text-mil-warn'
                    : r.tone === 'good'
                      ? 'bg-mil-success-bg border-mil-success-border text-mil-success'
                      : 'bg-mil-info-bg border-mil-info-border text-mil-info'
                }`}
              >
                <span className="font-bold uppercase tracking-wide ml-1.5">
                  {r.tone === 'warn' ? 'שים לב' : r.tone === 'good' ? 'תקין' : 'הערה'}
                </span>
                {r.text}
              </div>
            ))}
          </div>
        </Section>

        {/* Combat platoons grid — visual control board.
            Column header tints + glyphs for blocked dates and the
            "today" marker. Per-cell visuals show: home/base state +
            transition arrow (↗ first home day, ↙ last home day) +
            coverage warning ring when this day breaks a rule. */}
        <Section label="לוח מחלקות קרביות">
          {/* Mini-legend */}
          <div className="flex items-baseline gap-3 mb-2 text-tiny text-mil-muted flex-wrap">
            <span className="inline-flex items-baseline gap-1.5">
              <span className="w-3 h-3 rounded bg-mil-olive inline-block" />
              בבית
            </span>
            <span className="inline-flex items-baseline gap-1.5">
              <span className="w-3 h-3 rounded bg-mil-bg-alt border border-mil-border inline-block" />
              בבסיס
            </span>
            <span className="inline-flex items-baseline gap-1.5">
              <span className="text-mil-warn text-xs">⚠</span>
              חוק כיסוי שבור
            </span>
            <span className="inline-flex items-baseline gap-1.5">
              <span className="text-mil-info text-xs">🎯</span>
              תאריך חסום
            </span>
            <span className="inline-flex items-baseline gap-1.5">
              <span className="text-mil-success text-xs">↗ / ↙</span>
              יוצא / חוזר
            </span>
          </div>

          <div className="bg-mil-card border border-mil-border rounded-xl-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-tiny tabular-nums" dir="rtl">
                <thead>
                  <tr className="bg-mil-bg-alt border-b border-mil-border">
                    <th className="px-3 py-2 text-right font-semibold text-mil-muted whitespace-nowrap sticky right-0 bg-mil-bg-alt">
                      מחלקה
                    </th>
                    {days.map((iso) => {
                      const isToday = iso === todayIso;
                      const isSat = new Date(iso).getDay() === 6;
                      const blocked = blockedByDate.get(iso);
                      const dayWarnCount = warningsByDay.get(iso) ?? 0;
                      const tone =
                        blocked ? 'bg-mil-info-bg text-mil-info border-l border-mil-info-border'
                        : isToday ? 'bg-mil-olive-bg text-mil-olive-dim ring-1 ring-mil-olive ring-inset'
                        : isSat   ? 'bg-mil-card-warm text-mil-muted'
                        : 'text-mil-muted';
                      return (
                        <th
                          key={iso}
                          className={`px-1 py-2 font-mono min-w-[36px] ${tone}`}
                          title={blocked ? `${BLOCKED_KIND_LABEL[blocked.kind]} · ${blocked.reason ?? ''}` : isToday ? 'היום' : ''}
                        >
                          <div className="text-xxs flex items-baseline justify-center gap-0.5">
                            {weekdayShort(iso)}
                            {blocked && <span className="text-[10px]">{BLOCKED_KIND_ICON[blocked.kind]}</span>}
                            {!blocked && dayWarnCount > 0 && <span className="text-mil-warn">⚠</span>}
                          </div>
                          <div>{shortDate(iso).slice(0, 5)}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {combatRows.map((p) => (
                    <tr key={p.id} className="border-b border-mil-border">
                      <td className="px-3 py-2 font-semibold text-mil-text whitespace-nowrap sticky right-0 bg-mil-card">
                        {p.name}
                      </td>
                      {days.map((iso, idx) => {
                        const status = leaveByKey.get(`${iso}::${p.id}`);
                        const isHome = status === 'home';
                        const blocked = blockedByDate.get(iso);

                        // Transition markers: ↗ for first day of a home
                        // stint (yesterday was NOT home), ↙ for the
                        // last day (tomorrow is NOT home).
                        const prevIso = idx > 0 ? days[idx - 1] : null;
                        const nextIso = idx < days.length - 1 ? days[idx + 1] : null;
                        const prevHome = prevIso ? leaveByKey.get(`${prevIso}::${p.id}`) === 'home' : false;
                        const nextHome = nextIso ? leaveByKey.get(`${nextIso}::${p.id}`) === 'home' : false;
                        const isEnteringHome = isHome && !prevHome;
                        const isLeavingHome  = isHome && !nextHome;

                        // A cell with at least one rule-warning shows
                        // a soft warning ring. Today's column adds an
                        // additional olive ring outside.
                        const dayWarnCount = warningsByDay.get(iso) ?? 0;
                        const blockedOverride = blocked?.requireAllInBase && isHome;

                        return (
                          <td
                            key={iso}
                            className={`px-1 py-1 text-center relative ${
                              iso === todayIso ? 'bg-mil-olive-bg/30' :
                              new Date(iso).getDay() === 6 ? 'bg-mil-card-warm/40' :
                              ''
                            }`}
                          >
                            <button
                              onClick={() => handleToggleCell(iso, p.id)}
                              className={`relative w-7 h-7 rounded-md text-xxs font-bold transition-all ${
                                isHome
                                  ? blockedOverride
                                    ? 'bg-mil-alert text-white shadow-card'
                                    : 'bg-mil-olive text-white shadow-card'
                                  : 'bg-mil-bg-alt text-mil-muted hover:bg-mil-card-warm'
                              } ${dayWarnCount > 0 ? 'ring-2 ring-mil-warn/60' : ''}`}
                              title={[
                                `${p.name} · ${shortDate(iso)}`,
                                isHome ? 'בבית' : 'בבסיס',
                                blocked ? `[חסום: ${BLOCKED_KIND_LABEL[blocked.kind]}]` : null,
                                blockedOverride ? '⚠ סתירה: יום חסום + מחלקה בבית' : null,
                                dayWarnCount > 0 ? `${dayWarnCount} חוקי כיסוי שבורים` : null,
                              ].filter(Boolean).join(' · ')}
                            >
                              {isHome ? 'ב' : '·'}
                              {isEnteringHome && (
                                <span
                                  className="absolute -top-1 -left-1 text-[9px] text-mil-success font-extrabold pointer-events-none"
                                  aria-hidden
                                >↗</span>
                              )}
                              {isLeavingHome && (
                                <span
                                  className="absolute -bottom-1 -right-1 text-[9px] text-mil-info font-extrabold pointer-events-none"
                                  aria-hidden
                                >↙</span>
                              )}
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
          {editingRulesOpen && (
            <CoverageRuleAddForm
              platoons={platoonRows}
              onAdd={(rule) => upsertCoverageRule(rule)}
            />
          )}
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

// ─── Coverage rule ADD form ─────────────────────────────────────────

type RuleKind =
  | 'min-count-in-platoon'
  | 'min-with-functional-role'
  | 'command-coverage'
  | 'personal-leave-buffer';

// Command-coverage role presets — operator can pick any subset.
// Default "command" set covers the canonical OR rule: at any time at
// least one of {מ״מ, סמל, מ״כ} must be in base.
const COMMAND_ROLE_OPTIONS: import('../types').OperationalRole[] = [
  'מ״מ', 'סמל', 'מ״כ', 'סמ״פ', 'מ״פ',
];

function CoverageRuleAddForm({
  platoons, onAdd,
}: {
  platoons: Platoon[];
  onAdd: (rule: CoverageRule) => void;
}) {
  const [kind, setKind] = useState<RuleKind>('min-count-in-platoon');
  const [platoonId, setPlatoonId] = useState<string>(platoons[0]?.id ?? '');
  const [functionalRole, setFunctionalRole] = useState<string>('driver');
  const [minCount, setMinCount] = useState<number>(1);
  const [label, setLabel] = useState<string>('');
  const [commandRoles, setCommandRoles] = useState<import('../types').OperationalRole[]>(['מ״מ', 'סמל', 'מ״כ']);
  const [bufferAsPercent, setBufferAsPercent] = useState<boolean>(false);
  const [bufferScope, setBufferScope] = useState<string>('');  // '' = company-wide

  const FUNCTIONAL_ROLE_OPTIONS = [
    { id: 'driver',                 label: 'נהג' },
    { id: 'mashak-kesher',          label: 'מש״ק קשר' },
    { id: 'rasap',                  label: 'רס״פ' },
    { id: 'srasap',                 label: 'סרס״פ' },
    { id: 'shalish',                label: 'שליש' },
    { id: 'equipment-lead-chapack', label: 'אחראי ציוד חפ״ק' },
    { id: 'equipment-lead',         label: 'אחראי ציוד מפלג' },
    { id: 'kitchen-lead',           label: 'אחראי מטבח' },
    { id: 'water-lead',             label: 'אחראי מים' },
    { id: 'comms-lead',             label: 'אחראי קשר' },
    { id: 'drone-operator',         label: 'מפעיל רחפן' },
  ];

  const toggleCommandRole = (role: import('../types').OperationalRole) => {
    setCommandRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const handleAdd = () => {
    const id = `cr-${Date.now()}`;
    if (kind === 'min-count-in-platoon') {
      const p = platoons.find((x) => x.id === platoonId);
      const finalLabel = label.trim() || `מינימום ${minCount} מ-${p?.name ?? 'מחלקה'}`;
      onAdd({
        id,
        kind: 'min-count-in-platoon',
        label: finalLabel,
        platoonId,
        min: minCount,
      });
    } else if (kind === 'min-with-functional-role') {
      const role = FUNCTIONAL_ROLE_OPTIONS.find((r) => r.id === functionalRole);
      const finalLabel = label.trim() || `מינימום ${minCount} × ${role?.label ?? functionalRole}`;
      onAdd({
        id,
        kind: 'min-with-functional-role',
        label: finalLabel,
        functionalRole: functionalRole as CoverageRule extends { kind: 'min-with-functional-role'; functionalRole: infer T } ? T : never,
        min: minCount,
      });
    } else if (kind === 'command-coverage') {
      if (commandRoles.length === 0) return;
      const finalLabel = label.trim()
        || `${minCount} מ-${commandRoles.join(' / ')}`;
      onAdd({
        id,
        kind: 'command-coverage',
        label: finalLabel,
        anyOfRoles: commandRoles,
        min: minCount,
      });
    } else if (kind === 'personal-leave-buffer') {
      const scope = bufferScope || undefined;
      const scopeName = scope ? platoons.find((p) => p.id === scope)?.name : 'הפלוגה';
      const finalLabel = label.trim()
        || (bufferAsPercent
            ? `מרווח יציאות אישיות ב-${scopeName}: ${minCount}%`
            : `מרווח יציאות אישיות ב-${scopeName}: ${minCount} חיילים`);
      onAdd({
        id,
        kind: 'personal-leave-buffer',
        label: finalLabel,
        min: minCount,
        asPercent: bufferAsPercent,
        scopePlatoonId: scope,
      });
    }
    setLabel('');
    setMinCount(1);
  };

  return (
    <div className="mt-3 bg-mil-bg-alt border border-mil-border rounded-xl-soft p-4 space-y-2.5">
      <Hint className="block font-semibold text-mil-muted">+ חוק כיסוי חדש</Hint>
      <div className="flex gap-1.5 flex-wrap">
        <KindChip active={kind === 'min-count-in-platoon'} onClick={() => setKind('min-count-in-platoon')}>
          מינימום במחלקה
        </KindChip>
        <KindChip active={kind === 'min-with-functional-role'} onClick={() => setKind('min-with-functional-role')}>
          תפקיד
        </KindChip>
        <KindChip active={kind === 'command-coverage'} onClick={() => setKind('command-coverage')}>
          פיקוד בבסיס
        </KindChip>
        <KindChip active={kind === 'personal-leave-buffer'} onClick={() => setKind('personal-leave-buffer')}>
          מרווח אישי
        </KindChip>
      </div>

      {kind === 'min-count-in-platoon' && (
        <select
          value={platoonId}
          onChange={(e) => setPlatoonId(e.target.value)}
          className="w-full bg-mil-card border border-mil-border rounded-md px-3 py-2 text-sm text-mil-text"
        >
          {platoons.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      )}

      {kind === 'min-with-functional-role' && (
        <select
          value={functionalRole}
          onChange={(e) => setFunctionalRole(e.target.value)}
          className="w-full bg-mil-card border border-mil-border rounded-md px-3 py-2 text-sm text-mil-text"
        >
          {FUNCTIONAL_ROLE_OPTIONS.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
      )}

      {kind === 'command-coverage' && (
        <div>
          <Hint className="block mb-1.5 text-mil-muted">
            מינימום אחד מבעלי תפקיד הפיקוד הבאים יהיה בבסיס בכל רגע
          </Hint>
          <div className="flex flex-wrap gap-1.5">
            {COMMAND_ROLE_OPTIONS.map((role) => {
              const on = commandRoles.includes(role);
              return (
                <button
                  key={role}
                  onClick={() => toggleCommandRole(role)}
                  className={`px-2.5 py-1 rounded-md text-tiny font-bold transition-colors ${
                    on
                      ? 'bg-mil-olive text-white'
                      : 'bg-mil-card border border-mil-border text-mil-muted hover:border-mil-olive'
                  }`}
                >
                  {role}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {kind === 'personal-leave-buffer' && (
        <div className="space-y-2">
          <div>
            <Hint className="block mb-1.5 text-mil-muted">תחום</Hint>
            <select
              value={bufferScope}
              onChange={(e) => setBufferScope(e.target.value)}
              className="w-full bg-mil-card border border-mil-border rounded-md px-3 py-2 text-sm text-mil-text"
            >
              <option value="">כל הפלוגה</option>
              {platoons.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-1.5">
            <KindChip active={!bufferAsPercent} onClick={() => setBufferAsPercent(false)}>
              ערך מוחלט
            </KindChip>
            <KindChip active={bufferAsPercent} onClick={() => setBufferAsPercent(true)}>
              אחוז
            </KindChip>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Hint className="text-mil-muted">
          {kind === 'personal-leave-buffer'
            ? (bufferAsPercent ? 'אחוז' : 'מינימום')
            : 'מינימום'}
        </Hint>
        <input
          type="number"
          min={1}
          max={kind === 'personal-leave-buffer' && bufferAsPercent ? 100 : undefined}
          value={minCount}
          onChange={(e) => setMinCount(Math.max(1, parseInt(e.target.value || '1', 10)))}
          className="w-20 bg-mil-card border border-mil-border rounded-md px-3 py-2 text-sm text-mil-text font-mono tabular-nums"
          dir="ltr"
        />
        {kind === 'personal-leave-buffer' && bufferAsPercent && (
          <span className="text-mil-muted text-sm">%</span>
        )}
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="תווית (אופציונלי)"
          className="flex-1 bg-mil-card border border-mil-border rounded-md px-3 py-2 text-sm text-mil-text"
        />
      </div>

      <Button variant="primary" size="md" fullWidth onClick={handleAdd}>
        הוסף חוק
      </Button>

      {kind === 'personal-leave-buffer' && (
        <Muted className="text-tiny leading-snug">
          הערה: כרגע הבדיקה משווה רק את ספירת החיילים בבסיס מול היעד.
          דרישת איוש משימות פעילות לא נכללת עדיין בחישוב — תיווסף בעדכון עתידי.
        </Muted>
      )}
    </div>
  );
}

function KindChip({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-tiny font-semibold px-3 py-1.5 rounded-md border transition-colors ${
        active
          ? 'bg-mil-olive text-white border-mil-olive'
          : 'bg-mil-card text-mil-text border-mil-border hover:border-mil-olive'
      }`}
    >
      {children}
    </button>
  );
}

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
    if (rule.kind === 'command-coverage') {
      const scope = rule.scopePlatoonId
        ? ` ב-${platoons.find((p) => p.id === rule.scopePlatoonId)?.name}`
        : '';
      return `מינימום ${rule.min} מ-{${rule.anyOfRoles.join(' / ')}}${scope}`;
    }
    if (rule.kind === 'personal-leave-buffer') {
      const scope = rule.scopePlatoonId
        ? platoons.find((p) => p.id === rule.scopePlatoonId)?.name ?? rule.scopePlatoonId
        : 'הפלוגה';
      return rule.asPercent
        ? `מרווח יציאות אישיות ב-${scope}: ${rule.min}%`
        : `מרווח יציאות אישיות ב-${scope}: ${rule.min} חיילים`;
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
