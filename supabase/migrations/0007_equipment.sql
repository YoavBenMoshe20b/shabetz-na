-- ════════════════════════════════════════════════════════════════════════════
-- 0007_equipment.sql — Equipment inventory, signed equipment,
-- lifecycle events, gap reports.
--
-- Four entities make up the logistics module:
--
--   • equipment_items          — company inventory (catalog of available gear)
--   • signed_equipment         — per-soldier ledger (items signed out)
--   • equipment_lifecycle_events — append-only log of every state transition
--   • equipment_gaps           — damage/missing reports (workflow with statuses)
--
-- RLS:
--   • Read: company members
--   • Write: CC + Rasap (functional role) + delegated tokens
--   • Lifecycle log: append-only (no UPDATE/DELETE policies)
-- ════════════════════════════════════════════════════════════════════════════

-- Helper — does the current user have Rasap functional role?
create or replace function public.is_rasap()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.soldiers s
     where s.user_id = auth.uid()
       and s.status = 'active'
       and (
         'רס״פ' = any(s.operational_roles)
         or 'rasap' = any(s.functional_roles)
       )
  );
$$;

-- ─── Enum types ────────────────────────────────────────────────────────
create type public.signed_equipment_status as enum ('active','returned','lost','in-repair');
create type public.equipment_condition     as enum ('new','good','worn','damaged');
create type public.equipment_gap_kind      as enum ('damaged','missing','lost','wrong-spec','out-of-stock');
create type public.equipment_gap_status    as enum ('reported','reviewed-by-platoon','forwarded-to-rasap','resolved','dismissed');

-- ─── equipment_items (company catalog) ─────────────────────────────────
create table public.equipment_items (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  name          text not null,
  category      text,
  is_consumable boolean not null default false,
  unit_count    integer not null default 0,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index equipment_items_company on public.equipment_items (company_id);
create index equipment_items_search  on public.equipment_items (company_id, lower(name));

create trigger equipment_items_updated_at
  before update on public.equipment_items
  for each row execute function public.set_updated_at();

-- ─── signed_equipment (per-soldier ledger) ─────────────────────────────
create table public.signed_equipment (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  soldier_id          uuid not null references public.soldiers(id)  on delete cascade,
  equipment_item_id   uuid references public.equipment_items(id)    on delete set null,
  item_name           text not null,
  category            text,
  serial_number       text,
  source              text,
  signed_by_user_id   uuid references public.profiles(id),
  signed_by_name      text,
  signed_at           timestamptz not null default now(),
  returned_at         timestamptz,
  status              public.signed_equipment_status not null default 'active',
  condition           public.equipment_condition,
  damage_description  text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index signed_equipment_company  on public.signed_equipment (company_id);
create index signed_equipment_soldier  on public.signed_equipment (soldier_id);
create index signed_equipment_active   on public.signed_equipment (company_id, status) where status = 'active';

create trigger signed_equipment_updated_at
  before update on public.signed_equipment
  for each row execute function public.set_updated_at();

-- ─── equipment_lifecycle_events (APPEND-ONLY) ──────────────────────────
create table public.equipment_lifecycle_events (
  id                   uuid primary key default gen_random_uuid(),
  signed_equipment_id  uuid not null references public.signed_equipment(id) on delete cascade,
  company_id           uuid not null references public.companies(id) on delete cascade,
  kind                 text not null check (kind in (
    'sign-out','return-full','return-partial','damage-report',
    'repair-in','repair-out','loss','write-off','condition-change'
  )),
  description          text,
  from_condition       public.equipment_condition,
  to_condition         public.equipment_condition,
  actor_user_id        uuid references public.profiles(id),
  actor_name           text,
  occurred_at          timestamptz not null default now()
);

create index ele_signed     on public.equipment_lifecycle_events (signed_equipment_id, occurred_at desc);
create index ele_company    on public.equipment_lifecycle_events (company_id, occurred_at desc);

comment on table public.equipment_lifecycle_events is
  'Append-only log of every equipment state transition. RLS in this file blocks UPDATE/DELETE.';

-- ─── equipment_gaps (damage / missing workflow) ────────────────────────
create table public.equipment_gaps (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid not null references public.companies(id) on delete cascade,
  soldier_id               uuid not null references public.soldiers(id) on delete cascade,
  reported_by_user_id      uuid references public.profiles(id),
  reported_by_platoon_id   uuid references public.platoons(id),
  kind                     public.equipment_gap_kind not null,
  item_name                text not null,
  signed_equipment_id      uuid references public.signed_equipment(id) on delete set null,
  description              text,
  status                   public.equipment_gap_status not null default 'reported',
  reviewed_by_user_id      uuid references public.profiles(id),
  resolved_by_user_id      uuid references public.profiles(id),
  resolution_notes         text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index equipment_gaps_company  on public.equipment_gaps (company_id);
create index equipment_gaps_open     on public.equipment_gaps (company_id, status)
  where status in ('reported','reviewed-by-platoon','forwarded-to-rasap');
create index equipment_gaps_soldier  on public.equipment_gaps (soldier_id);

create trigger equipment_gaps_updated_at
  before update on public.equipment_gaps
  for each row execute function public.set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────
alter table public.equipment_items             enable row level security;
alter table public.signed_equipment            enable row level security;
alter table public.equipment_lifecycle_events  enable row level security;
alter table public.equipment_gaps              enable row level security;

-- equipment_items: same-company read; CC + Rasap write
create policy equipment_items_select on public.equipment_items
  for select using (company_id = public.current_user_company());

create policy equipment_items_insert on public.equipment_items
  for insert with check (
    company_id = public.current_user_company()
    and (public.is_company_leadership() or public.is_rasap())
  );

create policy equipment_items_update on public.equipment_items
  for update using (
    company_id = public.current_user_company()
    and (public.is_company_leadership() or public.is_rasap())
  );

create policy equipment_items_delete on public.equipment_items
  for delete using (
    company_id = public.current_user_company() and public.is_company_leadership()
  );

-- signed_equipment: same-company read; CC + Rasap write; soldier can
-- READ their own ledger (already covered by company-scope, but explicit)
create policy signed_equipment_select on public.signed_equipment
  for select using (company_id = public.current_user_company());

create policy signed_equipment_insert on public.signed_equipment
  for insert with check (
    company_id = public.current_user_company()
    and (public.is_company_leadership() or public.is_rasap())
  );

create policy signed_equipment_update on public.signed_equipment
  for update using (
    company_id = public.current_user_company()
    and (public.is_company_leadership() or public.is_rasap())
  );

create policy signed_equipment_delete on public.signed_equipment
  for delete using (
    company_id = public.current_user_company() and public.is_company_leadership()
  );

-- equipment_lifecycle_events: APPEND-ONLY (no UPDATE/DELETE policy)
create policy ele_select on public.equipment_lifecycle_events
  for select using (company_id = public.current_user_company());

create policy ele_insert on public.equipment_lifecycle_events
  for insert with check (
    company_id = public.current_user_company()
    and (
      public.is_company_leadership()
      or public.is_rasap()
      or public.is_platoon_leadership()
      -- Or the soldier themselves (self-report).
      or exists (
        select 1 from public.signed_equipment se
         where se.id = equipment_lifecycle_events.signed_equipment_id
           and se.soldier_id = public.current_user_soldier_id()
      )
    )
  );

-- equipment_gaps: same-company read; anyone in company can REPORT
-- (their own); platoon/Rasap/CC can change status.
create policy equipment_gaps_select on public.equipment_gaps
  for select using (company_id = public.current_user_company());

create policy equipment_gaps_insert on public.equipment_gaps
  for insert with check (
    company_id = public.current_user_company()
    and (
      -- Self-report: report a gap on the current user's soldier slot.
      soldier_id = public.current_user_soldier_id()
      -- Or commander (PC/PS) reporting on their soldier
      or public.commands_soldier_platoon(soldier_id)
      -- Or company leadership
      or public.is_company_leadership()
      -- Or Rasap
      or public.is_rasap()
    )
  );

create policy equipment_gaps_update on public.equipment_gaps
  for update using (
    company_id = public.current_user_company()
    and (
      -- Company leadership: any gap in the company.
      public.is_company_leadership()
      -- Rasap: any gap in the company (they own the logistics queue).
      or public.is_rasap()
      -- PC/PS: gaps for soldiers in their commanded platoon ONLY
      -- (review / forward path). They cannot resolve a gap outside
      -- their platoon.
      or (
        public.is_platoon_leadership()
        and public.commands_soldier_platoon(soldier_id)
      )
    )
  );

create policy equipment_gaps_delete on public.equipment_gaps
  for delete using (
    company_id = public.current_user_company() and public.is_company_leadership()
  );

-- ─── Audit ──────────────────────────────────────────────────────────────
create trigger audit_equipment_items     after insert or update or delete on public.equipment_items     for each row execute function public.audit_row_change();
create trigger audit_signed_equipment    after insert or update or delete on public.signed_equipment    for each row execute function public.audit_row_change();
create trigger audit_equipment_gaps      after insert or update or delete on public.equipment_gaps      for each row execute function public.audit_row_change();
-- equipment_lifecycle_events is ITSELF an audit log; don't double-audit.
