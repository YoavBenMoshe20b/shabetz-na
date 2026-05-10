import { useState } from 'react';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import type { TeamClass } from '../types';

const TEAMS: Array<TeamClass | 'הכל'> = ['הכל', 'כיתה 1', 'כיתה 2', 'כיתה 3', 'מפקדה', 'אחר'];

export default function SoldiersPage() {
  const { soldiers, currentRole, updateSoldierAvailability } = useApp();
  const [teamFilter, setTeamFilter] = useState<TeamClass | 'הכל'>('הכל');
  const [availFilter, setAvailFilter] = useState<'all' | 'available' | 'unavailable'>('all');

  const filtered = soldiers.filter((s) => {
    const teamOk  = teamFilter === 'הכל' || s.teamClass === teamFilter;
    const availOk = availFilter === 'all' || (availFilter === 'available' ? s.availability : !s.availability);
    return teamOk && availOk;
  });

  const isManager = currentRole === 'owner' || currentRole === 'manager';

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="חיילים" />

      <main className="px-4 py-4 pb-28 max-w-xl mx-auto">

        {/* Filters */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {(['all', 'available', 'unavailable'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setAvailFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap border transition-colors ${
                availFilter === f
                  ? 'bg-mil-olive border-mil-olive text-white'
                  : 'bg-mil-card border-mil-border text-mil-muted hover:text-mil-text hover:border-mil-olive/50'
              }`}
            >
              {{ all: 'כולם', available: 'זמינים', unavailable: 'לא זמינים' }[f]}
            </button>
          ))}
          <div className="w-px bg-mil-border mx-1 flex-shrink-0" />
          {TEAMS.map((t) => (
            <button
              key={t}
              onClick={() => setTeamFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap border transition-colors ${
                teamFilter === t
                  ? 'bg-mil-olive-bg border-mil-olive/50 text-mil-olive'
                  : 'bg-mil-card border-mil-border text-mil-muted hover:text-mil-text hover:border-mil-olive/50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <p className="text-xs text-mil-muted mb-3">{filtered.length} חיילים</p>

        <div className="space-y-2">
          {filtered.map((s) => (
            <div key={s.id} className="bg-mil-card border border-mil-border rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-bold text-mil-text">{s.name}</p>
                  <p className="text-xs text-mil-muted">{s.teamClass}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {isManager ? (
                    <button
                      onClick={() => updateSoldierAvailability(s.id, !s.availability)}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                        s.availability
                          ? 'bg-mil-success-bg border-mil-success/40 text-mil-success'
                          : 'bg-mil-alert-bg border-mil-alert/40 text-mil-alert'
                      }`}
                    >
                      {s.availability ? 'זמין' : 'לא זמין'}
                    </button>
                  ) : (
                    <span className={`text-xs px-2 py-0.5 rounded border ${
                      s.availability
                        ? 'bg-mil-success-bg border-mil-success/40 text-mil-success'
                        : 'bg-mil-alert-bg border-mil-alert/40 text-mil-alert'
                    }`}>
                      {s.availability ? 'זמין' : 'לא זמין'}
                    </span>
                  )}
                  {s.availabilityNotes.length > 0 && (
                    <span className="text-xs text-mil-warn">⚠ הערה</span>
                  )}
                </div>
              </div>

              {/* Operational roles */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {s.operationalRoles.map((r) => (
                  <span key={r} className="text-xs bg-mil-bg text-mil-muted border border-mil-border px-2 py-0.5 rounded">
                    {r}
                  </span>
                ))}
              </div>

              {/* Load bar */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-mil-ghost">עומס:</span>
                <div className="flex-1 bg-mil-bg border border-mil-border rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${
                      s.currentLoad >= 3 ? 'bg-mil-alert' : s.currentLoad >= 2 ? 'bg-mil-warn' : 'bg-mil-success'
                    }`}
                    style={{ width: `${Math.min((s.currentLoad / 5) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-mil-muted w-4 text-center">{s.currentLoad}</span>
              </div>

              {/* Availability notes */}
              {s.availabilityNotes.length > 0 && (
                <div className="mt-2 pt-2 border-t border-mil-border space-y-1">
                  {s.availabilityNotes.map((n, i) => (
                    <p key={i} className="text-xs text-mil-warn flex items-start gap-1">
                      <span className="mt-px">⊘</span>
                      <span>{n.description}{n.startDate && ` (${n.startDate}${n.endDate ? `–${n.endDate}` : ''})`}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <p className="text-center text-mil-ghost py-10">אין חיילים להצגה</p>
          )}
        </div>
      </main>
    </div>
  );
}
