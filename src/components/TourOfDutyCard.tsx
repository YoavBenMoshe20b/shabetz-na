// TourOfDutyCard — "ימי קו" widget.
//
// Drops into ProfilePage + SoldierDetailPage. Computes the tour summary
// from status events × orders via computeTourSummary, then renders:
//   • The current line: days remaining + on-base/at-home/inactive counts
//   • A historical-orders table (collapsed by default if > 2 rows)
//   • An aggregate strip at the bottom
//
// Pure rendering — no actions. Permission-aware: the parent screen decides
// whether to render this at all. The widget itself shows whatever data is
// passed to it.

import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { computeTourSummary, orderLengthDays } from '../utils/tourOfDuty';
import type { Soldier } from '../types';
import { Section, Body, Hint } from './ui';

interface TourOfDutyCardProps {
  soldier: Soldier;
  /** When true, omit the section label wrapper. Caller is wrapping. */
  bare?: boolean;
}

export default function TourOfDutyCard({ soldier, bare = false }: TourOfDutyCardProps) {
  const { soldierStatusEvents, orders } = useApp();
  const [showHistory, setShowHistory] = useState(false);

  const summary = useMemo(
    () => computeTourSummary({ soldier, events: soldierStatusEvents, orders }),
    [soldier, soldierStatusEvents, orders],
  );

  const inner = (
    <div className="space-y-3">
      {/* Current line */}
      {summary.current ? (
        <div className="bg-mil-card border border-mil-border rounded-xl-soft shadow-card p-4">
          <div className="flex items-baseline gap-2 flex-wrap">
            <Body className="font-semibold">{summary.current.orderName ?? 'הקו הנוכחי'}</Body>
            {summary.current.daysRemainingInOrder != null && (
              <Hint className="mr-auto text-mil-muted">
                נותרו <span className="tabular-nums font-semibold text-mil-text">{summary.current.daysRemainingInOrder}</span> ימים
              </Hint>
            )}
          </div>
          <Hint className="mt-1 text-mil-muted tabular-nums">
            {summary.current.windowStart} – {summary.current.windowEnd}
            {' · '}
            <span className="text-mil-text font-semibold">{orderLengthDays({ startDate: summary.current.windowStart, endDate: summary.current.windowEnd })}</span> ימים בקו
          </Hint>

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <TourTile label="בבסיס"   value={summary.current.daysOnBase}   tone="success" />
            <TourTile label="בבית"     value={summary.current.daysAtHome}   tone="sand"
                      muted={summary.current.daysAtHome === 0} />
            <TourTile label="לא פעיל" value={summary.current.daysInactive} tone="rest"
                      muted={summary.current.daysInactive === 0} />
          </div>
        </div>
      ) : (
        <div className="bg-mil-card border border-mil-border rounded-xl-soft p-4">
          <Hint className="text-mil-muted">אין צו פעיל כרגע</Hint>
        </div>
      )}

      {/* Aggregate strip */}
      {summary.total.daysOnBase + summary.total.daysAtHome + summary.total.daysInactive > 0 && (
        <div className="flex items-baseline gap-2 flex-wrap text-tiny text-mil-muted px-1">
          <span>סה״כ במערכת:</span>
          <span><span className="tabular-nums font-semibold text-mil-text">{summary.total.daysOnBase}</span> בבסיס</span>
          {summary.total.daysAtHome > 0 && (
            <>
              <span className="text-mil-ghost">·</span>
              <span><span className="tabular-nums font-semibold text-mil-text">{summary.total.daysAtHome}</span> בבית</span>
            </>
          )}
          {summary.total.daysInactive > 0 && (
            <>
              <span className="text-mil-ghost">·</span>
              <span><span className="tabular-nums font-semibold text-mil-text">{summary.total.daysInactive}</span> לא פעיל</span>
            </>
          )}
        </div>
      )}

      {/* Past orders */}
      {summary.past.length > 0 && (
        <>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="w-full text-right text-tiny font-semibold text-mil-olive hover:text-mil-olive-dim flex items-center gap-1.5 group"
          >
            <span>היסטוריית צווים ({summary.past.length})</span>
            <span className={`text-mil-muted transition-transform duration-200 ease-out-soft ${showHistory ? 'rotate-180' : ''}`}>▾</span>
          </button>
          {showHistory && (
            <div className="bg-mil-card border border-mil-border rounded-xl-soft divide-y divide-mil-border overflow-hidden animate-fade-in">
              {summary.past.map((p) => (
                <div key={p.orderId ?? `${p.windowStart}-${p.windowEnd}`} className="px-4 py-3">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <Body className="font-semibold flex-1 truncate text-sm">{p.orderName ?? 'צו ללא שם'}</Body>
                    <Hint className="text-mil-muted tabular-nums">{p.windowStart} – {p.windowEnd}</Hint>
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap text-tiny">
                    <span className="text-mil-success font-semibold tabular-nums">{p.daysOnBase} בבסיס</span>
                    {p.daysAtHome > 0 && (
                      <>
                        <span className="text-mil-ghost">·</span>
                        <span className="text-mil-sand font-semibold tabular-nums">{p.daysAtHome} בבית</span>
                      </>
                    )}
                    {p.daysInactive > 0 && (
                      <>
                        <span className="text-mil-ghost">·</span>
                        <span className="text-mil-rest font-semibold tabular-nums">{p.daysInactive} לא פעיל</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  if (bare) return inner;
  return <Section label="ימי קו">{inner}</Section>;
}

function TourTile({
  label, value, tone, muted = false,
}: {
  label: string;
  value: number;
  tone: 'success' | 'sand' | 'rest';
  muted?: boolean;
}) {
  const toneClass = {
    success: 'text-mil-success',
    sand:    'text-mil-sand',
    rest:    'text-mil-rest',
  }[tone];
  return (
    <div className="bg-mil-bg-alt/70 border border-mil-border/70 rounded-xl-soft px-3 py-2.5">
      <span className={`text-xl font-bold tabular-nums tracking-tightish ${muted ? 'text-mil-ghost' : toneClass}`}>
        {value}
      </span>
      <Hint className="block text-tiny font-medium text-mil-muted mt-0.5">{label}</Hint>
    </div>
  );
}

// ─── Compact variant for dashboard widgets ────────────────────────────────
//
// Smaller card that shows ONLY "days in current line + days remaining".
// Used on the soldier home above the leave-request FAB.

export function TourOfDutyMini({ soldier }: { soldier: Soldier }) {
  const { soldierStatusEvents, orders } = useApp();
  const summary = useMemo(
    () => computeTourSummary({ soldier, events: soldierStatusEvents, orders }),
    [soldier, soldierStatusEvents, orders],
  );

  if (!summary.current) return null;
  const daysInLine = summary.current.daysOnBase + summary.current.daysAtHome + summary.current.daysInactive;

  return (
    <div className="bg-mil-card border border-mil-border rounded-xl-soft shadow-card p-4 flex items-baseline gap-4">
      <div>
        <Hint className="text-tiny font-semibold tracking-wide uppercase text-mil-muted">ימי קו</Hint>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tabular-nums tracking-tightish text-mil-text">{daysInLine}</span>
          <span className="text-tiny text-mil-muted">בקו הנוכחי</span>
        </div>
      </div>
      {summary.current.daysRemainingInOrder != null && (
        <div className="mr-auto text-left">
          <Hint className="text-tiny font-semibold tracking-wide uppercase text-mil-muted">נותרו</Hint>
          <div className="mt-1 flex items-baseline gap-1.5 justify-end">
            <span className="text-2xl font-bold tabular-nums tracking-tightish text-mil-olive">{summary.current.daysRemainingInOrder}</span>
            <span className="text-tiny text-mil-muted">ימים</span>
          </div>
        </div>
      )}
    </div>
  );
}
