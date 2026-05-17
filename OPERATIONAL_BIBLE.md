# הפלוגה שלי — Operational Bible

> Onboarding document for a senior engineer joining as tech lead on the
> product. This is **not** a status update. It is the complete mental model
> required to make architecturally correct decisions on this system.
>
> Read all of it. The whole thing. The architecture is consistent only when
> every layer is held together.

**Last updated**: 2026-05-17
**Audience**: Incoming tech lead / senior engineer
**Length contract**: Long. Do not shorten on the next revision. If a
section grows stale, REPLACE the content; do not delete the section.

---

## Table of contents

1. [Vision](#1-vision)
2. [What the system actually is](#2-what-the-system-actually-is)
3. [Real-world platoon / company structure](#3-real-world-platoon--company-structure)
4. [Operational doctrine the system encodes](#4-operational-doctrine-the-system-encodes)
5. [Roles and permissions](#5-roles-and-permissions)
6. [The mission system](#6-the-mission-system)
7. [Archetypes — the behavioral classifier](#7-archetypes--the-behavioral-classifier)
8. [Creation vs Assignment vs Staffing — three different acts](#8-creation-vs-assignment-vs-staffing--three-different-acts)
9. [The staffing engine (selector + scoring + hard filters)](#9-the-staffing-engine-selector--scoring--hard-filters)
10. [The materializer](#10-the-materializer)
11. [Fatigue, overlap, readiness — what the engine enforces today](#11-fatigue-overlap-readiness--what-the-engine-enforces-today)
12. [Leave management at the operational level](#12-leave-management-at-the-operational-level)
13. [The Company Leave Planning Wizard](#13-the-company-leave-planning-wizard)
14. [Blocked dates](#14-blocked-dates)
15. [Rotation policy](#15-rotation-policy)
16. [Command coverage](#16-command-coverage)
17. [Personal leave buffer](#17-personal-leave-buffer)
18. [Conflict resolution — the principle that runs through everything](#18-conflict-resolution--the-principle-that-runs-through-everything)
19. [The operational timeline](#19-the-operational-timeline)
20. [Emergency / הקפצה](#20-emergency--הקפצה)
21. [Recovery from emergency](#21-recovery-from-emergency)
22. [The recommendations layer (honestly: it is text)](#22-the-recommendations-layer-honestly-it-is-text)
23. [Role-scoped awareness](#23-role-scoped-awareness)
24. [UX philosophy](#24-ux-philosophy)
25. [Mobile constraints](#25-mobile-constraints)
26. [Backend / persistence state](#26-backend--persistence-state)
27. [What is real vs mock](#27-what-is-real-vs-mock)
28. [Technical debt](#28-technical-debt)
29. [Future architecture](#29-future-architecture)
30. [Things that must never regress](#30-things-that-must-never-regress)
31. [Known edge cases](#31-known-edge-cases)
32. [What the system does NOT understand yet](#32-what-the-system-does-not-understand-yet)
33. [What the engine already understands](#33-what-the-engine-already-understands)
34. [Suggested next milestones](#34-suggested-next-milestones)

---

## 1. Vision

**"הפלוגה שלי"** is the operational command-and-control surface for a single
infantry-style **company** in the IDF reserve / regular service. It is NOT a
generic shift scheduler, NOT a calendar app, NOT an HR tool. The product
question it answers is:

> A company commander has 3 platoons, 75 soldiers, a rotating roster of
> missions, a personnel that cycles between home stints and base, and an
> obligation to be operationally ready 24/7. **How does he run the
> company?**

The previous answer — WhatsApp groups, an Excel file that one אחראי שבצ״ק
maintains, a paper list at the מבצק — has known failure modes:
- The information is everywhere and nowhere.
- The PC (מ״מ) doesn't know what the CC (מ״פ) has assigned to his platoon
  until WhatsApp tells him.
- A soldier on home leave doesn't know he's been called back until
  someone phones him.
- Coverage rules ("there must be a מ״מ in base at all times") are
  enforced by memory.
- An emergency (הקפצה) is announced by shouting; the schedule is
  re-derived in someone's head.

**The product replaces those failure modes.** Every operational decision
(create a mission, assign it to a platoon, staff it with soldiers, send
the platoon home, declare an emergency) is captured as **data**, surfaced
to the **right role at the right moment**, and made **reversible**.

The system is opinionated about one thing above all: **the operator
remains in command. The system advises and warns; it does not enforce
silently.**

---

## 2. What the system actually is

### Concretely

A **React 19 + Vite + TypeScript (strict) PWA**, mobile-first, RTL Hebrew,
using TailwindCSS for the design system. Runs entirely client-side today
with `localStorage` persistence. Build is `npm run build` = `tsc -b &&
vite build` — Vercel CI runs the strict composite-project build.

Deployed to `https://shabetz-na.vercel.app` (the historical name; the
product itself is called הפלוגה שלי). Push to `main`, Vercel
auto-deploys.

### Architecturally

There are **four layers**:

1. **Data layer** — `src/types/index.ts` defines every domain entity.
   `src/data/mockData.ts` seeds the company. `localStorage` holds the
   live state across sessions.

2. **State layer** — `src/context/AppContext.tsx` is the monolithic
   provider (~2,575 lines). Every mutation flows through here. It uses
   `usePersistedState<T>(slice, initial, SEED_VERSION)` to wire each
   slice to its own localStorage key with version-bump invalidation.

3. **Engine layer** — `src/utils/engine/` (pure, no React, no
   `Date.now()` inside) plus `src/utils/materialize.ts`. This is where
   the operational decisions are computed:
   - `hardFilters.ts` — yes/no eligibility (on-leave, missing
     qualifications, time-conflict, squad-policy, etc.)
   - `scoring.ts` — 0-100 per-candidate-per-slot score with explainable
     dimensions (load, fatigue, qualMatch, cohesion, burden, pin)
   - `selector.ts` — picks N from the scored pool, partitions clean
     vs forced, captures the SelectorOutcome audit record
   - `burden.ts` — fairness-aware per-soldier burden score
   - `focus.ts` — "what does this user need to decide now" items

4. **UI layer** — Pages, dashboards, sheets, primitives. Every page is
   lazy-loaded; the dashboard router (`DashboardPage.tsx`) dispatches by
   role to one of four dashboard variants.

### Mental model

> Think of the system as a **command post**. The materializer is the
> board on the wall (the current and future state). The engine is the
> staff officer who scores candidates and explains the score. The UI is
> the operator's hands on the board. Everything else (announcements,
> alerts, escalations, leave board) is a tool the operator uses to keep
> the board honest.

---

## 3. Real-world platoon / company structure

If you don't internalize this, you cannot make correct UX decisions.

### The company (פלוגה)

A combat company contains:

- **3 combat platoons** (מחלקות קרביות): typically 18–22 soldiers each
  in our seed (g1, g2, g3). Each combat platoon has:
  - A **מ״מ** (platoon commander) — the platoon's commanding officer
  - A **סמל** (deputy / platoon sergeant) — second-in-command
  - **3 squads** (כיתות): each ~7 soldiers, led by a **מ״כ**
    (squad commander)
  - Soldiers carry **OperationalRoles** (functional specializations:
    קלע / נגביסט / חובש / מטוליסט / קשר etc.) — these matter for
    qualification checks at staffing time.

- **חפ״ק** (forward-command): the company's small mobile command team
  — not a fighting platoon, doesn't rotate as a unit. Has its own
  internal role specializations.

- **מפלג** (logistics platoon): kitchen, equipment, drivers, רס״פ.
  Doesn't rotate as a unit either. Carries its own coverage rules.

- **HQ / staff** (סגל הפלוגה): מ״פ (CC), סמ״פ (deputy CC), שליש
  (adjutant), מש״ק קשר. These exist on the org chart but are
  individuals with their own permission grants.

### How a platoon actually rotates

A combat platoon is the unit of leave rotation. The IDF "8/7" or "10/5"
patterns mean **the WHOLE platoon goes home for N days, then the WHOLE
platoon comes back for M days**. They sit on missions as a UNIT. You
don't (normally) send individual soldiers home from a combat platoon
mid-rotation; you might recall ONE soldier, but the unit moves together.

חפ״ק and מפלג are different. They cannot all go home at once — someone
must be in base to run the operation. They rotate **per soldier** with
coverage constraints (always at least one driver in base, etc.).

### What "מי בבסיס" means

The single most important operational question is: **right now, how many
people are in base, and which ones?** The answer drives every decision —
what missions can be staffed, who's eligible, who's overloaded.

The system computes this from:
- `Soldier.currentStatus` (`'in-base' | 'home' | 'inactive-temp'`)
- `Leave[]` (active leaves overlapping today)
- `PlatoonLeaveDay[]` (per-platoon home stints — applies the whole
  platoon)
- `SoldierLeaveOverride[]` (per-soldier exceptions inside a platoon
  home stint)
- `EscalationEvent` (active emergency forces "home" → "in-base"
  temporarily; see §20)

---

## 4. Operational doctrine the system encodes

These are the rules the system observes. Some are enforced by the engine,
some are surfaced as warnings, some are still data-only (see §27 for the
honest mock-vs-wired matrix).

### Doctrine — what the system understands

1. **A company has a daily order (צו).** Missions belong to an order.
   When the order is published, soldiers see their slots.
2. **Each mission has an archetype** that defines its behavior: static
   guard, patrol, readiness, one-time op, or custom. The archetype
   drives the wizard, the materializer, the conflict resolver, and the
   timeline. See §7.
3. **The PC owns staffing of HIS platoon's slots.** The CC creates the
   missions and assigns them to platoons; the PC distributes the
   soldiers.
4. **A combat platoon rotates as a unit.** When the platoon is home,
   the materializer drops every soldier in it from eligibility (unless
   an explicit `SoldierLeaveOverride` says otherwise).
5. **A readiness mission allows parallel assignment.** A soldier on
   standby can simultaneously be on a guard shift — until the readiness
   fires.
6. **A patrol mission forbids parallel assignment.** Patrol is
   movement-based, full-attention.
7. **Day shifts and night shifts can have different durations.** A
   guard at the gate may stand 2 hours by day and 3 hours by night —
   the materializer splits the day accordingly.
8. **At any moment there must be a commander in base.** The
   `command-coverage` rule expresses this: "at least 1 of {מ״מ, סמל,
   מ״כ} must be in base." See §16.
9. **Personal leave requests need slack.** The `personal-leave-buffer`
   rule reserves N (or N%) of in-base headcount for individual leave so
   the platoon rotation doesn't consume the entire leave allowance.
   See §17.
10. **Some dates cannot be home days for anyone.** Line-up days,
    line-down days, drill days, op-event days — these are
    `CompanyBlockedDate` records with `requireAllInBase: true`. See §14.
11. **An emergency (הקפצה) forces every home soldier back to base.**
    Until the event closes, the materializer treats `home` as
    `in-base`. See §20.

### Doctrine — what the system does NOT yet encode

The IDF has many additional rules the system has not modeled:
- Compensation for soldiers who lost their home stint to an emergency
- Sabbath / יום שישי-שבת special-handling beyond the wizard's
  "noWeekendTransition" flag
- מבצק ranking / company commander seniority constraints on which
  soldier can be assigned to which mission
- שעות שירות limits per week / month
- "soldier X and soldier Y must not be alone together" pair-exclusion
  beyond `mutual-exclusion` rule kind
- Reservist-specific leave doctrine (מילואים leave rights)

These are **honest gaps**. The data model is extensible — adding them
is straight work, not architectural redesign.

---

## 5. Roles and permissions

There are FIVE base roles (`UserRole`) plus functional roles that can
grant additional permissions.

### Base roles

| Role | Hebrew | What they do |
|---|---|---|
| `companyCommander` | מ״פ | Owns the company. Creates missions, assigns to platoons, runs leave planning, declares emergencies. |
| `deputyCommander` | סמ״פ | Like CC; coverage permissions. |
| `platoonCommander` | מ״מ | Owns a platoon. Staffs assigned missions, approves platoon-level leave requests, publishes the platoon's שבצ״ק. |
| `platoonSergeant` | סמל | Like PC. |
| `soldier` | חייל | Reads their own state: next shift, current readiness, leave history, etc. |

`Soldier` is the default. The system also recognizes:
- **רס״פ** (`isRasap()` check) — a soldier whose primary functional role
  is logistics. Renders the `RasapDashboard` instead of `SoldierDashboard`.
- **שליש** (`isShalish()` check) — admin staff with read access to
  Report1 and Alerts.

### Permission tokens

`src/utils/permissions.ts` defines `PermissionToken` strings (e.g.
`'mission.create.company'`, `'leave.approve.platoon'`,
`'escalation.declare'`). Each base role has a default token set
(`COMPANY_LEADERSHIP_TOKENS`, `PLATOON_LEADERSHIP_TOKENS`,
`RASAP_TOKENS`, etc.).

Permissions can ALSO be granted via:
- **`Delegation`** — old-style. Used for delegating to a deputy.
- **`CommandDelegation`** — new, time-bounded. "From X to Y, give Y the
  CC role." Surfaced in `DelegationBanner` and the hamburger menu.
  When the delegation is active, the delegated user passes
  `canDeclareEscalation()` / `canCreateMission()` etc. checks.

The pattern is:
```ts
canDeclareEscalation(user, delegations) ===
  hasPermission(user, 'escalation.declare', undefined, delegations)
```

Every UI gate calls one of these helpers — never check `currentRole`
directly. This keeps the delegation mechanism honest.

---

## 6. The mission system

A `Mission` (see `src/types/index.ts` line ~1109) is the core operational
object. Read it as: "this is a thing the company does, with these
behavioral properties."

### Identity fields

- `id`, `companyId`, `name`, `description?`, `createdByUserId`,
  `ownerRole` (`'company' | 'platoon'`)
- `orderId?` — optional link to an `OperationalOrder` (צו). Evergreen
  missions have no order.
- `assignedPlatoonIds: string[]` — which platoons own this mission.
  May be empty until the assignment step runs.
- `status: MissionStatus` — `'draft' | 'active-unstaffed' |
  'assigned-to-platoon' | 'staffing-pending' | 'active' | 'staffed' |
  'partially-staffed' | 'paused' | 'archived'`.

### Behavioral fields (composable policy objects)

- `timeModel` — `{ kind: '24-7-continuous' | 'fixed-hours' | 'one-time'
  | 'on-demand' | 'daily-variable' }` plus its window data.
- `manpower` — `{ kind: 'exact' | 'range' | 'window-varies' }`. The
  `window-varies` kind lets day vs night require different counts.
- `command` — `{ fieldCommandRequired, commandersPerSlot,
  commanderCountsAsManpower, rankPolicy }`. `rankPolicy` is the
  per-rank "commander-only / regular / excluded" map.
- `rotation` — `{ kind: 'fixed-platoon' | 'rotate-platoons' |
  'rotate-squads' | 'whichever-strongest' | 'returning-from-home' |
  'manual' }`. For rotation kinds with a period, the `period` field
  carries `'daily' | 'weekly' | 'biweekly' | 'monthly'`.
- `fatigue` — `{ intensity, impactsSleep, sleepWindowHours?,
  minRestAfterHours, fatigueWeight }`. Intensity values:
  `'standing-guard' | 'active-patrol' | 'ambush' | 'readiness' |
  'admin' | 'passive'`.
- `cycleProfile?` — for 24/7 continuous missions: `{ guardMinutes,
  restMinutes, standbyMinutes? }`. Drives sustained-manpower math.
- `overlapPolicy?` — `{ activeOverlap: MissionIntensity[],
  restOverlap: MissionIntensity[] }`. Which mission intensities a
  soldier may be simultaneously assigned to.

### Archetype layer (Phase 7.3)

- `archetypeKind?: MissionArchetypeKind` — one of `'static-guard' |
  'patrol' | 'readiness' | 'one-time-op' | 'custom'`. Optional for
  back-compat — readers default to `'custom'`. See §7.
- `dayNightProfile?: DayNightProfile` — `{ dayStartTime,
  nightStartTime, dayShiftDurationMinutes?,
  nightShiftDurationMinutes?, dayMinCount?, nightMinCount?,
  fatigueDiffersByPeriod? }`. The materializer reads this to split
  24/7 windows into day-segment + night-segment slots.
- `allowPCOverride?: boolean` — when false, only the CC can adjust
  certain mission fields during staffing.
- `shiftDurationLocked?: boolean` — when true, the PC cannot change
  individual slot durations during staffing.
- `rallyPoint?: string` — readiness archetype's where-to-go.
- `routeDescription?: string` — patrol archetype's route/sector.
- `hasVehicle?: boolean` — patrol / one-time-op flag.
- `responseInstructions?: string` — readiness archetype's
  what-to-do-on-activation.
- `responseTeams?: ReadinessResponseTeam[]` — readiness's split
  teams (each with name, rally point override, target count,
  selection mode `'soldiers' | 'squad' | 'role'`, and per-team
  instructions). The soldier-facing readiness card highlights "your
  team" when the viewer matches one of these.

### Constraints

- `conflictsWith: string[]` — mission ids that cannot run
  simultaneously.
- `canOverlapWith: string[]` — explicit overlap allowances.
- `pairings: SoldierPairing[]` — pairing rules.
- `squadPolicy: { mode: 'mix' | 'no-mix' | 'specific';
  allowedSquadIds? }` — whether all soldiers on the mission must
  come from the same squad.
- `qualifications: QualificationRequirement[]` — required
  qualifications (per-level: `'soft' | 'required' | 'critical'`).
  `'critical'` is a hard filter.
- `equipment: EquipmentRequirement[]` — same shape for equipment.

### Lifecycle

`draft → active-unstaffed → staffing-pending → partially-staffed →
staffed → active → paused → archived`.

### How a mission is born

1. Operator picks a template from the **Mission Template Library**
   (`MissionTemplate` records, persisted, per-company). See §29 future
   architecture for the template family layer. Or picks "התחל מ-0"
   for the full wizard.
2. The template (or the picked archetype) populates the wizard's
   defaults.
3. The operator names the mission and fills the archetype-specific
   fields (rally point / route / response instructions).
4. The operator confirms timing, command, rotation, qualifications,
   equipment in the wizard's remaining steps. The archetype's
   `hiddenSteps` skips redundant questions (only the character step
   is hidden — see §7 for the principle: templates fill defaults, they
   do NOT skip operational questions).
5. Publish → `addMission()` writes the Mission with empty
   `assignedPlatoonIds: []` and status `active-unstaffed`.
6. The wizard routes to `/missions/:id/assign` for the assignment step.

---

## 7. Archetypes — the behavioral classifier

The single most important architectural decision in Phase 7.3.

An `archetype` is NOT a template. It is the **type-level
classification** of a mission's operational behavior.

| Archetype | Hebrew | Examples | What the engine knows |
|---|---|---|---|
| `static-guard` | שמירה סטטית | שער, מגדל, נצפ״ה | Fixed position, 24/7 continuous, day/night-shape-aware, can split shifts. |
| `patrol` | סיור | סיור לילה, סיור רכוב | Movement-based, forbids parallel assignment, route + optional vehicle. |
| `readiness` | כוננות | כרמל א, כרמל ב, הקפצה | Event-driven, allows parallel assignment, carries rally point + response instructions + split teams. |
| `one-time-op` | מבצע חד-פעמי | אבטחה לפעילות, אירוע | Specific datetime, no scheduled-publish flow. |
| `custom` | אחר/מותאם | — | Operator-defined, full wizard, no archetype rules apply. |

### The principle: templates ≠ archetype questions

A template fills DEFAULTS. The archetype defines which **operational
questions are still required**. A static-guard template populates
`timeModel: 24-7-continuous`, `manpower: 2 day / 3 night`, etc. But
the operator still MUST configure:
- When the guard runs (date range, hours)
- Day vs night shift durations
- Day vs night manpower
- Whether a shift commander is required
- Rotation policy (how the watch divides between platoons / squads)
- Qualifications + equipment

The template default is the starting point. **Templates do not skip
the questions that need per-instance decisions.**

The archetype's `hiddenSteps` array on `MissionArchetype` controls
which wizard steps drop out. As of Phase 7.3 it only hides step 2
(character/intensity) because the archetype already fixes that. Timing,
command, rotation, qualifications/equipment all remain required.

### Archetype behavior flags (engine inputs)

Each archetype declares:
- `isMovementBased` — patrol → engine uses stricter overlap
- `isEventDriven` — readiness → engine permits parallel assignment
- `supportsDayNight` — static-guard / patrol / one-time-op
- `supportsRallyPoint` — readiness
- `supportsRoute` — patrol
- `supportsVehicle` — patrol, one-time-op (optional)
- `supportsResponseInstructions` — readiness
- `supportsScheduledPublish` — everything except one-time-op

### Behavior consumer

`src/utils/archetypeBehavior.ts` is the **single funnel** between an
archetype's static declaration and runtime decisions. Read by:
- `materializeWeek` — slot tagging, day/night splitting
- `MissionDetailPage` — archetype warnings + honest implementation
  status panel
- `hardFilters` — overlap permission

CLEAN-ENGINE INVARIANT: `archetypeKind === 'x'` checks live ONLY in
`archetypeBehavior.ts`. No other file branches on archetype kind
directly.

### Honest disclosure inside the product

`getArchetypeBehavior(mission).implementationStatus` returns a
per-archetype map of `'wired' | 'partial' | 'todo'` for each behavior
(slot-splitting, fatigue-weighting, overlap-enforcement,
parallel-allowance, response-surface, warning-surface). The Mission
Detail page renders this as the "מצב מימוש בפועל" panel for the CC.
**The product shows what's real.** Adding a new behavior requires
updating `computeStatus()` in `archetypeBehavior.ts` to reflect what's
actually enforced. Lying here is what we promised not to do.

---

## 8. Creation vs Assignment vs Staffing — three different acts

This is the most-asked clarification when explaining the system. They
are NOT the same.

### 1. Creation

**Who**: CC (or PC for a platoon-scoped mission).
**Where**: `/missions/new` (full wizard) or via the template library.
**What**: Defines the mission's behavior: archetype, timing, manpower,
command, rotation, qualifications, equipment. The mission is created
with **empty `assignedPlatoonIds`** and status `active-unstaffed`.
**Output**: a Mission row in the database.

### 2. Assignment

**Who**: CC (or PC if `ownerRole === 'platoon'`).
**Where**: `/missions/:id/assign` — `MissionAssignPage`.
**What**: Picks WHICH platoons own this mission. **Mandatory step** —
the wizard's post-publish redirect lands here automatically. The
conflict resolution flow (§18) runs here against the leave board.
**Output**: `mission.assignedPlatoonIds` is set; status may transition
to `assigned-to-platoon` or `staffing-pending`.

### 3. Staffing

**Who**: PC.
**Where**: `/platoon/missions` → click "אייש" on a slot → Squad
Distribution Sheet → StaffingSheet.
**What**: For EACH SLOT of the mission, pick the specific soldiers.
**Output**: `Assignment` records (one per slot per soldier) +
`SelectorOutcomeRecord` audit entries.

### Why the separation matters

If you merge any two of these you produce a worse UX:
- Merging creation + assignment: every mission ask the operator "which
  platoons" before knowing what kind of mission it is. The wizard
  loses focus.
- Merging assignment + staffing: a CC who only wants to drop a mission
  to a platoon for the PC to staff is forced to pick individual
  soldiers. Wrong role at wrong moment.

The current product enforces the separation cleanly. Don't regress.

---

## 9. The staffing engine (selector + scoring + hard filters)

Lives in `src/utils/engine/`. Pure. Tested implicitly through
production use; no Vitest suite yet.

### Pipeline

```
candidatePool → hardFilters → score (per dimension) → select (clean / forced)
```

### Hard filters (`hardFilters.ts`)

Per-candidate, per-slot, returns `HardFilterCode[]`. Codes include:
- `soldier-inactive` / `soldier-home`
- `on-leave`
- `duty-exclusion`
- `wrong-platoon` (soldier's platoon not in `mission.assignedPlatoonIds`)
- `missing-qualifications`
- `squad-policy-violation`
- `time-conflict` (cross-slot overlap — see below)
- `critical-equipment-missing`

`hasTimeConflict()` is the engine's overlap enforcement. Reads
`ctx.allSlots` for ANY other slot the soldier is assigned to whose time
window overlaps this one. Applies the **symmetrical archetype consent
rule**:

```
isOverlapPermitted(a, b) =
  !a.forbidsParallelAssignment
  && !b.forbidsParallelAssignment
  && a.effectiveOverlapPolicy.activeOverlap.includes(b.fatigue.intensity)
  && b.effectiveOverlapPolicy.activeOverlap.includes(a.fatigue.intensity)
```

This is where readiness gets its parallel-assignment power and patrol
gets its strictness.

### Scoring (`scoring.ts`)

Five dimensions, each 0-100, blended with weights:
- `load` (0.30) — current `Soldier.currentLoad` vs platoon max
- `fatigue` (0.25) — hours rest since last shift vs required rest
- `qualMatch` (0.20) — fit to mission qualifications
- `cohesion` (0.15) — same-squad bonus
- `burden` (0.10 penalty) — composite from `burden.ts`

Plus a `priorityPin` SOFT bonus (+10 to +15) that REORDERS within a
partition but never lifts a forced candidate into the clean pool.

Each dimension carries an `explain` string. The Mission Detail page
exposes the breakdown so the operator sees WHY this candidate scored
this score.

### Selector (`selector.ts`)

Sorts the pool by score. Partitions into:
- `picked` — top N where N = `slot.requiredCount`
- `alternates` — next K (`MAX_ALTERNATES = 5`)
- `forced` — candidates with hard filters; visible only when the
  operator explicitly accepted forced fills

Returns a `SelectorOutcome` with `decayReasons[]` explaining why the
clean pool was thin (e.g. "פלוגה עם 3 חיילים בלבד זמינים השבוע").

The outcome is **immutable evidence** for the staffing decision —
persisted as `SelectorOutcomeRecord` so the operator can answer
"why was X picked over Y" months later.

### Burden (`burden.ts`)

3-layer model:
1. **Signals** — 12 raw measurements (daysBase, daysHome, totalShiftHours,
   hardShiftHours, etc.)
2. **Factors** — 4 human-readable groupings (workIntensity,
   recoveryDeficit, rotationPattern, stressLoad)
3. **Composite** — weighted blend into `burdenScore` (0-100) + headline

The hard-hour threshold reads `slot.effectiveFatigueWeight` (archetype-
driven, day/night-aware). Night slots get a 1.2× duration multiplier.
A readiness slot is NOT hard (`fatigueWeight: 2`); an active-patrol
slot IS hard (`fatigueWeight: 7`).

`markOverShoot()` sets `burden.overShoot = true` for soldiers above
p75 in their platoon — surfaced visually as a red dot on the soldier
card.

### Focus (`focus.ts`)

`buildFocusItems(role, viewer, ctx)` returns `FocusItem[]` —
"decisions the user must make now". E.g. "approve leave request for
חייל X", "respond to recall escalation", etc. This is DECISION work,
distinct from awareness work (the timeline does awareness).

---

## 10. The materializer

`src/utils/materialize.ts`. **`materializeWeek(input) =>
MaterializedSlot[]`**.

The materializer is the **source of slot truth** in the system. Every
page that needs to know "what slots exist this week" reads the
materializer. It is **pure** — input snapshot, deterministic output.

### Inputs

```ts
{
  missions, platoons, squads, soldiers, leaves, dutyExclusions,
  startDay, days,
  assignments?,            // operator-confirmed picks
  slotOperationalState?,   // per-slot operator manipulations
  platoonLeaveDays?,       // per-date per-platoon home/base
  soldierLeaveOverrides?,  // per-soldier exceptions
  emergencyActive?,        // when true, bypass home filtering
}
```

### What it produces per slot

A `MaterializedSlot` with:
- Identity: `id = mat-<missionId>-<isoDate>-<windowIdx>[-<segIdx>]`,
  `missionId`, `companyId`
- Time: `start`, `end` (ISO)
- Demand: `requiredCount`, `commanderRequired`, `commanderRanks`,
  `commanderCountsAsManpower`
- Constraints: `qualifications`, `equipment`, `squadPolicy`
- Ownership: `ownerPlatoonId` (resolved from `mission.rotation`)
- State: `status` (`'open' | 'partially-staffed' | 'fully-staffed'`)
- Auto-pick or operator picks: `assignedSoldierIds`, `commanderSoldierId`
- Archetype tags: `archetypeKind`, `partOfDay`,
  `effectiveFatigueWeight`
- Engine extras: `sustainedManpower?` (24/7 cycle math)

### Critical design choices

1. **Assignments win over auto-pick.** If `assignmentsBySlot[slotId]`
   is set, the materializer USES those soldiers verbatim. Auto-pick is
   a placeholder for "what the engine would do if no operator decision
   exists" — not an override.

2. **Day/night splitting** (Phase 7.3). When
   `behavior.splitsByDayNight` is true (currently only static-guard
   with distinct day/night shift durations), a 24/7 window expands
   into multiple sub-slots — e.g. 8 day-shifts × 2h + 3 night-shifts
   × 3h per day. Each gets its own slot id with a segment-index
   suffix. Legacy missions (no archetype) keep single-window ids for
   back-compat.

3. **Eligibility chain** (in order, per slot, per soldier):
   - `isAvailable()` — soldier active + on base + not on leave + no
     duty exclusion
   - Not in `excusedHere` (excused for this specific slot via Slot
     Operations Layer)
   - Not in a home-platoon (UNLESS `emergencyActive`)
   - No per-soldier home override (UNLESS `emergencyActive`)

4. **Emergency override** (Phase 7.3). When `emergencyActive=true` is
   passed in:
   - Home-platoon filter is BYPASSED. Home soldiers become eligible.
   - Per-soldier home override is BYPASSED.
   This is the "הקפצה means everyone in base" semantics realized in
   the engine. The leave board cells still show purple, but the engine
   ignores them.

5. **Slot stability across runs.** Slot ids are deterministic from
   mission id + date + window index (+ segment when split). Persisted
   `Assignment[]` records reference these ids. Legacy missions
   without `archetypeKind` resolve to `'custom'` →
   `splitsByDayNight=false` → ids unchanged across the Phase 7.3
   upgrade. **No assignment data lost in the migration.**

### Performance

The materializer is `O(days × missions × windows × eligible_pool)`.
With current seeds (~250 slots/week, 75 soldiers), it runs in single-
digit ms. Wrapped in `useMemo` at every callsite — re-runs only when
input arrays change identity.

11 pages call `materializeWeek` directly. There IS a `useMaterializedWeek`
hook in `src/hooks/useEngineContext.ts`; most pages predate it. Tech
debt — see §28.

---

## 11. Fatigue, overlap, readiness — what the engine enforces today

These three concepts are inter-related. The Phase 7.3 "wire the
partials" pass closed each from `partial` to `wired`. Here's exactly
what's enforced now:

### Fatigue

**Wired**: Burden math reads `slot.effectiveFatigueWeight` (archetype-
driven, day/night-aware), not just `mission.difficulty`. Hard-hour
threshold is `fatigueWeight >= 6`.

**Wired**: Night slots get a 1.2× duration multiplier in burden hour
totals when the day/night profile has `fatigueDiffersByPeriod`.

**Wired**: `consecutiveHardShifts` correctly resets when a readiness
slot (light) sits between two patrols (hard).

**Wired**: Rest scoring (`scoring.computeFatigue`) now reads
`ctx.allSlots` to find the actual most-recent slot end before this
slot's start — no longer the pessimistic 24h-back stub.

### Overlap

**Wired**: `hasTimeConflict()` scans `ctx.allSlots` for cross-slot
overlaps. Symmetrical archetype-aware consent rule — both sides must
permit the overlap by intensity. Patrol's `forbidsParallelAssignment`
short-circuits.

**Wired**: `mission.overlapPolicy` is populated from archetype
defaults on creation. Operator can edit via the wizard.

### Readiness

**Wired**: `isEventDriven` flag flows into the consent rule — a
readiness mission permits overlap with `standing-guard`, `admin`,
`readiness`.

**Wired**: Soldier-facing `MyReadinessCard` on the soldier dashboard
shows the readiness state INLINE (rally point + team-specific
instructions) when the soldier is on or imminent (≤12h) on a readiness
mission. No navigation needed for "where do I go".

**Wired**: `ReadinessResponseTeam[]` on Mission. Each team carries
selection mode (`'soldiers' | 'squad' | 'role'`) and optional per-team
rally/instructions overrides. The card highlights "הצוות שלך" for the
viewer.

**Partial**: The dedicated soldier-side readiness surface (not the
dashboard inline card; a full readiness page) is not built.
Disclosure visible in the mission detail's "מצב מימוש" panel.

---

## 12. Leave management at the operational level

Two parallel concepts, both persisted:

### `PlatoonLeaveDay`

Per-date per-platoon home/base status. Best fit for combat platoons
that rotate as a unit. Status: `'home' | 'in-base' | 'partial'`.

Edited via `/coverage/platoons` — `PlatoonLeaveBoardPage`. Click a
cell to toggle.

### `CoverageRule` (within `CompanyCoverageRuleSet`)

For non-rotating units (חפ״ק / מפלג). Five kinds:
- `min-count-in-platoon` — "at least N from platoon X in base"
- `min-with-functional-role` — "at least N drivers in base"
- `min-with-operational-role` — "at least N נגביסטים in base"
- `team-together` — "soldiers X, Y, Z stay together"
- `mutual-exclusion` — "soldiers X and Y not home together"
- `command-coverage` (Phase 7.3) — "at least N of {מ״מ OR סמל OR מ״כ}"
- `personal-leave-buffer` (Phase 7.3) — see §17

Edited via `/coverage/platoons` (the rule list at the bottom of the
page).

### `Leave` / `LeaveRequest`

The classic individual-leave path. A soldier requests, a PC approves,
becomes a `Leave` record. Hard-filtered by `hardFilters.isOnLeaveDuring`.

### `SoldierLeaveOverride`

Per-soldier exception to the platoon-day default. Two directions:
- "Soldier X from home-platoon Y is `'in-base'` today" (called back
  for some reason).
- "Soldier X from in-base-platoon Y is `'home'` today" (specific
  individual leave inside an otherwise-in-base platoon).

Materializer applies these AFTER the platoon-day filter.

---

## 13. The Company Leave Planning Wizard

`/coverage/planning` — `LeavePlanningWizardPage`. Four-step guided
setup the CC runs when standing up (or revising) a new line.

| Step | What |
|---|---|
| 1. חסימות | Add `CompanyBlockedDate` records — pick a date, classify the kind, set the four flags (requireAllInBase / addToCalendar / blockLeaveRequests / countsForBalance). |
| 2. גופים | Choose `bodySeparation`: `'platoons-together' \| 'chpk-by-person' \| 'chpk-with-platoons' \| 'chpk-separate'`. |
| 3. מדיניות | Pick `rotationPattern`, set the minimums (consecutive base/home days, max-platoons-home, home-stint-days), toggle `noWeekendTransition` + `allowSplitByPlatoon`. |
| 4. סקירה ופרסום | Summary + text recommendations + commit. |

### What it writes

The wizard's output is **policy + blocked dates**. It writes:
- `CompanyLeavePolicy` (updates existing record with new fields)
- `CompanyBlockedDate[]` (new persisted entries)

It does NOT generate a concrete rotation. The day-by-day toggles on
`/coverage/platoons` remain the operator's manual edit.

### Honest scope disclosure

Inside Step 4's "פעולות אחר־כך" panel:
> "הלוח הפלוגתי עצמו ייערך ידנית — המערכת לא יוצרת לוח אוטומטי כרגע."

This is **product honesty**. A real rotation generator that proposes
multiple candidate rotations balancing all constraints is the next
slice. See §22 for what the recommendations layer is today.

---

## 14. Blocked dates

`CompanyBlockedDate` — Phase 7.3 addition. Records dates the company
is operationally locked into a specific posture.

### Fields

```ts
{
  id, companyId, dateIso,
  kind: 'line-up' | 'line-down' | 'credit' | 'drill' | 'inspection'
      | 'op-event' | 'other',
  reason?,
  requireAllInBase: boolean,       // every platoon must be in base
  addToCalendar: boolean,          // soldier calendars show this day
  blockLeaveRequests: boolean,     // leave-request UI rejects this date
  countsForBalance: boolean,       // counts for fairness/balance metrics
  createdAt, createdByUserId,
}
```

### Operational examples

- **יום עליה לקו** (line-up): the whole company arrives, gets briefed,
  signs out equipment. `requireAllInBase=true`, `countsForBalance=false`
  (this is not a "normal duty day" to count for fairness).
- **יום ירידה מהקו** (line-down): same.
- **תרגיל** (drill): everyone in base, counts for balance.
- **אירוע מבצעי** (op-event): everyone in base, counts.

### Visual surface

The leave board (`/coverage/platoons`) reads `companyBlockedDates`
and tints the affected column headers with the kind's glyph (🎯 line-
up, 🏁 line-down, 🏖 credit, 🎖 drill, 🔍 inspection, 🚨 op-event, 📌
other). If a platoon is marked home on a `requireAllInBase` blocked
date, the cell flips to alert-red — visible conflict.

### Engine integration status

The wizard writes the records. The visual board reads them. The
**materializer does NOT yet read them** to enforce `requireAllInBase`.
This is honest tech debt — flagged in the wizard's recovery panel.
Next-slice scope.

---

## 15. Rotation policy

The `rotationPattern` field on `CompanyLeavePolicy`. Six presets:

| Pattern | Hebrew | Meaning |
|---|---|---|
| `weekly` | שבוע / שבוע | One platoon home for a week at a time |
| `10-5` | 10 / 5 | 10 days in base, 5 home — longer cycle |
| `8-7` | 8 / 7 | 8 / 7 — balanced |
| `one-home` | מחלקה אחת בבית | At most one platoon home at any moment |
| `two-home` | שתי מחלקות בבית | Aggressive — two home concurrently |
| `custom` | מותאם | Operator-defined, no recommendation hints |

Plus modifiers:
- `noWeekendTransition: boolean`
- `minConsecutiveBaseDays / minConsecutiveHomeDays: number`
- `allowSplitByPlatoon: boolean` — may a platoon be split (some home,
  some base, same day)?
- `maxPlatoonsHome: number`
- `homeStintDays: number`

These shape the recommendation text (§22), but the day-grid is still
manually toggled.

---

## 16. Command coverage

`CoverageRule` kind `'command-coverage'`. Captures "at any time at
least one of these ranks must be in base." The previous
`min-with-operational-role` rule was per-role AND — couldn't express
the OR semantics.

```ts
{
  id, kind: 'command-coverage',
  label,
  anyOfRoles: OperationalRole[],   // OR set
  min: number,
  scopePlatoonId?: string,
}
```

Default seed in the add form: `[מ״מ, סמל, מ״כ]`. Operator can extend
up to `[מ״פ, סמ״פ, מ״מ, סמל, מ״כ]`.

Evaluated per-day on `/coverage/platoons` against the in-base soldier
set. A soldier matches when ANY of their `operationalRoles` appears in
`anyOfRoles`.

---

## 17. Personal leave buffer

`CoverageRule` kind `'personal-leave-buffer'`. Reserve slack for
individual leave requests.

```ts
{
  id, kind: 'personal-leave-buffer',
  label, min: number, asPercent: boolean,
  scopePlatoonId?: string,
}
```

`asPercent: true` → min is 0..100% of platoon strength.
`asPercent: false` → min is an absolute count.

### Honest approximation

The current evaluator compares in-base count vs the configured target.
**Mission staffing demand is NOT subtracted** from "available" pool —
disclosed inline in the rule-add form. A proper computation would
subtract per-day per-platoon mission slot demand from in-base headcount,
yielding true slack. That's a future refinement.

---

## 18. Conflict resolution — the principle that runs through everything

**The product DOES NOT BLOCK with validation errors. It RESOLVES.**

The platoon-leave conflict resolution flow on `/missions/:id/assign`
is the canonical implementation. When the operator picks a platoon
that's marked home during the mission window:

The page shows a **ConflictCard** with **six action chips**:

| Action | Severity | What it does |
|---|---|---|
| ➕ הוסף את X לכיסוי | safe | Adds an available platoon to `selectedPlatoonIds`. Keeps the conflicting platoon. |
| ⇄ החלף ב־X | safe | Removes conflicting platoon, swaps in an available one. |
| 🔒 השאר בבסיס למשימה | override | `setPlatoonLeaveDay(date, platoon, 'in-base', note)` for each conflicting day. The leave board reflects the change immediately. |
| ½ יציאה חלקית | override | Same as above but `status='partial'`. |
| 🗓 פתח לוח יציאות פלוגתי | navigate | Routes to `/coverage/platoons` for free-form edit. |
| ⚠ אפשר בכל זאת | override | Dismiss the conflict; card collapses to "✓ נפתר — אושר עם אזהרה". |

After resolution the card collapses to a quiet confirmation. The Save
CTA shows "(N בלי פתרון)" while any remain unresolved.

### The data shape (`src/utils/conflictResolution.ts`)

`ConflictKind` is a discriminated union — only `'platoon-on-leave'`
is implemented today. The architecture supports adding:
- `'time-overlap'` (soldier already assigned to overlapping slot)
- `'soldier-on-leave'` (personal leave overlap)
- `'readiness-conflict'`
- `'staffing-conflict'` (under/over-strength)

Each new kind adds:
1. Its own `*Conflict` interface
2. Its own `resolutionsFor*()` helper
3. A case in the consuming page's `applyResolution` switch

No changes to existing code paths.

### Why this matters

Validation errors are tool behavior. Resolution flows are
command-and-control behavior. The product MUST stay on the resolution
side. If you find yourself adding a `throw new Error()` or a
`return false` in a UI guard, stop. Ask: "what would the operator do
RIGHT NOW to fix this?" The system surfaces those options.

---

## 19. The operational timeline

`src/utils/operationalTimeline.ts`. **Role-scoped, time-flow awareness.**

The system already understands missions, archetypes, conflicts,
fatigue, readiness, leave. The timeline adds the missing axis: **WHEN
things happen.** "In 2 hours the guard hands over." "מחלקה 2 חוזרת ב-
06:00." "No שבצ״ק published for tomorrow."

### Event kinds (10 wired today)

| Kind | Scope | When emitted |
|---|---|---|
| `next-shift` | soldier | Upcoming slot in 36h, per assigned soldier |
| `shift-end-now` | soldier | Currently-on slot ending in ≤90 min |
| `shift-handover` | platoon + company | Slot start, single per slot |
| `readiness-on` | soldier + platoon + company | Readiness slot in horizon |
| `staffing-pressure` | platoon + company | Open/partial slot in next 12h, severity escalates with proximity |
| `publish-deadline` | platoon + company | No "שבצ״ק עודכן" announcement in 18h |
| `concurrent-critical` | company | Two ambush/patrol slots starting within 30 min |
| `leave-conflict-imminent` | platoon + company | Mission still active when assigned platoon enters home stint |
| `platoon-leaving-home` | platoon + company | Today/tomorrow stint transition into home |
| `platoon-returning` | platoon + company | Today/tomorrow stint transition back to base |

### Scoping discipline

The single most important rule of this layer. Every `TimelineEvent`
carries `scopes: TimelineScope[]`. `selectTimelineFor(events, {
viewerSoldierId, viewerPlatoonId, viewerCompanyId, limit, minSeverity
})` filters to events whose scope set matches the viewer.

**A soldier passing only `viewerSoldierId` never sees platoon noise.**
**A PC passing only `viewerPlatoonId` never sees other platoons'
transitions.**

This is the user's hard requirement: each role sees only what's
relevant to them. The home page MUST NOT become a dumping ground.

### UI surfaces

- **SoldierDashboard** — "הציר שלך" strip below the OperationalStateCard.
  `viewerSoldierId` only. Limit 4. 36h horizon.
- **PlatoonMissionsPage** — "ציר זמן פלוגתי" strip above the missions
  list. `viewerPlatoonId` only. Limit 6.
- **`/schedule` company-wide strip** — derivation supports it; the
  page doesn't render it yet. Next-slice scope.

### Why pure

`deriveTimelineEvents()` takes `nowIso` as input, NOT `Date.now()`.
Determinism = replay = test. The hook callsites read `new Date()
.toISOString()` and pass it in.

---

## 20. Emergency / הקפצה

### What it means operationally

הקפצה does NOT mean "alert" or "announcement." It means **soldiers
who were home are temporarily called back to base**. From the moment
of declaration until close, the company is in a state of "everyone in
base." Leave is frozen, missions can be re-assigned, the situation
changes faster than the normal schedule allows.

### Architecture

Built on the existing `EscalationEvent` infrastructure. Pre-existed in
the data model; Phase 7.3 made it real.

**Single global affordance**: `<EmergencyFab>` mounted in `App.tsx`,
visible to anyone passing `canDeclareEscalation()` (CC + סמ״פ +
delegates). Bottom-right floating button. Idle = red "🚨 הקפצה". Active
= red "🛑 סיים אירוע (N)" with pulsing white badge.

**No in-page card.** The earlier "פעולת חירום" card on the CC
dashboard was removed in commit `c9995f0`. The FAB is the only entry
point — available from EVERY screen, not just /home.

**The card is gone. The FAB is the canonical surface.** Do not
re-add a page-local emergency card.

### Declare flow

`DeclareEmergencySheet`:
- Reason (free text, required)
- Location / rally point (free text)
- Report time — chip picker (5/15/30/60/120 min from now)
- Audience — whole company OR selected platoons
- Duration kind — open / planned
- Free-text instructions

On confirm:
1. `declareEscalation()` writes the `EscalationEvent` (status
   `'active'`).
2. `addAnnouncement()` publishes a "🚨 הקפצה" announcement to the same
   audience.
3. `addAuditLog()` records the declaration.
4. The FAB switches to active state across every screen.

### Active-state engine effect (the real semantics)

`useEngineContext` derives:
```ts
emergencyActive = escalationEvents.some(
  e => e.status === 'active' && e.companyId === myCompany.id
);
```

Passes this into `materializeWeek({ emergencyActive })`. The
materializer:
1. **BYPASSES** the home-platoon filter — home soldiers appear in the
   eligible pool.
2. **BYPASSES** per-soldier home overrides — anyone marked home for
   today flips to eligible.

The leave board cells still SHOW home (the data is unchanged). The
ENGINE just ignores them. When the event closes, eligibility snaps
back to the original schedule.

`useMaterializedWeek` (the standalone hook for pages that don't pull
the full context) computes the same `emergencyActive` so every consumer
sees the same view.

### What does NOT happen automatically

Honestly:
- Missions are NOT auto-paused. Their slots continue materializing.
  The operator can manually reassign.
- The leave board is NOT auto-edited (it's UNCHANGED — just visually
  overridden by the materializer).
- No push notification fires. The auto-announcement is the soldier-
  facing signal.
- No materializer-level "freeze" beyond the eligibility bypass.

---

## 21. Recovery from emergency

`EndEmergencySheet`. Captures:
- Close reason
- Free-text "אילו משימות נפגעו / זזו"
- Free-text "חיילים שדורשים מנוחה"
- Return-to-normal pick: `'full' | 'partial' | 'new'`
- Optional closure announcement (default ON)

On confirm:
1. `closeEscalation(id, recoveryNotes)` — all free-text fields roll
   into `closeReason` for the audit log.
2. Optional closure announcement.
3. **If `returnToNormal !== 'full'`**: routes to `/coverage/planning`
   — the leave-planning wizard. The post-emergency rotation usually
   isn't fair (home soldiers were called back, others stayed and got
   worn). Routing to the planning wizard gives the operator the right
   surface to re-balance.

If `returnToNormal === 'full'`: skips routing, returns home. The
previous schedule resumes as-is.

### What the recovery does NOT do (honest)

Disclosed inside the sheet itself:
> "סגירת האירוע מתעדת את המידע למעלה ביומן + פרסום הודעה. החזרה
> לסידור הקודם, איוש מחדש, ועדכון יציאות פלוגתיות נעשים ידנית"

No auto-rollback of missions. No automatic burden adjustment for
soldiers who lost rest. No auto-publish of a fresh שבצ״ק.

---

## 22. The recommendations layer (honestly: it is text)

Three surfaces produce recommendations today:

### Leave-planning wizard Step 4

`buildRecommendations(draft, blocked)` generates 3-7 textual notes
tonally classed `good | info | warn`:
- "10/5 שומר על איזון טוב" (good)
- "יום עליה/ירידה מהקו מסומן ככזה שלא נספר לאיזון" (info)
- "החלפות בשישי/שבת עלולות לפגוע בזמינות החיילים" (warn)

### Leave board recommendations section

Phase 7.3 control-center upgrade. `recommendations` useMemo derives
from current state:
- Capacity breach summary
- Coverage rule heatmap count
- Fairness spread between platoons (most-home vs least-home)
- Blocked dates summary
- "הלוח נראה תקין" fallback

### What the recommendations are NOT

They are NOT computed rotation plans. There is no engine that emits
"Option A vs Option B vs Option C" candidate rotations with scores.

The user's spec called for a real recommendation engine. It is a
future slice. The current layer is **explanatory text** derived from
state — not a generative recommender. Disclosed inside the wizard
helper text.

---

## 23. Role-scoped awareness

The single most important UX principle in the entire product. From the
user verbatim:

> כל role רואה: רק מה שהוא צריך לדעת או לעשות עכשיו.
> לא כל מה שהמערכת יודעת.

### How it's enforced

1. **Permission gates** (`canX(user, delegations)`) at every action
   entry point.
2. **Scope filters** in derivation helpers (`selectTimelineFor`,
   `activeEscalationsForViewer`, etc.).
3. **Surface routing** in the page tree:
   - `/home` dispatches by role to one of four dashboard variants
   - Each dashboard pulls ONLY the data relevant to that role
4. **Inline scope discipline**: every dashboard scopes its derivation
   to "my platoon" (PC) or "my missions" (Soldier).

### Failure modes to avoid

- Putting "all alerts for the company" on the soldier home page.
- Putting "all platoons' timelines" on the PC home page.
- Putting "all missions in the system" on the soldier dashboard.

If a new feature tempts you to add data to a home page, the question
is: **is this directly actionable by THIS role RIGHT NOW?** If no, it
belongs on a deeper page (or an /alerts feed, or a dedicated module).

---

## 24. UX philosophy

These are not aesthetic preferences. They are operational
correctness.

### 1. Decisions, not data

Every page exists to enable an OPERATIONAL DECISION. A page with no
clear next action is a page that doesn't belong.

### 2. CTA quality > CTA quantity

If a page has 5 buttons of equal weight, the operator does nothing.
Pick the ONE thing the operator should do here. Make it the primary.
Demote the others.

### 3. Alerts hierarchy

Critical state is conveyed by the bell badge (`AlertsButton`), the
`/alerts` page, the FAB's active state, the FocusSection on home
pages, and inline pills inside cards. **NEVER a pink banner across the
top of the page.** Earlier phases of this product had one. Multiple
removal attempts confirmed: top banners get ignored, and they steal
content space without delivering operational signal.

### 4. Explainability

Every engine decision exposes its reasoning. The selector returns a
`SelectorOutcome` with `decayReasons`. The scoring breakdown is on
every candidate card. The archetype implementation status is on every
mission detail. The recommendations carry tonal classification + a
reason. **The operator never sees a black-box decision.**

### 5. Pin invariant

A pinned soldier is a HUMAN PREFERENCE, not a SYSTEM BYPASS. Pin
bonus reorders WITHIN a partition (clean vs forced); it never lifts a
forced candidate into the clean pool. The operator must still
consciously confirm any forced fill — pinned or not. This is hard-coded
in `scoring.ts::computePinBonus`. Don't regress.

### 6. Performance

The materializer runs in single-digit ms on the current seed. Every
derivation is `useMemo`-wrapped. localStorage writes are eager but
small. **If a slice you're about to add will run heavy work in a
useMemo on every render, refactor first.**

### 7. Recovery

Every destructive operation must be reversible OR explicit. Toggling
a leave-day cell is reversible (click again). Closing an emergency
event is final-but-logged (audit log carries the full recovery
notes). Mission assignment is final-but-revisable (the operator can
open `/missions/:id/assign` again).

### 8. Quiet mode

The product has an under-used `useQuietMode` hook for muting
notifications during specific durations. Not central to current work
but exists.

---

## 25. Mobile constraints

### Safe area

Every fixed/sticky element MUST respect `env(safe-area-inset-*)`:
- `Sheet` primitive: padding-top + padding-bottom on the overlay.
- `BottomNav`: `safe-area-bottom` utility class.
- `EmergencyFab`: explicit `style={{ bottom: 'calc(7rem +
  env(safe-area-inset-bottom, 0px))' }}`.
- `CommandMenu` drawer: padding-top + padding-bottom inside the aside.

### Dynamic viewport

`100dvh` instead of `100vh` on full-height sheets so URL-bar collapse
on iOS Safari doesn't break layout. Tested fix in `Sheet.tsx`.

### Sheet height bug — historical

The Sheet primitive's body collapsed to 0 height in production at
one point. Root cause: outer `flex items-end` sized inner to content
height; inner's `flex-1` body had no parent height to grow into. Fix:
inner uses `h-full sm:h-auto sm:max-h-[88vh]` so body has real height
to engage `flex-1`. See commit `c9995f0`.

### Z-index ladder

| Layer | z |
|---|---|
| Page content | 0–10 |
| Header sticky | 30 |
| BottomNav | 30 |
| PersonalActionsFab | 30 |
| EmergencyFab | 35 |
| Sheets / modals / drawers | 50 |

`z-50` covers everything below it. `z-35` is the FAB-specific layer
so the FAB is never visually behind the nav.

### Touch targets

Minimum 44×44 px on tappable elements. Buttons use `py-2.5` or higher,
nav tabs use `py-2`, FABs use `w-14 h-14`.

### RTL

Hebrew-first. `dir="rtl"` is on the root + every Sheet/drawer.
Tailwind utilities respect logical properties where used: `start-` /
`end-` / `me-` / `ms-`. Physical `right-` / `left-` are used
intentionally for elements pinned to a specific viewport edge (e.g.
the EmergencyFab on `right-5`).

---

## 26. Backend / persistence state

### Today: localStorage only

Every persisted slice lives in `localStorage` under
`ha-pluga-sheli:state:<slice>:v<version>`. The slice catalog:

```
allSoldiers, announcements, assignments, commandDelegations,
companyBlockedDates, companyCoverageRules, companyLeavePolicy,
currentRole, currentUser, equipmentGaps, escalationEvents,
leaveRequests, leaves, missionNotes, missions, missionTemplates,
orders, overrideAlerts, periods (legacy), platoonLeaveCycles,
platoonLeaveDays, platoons, selectorOutcomes, signedEquipment,
slotOperationalState, soldierLeaveOverrides, soldierStatusEvents,
squads, templateFamilies, users
```

`clearAllPersistedState()` wipes by prefix scan — new slices
auto-clean without maintaining an explicit list.

`SEED_VERSION` is currently `1`. Bumping it invalidates all stored
data and falls back to fresh seeds.

### Supabase scaffolding (unused)

`USE_SUPABASE` env flag exists. `api/_supabase.ts` initializes a
Supabase client when set. `api/_adapter.ts` is the abstraction layer
between domain API modules and either mock data or live Supabase.
**Today the flag is OFF in production.** All reads/writes hit
`localStorage`.

### Why the layer exists

When the eventual cutover to a real backend happens, the api/*
domain modules + the adapter give a single place to wire the network
layer without changing AppContext callers. The pattern is in place;
the implementation is mocked.

---

## 27. What is real vs mock

The single most important honest disclosure section.

### Wired (the engine actually does this)

- Mission CRUD via AppContext mutations (`addMission`, `updateMission`,
  `setMissionStatus`)
- Mission templates (CRUD, favorites, hide, usage count) +
  template families (CRUD)
- Operational orders (CRUD)
- Materializer day/night slot splitting (static-guard with distinct
  durations)
- Materializer eligibility filter including emergency bypass
- Engine selector + scoring + hard filters (5 dimensions, 8 hard
  filter codes)
- Burden math with archetype-aware fatigue weights + night multiplier
- Cross-slot overlap enforcement with symmetrical archetype consent
- Real rest-window scoring from `ctx.allSlots`
- Conflict resolution flow for platoon-on-leave (6 action chips)
- Squad-distribution prompt before staffing
- Operational timeline derivation + role-scoped selection
- 10 timeline event kinds (with scope discipline)
- Emergency declaration + active state + close-with-recovery
- Emergency state forces home → in-base in the materializer
- Leave board visual upgrade (blocked dates, transitions, warnings)
- Coverage rules (7 kinds, including command-coverage + buffer)
- Leave-planning wizard (writes policy + blocked dates)
- Audit log entries on declarations and closures
- Auto-announcements on emergency declare / close
- Soldier-facing readiness inline card (rally + team instructions)
- Mission detail archetype + implementation-status panel
- Permission gates via `canX(user, delegations)` + delegation banner

### Partial (values flow but engine doesn't fully enforce)

- `personal-leave-buffer` rule — compares in-base count to target;
  does NOT subtract mission staffing demand
- `bodySeparation` on `CompanyLeavePolicy` — stored, not yet enforced
  at materializer level
- `shiftDurationLocked` flag — flag exists, StaffingSheet UI doesn't
  yet disable controls based on it
- Mission templates' `usageCount` increments correctly; "recently
  used" sort works; per-template usage timeline not surfaced
- Timeline does emit events; `/schedule` (CC) page doesn't render
  the company-wide strip yet

### Mock (zero engine enforcement)

- All persistence is `localStorage`; no multi-device sync
- No real auth; `MockUser[]` personas; switch via `UserSwitcher` chip
- No push notifications; auto-announcement is the soldier-facing
  signal
- Recovery from emergency does NOT auto-rollback missions, adjust
  burden, or re-publish שבצ״ק
- Materializer does NOT read `companyBlockedDates` to enforce
  `requireAllInBase`
- Conflict resolution covers ONLY `platoon-on-leave`. Time-overlap,
  soldier-on-personal-leave, readiness conflicts, staffing conflicts
  → engine blocks correctly, UI shows hard-filter codes, but no
  inline resolution chips
- Recommendation "engine" is text-only — no candidate-plan generator
- No automatic rotation generator
- No real device APIs (photo, scan, etc.)
- `Soldier.equipmentRequirements` is data; equipment-bound mission
  warnings are partial

The product surfaces this honesty INSIDE the UI. The
"מצב מימוש בפועל" panel on every mission detail shows the truth. The
recovery sheet says what it does NOT do. The wizard's helper text
says recommendations are NOT generated rotations. **Do not regress
this honesty.** It is the difference between a tool and a toy.

---

## 28. Technical debt

### Architectural

- **AppContext is 2,575 lines.** Single monolithic provider. The pilot-
  mindset memory note flagged a planned 7-provider fanout. Every new
  feature has added to this file. The split is mechanical (no behavior
  change) but invasive.
- **11 pages call `materializeWeek` directly** instead of using the
  `useMaterializedWeek` hook. Each is memoized so it doesn't thrash,
  but the duplication means a future change to materializer inputs
  needs 11 edits.
- **No tests.** Engine helpers (`archetypeBehavior`, `operationalTimeline`,
  `conflictResolution`, `missionImport`, `missionTemplates`) are all
  pure and immediately testable. Adding a Vitest suite is high-leverage
  and low-effort.

### Data

- **Legacy `periods` slice** (`SchedulePeriod[]`) is persisted but no
  page reads it. Superseded by `OperationalOrder`. Bump `SEED_VERSION`
  + remove the slice from AppContext when ready.
- **`Soldier.teamClass`** is deprecated by `squadId`. 109 references
  still exist. Cleanup pass per-file would retire it.
- **Mock data is 2,050 lines** in a single file. Could be split per-
  entity.

### UI

- **10 `react-hooks/purity` warnings** for `Date.now()` inside
  `useMemo`. Pre-existing pattern. Pass `nowIso` via prop or context
  instead.
- **Legacy `PlatoonNewMissionPage`** (PC quick-create with 8 hardcoded
  templates) is reachable via "התחל מ-0" but bypasses the new template
  library + archetype system. Should migrate to consume the library.
- **`CommandMenu` was rebuilt as a drawer** (Phase 7.3); the Sheet
  primitive's height fix benefits every other Sheet consumer. Drawer
  pattern works; revisit if more menu surfaces emerge.

### Cleanup completed in Phase 7.3

- Removed 6 unused files (~500 lines)
- Deleted `EscalationSheet.tsx` (replaced by `DeclareEmergencySheet`)
- Removed `useActivePeriod` hook (dead)
- Removed in-page "פעולת חירום" card on CC dashboard

---

## 29. Future architecture

### Layered missions

A real operational mission may carry MULTIPLE layers simultaneously:
- A static-guard mission AT a גבולית may also be on כוננות כרמל א
- A patrol team may double as a hand-pick readiness response team

The current model is `Mission.archetypeKind = 'x'` — ONE archetype.
A future `Mission.layers: MissionLayer[]` would let layered missions
work without forcing the operator to create two parallel records.
Engine consequences: the materializer would emit slots for each layer;
overlap rules would check the combined intensity set.

### Mission Packages

A persisted, named bundle of mission templates. "קו עזה" might be a
package: 3 guard templates, 2 patrol templates, 1 readiness template.
"שבוע מלחמה" might pull a different set.

The template family layer is the foundation: families have stable
`key` values + display labels. A package references families by key.

The data shape is straightforward; the UX is the question — how does
the operator browse, edit, and apply a package?

### Rotation generator

The honest gap: no auto-generated rotation. The operator manually
toggles the leave board. A real generator would take:
- `CompanyLeavePolicy` (target pattern + minimums)
- `CompanyBlockedDate[]`
- `CoverageRule[]` (including command-coverage + buffer)
- Current `PlatoonLeaveDay[]` (locked entries)
- Fairness scores per platoon (historical home days)

…and emit 2-3 candidate rotations with explanations. The operator
picks one. The chosen plan writes to `PlatoonLeaveDay[]`.

This is a real engine project — not a couple of helpers. It's the
single highest-leverage future slice for the leave system.

### Real backend

Supabase scaffolding is in place. The migration:
1. Define database tables matching the persisted slices.
2. Implement the api/* domain modules as Supabase queries.
3. Set `USE_SUPABASE=true`.
4. Add an auth layer (Supabase Auth or otherwise).

Estimated: 3-5 days for a single engineer, depending on auth complexity.

### Soldier-side readiness page

Today readiness lives inline on the soldier dashboard. A dedicated
`/readiness/:missionId` page for the assigned soldier with:
- Live event status
- Rally point + map
- Team listing with reachability
- Activation acknowledgement

Would close the partial `responseSurface` status for readiness.

---

## 30. Things that must never regress

If you touch the code and any of these break, STOP.

1. **The pin invariant** (§24.5). Pinned soldiers reorder within a
   partition; never lift forced into clean.
2. **Engine purity.** `src/utils/engine/*` and `materialize.ts` MUST
   stay free of React, `Date.now()`, and localStorage. `nowIso` is
   passed in.
3. **`getArchetypeBehavior` is the single archetype funnel.**
   `archetypeKind === 'x'` checks live ONLY in
   `src/utils/archetypeBehavior.ts`.
4. **Assignments survive the materializer's re-run.** Slot ids are
   deterministic. The Phase 7.3 archetype migration preserved legacy
   slot ids for missions without `archetypeKind`.
5. **`SelectorOutcome` is immutable evidence.** Every staffing
   decision writes a `SelectorOutcomeRecord`. Don't delete or rewrite
   these.
6. **No top banners.** The pink emergency banner was removed in
   Phase 6.7 after the user explicitly demanded its removal multiple
   times. Critical signals belong on the bell badge, /alerts,
   FocusSection, or inline cards.
7. **Conflict resolution, not validation error.** When a system block
   triggers, surface RESOLUTION OPTIONS, not just an error message.
8. **Honest implementation status.** The mission detail's "מצב מימוש"
   panel must reflect what's actually wired. Update
   `computeStatus()` in `archetypeBehavior.ts` when behavior changes.
9. **Role scoping.** Every new derivation that emits per-user
   information MUST flow through a viewer-scope filter. Never dump
   company-wide data on a per-role surface.
10. **Templates fill defaults; they do not skip operational questions.**
    The archetype's `hiddenSteps` should only hide the questions the
    archetype TRULY answers (character/intensity). Timing, manpower,
    command, rotation, qualifications/equipment stay required for the
    operator.

---

## 31. Known edge cases

### Slot id collisions

`mat-<missionId>-<iso>-<windowIdx>` for un-split missions.
`mat-<missionId>-<iso>-<windowIdx>-<segIdx>` for split missions. If
you change a mission's archetype from `static-guard` (split) to
`custom` (not split), the slot ids change shape — persisted
assignments for that mission would orphan. The migration safe-path is
"never change archetype on a live mission with assignments"; the
wizard's edit flow today allows it. **Add a confirmation if you
expose archetype change post-publish.**

### Mission with `assignedPlatoonIds: []`

A mission can exist without an assigned platoon (post-creation,
pre-assignment). Materializer's `resolveRotation()` will produce
`ownerPlatoonId = null` for these → soldiers have no `wrong-platoon`
filter but no `ownerPool` either → slot stays `'open'`. Visible on
`/missions` as `'active-unstaffed'`. Don't auto-assign in code; the
operator decides.

### Delegation expiration mid-action

`CommandDelegation` is time-bounded. If a delegation expires WHILE
the operator is mid-flow (e.g. mid-emergency-declaration), the
permission gate at submit time may reject. The wizard re-checks on
submit, so this is safe. The visual state may briefly show the
operator as having permission they no longer have — accepted UX cost.

### Concurrent emergency events

`activeEscalationsForViewer().length` could be > 1 if two events are
declared in parallel. The FAB shows the count `(N)` and opens the
END sheet on the first one. Closing them in declared order is the
implicit assumption. A multi-event UI would need a picker.

### Materializer + emergency: leave-board visual drift

When emergency is active, the leave board cells STILL show purple
(`home`). The engine ignores them, but the board UX doesn't reflect
that. Operator sees "מחלקה בבית" while soldiers from that platoon are
showing up in StaffingSheet. **The visual drift is intentional today**
— it preserves the "what the schedule said" record. Adding an
emergency-aware overlay on the leave board ("emergency state — leave
ignored") would be a polish item.

### Day/night split slot count explosion

A static-guard with `day=120m / night=180m` produces ~11 slots/day.
Over 7 days × 75 soldiers eligibility check = ~5,800 evaluations.
Currently under a frame budget but the upper bound grows as templates
get richer. **If you add a third period to `dayNightProfile`, the
expansion could compound; profile carefully.**

### Soldier in a squad with no `platoonId`

`Soldier.squadId` may be unset for company-staff. Materializer's
`soldiersInPlatoon()` skips them. Hard filter `wrong-platoon` skips
them. They cannot be staffed via the auto-pick path. They CAN be
forced via direct assignment. **Don't loop without that fallback.**

### Recommendation calc with empty seed

`recommendations` on the leave board falls back to "הלוח נראה תקין"
when none of the rule branches trigger. Fresh installs with no leave
data hit this. **Don't show "good — balanced" before any rotation
has been planned.** Soft polish item.

---

## 32. What the system does NOT understand yet

The honest list. Adding these is real work, not refactoring.

1. **Layered missions** — a mission has exactly one archetype today.
2. **Mission packages** — no persisted bundles of templates.
3. **Auto-generated rotation** — no engine emits candidate plans.
4. **Per-soldier internal-rotation visualization** — the leave board
   shows platoons, not soldiers.
5. **חפ״ק / מפלג internal sub-rotation** — these run by `CoverageRule`,
   not by day-grid. No surface for "who specifically in חפ״ק is in
   base today."
6. **Multi-post static-guard** — one mission = one set of slots. A
   mission with 3 named posts (gate / tower-A / tower-B) each with
   its own count + qualification needs a richer `MissionManpowerSpec`.
7. **Soldier reachability / contact** — the system knows phone numbers
   but doesn't expose call/WhatsApp actions in the readiness card.
8. **Sabbath / weekend variance** beyond `noWeekendTransition`. No
   modeling for "no leave starting Friday afternoon."
9. **Compensation accounting after emergency** — burden math reflects
   the disrupted state but doesn't track "this soldier is owed
   compensation."
10. **Cross-company / battalion-level view** — the data model has
    `companyId` everywhere; multi-company isn't UI-modeled.
11. **Reservist (מילואים) leave doctrine** — separate from base
    rotation. Not modeled.
12. **Audit log surfacing** — `addAuditLog()` writes; there's no UI to
    browse the log.
13. **Equipment lifecycle / damage / repair** — partial UI exists
    (`EquipmentGap`, lifecycle events), engine doesn't enforce.
14. **Real conflict-resolution for the other 4 conflict kinds** —
    time-overlap, soldier-on-leave, readiness-conflict, staffing.

---

## 33. What the engine already understands

The flipside — what NOT to re-build.

1. **Mission archetypes** (5 of them) with per-archetype behavior
   flags + day/night splitting + fatigue weighting + overlap policy.
2. **Real cross-slot time-conflict** with symmetrical archetype consent.
3. **Real rest-window scoring** from materialized slots.
4. **Burden math** that differentiates hard vs light work via
   archetype's fatigueWeight.
5. **Operational timeline derivation** with 10 event kinds + role
   scoping.
6. **Emergency state** that flips home → in-base in the materializer.
7. **Conflict resolution** for platoon-on-leave (with 6 actions).
8. **Squad-distribution scoping** that filters the candidate pool
   before the engine sees it.
9. **Honest implementation-status surface** that tells the operator
   what's wired and what's still data.
10. **Mission template library** with families, search, favorites,
    "save as template" from any existing mission, related templates,
    multi-axis filters.
11. **Mission import-from-previous-order** flow.
12. **Visual leave board** with blocked dates, transition arrows,
    per-cell warnings, recommendations.
13. **Leave-planning wizard** (4 steps, writes policy + blocked
    dates).
14. **7 coverage rule kinds** including OR-of-roles command-coverage
    + percent-or-absolute personal-leave-buffer.
15. **Permission system** with delegations + functional-role grants.
16. **Role-scoped dashboards** for soldier / PC / CC / Rasap.
17. **Soldier-facing readiness card** with rally + team-specific
    instructions inline.
18. **Audit logging** for declarations / closures / mutations.

---

## 34. Suggested next milestones

In priority order based on operational impact vs implementation cost:

### Tier 1 — small, high-leverage

1. **`/schedule` company-wide timeline strip.** Helper already
   produces company-scoped events; the page just doesn't render them.
   1 day.
2. **Materializer reads `CompanyBlockedDate.requireAllInBase`.** Treat
   blocked dates as hard constraint. 1 day.
3. **Conflict resolution for `time-overlap`.** Engine already detects
   it via `hasTimeConflict`; UI shows the hard-filter code. Add a
   resolution chip-row inside StaffingSheet for the rejected
   candidates. 1-2 days.
4. **Engine test suite.** Vitest on the pure helpers
   (`archetypeBehavior`, `operationalTimeline`, `conflictResolution`,
   `missionImport`, `missionTemplates`). 2-3 days bootstrap, ongoing
   maintenance.

### Tier 2 — meaningful, moderate cost

5. **AppContext provider fanout.** Mechanical split, no behavior
   change. Unblocks every future feature. 3-5 days.
6. **Migrate `PlatoonNewMissionPage` to library consumer.** Closes the
   PC's "התחל מ-0" inconsistency. 1 day.
7. **`shiftDurationLocked` UI in StaffingSheet.** Disable duration
   controls when locked. 0.5 days.
8. **Day/night editor inside Step 3** of the wizard. The data flows
   through; explicit UI to tune day vs night durations is missing.
   1 day.

### Tier 3 — bigger investments

9. **Real backend on Supabase.** Multi-device. Real auth. 3-5 days
   for a single engineer.
10. **Auto-rotation generator** for the leave system. The Mark-IV
    feature. Multi-candidate proposals with scoring. 1-2 weeks for a
    first usable version.
11. **Layered missions** — a Mission gets `layers: MissionLayer[]` for
    composite operational responsibilities. Engine implications are
    significant. 1-2 weeks.
12. **Mission Packages**. Data model is ready; UX is the question.
    1 week.

### Tier 4 — strategic

13. **Battalion-level multi-company view.** When the product expands
    to a multi-company unit.
14. **Operational-doctrine plug-in layer.** Different units have
    different doctrine. Today the rules are baked into helpers; a
    plug-in layer would let an army-wide deployment serve different
    formations.
15. **Mobile app shells (iOS / Android via Capacitor).** Currently
    web-only PWA. Native shells would enable push notifications,
    biometric login, etc.

---

## Closing

Read this once at onboarding. Re-read sections as you touch them.
When you ship a substantial change, **update this document in the same
PR** — the file is the source of truth for "how the product thinks."

The product is honest about its gaps. Keep it that way.

— maintained alongside `feedback_pilot_mindset.md`,
  `feedback_engine_ux_principles.md`, `feedback_deploy_each_change.md`,
  `project_shavatz_na.md`, `project_mission_operations_layer.md` in
  the developer's memory bank.
