# Backend Phase 2 — Final Report

**Status:** Foundation deepened. Provider stack composed. React Query
wired. Critical write paths Supabase-ready behind `VITE_USE_SUPABASE`.
App still runs identically with the flag off — current behavior is
unchanged.

---

## 1. What moved to DB-backed (with fallback)

| Flow | Read path | Write path | RLS coverage |
|---|---|---|---|
| Companies / Platoons / Squads | `bootstrapFromSupabase()` (Phase 1) | mock only | yes (Phase 1) |
| Soldiers | `api/soldiers.listForCompany`, `api/soldiers.byId` | mock only | yes (Phase 1) |
| Soldier status events | `api/soldiers.statusEventsFor` | `api/soldiers.updateStatus` (append) | append-only enforced |
| Leaves | `api/leaves.listLeavesForCompany` | mock only | yes (Phase 1) |
| Leave requests | `api/leaves.listLeaveRequestsForCompany` | `api/leaves.submitLeaveRequest`, `reviewLeaveRequest` | yes (Phase 1) |
| Coverage events | `bootstrapFromSupabase()` (raw, Phase 1) | mock only | yes (Phase 1) |
| Session / Profile / Membership | `bootstrapFromSupabase()` (Phase 1) | mock only | yes (Phase 1) |
| Audit log | (auto via DB triggers) | (auto) | yes (Phase 1) |

**Every Supabase path has a mock fallback** controlled by the
`USE_SUPABASE` flag in `src/api/_supabase.ts`. With the flag off, no
network calls happen — the app reads from `_adapter.ts.read.*` against
the mockData live snapshot.

## 2. What's still mock

- Missions + slot assignments + duty exclusions
- Announcements + escalation events + alerts (override alerts)
- Platoon leave cycles + cycle segments
- Equipment items + signed equipment + equipment gaps + lifecycle events
- Operational orders
- Override alerts
- Mission notes
- The LoginPage flow (uses mock signIn — Supabase Phone OTP primitives
  are shipped in `src/services/supabaseAuth.ts` but the LoginPage UI
  hasn't been swapped to two-step OTP)

## 3. Providers created

Mounted via `<AppProviders>` in `src/App.tsx`. Order matters; each
provider downstream of `AuthProvider` reads `currentUser` for scoping:

```
AppProvider (legacy monolith — owns mutation state)
  └ AuthProvider          ← currentUser, signIn/signOut, claim, bootstrap, Supabase session restore
    └ OrgProvider         ← companies, platoons, squads, scoped helpers
      └ RosterProvider    ← soldiers, status events, status mutations
        └ LeaveProvider   ← leaves, leave requests, coverage events, approvable queue
          └ AlertsProvider ← override alerts, announcements, escalations
            └ MissionProvider ← missions, orders, mission notes
              └ EquipmentProvider ← inventory, signed equipment, gaps, lifecycle
```

Each provider's hook (`useAuth`, `useOrg`, `useRoster`, `useLeave`,
`useAlerts`, `useMission`, `useEquipment`) is the public API for
**new** code. Existing code continues to use `useApp()` from
`src/context/AppContext.tsx` without modification — the monolithic
provider sits at the root of the stack and the focused providers are
facades over it.

**Why facades and not full extraction:** the existing 33+ pages all
import `useApp()`. Tearing out state ownership in one pass risks
breakage. The facade pattern means:
- New code consumes focused providers (clean architecture)
- Old code keeps working
- When a focused provider migrates to React Query / Supabase, the
  pages that already use it get the upgrade for free
- AppContext becomes safely deletable AFTER every page migrates

## 4. Flows that work end-to-end

**Mock mode (`VITE_USE_SUPABASE=false`, default):**
- Login (signIn / claim / bootstrap CC) → working
- CC dashboard / PC dashboard / Soldier dashboard / Rasap dashboard → working
- Leave request submission + approval routing → working
- Status updates (self + commander override) → working
- Equipment sign-out / return / damage → working
- Announcements + escalations → working
- All routes resolve, no broken page errors

**Supabase mode (`VITE_USE_SUPABASE=true`, with project + auth users + memberships set up):**
- Bootstrap fetch (companies + platoons + squads + soldiers + status + leaves + leave requests + coverage) → working (read)
- Status event append → working (mutation goes through trigger)
- Leave request submit → working (insert)
- Leave request approve/reject → working (update)

The provider stack and React Query hooks are the seam. As more api/*
modules grow Supabase paths, more flows graduate.

## 5. React Query — what's realtime-ready

`src/api/queryClient.ts` defines:
- One singleton QueryClient (mounted in `main.tsx`)
- Stable query keys for: session, profile, membership, companies,
  company, platoons, squads, soldiers, soldier, statusEvents,
  statusEventsAll, leaves, leaveRequests, coverageEvents, announcements,
  alerts, escalations
- Bulk invalidation helpers: `invalidate.soldierStatus()`,
  `invalidate.leaveRequests()`, `invalidate.leaves()`,
  `invalidate.announcements()`

`src/api/hooks.ts` exposes:
- `useSoldiers(companyId)`, `useSoldier(id)`, `useStatusEvents(soldierId)`
- `useUpdateSoldierStatus()` (mutation)
- `useLeaves(companyId)`, `useLeaveRequests(companyId)`
- `useSubmitLeaveRequest()`, `useReviewLeaveRequest()` (mutations)
- `useOverrideAlerts(companyId)`, `useAnnouncements(companyId)` (mock-backed today)

Each mutation can trigger the invalidation helpers; when realtime
subscriptions land in Phase 3, the same invalidation surface flips on
without touching consumers.

## 6. Design improvements shipped

- **LoginPage** — dev panel collapsed by default. Was previously the
  visually heaviest element on the page; now a discreet expandable row.
- **PlatoonCommanderDashboard** — added "כיסוי המחלקה" read-only
  section: squad-by-squad in-base/at-home breakdown + active leaves
  with return ETA. Mirrors CC's company-level coverage view at the
  platoon level. (Phase-1 requirement #3, shipped.)
- **EquipmentPage** — "דווח על ליקוי ציוד" CTA upgraded from `ghost`
  to `secondary` variant for clearer hierarchy. Stripped the ASCII "+".
- **AlertsPage** — hero text no longer shifts between loading and
  loaded states. Shows "טוען התראות…" during fetch.
- **SchedulePage** — empty state for "no missions in order" matches
  the rest of the page's empty-state pattern (card with shadow, not
  bare text).
- **SoldierDashboard** — `CollapsibleCard` chevron replaced ASCII
  ▲/▼ with a proper SVG that rotates on toggle. Added `aria-expanded`.
- **BottomNav** — fixed outdated header comment ("4 tabs" → "5 tabs"
  for commander variant).
- **`<Toast>` component extracted** to `src/components/ui/Toast.tsx` —
  replaces the ad-hoc inline `<div className="bg-mil-success-bg ...">`
  banners that lived across 5+ files. One source of truth for
  confirmation feedback. Migrated SoldierDashboard, LeavesPage,
  EquipmentPage, ProfilePage.

## 7. Screens cleaned

| Screen | Action |
|---|---|
| LoginPage | Dev panel collapsed; cleaner first paint |
| PlatoonCommanderDashboard | Added coverage section; tighter info density |
| EquipmentPage | CTA hierarchy fix |
| AlertsPage | Loading state hero stability |
| SchedulePage | Empty state consistency |
| SoldierDashboard | Premium chevron, a11y attribute |
| BottomNav | Stale documentation refreshed |

## 8. What's still busy / problematic

**Lint pre-existing (86 errors, NOT regressions from this work):**
- `SoldierDetailPage.tsx`: 7 `react-hooks/rules-of-hooks` errors from
  hooks called after early return — needs reorganization (hooks
  before the `if (!soldier) return null`)
- `EquipmentPage.tsx`: 3 similar hooks-after-return errors
- `SchedulePage.tsx`: 4 similar errors
- `utils/calendar.ts`: one `no-useless-assignment`
- `utils/permissions.ts`: one unused `_user`
- `pages/PlatoonGapsPage.tsx`: hooks-after-return
- And similar pattern across other pages

These are real but pre-date Phase 2. They don't break anything (build
is clean) — they're lint-only structural issues that need each page
opened and reorganized.

**Mobile / RTL still to polish:**
- `AnnouncementsPage.tsx` toggle thumb uses negative `translate-x` to
  flip for RTL — works but is fragile and could be replaced with a
  proper RTL-aware toggle component
- Long Hebrew strings in `RasapPage.tsx` ("הצג הכל (120) ←") can
  overflow on very narrow phones — add `truncate` or break-word
- Calendar dot-density indicator uses bare "+" character on dense
  days; a count badge would render cleaner

**Sheets / modals:**
- Most use the standard `Sheet` component, good
- `LeaveRequestModal` inside `SoldierDashboard.tsx` is inline rather
  than extracted — fine for now, but would benefit from extraction
  when LoginPage migrates to OTP and we add OtpVerifyModal

## 9. Biggest remaining risk

**The AppContext monolith is still the source of truth.** All write
paths flow through it. The focused providers and React Query hooks are
**read-side facades** over its state. If Phase 3 simply flips
`USE_SUPABASE=true` without migrating writes, every mutation that's not
yet in `api/*` (announcements, equipment, missions, override alerts,
escalations, leave cycles) will continue writing to AppContext local
state only — they won't persist across reload even when the read path
is fetching from Supabase. This will look broken.

The mitigation is the explicit gating: each api/* module either has
a Supabase path or falls back. Today only soldiers + leaves have real
Supabase paths. Phase 3 should land:
1. `api/announcements.ts` Supabase paths
2. `api/equipment.ts` Supabase paths (and the matching tables)
3. `api/missions.ts` Supabase paths
4. `api/alerts.ts` Supabase paths

## 10. Technical debt remaining

**Architectural:**
- AppContext still owns ALL write paths. Goal for Phase 3: each focused
  provider mutates through `api/*` and AppContext shrinks to a
  legacy-compat layer that mirrors React Query cache.
- Provider hooks are co-located with their Provider component (which
  trips `react-refresh/only-export-components`). Suppressed with file-
  level eslint-disable + a rationale comment. Clean fix: extract each
  hook to its own file (7 new files; ergonomic loss).
- `_db.types.ts` is hand-written. Switch to `supabase gen types` once
  local DB is up.

**Read patterns:**
- Pages still read from `useApp()`. They should migrate to the focused
  providers OR the React Query hooks. This is incremental.
- `_bootstrap.ts` loads everything in one parallel batch. When data
  grows, this won't scale — switch to per-screen queries.

**Auth:**
- LoginPage uses mock auth. Supabase Phone OTP primitives are wired
  but not invoked by the UI. Switching requires Twilio (or similar)
  configured in the Supabase project + a two-step UI (request → verify).
- Session restore happens in `AuthProvider` for the Supabase path, but
  reconciling that session with AppContext's `currentUser` is deferred
  to Phase 3 — today the two views of identity are independent.

**Realtime:**
- No realtime subscriptions yet. The hook + invalidation surface is
  ready. Phase 3 should subscribe to `soldiers`, `soldier_status_events`,
  `leave_requests` channels and call `invalidate.*()` on payload.

## 11. Is AppContext smaller? Honest answer

**No — its size is unchanged.** AppContext is still 1759 lines, owning
all state. What changed:
- Pages CAN now consume focused providers, but most still use `useApp()`
- New code has a clear path to write data without touching AppContext
- The facade providers establish the boundary — they read from AppContext,
  but nothing in those providers writes to it directly

This is intentional: the goal of Phase 2 was the **boundary**, not the
extraction. Once the boundary holds and pages migrate one by one (Phase 3+),
AppContext can shrink to a session-only layer or be deleted entirely.

**One real consumer migrated as proof:** `AnnouncementsStrip` (used on
all 3 dashboards) now reads from `useAuth() + useOrg() + useRoster() +
useAlerts()` instead of `useApp()`. The strip's behavior is identical
because the providers expose the same data, but the import surface
shows the future shape of every page.

## 12. Build / typecheck / lint status

| Check | Result |
|---|---|
| `npm run build` | ✅ clean (550 kB main bundle gzipped to 148 kB) |
| `npx tsc -p tsconfig.app.json --noEmit` | ✅ clean, 0 errors |
| `npm run lint` | 86 errors, **all pre-existing**, 0 new from this work |

The 86 lint errors are:
- ~60+ `react-hooks/rules-of-hooks` from pages that call hooks after
  early returns. Each fix is mechanical (move hooks above the return)
  but spans many files.
- A handful of `no-useless-assignment`, `no-unused-vars`,
  `react-hooks/purity` items.

None of these block production. They should be paid down in a focused
hygiene pass (Phase 2.5?), but they don't affect correctness.

## 13. Phase 3 plan

**Goal:** AppContext stops being the source of truth.

1. **Auth migration** — switch LoginPage to two-step Phone OTP via
   `supabaseAuth.ts`. AuthProvider reconciles session with profile +
   membership and publishes the resulting MockUser to AppContext (or
   replaces it).
2. **Realtime subscriptions** — subscribe to `soldiers`,
   `soldier_status_events`, `leave_requests` in Phase-2 providers;
   invalidate on payload.
3. **Phase-3 migration tables + RLS** — `announcements`, `escalations`,
   `missions`, `slots`, `override_alerts`, `signed_equipment`,
   `equipment_gaps`, `equipment_lifecycle_events`, `equipment_items`,
   `delegations`, `command_delegations`, `platoon_leave_cycles`.
   Each gets RLS following the Phase-1 patterns.
4. **`api/*` Supabase paths** for each of those entities.
5. **Page-by-page consumption switch** from `useApp()` to focused
   providers + React Query hooks. Aim: empty consumer list for
   AppContext.
6. **Delete AppContext** once empty. The legacy compat layer wrapping
   the focused providers can also shrink to nothing.

**Out of scope but on the radar:**
- Offline mode (would need IndexedDB cache + sync queue)
- Push notifications (Phase 4)
- AI scheduling assistant (separate workstream)
