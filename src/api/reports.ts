// Reports API — דוח 1 et al.
//
// Today the page computes everything from local mock arrays. Backend
// will materialize per-company snapshots that this function fetches in
// one round-trip.

import type { Soldier, Platoon, Squad, SoldierStatusEvent } from '../types';
import { read, simulate } from './_adapter';

export interface Report1Payload {
  soldiers:      Soldier[];
  platoons:      Platoon[];
  squads:        Squad[];
  latestEvents:  SoldierStatusEvent[];   // latest event per soldier — pre-indexed by server
  generatedAt:   string;
}

/** Company-wide דוח 1. */
export function company(companyId: string): Promise<Report1Payload> {
  const soldiers = read.soldiers().filter((s) => s.companyId === companyId);
  const platoons = read.platoons().filter((p) => p.companyId === companyId);
  const squadIds = new Set(platoons.flatMap((p) => p.squadIds ?? []));
  const squads   = read.squads().filter((sq) => squadIds.has(sq.id));

  // Latest event per soldier — server will return this pre-indexed; today
  // we sort + dedupe client-side.
  const latestBySoldier = new Map<string, SoldierStatusEvent>();
  for (const ev of [...read.statusEvents()].sort((a, b) => b.setAt.localeCompare(a.setAt))) {
    if (!latestBySoldier.has(ev.soldierId)) latestBySoldier.set(ev.soldierId, ev);
  }

  return simulate({
    soldiers, platoons, squads,
    latestEvents: [...latestBySoldier.values()],
    generatedAt: new Date().toISOString(),
  });
}

/** Platoon-scoped דוח 1 — soldiers + that platoon's squads only. */
export function platoon(platoonId: string): Promise<Report1Payload> {
  const allPlatoons = read.platoons();
  const me = allPlatoons.find((p) => p.id === platoonId);
  if (!me) return simulate({ soldiers: [], platoons: [], squads: [], latestEvents: [], generatedAt: new Date().toISOString() });

  const mySquadIds = read.squads().filter((sq) => sq.platoonId === platoonId).map((sq) => sq.id);
  const soldiers = read.soldiers().filter((s) => s.squadId && mySquadIds.includes(s.squadId));
  const squads   = read.squads().filter((sq) => sq.platoonId === platoonId);

  const latestBySoldier = new Map<string, SoldierStatusEvent>();
  for (const ev of [...read.statusEvents()].sort((a, b) => b.setAt.localeCompare(a.setAt))) {
    if (!latestBySoldier.has(ev.soldierId)) latestBySoldier.set(ev.soldierId, ev);
  }

  return simulate({
    soldiers, platoons: [me], squads,
    latestEvents: [...latestBySoldier.values()].filter((ev) => soldiers.some((s) => s.id === ev.soldierId)),
    generatedAt: new Date().toISOString(),
  });
}
