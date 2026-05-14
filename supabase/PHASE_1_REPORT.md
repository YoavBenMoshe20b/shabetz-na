# Backend Phase 1 — Final Report

**Status:** Foundation complete. Build clean. App still runs on mockData
by default; flip `VITE_USE_SUPABASE=true` to switch to the real DB.

---

## 1. Tables created (10)

| Table | Migration | Rows seeded | Purpose |
|---|---|---|---|
| `profiles` | 0001 | mirrored on demand | Maps `auth.users.id` → display name + phone + id_last4. Created automatically by the `handle_new_auth_user` trigger when a new auth user lands. |
| `companies` | 0001 | 1 (פלוגה ב) | Tenant root. Every other business row carries `company_id`. |
| `platoons` | 0001 | 5 | Children of company. Carry `kind` (combat / forward-command / logistics / hq / custom). |
| `squads` | 0001 | 11 | Children of platoon. |
| `memberships` | 0001 | 0 (linked after auth) | User ↔ company junction. `unique(user_id, company_id) where is_active` enforces "one active membership per company per user." |
| `soldiers` | 0002 | ~25 | Operational slots. `user_id` nullable — roster slots exist before someone claims them. `current_status` denormalized from `soldier_status_events`. |
| `soldier_status_events` | 0002 | ~25 (one per soldier) | **Append-only**. Insert trigger denormalizes `current_status` + `status_set_at` onto `soldiers`. RLS in 0004 grants INSERT only (no UPDATE/DELETE policy ⇒ default deny). |
| `leaves` | 0003 | 1 | Approved leave. Scope: individual / squad / machlaka. |
| `leave_requests` | 0003 | 1 (pending) | Pending request walking the approval chain. |
| `coverage_events` | 0003 | 1 | **CC must explicitly declare** who covers an absence. JSONB `absent` + `covering` with CHECK constraints on the discriminator. Never automatic. |
| `audit_logs` | 0005 | 0 | Generic mutation audit. Append-only via trigger. CC-only SELECT. |

## 2. RLS policies (per table)

Every table is `enable row level security`. Policies follow these patterns:

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | self only | (auth trigger) | self only | — |
| `companies` | same company | any auth user (CC bootstrap) | CC | — |
| `platoons` | same company | CC | CC | CC |
| `squads` | same company | CC + PC of platoon | CC + PC of platoon | CC |
| `memberships` | same company | CC | CC | — |
| `soldiers` | same company | CC | CC + PC/PS of soldier's platoon | — |
| `soldier_status_events` | same company | self OR commander OR CC | **denied** (append-only) | **denied** |
| `leaves` | same company | CC + PC | CC + PC | CC |
| `leave_requests` | self OR commander | self (own request) | platoon leadership | — |
| `coverage_events` | same company | CC | CC | CC |
| `audit_logs` | CC only | (trigger) | **denied** | **denied** |

Helper functions in 0001 enforce these without leaking:

- `current_user_company()` — `auth.uid()` → active membership → company_id
- `current_user_role()` — active role
- `current_user_commanded_platoon()` — for PC/PS
- `is_company_leadership()`, `is_platoon_leadership()`, `is_rasap()`
- `commands_soldier_platoon(target)` (0002) — walks soldier → squad → platoon

All are `security definer stable` so they survive RLS evaluation without infinite-looping back through it.

## 3. What's connected to the DB

**Through `VITE_USE_SUPABASE`** (default `false` — current behavior unchanged):

- `src/api/_supabase.ts` — lazy client singleton, throws if env vars missing
- `src/api/_bootstrap.ts` — `bootstrapFromSupabase()` loads `profile + membership → companies + platoons + squads + soldiers + status events + leaves + leave requests + coverage events` in one parallel batch
- `src/api/_db.types.ts` — hand-written row shapes (will be auto-generated in Phase 2 via `supabase gen types`)
- `src/services/supabaseAuth.ts` — Phone OTP primitives (`requestOtp`, `verifyOtp`, `signOut`, `toE164Israeli`)

The api/* modules (`soldiers.ts`, `leaves.ts`, etc.) still read through `_adapter.ts` and the live snapshot. When `USE_SUPABASE=true`, the AppContext is expected to call `bootstrapFromSupabase()` on mount and feed its result into the existing reducers; the rest of the app is then unchanged.

## 4. What's still mock

Everything that isn't in the 10 Phase-1 tables:
- Missions + slot assignments + duty exclusions
- Announcements + escalation events + alerts
- Platoon leave cycles + cycle segments
- Equipment items + signed equipment + equipment gaps + lifecycle events
- Operational orders
- Override alerts

The LoginPage also still uses the mock claim+signIn flow. Supabase OTP primitives exist but the UX isn't switched over (Phase 2 work — needs Twilio configured + two-step UI).

## 5. What works after refresh

**When `VITE_USE_SUPABASE=false` (default):**
- Everything works exactly as before. The app loads mockData and the user picks one of the 7 seeded mock users.

**When `VITE_USE_SUPABASE=true`:**
- The bootstrap will fetch from Supabase if a session exists. If not, the LoginPage is shown (still using mock signIn — that's the Phase 2 swap).
- RLS prevents any cross-company reads from the start. A user in פלוגה ב cannot see פלוגה א rows; this is enforced at the database, not the client.

## 6. How Auth works

Phase 1 design (primitives shipped; full LoginPage migration deferred):

1. User enters phone (e.g. `0501234567`).
2. `toE164Israeli()` → `+972501234567`.
3. `requestOtp(phoneE164)` → Supabase sends SMS via configured provider.
4. User enters the 6-digit code → `verifyOtp(phone, code)`.
5. On success: session persisted, trigger `handle_new_auth_user` creates `profiles` row.
6. Admin must then add a `memberships` row linking the user to a company with a role + scope. (CC bootstrap path can self-create the first one.)
7. Optional: `UPDATE soldiers SET user_id=...` to link them to an existing roster slot.

Why the LoginPage isn't switched yet: real OTP requires a Twilio (or similar) credential in the Supabase project, plus a two-step UX (request code → enter code). Doing this without a real provider just builds a non-functional UI. Hooking it up is small and isolated when the credential is ready.

## 7. Next risk

The biggest open exposure is **the gap between the schema we built and the AppContext's existing assumptions**. The mock app keeps everything in React state and mutates freely. The DB enforces:

- Append-only `soldier_status_events`
- Roster-first identity (user_id can be null on soldier)
- Memberships as the role authority (not "role on user")
- Manual coverage_events (not derived from leaves)

If Phase 2 simply flips `USE_SUPABASE=true` without updating the write paths in AppContext, mutations will fail RLS. The migration plan:
1. Make every write in AppContext go through an `api/*` module
2. Have each api/* module branch on `USE_SUPABASE` for its mutation
3. Use Supabase Realtime for invalidation, not local optimistic updates

The second risk is **types drift**: `_db.types.ts` is hand-written. Run `supabase gen types typescript --local > src/api/_db.types.ts` once the local DB is up to lock it in.

## 8. Can we move to Phase 2?

**Yes — with these gates:**

| Gate | Status |
|---|---|
| `npm run build` clean | ✅ |
| `npx tsc -p tsconfig.app.json --noEmit` clean | ✅ |
| New files lint-clean | ✅ (pre-existing 86 errors in `SoldierDetailPage`, `utils/calendar.ts`, `utils/permissions.ts` are NOT regressions from this work) |
| All 5 migrations applied to a local Supabase | ⏳ user action (`supabase db reset` from `supabase/`) |
| Seed applied | ⏳ user action |
| `auth.users` created + linked via the README's UPDATE block | ⏳ user action |
| Real device test (PC sees coverage, CC sees full picture, RLS blocks cross-company) | ⏳ Phase 2 verification |

Phase 2 scope can safely include:
- Missions / signed equipment / equipment gaps tables + RLS
- Announcements / escalations / leave-cycle tables
- Switching LoginPage to OTP
- Realtime subscriptions
- Migrating each api/* module's write path to Supabase
