-- ════════════════════════════════════════════════════════════════════════════
-- 0001_identity.sql — Identity, organization, and memberships
--
-- The foundation every other table sits on. Defines:
--   • ENUM types used across the schema
--   • profiles    — one row per authenticated human (linked to auth.users)
--   • companies   — the tenant boundary
--   • platoons    — child of company
--   • squads      — child of platoon
--   • memberships — the user → company → platoon → squad junction
--                   carrying the user's role in that company. Multiple
--                   memberships allowed per user (transfers), but only one
--                   `is_active = true` per (user, company) at a time.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Extensions ──────────────────────────────────────────────────────────
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ─── Shared trigger: keep updated_at fresh ───────────────────────────────
-- Used by every table that has an `updated_at` column.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─── ENUM types ──────────────────────────────────────────────────────────
-- Defined once, used across the schema. Adding new values is a migration.
create type public.user_role as enum (
  'companyCommander',
  'deputyCompanyCommander',
  'platoonCommander',
  'platoonSergeant',
  'soldier',
  'owner',   -- legacy alias for companyCommander
  'manager'  -- legacy alias for platoonCommander
);

create type public.platoon_kind as enum (
  'combat',
  'forward-command',
  'logistics',
  'hq',
  'custom'
);

create type public.soldier_status as enum (
  'in-base',
  'home',
  'inactive-temp'
);

create type public.signed_equipment_status as enum (
  'active',
  'returned',
  'lost',
  'in-repair'
);

create type public.equipment_condition as enum (
  'new',
  'good',
  'worn',
  'damaged',
  'unusable'
);

create type public.leave_scope as enum (
  'individual',
  'squad',
  'machlaka'
);

create type public.leave_request_status as enum (
  'pending',
  'approved',
  'rejected'
);

create type public.coverage_event_reason as enum (
  'company-event',
  'rest-activity',
  'training',
  'logistics',
  'other'
);

-- ─── profiles ────────────────────────────────────────────────────────────
-- One row per authenticated user. The id is the same as auth.users(id) so
-- the JWT subject directly identifies the profile. RLS in 0004 ties every
-- query to auth.uid() through this table.
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text not null,
  phone             text not null unique,
  id_last4          text,
  date_of_birth     date,
  dominant_hand     text check (dominant_hand in ('right','left')),
  weapon_side       text check (weapon_side   in ('right','left')),
  shirt_size        text,
  pants_size        text,
  shoe_size         text,
  operational_roles text[] not null default '{}',
  functional_roles  text[] not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

comment on table public.profiles is
  'One row per authenticated user. Lives independently of company memberships so transfers do not lose personal data.';

-- ─── companies ──────────────────────────────────────────────────────────
create table public.companies (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  unit_name       text,
  commander_user_id uuid references public.profiles(id),
  deputy_commander_user_id uuid references public.profiles(id),
  invite_code     text not null unique,
  settings        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- ─── platoons ──────────────────────────────────────────────────────────
create table public.platoons (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid not null references public.companies(id) on delete cascade,
  name                     text not null,
  unit_name                text,
  code                     text not null,
  kind                     public.platoon_kind not null default 'combat',
  size                     integer,
  available_roles          text[] not null default '{}',
  enemy_confusion          boolean not null default false,
  confusion_minutes        integer,
  follows_company_rotation boolean not null default true,
  min_soldiers_on_base     integer,
  is_special_platoon       boolean not null default false, -- legacy mirror
  -- Officer back-references (denormalized; the source of truth is memberships)
  platoon_commander_user_id uuid references public.profiles(id),
  platoon_sergeant_user_id  uuid references public.profiles(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create unique index platoons_company_code on public.platoons (company_id, code);
create index platoons_company on public.platoons (company_id);

create trigger platoons_updated_at
  before update on public.platoons
  for each row execute function public.set_updated_at();

-- ─── squads ──────────────────────────────────────────────────────────
create table public.squads (
  id          uuid primary key default gen_random_uuid(),
  platoon_id  uuid not null references public.platoons(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index squads_platoon on public.squads (platoon_id);

create trigger squads_updated_at
  before update on public.squads
  for each row execute function public.set_updated_at();

-- ─── memberships ──────────────────────────────────────────────────────
-- The user → company link. A user can have multiple memberships
-- (transfers), but only one `is_active = true` per (user, company).
-- Carries the user's role + scope (platoon / squad) WITHIN that company.
create table public.memberships (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  company_id            uuid not null references public.companies(id) on delete cascade,
  role                  public.user_role not null default 'soldier',
  platoon_id            uuid references public.platoons(id) on delete set null,
  commanded_platoon_id  uuid references public.platoons(id) on delete set null,
  squad_id              uuid references public.squads(id)   on delete set null,
  is_active             boolean not null default true,
  joined_at             timestamptz not null default now(),
  left_at               timestamptz,
  left_reason           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Only ONE active membership per (user, company). Other memberships
-- (historical) have is_active = false.
create unique index memberships_one_active_per_company
  on public.memberships (user_id, company_id)
  where is_active;

create index memberships_user      on public.memberships (user_id);
create index memberships_company   on public.memberships (company_id);
create index memberships_platoon   on public.memberships (platoon_id);

create trigger memberships_updated_at
  before update on public.memberships
  for each row execute function public.set_updated_at();

comment on table public.memberships is
  'User-to-company junction. The single source of truth for "which role does this user have in this company".';

-- ─── auth helpers (used by RLS in 0004) ─────────────────────────────
-- We declare them here so dependent migrations can reference them.
-- Implementations are simple enough to be inline; 0004 wires them
-- into policies.

-- Returns the company_id of the active membership for the current user.
-- NULL when the user has no active membership.
create or replace function public.current_user_company()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id
    from public.memberships
   where user_id = auth.uid()
     and is_active = true
   limit 1;
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
    from public.memberships
   where user_id = auth.uid()
     and is_active = true
   limit 1;
$$;

create or replace function public.current_user_commanded_platoon()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select commanded_platoon_id
    from public.memberships
   where user_id = auth.uid()
     and is_active = true
   limit 1;
$$;

create or replace function public.current_user_platoon()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select platoon_id
    from public.memberships
   where user_id = auth.uid()
     and is_active = true
   limit 1;
$$;

create or replace function public.is_company_leadership()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('companyCommander', 'deputyCompanyCommander', 'owner')
       from public.memberships
      where user_id = auth.uid() and is_active = true
      limit 1),
    false
  );
$$;

create or replace function public.is_platoon_leadership()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('companyCommander', 'deputyCompanyCommander', 'owner',
                     'platoonCommander', 'platoonSergeant', 'manager')
       from public.memberships
      where user_id = auth.uid() and is_active = true
      limit 1),
    false
  );
$$;

create or replace function public.is_rasap()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select 'רס״פ' = any(operational_roles)
            or 'rasap' = any(functional_roles)
       from public.profiles
      where id = auth.uid()
      limit 1),
    false
  );
$$;

-- ─── auth-users → profiles bridge ───────────────────────────────────
-- When Supabase Auth creates a new auth.users row, we mirror a minimal
-- profile so downstream FKs work. Real profile data (full_name, etc.)
-- is filled by the claim flow on first sign-in.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'משתמש חדש'),
    coalesce(new.phone, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
