-- ════════════════════════════════════════════════════════════════════════════
-- 0005_audit.sql — Generic audit log + table triggers
--
-- ONE audit_logs table for every mutation we care about. Triggers
-- automatically write to it; application code does NOT explicitly log.
--
-- Critical property: audit_logs is append-only. RLS allows INSERT (via
-- trigger) and SELECT (CC only) but no UPDATE/DELETE policies — they
-- default-deny.
-- ════════════════════════════════════════════════════════════════════════════

create table public.audit_logs (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid references public.companies(id) on delete set null,
  actor_user_id     uuid references public.profiles(id),
  actor_name        text,
  actor_role        public.user_role,
  table_name        text not null,
  record_id         uuid,
  action            text not null check (action in ('INSERT','UPDATE','DELETE','CUSTOM')),
  payload           jsonb,
  occurred_at       timestamptz not null default now()
);

create index audit_logs_company   on public.audit_logs (company_id);
create index audit_logs_table     on public.audit_logs (table_name, occurred_at desc);
create index audit_logs_actor     on public.audit_logs (actor_user_id);

alter table public.audit_logs enable row level security;

-- Only CC can read; the trigger inserts; no updates/deletes.
create policy audit_logs_select on public.audit_logs
  for select using (
    company_id = public.current_user_company() and public.is_company_leadership()
  );

-- ─── Generic audit trigger function ─────────────────────────────────
-- Writes a row to audit_logs for INSERT/UPDATE/DELETE on the wrapping
-- table. Each subscribing table installs the trigger with its own name.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_profile public.profiles%rowtype;
  actor_membership public.memberships%rowtype;
  payload_jsonb jsonb;
  resolved_company uuid;
begin
  -- Resolve actor identity. NULL when run from a server function or
  -- migration (no auth.uid()).
  if auth.uid() is not null then
    select * into actor_profile from public.profiles where id = auth.uid();
    select * into actor_membership
      from public.memberships
     where user_id = auth.uid() and is_active = true
     limit 1;
  end if;

  -- Resolve target company_id. Most of our business tables have it as
  -- a column. Fall back to the actor's company.
  if tg_op = 'DELETE' then
    payload_jsonb := to_jsonb(OLD);
    resolved_company := coalesce(
      (OLD::jsonb)->>'company_id',
      actor_membership.company_id::text
    )::uuid;
  else
    payload_jsonb := to_jsonb(NEW);
    resolved_company := coalesce(
      (NEW::jsonb)->>'company_id',
      actor_membership.company_id::text
    )::uuid;
  end if;

  insert into public.audit_logs (
    company_id, actor_user_id, actor_name, actor_role,
    table_name, record_id, action, payload
  ) values (
    resolved_company,
    auth.uid(),
    actor_profile.full_name,
    actor_membership.role,
    tg_table_name,
    case tg_op
      when 'DELETE' then (OLD::jsonb->>'id')::uuid
      else (NEW::jsonb->>'id')::uuid
    end,
    tg_op,
    payload_jsonb
  );

  if tg_op = 'DELETE' then
    return OLD;
  else
    return NEW;
  end if;
end;
$$;

-- ─── Subscribe critical tables ────────────────────────────────────
-- We DON'T audit every table — only those where the historical trail
-- matters. Reads are unaffected.

create trigger audit_companies        after insert or update or delete on public.companies        for each row execute function public.audit_row_change();
create trigger audit_platoons         after insert or update or delete on public.platoons         for each row execute function public.audit_row_change();
create trigger audit_squads           after insert or update or delete on public.squads           for each row execute function public.audit_row_change();
create trigger audit_memberships      after insert or update or delete on public.memberships      for each row execute function public.audit_row_change();
create trigger audit_soldiers         after insert or update or delete on public.soldiers         for each row execute function public.audit_row_change();
create trigger audit_leaves           after insert or update or delete on public.leaves           for each row execute function public.audit_row_change();
create trigger audit_leave_requests   after insert or update or delete on public.leave_requests   for each row execute function public.audit_row_change();
create trigger audit_coverage_events  after insert or update or delete on public.coverage_events  for each row execute function public.audit_row_change();

-- Note: soldier_status_events is ALREADY an audit log — no double audit.
