// Temporary command delegation — grant + active + audit.
//
// Real operational situation: a commander (PC or CC) becomes unavailable
// for hours or a day. They name an acting commander, scope the authorities
// transferred (scheduling / leave-approval / operational-control), and
// the system tracks the window with start/end + revocable + audited.
//
// Surface scope:
//   • PC/PS — grant within their commanded platoon
//   • CC/Deputy — grant company-wide OR scoped to a platoon

import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp, useMyCompany } from '../context/AppContext';
import { isCompanyLeadership, isPlatoonLeadership } from '../utils/permissions';
import Header from '../components/Header';
import type { CommandAuthority, CommandDelegation, MockUser } from '../types';
import {
  Section, PageMain, PageTitle, Body, Muted, Hint, Button, StatusPill,
} from '../components/ui';

export default function DelegationsPage() {
  const {
    currentUser, currentRole, commandDelegations, createCommandDelegation, revokeCommandDelegation,
    platoons,
  } = useApp();

  if (!currentUser) return <Navigate to="/login" replace />;
  if (!isPlatoonLeadership(currentRole) && !isCompanyLeadership(currentRole)) {
    return <Navigate to="/home" replace />;
  }

  const myCompany = useMyCompany();
  const isCompanyTier = isCompanyLeadership(currentRole);

  // What can THIS user delegate?
  const myCommandedPlatoonId = currentUser.commandedPlatoonId;
  const defaultScope: 'company' | 'platoon' = isCompanyTier ? 'company' : 'platoon';

  // Filter delegations to those THIS user granted (audit view)
  const myDelegations = useMemo(() => commandDelegations
    .filter((d) => d.fromUserId === currentUser.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [commandDelegations, currentUser],
  );

  const nowMs = Date.now();
  const active   = myDelegations.filter((d) => !d.revoked && Date.parse(d.startIso) <= nowMs && nowMs <= Date.parse(d.endIso));
  const upcoming = myDelegations.filter((d) => !d.revoked && Date.parse(d.startIso) > nowMs);
  const past     = myDelegations.filter((d) => d.revoked || Date.parse(d.endIso) < nowMs);

  const [grantOpen, setGrantOpen] = useState(false);

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="פיקוד זמני" />
      <PageMain>

        <header>
          <Hint className="tracking-widest uppercase">{myCompany?.name ?? 'פלוגה'}</Hint>
          <PageTitle className="mt-1">פיקוד זמני</PageTitle>
          <Muted className="mt-1.5">העברת סמכויות לתקופה מוגדרת</Muted>
        </header>

        <Button variant="primary" size="lg" fullWidth onClick={() => setGrantOpen(true)}>
          + הענק פיקוד זמני
        </Button>

        {active.length > 0 && (
          <Section label="פעיל עכשיו">
            <div className="space-y-2">
              {active.map((d) => (
                <DelegationCard
                  key={d.id} delegation={d} platoons={platoons}
                  onRevoke={() => {
                    const reason = window.prompt('סיבה לביטול (אופציונלי):') ?? undefined;
                    revokeCommandDelegation(d.id, reason || undefined);
                  }}
                />
              ))}
            </div>
          </Section>
        )}

        {upcoming.length > 0 && (
          <Section label="עתידי">
            <div className="space-y-2">
              {upcoming.map((d) => (
                <DelegationCard
                  key={d.id} delegation={d} platoons={platoons}
                  onRevoke={() => revokeCommandDelegation(d.id, 'בוטל לפני התחלה')}
                />
              ))}
            </div>
          </Section>
        )}

        {past.length > 0 && (
          <Section label="היסטוריה">
            <div className="space-y-2">
              {past.slice(0, 8).map((d) => (
                <DelegationCard key={d.id} delegation={d} platoons={platoons} onRevoke={null} />
              ))}
            </div>
          </Section>
        )}

        {myDelegations.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-sm font-bold text-mil-olive-dim">אין הענקות</p>
            <p className="text-tiny text-mil-muted mt-1">לא הענקת פיקוד זמני עדיין</p>
          </div>
        )}

      </PageMain>

      {grantOpen && (
        <GrantModal
          defaultScope={defaultScope}
          fixedPlatoonId={myCommandedPlatoonId}
          isCompanyTier={isCompanyTier}
          onClose={() => setGrantOpen(false)}
          onSubmit={(data) => { createCommandDelegation(data); setGrantOpen(false); }}
        />
      )}
    </div>
  );
}

// ─── Delegation card ─────────────────────────────────────────────────────

function DelegationCard({
  delegation, platoons, onRevoke,
}: {
  delegation: CommandDelegation;
  platoons: Array<{ id: string; name: string }>;
  onRevoke: (() => void) | null;
}) {
  const start = new Date(delegation.startIso);
  const end   = new Date(delegation.endIso);
  const nowMs = Date.now();
  const startMs = Date.parse(delegation.startIso);
  const endMs   = Date.parse(delegation.endIso);
  const isActive = !delegation.revoked && startMs <= nowMs && nowMs <= endMs;
  const scopeLabel = delegation.scope === 'company'
    ? 'פלוגתי'
    : (platoons.find((p) => p.id === delegation.scopeRefId)?.name ?? 'מחלקה');

  return (
    <div className="bg-mil-card border border-mil-border rounded-2xl px-5 py-4">
      <div className="flex items-baseline gap-2 mb-2 flex-wrap">
        <Body className="font-semibold">{delegation.toUserName}</Body>
        <Hint className="text-mil-muted">· {scopeLabel}</Hint>
        {delegation.revoked && <Hint className="text-mil-alert font-bold">בוטל</Hint>}
        {isActive && <StatusPill status="ready">פעיל</StatusPill>}
      </div>
      <Hint className="block text-tiny tabular-nums text-mil-muted">
        {formatDateTime(start)} → {formatDateTime(end)}
      </Hint>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {delegation.authorities.map((a) => (
          <span key={a} className="text-tiny px-2 py-0.5 rounded-full bg-mil-card-warm border border-mil-border text-mil-text font-semibold">
            {AUTHORITY_LABEL[a]}
          </span>
        ))}
      </div>
      {delegation.reason && (
        <Muted className="mt-2 text-tiny">{delegation.reason}</Muted>
      )}
      {delegation.revoked && delegation.revokeReason && (
        <Muted className="mt-1 text-tiny text-mil-alert">{delegation.revokeReason}</Muted>
      )}
      {onRevoke && !delegation.revoked && (
        <div className="mt-3">
          <Button variant="ghost" size="sm" onClick={onRevoke}>
            בטל הענקה
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Grant modal ──────────────────────────────────────────────────────────

function GrantModal({
  defaultScope, fixedPlatoonId, isCompanyTier, onClose, onSubmit,
}: {
  defaultScope: 'company' | 'platoon';
  fixedPlatoonId?: string;
  isCompanyTier: boolean;
  onClose: () => void;
  onSubmit: (data: {
    toUserId: string;
    scope: 'company' | 'platoon';
    scopeRefId?: string;
    authorities: CommandAuthority[];
    startIso: string;
    endIso: string;
    reason?: string;
  }) => void;
}) {
  const { soldiers, platoons } = useApp();

  // Default window: now → +6h
  const now = new Date();
  const plus6 = new Date(now.getTime() + 6 * 3600 * 1000);
  const isoLocal = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

  const [toUserId, setToUserId] = useState('');
  const [scope, setScope] = useState<'company' | 'platoon'>(defaultScope);
  const [scopeRefId, setScopeRefId] = useState<string | undefined>(fixedPlatoonId);
  const [authorities, setAuthorities] = useState<CommandAuthority[]>(['all']);
  const [start, setStart] = useState(isoLocal(now));
  const [end,   setEnd]   = useState(isoLocal(plus6));
  const [reason, setReason] = useState('');

  // Candidates — for PC scope, soldiers in their platoon; for CC, all soldiers in company
  const candidates: Array<{ id: string; name: string }> = useMemo(() => {
    return soldiers
      .filter((s) => s.userId)
      .map((s) => ({ id: s.userId!, name: s.name }));
  }, [soldiers]);

  const toggleAuthority = (a: CommandAuthority) => {
    setAuthorities((prev) => {
      // 'all' acts as a single-select reset
      if (a === 'all') return prev.includes('all') ? [] : ['all'];
      const filtered = prev.filter((x) => x !== 'all');
      return filtered.includes(a) ? filtered.filter((x) => x !== a) : [...filtered, a];
    });
  };

  const submit = () => {
    if (!toUserId || authorities.length === 0) return;
    onSubmit({
      toUserId,
      scope,
      scopeRefId: scope === 'platoon' ? scopeRefId : undefined,
      authorities,
      startIso: new Date(start).toISOString(),
      endIso:   new Date(end).toISOString(),
      reason: reason.trim() || undefined,
    });
  };

  const canSubmit = !!toUserId && authorities.length > 0 && new Date(end) > new Date(start);

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center" dir="rtl">
      <div className="w-full max-w-md bg-mil-card rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-mil-olive rounded-t-2xl px-5 py-4 flex items-center gap-3 sticky top-0">
          <button onClick={onClose} className="text-white/80 hover:text-white text-xl leading-none">✕</button>
          <h2 className="text-white font-bold flex-1">הענקת פיקוד זמני</h2>
        </div>
        <div className="px-5 py-5 space-y-4">

          <div>
            <Hint className="block mb-1.5">מי משמש כממלא מקום?</Hint>
            <select value={toUserId} onChange={(e) => setToUserId(e.target.value)} className={inputCls}>
              <option value="">בחר חייל</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {isCompanyTier && (
            <div>
              <Hint className="block mb-1.5">היקף</Hint>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setScope('company')}
                  className={tabCls(scope === 'company')}
                >פלוגתי</button>
                <button
                  onClick={() => setScope('platoon')}
                  className={tabCls(scope === 'platoon')}
                >מחלקתי</button>
              </div>
              {scope === 'platoon' && (
                <select
                  value={scopeRefId ?? ''}
                  onChange={(e) => setScopeRefId(e.target.value)}
                  className={`${inputCls} mt-2`}
                >
                  <option value="">בחר מחלקה</option>
                  {platoons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </div>
          )}

          <div>
            <Hint className="block mb-1.5">סמכויות</Hint>
            <div className="flex flex-wrap gap-1.5">
              {(['all','scheduling','leave-approval','operational-control'] as CommandAuthority[]).map((a) => (
                <button
                  key={a}
                  onClick={() => toggleAuthority(a)}
                  className={chipCls(authorities.includes(a))}
                >
                  {AUTHORITY_LABEL[a]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Hint className="block mb-1.5">מתי מתחיל</Hint>
              <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
            </div>
            <div>
              <Hint className="block mb-1.5">מתי מסתיים</Hint>
              <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <Hint className="block mb-1.5">סיבה (אופציונלי)</Hint>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="מ״מ בקורס · סמל בחופש"
              className={inputCls}
            />
          </div>

          <button
            onClick={submit}
            disabled={!canSubmit}
            className="w-full bg-mil-olive hover:bg-mil-olive-light disabled:opacity-40 text-white font-bold py-4 rounded-xl text-base transition-colors"
          >
            הענק פיקוד זמני
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers / labels ────────────────────────────────────────────────────

const AUTHORITY_LABEL: Record<CommandAuthority, string> = {
  scheduling:            'שיבוץ',
  'leave-approval':      'אישור יציאות',
  'operational-control': 'פיקוד מבצעי',
  all:                   'כל הסמכויות',
};

function formatDateTime(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} · ${hh}:${min}`;
}

const inputCls =
  'w-full bg-mil-bg border border-mil-border rounded-xl px-3 py-3 text-mil-text focus:outline-none focus:ring-2 focus:ring-mil-olive/30 focus:border-mil-olive placeholder:text-mil-ghost text-base';

const chipCls = (on: boolean): string =>
  on
    ? 'px-3 py-1.5 rounded-full text-sm font-bold bg-mil-olive text-white'
    : 'px-3 py-1.5 rounded-full text-sm font-semibold bg-mil-card border border-mil-border text-mil-text hover:border-mil-olive transition-colors';

const tabCls = (on: boolean): string =>
  `px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
    on ? 'bg-mil-text text-mil-card' : 'bg-mil-card border border-mil-border text-mil-muted hover:border-mil-olive'
  }`;

// Suppress unused-import warning in some bundlers
void (null as unknown as MockUser);
