# `supabase/` — Phase 1 Backend

This directory holds everything the database needs to come alive: SQL
migrations, RLS policies, audit triggers, and seed data.

## Quick start

### 1. Create a Supabase project
1. Sign up at https://supabase.com (free tier is enough).
2. Create a new project. Note the **URL** and **anon key** (Project Settings → API).
3. In **Authentication → Providers → Phone**, enable Phone auth. For development,
   you can use the built-in OTP without an SMS provider (Supabase shows the OTP
   in the dashboard logs).

### 2. Apply migrations

**Option A — via Supabase CLI (recommended):**
```bash
npm install -g supabase
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
supabase db push
```
The CLI runs every file in `supabase/migrations/` in order.

**Option B — paste into Supabase Studio SQL editor:**
1. Open Studio → SQL Editor.
2. Open each file in `supabase/migrations/` in order (0001 → 0002 → ...)
3. Paste + Run.

### 3. Seed demo data
```bash
supabase db reset           # if applying from scratch (cleans + reapplies + seeds)
```
Or paste `supabase/seed.sql` into Studio SQL Editor after the migrations.

### 4. Wire the frontend
Add to your `.env` (copy `.env.example`):
```
VITE_USE_SUPABASE=true
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

When `VITE_USE_SUPABASE=false` (or unset), the app continues to use the
mockData in `src/data/mockData.ts`. This lets developers work offline.

## Directory layout

```
supabase/
├── README.md              ← this file
├── migrations/
│   ├── 0001_identity.sql       — profiles, companies, platoons, squads, memberships, ENUMs
│   ├── 0002_roster.sql         — soldiers, soldier_status_events
│   ├── 0003_leave_coverage.sql — leaves, leave_requests, coverage_events
│   ├── 0004_rls.sql            — Row-Level Security policies
│   └── 0005_audit.sql          — generic audit_logs + triggers
└── seed.sql               ← demo company + 7 users (one per role) + soldiers
```

## Architectural conventions (read this once)

* **UUIDs everywhere.** `gen_random_uuid()` default. No serial ids.
* **`company_id` is the tenant boundary.** Every business table has it.
  RLS policies always start with `company_id = auth.current_user_company()`.
* **snake_case in SQL, camelCase in TS.** The Supabase JS client maps
  automatically via the `mapColumns` option in `_supabase.ts`.
* **ENUMs as Postgres types**, not TEXT. Listed in `0001_identity.sql`.
* **JSONB for discriminated unions.** `audience`, `time_model`, `manpower`,
  etc. — the SQL stores them; the TS layer narrows them.
* **Append-only tables**: `soldier_status_events`, `audit_logs`. No
  UPDATE/DELETE policies; INSERT only.
* **`updated_at` triggers** on tables that mutate. See `0001_identity.sql`
  for the shared `set_updated_at()` function.

## RLS — what's enforced in Phase 1

| Table | Read | Insert | Update | Delete |
|---|---|---|---|---|
| `profiles` | self only | trigger from auth.users | self only | — |
| `companies` | same company | CC only | CC only | — |
| `platoons` | same company | CC only | CC only | — |
| `squads` | same company | CC + PC of that platoon | CC + PC | CC only |
| `memberships` | same company | CC | CC | — |
| `soldiers` | same company | CC | CC + PC of platoon | — |
| `soldier_status_events` | same company | self OR commander of soldier | **never** | **never** |
| `leaves` | same company | CC + PC of soldier's platoon | CC + PC | CC |
| `leave_requests` | self OR approver | self | approver only | — |
| `coverage_events` | same company | CC only | CC only | CC only |
| `audit_logs` | CC only | trigger-only | **never** | **never** |

## What's NOT in Phase 1 (deliberate)

These remain on `mockData` until Phase 2:
- missions, assignment_slots, assignments
- equipment_items, signed_equipment, equipment_lifecycle_events, equipment_gaps
- announcements, escalation_events
- platoon_leave_cycles
- calendar_events
- delegations, command_delegations
- override_alerts
- notifications

Phase 2 will migrate them in domains, one at a time, exactly like Phase 1.

## Re-applying from scratch

```bash
supabase db reset
```

This drops the public schema, re-runs every migration in order, then
runs `seed.sql`. Use this when you want a clean slate.
