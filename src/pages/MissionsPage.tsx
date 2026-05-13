// Mission list — CC-only.
//
// Read-only in slice E2. Each row shows: name · platoon(s) · one-line
// time summary · status pill. A primary "+ משימה חדשה" action launches
// the wizard. No filters, no bulk operations, no detail page yet —
// those land in later slices.

import { useNavigate, Navigate } from 'react-router-dom';
import { useApp, useMyCompany } from '../context/AppContext';
import { isCompanyLeadership } from '../utils/permissions';
import { buildMissionSummary } from '../utils/missionSummary';
import Header from '../components/Header';
import type { Mission, Platoon } from '../types';
import {
  Button, Section, PageMain, Body, Muted, Hint,
} from '../components/ui';

export default function MissionsPage() {
  const navigate = useNavigate();
  const { missions, platoons, qualifications, equipmentItems, currentRole } = useApp();
  const myCompany = useMyCompany();

  if (!isCompanyLeadership(currentRole)) {
    return <Navigate to="/home" replace />;
  }

  const myMissions = missions.filter((m) => m.companyId === myCompany?.id);
  const activeCount = myMissions.filter((m) => m.status === 'active').length;

  return (
    <div className="min-h-screen bg-mil-bg" dir="rtl">
      <Header title="ניהול משימות" />
      <PageMain>

        <section className="bg-mil-card border border-mil-border rounded-2xl-soft shadow-hero p-6">
          <div className="text-tiny text-mil-muted font-medium">{myCompany?.name ?? '—'}</div>
          <div className="mt-2 flex items-end gap-2.5 flex-wrap">
            <span className="text-[56px] leading-[0.9] font-extrabold tabular-nums text-mil-text tracking-tightish">
              {myMissions.length}
            </span>
            <div className="pb-1.5">
              <Body className="font-semibold leading-tight">משימות מוגדרות</Body>
              {activeCount > 0 && (
                <Hint className="text-tiny mt-0.5">
                  <span className="tabular-nums font-semibold text-mil-success">{activeCount}</span> פעילות
                </Hint>
              )}
            </div>
          </div>
        </section>

        <Section label="הגדרות פעילות">
          {myMissions.length === 0 ? (
            <div className="bg-mil-card border border-mil-border rounded-xl-soft py-10 text-center">
              <p className="text-sm font-semibold text-mil-text">אין משימות מוגדרות</p>
              <p className="text-tiny text-mil-muted mt-1">צור את המשימה הראשונה</p>
            </div>
          ) : (
            <div className="bg-mil-card border border-mil-border rounded-2xl shadow-card divide-y divide-mil-border overflow-hidden">
              {myMissions.map((m) => (
                <MissionRow
                  key={m.id}
                  mission={m}
                  platoons={platoons}
                  qualifications={qualifications}
                  equipmentItems={equipmentItems}
                  onClick={() => navigate(`/mission/${m.id}`)}
                />
              ))}
            </div>
          )}
        </Section>

        <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/missions/new')}>
          + משימה חדשה
        </Button>

      </PageMain>
    </div>
  );
}

interface MissionRowProps {
  mission:        Mission;
  platoons:       Platoon[];
  qualifications: Parameters<typeof buildMissionSummary>[0]['qualifications'];
  equipmentItems: Parameters<typeof buildMissionSummary>[0]['equipmentItems'];
  onClick:        () => void;
}

function MissionRow({ mission, platoons, qualifications, equipmentItems, onClick }: MissionRowProps) {
  // Take the first two sentences as the row preview (time + manpower).
  const lines = buildMissionSummary({ mission, platoons, qualifications, equipmentItems });
  const preview = lines.slice(1, 3).join(' ');                  // skip the identity line
  const statusTone =
    mission.status === 'active'                 ? 'bg-mil-success' :
    mission.status === 'staffed'                ? 'bg-mil-success' :
    mission.status === 'partially-staffed'      ? 'bg-mil-warn'    :
    mission.status === 'active-unstaffed'       ? 'bg-mil-alert'   :
    mission.status === 'staffing-pending'       ? 'bg-mil-warn'    :
    mission.status === 'assigned-to-platoon'    ? 'bg-mil-info'    :
    mission.status === 'paused'                 ? 'bg-mil-warn'    :
    'bg-mil-ghost';
  const STATUS_LABELS: Record<typeof mission.status, string> = {
    'draft':                'טיוטה',
    'active-unstaffed':     'ללא איוש',
    'assigned-to-platoon':  'שויכה למחלקה',
    'staffing-pending':     'באיוש',
    'active':               'פעילה',
    'staffed':              'מאוישת',
    'partially-staffed':    'מאוישת חלקית',
    'paused':               'מושהית',
    'archived':             'בארכיון',
  };
  const statusLabel = STATUS_LABELS[mission.status];

  return (
    <button
      onClick={onClick}
      className="w-full text-right px-5 py-4 flex items-start gap-3.5 hover:bg-mil-card-hover transition-colors duration-200 ease-out-soft"
    >
      <span className={`w-2 h-2 rounded-full ${statusTone} flex-shrink-0 mt-2 ring-4 ring-mil-card`} aria-hidden />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <Body className="font-semibold truncate">{mission.name}</Body>
          <span className="text-xxs font-semibold tracking-wide uppercase text-mil-muted">{statusLabel}</span>
        </div>
        {preview && <Muted className="mt-1 line-clamp-2">{preview}</Muted>}
      </div>
      <span className="text-mil-ghost mt-2">←</span>
    </button>
  );
}
