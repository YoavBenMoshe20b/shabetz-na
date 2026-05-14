// _bootstrap.ts — first-load fetch from Supabase.
//
// When USE_SUPABASE=true, the AppContext calls bootstrapFromSupabase()
// once on mount to populate its state from the database. This single
// function pulls every Phase-1 entity that the UI currently consumes
// (companies, platoons, squads, soldiers, status events, leaves, leave
// requests, coverage events, profile + membership of the current user).
//
// Returned shapes match `src/data/mockData.ts` exactly so AppContext can
// drop them straight into the existing reducers.

import type {
  Company, Platoon, Squad, Soldier, SoldierStatusEvent,
  Leave, LeaveRequest, MockUser, UserRole, OperationalRole, TeamClass,
} from '../types';
import type { Database } from './_db.types'; // ambient — see note below
import { supabase, USE_SUPABASE } from './_supabase';

export interface BootstrapResult {
  user:              MockUser | null;
  companies:         Company[];
  platoons:          Platoon[];
  squads:            Squad[];
  soldiers:          Soldier[];
  statusEvents:      SoldierStatusEvent[];
  leaves:            Leave[];
  leaveRequests:     LeaveRequest[];
  // Phase 1 coverage stays raw — surfaced via a dedicated read path.
  coverageEventsRaw: unknown[];
}

const EMPTY: BootstrapResult = {
  user: null,
  companies: [],
  platoons: [],
  squads: [],
  soldiers: [],
  statusEvents: [],
  leaves: [],
  leaveRequests: [],
  coverageEventsRaw: [],
};

export async function bootstrapFromSupabase(): Promise<BootstrapResult> {
  if (!USE_SUPABASE) return EMPTY;

  const sb = supabase();

  // ─── 1. Who am I? ─────────────────────────────────────────────────
  const { data: sessionData } = await sb.auth.getSession();
  const authUser = sessionData.session?.user;
  if (!authUser) return EMPTY;

  const { data: profileRow } = await sb
    .from('profiles')
    .select('id, full_name, phone, id_last4')
    .eq('id', authUser.id)
    .maybeSingle();

  const { data: membershipRow } = await sb
    .from('memberships')
    .select('company_id, role, platoon_id, commanded_platoon_id, squad_id, is_active')
    .eq('user_id', authUser.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!profileRow || !membershipRow) {
    return { ...EMPTY, user: null };
  }

  // ─── 2. Roster + structure (RLS scopes to the user's company) ────
  const [
    companiesRes,
    platoonsRes,
    squadsRes,
    soldiersRes,
    statusEventsRes,
    leavesRes,
    leaveRequestsRes,
    coverageRes,
  ] = await Promise.all([
    sb.from('companies').select('*'),
    sb.from('platoons').select('*'),
    sb.from('squads').select('*'),
    sb.from('soldiers').select('*'),
    sb.from('soldier_status_events').select('*').order('set_at', { ascending: false }).limit(2000),
    sb.from('leaves').select('*'),
    sb.from('leave_requests').select('*'),
    sb.from('coverage_events').select('*'),
  ]);

  // Map Supabase rows → app types. Field names: snake_case → camelCase.
  const companies = (companiesRes.data ?? []).map(mapCompany);
  const platoons  = (platoonsRes.data ?? []).map(mapPlatoon);
  const squads    = (squadsRes.data ?? []).map(mapSquad);
  const soldiers  = (soldiersRes.data ?? []).map(mapSoldier);
  const statusEvents  = (statusEventsRes.data ?? []).map(mapStatusEvent);
  const leaves        = (leavesRes.data ?? []).map(mapLeave);
  const leaveRequests = (leaveRequestsRes.data ?? []).map(mapLeaveRequest);

  // Compose User from profile + membership.
  // Try to also link to soldier (claim) so the app can identify "me as a soldier".
  const mySoldier = soldiers.find((s) => s.userId === authUser.id) ?? null;

  // Persist functionalRoles on the user — the Rasap detection in
  // utils/permissions.isRasap reads BOTH operationalRoles AND
  // functionalRoles. Backend `is_rasap()` SQL helper checks both fields
  // on the soldier row. If we drop functionalRoles here, frontend
  // capability gating drifts from server RLS authorization (silent
  // unauthorized errors on writes).
  const user: MockUser & { functionalRoles?: string[] } = {
    id: authUser.id,
    name: profileRow.full_name,
    role: membershipRow.role as UserRole,
    companyId: membershipRow.company_id,
    platoonId: membershipRow.platoon_id ?? undefined,
    commandedPlatoonId: membershipRow.commanded_platoon_id ?? undefined,
    squadId: membershipRow.squad_id ?? undefined,
    phone: profileRow.phone,
    idLast4: profileRow.id_last4,
    password: '',                              // unused — Supabase Auth owns this
    operationalRoles: (mySoldier?.operationalRoles ?? []) as OperationalRole[],
    functionalRoles: (mySoldier?.functionalRoles ?? []),
    teamClass: (mySoldier?.teamClass ?? '') as TeamClass,
    soldierProfileId: mySoldier?.id,
  };

  return {
    user,
    companies,
    platoons,
    squads,
    soldiers,
    statusEvents,
    leaves,
    leaveRequests,
    coverageEventsRaw: coverageRes.data ?? [],
  };
}

// ─── Row mappers ───────────────────────────────────────────────────
// Conservative: copy fields we know about, leave the rest defaulted so
// the UI never crashes on a missing column.

type CompanyRow   = Database['companies'];
type PlatoonRow   = Database['platoons'];
type SquadRow     = Database['squads'];
type SoldierRow   = Database['soldiers'];
type SSERow       = Database['soldier_status_events'];
type LeaveRow     = Database['leaves'];
type LeaveReqRow  = Database['leave_requests'];

function mapCompany(r: CompanyRow): Company {
  return {
    id: r.id,
    name: r.name,
    unitName: r.unit_name ?? '',
    commanderUserId: '',                // resolved server-side later
    platoonIds: [],                     // computed from platoons array if needed
    inviteCode: r.invite_code ?? '',
    settings: r.settings ?? {
      rotationStrategy: 'platoon-based',
      minSoldiersOnBase: 8,
      specialPlatoonsFollowLeaveRotation: false,
      companyHomePeriods: [],
    },
    createdAt: r.created_at,
  };
}

function mapPlatoon(r: PlatoonRow): Platoon {
  return {
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    unitName: r.unit_name ?? '',
    code: r.code ?? '',
    kind: r.kind,
    memberIds: [],                                  // derived on the client from soldiers list
    availableRoles: [],
    minSoldiersOnBase: r.min_soldiers_on_base ?? 0,
    followsCompanyLeaveRotation: r.follows_company_rotation ?? true,
  };
}

function mapSquad(r: SquadRow): Squad {
  return {
    id: r.id,
    platoonId: r.platoon_id,
    name: r.name,
    soldierIds: [],                                 // derived on the client from soldiers list
  };
}

function mapSoldier(r: SoldierRow): Soldier {
  return {
    id: r.id,
    companyId: r.company_id,
    userId: r.user_id ?? undefined,
    name: r.name,
    phone: r.phone,
    idLast4: r.id_last4,
    status: r.status,
    deactivatedAt: r.deactivated_at ?? undefined,
    deactivatedReason: r.deactivated_reason ?? undefined,
    claimedAt: r.claimed_at ?? undefined,
    currentStatus: r.current_status,
    statusSetAt: r.status_set_at,
    statusExpectedUntil: r.status_expected_until ?? undefined,
    squadId: r.squad_id ?? '',
    teamClass: r.team_class ?? '',
    operationalRoles: (r.operational_roles ?? []) as Soldier['operationalRoles'],
    functionalRoles: (r.functional_roles ?? []) as Soldier['functionalRoles'],
    availabilityNotes: [],
    dateOfBirth: r.date_of_birth ?? undefined,
    dominantHand: r.dominant_hand ?? undefined,
    weaponSide: r.weapon_side ?? undefined,
    shirtSize: r.shirt_size ?? undefined,
    pantsSize: r.pants_size ?? undefined,
    shoeSize: r.shoe_size ?? undefined,
    availability: r.availability ?? true,
    currentLoad: r.current_load ?? 0,
  } as Soldier;
}

function mapStatusEvent(r: SSERow): SoldierStatusEvent {
  return {
    id: r.id,
    soldierId: r.soldier_id,
    value: r.value,
    previousValue: r.previous_value ?? undefined,
    setAt: r.set_at,
    setBy: r.set_by ?? undefined,
    setByName: r.set_by_name ?? undefined,
    setByRole: r.set_by_role ?? undefined,
    expectedUntil: r.expected_until ?? undefined,
    reason: r.reason ?? undefined,
    isManualOverride: r.is_manual_override ?? false,
    escalationId: r.escalation_id ?? undefined,
  } as SoldierStatusEvent;
}

function mapLeave(r: LeaveRow): Leave {
  return {
    id: r.id,
    scope: r.scope,
    soldierIds: r.soldier_ids ?? [],
    squadId: r.squad_id ?? undefined,
    teamClass: r.team_class ?? undefined,
    startDate: r.start_date,
    startTime: r.start_time,
    endDate: r.end_date,
    endTime: r.end_time,
    note: r.note ?? undefined,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
  } as Leave;
}

function mapLeaveRequest(r: LeaveReqRow): LeaveRequest {
  return {
    id: r.id,
    soldierId: r.soldier_id,
    soldierName: r.soldier_name,
    soldierTeamClass: r.soldier_team_class,
    soldierSquadId: r.soldier_squad_id ?? undefined,
    soldierSquadName: r.soldier_squad_name ?? undefined,
    startDate: r.start_date,
    startTime: r.start_time,
    endDate: r.end_date,
    endTime: r.end_time,
    reason: r.reason,
    status: r.status,
    reviewedBy: r.reviewed_by ?? undefined,
    reviewedByName: r.reviewed_by_name ?? undefined,
    reviewedAt: r.reviewed_at ?? undefined,
    submittedAt: r.submitted_at,
  } as LeaveRequest;
}
