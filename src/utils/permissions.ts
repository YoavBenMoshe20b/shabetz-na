import type { UserRole } from '../types';

export const canCreateMission    = (role: UserRole) => role === 'owner' || role === 'manager';
export const canEditSchedule     = (role: UserRole) => role === 'owner' || role === 'manager';
export const canPublishSchedule  = (role: UserRole) => role === 'owner' || role === 'manager';
export const canTriggerEmergency = (role: UserRole) => role === 'owner' || role === 'manager';
export const canViewAuditLog     = (role: UserRole) => role === 'owner' || role === 'manager';
export const canViewManagerNotes = (role: UserRole) => role === 'owner' || role === 'manager';
export const canDeleteData       = (role: UserRole) => role === 'owner';
export const canRecalculate      = (role: UserRole) => role === 'owner' || role === 'manager';
export const canCreateGroup      = (role: UserRole) => role === 'owner' || role === 'manager';

export const roleLabel = (role: UserRole): string =>
  ({ owner: 'בעל קבוצה', manager: 'מנהל', soldier: 'חייל' }[role]);
