// Missions API — read paths + write placeholders.

import type { Mission, MissionStatus } from '../types';
import { read, simulate } from './_adapter';

export function listForCompany(companyId: string): Promise<Mission[]> {
  return simulate(read.missions().filter((m) => m.companyId === companyId));
}

export function listForOrder(orderId: string): Promise<Mission[]> {
  return simulate(read.missions().filter((m) => m.orderId === orderId));
}

export function listUnstaffed(companyId: string): Promise<Mission[]> {
  return simulate(
    read.missions().filter((m) =>
      m.companyId === companyId &&
      (m.status === 'active-unstaffed' || m.status === 'staffing-pending'),
    ),
  );
}

export function byId(id: string): Promise<Mission | null> {
  return simulate(read.missions().find((m) => m.id === id) ?? null);
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export function create(_data: Omit<Mission, 'id' | 'createdAt'>): Promise<Mission> {
  // Backend: POST /missions. Server returns the persisted Mission with
  // server-generated id + createdAt.
  return simulate({} as Mission);
}

export function update(_id: string, _patch: Partial<Mission>): Promise<void> {
  return simulate(undefined);
}

export function setStatus(_id: string, _status: MissionStatus): Promise<void> {
  return simulate(undefined);
}
