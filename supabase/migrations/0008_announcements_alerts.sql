-- ════════════════════════════════════════════════════════════════════════════
-- 0008_announcements_alerts.sql — Announcements, escalations,
-- and operational override alerts.
--
-- Three streams that surface in the UI's alerts/announcement surfaces:
--   • announcements   — CC/PC broadcast messages with audience scope
--   • escalation_events — operational "הקפצה" / call-up events
--   • override_alerts — engine-generated alerts about manpower / gaps
--
-- RLS:
--   • Reads: company members; further audience filtering happens in
--     application code (utils/announcementProjection.ts).
--   • Announcement writes: gated by `canCreateAnnouncement` semantics
--     (CC always; PC for platoon scope).
--   • Escalation writes: CC + delegated.
--   • Override alerts: engine writes (service-role bypass); UI can ack
--     and resolve.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Enums ─────────────────────────────────────────────────────────────
create type public.announcement_kind   as enum ('message','schedule','operational');
-- Mirrors frontend AnnouncementStatus from src/types/index.ts.
create type public.announcement_status as enum ('active','closed','archived');
-- Mirrors frontend EscalationStatus.
create type public.escalation_status   as enum ('active','closed');
create type public.alert_status        as enum ('open','acknowledged','resolved');
create type public.alert_risk          as enum ('low','medium','high');

-- ─── announcements ─────────────────────────────────────────────────────
-- `audience` is a JSONB discriminated union mirroring the frontend's
-- Audience type ({ kind: 'company' | 'platoon' | 'squad' | ... }).
create table public.announcements (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  kind                public.announcement_kind not null,
  status              public.announcement_status not null default 'active',
  title               text not null,
  body                text,
  audience            jsonb not null,
  pinned              boolean not null default false,
  start_date          date,
  start_time          text,
  end_date            date,
  end_time            text,
  created_by_user_id  uuid references public.profiles(id),
  created_by_name     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index announcements_company         on public.announcements (company_id);
create index announcements_company_status  on public.announcements (company_id, status);
create index announcements_pinned          on public.announcements (company_id) where pinned;

alter table public.announcements
  add constraint announcements_audience_kind
    check (audience->>'kind' in ('company','platoon','squad','soldiers','functional','custom'));

create trigger announcements_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

-- ─── escalation_events (הקפצה) ─────────────────────────────────────────
create table public.escalation_events (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  title               text not null,
  detail              text,
  audience            jsonb not null,
  status              public.escalation_status not null default 'active',
  opened_at           timestamptz not null default now(),
  opened_by_user_id   uuid references public.profiles(id),
  opened_by_name      text,
  closed_at           timestamptz,
  closed_by_user_id   uuid references public.profiles(id),
  close_reason        text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index escalations_company        on public.escalation_events (company_id);
create index escalations_active         on public.escalation_events (company_id) where status = 'active';

alter table public.escalation_events
  add constraint escalations_audience_kind
    check (audience->>'kind' in ('company','platoon','squad','soldiers','functional','custom'));

create trigger escalation_events_updated_at
  before update on public.escalation_events
  for each row execute function public.set_updated_at();

-- ─── override_alerts ───────────────────────────────────────────────────
create table public.override_alerts (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid not null references public.companies(id) on delete cascade,
  platoon_id               uuid references public.platoons(id),
  kind                     text not null,
  description              text not null,
  suggested_action         text,
  risk_level               public.alert_risk not null default 'medium',
  status                   public.alert_status not null default 'open',
  acknowledged_by_user_id  uuid references public.profiles(id),
  acknowledged_at          timestamptz,
  resolved_by_user_id      uuid references public.profiles(id),
  resolved_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index override_alerts_company      on public.override_alerts (company_id);
create index override_alerts_open         on public.override_alerts (company_id, status) where status = 'open';
create index override_alerts_platoon      on public.override_alerts (platoon_id);

create trigger override_alerts_updated_at
  before update on public.override_alerts
  for each row execute function public.set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────
alter table public.announcements       enable row level security;
alter table public.escalation_events   enable row level security;
alter table public.override_alerts     enable row level security;

-- announcements: same-company read; CC any write; PC for platoon-scoped only.
create policy announcements_select on public.announcements
  for select using (company_id = public.current_user_company());

-- Helper: does the audience JSON target a scope the current commander
-- is actually authorized to address? CC may target anything; PC may
-- only target their commanded platoon (and squads inside it).
create or replace function public.audience_within_authority(audience jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  audience_kind text;
  audience_platoon uuid;
  audience_squad_platoon uuid;
begin
  if public.is_company_leadership() then return true; end if;
  if not public.is_platoon_leadership() then return false; end if;

  audience_kind := audience->>'kind';

  if audience_kind = 'platoon' then
    audience_platoon := (audience->>'platoonId')::uuid;
    return audience_platoon = public.current_user_commanded_platoon();
  end if;

  if audience_kind = 'squad' then
    audience_squad_platoon := (
      select platoon_id from public.squads
       where id = (audience->>'squadId')::uuid
    );
    return audience_squad_platoon = public.current_user_commanded_platoon();
  end if;

  if audience_kind = 'soldiers' then
    -- All listed soldiers must be in the commander's platoon.
    return not exists (
      select 1
        from unnest((
          select array_agg(value::uuid)
            from jsonb_array_elements_text(audience->'soldierIds') as value
        )) as sid
        join public.soldiers s on s.id = sid
        left join public.squads sq on sq.id = s.squad_id
       where coalesce(sq.platoon_id, '00000000-0000-0000-0000-000000000000'::uuid)
             <> public.current_user_commanded_platoon()
    );
  end if;

  -- Unknown / over-broad scope → deny.
  return false;
end;
$$;

create policy announcements_insert on public.announcements
  for insert with check (
    company_id = public.current_user_company()
    and public.audience_within_authority(audience)
  );

create policy announcements_update on public.announcements
  for update using (
    company_id = public.current_user_company()
    and (
      public.is_company_leadership()
      or created_by_user_id = auth.uid()
    )
  );

create policy announcements_delete on public.announcements
  for delete using (
    company_id = public.current_user_company() and public.is_company_leadership()
  );

-- escalation_events: same-company read; CC writes; PC can close their
-- own escalation but not declare one.
create policy escalations_select on public.escalation_events
  for select using (company_id = public.current_user_company());

create policy escalations_insert on public.escalation_events
  for insert with check (
    company_id = public.current_user_company() and public.is_company_leadership()
  );

create policy escalations_update on public.escalation_events
  for update using (
    company_id = public.current_user_company()
    and (
      public.is_company_leadership()
      or opened_by_user_id = auth.uid()
    )
  );

-- override_alerts: same-company read; platoon/company leadership can
-- acknowledge + resolve. INSERT is service-role (engine) — no policy.
create policy override_alerts_select on public.override_alerts
  for select using (company_id = public.current_user_company());

create policy override_alerts_update on public.override_alerts
  for update using (
    company_id = public.current_user_company()
    and (public.is_company_leadership() or public.is_platoon_leadership())
  );

-- ─── Audit ──────────────────────────────────────────────────────────────
create trigger audit_announcements      after insert or update or delete on public.announcements      for each row execute function public.audit_row_change();
create trigger audit_escalation_events  after insert or update or delete on public.escalation_events  for each row execute function public.audit_row_change();
create trigger audit_override_alerts    after insert or update or delete on public.override_alerts    for each row execute function public.audit_row_change();
