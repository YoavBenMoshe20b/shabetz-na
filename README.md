# הפלוגה שלי · Ha-Pluga-Sheli

מערכת command-and-control של פלוגה — שיבוצים, שבצ״ק, יציאות, צל״ם, לוגיסטיקה.
A platoon-level operational scheduling PWA built mobile-first in Hebrew (RTL).

**Live:** https://shabetz-na.vercel.app/ — rename in progress (Vercel project alias will become `ha-pluga-sheli.vercel.app`).

---

## What it does

- **Mission lifecycle** — CC creates missions through a 6-step wizard, assigns one or more platoons, sets time / manpower / command / rotation / fatigue / equipment.
- **Engine-driven staffing** — for each materialized slot the engine produces a `SelectorOutcome`: picks, alternates, confidence (0-1) with explicit `decayReasons`, violations, and `why-not` for rejected candidates. No magic numbers.
- **Operator override** — PC opens `StaffingSheet`, sees clean / forced / rejected partitions, can confirm or rewrite. `SoldierPriorityPin` adds a SOFT bonus but never bypasses hard filters.
- **Audit trail** — every commit produces a `SelectorOutcomeRecord` with actor, timestamp, outcome snapshot, final picks, alternatives considered, violations, decay reasons. Surfaced as "היסטוריית שיבוץ" on the mission page.
- **Schedule visibility** — PC's `PlatoonWeekPage` (`/platoon`) shows day rows, slot status, fatigue dots, inline "אייש" CTA. Soldier dashboard shows personal upcoming shifts. CC dashboard shows readiness, platoon table, focus, critical alerts.
- **Alerts hierarchy** — critical visible immediately (banner + bell badge), warning/info aggregated in alerts center (dedup by kind + platoon).
- **QuietMode** — 30m / 1h / 2h / 4h durations + critical breakthrough. Per-user preference.
- **CHAPAK / MAFLAG** — non-combat platoons with configurable functional roles. CC and רס״פ can assign/reassign אחראי ציוד חפ״ק, אחראי מטבח, אחראי מים, נהג, סרס״פ, etc. via a chip editor at `/platoon/:id/structure`.

## Roles

- **מ״פ** (companyCommander) — full company surface, missions, escalations, configure CHAPAK
- **סמ״פ** (deputyCompanyCommander) — same powers minus delegation grants
- **מ״מ** (platoonCommander) — platoon schedule, staff slots, approve leave
- **סמל** (platoonSergeant) — same platoon scope as PC
- **רס״פ** — מפקד המפלג. Manages logistics, equipment lifecycle, MAFLAG members. NOT company-tier writes
- **סרס״פ** — סגן רס״פ
- **שליש** — admin officer, Report-1 access, no command writes
- **חייל** — personal schedule, leave request, gear, status

## Stack

- React 19 + Vite + TypeScript (strict), TailwindCSS
- React Router v7, React Query v5
- Pure engine in `src/utils/engine/` — no React, no Date.now(), deterministic, replayable
- Supabase (Postgres + Auth + RLS) — currently behind `VITE_USE_SUPABASE` flag
- localStorage demo persistence via `usePersistedState`

## Demo mode

`VITE_USE_SUPABASE=false` (default). Seed: 1 company, 5 platoons (3 combat × ~20 + CHAPAK 8 + MAFLAG 6), 13 mock users (u1–u13), 4 active missions across g1/g2/g3.

Login: any seeded phone + `Test@1234`. The login page exposes a tap-to-fill "חשבונות דמו" panel in mock mode. UserSwitcher in the header hops between identities without re-auth.

State persisted in localStorage:
- Operator-confirmed slot assignments
- Selector outcome audit (newest 200)
- Missions / notes / leaves / leave requests / orders
- Announcements / escalations / override alerts / equipment gaps
- Signed equipment / soldier status events
- Active user + role + QuietMode preference

"איפוס נתוני דמו" in UserSwitcher wipes all persisted state.

## Live (Supabase) mode

Apply migrations 0001-0009 in `supabase/migrations/`. Set in `.env.local`:

```
VITE_USE_SUPABASE=true
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Tables with RLS already provisioned: companies, profiles, soldiers, platoons, squads, memberships, missions, mission_notes, assignments, selector_outcomes, engine_overrides, leaves, leave_requests, coverage_events, operational_orders, override_alerts, announcements, escalation_events, equipment_items, signed_equipment, equipment_gaps, equipment_lifecycle_events, soldier_status_events, audit_logs.

## Scripts

```
npm run dev      # vite dev server
npm run build    # tsc -b && vite build  ← matches Vercel CI
npm run lint     # eslint
```

## Architecture

See `/src` tree:
- `utils/engine/` — pure functions: scoring, selector, burden, focus, hardFilters
- `utils/persistedState.ts` — localStorage hook with version-keyed storage
- `hooks/useEngineContext.ts` — impure→pure boundary (one place reads Date/React state)
- `hooks/useChaosContext.ts` — 6 chaos + 4 recovery scenarios for engine stress
- `context/AppContext.tsx` — legacy monolith (will fan out into providers)
- `providers/` — Auth, Roster, Leave, Alerts, Mission, Equipment, Org façades
- `api/` — domain modules, each dual-pathed (mock vs Supabase)
- `components/` — UI primitives + composed components
- `pages/` — routed surfaces; each role's dashboard lives in `pages/dashboards/`
