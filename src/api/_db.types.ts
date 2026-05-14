// _db.types.ts — minimal row shapes that mirror the Supabase tables.
//
// Hand-written (not generated) for Phase 1. When we install
// `supabase gen types typescript` we'll regenerate this file from the
// live schema and the rest of the code stays the same — these names are
// the public contract.
//
// Keep these in sync with supabase/migrations/0001..0005.

import type {
  PlatoonKind, SoldierStatus, UserRole, LeaveScope, LeaveRequestStatus,
} from '../types';

export interface Database {
  companies: {
    id: string;
    name: string;
    unit_name: string | null;
    invite_code: string | null;
    // Mirrors CompanySettings from src/types/index.ts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    settings: any | null;
    created_at: string;
    updated_at: string;
  };

  platoons: {
    id: string;
    company_id: string;
    name: string;
    unit_name: string | null;
    code: string | null;
    kind: PlatoonKind;
    min_soldiers_on_base: number | null;
    follows_company_rotation: boolean | null;
    created_at: string;
    updated_at: string;
  };

  squads: {
    id: string;
    platoon_id: string;
    name: string;
    created_at: string;
    updated_at: string;
  };

  soldiers: {
    id: string;
    company_id: string;
    user_id: string | null;
    name: string;
    phone: string;
    id_last4: string;
    status: 'active' | 'inactive';
    deactivated_at: string | null;
    deactivated_reason: 'transferred' | 'discharged' | 'revoked' | null;
    claimed_at: string | null;
    current_status: SoldierStatus;
    status_set_at: string;
    status_expected_until: string | null;
    squad_id: string | null;
    team_class: string | null;
    operational_roles: string[] | null;
    functional_roles: string[] | null;
    date_of_birth: string | null;
    dominant_hand: 'right' | 'left' | null;
    weapon_side: 'right' | 'left' | null;
    shirt_size: string | null;
    pants_size: string | null;
    shoe_size: string | null;
    availability: boolean | null;
    current_load: number | null;
    created_at: string;
    updated_at: string;
  };

  soldier_status_events: {
    id: string;
    soldier_id: string;
    value: SoldierStatus;
    previous_value: SoldierStatus | null;
    set_at: string;
    set_by: string | null;
    set_by_name: string | null;
    set_by_role: UserRole | null;
    expected_until: string | null;
    reason: string | null;
    is_manual_override: boolean | null;
    escalation_id: string | null;
  };

  leaves: {
    id: string;
    company_id: string;
    scope: LeaveScope;
    soldier_ids: string[] | null;
    squad_id: string | null;
    team_class: string | null;
    start_date: string;
    start_time: string;
    end_date: string;
    end_time: string;
    note: string | null;
    created_by: string;
    created_by_name: string;
    created_at: string;
    updated_at: string;
  };

  leave_requests: {
    id: string;
    company_id: string;
    soldier_id: string;
    soldier_name: string;
    soldier_team_class: string;
    soldier_squad_id: string | null;
    soldier_squad_name: string | null;
    start_date: string;
    start_time: string;
    end_date: string;
    end_time: string;
    reason: string;
    status: LeaveRequestStatus;
    reviewed_by: string | null;
    reviewed_by_name: string | null;
    reviewed_at: string | null;
    submitted_at: string;
    created_at: string;
    updated_at: string;
  };

  coverage_events: {
    id: string;
    company_id: string;
    absent: { kind: 'platoon' | 'squad' | 'soldiers'; platoonId?: string; squadId?: string; soldierIds?: string[] };
    covering: { kind: 'platoon' | 'squad' | 'soldiers' | 'mission-already-covers'; platoonId?: string; squadId?: string; soldierIds?: string[]; missionId?: string };
    start_ts: string;
    end_ts: string;
    affected_mission_ids: string[] | null;
    reason: 'leave' | 'mission-collision' | 'rest-activity';
    notes: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
  };
}
