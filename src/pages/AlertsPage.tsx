// AlertsPage — full-screen alerts feed.
//
// Same data as AlertsSheet but presented as a route. Grouped by day,
// sorted by severity within each group. Click on a row navigates to
// the source's deep link.

import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp, useMyCompany } from '../context/AppContext';
import { isPlatoonLeadership } from '../utils/permissions';
import Header from '../components/Header';
import { alertsApi } from '../api';
import type { Alert, AlertKind, AlertSeverity } from '../types';
import {
  Eyebrow, Section, PageMain, Body, Hint, EmptyState, SkeletonCard,
} from '../components/ui';

const SEV_LABEL: Record<AlertSeverity, string> = {
  critical: 'קריטי',
  warning:  'דורש תשומת לב',
  info:     'מידע',
};
const SEV_TONE: Record<AlertSeverity, { tag: string; dot: string }> = {
  critical: { tag: 'text-mil-alert bg-mil-alert-bg border-mil-alert-border', dot: 'bg-mil-alert' },
  warning:  { tag: 'text-mil-warn  bg-mil-warn-bg  border-mil-warn-border',  dot: 'bg-mil-warn' },
  info:     { tag: 'text-mil-info  bg-mil-info-bg  border-mil-info-border',  dot: 'bg-mil-info' },
};
const KIND_LABEL: Record<AlertKind, string> = {
  'escalation-active':         'הקפצה',
  'mission-unstaffed':         'משימה ללא איוש',
  'override-open':             'חריגה פתוחה',
  'manpower-shortfall':        'חוסר בכ״א',
  'announcement-operational':  'הודעה מבצעית',
};

export default function AlertsPage() {
  const navigate = useNavigate();
  const { currentUser, currentRole } = useApp();
  const myCompany = useMyCompany();
  // `null` means "never fetched"; an empty array means "fetched, empty".
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const loading = alerts === null && !!currentUser?.companyId;

  useEffect(() => {
    if (!currentUser?.companyId) return;
    let cancelled = false;
    const isPlatoon = isPlatoonLeadership(currentRole)
      && currentRole !== 'companyCommander'
      && currentRole !== 'deputyCompanyCommander';
    alertsApi.listForCompany({
      companyId: currentUser.companyId,
      platoonId: isPlatoon ? currentUser.commandedPlatoonId : undefined,
    }).then((list) => {
      if (!cancelled) setAlerts(list);
    }).catch(() => {
      if (!cancelled) setAlerts([]);
    });
    return () => { cancelled = true; };
  }, [currentUser, currentRole]);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, Alert[]>();
    for (const a of alerts ?? []) {
      const day = a.occurredAt.slice(0, 10);
      const arr = map.get(day) ?? [];
      arr.push(a);
      map.set(day, arr);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [alerts]);

  const list = alerts ?? [];

  if (!currentUser) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="התראות" />
      <PageMain>
        <section className="bg-mil-card border border-mil-border rounded-2xl-soft shadow-hero p-6">
          <Eyebrow>{myCompany?.name ?? '—'}</Eyebrow>
          <h1 className="text-hero font-extrabold text-mil-text tracking-tightish mt-1.5">התראות</h1>
          <Body className="mt-1.5 text-mil-muted text-sm">
            {loading
              ? 'טוען התראות…'
              : list.length === 0
                ? 'הכל רגוע — אין התראות פעילות.'
                : `${list.length} התראות פעילות.`}
          </Body>
        </section>

        {loading ? (
          <div className="space-y-2.5">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            title="אין התראות"
            hint="ברגע שתעלה בעיה מבצעית — חוסר באיוש, חריגה, הקפצה — היא תופיע כאן."
          />
        ) : (
          groupedByDay.map(([day, items]) => (
            <Section key={day} label={formatGroupDay(day)}>
              <div className="space-y-2">
                {items.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => a.actionHref && navigate(a.actionHref)}
                    className="w-full text-right bg-mil-card border border-mil-border rounded-xl-soft shadow-card hover:shadow-card-hover hover:border-mil-border-strong transition-all duration-200 ease-out-soft px-4 py-3.5"
                  >
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 text-xxs font-semibold px-2 py-0.5 rounded-md border ${SEV_TONE[a.severity].tag}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${SEV_TONE[a.severity].dot}`} aria-hidden />
                        {SEV_LABEL[a.severity]}
                      </span>
                      <span className="text-xxs font-semibold tracking-wide text-mil-muted">{KIND_LABEL[a.kind]}</span>
                    </div>
                    <Body className="font-semibold leading-tight mt-2">{a.title}</Body>
                    {a.message && <Hint className="mt-1 text-mil-muted">{a.message}</Hint>}
                    {a.suggestedAction && (
                      <p className="mt-2 text-tiny font-semibold text-mil-olive">{a.suggestedAction} ←</p>
                    )}
                  </button>
                ))}
              </div>
            </Section>
          ))
        )}
      </PageMain>
    </div>
  );
}

function formatGroupDay(dayIso: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dayIso === today) return 'היום';
  if (dayIso === y)     return 'אתמול';
  return dayIso;
}
