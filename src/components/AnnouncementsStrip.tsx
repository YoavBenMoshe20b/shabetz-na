// AnnouncementsStrip — visible on all three home variants.
//
// Renders the active announcements visible to the viewer, sorted by:
//   pinned → operational → schedule → message → recency.
//
// Each row is glanceable: pill (kind) + title + optional time/audience hint.
// Tapping the strip header opens /announcements (full list + management).
//
// Hidden when there are no visible items — strip should never sit empty.

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { useOrg } from '../providers/OrgProvider';
import { useRoster } from '../providers/RosterProvider';
import { useAlerts } from '../providers/AlertsProvider';
import { visibleAnnouncementsFor } from '../utils/announcementProjection';
import { describeAudience } from '../utils/audience';
import { Section, Body, Muted } from './ui';
import { resolveAudienceToSoldierIds } from '../utils/audience';
import type { Announcement, AnnouncementKind, Acknowledgement, Soldier, Platoon, Squad } from '../types';

// §10 — count soldiers in the announcement's audience who have not
// (yet) acknowledged. Active soldiers only — inactive roster rows
// would inflate the gap forever.
function countUnacked(
  ann: Announcement,
  acks: Acknowledgement[],
  soldiers: Soldier[],
  platoons: Platoon[],
  squads: Squad[],
): number {
  const audienceIds = resolveAudienceToSoldierIds(ann.audience, { soldiers, platoons, squads });
  const activeAudienceIds = new Set(
    soldiers.filter((s) => audienceIds.has(s.id) && s.status === 'active').map((s) => s.id),
  );
  const ackedIds = new Set(
    acks.filter((a) => a.announcementId === ann.id).map((a) => a.soldierId),
  );
  let count = 0;
  for (const id of activeAudienceIds) if (!ackedIds.has(id)) count += 1;
  return count;
}

const KIND_LABEL: Record<AnnouncementKind, string> = {
  message:     'הודעה',
  schedule:    'לו"ז',
  operational: 'מבצעי',
};
const KIND_TONE: Record<AnnouncementKind, { chip: string; dot: string }> = {
  message:     { chip: 'text-mil-info  bg-mil-info-bg  border-mil-info-border',  dot: 'bg-mil-info' },
  schedule:    { chip: 'text-mil-olive bg-mil-olive-bg border-mil-olive/30',     dot: 'bg-mil-olive' },
  operational: { chip: 'text-mil-alert bg-mil-alert-bg border-mil-alert-border', dot: 'bg-mil-alert' },
};

interface AnnouncementsStripProps {
  /** When true, viewer is a commander and the strip header offers
   *  "+ הודעה" plus opens to the management page. */
  isCommander: boolean;
  /** Cap the rendered rows; the rest are reachable from "ראה הכל". */
  limit?: number;
}

export default function AnnouncementsStrip({ isCommander, limit = 4 }: AnnouncementsStripProps) {
  const navigate = useNavigate();
  // Phase-2 architecture: pull each concern from its focused provider.
  // Announcements are already company-scoped by AlertsProvider — no
  // local filter needed.
  const { currentUser } = useAuth();
  const { platoons, squads } = useOrg();
  const { soldiers } = useRoster();
  const { announcements, acknowledgements, acknowledgeAnnouncement } = useAlerts();

  const visible = useMemo(() => {
    if (!currentUser?.companyId) return [];
    return visibleAnnouncementsFor(
      announcements,
      { soldierProfileId: currentUser.soldierProfileId, isCommander },
      { soldiers, platoons, squads },
    );
  }, [announcements, currentUser, isCommander, soldiers, platoons, squads]);

  if (visible.length === 0) return null;

  const shown = visible.slice(0, limit);
  const more = visible.length - shown.length;

  return (
    <Section
      label="הודעות פלוגתיות"
      action={(
        <button
          onClick={() => navigate('/announcements')}
          className="text-tiny font-semibold text-mil-olive hover:text-mil-olive-dim"
        >
          {isCommander ? 'ניהול ←' : 'ראה הכל ←'}
        </button>
      )}
    >
      <div className="space-y-2">
        {shown.map((a) => {
          const tone = KIND_TONE[a.kind];
          const audienceLabel = describeAudience(a.audience, { platoons, squads });
          const timeBit = a.startDate
            ? `${a.startDate}${a.startTime ? ` ${a.startTime}` : ''}`
            : null;

          // §10 — acknowledgement state.
          //   • Soldier: have I personally acked? if not + requiresAck, show CTA.
          //   • Commander: how many in audience have NOT acked yet?
          const ackedByMe = !!currentUser?.soldierProfileId &&
            acknowledgements.some((x) =>
              x.announcementId === a.id && x.soldierId === currentUser.soldierProfileId,
            );
          const unackedCount = !isCommander || !a.requiresAck
            ? 0
            : countUnacked(a, acknowledgements, soldiers, platoons, squads);

          const handleAck = (e: React.MouseEvent) => {
            e.stopPropagation();
            acknowledgeAnnouncement(a.id);
          };

          return (
            <button
              key={a.id}
              onClick={() => navigate('/announcements')}
              className="w-full text-right bg-mil-card border border-mil-border rounded-xl-soft shadow-card hover:shadow-card-hover hover:border-mil-border-strong transition-all duration-200 ease-out-soft px-4 py-3.5"
            >
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 text-xxs font-semibold px-2 py-0.5 rounded-md border ${tone.chip}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} aria-hidden />
                  {KIND_LABEL[a.kind]}
                </span>
                {a.pinned && <span className="text-xxs font-semibold text-mil-olive">⊕</span>}
                {a.requiresAck && (
                  <span className="inline-flex items-center text-xxs font-semibold px-1.5 py-0.5 rounded-md bg-mil-alert-bg text-mil-alert border border-mil-alert-border">
                    דורש אישור
                  </span>
                )}
                <Body className="font-semibold leading-tight flex-1 min-w-0 truncate">{a.title}</Body>
              </div>
              {a.body && <Muted className="mt-1.5 leading-relaxed line-clamp-2 text-tiny">{a.body}</Muted>}
              <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap text-xxs text-mil-muted">
                {timeBit && <span className="tabular-nums">{timeBit}</span>}
                {timeBit && <span className="text-mil-ghost">·</span>}
                <span>{audienceLabel}</span>
              </div>

              {/* §10 — soldier ack CTA / commander unacked count */}
              {a.requiresAck && !isCommander && currentUser?.soldierProfileId && (
                <div className="mt-2.5 flex items-center gap-2">
                  {ackedByMe ? (
                    <span className="inline-flex items-center text-xxs font-semibold px-2 py-1 rounded-md bg-mil-success-bg text-mil-success border border-mil-success-border">
                      ✓ אישרת קבלה
                    </span>
                  ) : (
                    <span
                      role="button"
                      onClick={handleAck}
                      className="inline-flex items-center text-xxs font-bold px-3 py-1.5 rounded-md bg-mil-olive text-white shadow-card hover:bg-mil-olive-dim transition-colors"
                    >
                      אישור קבלה
                    </span>
                  )}
                </div>
              )}
              {a.requiresAck && isCommander && unackedCount > 0 && (
                <div className="mt-2.5">
                  <span className="inline-flex items-center text-xxs font-bold px-2 py-1 rounded-md bg-mil-alert-bg text-mil-alert border border-mil-alert-border">
                    {unackedCount} לא אישרו
                  </span>
                </div>
              )}
            </button>
          );
        })}
        {more > 0 && (
          <button
            onClick={() => navigate('/announcements')}
            className="w-full text-center py-2 text-tiny font-semibold text-mil-muted hover:text-mil-text"
          >
            ועוד {more}…
          </button>
        )}
        {isCommander && (
          <button
            onClick={() => navigate('/announcements')}
            className="w-full text-right border border-dashed border-mil-border-strong rounded-xl-soft px-4 py-2.5 text-tiny font-semibold text-mil-olive hover:bg-mil-olive-bg/40 transition-colors"
          >
            + הודעה חדשה
          </button>
        )}
      </div>
    </Section>
  );
}
