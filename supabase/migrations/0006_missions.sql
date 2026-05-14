-- ════════════════════════════════════════════════════════════════════════════
-- 0006_missions.sql — Operational orders + missions + mission notes
--
-- Strategy: top-level filterable fields get dedicated columns (status,
-- date range, owner role, assigned platoons). The complex policy
-- objects (time model, manpower spec, command spec, rotation, fatigue,
-- equipment requirements, qualification requirements) live in a single
-- `spec` JSONB column. This keeps the migration tractable and lets the
-- frontend continue using its existing rich types.
--
-- RLS:
--   • orders / missions: same-company read; CC writes; PC writes only
--                        when ownerRole=platoon AND platoon matches.
--   • mission notes:     same-company read; author writes (CC any,
--                        PC only their platoon's notes).
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Operational orders (צווים) ─────────────────────────────────────────
create type public.operational_order_status as enum ('planning','published','archived');

create table public.operational_orders (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  name         text not null,
  status       public.operational_order_status not null default 'planning',
  start_date   date,
  end_date     date,
  notes        text,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index orders_company    on public.operational_orders (company_id);
create index orders_active     on public.operational_orders (company_id, status) where status != 'archived';

create trigger orders_updated_at
  before update on public.operational_orders
  for each row execute function public.set_updated_at();

-- ─── Mission status enum ────────────────────────────────────────────────
-- Mirrors the frontend's MissionStatus union. Keep in sync with
-- src/types/index.ts.
create type public.mission_status as enum (
  'draft', 'scheduled', 'active', 'completed', 'cancelled',
  'suspended', 'rolling-out', 'wind-down', 'archived'
);

-- ─── Missions ───────────────────────────────────────────────────────────
create table public.missions (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  order_id       uuid references public.operational_orders(id) on delete set null,
  name           text not null,
  description    text,
  owner_role     text not null check (owner_role in ('company','platoon')),
  status         public.mission_status not null default 'draft',
  start_date     date,
  end_date       date,
  -- Platoons sharing responsibility. Array of platoons.id.
  assigned_platoon_ids uuid[] not null default '{}',
  -- Composable policy bag: timeModel, manpower, command, rotation,
  -- fatigue, cycleProfile, overlapPolicy, qualifications, equipment,
  -- logisticsAlerts, pairings, squadPolicy, conflictsWith, canOverlapWith,
  -- requiresDailyConfirmation.
  spec           jsonb not null default '{}'::jsonb,
  escalation_id  uuid,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index missions_company       on public.missions (company_id);
create index missions_order         on public.missions (order_id);
create index missions_status        on public.missions (company_id, status);
create index missions_active_window on public.missions (company_id, start_date, end_date)
  where status in ('scheduled','active','rolling-out','wind-down');

create trigger missions_updated_at
  before update on public.missions
  for each row execute function public.set_updated_at();

comment on table public.missions is
  'Mission definitions. spec JSONB holds the rich policy objects; top-level columns are the filter axes.';

-- ─── Mission notes ──────────────────────────────────────────────────────
create table public.mission_notes (
  id          uuid primary key default gen_random_uuid(),
  mission_id  uuid not null references public.missions(id) on delete cascade,
  scope       text not null check (scope in ('company','platoon')),
  platoon_id  uuid references public.platoons(id) on delete set null,
  text        text not null,
  author_id   uuid references public.profiles(id),
  author_name text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index mission_notes_mission on public.mission_notes (mission_id);
create index mission_notes_platoon on public.mission_notes (platoon_id);

create trigger mission_notes_updated_at
  before update on public.mission_notes
  for each row execute function public.set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────
alter table public.operational_orders enable row level security;
alter table public.missions           enable row level security;
alter table public.mission_notes      enable row level security;

-- operational_orders: company read, CC write
create policy orders_select on public.operational_orders
  for select using (company_id = public.current_user_company());

create policy orders_insert on public.operational_orders
  for insert with check (
    company_id = public.current_user_company() and public.is_company_leadership()
  );

create policy orders_update on public.operational_orders
  for update using (
    company_id = public.current_user_company() and public.is_company_leadership()
  );

create policy orders_delete on public.operational_orders
  for delete using (
    company_id = public.current_user_company() and public.is_company_leadership()
  );

-- missions: company read; CC any write; PC write only for platoon-owned
-- missions of their commanded platoon.
create policy missions_select on public.missions
  for select using (company_id = public.current_user_company());

create policy missions_insert on public.missions
  for insert with check (
    company_id = public.current_user_company()
    and (
      -- Company leadership creates any mission (company or platoon scope).
      public.is_company_leadership()
      -- PC/PS create ONLY platoon-owned missions that include their
      -- commanded platoon. Never company-scope missions.
      or (
        owner_role = 'platoon'
        and public.is_platoon_leadership()
        and public.current_user_commanded_platoon() = any(assigned_platoon_ids)
      )
    )
  );

create policy missions_update on public.missions
  for update using (
    company_id = public.current_user_company()
    and (
      -- Company leadership can update any mission they own.
      public.is_company_leadership()
      -- PC/PS update ONLY platoon-owned missions, AND only when their
      -- commanded platoon is in the assignment list. Company-owned
      -- missions (owner_role='company') are NEVER updatable by PC, even
      -- if the assignment list includes their platoon.
      or (
        owner_role = 'platoon'
        and public.is_platoon_leadership()
        and public.current_user_commanded_platoon() = any(assigned_platoon_ids)
      )
    )
  );

create policy missions_delete on public.missions
  for delete using (
    company_id = public.current_user_company() and public.is_company_leadership()
  );

-- mission_notes: company read; PC/CC write own scope
create policy mission_notes_select on public.mission_notes
  for select using (
    exists (
      select 1 from public.missions m
       where m.id = mission_notes.mission_id
         and m.company_id = public.current_user_company()
    )
  );

create policy mission_notes_insert on public.mission_notes
  for insert with check (
    exists (
      select 1 from public.missions m
       where m.id = mission_notes.mission_id
         and m.company_id = public.current_user_company()
    )
    and (
      public.is_company_leadership()
      or (mission_notes.scope = 'platoon'
          and public.is_platoon_leadership()
          and public.current_user_commanded_platoon() = mission_notes.platoon_id)
    )
  );

create policy mission_notes_update on public.mission_notes
  for update using (
    exists (
      select 1 from public.missions m
       where m.id = mission_notes.mission_id
         and m.company_id = public.current_user_company()
    )
    and (
      public.is_company_leadership()
      or author_id = auth.uid()
    )
  );

create policy mission_notes_delete on public.mission_notes
  for delete using (
    exists (
      select 1 from public.missions m
       where m.id = mission_notes.mission_id
         and m.company_id = public.current_user_company()
    )
    and (
      public.is_company_leadership()
      or author_id = auth.uid()
    )
  );

-- ─── Audit ──────────────────────────────────────────────────────────────
create trigger audit_operational_orders after insert or update or delete on public.operational_orders for each row execute function public.audit_row_change();
create trigger audit_missions           after insert or update or delete on public.missions           for each row execute function public.audit_row_change();
create trigger audit_mission_notes      after insert or update or delete on public.mission_notes      for each row execute function public.audit_row_change();
