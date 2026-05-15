// EngineDebugPage — chaos simulation surface.
//
// Pre-production-only screen for CC/Deputy to verify engine reactions
// under operational chaos WITHOUT touching live data. Pick a scenario,
// see how the engine outputs change, validate that alerts surface
// correctly, replacements are suggested, and focus items shift.
//
// Visible only at /engine/debug — not linked from the main UI. The
// banner at the top is the contract: while chaos is active, anyone
// viewing this screen must understand the data is synthetic.

import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp, useMyCompany, useMyPlatoons } from '../context/AppContext';
import { isCompanyLeadership } from '../utils/permissions';
import {
  useChaosContext, CHAOS_SCENARIOS,
  type ChaosScenarioKind, type ChaosScenarioOptions, type ChaosState,
} from '../hooks/useChaosContext';
import { materializeWeek } from '../utils/materialize';
import { selectCandidates } from '../utils/engine/selector';
import Header from '../components/Header';
import {
  Eyebrow, Section, PageMain, PageTitle, Body, Muted, Hint, Card,
} from '../components/ui';
import type { MaterializedSlot } from '../utils/materialize';

export default function EngineDebugPage() {
  const navigate = useNavigate();
  const { currentRole, currentUser, equipmentItems } = useApp();
  const myCompany = useMyCompany();
  const myPlatoons = useMyPlatoons();

  // Hooks-first; gate after.
  const [scenarios, setScenarios] = useState<ChaosScenarioOptions[]>([]);
  const chaosState: ChaosState = useMemo(
    () => ({ active: scenarios.length > 0, scenarios }),
    [scenarios],
  );
  const ctx = useChaosContext(chaosState);

  // Materialize the chaos-altered context's slots so we can show how
  // the engine reacts. We materialize using the live AppContext shape
  // — the chaos hook handles soldiers/leaves overrides via the ctx.
  const todayStart = useMemo(() => {
    const d = new Date(ctx.computedAt);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [ctx.computedAt]);

  const slots = useMemo(
    () => materializeWeek({
      missions: ctx.missions,
      platoons: ctx.platoons,
      squads: ctx.squads,
      soldiers: ctx.soldiers,
      leaves: ctx.leaves,
      dutyExclusions: ctx.dutyExclusions,
      startDay: todayStart,
      days: 3,
    }),
    [ctx, todayStart],
  );

  // Pick the first under-staffed slot to demonstrate engine selection.
  const demoSlot: MaterializedSlot | null = useMemo(() => {
    return slots.find((s) => s.assignedSoldierIds.length < s.requiredCount) ?? slots[0] ?? null;
  }, [slots]);

  const outcome = useMemo(() => {
    if (!demoSlot) return null;
    const mission = ctx.missions.find((m) => m.id === demoSlot.missionId);
    if (!mission) return null;
    const platoonIds = new Set(mission.assignedPlatoonIds);
    const squadIds = new Set(ctx.squads.filter((sq) => platoonIds.has(sq.platoonId)).map((sq) => sq.id));
    const pool = ctx.soldiers.filter((s) => s.squadId && squadIds.has(s.squadId));
    return selectCandidates(demoSlot, pool, ctx, {
      requiredCount: demoSlot.requiredCount,
      acceptForced: false,
    });
  }, [demoSlot, ctx]);

  // CC-only gate (and only when the build target is dev).
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!isCompanyLeadership(currentRole)) return <Navigate to="/home" replace />;

  const toggleScenario = (kind: ChaosScenarioKind, opts: Partial<ChaosScenarioOptions> = {}) => {
    setScenarios((prev) => {
      const exists = prev.find((s) => s.kind === kind);
      if (exists) {
        return prev.filter((s) => s.kind !== kind);
      }
      const catalog = CHAOS_SCENARIOS.find((c) => c.kind === kind);
      return [...prev, {
        kind,
        ...catalog?.defaults,
        ...opts,
      }];
    });
  };

  const clearAll = () => setScenarios([]);

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="Engine Debug" />

      {/* Persistent warning banner — chaos always visible */}
      {chaosState.active && (
        <div
          role="alert"
          className="bg-mil-sand text-mil-text px-4 py-2 sticky top-0 z-40 border-b border-mil-sand/40 flex items-center gap-2"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-mil-text" aria-hidden />
          <Body className="text-tiny font-bold flex-1">
            ⚠ CHAOS MODE — נתונים סינתטיים, לא live
          </Body>
          <button
            onClick={clearAll}
            className="text-tiny font-semibold underline hover:no-underline"
          >
            סגור הכל
          </button>
        </div>
      )}

      <PageMain>
        <header>
          <Eyebrow>{myCompany?.name ?? 'פלוגה'} · Engine Debug</Eyebrow>
          <PageTitle className="mt-1">סימולציית chaos</PageTitle>
          <Muted className="mt-1.5 text-sm leading-relaxed">
            בחר תרחיש או יותר. ה-engine מקבל context משוכפל עם ה-overrides ומראה
            איך הוא מגיב — בלי לגעת ב-state live של הפלוגה.
          </Muted>
        </header>

        {/* Scenario picker — split into chaos + recovery groups */}
        {(['chaos', 'recovery'] as const).map((category) => {
          const items = CHAOS_SCENARIOS.filter((s) => s.category === category);
          if (items.length === 0) return null;
          const label = category === 'chaos' ? 'תרחישי chaos' : 'תרחישי recovery';
          return (
            <Section key={category} label={label}>
              <div className="space-y-2">
                {items.map((s) => {
                  const active = scenarios.some((sc) => sc.kind === s.kind);
                  const tone = category === 'recovery'
                    ? (active ? 'bg-mil-success-bg border-mil-success text-mil-text' : 'bg-mil-card border-mil-border hover:border-mil-border-strong')
                    : (active ? 'bg-mil-sand-bg border-mil-sand text-mil-text' : 'bg-mil-card border-mil-border hover:border-mil-border-strong');
                  return (
                    <button
                      key={s.kind}
                      onClick={() => {
                        if ((s.kind === 'platoon-home' || s.kind === 'platoon-returned') && myPlatoons[0]) {
                          toggleScenario(s.kind, { platoonId: myPlatoons[0].id });
                        } else if (s.kind === 'equipment-missing' && equipmentItems[0]) {
                          toggleScenario(s.kind, { equipmentItemId: equipmentItems[0].id });
                        } else {
                          toggleScenario(s.kind);
                        }
                      }}
                      className={`w-full text-right rounded-xl-soft border transition-all duration-200 ease-out-soft px-4 py-3 ${tone}`}
                    >
                      <div className="flex items-baseline gap-2">
                        <Body className="font-semibold">{s.label}</Body>
                        {active && (
                          <span className={`text-xxs font-bold ${category === 'recovery' ? 'text-mil-success' : 'text-mil-sand'}`}>
                            פעיל
                          </span>
                        )}
                      </div>
                      <Muted className="block mt-0.5 text-tiny">{s.description}</Muted>
                    </button>
                  );
                })}
              </div>
            </Section>
          );
        })}

        {/* Engine output snapshot */}
        <Section label="תגובת ה-engine">
          {demoSlot ? (
            <Card>
              <div className="px-5 py-4 space-y-3">
                <Hint>משבצת מוצגת</Hint>
                <Body className="font-semibold">{demoSlot.missionName}</Body>
                <Muted className="text-tiny tabular-nums">
                  {demoSlot.start.slice(0, 16).replace('T', ' ')} ·
                  נדרשים {demoSlot.requiredCount}
                </Muted>

                {outcome && (
                  <>
                    <div className="pt-2 border-t border-mil-border">
                      <Hint>תוצאת ה-engine</Hint>
                      <Body className="text-sm mt-1">{outcome.reasoning}</Body>
                      <div className="mt-2 flex items-baseline gap-3 text-tiny">
                        <span className={`tabular-nums font-semibold ${outcome.picked.length >= demoSlot.requiredCount ? 'text-mil-success' : 'text-mil-alert'}`}>
                          {outcome.picked.length} / {demoSlot.requiredCount} מאוישים
                        </span>
                        <span className="text-mil-muted tabular-nums">
                          {Math.round(outcome.confidence * 100)}% confidence
                        </span>
                        <span className="text-mil-muted tabular-nums">
                          {outcome.alerts.length} alerts
                        </span>
                      </div>
                    </div>

                    {outcome.alerts.length > 0 && (
                      <div className="pt-2 border-t border-mil-border">
                        <Hint>alerts:</Hint>
                        <ul className="mt-2 space-y-1">
                          {outcome.alerts.map((a, i) => (
                            <li key={i} className="text-tiny">
                              <span className={a.severity === 'critical' ? 'text-mil-alert font-semibold' : 'text-mil-warn font-semibold'}>
                                [{a.severity}]
                              </span>{' '}
                              {a.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>
          ) : (
            <Muted className="px-1 text-tiny">אין משימה ב-3 הימים הקרובים — אין מה לדמות.</Muted>
          )}
        </Section>

        <button
          onClick={() => navigate('/home')}
          className="block w-full text-center text-tiny text-mil-muted hover:text-mil-text underline pt-2"
        >
          חזרה ←
        </button>
      </PageMain>
    </div>
  );
}
