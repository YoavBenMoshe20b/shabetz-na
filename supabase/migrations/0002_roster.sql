-- ════════════════════════════════════════════════════════════════════════════
-- 0002_roster.sql — Soldiers + status events
--
-- A soldier is an operational SLOT in a company's roster. It can exist
-- before a person claims it (roster-first model). When a user claims via
-- phone+id_last4, soldiers.user_id is set and a corresponding membership
-- row appears.
--
-- soldier_status_events is APPEND-ONLY. The RLS in 0004 enforces this
-- (no UPDATE/DELETE policy). soldiers.current_status is a denormalized
-- cache of the latest event — it must be kept in sync by INSERT triggers
-- or by application-layer transactions.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── soldiers ───────────────────────────────────────────────────────────
create table public.soldiers (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid not null references public.companies(id) on delete cascade,
  user_id                  uuid references public.profiles(id) on delete set null,
  name                     text not null,
  phone                    text not null,
  id_last4                 text not null,
  status                   text not null default 'active' check (status in ('active','inactive')),
  deactivated_at           timestamptz,
  deactivated_reason       text check (deactivated_reason in ('transferred','discharged','revoked')),
  claimed_at               timestamptz,
  -- Operational state (denormalized from status_events for fast reads)
  current_status           public.soldier_status not null default 'in-base',
  status_set_at            timestamptz not null default now(),
  status_expected_until    timestamptz,
  -- Roster placement
  squad_id                 uuid references public.squads(id) on delete set null,
  team_class               text not null default '',
  -- Profile fields (free-text per request)
  operational_roles        text[] not null default '{}',
  functional_roles         text[] not null default '{}',
  date_of_birth            date,
  dominant_hand            text check (dominant_hand in ('right','left')),
  weapon_side              text check (weapon_side   in ('right','left')),
  shirt_size               text,
  pants_size               text,
  shoe_size                text,
  -- Engine metadata
  availability             boolean not null default true, -- legacy mirror of current_status='in-base'
  current_load             integer not null default 0,
  -- Audit
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index soldiers_company         on public.soldiers (company_id);
create index soldiers_company_active  on public.soldiers (company_id) where status = 'active';
create index soldiers_user            on public.soldiers (user_id)    where user_id is not null;
create index soldiers_squad           on public.soldiers (squad_id);
create index soldiers_phone_id4       on public.soldiers (phone, id_last4);

create trigger soldiers_updated_at
  before update on public.soldiers
  for each row execute function public.set_updated_at();

comment on table public.soldiers is
  'Roster slot. Exists before a person claims it; user_id populated on claim. current_status is denormalized from soldier_status_events.';

-- ─── soldier_status_events (APPEND-ONLY) ────────────────────────────────
create table public.soldier_status_events (
  id                 uuid primary key default gen_random_uuid(),
  soldier_id         uuid not null references public.soldiers(id) on delete cascade,
  value              public.soldier_status not null,
  previous_value     public.soldier_status,
  set_at             timestamptz not null default now(),
  set_by             uuid references public.profiles(id), -- nullable for system events
  set_by_name        text,
  set_by_role        public.user_role,
  expected_until     timestamptz,
  reason             text,
  is_manual_override boolean not null default false,
  escalation_id      uuid -- forward reference; resolved when escalation_events lands
);

create index sse_soldier        on public.soldier_status_events (soldier_id);
create index sse_soldier_set_at on public.soldier_status_events (soldier_id, set_at desc);

comment on table public.soldier_status_events is
  'Append-only audit log of every status change. RLS in 0004 blocks UPDATE/DELETE entirely.';

-- ─── INSERT trigger: keep soldiers.current_status in sync ──────────────
-- When a new status event lands, denormalize onto the soldier so reads
-- are fast. Captures previous_value via OLD-state lookup.
create or replace function public.handle_status_event_insert()
returns trigger
language plpgsql
as $$
declare
  prev public.soldier_status;
begin
  -- Capture the soldier's CURRENT status before we mutate it.
  select current_status into prev
    from public.soldiers
   where id = new.soldier_id
   for update;

  -- Stamp previous_value on the event itself (when not already set).
  if new.previous_value is null then
    new.previous_value := prev;
  end if;

  -- Denormalize onto the soldier row.
  update public.soldiers
     set current_status = new.value,
         status_set_at  = new.set_at,
         status_expected_until = new.expected_until,
         availability = (new.value = 'in-base'),
         updated_at = now()
   where id = new.soldier_id;

  return new;
end;
$$;

create trigger soldier_status_event_insert
  before insert on public.soldier_status_events
  for each row execute function public.handle_status_event_insert();

-- ─── helper: which soldier does the current user own? ─────────────────
-- Used by RLS in 0004 for "self-update" paths on status events.
--
-- ⚠ Company scope is intentional: a user with active soldier slots in
-- multiple companies (historical record after transfers) must resolve
-- only to the slot in their currently-active company. Otherwise a user
-- who transferred from Company A to B could match an inactive A slot
-- and bypass B's company-scope RLS.
create or replace function public.current_user_soldier_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id
    from public.soldiers s
   where s.user_id = auth.uid()
     and s.status = 'active'
     and s.company_id = public.current_user_company()
   limit 1;
$$;

-- ─── helper: is the current user in command of this soldier's platoon? ─
-- Walks soldier → squad → platoon and checks the membership.
create or replace function public.commands_soldier_platoon(target_soldier uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.soldiers s
      join public.squads   sq on sq.id = s.squad_id
      join public.memberships m
        on m.user_id = auth.uid()
       and m.is_active = true
       and m.commanded_platoon_id = sq.platoon_id
     where s.id = target_soldier
  );
$$;
