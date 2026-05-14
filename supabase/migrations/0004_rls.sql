-- ════════════════════════════════════════════════════════════════════════════
-- 0004_rls.sql — Row-Level Security policies
--
-- The Phase-1 security layer. Every table gets RLS turned ON; explicit
-- policies grant what's allowed. Default deny.
--
-- Patterns:
--   • company-scope    — SELECT only rows where company_id matches the
--                        current user's active membership.
--   • role-scope       — write paths gated by role helpers.
--   • platoon-scope    — PC/PS can only act on soldiers in their
--                        commanded platoon.
--   • self-scope       — soldier acting on themselves (status events,
--                        leave requests).
--   • append-only      — soldier_status_events allows INSERT but no
--                        UPDATE/DELETE.
--
-- All helper functions (current_user_company, current_user_role, etc.)
-- are declared in 0001_identity.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Enable RLS on every table ───────────────────────────────────────
alter table public.profiles                enable row level security;
alter table public.companies               enable row level security;
alter table public.platoons                enable row level security;
alter table public.squads                  enable row level security;
alter table public.memberships             enable row level security;
alter table public.soldiers                enable row level security;
alter table public.soldier_status_events   enable row level security;
alter table public.leaves                  enable row level security;
alter table public.leave_requests          enable row level security;
alter table public.coverage_events         enable row level security;

-- ════════════════════════════════════════════════════════════════════════
-- profiles
--   • SELECT: self only. Profiles are private — even commanders see a
--             soldier through the `soldiers` table, not `profiles`.
--   • INSERT: handled by the auth trigger; users cannot insert directly.
--   • UPDATE: self only.
-- ════════════════════════════════════════════════════════════════════════
create policy profiles_select_self on public.profiles
  for select using (id = auth.uid());

create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════
-- companies
--   • SELECT: the user's own company only.
--   • INSERT: any authenticated user (bootstrap CC path).
--   • UPDATE: CC only.
-- ════════════════════════════════════════════════════════════════════════
create policy companies_select on public.companies
  for select using (id = public.current_user_company());

create policy companies_insert on public.companies
  for insert with check (auth.uid() is not null);

create policy companies_update on public.companies
  for update using (
    id = public.current_user_company() and public.is_company_leadership()
  );

-- ════════════════════════════════════════════════════════════════════════
-- platoons
--   • SELECT: same company.
--   • INSERT/UPDATE/DELETE: CC only.
-- ════════════════════════════════════════════════════════════════════════
create policy platoons_select on public.platoons
  for select using (company_id = public.current_user_company());

create policy platoons_insert on public.platoons
  for insert with check (
    company_id = public.current_user_company() and public.is_company_leadership()
  );

create policy platoons_update on public.platoons
  for update using (
    company_id = public.current_user_company() and public.is_company_leadership()
  );

create policy platoons_delete on public.platoons
  for delete using (
    company_id = public.current_user_company() and public.is_company_leadership()
  );

-- ════════════════════════════════════════════════════════════════════════
-- squads
--   • SELECT: same company.
--   • INSERT: CC or PC of that platoon.
--   • UPDATE: same.
--   • DELETE: CC only.
-- ════════════════════════════════════════════════════════════════════════
create policy squads_select on public.squads
  for select using (
    exists (
      select 1 from public.platoons p
       where p.id = squads.platoon_id
         and p.company_id = public.current_user_company()
    )
  );

create policy squads_insert on public.squads
  for insert with check (
    exists (
      select 1 from public.platoons p
       where p.id = squads.platoon_id
         and p.company_id = public.current_user_company()
         and (public.is_company_leadership()
              or public.current_user_commanded_platoon() = p.id)
    )
  );

create policy squads_update on public.squads
  for update using (
    exists (
      select 1 from public.platoons p
       where p.id = squads.platoon_id
         and p.company_id = public.current_user_company()
         and (public.is_company_leadership()
              or public.current_user_commanded_platoon() = p.id)
    )
  );

create policy squads_delete on public.squads
  for delete using (
    exists (
      select 1 from public.platoons p
       where p.id = squads.platoon_id
         and p.company_id = public.current_user_company()
         and public.is_company_leadership()
    )
  );

-- ════════════════════════════════════════════════════════════════════════
-- memberships
--   • SELECT: same company.
--   • INSERT/UPDATE: CC only (manages who is in the company).
-- ════════════════════════════════════════════════════════════════════════
create policy memberships_select on public.memberships
  for select using (company_id = public.current_user_company());

create policy memberships_insert on public.memberships
  for insert with check (
    company_id = public.current_user_company() and public.is_company_leadership()
  );

create policy memberships_update on public.memberships
  for update using (
    company_id = public.current_user_company() and public.is_company_leadership()
  );

-- ════════════════════════════════════════════════════════════════════════
-- soldiers
--   • SELECT: same company.
--   • INSERT: CC only.
--   • UPDATE: CC any, PC/PS only their commanded platoon.
-- ════════════════════════════════════════════════════════════════════════
create policy soldiers_select on public.soldiers
  for select using (company_id = public.current_user_company());

create policy soldiers_insert on public.soldiers
  for insert with check (
    company_id = public.current_user_company() and public.is_company_leadership()
  );

create policy soldiers_update on public.soldiers
  for update using (
    company_id = public.current_user_company()
    and (
      public.is_company_leadership()
      or (
        public.is_platoon_leadership()
        and public.current_user_commanded_platoon() in (
          select platoon_id from public.squads where id = soldiers.squad_id
        )
      )
    )
  );

-- ════════════════════════════════════════════════════════════════════════
-- soldier_status_events — APPEND-ONLY
--   • SELECT: same company (via soldier).
--   • INSERT: soldier on self OR commander of soldier's platoon
--             OR CC.
--   • UPDATE/DELETE: forbidden. (No policy = denied by default.)
-- ════════════════════════════════════════════════════════════════════════
create policy sse_select on public.soldier_status_events
  for select using (
    exists (
      select 1 from public.soldiers s
       where s.id = soldier_status_events.soldier_id
         and s.company_id = public.current_user_company()
    )
  );

create policy sse_insert on public.soldier_status_events
  for insert with check (
    exists (
      select 1 from public.soldiers s
       where s.id = soldier_status_events.soldier_id
         and s.company_id = public.current_user_company()
         and (
           -- Soldier acting on self
           s.user_id = auth.uid()
           -- OR Company leadership (any soldier in company)
           or public.is_company_leadership()
           -- OR PC/PS of soldier's platoon
           or public.commands_soldier_platoon(s.id)
         )
    )
  );

-- ════════════════════════════════════════════════════════════════════════
-- leaves
--   • SELECT: same company.
--   • INSERT/UPDATE: CC any, PC of the involved soldier's platoon.
--   • DELETE: CC only.
-- ════════════════════════════════════════════════════════════════════════
create policy leaves_select on public.leaves
  for select using (company_id = public.current_user_company());

create policy leaves_insert on public.leaves
  for insert with check (
    company_id = public.current_user_company()
    and (public.is_company_leadership() or public.is_platoon_leadership())
  );

create policy leaves_update on public.leaves
  for update using (
    company_id = public.current_user_company()
    and (public.is_company_leadership() or public.is_platoon_leadership())
  );

create policy leaves_delete on public.leaves
  for delete using (
    company_id = public.current_user_company() and public.is_company_leadership()
  );

-- ════════════════════════════════════════════════════════════════════════
-- leave_requests
--   • SELECT: self OR commander who can approve (Phase 1: same company).
--             Tight approval-chain scoping comes in Phase 2 via a SQL
--             function mirroring approvalRoutingFor.
--   • INSERT: self (soldier submitting their own request).
--   • UPDATE: approver only (Phase 1: any platoon leadership in company).
-- ════════════════════════════════════════════════════════════════════════
create policy leave_requests_select on public.leave_requests
  for select using (
    company_id = public.current_user_company()
    and (
      -- The soldier whose request this is
      soldier_id = public.current_user_soldier_id()
      -- Company leadership (CC + Deputy CC) sees all requests in company
      or public.is_company_leadership()
      -- PC/PS only see requests from soldiers in their commanded platoon
      or (public.is_platoon_leadership()
          and public.commands_soldier_platoon(soldier_id))
    )
  );

create policy leave_requests_insert on public.leave_requests
  for insert with check (
    company_id = public.current_user_company()
    and soldier_id = public.current_user_soldier_id()
  );

create policy leave_requests_update on public.leave_requests
  for update using (
    company_id = public.current_user_company()
    and public.is_platoon_leadership()
  );

-- ════════════════════════════════════════════════════════════════════════
-- coverage_events
--   • SELECT: same company.
--   • INSERT/UPDATE/DELETE: CC only.
-- ════════════════════════════════════════════════════════════════════════
create policy coverage_select on public.coverage_events
  for select using (company_id = public.current_user_company());

create policy coverage_insert on public.coverage_events
  for insert with check (
    company_id = public.current_user_company() and public.is_company_leadership()
  );

create policy coverage_update on public.coverage_events
  for update using (
    company_id = public.current_user_company() and public.is_company_leadership()
  );

create policy coverage_delete on public.coverage_events
  for delete using (
    company_id = public.current_user_company() and public.is_company_leadership()
  );
