-- ─── 0009_assignments.sql ──────────────────────────────────────────────────
-- Slot assignments + selector audit trail + engine overrides.
--
-- The "heart of the schedule": when a commander commits an assignment
-- via StaffingSheet, three records are produced:
--   1. assignments — N rows, one per assigned soldier (1 commander +
--      N-1 regular). Keyed by the materialized slot_id, deterministic
--      across re-runs of materializeWeek.
--   2. selector_outcomes — one row capturing the engine's outcome at
--      decision time (alternates, violations, confidence, decay).
--   3. engine_overrides — one row per soldier-the-engine-recommended
--      whom the operator did NOT pick (for pattern analysis).
--
-- All three are company-scoped via RLS — same membership semantics as
-- the rest of the operational data.

-- ─── assignments ────────────────────────────────────────────────────────
create table public.assignments (
  id            text primary key,
  company_id    uuid not null references public.companies(id) on delete cascade,
  slot_id       text not null,                  -- mat-<missionId>-<isoDate>-<wIdx>
  mission_id    text not null references public.missions(id) on delete cascade,
  soldier_id    text not null references public.soldiers(id) on delete cascade,
  role          text not null check (role in ('soldier','commander')),
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  -- Forensic links if this assignment broke a rule
  override_alert_id text references public.override_alerts(id),
  override_id   text,
  -- Unique per slot+soldier — one soldier can't fill the same slot twice
  unique (slot_id, soldier_id)
);

create index assignments_company on public.assignments (company_id);
create index assignments_slot    on public.assignments (slot_id);
create index assignments_mission on public.assignments (mission_id);
create index assignments_soldier on public.assignments (soldier_id);

alter table public.assignments enable row level security;

-- Read: anyone in the company
create policy assignments_select on public.assignments
  for select using (company_id = public.current_user_company());

-- Insert: platoon-leadership or company-leadership for their company
create policy assignments_insert on public.assignments
  for insert with check (
    company_id = public.current_user_company()
    and (public.is_company_leadership() or public.is_platoon_leadership())
  );

-- Delete: same as insert
create policy assignments_delete on public.assignments
  for delete using (
    company_id = public.current_user_company()
    and (public.is_company_leadership() or public.is_platoon_leadership())
  );

-- ─── selector_outcomes (audit trail) ───────────────────────────────────
create table public.selector_outcomes (
  id              text primary key,
  company_id      uuid not null references public.companies(id) on delete cascade,
  slot_id         text not null,
  mission_id      text not null references public.missions(id) on delete cascade,
  outcome         jsonb not null,                -- full SelectorOutcome snapshot
  final_soldier_ids text[] not null default '{}'::text[],
  actor_user_id   uuid references public.profiles(id),
  actor_role      text not null,
  decided_at      timestamptz not null default now()
);

create index selector_outcomes_company on public.selector_outcomes (company_id);
create index selector_outcomes_mission on public.selector_outcomes (mission_id);
create index selector_outcomes_decided on public.selector_outcomes (decided_at desc);

alter table public.selector_outcomes enable row level security;

create policy selector_outcomes_select on public.selector_outcomes
  for select using (company_id = public.current_user_company());

create policy selector_outcomes_insert on public.selector_outcomes
  for insert with check (
    company_id = public.current_user_company()
    and (public.is_company_leadership() or public.is_platoon_leadership())
  );

-- Audit records are append-only. No update/delete policies on purpose.

-- ─── engine_overrides (human override telemetry) ───────────────────────
-- Captured when the operator REJECTS the engine's pick. Useful for
-- pattern analysis ("70% of PCs always replace X with Y").
create table public.engine_overrides (
  id              text primary key,
  company_id      uuid not null references public.companies(id) on delete cascade,
  slot_id         text not null,
  engine_recommended_soldier_id text not null references public.soldiers(id),
  engine_confidence numeric not null,
  operator_chose_soldier_id text references public.soldiers(id),
  rationale       text,
  rationale_code  text,
  actor_user_id   uuid references public.profiles(id),
  actor_role      text not null,
  occurred_at     timestamptz not null default now()
);

create index engine_overrides_company on public.engine_overrides (company_id);
create index engine_overrides_slot    on public.engine_overrides (slot_id);

alter table public.engine_overrides enable row level security;

create policy engine_overrides_select on public.engine_overrides
  for select using (company_id = public.current_user_company());

create policy engine_overrides_insert on public.engine_overrides
  for insert with check (
    company_id = public.current_user_company()
    and (public.is_company_leadership() or public.is_platoon_leadership())
  );

-- ─── Audit triggers ────────────────────────────────────────────────────
create trigger audit_assignments        after insert or update or delete on public.assignments        for each row execute function public.audit_row_change();
create trigger audit_selector_outcomes  after insert or delete            on public.selector_outcomes for each row execute function public.audit_row_change();
create trigger audit_engine_overrides   after insert or delete            on public.engine_overrides  for each row execute function public.audit_row_change();
