// ─── Announcement projection — visibility + calendar derivation ────────────
//
// Two responsibilities:
//   1. visibleAnnouncementsFor — given a viewer, return the announcements
//      whose audience covers them, filtered by status (active default).
//   2. announcementsToCalendarEntries — project schedule/operational kinds
//      into CalendarEntry[] for the viewer's window.
//
// Same architectural pattern as Mission → AssignmentSlot: announcements are
// the canonical entity, calendar entries are derived. Editing the
// announcement once cascades to Home strip + calendar.

import type {
  Announcement, AnnouncementStatus,
  Platoon, Soldier, Squad,
  CalendarEntry,
} from '../types';
import { resolveAudienceToSoldierIds } from './audience';

export interface AnnouncementViewer {
  soldierProfileId?: string;
  /** When set, viewer is a commander — they see EVERYTHING (announcements
   *  are pushed downward in the command chain, so commanders also see what
   *  their soldiers see). */
  isCommander: boolean;
}

export interface AnnouncementSources {
  soldiers: Soldier[];
  platoons: Platoon[];
  squads:   Squad[];
}

export function visibleAnnouncementsFor(
  announcements: Announcement[],
  viewer: AnnouncementViewer,
  sources: AnnouncementSources,
  opts: { statuses?: AnnouncementStatus[] } = {},
): Announcement[] {
  const statuses = new Set(opts.statuses ?? (['active'] as AnnouncementStatus[]));

  // Pre-resolve viewer soldier id once. Audience checks fall through for
  // commanders by design.
  return announcements
    .filter((a) => statuses.has(a.status))
    .filter((a) => {
      if (viewer.isCommander) return true;
      if (!viewer.soldierProfileId) return false;
      if (a.audience.kind === 'company') return true;
      const targets = resolveAudienceToSoldierIds(a.audience, sources);
      return targets.has(viewer.soldierProfileId);
    })
    .sort((a, b) => {
      // pinned first, then operational kind, then by createdAt desc
      if ((a.pinned ?? false) !== (b.pinned ?? false)) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      if (a.kind !== b.kind) {
        const rank = (k: typeof a.kind) => k === 'operational' ? 0 : k === 'schedule' ? 1 : 2;
        return rank(a.kind) - rank(b.kind);
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
}

/** Project announcements into CalendarEntry[] for a specific day. Only
 *  announcements with showOnCalendar=true and a time window covering `day`
 *  surface. The kind discriminator drives priority + color in the calendar. */
export function announcementsToCalendarEntries(
  announcements: Announcement[],
  day: Date,
): CalendarEntry[] {
  const out: CalendarEntry[] = [];
  const dayIso = day.toISOString().slice(0, 10);

  for (const a of announcements) {
    if (!a.showOnCalendar) continue;
    if (a.status !== 'active') continue;

    const start = a.startDate ?? a.createdAt.slice(0, 10);
    const end   = a.endDate   ?? a.startDate ?? a.createdAt.slice(0, 10);
    if (dayIso < start || dayIso > end) continue;

    const startIso = a.startTime ? `${dayIso}T${a.startTime}:00` : `${dayIso}T00:00:00`;
    const endIso   = a.endTime   ? `${dayIso}T${a.endTime}:00`   : `${dayIso}T23:59:59`;
    const allDay   = !a.startTime && !a.endTime;

    out.push({
      id:    `ann-${a.id}-${dayIso}`,
      kind:  'announcement',
      scope: 'company',
      scopeRefId: a.companyId,
      start: startIso,
      end:   endIso,
      allDay,
      title: a.title,
      detail: a.body,
      priority: a.kind === 'operational' ? 90 : 35,
      locked:   true,
      sourceRef: { kind: 'announcement', id: a.id },
    });
  }
  return out;
}
