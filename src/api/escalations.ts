// Escalations API.

import type { EscalationEvent } from '../types';
import { read, simulate } from './_adapter';

export function listForCompany(companyId: string): Promise<EscalationEvent[]> {
  return simulate(read.escalationEvents().filter((e) => e.companyId === companyId));
}

export function listActive(companyId: string): Promise<EscalationEvent[]> {
  return simulate(
    read.escalationEvents().filter((e) => e.companyId === companyId && e.status === 'active'),
  );
}

/* eslint-disable @typescript-eslint/no-unused-vars */
// Placeholder write paths — wired to backend later.
export function declare(_data: Omit<EscalationEvent, 'id' | 'status' | 'openedAt' | 'openedByUserId' | 'openedByName'>): Promise<EscalationEvent> {
  return simulate({} as EscalationEvent);
}

export function close(_id: string, _reason?: string): Promise<void> {
  return simulate(undefined);
}
