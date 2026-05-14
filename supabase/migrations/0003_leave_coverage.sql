-- ════════════════════════════════════════════════════════════════════════════
-- 0003_leave_coverage.sql — Leave, leave requests, and coverage events
--
-- Three entities:
--   • leaves           — approved leave records (individual / squad / machlaka)
--   • leave_requests   — soldier-initiated, walks the approval chain
--   • coverage_events  — CC explicitly declares who covers an absence
--
-- Coverage is NOT automatic. Per round-7 spec: when a platoon goes home,
-- the CC must declare a coverage_event saying who covers (another platoon,
-- חפ״ק, מפלג, specific soldiers, or "mission already covers").
-- ════════════════════════════════════════════════════════════════════════════

-- ─── leaves (approved) ────────────────────────────────────────────────
create table public.leaves (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  scope           public.leave_scope not null,
  soldier_ids     uuid[] not null default '{}', -- when scope = individual
  squad_id        uuid references public.squads(id) on delete set null, -- when scope = squad
  team_class      text, -- legacy display
  start_date      date not null,
  start_time      text not null,  -- HH:MM
  end_date        date not null,
  end_time        text not null,  -- HH:MM
  note            text,
  created_by      uuid not null references public.profiles(id),
  created_by_name text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index leaves_company        on public.leaves (company_id);
create index leaves_window         on public.leaves (company_id, start_date, end_date);
create index leaves_squad          on public.leaves (squad_id);

create trigger leaves_updated_at
  before update on public.leaves
  for each row execute function public.set_updated_at();

comment on table public.leaves is
  'Approved leave records. Either individual soldiers, a whole squad, or the whole platoon (machlaka).';

-- ─── leave_requests ──────────────────────────────────────────────────
create table public.leave_requests (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies(id) on delete cascade,
  soldier_id         uuid not null references public.soldiers(id)  on delete cascade,
  soldier_name       text not null,
  soldier_team_class text not null,
  soldier_squad_id   uuid references public.squads(id) on delete set null,
  soldier_squad_name text,
  start_date         date not null,
  start_time         text not null,
  end_date           date not null,
  end_time           text not null,
  reason             text not null,
  status             public.leave_request_status not null default 'pending',
  reviewed_by        uuid references public.profiles(id),
  reviewed_by_name   text,
  reviewed_at        timestamptz,
  submitted_at       timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index leave_requests_company       on public.leave_requests (company_id);
create index leave_requests_company_status on public.leave_requests (company_id, status);
create index leave_requests_soldier        on public.leave_requests (soldier_id);

create trigger leave_requests_updated_at
  before update on public.leave_requests
  for each row execute function public.set_updated_at();

-- ─── coverage_events ─────────────────────────────────────────────────
-- Round-7 update: coverage is NOT automatic. CC explicitly declares it.
-- The discriminated union (absent / covering) is stored as JSONB with
-- shape:
--   absent:   { kind: 'platoon' | 'squad' | 'soldiers',  ... ids }
--   covering: { kind: 'platoon' | 'squad' | 'soldiers' | 'mission-already-covers', ... }
create table public.coverage_events (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies(id) on delete cascade,
  absent                jsonb not null,
  covering              jsonb not null,
  start_ts              timestamptz not null,
  end_ts                timestamptz not null,
  affected_mission_ids  uuid[] not null default '{}',
  reason                public.coverage_event_reason not null,
  notes                 text,
  created_by            uuid not null references public.profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index coverage_events_company on public.coverage_events (company_id);
create index coverage_events_window  on public.coverage_events (company_id, start_ts, end_ts);

-- Shape checks on the JSONB columns
alter table public.coverage_events
  add constraint coverage_events_absent_kind
    check (absent->>'kind' in ('platoon','squad','soldiers'));

alter table public.coverage_events
  add constraint coverage_events_covering_kind
    check (covering->>'kind' in ('platoon','squad','soldiers','mission-already-covers'));

create trigger coverage_events_updated_at
  before update on public.coverage_events
  for each row execute function public.set_updated_at();

comment on table public.coverage_events is
  'Explicit coverage declarations. CC creates these when a scope goes on leave to say who covers. The engine never assumes automatic coverage.';
