# הפלוגה שלי — Operational Bible

> Onboarding document for a senior engineer joining as tech lead on the
> product. This is **not** a status update. It is the complete mental model
> required to make architecturally correct decisions on this system.
>
> Read all of it. The whole thing. The architecture is consistent only when
> every layer is held together.

**Last updated**: 2026-05-17
**Audience**: Incoming tech lead / senior engineer / anyone reviewing the product end-to-end
**Length contract**: Maximally detailed. Do not shorten on the next revision. If a
section grows stale, REPLACE the content; do not delete the section.
**Reading time**: 2-3 hours. Re-reading-time: 30 minutes for a specific module.

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
27. [What is real vs mock — the honest matrix](#27-what-is-real-vs-mock--the-honest-matrix)
28. [Technical debt](#28-technical-debt)
29. [Future architecture](#29-future-architecture)
30. [Things that must never regress](#30-things-that-must-never-regress)
31. [Known edge cases](#31-known-edge-cases)
32. [What the system does NOT understand yet](#32-what-the-system-does-not-understand-yet)
33. [What the engine already understands](#33-what-the-engine-already-understands)
34. [Suggested next milestones](#34-suggested-next-milestones)
35. [Glossary of Hebrew operational terms](#35-glossary)
36. [File map — where things live](#36-file-map)

---

## 1. Vision

### The operational pain the product replaces

A company commander (מ״פ) in the IDF runs a unit of ~75 soldiers across
three combat platoons, a small forward-command element (חפ״ק), and a
logistics platoon (מפלג). His job over a typical week:

- Receive an operational order (צו) from the battalion.
- Decompose the order into specific missions (שמירה בש״ג, סיור לילה,
  כוננות כרמל א, etc.).
- Decide which platoon owns each mission for which window.
- Plan leave rotations so soldiers actually go home periodically.
- Keep enough force in base to handle emergencies.
- Approve or reject individual leave requests.
- Run impromptu emergencies (הקפצה) when something happens.
- After an emergency, re-balance the rotation so the people who got
  called back don't get short-changed on home time.

In the current real world this is done with: a paper notebook, an
Excel sheet that ONE אחראי שבצ״ק maintains, a WhatsApp group with 40
people in it, and the מ״פ's memory. The known failure modes are:

- **Information siloed in one head.** The אחראי שבצ״ק knows. The מ״פ
  thinks he knows. The מ״מ guesses. The soldier finds out via
  WhatsApp two hours before the shift.
- **No traceable history.** "Why was this soldier picked over that
  one?" — nobody remembers.
- **Coverage rules enforced by memory.** "There must always be a מ״מ
  in base" — until two go home at the same time and nobody notices
  until the alert.
- **Emergencies destroy the plan.** A הקפצה happens, everyone scrambles,
  the original schedule is forgotten, the post-emergency rotation is
  done by feel.
- **Leave requests fall through the cracks.** A soldier asks the מ״מ
  for leave, the מ״מ forgets to tell the מ״פ, the soldier arrives
  expecting leave that doesn't exist.

The product replaces those failure modes by making **every operational
decision data**: created in a structured form, surfaced to the right
role at the right moment, traceable forever, reversible when
appropriate.

### What success looks like

A מ״פ opens his phone in the morning. He sees: today's missions, the
platoons assigned to each, the slots that are still missing soldiers,
and a banner telling him "מחלקה ג׳ יוצאת מחר — בדוק שיש כיסוי לסיור
24:00". He taps once: the system proposes three platoons that could
swap in. He picks one. The schedule re-renders. He moves on.

A מ״מ sees: his platoon's missions for the week, the slots he needs to
fill, and one button that opens the soldier-distribution prompt
("איך לחלק בתוך המחלקה?"). He picks "by squad". He confirms the engine's
recommendations. He hits publish. His soldiers see their shifts.

A soldier sees: his next shift, the time, the rally point, who's with
him, and a reminder option. If he's on standby for כוננות כרמל א, he
sees rally point + response instructions on his home page WITHOUT
navigating into mission details. He knows where to go.

### The constraint

The system is **opinionated about one thing above all**: the operator
remains in command. The system advises, warns, and resolves; it does
NOT enforce silently. Every block becomes a resolution flow with
choices, never a flat "אי אפשר".

---

## 2. What the system actually is

### Concrete stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build | Vite + TypeScript 5.x (strict + composite) |
| Routing | React Router v7 |
| Data fetching | React Query v5 (mostly idle; product runs off local state) |
| Styling | TailwindCSS — RTL Hebrew, mobile-first, custom design system in `src/components/ui/` |
| State | React Context (`AppContext.tsx`) + `usePersistedState` hook → `localStorage` |
| Backend | None active. Supabase scaffolding present (`api/_supabase.ts`); `USE_SUPABASE` flag is off in production. |
| Auth | Mock personas (`MockUser[]`) — switch identity via `UserSwitcher` chip in the header |
| Build command | `npm run build` = `tsc -b && vite build` |
| Deploy | Vercel auto-deploy from `origin/main` |
| Production URL | https://shabetz-na.vercel.app |

### The four layers, in concrete file terms

**1. Data layer.** `src/types/index.ts` (3,500+ lines) defines every
domain entity: `Mission`, `Soldier`, `Platoon`, `EscalationEvent`,
`PlatoonLeaveDay`, `CoverageRule`, etc. `src/data/mockData.ts` (~2,050
lines) seeds the company. The `usePersistedState<T>(slice, initial,
SEED_VERSION)` hook wires each slice to a localStorage key like
`ha-pluga-sheli:state:assignments:v1`.

**2. State layer.** `src/context/AppContext.tsx` (~2,575 lines) is the
single provider. Every mutation flows through here. The hooks
`useApp()`, `useMyCompany()`, `useMyPlatoons()`,
`useApprovableLeaveRequests()`, `useAlertsForCompany()` are the
canonical access points. The monolith is known tech debt; a 7-provider
fanout is planned (see §29).

**3. Engine layer.** Pure functions, no React, no `Date.now()` inside.

- `src/utils/engine/hardFilters.ts` — yes/no eligibility per soldier per slot
- `src/utils/engine/scoring.ts` — 0-100 per-candidate score, 5 dimensions
- `src/utils/engine/selector.ts` — picks N from scored pool, returns SelectorOutcome
- `src/utils/engine/burden.ts` — fairness-aware per-soldier burden
- `src/utils/engine/focus.ts` — "what does this user need to decide now"
- `src/utils/engine/defaults.ts` — engine default values
- `src/utils/materialize.ts` — the slot-truth materializer
- `src/utils/archetypeBehavior.ts` — the single funnel for archetype runtime decisions
- `src/utils/operationalTimeline.ts` — derives timeline events from state
- `src/utils/conflictResolution.ts` — detects + proposes resolutions
- `src/utils/missionImport.ts` — duplicate / import-from-order
- `src/utils/missionTemplates.ts` — template library + helpers
- `src/utils/missionArchetypes.ts` — the 5 archetype definitions
- `src/utils/persistedState.ts` — localStorage wrapper
- `src/utils/timeline.ts` — legacy platoon-only timeline (older)
- `src/utils/missionSummary.ts` — mission → human sentence

**4. UI layer.** Every page is lazy-loaded in `App.tsx`. The dashboard
router (`DashboardPage.tsx`) dispatches by role to one of four dashboard
variants:

- `dashboards/SoldierDashboard.tsx`
- `dashboards/PlatoonCommanderDashboard.tsx`
- `dashboards/CompanyCommanderDashboard.tsx`
- `dashboards/RasapDashboard.tsx`

Shared primitives in `src/components/ui/`: `Sheet`, `Button`, `Card`,
`Section`, `PageMain`, `Body`, `Muted`, `Hint`, `Eyebrow`, `PageTitle`,
`StatusPill`, `Toast`. Sheets used for every modal (StaffingSheet,
SquadDistributionSheet, MissionImportSheet, MissionTemplateLibrarySheet,
DeclareEmergencySheet, EndEmergencySheet, ChecklistRunSheet,
SlotOperationsSheet).

### Mental model

> Think of the system as a **command post**. The materializer is the
> board on the wall (the current and future state, painted by data
> not by humans). The engine is the staff officer who scores
> candidates and writes the recommendation with reasons. The UI is
> the operator's hands moving units on the board. The audit logs are
> the war diary.

### Render flow for a typical interaction

A מ״פ opens `/mission/:id`. What happens:

1. React Router resolves the route. `MissionDetailPage` mounts lazily.
2. The page calls `useApp()` to get `missions`, `platoons`, etc.
3. It calls `useMyCompany()` for company context.
4. It builds a `MaterializedSlot[]` for the mission via `materializeWeek(input)`. Memoized.
5. It calls `getArchetypeBehavior(mission)` → `{warnings, implementationStatus, ...}`. Memoized.
6. It renders the hero, the archetype panel, the staffing CTA, the timeline of slots, the notes section.
7. On click of a slot's "אייש": opens `StaffingSheet`.
8. `StaffingSheet` calls `useEngineContext()` → `EngineContext`.
9. `StaffingSheet` runs `selectCandidates(slot, candidatePool, ctx, {requiredCount, acceptForced: false})` → `SelectorOutcome`.
10. Operator confirms picks → `setSlotAssignment()` writes Assignment rows → `recordSelectorOutcome()` writes audit.
11. Re-render. Materializer reruns. Slot now shows as `'fully-staffed'`.

This is the operational loop, end-to-end. Every other interaction
(mission creation, leave-day toggle, emergency declaration) follows the
same shape: read snapshot → derive new state via pure helpers →
mutate AppContext → re-render.

---

## 3. Real-world platoon / company structure

If you don't internalize this section, you cannot make correct UX
decisions. The structures the product models are not generic
organization-chart shapes — they have specific operational meanings.

### The company (פלוגה)

A combat infantry company is one operational unit of ~75 soldiers
under a single מ״פ. The company is what this product centers on.
Larger units (battalion = גדוד) exist but are out of scope.

A typical company contains:

#### 3 combat platoons (מחלקות קרביות)

Named g1 / g2 / g3 in our seed data ("גימל 1", "גימל 2", "גימל 3").
Each platoon has ~18-22 soldiers.

- **מ״מ** (platoon commander / lieutenant) — commands the platoon. Has
  `commandedPlatoonId` set on the MockUser. Has permissions to staff
  his platoon's missions, approve platoon-level leave, publish the
  platoon's שבצ״ק.
- **סמל** (deputy / platoon sergeant) — second-in-command. Same
  operational scope as the מ״מ for most purposes. The role
  `platoonSergeant` and `platoonCommander` share permission tokens.
- **3 squads** (כיתות) per platoon: typically named א / ב / ג.
  Each ~6-8 soldiers.
- **מ״כ** per squad (squad commander) — commands the squad.
- **Specialist roles** (`OperationalRole`): קלע (sniper), נגביסט
  (machine gunner), קלע חוד / נגביסט חוד (lead variants), חובש
  (medic), מטוליסט (mortar), מאגיסט (anti-tank), קשר (signaler),
  רחפן (drone operator).

#### חפ״ק (forward-command)

A small mobile command team — typically 6-10 soldiers. NOT a fighting
platoon. NOT a unit that rotates. Has its own internal specializations
(קשר חפ״ק, אחראי ציוד חפ״ק).

In our seed: `g4` platoon kind `'forward-command'`.

#### מפלג (logistics platoon)

The unit that keeps the operation fed and equipped. Drivers, kitchen,
quartermaster (רס״פ + סרס״פ), equipment-leads. Doesn't rotate as a
unit.

In our seed: `g5` platoon kind `'logistics'`.

#### Company staff (סגל הפלוגה)

Not a platoon — individuals. Includes:
- מ״פ (company commander) — user `u1` in seed
- סמ״פ (deputy company commander) — `u2`
- שליש (adjutant) — `u3`
- מש״ק קשר (communications NCO)

### How a platoon rotates

The fundamental rotation unit is the platoon. "Combat platoon rotation"
means: the WHOLE platoon goes home for N days; then the WHOLE platoon
returns; then a different platoon goes home; cycle continues.

Common rhythms:
- **שבוע / שבוע** (week-on / week-off): one platoon home for 7 days
  while the other two cover; rotate weekly.
- **10 / 5**: 10 days in base, 5 days home. Longer cycle, more stable
  operationally but harder on soldiers.
- **8 / 7**: balanced — the IDF reserve typical.
- **One-home**: at any moment at most one platoon is home (the
  current default in our seed via `companyLeavePolicy.mode =
  'one-at-a-time'`).
- **Two-home**: aggressive — two platoons home concurrently. Requires
  fast call-up if anything happens.

The product models the rotation via `PlatoonLeaveDay` records: one
record per (date, platoon) pair with `status: 'home' | 'in-base' |
'partial'`. The leave board (`/coverage/platoons`) is where the מ״פ
toggles them.

### Why חפ״ק and מפלג are different

They cannot all go home at once — someone must run the operation.
חפ״ק keeps the company connected; מפלג keeps it fed. So they don't
rotate as a unit; they rotate per soldier with coverage constraints:

- "At least 3 חפ״ק members in base at any time"
- "At least 1 driver in base"
- "At least 1 רס״פ-functional-role in base"

These are expressed as `CoverageRule` records, not `PlatoonLeaveDay`.

### Squad-level rotation inside a combat platoon

Sometimes the מ״פ wants to **split a platoon**: half home, half base.
Or rotate squads within the platoon for a specific mission. This is
expressed via:
- `mission.rotation.kind = 'rotate-squads'` — for missions where the
  rotation is per-squad-per-day rather than per-platoon-per-week.
- `mission.squadPolicy.mode = 'no-mix' | 'specific'` — for missions
  where all soldiers must come from the same squad.
- `SoldierLeaveOverride` records for case-by-case individual exceptions.

### A typical day on the line

06:00 — Shift handover. Yesterday's guard goes off, today's goes on.
The PC's "ציר זמן פלוגתי" timeline shows the handover event.

06:30 — Patrol team checks out. Their slot is in StaffingSheet's
confirmed assignments.

08:00 — מ״פ briefs the company. (Not modeled in product.)

10:00 — A soldier from גימל 2 submits a leave request via his profile.
The PC sees it in his approvable list.

11:30 — The PC approves it. `Leave` record created. Materializer
re-runs. The soldier's slot for tomorrow night flips from "assigned"
to "open" (he's now `'on-leave'` during that window).

13:00 — Lunch. (Not modeled.)

14:00 — A coverage rule warning fires: "מחר מחלקה ב׳ בבית AND חוק
פיקוד שבור (אין מ״מ בבסיס)". The leave board cell rings warn-tone.

14:05 — מ״פ resolves the conflict: clicks "החלף ב־ג" on the conflict
card. Mission auto-updates `assignedPlatoonIds`. Warning clears.

16:00 — Night sentries get briefed. Rally point in their soldier
dashboard's MyReadinessCard.

22:00 — Night shift begins. Slot's `partOfDay` is `'night'`. Each slot
duration is 3h (vs day's 2h) — engine emits 3 night slots instead of
the day's 8.

03:30 — מ״פ phone vibrates. A real-world incident triggers him to
tap "🚨 הקפצה" on the FAB. Picks "all-company" audience. Reports in
15 minutes. The announcement goes out. The materializer's
`emergencyActive` flag flips. Every soldier in home stints is now
eligible — the PC can staff the response from anyone.

04:00 — Soldiers arrive. PC staffs an ad-hoc mission to cover the
event. The original guard mission's eligibility pool now includes
the home soldiers; no rejection.

09:00 — Event over. מ״פ taps the FAB ("סיים אירוע"). Recovery sheet:
"אילו משימות נפגעו", "מי דורש מנוחה", "חזרה: חלקית". The system
routes him to `/coverage/planning` to re-plan. Wizard runs. Outcome:
new policy, fresh `PlatoonLeaveDay` records, balance restored.

This is the operational workflow. Every step is data; every step is
reversible.

---

## 4. Operational doctrine the system encodes

These are the rules the system observes. Some are enforced by the
engine, some are surfaced as warnings, some are still data-only (see
§27 for the honest mock-vs-wired matrix).

### Doctrine the system understands

#### 1. The company runs on operational orders (צווים)

An `OperationalOrder` is the duty period the company is in. It has
`startDate`, `endDate`, `status: 'planning' | 'published' | 'archived'`,
and a `name` (e.g. "צו 12–18 במאי"). Missions can be attached to an
order via `mission.orderId` or remain "evergreen" (no order).

When the order is `'published'`, the schedule it implies is live —
soldiers see their slots in their dashboards.

The CC creates orders (`addOrder`), publishes them
(`setOrderStatus(id, 'published')`), and archives old ones. The
`/schedule` page is the order-management surface.

#### 2. Every mission has an archetype

5 archetypes, each with operational meaning:
- `static-guard`: fixed position, 24/7 or windowed, day/night-aware
- `patrol`: movement-based, forbids parallel assignment
- `readiness`: event-driven, allows parallel assignment, carries
  rally point + response instructions
- `one-time-op`: specific datetime, no scheduled-publish
- `custom`: operator-defined, no archetype rules

See §7 for full archetype behavior.

#### 3. Templates fill defaults; they do not skip questions

When the operator picks "שמירה בש״ג" from the template library, the
template populates `timeModel`, `manpower`, `command`, `rotation`,
`fatigue` defaults. But the operator still configures:
- Date range (when does THIS instance run)
- Hours (if not 24/7)
- Shift duration day vs night
- Manpower day vs night
- Whether a shift commander is required and at what rank
- Rotation kind + period
- Qualifications + equipment

The archetype's `hiddenSteps` array tells the wizard which steps to
skip. Phase 7.3 tightened this: only the character/intensity step is
hidden (because the archetype fixes that). Everything else stays
required.

#### 4. The PC owns staffing of HIS platoon's slots

The CC creates the mission and assigns it to platoons. The PC then
decides WHICH soldiers cover the slots. The squad-distribution prompt
asks the PC HOW to distribute: by squad, by multi-squad, specific
soldiers, or system recommendation.

The boundary is firm: CC controls assignment; PC controls staffing.
This maps to operational reality — the CC doesn't know which
individual soldier is best for tonight's shift, but his מ״מ does.

#### 5. A combat platoon rotates as a unit (with override paths)

When `PlatoonLeaveDay(date, platoonId) = 'home'`, the materializer
drops every soldier in that platoon from eligibility on that date.
Exceptions:
- `SoldierLeaveOverride(date, soldierId, 'in-base')` — pull this
  specific soldier back to in-base from a home platoon.
- An active `EscalationEvent` — bypasses all home filtering company-wide.
- Operator explicitly forces a soldier via `setSlotAssignment()` —
  the materializer respects persisted assignments verbatim.

#### 6. A readiness mission allows parallel assignment

`readiness.archetype.isEventDriven === true`. The `overlapPolicy`
populated by the archetype default permits standing-guard, admin, and
readiness intensities to coexist. The hardFilter
`hasTimeConflict` reads `getArchetypeBehavior(otherMission)
.effectiveOverlapPolicy.activeOverlap.includes(thisIntensity)` — both
sides must consent.

Operational meaning: a soldier on כוננות כרמל א can simultaneously
stand a 2-hour guard shift. The system permits both assignments. When
the readiness fires, the soldier abandons the guard and goes to the
rally point.

#### 7. A patrol mission FORBIDS parallel assignment

`patrol.archetype.isMovementBased === true`. The overlap rule
short-circuits to `false` — no other mission may share the soldier's
time. Operational meaning: a patrol team is moving; pulling a soldier
out mid-patrol breaks the team's integrity.

#### 8. Day vs night shifts can have different durations

`Mission.dayNightProfile.dayShiftDurationMinutes` vs
`nightShiftDurationMinutes`. When they differ AND archetype supports
day/night (static-guard), the materializer splits a 24/7 window into
day-segments + night-segments. A 24h window with day=120m / night=180m
becomes 8 day slots + 3 night slots.

Each split slot gets `partOfDay: 'day' | 'night'`. Downstream
consumers (burden math, scoring, UI tone) read this field.

#### 9. At any moment a commander must be in base

The `command-coverage` rule expresses "at least N of {מ״מ, סמל, מ״כ}
in base." Evaluator runs per-day on the leave board. Violations show
as ⚠ in the column header + warn-ring on the offending cells.

#### 10. Personal leave requests need slack

The `personal-leave-buffer` rule reserves N (or N%) of in-base
headcount for individual leave so the platoon rotation doesn't consume
the entire leave allowance. See §17.

#### 11. Some dates are operationally locked

`CompanyBlockedDate` records mark dates as `requireAllInBase: true` —
nobody goes home on a line-up day, a drill day, a major operation, an
inspection.

#### 12. הקפצה means "everyone in base"

When `EscalationEvent.status === 'active'`, the materializer treats
home as in-base. See §20.

### Doctrine the system does NOT yet encode

Honest list — these are real operational rules the system doesn't
model today:

- **Compensation accounting**: a soldier whose home leave was cut
  short by an emergency is OWED future leave. The burden math reflects
  the disrupted state but doesn't track the debt.
- **Sabbath / weekend doctrine**: beyond `noWeekendTransition` (no
  rotation changes on weekends), nothing models religious or
  practical weekend constraints.
- **שעות שירות limits**: the IDF has weekly/monthly hour caps per
  rank/role. Not enforced.
- **"Soldier X and Soldier Y must never patrol alone together"**
  beyond the generic `mutual-exclusion` rule kind.
- **Reservist leave doctrine**: מילואים have specific leave rights
  distinct from regular soldiers.
- **Multi-post static-guard**: today one mission = one set of slots.
  A real שער + מגדל-A + מגדל-B with different qualifications per post
  needs a richer `MissionManpowerSpec` (planned, not built).
- **Layered missions**: a guard mission that's also on כוננות. Today
  the operator creates two missions; a future `Mission.layers` field
  would let them coexist on one record.

The data model is extensible. Adding these is straight work, not
architectural redesign.

---

## 5. Roles and permissions

### Base roles

Defined in `src/types/index.ts` as the `UserRole` union.

#### `companyCommander` (מ״פ)

The owner of the company. Full operational authority.

Daily actions:
- Create operational orders (צווים)
- Create missions; assign to platoons
- Declare and close emergencies
- Approve company-level leaves
- Edit the leave-planning policy
- View Report1 (company state)
- View all alerts
- Edit coverage rules
- Manage delegations

In our seed: `u1` (מאיר רובין).

#### `deputyCommander` (סמ״פ)

Same operational scope as CC. Same permission tokens. Differentiated
by role label only.

In our seed: `u2` (יואב הולצמן).

#### `platoonCommander` (מ״מ)

Owns a platoon. Has `commandedPlatoonId` set on the MockUser.

Daily actions:
- Staff his platoon's assigned missions (StaffingSheet)
- Approve platoon-level leave requests
- Publish the platoon's שבצ״ק when there are changes
- Create platoon-scoped missions (quick-create at
  `/platoon/missions/new`)
- See his platoon's timeline + operational pressure
- Update soldier roles / functional roles
- Set per-soldier leave overrides

In our seed: `u4` (אורי לוי, מ״מ של גימל 2), `u5`, `u11`.

#### `platoonSergeant` (סמל)

Effectively a deputy מ״מ. Shares `PLATOON_LEADERSHIP_TOKENS`. Renders
PlatoonCommanderDashboard like the מ״מ.

In our seed: `u6`.

#### `soldier` (חייל)

The default role. Reads their own state. Submits leave requests.

Daily actions:
- See next shift + reminder
- See current status + countdown to next leave / base return
- See readiness inline card (when assigned)
- See announcements
- Submit leave request
- Update status (in-base / home / inactive)

In our seed: `u7`, `u8`, `u9`, `u14`.

### Functional roles

A user's `Soldier.functionalRoles[]` carries machine-readable codes
(`'driver'`, `'rasap'`, `'shalish'`, `'kitchen-lead'`, etc.). Some
functional roles grant additional permissions:

- **רס״פ** (`isRasap(user)`): renders the RasapDashboard. Grants
  `'rasap.viewInventory'`, `'logistics.viewAll'`, `'report.viewPlatoonState'`,
  etc. Has read-access to Report1.
- **שליש** (`isShalish(user)`): grants `'report.viewCompanyState'` (read).
  Sees alerts.

These grants are **READ-only**. They never confer
write authority (mission creation, escalation declaration, leave-cycle
edit) — those still require base CC/Deputy roles.

### Permission tokens

`src/utils/permissions.ts` defines a `PermissionToken` union with
strings like:
- `'mission.create.company'`, `'mission.create.platoon'`
- `'leave.approve.platoon'`, `'leave.approve.company'`
- `'escalation.declare'`, `'escalation.respond'`, `'escalation.collectStatus'`
- `'logistics.signOut'`, `'logistics.signIn'`, `'logistics.viewAll'`
- `'rasap.viewInventory'`, `'rasap.signOut'`, `'rasap.return'`,
  `'rasap.markDamaged'`, `'rasap.resolveGap'`
- `'announcement.create'`, `'leaveCycle.edit'`
- `'comm.send.platoon'`, `'comm.send.company'`
- `'delegation.grant'`
- `'report.viewPlatoonState'`, `'report.viewCompanyState'`
- `'combatClock.publish'`, `'combatClock.fillBlock'`
- `'schedule.create'`, `'schedule.edit'`

Each base role has a default token set (`COMPANY_LEADERSHIP_TOKENS`,
`PLATOON_LEADERSHIP_TOKENS`, `RASAP_TOKENS`).

### Delegations

Permissions can ALSO be granted via:

- **`Delegation`** — old-style. Used for delegating a role temporarily.
- **`CommandDelegation`** — new, time-bounded. "From X to Y, give Y the
  role of CC for the duration X→Y." Surfaced via:
  - `DelegationBanner` (top of every page when active)
  - The hamburger menu (when present)
  - Permission gates (`canDeclareEscalation(user, delegations)` returns
    true for the delegate during the active window)

### How to check a permission

**Always use the helper, never the role directly:**

```ts
canDeclareEscalation(user, delegations)
// === hasPermission(user, 'escalation.declare', undefined, delegations)
```

The helper handles base role + functional role grants + active
delegations. Checking `currentRole === 'companyCommander'` directly
breaks delegations and is a regression bug waiting to happen.

### Permission helper inventory

| Helper | Returns true for |
|---|---|
| `isCompanyLeadership(role)` | CC, Deputy CC |
| `isPlatoonLeadership(role)` | PC, Sergeant |
| `isRasap(user)` | Has functional role `'rasap'` |
| `isShalish(user)` | Has functional role `'shalish'` |
| `canCreateMission(user, delegations)` | CC, PC, or delegate |
| `canDeclareEscalation(user, delegations)` | CC, Deputy CC, or delegate |
| `canViewReport1(user, delegations)` | CC, Deputy CC, Rasap, Shalish |
| `canApproveLeaveFor(user, leaveRequest, delegations)` | PC of the relevant platoon, CC |
| `canCreateAnnouncement(user, delegations)` | CC, PC |
| `canEditLeaveCycle(user, delegations)` | CC, Deputy CC |
| `canEditMission(user, mission, delegations)` | Mission owner role + delegate |
| `getMissionCreateScope(user, delegations)` | `{companyWide, allowedPlatoonIds}` |

---

## 6. The mission system

The `Mission` shape is the central operational object. Read it carefully.

### Identity

```ts
{
  id: string;                 // 'mi-' prefix via newId('mi')
  companyId: string;
  name: string;               // "שמירה בש״ג"
  description?: string;
  createdByUserId: string;
  ownerRole: 'company' | 'platoon';
  orderId?: string;           // optional link to operational order
  assignedPlatoonIds: string[]; // empty until assignment step runs
}
```

### Behavioral policy (composable)

#### `timeModel`

A discriminated union:

```ts
type MissionTimeModel =
  | { kind: '24-7-continuous' }
  | { kind: 'fixed-hours'; windows: FixedHourWindow[] }
  | { kind: 'one-time'; start: string; end: string }
  | { kind: 'on-demand' }
  | { kind: 'daily-variable'; perDate: Record<string, FixedHourWindow[]> };
```

- `24-7-continuous`: the mission runs all the time. Materializer emits
  one all-day slot per date (or splits by day/night if archetype
  demands).
- `fixed-hours`: runs in defined windows (e.g. 22:00–04:00, every day).
  Each window has `startTime`, `endTime`, `shiftDurationMinutes`,
  `recurring: 'every-day' | { daysOfWeek: number[] }`.
- `one-time`: runs once, between specific ISO timestamps.
- `on-demand`: only when activated. Used by readiness. Materializer
  emits NO slots for on-demand missions unless an `EscalationEvent`
  triggers (today: not auto-triggered; soldiers go via the announcement).
- `daily-variable`: per-date custom windows.

#### `manpower`

```ts
type MissionManpowerSpec =
  | { kind: 'exact'; count: number }
  | { kind: 'range'; min: number; ideal?: number; max?: number }
  | { kind: 'window-varies'; windows: { label, from, to, spec }[] };
```

`window-varies` is how day-vs-night manpower is expressed for a 24/7
mission. The `spec` per-window can be `exact` or `range`. The
materializer's `manpowerForVarying()` picks the right window for the
slot's start time.

#### `command`

```ts
{
  fieldCommandRequired: boolean;
  commandersPerSlot: number;
  commanderCountsAsManpower: boolean;
  rankPolicy: Record<CommandRank, 'commander-only' | 'regular' | 'excluded'>;
}
```

`rankPolicy` for each `CommandRank` (`'soldier' | 'mk' | 'samal' | 'mam' | 'officer' | 'custom'`):
- `commander-only`: this rank can only fill the commander slot
- `regular`: this rank can fill any slot
- `excluded`: this rank is barred from the mission

#### `rotation`

```ts
type MissionRotation =
  | { kind: 'fixed-platoon'; platoonId: string }
  | { kind: 'rotate-platoons'; period: RotationPeriod; order?: string[] }
  | { kind: 'rotate-squads'; period: RotationPeriod }
  | { kind: 'whichever-strongest' }
  | { kind: 'returning-from-home' }
  | { kind: 'manual' };

type RotationPeriod = 'daily' | 'weekly' | 'biweekly' | 'monthly';
```

The materializer's `resolveRotation(rotation, day, platoons)` picks
the `ownerPlatoonId` for each slot:
- `fixed-platoon`: always the same platoon
- `rotate-platoons`: cycle through `order` (or `platoons` if no order)
  with the given period
- `rotate-squads`: cycle through squads of the assigned platoon
- `whichever-strongest`: pick by engine — currently a stub returning
  first platoon
- `returning-from-home`: pick the platoon that just returned from home
  stint
- `manual`: returns null; auto-pick is suppressed

#### `fatigue`

```ts
{
  intensity: 'standing-guard' | 'active-patrol' | 'ambush' | 'readiness' | 'admin' | 'passive';
  impactsSleep: boolean;
  sleepWindowHours?: number;
  minRestAfterHours: number;
  fatigueWeight: number; // 0-10
}
```

The `intensity` is read by burden math and overlap policy. The
`fatigueWeight` is read by burden math directly (hard-hour threshold).
The `minRestAfterHours` drives the scoring fatigue dimension.

Default intensities by archetype:
- static-guard: `'standing-guard'`, weight 3
- patrol: `'active-patrol'`, weight 7
- readiness: `'readiness'`, weight 2
- one-time-op: typically `'ambush'`, weight 8

#### `cycleProfile` (24/7 missions only)

```ts
{ guardMinutes: number; restMinutes: number; standbyMinutes?: number }
```

The guard-rest rhythm. Drives sustained-manpower math:
`shiftsPerCycle = ceil((guard + rest) / guard)`, sustained
manpower = `requiredCount × shiftsPerCycle`.

`standbyMinutes` is only relevant for readiness archetype.

#### `overlapPolicy`

```ts
{
  activeOverlap: MissionIntensity[];
  restOverlap: MissionIntensity[];
}
```

`activeOverlap`: while actively on this mission, which other mission
intensities is this soldier permitted to also be on?

`restOverlap`: while in the rest portion of this mission's cycle,
which other intensities are permitted?

For patrol: both arrays empty (forbids all overlap).
For readiness: `['standing-guard', 'admin', 'readiness']` — explicitly
allows.

The hardFilter `hasTimeConflict` reads this via
`getArchetypeBehavior(mission).effectiveOverlapPolicy`.

### Constraints

```ts
{
  conflictsWith: string[];     // mission ids that can't run simultaneously
  canOverlapWith: string[];    // explicit allowances
  pairings: SoldierPairing[];  // pairing rules
  squadPolicy: { mode: 'mix' | 'no-mix' | 'specific'; allowedSquadIds? };
  qualifications: { qualificationId, level: 'soft'|'required'|'critical' }[];
  equipment: { equipmentItemId, level: 'soft'|'required'|'critical' }[];
  requiresDailyConfirmation: boolean;
}
```

- `qualifications[].level = 'critical'`: hard filter. Missing critical
  qualification rejects the soldier outright.
- `equipment[].level = 'critical'`: same for equipment.

### Lifecycle

```ts
MissionStatus =
  | 'draft'
  | 'active-unstaffed'
  | 'assigned-to-platoon'
  | 'staffing-pending'
  | 'partially-staffed'
  | 'staffed'
  | 'active'
  | 'paused'
  | 'archived';
```

Typical transitions:

```
[CREATE]                → 'active-unstaffed'
[ASSIGN]                → 'assigned-to-platoon' OR 'staffing-pending'
[PARTIAL FILL]          → 'partially-staffed'
[FULL FILL]             → 'staffed'
[PUBLISH/GO LIVE]       → 'active'
[PAUSE]                 → 'paused'
[REVERT TO DRAFT]       → 'draft'
[END / ORDER ARCHIVED]  → 'archived'
```

In practice the materializer doesn't enforce these transitions — they
come from operator actions. The CC's ToggleChip row on a mission row
sets status directly.

### Phase 7.3 archetype-layer fields

```ts
{
  archetypeKind?: MissionArchetypeKind;
  dayNightProfile?: DayNightProfile;
  allowPCOverride?: boolean;
  shiftDurationLocked?: boolean;
  rallyPoint?: string;             // readiness
  routeDescription?: string;        // patrol
  hasVehicle?: boolean;
  responseInstructions?: string;    // readiness
  responseTeams?: ReadinessResponseTeam[]; // readiness split teams
}
```

`ReadinessResponseTeam` shape:

```ts
{
  id: string;
  name: string;
  rallyPoint?: string;            // per-team override
  targetCount: number;
  selectionMode: 'soldiers' | 'squad' | 'role';
  soldierIds?: string[];          // when mode='soldiers'
  squadId?: string;               // when mode='squad'
  operationalRole?: OperationalRole; // when mode='role'
  instructions?: string;          // per-team override
}
```

The soldier-facing readiness card resolves "your team" by checking
the three modes in priority order: explicit soldierIds first, then
squad match, then role match.

### Engine signals

```ts
{
  difficulty?: 'standard' | 'hard' | 'critical';
  fatigueOverride?: FatiguePolicy;
}
```

`difficulty` is the burden-math input for "this mission is harder than
its archetype suggests." Phase 7.3 burden math primarily reads
`slot.effectiveFatigueWeight` but still checks `mission.difficulty`
as a secondary signal.

`fatigueOverride` allows the mission to override the company's
default fatigue policy.

---

## 7. Archetypes — the behavioral classifier

The most important architectural decision in Phase 7.3.

### The five archetypes

#### `static-guard` (שמירה סטטית)

**What it is**: Fixed-position guard duty at a defined spot. The
classic שער / מגדל / נצפ״ה.

**Operational examples**:
- שמירה בש״ג (shift commander's gate guard)
- שמירה במגדל 7
- שמירה בעמדה היקפית

**Behavior flags**:
- `isMovementBased: false`
- `isEventDriven: false`
- `supportsDayNight: true` — different shift duration / manpower day vs night
- `supportsRallyPoint: false`
- `supportsRoute: false`
- `supportsVehicle: false`
- `supportsResponseInstructions: false`
- `supportsScheduledPublish: true`

**Default draft**:
- `timeModel: { kind: '24-7-continuous' }`
- `manpower: { kind: 'window-varies', windows: [{day: 1}, {night: 2}] }`
- `rotation: { kind: 'rotate-platoons', period: 'weekly' }`
- `fatigue: { intensity: 'standing-guard', minRestAfterHours: 6, fatigueWeight: 3 }`
- `dayNightProfile: { dayShiftDurationMinutes: 120, nightShiftDurationMinutes: 180 }`
- `allowPCOverride: true`
- `shiftDurationLocked: false`

**Hidden steps**: `[2]` — character is fixed at standing-guard. The
operator still configures everything else.

**Engine effect**: when `dayShiftDurationMinutes !== nightShiftDurationMinutes`,
the materializer splits 24/7 windows into day-segments + night-segments.
A static guard at שער with day=120m, night=180m emits 11 slots/day.

#### `patrol` (סיור)

**What it is**: Movement-based duty in a sector or along a route.

**Operational examples**:
- סיור לילה (night patrol)
- סיור רכוב (vehicle patrol)
- סיור גזרה
- מחסום נייד

**Behavior flags**:
- `isMovementBased: true`
- `isEventDriven: false`
- `supportsDayNight: true`
- `supportsRoute: true`
- `supportsVehicle: true`
- `supportsResponseInstructions: false`
- `supportsScheduledPublish: true`

**Default draft**:
- `timeModel: { kind: 'fixed-hours', windows: [{ 06:00→22:00, shift=240m }] }`
- `manpower: { kind: 'exact', count: 4 }`
- `command: { fieldCommandRequired: true, commandersPerSlot: 1, rankPolicy: סמל commander-only }`
- `rotation: { kind: 'rotate-squads', period: 'daily' }`
- `fatigue: { intensity: 'active-patrol', minRestAfterHours: 8, fatigueWeight: 7 }`
- `overlapPolicy: { activeOverlap: [], restOverlap: [] }` — forbids everything

**Hidden steps**: `[2]`.

**Engine effect**: the `forbidsParallelAssignment` flag short-circuits
the overlap check — no other mission may share the soldier's time.

#### `readiness` (כוננות)

**What it is**: Event-driven duty. The soldier is "available" but not
actively doing the mission until it fires.

**Operational examples**:
- כוננות כרמל א (primary response team)
- כוננות כרמל ב (backup response team)
- כוננות הקפצה (rapid response)
- צוות תגובה מיידי

**Behavior flags**:
- `isMovementBased: false`
- `isEventDriven: true`
- `supportsDayNight: false` — readiness is typically uniform
- `supportsRallyPoint: true`
- `supportsResponseInstructions: true`
- `supportsScheduledPublish: true`

**Default draft**:
- `timeModel: { kind: '24-7-continuous' }`
- `manpower: { kind: 'exact', count: 4 }`
- `command: { fieldCommandRequired: true, rankPolicy: סמל + מ״מ commander-only }`
- `rotation: { kind: 'rotate-platoons', period: 'daily' }`
- `fatigue: { intensity: 'readiness', fatigueWeight: 2 }`
- `overlapPolicy: { activeOverlap: ['standing-guard', 'admin', 'readiness'], restOverlap: [...] }`

**Hidden steps**: `[2]`.

**Engine effect**:
- Overlap consent: readiness explicitly permits stacking with
  standing-guard, admin, and other readiness intensities.
- Soldier-facing: when a soldier is on (or imminent ≤12h on) a
  readiness mission, the soldier dashboard shows `MyReadinessCard`
  with rally point + team-specific instructions inline.
- Response teams: if `mission.responseTeams` is populated, the
  soldier's "your team" is resolved by selectionMode (soldiers /
  squad / role).

#### `one-time-op` (מבצע חד-פעמי)

**What it is**: A mission with a specific datetime window. No
recurring schedule.

**Operational examples**:
- אבטחה לאירוע
- מבצע קצר במיוחד
- ליווי גמ״ש
- שיגור הלינתי לתעוז דרום

**Behavior flags**:
- `supportsDayNight: true`
- `supportsVehicle: true`
- `supportsResponseInstructions: false`
- `supportsScheduledPublish: false` — one-time, no recurring publish

**Default draft**:
- `timeModel: { kind: 'fixed-hours', windows: [{ 08:00→14:00, shift=360m }] }`
- `manpower: { kind: 'exact', count: 6 }`
- `command: { rankPolicy: סמל + מ״מ + officer commander-only }`
- `rotation: { kind: 'manual' }` — operator picks specific platoons
- `fatigue: { intensity: 'ambush', impactsSleep: true, minRestAfterHours: 10, fatigueWeight: 8 }`
- `allowPCOverride: false` — CC retains control
- `shiftDurationLocked: true` — duration is fixed

**Hidden steps**: `[2]`.

#### `custom` (אחר/מותאם)

**What it is**: Operator-defined. No archetype rules apply.

**Hidden steps**: `[]` — full wizard, no shortcuts.

### The principle: templates fill defaults; they do NOT skip questions

A template populates the archetype default draft. But the OPERATOR
still configures everything that needs per-instance decisions:

- When the mission runs (date range, hours)
- Day vs night durations
- Day vs night manpower
- Whether a shift commander is required
- Rotation policy
- Qualifications + equipment

The archetype's `hiddenSteps` array on `MissionArchetype` says which
wizard steps to skip. Phase 7.3 tightened this:

- Before: static-guard hid `[2, 3]` (character + timing) — too much.
- After: static-guard hides `[2]` only (just character).

The principle: only hide questions the archetype TRULY answers.

### The behavior helper — `src/utils/archetypeBehavior.ts`

The single funnel between an archetype's static declaration and
runtime decisions. Exports:

```ts
function getArchetypeBehavior(mission: Mission): ArchetypeBehavior {
  return {
    kind,
    splitsByDayNight,
    dayShiftMinutes, nightShiftMinutes,
    dayMinCount, nightMinCount,
    allowsParallelAssignment, forbidsParallelAssignment,
    fatigueIntensity, fatigueWeight, nightFatigueBoost,
    effectiveOverlapPolicy,
    supportsScheduledPublish,
    warnings,           // computed per-mission ("missing rally point" etc.)
    implementationStatus, // honest "wired/partial/todo" map
  };
}

function splitDayNightWindows(start, end, behavior): DayNightSegment[];
```

The clean-engine invariant: **NO `archetypeKind === 'x'` checks live
outside this file.** Every other module reads `getArchetypeBehavior()`
output and consumes the resolved values.

### Honest implementation status

`getArchetypeBehavior(mission).implementationStatus` returns a per-
behavior map:

```ts
{
  slotSplitting:      'wired' | 'partial' | 'todo',
  fatigueWeighting:   'wired' | 'partial' | 'todo',
  overlapEnforcement: 'wired' | 'partial' | 'todo',
  parallelAllowance:  'wired' | 'partial' | 'todo',
  responseSurface:    'wired' | 'partial' | 'todo',
  warningSurface:     'wired' | 'partial' | 'todo',
}
```

The MissionDetailPage renders this as the "מצב מימוש בפועל" panel for
the CC. Adding a new behavior to the engine REQUIRES updating
`computeStatus()` in archetypeBehavior.ts to reflect what's actually
enforced. **Lying here is what we promised not to do.**

Current state (as of 2026-05-17):

| Behavior | static-guard | patrol | readiness | one-time-op | custom |
|---|---|---|---|---|---|
| slotSplitting | wired | todo | todo | todo | wired |
| fatigueWeighting | wired | wired | wired | wired | wired |
| overlapEnforcement | wired | wired | wired | wired | wired |
| parallelAllowance | wired | wired | wired | wired | wired |
| responseSurface | wired | wired | partial | wired | wired |
| warningSurface | wired | wired | wired | wired | wired |

The partial in readiness's responseSurface: the dashboard inline card
exists, but a dedicated `/readiness/:missionId` soldier page (with
live activation status, map, team listing) is not built.

### Archetype warnings — computed per mission

`getArchetypeBehavior(mission).warnings` returns a list of
`ArchetypeWarning` records:

```ts
{ severity: 'error' | 'warn' | 'info', code: string, message: string }
```

Example warnings:
- `error`: "משימת כוננות בלי הוראות תגובה — לא יוצגו לחיילים בעת אירוע"
  (when archetype is readiness + `responseInstructions` is blank)
- `warn`: "משימת כוננות בלי נקודת ריכוז — חיילים לא יידעו לאן להתייצב"
- `warn`: "סיור בלי מסלול / סקטור מוגדר — קשה לתדרך את הצוות"
- `warn`: "מבצע חד-פעמי בלי תאריך התחלה/סיום — חלון זמן לא מובהק"

These render on the MissionDetailPage as a tonal ribbon. The operator
sees the gap and can fix it inline.

---

## 8. Creation vs Assignment vs Staffing — three different acts

The single most-asked clarification. These are NOT the same operation.
Conflating any two produces worse UX.

### 1. Creation — defining the mission

**Who**: CC (for `ownerRole: 'company'`) or PC (for `'platoon'`).

**Where**: `/missions/new` — the full wizard. Or via the template
library at `/missions` or `/schedule` ("+ בחר מתבנית" → create from
template).

**What is decided here**:
- Archetype kind
- Mission name
- Archetype-specific lightweight fields (rally point / route /
  response instructions)
- `timeModel` (when does it run)
- `manpower` (how many per shift)
- `command` (does it need a shift commander, at what rank)
- `rotation` (how does ownership rotate)
- `qualifications` + `equipment` (what's required)
- `overlapPolicy` (filled from archetype default; editable)
- `dayNightProfile`, `cycleProfile` if applicable

**What is NOT decided here**:
- Which platoons own it (assignment)
- Which soldiers staff each slot (staffing)

**Output**: a `Mission` row with empty `assignedPlatoonIds: []` and
status `active-unstaffed`. Auto-redirect to `/missions/:id/assign`.

### 2. Assignment — choosing which platoons own it

**Who**: CC (or PC if `ownerRole === 'platoon'`).

**Where**: `/missions/:id/assign` — `MissionAssignPage`. Mandatory
step after creation; reachable later via "שיוך מחלקות" on
MissionDetailPage.

**What is decided here**:
- Which platoons own this mission (`assignedPlatoonIds`)
- Conflict resolution if any selected platoon is on home stint during
  the mission window

**Conflict resolution flow runs HERE.** When a chosen platoon is
home during the mission's date window, the page shows a ConflictCard
with 6 actions: add a backup platoon, swap with available, keep this
platoon in base (override leave), partial leave, open leave board,
allow anyway.

**Output**: `mission.assignedPlatoonIds` is set; status may transition
to `assigned-to-platoon` or `staffing-pending`.

### 3. Staffing — picking specific soldiers per slot

**Who**: PC of the assigned platoon.

**Where**: `/platoon/missions` → click "אייש" on a slot → optional
SquadDistributionSheet → StaffingSheet.

**What is decided here**:
- For EACH SLOT (date × window × mission), which specific soldiers
  fill it
- For commander slots: which specific soldier is the commander
- Optional: how to distribute across squads (whole platoon / one
  squad / multi-squad / specific soldiers / system recommendation)

**Output**: `Assignment` records (one per slot per soldier) +
`SelectorOutcomeRecord` audit entries.

### Why the separation matters

If you merge any two, the UX gets worse:

- **Merge creation + assignment**: every mission's wizard asks "which
  platoons" before the operator knows the mission's character. Wrong
  question at the wrong time. The wizard loses focus.
- **Merge assignment + staffing**: a CC who only wants to drop a
  mission to a platoon for the PC to staff is forced to pick
  individual soldiers. Wrong role at the wrong moment. The CC has no
  knowledge of which soldier is best for tonight.
- **Merge all three**: you get the original Excel sheet.

The current product enforces the separation cleanly. Step 1 of the
wizard does NOT ask for platoon assignment. The wizard's post-publish
redirect lands on the assign page. The assign page has no soldier
picker — only platoon selection + conflict resolution.

**Do not regress.**

### Concrete example walkthrough

**Goal**: create "סיור לילה" for the next 7 days, assign to גימל 2,
have the PC of גימל 2 staff each slot.

**Step 1 — Creation (CC)**:
1. Open `/schedule`, scroll to the selected order's missions section.
2. Click "+ בחר מתבנית". Library opens.
3. Filter by "סיורי לילה" family chip. Pick "סיור לילה".
4. Form opens with defaults pre-filled. Change name to "סיור לילה -
   שבוע 12 מאי".
5. Date range: 2026-05-12 → 2026-05-18.
6. Platoons: none (no platoon picker — assignment is next).
7. Click "צור משימה". Mission row written with empty assignedPlatoonIds.
8. Auto-redirect to `/missions/:id/assign`.

**Step 2 — Assignment (CC)**:
1. Page shows mission summary (read-only) + platoon chips.
2. Click "גימל 2". Chip turns olive.
3. The leave board shows גימל 2 home days 11-14. The mission window
   (12-18) overlaps days 12-14.
4. Conflict card appears: "גימל 2 בבית 3 ימים (2026-05-12 – 2026-05-14)
   בחלון המשימה."
5. 6 resolution chips shown. CC clicks "⇄ החלף ב־גימל 3".
6. גימל 2 chip removed; גימל 3 added. Conflict card collapses to
   "✓ נפתר — הוחלפה מחלקה".
7. Click "שמור שיוך". Mission updated. Routes to MissionDetailPage.

**Step 3 — Staffing (PC of גימל 3)**:
1. Switch user to u5 (מ״מ של גימל 3) via the UserSwitcher.
2. Open `/platoon/missions`. The new "סיור לילה" mission appears with
   "חדש" badge.
3. Click "אייש" on the first night's slot.
4. SquadDistributionSheet opens. PC picks "by squad" → "כיתה ב".
5. StaffingSheet opens. Engine has scored the soldiers from squad ב.
   Top 4 + 1 commander suggested.
6. PC reviews. Reads the explainability strings ("23 שעות מנוחה",
   "כל הכישורים הנדרשים"). Confirms.
7. `Assignment` rows written. `SelectorOutcomeRecord` written.
   Slot status: `'fully-staffed'`.

**Step 4 — Publishing (PC)**:
1. After staffing several slots, the publish CTA appears on
   `/platoon/missions`: "פרסם שבצ״ק לחיילים".
2. Click. Announcement written to audience platoon=g3. Soldiers see
   the update in their dashboards.

This is the canonical flow. Every other mission goes through the same
shape.

---

## 9. The staffing engine (selector + scoring + hard filters)

Lives in `src/utils/engine/`. Pure functions, no React, no `Date.now()`.
Replays deterministically given the same input.

### Pipeline

```
candidatePool  →  hardFilters  →  score (per dimension)  →  select (clean vs forced)
```

Each soldier-slot pair flows through. The selector returns picked,
alternates, and forced candidates plus an immutable SelectorOutcome
that is persisted as the staffing audit record.

### Hard filters — `src/utils/engine/hardFilters.ts`

`evaluateHardFilters(soldier, slot, ctx) => HardFilterCode[]`. Empty
array = pass. Non-empty = candidate is NOT in the clean pool by
default; operator may override.

Codes:
- `'soldier-inactive'` — `Soldier.status !== 'active'` or `currentStatus === 'inactive-temp'`
- `'soldier-home'` — `currentStatus === 'home'`
- `'on-leave'` — overlapping `Leave` record
- `'duty-exclusion'` — overlapping `DutyExclusion` (medical, course, etc.)
- `'wrong-platoon'` — soldier's platoon not in `mission.assignedPlatoonIds`
- `'missing-qualifications'` — missing any qualification with
  `level: 'required'` or `'critical'`
- `'squad-policy-violation'` — soldier's squad disallowed by mission's
  `squadPolicy`
- `'time-conflict'` — overlapping commitment to another mission slot
- `'critical-equipment-missing'` — missing any equipment with
  `level: 'critical'`

`hasTimeConflict()` is the engine's overlap enforcement. Reads
`ctx.allSlots` (provided by `useEngineContext` from the materializer)
for ANY other slot the soldier is assigned to whose `[start, end)`
window overlaps. Applies the symmetrical archetype consent rule:

```ts
function isOverlapPermitted(a, b) {
  const aBehavior = getArchetypeBehavior(a);
  const bBehavior = getArchetypeBehavior(b);
  if (aBehavior.forbidsParallelAssignment) return false;
  if (bBehavior.forbidsParallelAssignment) return false;
  return aBehavior.effectiveOverlapPolicy.activeOverlap.includes(b.fatigue.intensity)
      && bBehavior.effectiveOverlapPolicy.activeOverlap.includes(a.fatigue.intensity);
}
```

Patrol's `forbidsParallelAssignment` short-circuits. Readiness's
explicit allow-list permits standing-guard + admin + readiness
co-assignment.

### Scoring — `src/utils/engine/scoring.ts`

`scoreCandidate(soldier, slot, ctx) => CandidateScore`. Five
dimensions, each 0-100, blended:

```
score =  0.30 × load
       + 0.25 × fatigue
       + 0.20 × qualMatch
       + 0.15 × cohesion
       - 0.10 × burdenPenalty × burden  (NEGATIVE — burden hurts)
```

Plus a soft pin bonus (+10 to +15) that reorders WITHIN a partition
but never lifts a forced candidate into the clean pool.

#### Dimension: `load`

```ts
ratio = soldier.currentLoad / max(1, ...platoonSoldiers.map(s => s.currentLoad));
value = clamp((1 - ratio) * 100, 0, 100);
explain = `עומס ${soldier.currentLoad} (מקסימום במחלקה ${maxLoad})`;
```

Lower load = higher score. Normalized against the platoon max.

#### Dimension: `fatigue`

```ts
slotLengthHours = (slot.end - slot.start) / 1h;
requiredRest = resolveRequiredRestHours(ctx.fatiguePolicy, slotLengthHours, ctx.modeProfile.fatigueRestMultiplier);

// Find the soldier's most recent slot END before this slot's START.
lastShiftEndMs = scan ctx.allSlots for soldier-assigned slots, pick max(end < slot.start);
hoursSince = (slot.start - lastShiftEndMs) / 1h;

if (hoursSince >= requiredRest)  { value = 100; explain = `${floor(hoursSince)} שעות מנוחה (נדרש ${requiredRest})`; }
else if (hoursSince > 0)         { value = clamp(hoursSince / requiredRest * 100, 0, 100);
                                   explain = `רק ${floor(hoursSince)} שעות מנוחה (חסר ${ceil(requiredRest - hoursSince)})`; }
else                             { value = 0; explain = `אין מנוחה — עייפות חריגה`; }
```

Reads `ctx.allSlots` (provided by `useEngineContext`) to find the
real last-shift time. Fallback for replay/test contexts without
allSlots: 24h-back stub.

#### Dimension: `qualMatch`

```ts
mission = ctx.missions.find(m => m.id === slot.missionId);
if (!mission || mission.qualifications.length === 0)
  return { value: 50, explain: 'אין דרישות הכשרה' };

soldierQuals = new Set(ctx.qualifications.filter(q => q.soldierId === soldier.id).map(q => q.qualificationId));
required = mission.qualifications.map(r => r.qualificationId);
matched = required.filter(id => soldierQuals.has(id)).length;
extra = soldierQuals.size - matched;

if (matched < required.length)
  return { value: 0, explain: `חסר ${required.length - matched} מתוך ${required.length} כישורים נדרשים` };

value = clamp(50 + min(extra, 5) * 10, 50, 100); // +10 per extra qual, cap at 100
explain = extra > 0 ? `כל הכישורים הנדרשים + ${extra} נוספים` : `כל הכישורים הנדרשים`;
```

Full match → 50. Extra quals → +10 per (cap 5). Anti-waste of
versatility (using a highly-qualified soldier on a basic task) is
handled elsewhere.

#### Dimension: `cohesion`

```ts
mission = ctx.missions.find(m => m.id === slot.missionId);
alreadyPicked = ctx.alreadyPickedForSlot ?? [];

if (alreadyPicked.length === 0)
  return { value: 80, explain: 'משבצת ריקה — אין השפעת לכידות' };

if (mission?.squadPolicy.mode === 'mix')
  return { value: 50, explain: 'מדיניות mix — כל כיתה מתאימה' };

firstPicked = ctx.soldiers.find(s => s.id === alreadyPicked[0]);
if (soldier.squadId === firstPicked.squadId)
  return { value: 100, explain: `אותה כיתה (${firstPicked.squadId})` };

return { value: 30, explain: 'כיתה שונה מהמשבצת' };
```

Cohesion encourages same-squad soldiers in the same slot when squad
policy allows.

#### Dimension: `burden` (penalty)

```ts
burden = ctx.burdens[soldier.id];
if (!burden) return { value: 0, explain: 'אין נתוני שחיקה — מתעלם' };
return { value: burden.burdenScore, explain: burden.headline };
```

`burden.burdenScore` is 0-100 from `burden.ts`. Subtracted from
final score.

### Pin bonus

```ts
function computePinBonus(soldier, slot, ctx) {
  const pins = ctx.priorityPins ?? [];
  const nowMs = Date.parse(ctx.computedAt);
  const active = pins.filter(p =>
    p.soldierId === soldier.id
    && (!p.expiresAt || Date.parse(p.expiresAt) >= nowMs)
  );
  for (const pin of active) {
    if (pin.scope.kind === 'slot' && pin.scope.slotId === slot.id) return 15;
    if (pin.scope.kind === 'mission' && pin.scope.missionId === slot.missionId) return 15;
    if (pin.scope.kind === 'global') return 10;
  }
  return 0;
}
```

**STRICT INVARIANT**: pin bonus reorders within a partition; it does
NOT move a candidate from forced to clean. `hardFiltersFailed` is
computed BEFORE pin logic touches the score. Any future refactor that
removes a hard filter check based on pin presence is a regression.

### Selector — `src/utils/engine/selector.ts`

`selectCandidates(slot, candidatePool, ctx, options) => SelectorOutcome`.

```ts
function selectCandidates(slot, pool, ctx, {requiredCount, acceptForced, forcedReason}) {
  // Score everyone, including those who fail hard filters.
  const scored = pool.map(s => scoreCandidate(s, slot, ctx));

  // Partition by hard-filter status.
  const clean = scored.filter(c => c.hardFiltersFailed.length === 0).sort(byScoreDesc);
  const forced = scored.filter(c => c.hardFiltersFailed.length > 0).sort(byScoreDesc);

  let picked, alternates;
  if (acceptForced) {
    // Operator opted in to forced. Take top N from clean+forced combined.
    const combined = [...clean, ...forced];
    picked = combined.slice(0, requiredCount);
    alternates = combined.slice(requiredCount, requiredCount + MAX_ALTERNATES);
  } else {
    // Clean only.
    picked = clean.slice(0, requiredCount);
    alternates = [...clean.slice(requiredCount), ...forced].slice(0, MAX_ALTERNATES);
  }

  return {
    picked: picked.map(c => ({ soldierId: c.soldierId, score: c, forced: c.hardFiltersFailed.length > 0, forcedReason })),
    alternates,
    rejected: [],  // empty by design — StaffingSheet's RejectedToggle re-scores the unsurfaced pool
    decayReasons: computeDecayReasons(clean, requiredCount, slot, ctx),
    computedAt: ctx.computedAt,
    contextSnapshot: { /* hash of inputs for audit */ },
  };
}
```

`decayReasons[]` explains why the clean pool was thin. Examples:
- "פלוגה עם 3 חיילים בלבד זמינים השבוע" (small pool)
- "5 חיילים על משימה אחרת בחלון זמן זה" (time conflicts)
- "2 חיילים חסרי הכשרת קסם" (missing critical qual)

The StaffingSheet renders these so the operator sees WHY the clean
pool is thin without digging.

### Burden — `src/utils/engine/burden.ts`

3-layer model:

**Layer 1: Signals (12 raw measurements)**

Computed by `computeSignals(soldier, allSlots, ctx, horizonMs, nowMs)`:

```ts
{
  daysBase: number;             // days in-base in the 30-day window
  daysHome: number;             // days home in the window
  consecutiveBaseDays: number;  // longest streak in-base
  daysSinceLastHome: number;
  totalShiftHours: number;      // all assigned hours in window
  hardShiftHours: number;       // hours where effectiveFatigueWeight >= 6 OR difficulty hard/critical
  rotationLoad: number;         // count of logistics rotations (kitchen, etc.)
  consecutiveHardShifts: number; // chain of consecutive hard shifts
  missionVariety: number;       // distinct missions
  repetitionFlag: boolean;      // same mission 4+ times in last 7 days
  recentRecallEvents: number;   // emergencies that recalled this soldier from leave
  daysSinceLastRecall: number | null;
}
```

Per-slot hour accounting:
```ts
const periodMult = slot.partOfDay === 'night' ? 1.2 : 1.0;  // night boost
const durationHours = rawHours * periodMult;
totalShiftHours += durationHours;

const fatigueWeight = slot.effectiveFatigueWeight ?? mission.fatigue.fatigueWeight;
const isHard = fatigueWeight >= 6 || mission.difficulty === 'hard' || mission.difficulty === 'critical';
if (isHard) {
  hardShiftHours += durationHours;
  if (prevWasHard) consecutiveHardShifts++; else consecutiveHardShifts = 1;
}
```

This is the Phase 7.3 wiring: archetype's `effectiveFatigueWeight`
flows into burden. Static-guard (weight 3) is light; patrol (7) is
hard; ambush (8) is hard; readiness (2) is light — even when active.

**Layer 2: Factors (4 human-meaningful groupings)**

Each factor returns `{score, explain, signalKeys}`:

- **workIntensity** (60% total hours + 40% hard hours): "X שעות
  משמרת, מהן Y במשימות קשות"
- **recoveryDeficit** (consec base + days since home): "12 ימים רצופים
  בבסיס — מעל הסף"
- **rotationPattern** (rotation load + repetition flag + variety):
  "אותה משימה 4+ פעמים השבוע — עומס חוזר"
- **stressLoad** (recall events): "הוחזר מהקפצה לפני 2 ימים — חוב מנוחה"

**Layer 3: Composite**

```ts
burdenScore = clamp(
    weights.workIntensity   × workIntensity.score
  + weights.recoveryDeficit × recoveryDeficit.score
  + weights.rotationPattern × rotationPattern.score
  + weights.stressLoad      × stressLoad.score,
  0, 100
);

headline = top factor's explain, prefixed:
  ≥ 80 → "טחן: ..."
  ≥ 60 → "עומס גבוה: ..."
  ≥ 40 → "..."
   < 40 → "קליל — ..."
```

**Post-process: p75 overshoot**

`markOverShoot(burdens)` sets `burden.overShoot = true` for soldiers
above p75 in their platoon. Surfaced visually as a red dot on soldier
cards. The CC reads this to decide who needs a break.

### Focus — `src/utils/engine/focus.ts`

`buildFocusItems(role, viewer, ctx) => FocusItem[]`. Decisions the
user must make now, not awareness. Examples:

- "אשר בקשת יציאה של חייל X" — for a PC
- "ענה להקפצה" — for soldiers in the audience
- "סגור אירוע פעיל זה Y שעות" — for the CC
- "X משבצות פתוחות שמתחילות בעוד שעתיים" — for the PC

The focus items render in the dashboard's `FocusSection` near the top
of the page.

---

## 10. The materializer

`src/utils/materialize.ts`. **`materializeWeek(input) => MaterializedSlot[]`**.

The source of slot truth in the system. Every page that needs to know
"what slots exist this week" reads the materializer. Pure: input
snapshot → deterministic output.

### Inputs

```ts
{
  missions: Mission[];
  platoons: Platoon[];
  squads: Squad[];
  soldiers: Soldier[];
  leaves: Leave[];
  dutyExclusions: DutyExclusion[];
  startDay: Date;
  days?: number;              // default 7
  assignments?: Assignment[]; // operator-confirmed picks
  slotOperationalState?;      // per-slot operator manipulations
  platoonLeaveDays?;          // per-date per-platoon home/base
  soldierLeaveOverrides?;     // per-soldier exceptions
  emergencyActive?: boolean;  // when true, bypass home filtering
}
```

### Output per slot

`MaterializedSlot extends AssignmentSlot`:

```ts
{
  // Identity
  id: string;             // 'mat-<missionId>-<isoDate>-<wIdx>[-<segIdx>]'
  companyId, missionId, missionName, missionIntensity;

  // Time
  start: string;          // ISO
  end: string;            // ISO

  // Demand
  requiredCount: number;
  commanderRequired, commanderCount, commanderRanks, commanderCountsAsManpower;
  qualifications, equipment, squadPolicy;

  // Ownership
  ownerPlatoonId: string;  // resolved from mission.rotation

  // State
  status: 'open' | 'partially-staffed' | 'fully-staffed';

  // Filled values
  assignedSoldierIds: string[];
  commanderSoldierId?: string;

  // Engine extras
  sustainedManpower?: number;     // for 24/7 missions with cycleProfile

  // Phase 7.3 archetype tags
  archetypeKind: MissionArchetypeKind;
  partOfDay: 'day' | 'night';
  effectiveFatigueWeight: number;

  // Metadata
  generatedAt: string;
  generatedBy: 'engine';
}
```

### Step-by-step walkthrough of materialization

For each `day` in `[startDay, startDay + days)`:
  For each `mission` in `input.missions` where `mission.status === 'active'`:
    1. **Resolve time windows** for this day:
       - `windowsForDay(mission, day)` returns `ConcreteWindow[]`.
       - For `24-7-continuous`: one all-day window [00:00, 23:59].
       - For `fixed-hours`: each defined window if it recurs today.
       - For `one-time`: the single window if it falls on this day.
       - For `on-demand`: empty (no slots until activated).
       - For `daily-variable`: per-date custom windows.

    2. **Resolve owner platoon** via `resolveRotation(mission.rotation, day, platoons)`.

    3. **Get archetype behavior** via `getArchetypeBehavior(mission)`.

    4. **Expand each window into segments** via `splitDayNightWindows(start, end, behavior)`:
       - If `behavior.splitsByDayNight === true` (static-guard with
         distinct day/night durations), chunk the window:
         - Find day/night boundaries
         - In each part, slice into shift-duration sub-slots
         - Each sub-slot becomes one `MaterializedSlot` with its
           `partOfDay` tag
       - Else: return a single segment with the start-time's partOfDay.

    5. **For each segment**:
       a. **Compute slot id**:
          - With splitting: `mat-<missionId>-<isoDate>-<wIdx>-<segIdx>`
          - Without splitting: `mat-<missionId>-<isoDate>-<wIdx>` (legacy stable)

       b. **Check for operator-confirmed assignment**:
          - `assignmentsBySlot.get(slotId)` returns `{soldiers[], commander?}`
          - If present: USE these verbatim (auto-pick skipped).

       c. **Check for slot operational state**:
          - `opsBySlot.get(slotId)` returns excusedUntil + lockedSoldierIds.
          - Excused-until soldiers are dropped from eligibility for this slot.

       d. **Compute eligibility** for the owner platoon's soldiers:
          - `isAvailable(soldier, slot.start, leaves, dutyExclusions)` — passes basic checks
          - NOT excused for this slot
          - NOT in a home platoon (UNLESS `emergencyActive`)
          - NO per-soldier home override (UNLESS `emergencyActive`)

       e. **If no persisted assignment, auto-pick**:
          - Commander first (so soldier slots don't accidentally consume them):
            ```
            commander = eligible.find(s => commanderRanks.includes(soldierCommandRank(s)));
            ```
          - Then fill regular slots from the rest of the eligible pool.

       f. **Compute required count**:
          ```ts
          effectiveRequiredCount(manpower, w, behavior, partOfDay):
            if partOfDay==='day' && behavior.dayMinCount !== undefined → behavior.dayMinCount
            if partOfDay==='night' && behavior.nightMinCount !== undefined → behavior.nightMinCount
            else → manpowerForWindow(manpower, w)
          ```

       g. **Compute status**:
          - `'open'` if no one assigned
          - `'partially-staffed'` if assigned < required OR commanderRequired but no commander
          - `'fully-staffed'` otherwise

       h. **Compute sustainedManpower** (only for 24/7 with cycleProfile):
          ```
          shiftsPerCycle = ceil((guardMinutes + restMinutes) / guardMinutes);
          sustainedManpower = requiredCount × shiftsPerCycle;
          ```

       i. **Compute effective fatigue weight**:
          ```
          effectiveFatigueWeight = behavior.fatigueWeight + (partOfDay === 'night' ? behavior.nightFatigueBoost : 0);
          ```

       j. **Push the slot** to the output array.

After all days × all missions × all segments:
- Return sorted by `start` ascending.

### Critical design choices

1. **Assignments win over auto-pick.** When `assignmentsBySlot[slotId]`
   is set, the materializer USES those soldiers verbatim. Auto-pick
   is a placeholder for "what the engine would do if no operator
   decision exists" — not an override.

2. **Day/night splitting (Phase 7.3).** When
   `behavior.splitsByDayNight` is true (currently only static-guard
   with distinct day/night shift durations), 24/7 windows expand into
   multiple sub-slots. Each gets its own slot id with a segment-index
   suffix. Legacy missions without `archetypeKind` resolve to
   `'custom'` → `splitsByDayNight=false` → ids unchanged across the
   Phase 7.3 upgrade. **No assignment data lost in the migration.**

3. **Eligibility chain** (in order, per slot, per soldier):
   - `isAvailable()` — soldier active + on base + not on leave + no duty exclusion
   - Not in `excusedHere` for this specific slot
   - Not in a home-platoon (UNLESS `emergencyActive`)
   - No per-soldier home override (UNLESS `emergencyActive`)

4. **Emergency override (Phase 7.3).** When `emergencyActive=true`:
   - Home-platoon filter is BYPASSED. Home soldiers become eligible.
   - Per-soldier home override is BYPASSED.
   - The leave board cells still SHOW home (the data is unchanged).
     The ENGINE just ignores them.

5. **Slot stability across runs.** Slot ids are deterministic from
   mission id + date + window index (+ segment when split). Persisted
   `Assignment[]` records reference these ids.

### Performance characteristics

- `O(days × missions × windows × eligible_pool)`.
- With current seeds (~250 slots/week, 75 soldiers), runs in
  single-digit milliseconds.
- Wrapped in `useMemo` at every callsite — re-runs only when input
  arrays change identity.

### Known consumer count

11 pages call `materializeWeek` directly (instead of using the
`useMaterializedWeek` hook in `src/hooks/useEngineContext.ts`). Tech
debt; see §28.

### Output integrity invariants

- Every slot has a deterministic `id`.
- `start < end` always.
- `requiredCount > 0` (auto-pick respects this).
- `ownerPlatoonId` is one of the company's platoons (or empty string
  when rotation can't resolve).
- If `assignedSoldierIds.length === 0` AND `commanderSoldierId === undefined`,
  status MUST be `'open'`.

These hold because the materializer is the SOLE writer of slot
records. Don't bypass it.

---

## 11. Fatigue, overlap, readiness — what the engine enforces today

The three concepts that ARE genuinely wired (Phase 7.3 closed all
three from `partial` to `wired`).

### Fatigue

**What's wired**:

1. **Burden math reads `slot.effectiveFatigueWeight`** (archetype-
   driven, day/night-aware), not just `mission.difficulty`. Hard-hour
   threshold is `fatigueWeight >= 6`.

   Concrete mapping:
   - static-guard (weight 3) → light, NOT hard
   - readiness (weight 2) → light (the right answer; readiness on
     standby is not actively fatiguing)
   - active-patrol (weight 7) → hard
   - ambush (weight 8) → hard

2. **Night slots get a 1.2× duration multiplier in burden hour
   totals** when the day/night profile has `fatigueDiffersByPeriod`.
   The boost is computed as `Math.round(fatigueWeight * 0.4)` for
   the night portion of the effective weight. So a static-guard
   slot at night has effective weight `3 + round(3*0.4) = 3 + 1 = 4`
   (still not hard by the >=6 threshold). A patrol slot at night
   has `7 + round(7*0.4) = 7 + 3 = 10` (very hard).

3. **`consecutiveHardShifts` resets correctly** when a readiness slot
   (light) sits between two patrols (hard). The chain ends and starts
   over.

4. **Rest scoring reads `ctx.allSlots`** to find the actual most-
   recent slot end before this slot's start. No longer the pessimistic
   24h-back stub. Real fatigue accounting.

### Overlap

**What's wired**:

1. **`hasTimeConflict` scans `ctx.allSlots`** for cross-slot overlaps.
   Per slot, for each OTHER slot the soldier is assigned to whose
   `[start, end)` overlaps, check the consent rule.

2. **Symmetrical archetype-aware consent** —
   `isOverlapPermitted(a, b)`:
   - If EITHER mission's `forbidsParallelAssignment` is true → reject.
   - Both `effectiveOverlapPolicy.activeOverlap` arrays must contain
     the OTHER mission's intensity.

3. **`mission.overlapPolicy`** is populated from archetype defaults
   at creation. Operator can edit via the wizard (Step 5 / advanced).
   The materializer respects whatever value is on the mission.

**Concrete examples**:

- Patrol vs guard: patrol forbids → reject. Soldier cannot be on patrol
  AND guard simultaneously.
- Readiness vs guard: readiness allows standing-guard, guard's
  archetype allows readiness → permit. Both consent.
- Two readiness missions: both allow each other → permit. Soldier on
  כרמל א can also be on כוננות הקפצה.
- Ambush vs guard: ambush's default overlap policy is empty → reject.
- Custom mission: depends on its `overlapPolicy` (operator-set).

### Readiness

**What's wired**:

1. **`isEventDriven` flag flows into the consent rule** — a readiness
   mission permits overlap with standing-guard, admin, readiness.

2. **Soldier-facing `MyReadinessCard`** on the soldier dashboard
   shows the readiness state INLINE (rally point + team-specific
   instructions) when the soldier is on (or imminent ≤12h on) a
   readiness mission. No navigation needed.

3. **`ReadinessResponseTeam[]` on Mission**. Each team carries:
   - `name`: "צוות א — שער צפון"
   - `rallyPoint?`: per-team override
   - `targetCount`: how many soldiers
   - `selectionMode`: `'soldiers' | 'squad' | 'role'`
   - `soldierIds?` / `squadId?` / `operationalRole?`: depending on mode
   - `instructions?`: per-team override

4. **The soldier's "your team" is resolved** in priority order:
   - explicit `soldierIds.includes(viewer.id)`
   - `squadId === viewer.squad`
   - `operationalRole` is in viewer's `operationalRoles`

5. **The card highlights "הצוות שלך"** with olive ring + label when a
   team matches.

**What's partial**:

- The dedicated soldier-side readiness page (`/readiness/:missionId`)
  with live event status, map, team listing, reachability info,
  activation acknowledgement — NOT built. The inline dashboard card
  is what exists today.

---

## 12. Leave management at the operational level

Three concepts, all persisted, all interacting.

### `PlatoonLeaveDay`

Per-date per-platoon home/base status.

```ts
{
  dateIso: string;       // 'YYYY-MM-DD'
  platoonId: string;
  status: 'home' | 'in-base' | 'partial';
  notes?: string;
  locked?: boolean;      // when true, rotation generators must not overwrite
  updatedAt: string;
  updatedByUserId: string;
}
```

Best fit for combat platoons that rotate as a unit. The materializer
drops every soldier in a `'home'` platoon from eligibility on that
date.

Edited via `/coverage/platoons` — `PlatoonLeaveBoardPage`. Click a cell
to toggle. Persisted as a slice in AppContext.

### `CoverageRule` (within `CompanyCoverageRuleSet`)

For non-rotating units (חפ״ק / מפלג). 7 kinds:

```ts
type CoverageRule =
  | { kind: 'min-count-in-platoon', platoonId, min }
  | { kind: 'min-with-functional-role', functionalRole, min, scopePlatoonId? }
  | { kind: 'min-with-operational-role', operationalRole, min, scopePlatoonId? }
  | { kind: 'team-together', soldierIds }
  | { kind: 'mutual-exclusion', soldierIds }
  | { kind: 'command-coverage', anyOfRoles: OperationalRole[], min, scopePlatoonId? }
  | { kind: 'personal-leave-buffer', min, asPercent, scopePlatoonId? }
```

Evaluator runs per-day on `/coverage/platoons` against the in-base
soldier set. Violations surface as:
- ⚠ glyph in the column header
- Warn-ring on every cell of that day (per-platoon)
- Entry in the "ימים בעייתיים" worst-days list

### `Leave` and `LeaveRequest`

The classic individual-leave path.

```ts
type LeaveRequest = {
  id, soldierId, soldierName, ...,
  startDate, startTime?, endDate, endTime?, reason, status: 'pending' | 'approved' | 'rejected',
  ...
};

type Leave = {
  id, scope: 'individual' | 'squad' | 'machlaka',
  soldierIds, squadId?, machlakaId?,
  startDate, startTime?, endDate, endTime?, reason, wasRecalled?, recalledAt?,
  ...
};
```

Flow:
1. Soldier submits leave request via their profile page.
2. PC sees it in `useApprovableLeaveRequests()` for their platoon.
3. PC clicks approve → `Leave` record created with
   `scope: 'individual'`.
4. Hard-filtered by `hardFilters.isOnLeaveDuring()`.

Recall:
- An active `EscalationEvent` may force the soldier back. The
  `wasRecalled: true` + `recalledAt` fields track this. Burden's
  `recentRecallEvents` reads them.

### `SoldierLeaveOverride`

Per-soldier exception to the platoon-day default.

```ts
{
  id, dateIso, soldierId,
  status: 'home' | 'in-base',  // direction of override
  reason?, createdAt, createdByUserId,
}
```

Two directions:
- "Soldier X from home-platoon Y is `'in-base'` today" — called back
  for some reason.
- "Soldier X from in-base-platoon Y is `'home'` today" — individual
  leave inside an in-base platoon.

Materializer applies these AFTER the platoon-day filter:

```ts
if (platoonIsHome) {
  const override = soldierOverrideBy.get(`${dateIso}::${soldier.id}`);
  if (override?.status !== 'in-base') return false; // drop from eligible
}
const sOverride = soldierOverrideBy.get(`${dateIso}::${soldier.id}`);
if (sOverride?.status === 'home') return false; // drop from eligible
```

### `LeaveBlock` and `LeaveRotationPolicy` (older / orthogonal)

The data layer also carries `LeaveBlock` (richer leave-engine atom)
and `LeaveRotationPolicy` (abstract rule set). These were precursors
to the simpler operational-leave model. They persist for back-compat
and are not the primary edit surface today.

### `PlatoonLeaveCycle` and `PlatoonLeaveCycleSegment` (legacy)

Yet another precursor — a segment-based per-platoon rotation. Visible
in `/leave-cycle`. Not the primary surface; the day-grid on
`/coverage/platoons` is.


---

## 13. The Company Leave Planning Wizard

`/coverage/planning` — `LeavePlanningWizardPage`. Four-step guided
setup the CC runs when standing up (or revising) a new line.

### Step 1 — חסימות (blocked dates)

The operator adds `CompanyBlockedDate` records.

Form fields:
- **תאריך** (`dateIso`): the date being blocked.
- **סוג** (`kind`): dropdown of 7 kinds (line-up, line-down, credit,
  drill, inspection, op-event, other).
- **סיבה** (`reason?`): free-text, optional.
- **כל הפלוגה בבסיס** (`requireAllInBase`): when true, every platoon
  must be in-base on this date.
- **הוסף ליומן חיילים** (`addToCalendar`): when true, the day appears
  on every soldier's calendar.
- **אסור בקשות יציאה** (`blockLeaveRequests`): when true, leave-request
  submission rejects this date.
- **נספר לאיזון** (`countsForBalance`): when false, this day doesn't
  count toward fairness/balance metrics (line-up/line-down days
  typically excluded).

Operational reasoning per kind:
- **line-up** (עליה לקו): everyone arrives, signs out equipment, gets
  briefed. `requireAllInBase=true`, `countsForBalance=false`. This is
  not a "duty day" to count for fairness — it's preparation.
- **line-down** (ירידה מהקו): mirror. `countsForBalance=false`.
- **credit** (זיכוי בסיס): the company has earned a credit day.
- **drill** (תרגיל): everyone in base, counts as a duty day.
- **inspection** (ביקורת): everyone in base, counts.
- **op-event** (אירוע מבצעי): operational event the whole company
  participates in.
- **other** (אחר): free.

After adding, blocked dates list below the form with their full
metadata + remove action.

### Step 2 — גופים (body separation)

Pick `bodySeparation`:

- **platoons-together**: all bodies (CHAPAK + MAFLAG) move with the
  platoon they sit in. Simplest.
- **chpk-by-person**: CHAPAK + MAFLAG soldiers rotate individually,
  not as a unit. Preserves critical roles in base.
- **chpk-with-platoons**: CHAPAK follows its home platoon as a group
  (not per-person).
- **chpk-separate**: CHAPAK runs its own rotation independent of
  platoons. Requires its own minimum-coverage rule.

The choice is stored on `CompanyLeavePolicy.bodySeparation` but is
NOT yet enforced at the materializer level. It's a recommendation
input. See §27.

### Step 3 — מדיניות (rotation policy)

The rotation pattern + modifiers.

**Rotation pattern** (6 cards):
- `weekly`: שבוע / שבוע
- `10-5`: 10 days in base, 5 home
- `8-7`: 8 / 7 — balanced
- `one-home`: at most 1 platoon home concurrently
- `two-home`: 2 platoons home (aggressive)
- `custom`: operator-defined

**Modifiers**:
- `noWeekendTransition`: don't change home/base on Friday/Saturday
- `minConsecutiveBaseDays`: minimum consecutive days in base before a home stint
- `minConsecutiveHomeDays`: minimum home stint length
- `maxPlatoonsHome`: cap on concurrent home platoons
- `homeStintDays`: typical home stint length
- `allowSplitByPlatoon`: may a platoon be split (some home, some base, same day)?

All stored on `CompanyLeavePolicy`. The wizard writes them on commit.

### Step 4 — סקירה ופרסום (review + commit)

Summary lines + recommendation text + commit button.

**Summary lines**:
- "סבב: 8 / 7"
- "גופים: מחלקות יחד"
- "מקסימום בית בו זמנית: 1"
- "ימי סבב הביתה: 4"
- "מינימום בסיס / בית רצוף: 3 / 3"
- "חסומים: 2 תאריכים"
- "שישי / שבת: אין החלפות"
- "פיצול לפי כיתות: אסור"

**Recommendations**:
`buildRecommendations(draft, blocked)` generates 3-7 textual notes
tonally classed `good | info | warn` (see §22 for the full list).

**Commit**:
- Calls `updateCompanyLeavePolicy(draft)`.
- Shows success toast.
- Routes to `/coverage/platoons` after 1.5s — the operator lands on
  the visual board to edit day-by-day toggles.

### Honest scope disclosure

Inside Step 4's "פעולות אחר־כך" panel:

> "המדיניות תיכנס לתוקף מיד.
> הלוח הפלוגתי עצמו ייערך ידנית — המערכת לא יוצרת לוח אוטומטי כרגע.
> החסימות יופיעו ב-״לוח יציאות פלוגתי״ ויקובלו ברקע ע״י הלוח."

The wizard writes POLICY + BLOCKED DATES. It does NOT generate a
concrete rotation. The day-by-day toggles on `/coverage/platoons`
remain the operator's manual edit. The recommendation engine is
TEXT — not a generative recommender. See §22.

---

## 14. Blocked dates

`CompanyBlockedDate` — Phase 7.3 addition.

### Type

```ts
{
  id: string;                                    // 'cbd-' prefix
  companyId: string;
  dateIso: string;                               // 'YYYY-MM-DD'
  kind: 'line-up' | 'line-down' | 'credit' | 'drill' | 'inspection'
      | 'op-event' | 'other';
  reason?: string;
  requireAllInBase: boolean;
  addToCalendar: boolean;
  blockLeaveRequests: boolean;
  countsForBalance: boolean;
  createdAt: string;
  createdByUserId: string;
}
```

### Visual surface — `/coverage/platoons`

The leave board reads `companyBlockedDates` and renders:

1. **Column header tint**: blocked-date columns get `bg-mil-info-bg
   text-mil-info border-l border-mil-info-border` plus a kind glyph:
   - 🎯 line-up
   - 🏁 line-down
   - 🏖 credit
   - 🎖 drill
   - 🔍 inspection
   - 🚨 op-event
   - 📌 other

2. **Tooltip on the header**: kind label + reason.

3. **Conflict tone on overlap cells**: if a platoon is marked `'home'`
   on a `requireAllInBase: true` blocked date, the cell flips to
   alert-red. Visible conflict ("מחלקה בבית ביום שכולם חייבים בבסיס").

### Engine integration status

**The wizard writes the records.** Visual board reads them. The
materializer does NOT yet read them to ENFORCE `requireAllInBase`.

What this means in practice:
- A blocked-date `requireAllInBase=true` does NOT today drop home
  soldiers from eligibility automatically.
- The cell flip to alert-red is visual only — the operator sees the
  conflict and must manually resolve.

Next-slice scope: wire the materializer to read
`companyBlockedDates`. When a slot's `dateIso` matches a blocked date
with `requireAllInBase=true`, ignore the `platoonLeaveDays` `home`
filter for that date (similar pattern to the emergency override).

---

## 15. Rotation policy

The `rotationPattern` and modifier fields on `CompanyLeavePolicy`.

### Pattern presets

| Pattern | Hebrew | When to use |
|---|---|---|
| `weekly` | שבוע / שבוע | Simple, easy to track. Risk: 2 platoons home means thin base. |
| `10-5` | 10 / 5 | Longer cycle, stability for operations. Harder on soldiers. |
| `8-7` | 8 / 7 | Balanced. The IDF reserve typical. |
| `one-home` | מחלקה אחת בבית | Conservative — base always strong. Most home time spread thin. |
| `two-home` | שתי מחלקות בבית | Aggressive — base often thin. Requires quick call-up. |
| `custom` | מותאם | Operator-defined per-day. The recommendation engine offers less help. |

### Modifiers

- `noWeekendTransition: boolean` — when true, the wizard's recommendations
  avoid scheduling transitions on Friday/Saturday. Operational reason:
  the rest of the army works less on weekends; transitions create gaps.
- `minConsecutiveBaseDays: number` — minimum days a platoon must spend
  in base before its next home stint.
- `minConsecutiveHomeDays: number` — minimum home stint length. Below
  this, the trip home isn't worth the travel for the soldiers.
- `maxPlatoonsHome: number` — concurrent home platoons cap.
- `homeStintDays: number` — typical home stint length.
- `allowSplitByPlatoon: boolean` — whether a platoon may be split
  (some home, some base, same day). Default false — most ops want the
  platoon to move as a unit.

### Status

Stored on `CompanyLeavePolicy`. Read by the recommendation engine to
shape its text. **Not enforced at the materializer level today.** A
real rotation generator that proposes candidate rotations honoring
these constraints is future work.

---

## 16. Command coverage

`CoverageRule` kind `'command-coverage'` — Phase 7.3 addition.

### Why it exists

The pre-existing `min-with-operational-role` rule was per-role AND.
Each rule independently required N of THIS specific role. They could
NOT express "at any time at least ONE of {מ״מ, סמל, מ״כ} in base" — the
canonical command-coverage requirement.

The new rule expresses OR semantics.

### Type

```ts
{
  id: string;
  kind: 'command-coverage';
  label: string;
  anyOfRoles: OperationalRole[];   // OR set
  min: number;
  scopePlatoonId?: string;
}
```

A soldier matches when ANY of their `operationalRoles` appears in
`anyOfRoles`. Default seed in the add form: `[מ״מ, סמל, מ״כ]`. Operator
can extend up to `[מ״פ, סמ״פ, מ״מ, סמל, מ״כ]`.

### Evaluator

`/coverage/platoons` runs per-day:

```ts
const matches = inBaseSoldiers.filter(s =>
  (s.operationalRoles ?? []).some(role => rule.anyOfRoles.includes(role))
);
if (matches.length < rule.min) → warning
```

With optional `scopePlatoonId`, the rule narrows to a specific
platoon.

### Concrete examples

- "תמיד 1 מ-{מ״מ, סמל, מ״כ} בבסיס" — the canonical company-wide rule.
- "תמיד 1 מ-{מ״מ} בבסיס" — strict, requires the lieutenant level
  always present. Use sparingly.
- "תמיד 2 מ-{מ״כ} בגימל 2" — squad-commander coverage scoped to one
  platoon.

### Engine integration status

**Wired** for the visual board (warnings appear). **Not yet enforced**
in the materializer — the materializer doesn't pre-reject a
configuration that would break command coverage. Operator sees the
warning and chooses to fix or override.

---

## 17. Personal leave buffer

`CoverageRule` kind `'personal-leave-buffer'` — Phase 7.3 addition.

### Why it exists

Captures the operational truth: when planning platoon-level leave
rotations, keep room for individual leave requests. If a platoon
goes home in full AND the in-base platoons are at minimum, there's
no slack for a soldier to request a single day off for family
reasons.

### Type

```ts
{
  id: string;
  kind: 'personal-leave-buffer';
  label: string;
  min: number;
  asPercent: boolean;
  scopePlatoonId?: string;
}
```

Two modes:
- `asPercent: false`: `min` is an absolute count. "Reserve 3 buffer
  slots."
- `asPercent: true`: `min` is 0-100. "Reserve 15% of platoon strength."

### Evaluator (honest approximation)

```ts
scopeSize = scopePlatoonId
  ? platoonSoldiers.get(scopePlatoonId).length
  : sum over all platoons
inBaseSoldiers = soldiers in base in scope on this day
target = asPercent ? round(min/100 * scopeSize) : min
if (inBaseSoldiers.length < target) → warning
```

**Honest disclosure** (visible in the rule-add form):
> "כרגע הבדיקה משווה רק את ספירת החיילים בבסיס מול היעד. דרישת איוש
> משימות פעילות לא נכללת עדיין בחישוב — תיווסף בעדכון עתידי."

The evaluator does NOT subtract mission staffing demand from the
"available" pool. So a platoon with 18 in base + 12 on missions =
6 truly available is reported as "18 available" against a buffer
target. This is an APPROXIMATION. A proper computation requires the
materializer to expose per-day per-platoon demand — future work.

### Concrete examples

- "מרווח יציאות אישיות בכל הפלוגה: 3 חיילים" — keep 3 buffer slots
  for personal leave at any time.
- "מרווח יציאות אישיות בגימל 1: 15%" — 15% of גימל 1's strength
  (about 3 soldiers in our seed).

### Engine integration status

**Wired** for the visual board. **Approximation** as documented.
**Not yet read** by the conflict resolution flow on
`/missions/:id/assign`.

---

## 18. Conflict resolution — the principle that runs through everything

**The product DOES NOT BLOCK with validation errors. It RESOLVES.**

This is the operational principle that distinguishes a command-and-
control system from a form-validation tool.

### The pattern

When a system constraint would normally throw an error, the product
instead:

1. Presents the conflict as data (`OperationalConflict` shape)
2. Generates resolution options (`ConflictResolution[]`)
3. Renders the options as inline action chips
4. Applies the chosen resolution via real mutations (not just clearing
   the error)

The operator chooses. The system never blocks silently.

### Current implementation — platoon-on-leave conflict

`src/utils/conflictResolution.ts` defines:

```ts
type ConflictKind = 'platoon-on-leave';
// Future: + 'time-overlap' | 'soldier-on-leave' | 'readiness-conflict' | 'staffing-conflict'

interface PlatoonLeaveConflict {
  kind: 'platoon-on-leave';
  platoonId: string;
  platoonName: string;
  homeDayIsos: string[];   // sorted ISO dates inside the mission window
  firstHomeIso: string;
  lastHomeIso: string;
  windowFromIso: string;
  windowToIso: string;
  summary: string;         // "גימל 2 בבית 3 ימים (2026-05-12 – 2026-05-14)"
}
```

When the CC opens `/missions/:id/assign` and selects a platoon whose
home days overlap the mission window:

`detectPlatoonLeaveConflicts({selectedPlatoonIds, windowFromIso,
windowToIso, platoonLeaveDays, platoons})` returns an array of
`PlatoonLeaveConflict`.

For each conflict, the page renders a **ConflictCard** with 6 action
chips:

| Chip | Severity | What it does |
|---|---|---|
| ➕ הוסף את X לכיסוי | safe | Adds an available platoon to `selectedPlatoonIds`. Keeps the conflicting platoon (it stays home; the mission is now covered by another). |
| ⇄ החלף ב־X | safe | Removes the conflicting platoon, swaps in an available one. |
| 🔒 השאר בבסיס למשימה | override | `setPlatoonLeaveDay(date, platoon, 'in-base', note)` for each conflicting day. The leave board reflects the change instantly. |
| ½ יציאה חלקית | override | Same as above but `status='partial'`. |
| 🗓 פתח לוח יציאות פלוגתי | navigate | Routes to `/coverage/platoons` for free-form edit. |
| ⚠ אפשר בכל זאת | override | Local dismissal — card collapses to "✓ נפתר — אושר עם אזהרה" and the platoon chip swaps to a confirmation tone. |

After picking a resolution, the card collapses to a quiet confirmation
banner. The Save CTA shows "(N בלי פתרון)" while any conflicts remain
unresolved.

### Concrete example flow

CC creates "סיור לילה" for 2026-05-12 → 2026-05-18. Picks גימל 2 in
the assignment page. Conflict card appears:

> "גימל 2 — בבית 3 ימים (2026-05-12 – 2026-05-14) בחלון המשימה"

The 6 chips render below. CC clicks **⇄ החלף ב־גימל 3**. The chip
removes גימל 2 from selectedPlatoonIds and adds גימל 3. The card
collapses. The platoon chip for גימל 2 changes from olive (selected)
to default (unselected) and the chip for גימל 3 turns olive.

The next slot of the mission inherits the new ownership. Auto-pick
re-runs against גימל 3's eligible pool. No errors. No validation
banners. The operator made an operational decision via a UI
affordance.

### Architecture for extension

`ConflictKind` is a discriminated union. Adding a new kind requires:

1. Define `*Conflict` interface (the WHAT data shape).
2. Implement `detect*` helper (pure, returns conflict records).
3. Implement `resolutionsFor*` helper (generates `ConflictResolution[]`).
4. Add a case to the consuming page's `applyResolution` switch.

The architecture is open. The 4 other planned conflict kinds:

#### `time-overlap`

A soldier is already assigned to an overlapping slot. Engine blocks
correctly via `hardFilters.hasTimeConflict`; StaffingSheet shows the
hard-filter code. **Not yet** an inline resolution flow with chips
like "החלף עם המשבצת הקודמת" / "שחרר מהמשימה הקודמת" / "הקצה כפול
בכל זאת".

#### `soldier-on-leave`

A soldier on personal leave. Engine blocks; UI shows the code. **Not
yet** an inline resolution: "החזר מחופשה" / "החלף לחייל אחר" / "דחה
את הבקשה".

#### `readiness-conflict`

When two readiness missions would force the same soldier to
contradicting rally points. Engine permits parallel by default; this
kind would catch the operationally-incoherent case.

#### `staffing-conflict`

When a slot has fewer/more than required count. The status pill shows
"partially-staffed". **Not yet** an inline resolution menu.

### Why this matters

Validation errors are tool behavior. Resolution flows are command-
and-control behavior. The product MUST stay on the resolution side.
If you find yourself adding a `throw new Error()` or a `return false`
in a UI guard, stop. Ask:
**"What would the operator do RIGHT NOW to fix this?"**
That question yields a list of resolutions. Build them.

---

## 19. The operational timeline

`src/utils/operationalTimeline.ts`. Role-scoped, time-flow awareness.

### Why it exists

The system already understands missions, archetypes, conflicts,
fatigue, readiness, leave. The timeline adds the missing axis: **WHEN
things happen.**

A מ״פ doesn't just want to know "there are 4 missions today." He
wants to know "in 2 hours the guard hands over, in 4 hours readiness
team rotates, and tomorrow at 06:00 גימל 2 returns from home stint."

### Pure derivation

`deriveTimelineEvents({nowIso, horizonHours, slots, missions, platoons,
soldiers, platoonLeaveDays, announcements, companyId}) => TimelineEvent[]`.

Pure: `nowIso` is passed in (not `Date.now()` inside). Deterministic
over snapshot inputs. Output sorted by `atIso` ascending.

### TimelineEvent shape

```ts
{
  id: string;                                    // deterministic
  kind: TimelineEventKind;
  atIso: string;                                 // when the event "happens"
  expiresAtIso?: string;                         // when it becomes irrelevant
  title: string;                                 // Hebrew one-line title
  description?: string;
  severity: 'info' | 'warn' | 'alert' | 'critical';
  href?: string;                                 // SPA route on tap
  scopes: TimelineScope[];                       // soldier | platoon | company
  missionId?, platoonId?, soldierId?;
}
```

### Event kinds — full inventory (10 wired)

#### `next-shift`

The upcoming slot per assigned soldier within the 36h horizon.

**Per soldier emission**: one event per (slot, soldier) pair. So a
slot requiring 4 soldiers emits 4 `next-shift` events, one per
soldier.

**Title**: "{missionName} בעוד {N} דק׳/שעות"
**Severity**: `warn` if ≤120 min, else `info`
**Scope**: `[{kind: 'soldier', soldierId}]`
**Tap target**: `/mission/:id`

#### `shift-end-now`

Currently-on slot ending in ≤90 min.

**Title**: "המשמרת מסתיימת בעוד N דק׳"
**Severity**: `warn` if ≤30 min, else `info`
**Scope**: `[{kind: 'soldier', soldierId}]`

#### `shift-handover`

Slot start within horizon, one event per slot (NOT per soldier).
Platoon-scoped.

**Title**: "חילוף ב-HH:MM · {missionName}"
**Severity**: `warn` if ≤60 min, else `info`
**Scope**: `[{kind: 'platoon', platoonId}, {kind: 'company', companyId}]`

#### `readiness-on`

Readiness slot within the horizon.

**Title**: "{missionName} בעוד N"
**Description**: "נקודת ריכוז: {rally}"
**Severity**: `warn`
**Scope**: `[{kind: 'platoon', platoonId}, {kind: 'company', companyId}, ...soldier-scopes for each assigned soldier]`

#### `staffing-pressure`

Open/partial slot in the next 12 hours.

**Title**: "{missionName} ללא איוש בעוד N"
**Severity escalation**: `critical` if ≤120 min, `alert` if ≤360 min, `warn` else
**Scope**: `[{kind: 'platoon', platoonId}, {kind: 'company', companyId}]`

#### `publish-deadline`

No "שבצ״ק עודכן" announcement in the last 18 hours (configurable via
`input.publishWindowHours`).

**Title**: "{platoonName}: שבצ״ק לא פורסם N שעות/ימים"
**Description**: "חיילי המחלקה רואים מידע מיושן בלו״ז שלהם."
**Severity**: `warn`
**Scope**: `[{kind: 'platoon', platoonId}, {kind: 'company', companyId}]`

#### `concurrent-critical`

Two ambush/active-patrol slots starting within 30 minutes of each
other.

**Title**: "2 משימות קריטיות בו זמנית: {A} + {B}"
**Description**: "התחלה בהפרש N דק׳ — בדוק שהכוח מספיק."
**Severity**: `alert`
**Scope**: `[{kind: 'company', companyId}]`

Detection: pair-wise scan of upcoming slots sorted by start; check
both intensities; check gap.

#### `leave-conflict-imminent`

Mission still active when its assigned platoon starts a home stint.

**Title**: "{platoonName} יוצאת ב-{dateIso} אך {missionName} עוד פעילה"
**Severity**: `alert`
**Scope**: `[{kind: 'platoon', platoonId}, {kind: 'company', companyId}]`

#### `platoon-leaving-home`

Today/tomorrow stint transition into home.

**Title**: "{platoonName} יוצאת הביתה ב-{dateIso}"
**Severity**: `warn` if today, `info` if tomorrow
**Scope**: `[{kind: 'platoon', platoonId}, {kind: 'company', companyId}]`

#### `platoon-returning`

Today/tomorrow stint transition back to base.

**Title**: "{platoonName} חוזרת לבסיס ב-{dateIso}"
**Severity**: `info`
**Scope**: `[{kind: 'platoon', platoonId}, {kind: 'company', companyId}]`

### Scoping discipline

The single most important rule of this layer.

Every event carries `scopes: TimelineScope[]`. The selection helper
filters by viewer:

```ts
function selectTimelineFor({events, viewerSoldierId, viewerPlatoonId,
                            viewerCompanyId, limit, minSeverity}) {
  return events.filter(e =>
    SEVERITY_ORDER[e.severity] >= minThreshold
    && e.scopes.some(s =>
       (s.kind === 'soldier' && s.soldierId === viewerSoldierId)
    || (s.kind === 'platoon' && s.platoonId === viewerPlatoonId)
    || (s.kind === 'company' && s.companyId === viewerCompanyId)
    )
  ).slice(0, limit);
}
```

**A soldier passing only `viewerSoldierId` never sees platoon noise.**
**A PC passing only `viewerPlatoonId` never sees other platoons.**
**A CC passing only `viewerCompanyId` only sees company-wide events.**

This is the user's hard requirement: each role sees only what's
relevant to them. The home page MUST NOT become a dumping ground.

### UI surfaces

| Surface | Scope | Limit | Notes |
|---|---|---|---|
| SoldierDashboard "הציר שלך" | soldier only | 4 | 36h horizon. Compact card style. |
| PlatoonMissionsPage "ציר זמן פלוגתי" | platoon only | 6 | 36h. Full card style. |
| `/schedule` company strip (CC) | company only | — | **Not built yet.** Derivation supports it. |
| `/alerts` cross-feed | critical only | — | **Not wired yet.** Could promote critical events. |

### Honest gap

Critical-severity events could promote to the `/alerts` feed. They
don't today. Mission slots are NOT auto-paused during emergency. The
timeline emits the activation event but doesn't trigger mission
freeze. See §27.

---

## 20. Emergency / הקפצה

### What הקפצה means operationally

**Not** an alert. **Not** an announcement. **A state.**

When the CC declares הקפצה, the operational meaning is: **every
soldier who was home is temporarily called back to base.** From the
moment of declaration until close, the company is in a state of
"everyone in base." Leave is frozen, missions can be re-assigned, the
situation changes faster than the normal schedule allows.

This is **NOT** the same as "send an alert" or "publish an
announcement." It is a real state change with engine consequences.

### Architecture

Built on the existing `EscalationEvent` data type — pre-Phase-7.3.

#### Type

```ts
type EscalationEvent = {
  id: string;
  companyId: string;
  reason: string;                            // "התרעה צפונית"
  location?: string;                         // "תעוז 4 / שער ראשי"
  reportTime: string;                        // ISO — when to assemble
  endKind: 'planned' | 'unknown';
  endTime?: string;
  audience: Audience;                        // company | platoons | squads | soldiers
  instructions?: string;
  requiredEquipment?: string[];
  spawnedMissionIds?: string[];              // missions created in response
  spawnedDelegationIds?: string[];
  status: 'active' | 'closed';
  openedByUserId, openedByName, openedAt;
  closedByUserId?, closedByName?, closedAt?;
  closeReason?: string;                      // recovery notes stored here
};
```

#### Mutations

- `declareEscalation(data) => EscalationEvent | null` — permission-gated
  on `canDeclareEscalation`.
- `closeEscalation(id, reason?) => void`.
- `activeEscalationsForViewer() => EscalationEvent[]` — scoped query.

### UI surface: the global floating button

`<EmergencyFab>` mounted in `App.tsx` next to `<BottomNav>` behind the
same `showNav` guard. Visible to anyone passing `canDeclareEscalation`
(CC + Deputy CC + active delegates).

**Two states**:

#### Idle

Red "🚨 הקפצה" button. Bottom-right. Positioned via
`style={{ bottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}`
so it sits stably above the BottomNav across devices. `z-[35]` —
above nav (`z-30`), below sheets (`z-50`). `max-w-[min(80vw,260px)]`
so the active-state label doesn't overflow on narrow screens.

Tap → opens `DeclareEmergencySheet`.

#### Active

Red "🛑 סיים אירוע (N)" with a pulsing white badge. The pulsing dot is
critical — the operator can NEVER forget the company is still in
event state.

Tap → opens `EndEmergencySheet` on the first active event.

### No in-page card

The earlier "פעולת חירום" Section on the CC dashboard was REMOVED in
commit `c9995f0`. The FAB is the only entry point — available from
EVERY screen, not just `/home`.

**The card is gone. The FAB is the canonical surface. Do not re-add
a page-local emergency card.**

### Declare flow — `DeclareEmergencySheet`

Fields:
- **Reason** (free text, required) — "התרעה צפונית" / "ניוד פלוגה
  לתעוז דרום"
- **Location** (free text) — rally point or destination
- **Report time** — chip picker (5/15/30/60/120 min from now), default 15
- **Audience scope** — chip pair: "כל הפלוגה" / "מחלקות נבחרות"
  - If "מחלקות נבחרות": platoon chip multi-select
- **Duration kind** — chip pair: "פתוח" / "תכנון"
- **Instructions** (textarea) — what to bring, what to do

Live preview line:
> "🚨 הקפצה — {reason}
> יעד: {location} · דיווח: בעוד {N} דק׳"

On confirm:
1. `declareEscalation()` writes the `EscalationEvent` (status `'active'`).
2. `addAnnouncement()` publishes a "🚨 הקפצה — {reason}" announcement
   to the same audience. Body line includes location + report-time.
3. `addAuditLog()` records the declaration.
4. The FAB switches to active state across every screen.

### Active-state engine effect — the REAL semantics

`useEngineContext.ts` derives:

```ts
emergencyActive = escalationEvents.some(e =>
  e.status === 'active'
  && (!myCompany || e.companyId === myCompany.id)
);
```

Passes this into `materializeWeek({emergencyActive})`. The materializer:

1. **BYPASSES** the home-platoon filter — home soldiers appear in the
   eligible pool.
2. **BYPASSES** per-soldier home overrides — anyone marked home for
   today flips to eligible.

The leave board cells still SHOW home (data unchanged). The ENGINE
just ignores them. When the event closes, eligibility snaps back to
the original schedule.

`useMaterializedWeek` (standalone hook for pages not pulling the full
context) computes the same `emergencyActive` so every consumer sees
the same view.

### What does NOT happen automatically

Honestly disclosed in both the declare and end sheets:

- Missions are NOT auto-paused. Their slots continue materializing.
  The operator can manually reassign.
- The leave board is NOT auto-edited (it's UNCHANGED — visually
  overridden by the materializer).
- No push notification fires. The auto-announcement is the soldier-
  facing signal.
- No automatic mission freeze beyond the eligibility bypass.
- No materializer-level "everyone reports here" — the rally point is
  in the announcement; soldiers act on it manually.

### Concrete example walkthrough

22:30 — CC's phone vibrates. Real-world incident requires response.

22:30 — CC taps FAB. DeclareEmergencySheet opens.

22:30 — CC fills:
- Reason: "אירוע ביטחוני - קצה צפוני"
- Location: "שער ראשי"
- Report time: 15 דקות
- Audience: כל הפלוגה
- Instructions: "נשק ואפוד · קסדה · מים"

22:30 — Tap "פתח הקפצה".

22:30 — EscalationEvent written. Announcement published. Audit logged.

22:30 — FAB on every operator's phone switches to active state.

22:31 — Soldiers receive the announcement in their AnnouncementsStrip.
A soldier on home leave sees the audience matches him → expected to
return. (Honestly: no push notification fires today; he sees it only
when he opens the app.)

22:35 — PC of גימל 2 opens `/platoon/missions`. Wants to staff the
response. Opens StaffingSheet for a new mission slot. The eligible
pool includes ALL גימל 2 soldiers including those currently marked
home — because `emergencyActive` is true. The materializer ignored
the home filter.

22:36 — PC picks 4 soldiers + a commander. Mission staffed.

01:30 — Incident resolved. CC taps FAB ("🛑 סיים אירוע (1)").
EndEmergencySheet opens.

01:31 — CC fills:
- Close reason: "המצב הוסר"
- Disrupted missions: "סיור 24:00 לא בוצע, שמירת מגדל 7 הוחלפה ידנית"
- Need rest: "צוות ב (גימל 2) — לפחות 6 שעות"
- Return mode: "חזרה חלקית — לעדכן בנפרד"
- Publish update: ✓

01:31 — Tap "סגור אירוע".

01:31 — EscalationEvent.status → 'closed'. recoveryNotes stored on
closeReason. Closure announcement published.

01:31 — Because returnToNormal === 'partial', routes to
`/coverage/planning` — the leave-planning wizard for re-balance.

The system never forgot who got called back. The audit log carries
the full event + recovery notes. The post-emergency rotation is the
operator's job to re-plan.

---

## 21. Recovery from emergency

`EndEmergencySheet`. The product captures recovery as data even if it
can't act on most of it automatically yet.

### Form fields

- **Close reason** (free text, required) — "המצב הוסר" / "האירוע
  הסתיים" / "שווא"
- **Disrupted missions** (textarea, optional) — "אילו משימות זזו /
  לא בוצעו"
- **Need rest** (textarea, optional) — "חיילים שדורשים מנוחה"
- **Return mode** (chip triple): full / partial / new
  - **full**: חזרה מלאה לסידור הקודם
  - **partial**: חזרה חלקית — לתעדכן בנפרד
  - **new**: בניית סידור חדש
- **Publish closure announcement** (checkbox, default ON)

### Honest disclosure (inside the sheet)

> "סגירת האירוע מתעדת את המידע למעלה ביומן + פרסום הודעה. **החזרה
> לסידור הקודם, איוש מחדש, ועדכון יציאות פלוגתיות נעשים ידנית**
> מהמסכים הרלוונטיים. הערות תיעוד אלה ישמשו לתחקיר אך אינן מבצעות
> שינויים אוטומטיים בשבצ״ק."

### On confirm

1. `closeEscalation(id, recoveryNotes)` — all free-text fields roll
   into `closeReason` for the audit log.
2. If `publishUpdate`: closure announcement.
3. **If `returnToNormal !== 'full'`**: routes to `/coverage/planning`.

### Why route to the planning wizard

The post-emergency rotation usually isn't fair:
- Soldiers who were home got called back and worked.
- Soldiers who stayed in base also worked harder.
- Some soldiers lost their leave entirely.

The planning wizard surfaces the policy + rotation pattern + blocked
dates so the CC can:
- Adjust the next rotation to compensate.
- Add blocked dates for "drill recovery."
- Tweak the buffer to account for who's owed leave.

The operator does the actual moves on `/coverage/platoons`. The
wizard is the policy surface; the board is the day-by-day editor.

### What is NOT done automatically

- No rollback of missions to a pre-event state.
- No automatic burden adjustment for soldiers who lost rest.
- No automatic leave-board update.
- No "publish a fresh שבצ״ק" action.

These remain explicit operator actions on the existing surfaces.

---

## 22. The recommendations layer (honestly: it is text)

Three surfaces produce recommendations today. None of them are
generative — they're all derived text.

### Leave-planning wizard Step 4

`buildRecommendations(draft, blocked)` generates 3-7 textual notes
tonally classed `good | info | warn`:

| Trigger | Tone | Text example |
|---|---|---|
| `rotationPattern === 'weekly'` | info | "שבוע-שבוע פשוט וקל למעקב. בדוק שמינימום בסיס מתקיים..." |
| `rotationPattern === '8-7' \| '10-5'` | good | "{pattern} שומר על איזון טוב בין עומס וזמן בבית." |
| Line-up/line-down dates exist | info | "יום עליה / ירידה מהקו (DATES) מסומן ככזה שלא נספר לאיזון." |
| `noWeekendTransition === false` | warn | "החלפות בשישי / שבת עלולות לפגוע בזמינות החיילים בסוף שבוע." |
| `maxPlatoonsHome >= 2` | warn | "שתי מחלקות בבית בו זמנית מקטין משמעותית את הסד״כ הזמין." |
| `bodySeparation === 'platoons-together'` | info | "חפ״ק / מפלג זזים יחד עם המחלקות — פשוט, אבל עלול לאבד תפקיד קריטי." |
| `bodySeparation === 'chpk-by-person'` | good | "חפ״ק / מפלג לפי חיילים שומר על תפקודים קריטיים בבסיס." |
| `minConsecutiveBaseDays < 2` | warn | "מינימום ימים רצופים בבסיס נמוך מ-2. החיילים עלולים להגיע לחוסר מנוחה." |
| `blocked.length === 0` | info | "לא הוגדרו תאריכים חסומים. שקול להוסיף לפחות יום עליה / ירידה מהקו." |
| Fallback (nothing triggered) | good | "המדיניות נראית מאוזנת לפי החוקים שהוגדרו." |

### Leave board recommendations section

Phase 7.3 visual control center upgrade. Derives from live state.

| Trigger | Tone | Text example |
|---|---|---|
| Days with `breachesConcurrentCap` | warn | "{X} ימים עם יותר מ-{N} מחלקות בבית בו זמנית — שקול לפצל את הסבב." |
| `totalRuleBreaks > 0` | warn | "{Y} הפרות חוקי כיסוי לאורך החודש — בדוק את הימים המסומנים בלוח." |
| Home-day spread ≥ 4 | info | "איזון: מחלקה X בבית 10 ימים, מחלקה Y רק 3. שקול להחליף תאריכים." |
| Spread ≤ 1 and top > 0 | good | "הסבב מאוזן בין המחלקות החודש." |
| `blocked.length > 0` | info | "{Z} תאריכים חסומים מסומנים בלוח." |
| Fallback | good | "הלוח נראה תקין. אין הפרות חוקים, סבב מאוזן." |

### Mission detail "מצב מימוש בפועל" panel

Per-archetype implementation status with honest wired/partial/todo
labels. Not a recommendation per se — a disclosure. See §7.

### What the recommendations are NOT

They are NOT computed rotation plans. There is NO engine that emits
"Option A vs Option B vs Option C" candidate rotations with scores.

The user's spec called for a real recommendation engine. It is a
future slice. The current layer is **explanatory text** derived from
state. Disclosed inside the wizard helper text:

> "ההמלצות נגזרות מהבחירות בלבד — לא ממנוע סבב מחושב. הן מנחות אותך
> לעבר תכנון מאוזן, אבל לא יוצרות לוח אוטומטי."

---

## 23. Role-scoped awareness

The single most important UX principle. From the user verbatim:

> "כל role רואה: רק מה שהוא צריך לדעת או לעשות עכשיו.
> לא כל מה שהמערכת יודעת."

### How it's enforced (in 4 layers)

#### 1. Permission gates at action entry points

Every mutation entry checks `canX(user, delegations)`. Examples:

```ts
if (!canDeclareEscalation(currentUser, delegations)) return null;
if (!canApproveLeaveFor(currentUser, request, delegations)) return;
if (!canEditMission(currentUser, mission, delegations)) return;
```

This blocks unauthorized actions even when the UI is somehow rendered.

#### 2. Scope filters in derivation helpers

```ts
selectTimelineFor({events, viewerSoldierId, ...})       // scopes
activeEscalationsForViewer()                            // scopes
useApprovableLeaveRequests()                            // PC's platoon only
useAlertsForCompany()                                   // company id match
```

Every derivation that emits per-user data flows through a scope
filter.

#### 3. Surface routing

`/home` dispatches by role to one of four dashboard variants:

```tsx
if (isCompanyLeadership(currentRole)) return <CompanyCommanderDashboard />;
if (isPlatoonLeadership(currentRole)) return <PlatoonCommanderDashboard />;
if (currentUser && isRasap(currentUser)) return <RasapDashboard />;
return <SoldierDashboard />;
```

Each dashboard pulls ONLY the data relevant to that role. The
SoldierDashboard doesn't query `useAlertsForCompany()`. The PC
dashboard doesn't render other platoons' missions.

#### 4. Inline scope discipline in dashboards

Each dashboard scopes its derivation:

```ts
// PC dashboard
const myPlatoonSoldiers = useMemo(() => {
  if (!myPlatoon) return soldiers;
  const sqIds = new Set(squads.filter(sq => sq.platoonId === myPlatoon.id).map(sq => sq.id));
  return soldiers.filter(s => s.squadId && sqIds.has(s.squadId));
}, [soldiers, squads, myPlatoon]);

// Soldier dashboard
const mySlots = useMemo(() =>
  materializedSlots.filter(slot =>
    slot.assignedSoldierIds.includes(myProfile.id)
    || slot.commanderSoldierId === myProfile.id
  ),
  [materializedSlots, myProfile]
);
```

### Failure modes to avoid

- Putting "all alerts for the company" on the soldier home page.
- Putting "all platoons' timelines" on the PC home page.
- Putting "all missions in the system" on the soldier dashboard.
- Rendering the EmergencyFab for soldiers (the FAB self-gates;
  don't break that).
- Surfacing the leave-board edit affordance to a PC (it's CC-only at
  `/coverage/platoons`).

### Decision rule when adding new data to a home page

"Is this directly actionable by THIS role RIGHT NOW?"

- If yes: add it.
- If no: it belongs on a deeper page (`/alerts`, mission detail,
  dedicated module).

The home page is for **decisions + context** the role needs to start
the day. Not for "everything the system knows."

---

## 24. UX philosophy

These are not aesthetic preferences. They are operational correctness.

### 1. Decisions, not data

Every page exists to enable an OPERATIONAL DECISION. A page with no
clear next action is a page that doesn't belong. Pages that show
"information for the sake of information" tend to get ignored.

When designing a new page, ask: **what's the operator going to DO here?**

### 2. CTA quality > CTA quantity

A page with 5 buttons of equal weight produces decision paralysis.
Pick the ONE thing the operator should do here. Make it the primary
CTA. Demote everything else.

Example: the new `/missions` page action row is:
- "+ בחר מתבנית" (PRIMARY, olive)
- "התחל מ-0" (secondary, ghost)

The secondary exists for the rare custom case. The primary is for
99% of the time.

### 3. Alerts hierarchy (no top banners)

Critical state is conveyed by:
- The bell badge (`AlertsButton` in the header)
- The `/alerts` page
- The FAB's active state (for emergency)
- The FocusSection on home pages
- Inline pills inside cards

**NEVER a pink banner across the top of the page.**

The product had one in earlier phases. Multiple removal attempts
confirmed: top banners get ignored, and they steal content space
without delivering operational signal.

The user explicitly demanded the removal. Don't re-add.

### 4. Explainability

Every engine decision exposes its reasoning:
- The selector returns a `SelectorOutcome` with `decayReasons[]`.
- Each score dimension carries an `explain` string.
- The archetype implementation status is on every mission detail.
- The recommendations carry tonal classification + a reason.
- The conflict resolution chips have hint text on each action.

**The operator never sees a black-box decision.**

If you find yourself adding an opaque rule, add an explain field for
it.

### 5. Pin invariant (engineering invariant, see §30)

A pinned soldier is a HUMAN PREFERENCE, not a SYSTEM BYPASS. Pin
bonus reorders WITHIN a partition (clean vs forced); it never lifts
a forced candidate into the clean pool. Hard-coded in
`scoring.ts::computePinBonus`. Documented as a strict invariant.

### 6. Performance

The materializer runs in single-digit ms on the current seed. Every
derivation is `useMemo`-wrapped. localStorage writes are eager but
small.

If a slice you're about to add will run heavy work in a useMemo on
every render, refactor first. Most expensive operations should be:
- Memoized at the right granularity
- Run only on input change
- Bounded in time complexity

### 7. Recovery

Every destructive operation must be reversible OR explicit.

Reversible:
- Toggling a leave-day cell (click again).
- Adding/removing a coverage rule.
- Selecting/deselecting a platoon in the assignment page.

Explicit (final but logged):
- Publishing the שבצ״ק (writes an Announcement).
- Closing an emergency event (writes recovery notes to closeReason).
- Hiding a template (soft-delete via `isHidden` flag).

Avoid silent destructive operations. If you `delete` something, log
the deletion or make it undoable.

### 8. Quiet mode

The product has an under-used `useQuietMode` hook for muting
notifications during specific durations. Not central to current work
but exists.

### 9. Conflict resolution over validation

(See §18.) Surface RESOLUTION OPTIONS, not just an error.

### 10. Honest implementation status

The product shows what's wired and what's not. The
"מצב מימוש בפועל" panel on mission detail is the canonical example.
The wizard's "פעולות אחר־כך" disclosure is another.

When you add a new behavior, update the disclosure surfaces. The
product earns operator trust by being honest about its current
state.

---

## 25. Mobile constraints

The product is mobile-first PWA. Every decision must work on a phone.

### Safe area

Every fixed/sticky element MUST respect `env(safe-area-inset-*)`:

- **`Sheet` primitive**: padding-top + padding-bottom on the overlay
  ensures iOS notch / home indicator don't clip the sheet.
- **`BottomNav`**: `safe-area-bottom` utility class adds bottom
  padding for the home indicator.
- **`EmergencyFab`**: explicit
  `style={{ bottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}`.
- **`CommandMenu` drawer**: padding-top + padding-bottom inside the
  aside ensures content clears notch + home indicator.

### Dynamic viewport (100dvh)

Use `100dvh` instead of `100vh` on full-height sheets so URL-bar
collapse on iOS Safari doesn't break layout. Tested fix in
`Sheet.tsx`.

### Sheet height bug (historical, documented)

Earlier in Phase 7.3, the Sheet primitive's body collapsed to 0
height in production. Root cause: outer `flex items-end` sized inner
to content height; inner's `flex-1` body had no parent height to grow
into. Fix: inner uses `h-full sm:h-auto sm:max-h-[88vh]`. Body has
real height to engage `flex-1`. See commit `c9995f0`.

### Z-index ladder

| Layer | z-index | Notes |
|---|---|---|
| Page content | 0–10 | Default flow + small overlays |
| Header sticky | 30 | At top, sticky on scroll |
| BottomNav | 30 | At bottom, fixed |
| PersonalActionsFab | 30 | Bottom-left |
| EmergencyFab | 35 | Bottom-right, ABOVE the nav unambiguously |
| Sheets / modals / drawers | 50 | Above everything |

`z-50` covers everything below it. `z-35` is the FAB-specific layer
so the FAB is never visually behind the nav.

### Touch targets

Minimum 44×44 px on tappable elements. Buttons use `py-2.5` or higher,
nav tabs use `py-2` with a 44px effective height, FABs use `w-14 h-14`
(56px).

Spacing between adjacent buttons: at least 4px so the operator
doesn't mis-tap.

### RTL

Hebrew-first. `dir="rtl"` is on the root + every Sheet/drawer.

Tailwind utility patterns:
- Logical: `start-` / `end-` / `me-` / `ms-` — respect dir.
- Physical: `right-` / `left-` — direction-fixed.

Use physical when pinning to a specific viewport edge (e.g.
EmergencyFab on `right-5` — RTL or LTR, it's the same physical edge).

Use logical when the UI should mirror with dir (e.g. text padding,
margin between siblings).

### CommandMenu drawer pattern

`CommandMenu` is a right-pinned side drawer (`fixed top-0 right-0
h-[100dvh] width: min(360px, 90vw)`), not a Sheet-based modal. The
drawer pattern was chosen after the centered-modal pattern looked
wrong for a menu in production. Drawer pinned to physical right
edge — never off-center.

### Mobile landscape

`100dvh` covers landscape on modern browsers (Safari 15.4+, Chrome
108+). Older browsers may see slight clipping on the Sheet —
acceptable for the deployment target.


---

## 26. Backend / persistence state

### Today: localStorage only

Every persisted slice lives in `localStorage` under
`ha-pluga-sheli:state:<slice>:v<version>`.

The persistence helper `usePersistedState<T>(slice, initial, version)`
in `src/utils/persistedState.ts` wires each slice to:
- A storage key derived from slice + version
- Best-effort hydration on mount (parse errors → fallback to initial)
- Eager writes on every state change

### Slice catalog (full list)

```
allSoldiers, announcements, assignments, commandDelegations,
companyBlockedDates, companyCoverageRules, companyLeavePolicy,
currentRole, currentUser, equipmentGaps, escalationEvents,
leaveRequests, leaves, missionNotes, missions, missionTemplates,
orders, overrideAlerts, periods (legacy), platoonLeaveCycles,
platoonLeaveDays, platoons, selectorOutcomes, signedEquipment,
slotOperationalState, soldierLeaveOverrides, soldierStatusEvents,
squads, templateFamilies, users, dutyExclusions, coverageEvents,
leaveRotationPolicy, leaveBlocks, soldierHistory, miluimPeriods,
calendarEvents, missionsScheduled, leaveRotationPlans,
checklistTemplates, checklistRuns, checklistInstances,
logisticsRotations, commandAuthorities, ...
```

`clearAllPersistedState()` wipes by prefix scan — new slices
auto-clean without maintaining an explicit list.

### `SEED_VERSION`

Currently `1`. Bumping it invalidates all stored data and falls back
to fresh seeds.

Bump when:
- A breaking shape change is introduced that can't be migrated
- Demo data needs a full reset

Don't bump for additive changes — readers fall back to defaults for
missing fields, so additions are forward-compatible.

### Supabase scaffolding (unused)

`USE_SUPABASE` env flag exists. `api/_supabase.ts` initializes a
Supabase client when set. `api/_adapter.ts` is the abstraction layer
between domain API modules and either mock data or live Supabase.

The api/ modules:
- `api/_supabase.ts` — client init
- `api/_adapter.ts` — adapter pattern
- `api/_db.types.ts` — Supabase-generated DB types
- `api/index.ts` — re-export every domain module
- `api/queryClient.ts` — React Query setup
- `api/alerts.ts`, `api/announcements.ts`, `api/assignments.ts`,
  `api/equipment.ts`, `api/escalations.ts`, `api/leaves.ts`,
  `api/missions.ts`, `api/reports.ts`, `api/soldiers.ts` — domain
  modules
- `api/README.md` — documentation

**Today the flag is OFF in production.** All reads/writes hit
`localStorage`.

When the eventual cutover happens, the api/ domain modules give a
single place to wire the network layer without changing AppContext
callers. The pattern is in place; the implementation is mocked.

### Why the layer exists

Two reasons:

1. **Future cutover**: when the product gets a real backend, the
   layering above is in place. AppContext's mutations call
   `missionsApi.create()` (etc.); the adapter today returns mock
   data; tomorrow it returns Supabase queries. No AppContext changes.

2. **API surface stability**: keeping the layer means we're forced to
   think about what reads/writes the eventual backend will need. The
   shape of each domain module mirrors what the backend service would
   expose.

### Migration plan (rough)

When the time comes:

1. Define database tables matching the persisted slices. Most slices
   map 1:1 to a table.
2. Set up Supabase row-level security (RLS) policies — soldiers see
   their own data, PCs see their platoon, CCs see their company.
3. Implement the api/* domain modules as Supabase queries. The
   adapter switch flips them on.
4. Add auth (Supabase Auth or equivalent). Replace `MockUser` with
   real user records.
5. Set `USE_SUPABASE=true` in production env.
6. Migration script: load the operator's current localStorage state
   into the backend on first authenticated load. (Optional — could
   just start fresh.)

Estimated: 3-5 days for a single engineer who knows Supabase.
Significant but contained.

### Caveats

- Real-time sync (multi-device "see the change instantly") requires
  Supabase Realtime or similar. Not in the rough plan above; adds
  complexity.
- Audit log retention policies need explicit thought.
- Offline-first PWA semantics + eventual consistency need design
  work. The current product is offline-by-default; the migration
  inverts that.

---

## 27. What is real vs mock — the honest matrix

The single most important honest disclosure section in the entire
document.

### Wired (the engine actually does this)

#### Mission management
- Mission CRUD via AppContext mutations (`addMission`, `updateMission`,
  `setMissionStatus`)
- Mission templates: CRUD, favorites, hide, usage count, lastUsedAt
- Template families: CRUD, archive, custom labels
- Mission import-from-previous-order (duplicate + review)
- "Save as template" from any existing mission
- Smart-archetype wizard with hidden-step logic
- Mission detail page with archetype + warnings + implementation
  status panel

#### Schedule / staffing
- Operational orders (CRUD, status transitions)
- Materializer day/night slot splitting (static-guard with distinct
  durations)
- Materializer eligibility filter including emergency bypass
- Engine selector + scoring + hard filters (5 dimensions, 8 hard
  filter codes)
- SelectorOutcome audit records persisted
- Cross-slot overlap enforcement with symmetrical archetype consent
- Real rest-window scoring from `ctx.allSlots`
- Squad-distribution prompt before staffing
- StaffingSheet with explainability per dimension
- Burden math with archetype-aware fatigue weights + night multiplier

#### Leave management
- PlatoonLeaveDay CRUD + day-grid editor
- 7 coverage rule kinds (including command-coverage + buffer)
- Coverage rule evaluator runs per-day
- Visual leave board (blocked dates, transition arrows ↗↙, per-cell
  warnings, today/Saturday tints)
- Recommendations section (live, derived)
- Leave-planning wizard (4 steps, writes policy + blocked dates)
- Soldier leave requests + PC approval flow
- Per-soldier leave overrides

#### Emergency / escalation
- Emergency declaration via global FAB (CC + Deputy CC + delegates)
- Active state with pulsing badge across every screen
- Auto-announcement on declare AND on close
- Audit log entries
- Materializer emergency override (home → eligible)
- Recovery sheet with structured fields
- Recovery routes to `/coverage/planning` when not 'full' return
- Honest disclosure inside the sheet about what doesn't auto-happen

#### Conflict resolution
- Platoon-on-leave conflict detection
- 6-action resolution flow (add platoon / swap / keep-in-base /
  partial / open board / allow anyway)
- Real mutations behind each chip
- Save CTA badge "(N בלי פתרון)" tracks unresolved

#### Timeline
- 10 event kinds derived from snapshot
- Role-scoped selection (soldier / platoon / company)
- Severity thresholds + auto-dismiss via expiresAtIso
- Surfaces on SoldierDashboard + PlatoonMissionsPage

#### UI infrastructure
- 4 role-dispatched dashboards
- Sheet primitive (height-correct, safe-area-aware, RTL)
- CommandMenu side drawer (right-pinned, full-height, RTL)
- Permission gates via `canX(user, delegations)` + delegation banner
- Mobile-first layout, safe-area handling, z-index ladder
- Honest implementation status panel on mission detail
- Soldier-facing readiness inline card (rally + team instructions)
- Mission template library with families, search, favorites
- Squad-distribution flow before staffing

### Partial (values flow but engine doesn't fully enforce)

| Feature | Partial because |
|---|---|
| `personal-leave-buffer` rule | Compares in-base count to target; does NOT subtract mission staffing demand |
| `bodySeparation` on `CompanyLeavePolicy` | Stored, not yet enforced at materializer level |
| `shiftDurationLocked` flag | Flag exists on Mission; StaffingSheet UI doesn't yet disable controls based on it |
| `responseSurface` for readiness | Inline card exists on dashboard; no dedicated /readiness/:id soldier page |
| Mission template "recently used" sort | UsageCount + lastUsedAt populate; no per-template usage timeline UI |
| `/schedule` company-wide timeline strip | Derivation supports it; page doesn't render it |
| Soldier teamClass field | Deprecated by squadId; 109 references remain |

### Mock (zero engine enforcement)

| Feature | What's missing |
|---|---|
| Multi-device sync | No backend; localStorage only |
| Real auth | MockUser personas; UserSwitcher chip |
| Push notifications | Auto-announcement is the soldier-facing signal; no real push |
| Auto-mission-pause during emergency | Materializer bypasses home filter; doesn't pause missions |
| Auto-burden-adjustment after emergency | Recovery captures text; no auto-math |
| Auto-publish-fresh-schedule after emergency | Operator must manually publish |
| CompanyBlockedDate.requireAllInBase enforcement in materializer | Visual conflict tone only; engine doesn't auto-drop home soldiers on blocked dates |
| Conflict resolution for non-platoon-leave kinds | time-overlap, soldier-on-leave, readiness-conflict, staffing-conflict: engine blocks via hard filters, UI shows codes, no inline resolution chips |
| Recommendation engine generating rotation plans | All recommendations are text-derived from current state |
| Auto-rotation generator | None exists |
| Real device APIs | No photo capture, no scanning, no biometric |
| Equipment lifecycle enforcement | EquipmentGap + lifecycle events exist as data; engine doesn't enforce |
| Audit log surfacing | addAuditLog writes; no UI to browse |
| Compensation accounting after emergency | Burden reflects state but doesn't track "owed leave" |
| Cross-company battalion view | companyId scoped everywhere; multi-company UI not modeled |
| Reservist (מילואים) leave doctrine | Not modeled separately |
| Real-time presence | No "user X is online" indicator |

### How the product surfaces this honesty

The product shows the truth INSIDE the UI:
- Mission detail's "מצב מימוש בפועל" panel (per-archetype status grid)
- Leave-planning wizard's "פעולות אחר־כך" disclosure
- EndEmergencySheet's "לתשומת לבך" panel
- Personal-leave-buffer rule's add form note ("דרישת איוש משימות
  פעילות לא נכללת עדיין בחישוב")
- DeclareEmergencySheet's preview line + footer disclosure
- LeavePlanningWizardPage's recommendation helper text

**Do not regress this honesty.** It is the difference between a tool
and a toy.

When you wire a previously-partial behavior to fully wired, update the
disclosure surfaces. When you add new mock UI, mark it explicitly.

---

## 28. Technical debt

The honest list — in priority order by leverage.

### Architectural

#### AppContext is 2,575 lines (HIGH)

`src/context/AppContext.tsx` is a single monolithic provider. Every
new feature has added to it. The pilot-mindset memory note flagged a
planned 7-provider fanout:

1. AuthProvider (currentUser, currentRole, switchUser)
2. DataProvider (allSoldiers, soldiers, platoons, squads, companies)
3. MissionProvider (missions, addMission, etc.)
4. AssignmentProvider (assignments, slotOperationalState, etc.)
5. LeaveProvider (leaves, leaveRequests, platoonLeaveDays, etc.)
6. EscalationProvider (escalationEvents, announcements, alerts)
7. ConfigProvider (companyLeavePolicy, coverageRules, missionTemplates,
   templateFamilies, etc.)

The split is mechanical (no behavior change) but invasive — every
page that uses `useApp()` needs to be updated. Worth doing before
the next major feature.

#### 11 pages call `materializeWeek` directly (MEDIUM)

Should use `useMaterializedWeek` hook in `src/hooks/useEngineContext.ts`.
Each direct call is `useMemo`-wrapped so it doesn't thrash, but the
duplication means a future change to materializer inputs needs 11
edits. Mechanical refactor; can be done incrementally.

Pages doing direct calls:
- SchedulePage
- CalendarPage
- MissionDetailPage
- PlatoonMissionsPage
- SoldierDetailPage
- PlatoonWeekPage
- EngineDebugPage
- SoldierDashboard (in dashboards/)
- CompanyCommanderDashboard (in dashboards/)
- PlatoonCommanderDashboard (in dashboards/)
- RasapDashboard (in dashboards/)

#### No tests (HIGH long-term)

Engine helpers (`archetypeBehavior`, `operationalTimeline`,
`conflictResolution`, `missionImport`, `missionTemplates`) are all
pure and immediately testable. Adding a Vitest suite is high-leverage
and low-effort to bootstrap. 2-3 days for initial coverage of the
pure helpers; ongoing maintenance after.

Critical paths to test first:
- `getArchetypeBehavior(mission)` — output consistency per archetype
- `materializeWeek(input)` — slot id stability, day/night splitting,
  emergency bypass, eligibility chain
- `selectCandidates()` — pin invariant, clean/forced partitioning
- `evaluateHardFilters()` — each code's trigger conditions
- `deriveTimelineEvents()` — scope discipline, dedup by id

### Data

#### Legacy `periods` slice

`SchedulePeriod[]` persisted but no page reads it. Superseded by
`OperationalOrder`. Provider exposes `addPeriod` / `updatePeriod` but
no consumer. Bump `SEED_VERSION` + remove the slice from AppContext
when ready.

#### `Soldier.teamClass` deprecated

`teamClass` is the old name for what's now `squadId`. 109 references
still exist across the codebase. Cleanup pass per-file would retire
it. Tedious but not architecturally significant.

#### Mock data is 2,050 lines in one file

`src/data/mockData.ts`. Could be split per-entity (`soldiers.ts`,
`missions.ts`, etc.). Mechanical, low priority — file size doesn't
affect runtime.

### UI

#### 10 `react-hooks/purity` warnings

Pre-existing pattern: `Date.now()` inside `useMemo`. Fix by passing
`nowIso` via prop or context.

Affected files (incomplete list):
- `SoldierDetailPage.tsx`
- Various dashboard pages
- `MissionCard` inside PlatoonMissionsPage

Per-file fix; low priority. The product runs fine.

#### Legacy `PlatoonNewMissionPage`

PC quick-create with 8 hardcoded templates is reachable via "התחל
מ-0" on `/platoon/missions`. Bypasses the new template library +
archetype system. Should migrate to consume the library. 1 day of
work.

### Cleanup completed in Phase 7.3

Documented for awareness, no action needed:

- Removed 6 unused files (~500 lines): WarningBadge, Tooltip,
  EmergencyBanner, api/_bootstrap, api/index (then restored — see
  next), api/hooks
- Deleted `EscalationSheet.tsx` (replaced by `DeclareEmergencySheet`)
- Removed `useActivePeriod` hook (dead, no consumers)
- Removed in-page "פעולת חירום" card on CC dashboard (replaced by
  global FAB)
- Removed `canDeclareEscalation` import from CC dashboard (FAB
  self-gates)

`api/index.ts` was restored — 4 callsites import via `'../api'`
folder shorthand; my initial grep missed them. Always grep with
multiple patterns before deleting.

---

## 29. Future architecture

The shape of the next major slices, in implementation-cost order.

### Tier 1 — small, high-leverage

#### Materializer reads CompanyBlockedDate

When a slot's `dateIso` matches a blocked date with
`requireAllInBase: true`, drop home soldiers from eligibility for
that date (same pattern as the emergency override). The visual
conflict tone in the leave board already exists; the engine just
needs to honor it. **1 day.**

#### `/schedule` company-wide timeline strip

Helper already produces company-scoped events; the page doesn't
render them. Add an `<OperationalTimelineStrip>` block at the top of
the schedule page with the company-scoped event list. **1 day.**

#### Conflict resolution for `time-overlap`

Engine already detects time conflicts via `hasTimeConflict`; UI
shows the hard-filter code. Add a resolution chip row inside
StaffingSheet for rejected candidates with `time-conflict` failure.
Chips:
- "החלף עם המשבצת הקודמת" (move the soldier from the conflicting slot
  to this one)
- "שחרר מהמשימה הקודמת" (remove from the conflicting slot, assign here)
- "הקצה כפול בכל זאת" (force the overlap with audit note)

**1-2 days.**

#### Engine test suite (Vitest)

Bootstrap a test suite for pure helpers. Critical paths:
- `getArchetypeBehavior` — per-archetype expected output
- `materializeWeek` — slot id stability, day/night, emergency, leave filter
- `selectCandidates` — pin invariant, partitioning
- `deriveTimelineEvents` — scope discipline, dedup
- `evaluateHardFilters` — per-code triggers

**2-3 days bootstrap. Ongoing maintenance after.**

### Tier 2 — meaningful, moderate cost

#### AppContext provider fanout

7-provider split (see §28). Mechanical, no behavior change. Unblocks
every future feature. **3-5 days.**

#### Migrate PlatoonNewMissionPage to library consumer

PC's "התחל מ-0" should also go through the template library. Closes
the inconsistency where PC has a parallel template list. **1 day.**

#### `shiftDurationLocked` UI in StaffingSheet

When `mission.shiftDurationLocked === true`, disable shift-duration
controls in the StaffingSheet. Visual disabled state + tooltip
"נעול ע״י מ״פ". **0.5 day.**

#### Day/night editor inside Step 3 of the wizard

Data flows through `dayNightProfile`; the wizard step doesn't expose
day-specific vs night-specific editors. Add a panel inside the
timing step. **1 day.**

#### Auto-publish closure announcement targeting

Today the recovery sheet publishes to the same audience as the
opening event. Sometimes the right closure audience is "everyone
who was affected" — a different set. Future enhancement.

### Tier 3 — bigger investments

#### Real backend on Supabase

Multi-device sync, real auth, real persistence. Significant
infrastructure work. The api/_supabase scaffolding is in place. See
§26 for the rough plan. **3-5 days for a single engineer who knows
Supabase.**

Significant downstream effects:
- Auth UI redesign (currently MockUser personas)
- Offline-first → online-with-offline-fallback
- Real-time push for announcements / emergency
- Audit log retention policies
- Backup / disaster recovery

#### Auto-rotation generator

The Mark-IV feature. Takes:
- `CompanyLeavePolicy` (target pattern + minimums)
- `CompanyBlockedDate[]`
- `CoverageRule[]` (including command-coverage + buffer)
- Current `PlatoonLeaveDay[]` (locked entries)
- Fairness scores per platoon (historical home days)

…and emits 2-3 candidate rotations with explanations:
- "Option A: balanced — every platoon gets X home days"
- "Option B: front-loaded — גימל 2 first because they didn't get home
  last week"
- "Option C: weekend-heavy — preserves weekday operational strength"

The operator picks one. The chosen plan writes to `PlatoonLeaveDay[]`.

This is a real engine project — not a couple of helpers. **1-2 weeks
for a first usable version.**

Algorithmic considerations:
- Constraint satisfaction: try multiple seeds, score against
  fairness + coverage + blocked-date avoidance.
- Tunable via the policy modifiers (minConsecutiveBaseDays, etc.).
- Each candidate carries its score breakdown for the operator to
  understand.

#### Layered missions

A `Mission.layers: MissionLayer[]` for composite operational
responsibilities. Example: a static guard at the gate is ALSO on
כוננות כרמל א. Currently the operator creates two missions; a layered
model would unify.

Engine implications:
- Materializer emits slots per layer (might be the same slot with
  multiple labels, or separate slots).
- Overlap check considers the combined intensity set.
- Burden math accounts for the layer with the highest weight (not
  double-counted).

Significant data model change. **1-2 weeks.**

#### Mission Packages

A persisted, named bundle of mission templates. "קו עזה" might be a
package: 3 guard templates, 2 patrol templates, 1 readiness template.
"שבוע מלחמה" might pull a different set.

Foundation: template families have stable `key` values + display
labels. A package references families by key + template ids.

Data shape is straightforward; the UX is the question — how does
the operator browse, edit, and apply a package?

**1 week.**

#### Soldier-side readiness page

`/readiness/:missionId` for the assigned soldier. Live event status,
rally point + map, team listing with reachability, activation
acknowledgement.

Closes the partial `responseSurface` status for readiness.

**3-5 days.**

### Tier 4 — strategic

#### Battalion-level multi-company view

When the product expands to a multi-company unit. Adds a layer above
the company. Data model has `companyId` everywhere; the multi-company
UI is the new thing.

#### Operational-doctrine plug-in layer

Different units have different doctrine. Today the rules are baked
into helpers; a plug-in layer would let an army-wide deployment serve
different formations (infantry vs armor vs reservist vs reconnaissance).

Significant architectural surgery. Strategic, not tactical.

#### Native mobile shells (iOS / Android via Capacitor)

Currently web-only PWA. Native shells would enable push
notifications, biometric login, deep links, etc.

#### Equipment lifecycle enforcement

Today equipment is data; the engine doesn't enforce sign-in/sign-out.
A fully-modeled equipment system would track who has what, when they
got it, when it's due back.

---

## 30. Things that must never regress

If you touch the code and any of these break, STOP. Audit. Roll back.

### Engineering invariants

1. **The pin invariant** (§24.5)
   Pinned soldiers reorder within a partition; never lift forced
   into clean. `hardFiltersFailed` is computed BEFORE pin logic
   touches the score. Any future refactor that removes a hard-filter
   check based on pin presence is a regression bug.

2. **Engine purity**
   `src/utils/engine/*` and `materialize.ts` and `archetypeBehavior.ts`
   and `operationalTimeline.ts` MUST stay free of React, `Date.now()`,
   localStorage. `nowIso` is passed in. The engine is replayable.

3. **`getArchetypeBehavior` is the single archetype funnel**
   `archetypeKind === 'x'` checks live ONLY in
   `src/utils/archetypeBehavior.ts`. No other file branches on
   archetype kind directly. Phase 7.3 enforced this.

4. **Assignments survive the materializer's re-run**
   Slot ids are deterministic. The Phase 7.3 archetype migration
   preserved legacy slot ids for missions without `archetypeKind`
   (single-window `mat-<id>-<iso>-<wIdx>`). New split slots get
   segment suffix. Persisted Assignment records reference these ids;
   they MUST NOT change.

5. **`SelectorOutcome` is immutable evidence**
   Every staffing decision writes a `SelectorOutcomeRecord`. These
   are the audit trail. Don't delete or rewrite them. They serve as
   the answer to "why was X picked over Y" months later.

### UX invariants

6. **No top banners**
   The pink emergency banner was removed in Phase 6.7 after the user
   explicitly demanded its removal multiple times. Critical signals
   belong on the bell badge, /alerts, FocusSection, or inline cards.
   Top banners get ignored and steal content space.

7. **Conflict resolution, not validation error**
   When a system block triggers, surface RESOLUTION OPTIONS, not just
   an error message. (§18)

8. **Honest implementation status**
   The mission detail's "מצב מימוש" panel must reflect what's
   actually wired. Update `computeStatus()` in `archetypeBehavior.ts`
   when behavior changes. Lying here is what we promised not to do.

9. **Role scoping**
   Every new derivation that emits per-user information MUST flow
   through a viewer-scope filter. Never dump company-wide data on a
   per-role surface.

10. **Templates fill defaults; they do not skip operational questions**
    The archetype's `hiddenSteps` should only hide the questions the
    archetype TRULY answers (character/intensity). Timing, manpower,
    command, rotation, qualifications/equipment stay required for the
    operator.

### Architectural invariants

11. **No in-page emergency card**
    The "פעולת חירום" Section on the CC dashboard was removed. The
    global FAB is the canonical emergency entry. Do not re-add a
    page-local card.

12. **Creation ≠ Assignment ≠ Staffing**
    Three separate acts on three separate surfaces. Do not merge any
    two. (§8)

13. **Materializer is the slot-truth single source**
    Every page reads slots from the materializer. Don't add a
    parallel slot-generator anywhere.

14. **Sheet primitive's height fix**
    `h-full sm:h-auto sm:max-h-[88vh]` on the inner sheet. Without
    this the body collapses to 0 (the production bug in commit
    `c9995f0`).

15. **Materializer emergency override**
    When `emergencyActive: true`, home filter is bypassed. The
    `emergencyActive` flag must flow through `useEngineContext`
    AND `useMaterializedWeek` so EVERY consumer sees the same view.

### Domain invariants

16. **Patrol forbids parallel assignment**
    `archetypeBehavior.forbidsParallelAssignment` short-circuits the
    overlap check. Don't add an exception.

17. **Readiness allows specific overlap intensities**
    `activeOverlap: ['standing-guard', 'admin', 'readiness']`. Don't
    expand silently.

18. **Combat platoon rotates as a unit**
    `PlatoonLeaveDay(date, platoonId)` applies to ALL soldiers in
    that platoon. Per-soldier exceptions go through
    `SoldierLeaveOverride`. Don't add a partial-platoon home status
    without also adding the override path.

---

## 31. Known edge cases

The product has been hardened against these; documented so future
contributors don't accidentally reintroduce them.

### Slot id collisions on archetype change

`mat-<missionId>-<iso>-<windowIdx>` for un-split missions.
`mat-<missionId>-<iso>-<windowIdx>-<segIdx>` for split missions.

If you change a mission's archetype from `static-guard` (split) to
`custom` (not split), the slot ids change shape — persisted
assignments for that mission would orphan. The migration safe-path:
**don't change archetype on a live mission with assignments**. The
wizard's edit flow today allows it. If you expose archetype change
post-publish, add a confirmation: "Switching archetype may invalidate
existing assignments. Continue?"

### Mission with `assignedPlatoonIds: []`

A mission can exist without an assigned platoon (post-creation,
pre-assignment). Materializer's `resolveRotation()` produces
`ownerPlatoonId = null` for these → soldiers have no
`wrong-platoon` filter but no `ownerPool` either → slot stays
`'open'`. Visible on `/missions` as `'active-unstaffed'`. Don't
auto-assign in code; the operator decides via `/missions/:id/assign`.

### Delegation expiration mid-action

`CommandDelegation` is time-bounded. If a delegation expires WHILE
the operator is mid-flow (e.g. mid-emergency-declaration), the
permission gate at submit time may reject. The wizard re-checks on
submit, so this is safe. The visual state may briefly show the
operator as having permission they no longer have — accepted UX
cost.

### Concurrent emergency events

`activeEscalationsForViewer().length` could be > 1 if two events are
declared in parallel. The FAB shows the count `(N)` and opens the
END sheet on the first one. Closing them in declared order is the
implicit assumption. A multi-event UI would need a picker — not
built today.

### Materializer + emergency: leave-board visual drift

When emergency is active, the leave board cells STILL show purple
(`home`). The engine ignores them, but the board UX doesn't reflect
that. Operator sees "מחלקה בבית" while soldiers from that platoon are
showing up in StaffingSheet.

The visual drift is INTENTIONAL today — preserves the "what the
schedule said" record. Adding an emergency-aware overlay on the
leave board ("emergency state — leave ignored") would be a polish
item.

### Day/night split slot count explosion

A static-guard with `day=120m / night=180m` produces ~11 slots/day.
Over 7 days × 75 soldiers eligibility check = ~5,800 evaluations.
Currently under a frame budget but the upper bound grows as
templates get richer.

If you add a third period to `dayNightProfile` (e.g. evening twilight),
the expansion compounds. Profile carefully.

### Soldier in a squad with no `platoonId`

`Soldier.squadId` may be unset for company-staff. Materializer's
`soldiersInPlatoon()` skips them. Hard filter `wrong-platoon` skips
them. They cannot be staffed via the auto-pick path. They CAN be
forced via direct assignment.

Don't loop without that fallback. If you build a "fill all open
slots" automation, ensure it doesn't infinite-loop on slots that
have no eligible auto-picks.

### Recommendation calc with empty seed

`recommendations` on the leave board falls back to "הלוח נראה תקין"
when none of the rule branches trigger. Fresh installs with no leave
data hit this. Don't show "good — balanced" before any rotation has
been planned. Soft polish item.

### Mission template with stale qualifications

If a mission template references qualification ids that no longer
exist (qualification was deleted), the template's `payload.qualifications`
points to dead ids. The import-review surface flags this; the
`buildMissionFromTemplate` helper filters them out. The template
itself isn't auto-cleaned. Operator should re-save or hide stale
templates.

### Soldier referenced in `responseTeams[].soldierIds`

If a soldier is in a `selectionMode: 'soldiers'` response team and
leaves the platoon (or company), the reference goes stale. The
soldier-facing readiness card no longer matches. The mission detail
shows "your team" highlight for whoever currently matches — if no
one does, the team's soldier list is correct but the highlight is
absent.

Future: garbage-collect stale soldier ids in response teams on
soldier deletion.

### Coverage rule `team-together` / `mutual-exclusion` not evaluated

These rule kinds exist in the type union but the leave-board
evaluator doesn't have branches for them. They show in the rule list
but warning per-day doesn't trigger. Tech debt.

### Long mission names + small screens

`Mission.name` is free text. On a 320px-wide phone, a long name
overflows. The product uses `truncate` in most places but some
detail headers don't. Audit when designing new surfaces.

### `EscalationEvent.endTime` for planned events

When `endKind === 'planned'`, the operator should set `endTime`. The
DeclareEmergencySheet doesn't expose `endTime` editing today —
defaults to undefined even for `planned`. Honest gap.

---

## 32. What the system does NOT understand yet

The honest list. Adding these is real work, not refactoring.

### Composition / structure

1. **Layered missions** — a mission has exactly one archetype today.
   A real "static guard that's also on כוננות" needs the layer model.
2. **Mission packages** — no persisted bundles of templates.
3. **Multi-post static-guard** — one mission = one set of slots. A
   mission with 3 named posts (gate / tower-A / tower-B) each with
   its own count + qualification needs a richer `MissionManpowerSpec`.
4. **Cross-company / battalion-level view** — companyId scoped
   everywhere; multi-company UI not modeled.

### Generation / engine

5. **Auto-generated rotation** — no engine emits candidate plans.
6. **Auto-mission-pause during emergency** — materializer bypasses
   home filter; doesn't pause missions or auto-redirect them.
7. **Auto-recovery after emergency** — no auto-rollback of missions,
   auto-burden-adjustment, or auto-publish.
8. **CompanyBlockedDate.requireAllInBase enforcement** — visual
   conflict only, materializer doesn't auto-drop home soldiers.
9. **Recommendation engine** — text-derived only, not generative.

### Per-soldier visibility

10. **Per-soldier internal-rotation visualization** — the leave board
    shows platoons, not soldiers within a platoon.
11. **חפ״ק / מפלג internal sub-rotation visualization** — these run
    by CoverageRule, not by day-grid. No surface for "who specifically
    in חפ״ק is in base today."
12. **Soldier reachability / contact** — the system knows phone
    numbers but doesn't expose call/WhatsApp actions in the readiness
    card.

### Operational rules

13. **Sabbath / weekend variance** beyond `noWeekendTransition`. No
    modeling for "no leave starting Friday afternoon."
14. **Compensation accounting after emergency** — burden reflects
    state but doesn't track "owed leave."
15. **Reservist (מילואים) leave doctrine** — separate from base
    rotation. Not modeled.
16. **שעות שירות weekly/monthly caps** — IDF doctrine on max hours;
    not enforced.
17. **Pair-exclusion beyond `mutual-exclusion`** — no "Soldier X and
    Soldier Y must never patrol alone together at night."

### Real-world integrations

18. **Push notifications** — auto-announcement only.
19. **Real auth** — MockUser personas.
20. **Multi-device sync** — localStorage only.
21. **Audit log surfacing** — addAuditLog writes; no UI.
22. **Equipment lifecycle enforcement** — data exists, engine doesn't
    enforce.

### Conflict types not yet resolution-flow-wired

23. **time-overlap** — engine blocks, no inline chips
24. **soldier-on-personal-leave** — engine blocks, no inline chips
25. **readiness-conflict** (two readiness with contradicting rally points)
26. **staffing-conflict** (under/over-strength)

---

## 33. What the engine already understands

The flip side — what NOT to re-build.

1. **Mission archetypes** (5 of them) with per-archetype behavior
   flags + day/night splitting + fatigue weighting + overlap policy.
2. **Real cross-slot time-conflict** with symmetrical archetype
   consent.
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
    multi-axis filters, usage count, last-used tracking.
11. **Mission import-from-previous-order** flow.
12. **Visual leave board** with blocked dates, transition arrows,
    per-cell warnings, recommendations.
13. **Leave-planning wizard** (4 steps, writes policy + blocked dates).
14. **7 coverage rule kinds** including OR-of-roles command-coverage
    + percent-or-absolute personal-leave-buffer.
15. **Permission system** with delegations + functional-role grants.
16. **Role-scoped dashboards** for soldier / PC / CC / Rasap.
17. **Soldier-facing readiness card** with rally + team-specific
    instructions inline.
18. **Audit logging** for declarations / closures / mutations (writes
    correctly; UI surfacing is the gap).
19. **Pin system** with strict invariant (never lifts forced into
    clean).
20. **Override paths** at every level: per-soldier leave override,
    operator-confirmed staffing, force-fill in StaffingSheet,
    explicit allow-anyway in conflict resolution.

---

## 34. Suggested next milestones

In priority order based on operational impact vs implementation cost.

### Tier 1 — small, high-leverage (1-3 days each)

| # | Title | Effort | Impact |
|---|---|---|---|
| 1 | `/schedule` company-wide timeline strip | 1 day | High visibility for CC |
| 2 | Materializer reads CompanyBlockedDate.requireAllInBase | 1 day | Closes a visible honest gap |
| 3 | Conflict resolution for `time-overlap` | 1-2 days | Removes a common operational frustration |
| 4 | Engine test suite (Vitest bootstrap) | 2-3 days | High future-leverage, low present cost |
| 5 | Migrate PlatoonNewMissionPage to library consumer | 1 day | Closes the PC inconsistency |
| 6 | `shiftDurationLocked` UI in StaffingSheet | 0.5 day | Closes a "partial" status |
| 7 | Day/night editor inside Step 3 of wizard | 1 day | Improves wizard UX |

### Tier 2 — meaningful, moderate cost (3-7 days each)

| # | Title | Effort | Impact |
|---|---|---|---|
| 8 | AppContext provider fanout | 3-5 days | Unblocks every future feature |
| 9 | Auto-archive completed missions | 1 day | Reduces UI clutter |
| 10 | Recovery → re-balance recommendations | 2-3 days | Closes the emergency-recovery gap |
| 11 | Soldier-side dedicated readiness page | 3-5 days | Closes the partial responseSurface |

### Tier 3 — bigger investments (1-2 weeks)

| # | Title | Effort | Impact |
|---|---|---|---|
| 12 | Real backend on Supabase | 3-5 days | Transformational — enables multi-device |
| 13 | Auto-rotation generator | 1-2 weeks | The Mark-IV feature for leave |
| 14 | Layered missions | 1-2 weeks | Enables real operational composition |
| 15 | Mission Packages | 1 week | Strategic templating |

### Tier 4 — strategic (multi-week)

| # | Title | Effort |
|---|---|---|
| 16 | Battalion-level multi-company view | 2-3 weeks |
| 17 | Operational-doctrine plug-in layer | 3-4 weeks |
| 18 | Native mobile shells (Capacitor) | 2-3 weeks |

### Decision framework for prioritization

When picking what's next, ask:

1. **Does it close an honest "mock" disclosure?** If yes, it earns
   operator trust. Prioritize.
2. **Does it unlock other features?** AppContext fanout, Supabase,
   test suite all do this.
3. **Does it solve a daily operational pain?** Time-overlap
   resolution, mission packages, rotation generator.
4. **Is it strategic vs tactical?** Strategic items take longer but
   shape the product's long-term trajectory.

The recommended order for a single engineer over 6 months:

**Month 1**: Tier 1 items #1-#6. Quick wins, honest disclosure
closes. Build operator trust.

**Month 2**: Tier 2 #8 (provider fanout). Unblock everything.
Continue Tier 1.

**Month 3**: Tier 3 #12 (Supabase). Real backend. Significant.

**Month 4-5**: Tier 3 #13 (auto-rotation generator) OR Tier 3 #14
(layered missions) — pick based on operator feedback. Both are
ambitious.

**Month 6**: Tier 4 strategic — pick what the operator's growth
needs.

---

## 35. Glossary

Hebrew operational vocabulary the system uses + translations.

### Roles

- **מ״פ** — Mefaked Pluga — Company Commander (CC)
- **סמ״פ** — Sgan Mefaked Pluga — Deputy CC
- **מ״מ** — Mefaked Machlaka — Platoon Commander (PC)
- **סמל** — Samal — Platoon Sergeant / Deputy PC
- **מ״כ** — Mefaked Kita — Squad Commander
- **רס״פ** — Rasap — Quartermaster / Logistics Chief
- **סרס״פ** — Srasap — Deputy רס״פ
- **שליש** — Shalish — Adjutant / Admin staff
- **חייל** — Chayal — Soldier

### Units

- **פלוגה** — Pluga — Company (~75 soldiers)
- **מחלקה** — Machlaka — Platoon (~18-22 soldiers)
- **כיתה** — Kita — Squad (~6-8 soldiers)
- **גימל** — Gimel — common platoon naming prefix ("גימל 1" / "גימל 2")
- **חפ״ק** — Chappak — Forward Command Element
- **מפלג** — Maflag — Logistics platoon
- **גדוד** — Gdud — Battalion (out of scope)

### Operational terms

- **שבצ״ק** — Shavatzak — Schedule / duty roster
- **צו** — Tzav — Operational order
- **משימה** — Mesima — Mission
- **שמירה** — Shmira — Guard duty
- **סיור** — Siur — Patrol
- **כוננות** — Konenut — Readiness / standby
- **הקפצה** — Hakpatza — Emergency call-up
- **חמ״ל** — Chamal — Operations room
- **תעוז** — Teooz — Outpost / position
- **נצפ״ה** — Nitzpe — Observation post
- **מארב** — Maarav — Ambush
- **תרגיל** — Targil — Drill / exercise
- **ביקורת** — Bikoret — Inspection
- **עליה לקו** — Aliya LaKav — Line-up day (start of operational period)
- **ירידה מקו** — Yerida MeHaKav — Line-down day (end of operational period)
- **זיכוי** — Zikui — Credit / compensation day
- **קו** — Kav — The line / operational front

### Roles by qualification

- **קלע** — Kala — Sniper
- **קלע חוד** — Kala Chud — Lead sniper
- **נגביסט** — Negbist — Negev (machine gun) operator
- **נגביסט חוד** — Negbist Chud — Lead Negev
- **חובש** — Chovesh — Medic
- **מטוליסט** — Matlulist — Mortar operator
- **מאגיסט** — Mag-ist — MAG (machine gun) operator
- **רובאי** — Rovai — Rifleman
- **קשר** — Kesher — Signaler / radio operator
- **רחפן** — Rachpan — Drone operator

### Leave terms

- **בית** — Bayit — Home
- **בבסיס** — BaBasis — In base
- **חופשה** — Chufsha — Leave
- **יציאה** — Yetzia — Leave / departure
- **חזרה** — Chazara — Return
- **מילואים** — Miluim — Reserve duty
- **תרגיל** — Targil — Drill

### Process terms

- **פרסום** — Pirsum — Publish
- **שיוך** — Shiyuch — Assignment
- **איוש** — Iyush — Staffing
- **שיבוץ** — Shibutz — Scheduling / slotting

---

## 36. File map

Where things live. Use this when exploring the codebase.

### `src/types/index.ts` (3,500+ lines)

The domain model. Every entity, every union, every enum. Read first
when learning a new concept.

Key sections:
- Lines 1-200: Soldiers, ranks, operational roles
- Lines 200-500: Squads, platoons, companies
- Lines 500-1100: Leaves, leave requests, leave cycles
- Lines 1100-1300: Missions (the big one)
- Lines 1300-1500: Operational orders, blocked dates
- Lines 1500-1700: Coverage rules, leave policy
- Lines 1700-1900: Assignments, slots, operational state
- Lines 1900-2200: Announcements, escalation events
- Lines 2200-2600: Audience model, audit logs
- Lines 2600-3000: Engine context, score, burden
- Lines 3000-3500: Misc (equipment, checklists, etc.)

### `src/context/AppContext.tsx` (2,575 lines)

The monolithic provider. Read top-to-bottom once. Sections:
- Lines 1-200: Imports + types
- Lines 200-500: State hooks + persisted slices
- Lines 500-1500: Mutations
- Lines 1500-2300: Derivation helpers + sub-hooks
- Lines 2300-2575: Provider value + exports

### `src/utils/`

Pure helpers, no React. Each file is independently importable.

- `archetypeBehavior.ts` — single funnel for archetype runtime decisions
- `calendar.ts` — date helpers
- `commandRank.ts` — rank string ↔ enum
- `conflictResolution.ts` — conflict detection + resolution options
- `id.ts` — `newId(prefix)` for stable id generation
- `leaveCycleProjection.ts` — older leave cycle helpers
- `materialize.ts` — the slot materializer
- `missionArchetypes.ts` — the 5 archetype definitions
- `missionImport.ts` — duplicate / import-from-order
- `missionSummary.ts` — mission → human sentence
- `missionTemplates.ts` — template library helpers
- `operationalTimeline.ts` — timeline event derivation
- `persistedState.ts` — localStorage hook
- `permissions.ts` — `canX(user, delegations)` helpers
- `resolveSoldier.ts` — mockUser → Soldier resolver
- `timeline.ts` — legacy platoon-only timeline (older surface)

### `src/utils/engine/`

The staffing engine. Pure, replayable, deterministic.

- `index.ts` — re-exports
- `defaults.ts` — engine default values + `resolveRequiredRestHours`
- `hardFilters.ts` — yes/no eligibility, 8 codes
- `scoring.ts` — 5-dimension score
- `selector.ts` — `selectCandidates()`
- `burden.ts` — 3-layer burden model
- `focus.ts` — "what to decide now" items

### `src/hooks/`

React hooks bridging state to UI.

- `useEngineContext.ts` — builds EngineContext + provides `useMaterializedWeek`
- `useChaosContext.ts` — chaos-mode wrapper for testing engine output
- `useQuietMode.ts` — notification mute timer

### `src/components/`

UI primitives + complex sheets.

- `ui/` — design-system primitives (Sheet, Button, Card, Section, etc.)
- `BottomNav.tsx` — floating bottom navigation
- `Header.tsx` — sticky top header (with hamburger button)
- `CommandMenu.tsx` — the side-drawer menu
- `EmergencyFab.tsx` — floating emergency button
- `DeclareEmergencySheet.tsx` — declare flow
- `EndEmergencySheet.tsx` — close + recovery flow
- `MissionImportSheet.tsx` — duplicate / import flow
- `MissionTemplateLibrarySheet.tsx` — library browser
- `OperationalTimelineStrip.tsx` — timeline UI
- `PersonalActionsFab.tsx` — soldier toolbox FAB
- `SquadDistributionSheet.tsx` — pre-staffing distribution picker
- `StaffingSheet.tsx` — the slot staffing UI
- `SlotOperationsSheet.tsx` — per-slot operator manipulations
- `ChecklistRunSheet.tsx` — checklist UI
- `AnnouncementsStrip.tsx` — announcements list
- `AlertsButton.tsx` / `AlertsSheet.tsx` — bell badge + alerts list
- `DelegationBanner.tsx` — active delegation indicator
- `UserSwitcher.tsx` — demo persona switcher
- `ErrorBoundary.tsx` — error catcher
- ... (40+ more)

### `src/pages/`

Route handlers. Each is lazy-loaded.

- `LoginPage.tsx` / `StartPage.tsx` / `CreateCompanyPage.tsx` — onboarding
- `DashboardPage.tsx` — `/home` role router
- `dashboards/` — per-role dashboard variants
- `SchedulePage.tsx` — `/schedule` (CC) — orders + missions
- `MissionsPage.tsx` — `/missions` (CC) — mission list + library
- `MissionWizardPage.tsx` — `/missions/new` — full wizard
- `MissionAssignPage.tsx` — `/missions/:id/assign` — assignment flow
- `MissionDetailPage.tsx` — `/mission/:id` — mission detail
- `PlatoonMissionsPage.tsx` — `/platoon/missions` (PC)
- `PlatoonWeekPage.tsx` — `/platoon` (PC) — week grid
- `PlatoonNewMissionPage.tsx` — `/platoon/missions/new` (legacy)
- `PlatoonLeaveBoardPage.tsx` — `/coverage/platoons` — leave board
- `LeavePlanningWizardPage.tsx` — `/coverage/planning` — planning wizard
- `LeavesPage.tsx` — `/leaves` (commanders) — leave queue
- `LeaveCyclePage.tsx` — `/leave-cycle` (CC) — older cycle editor
- `SoldiersPage.tsx` — `/soldiers` — roster
- `SoldierDetailPage.tsx` — `/soldier/:id` — per-soldier detail
- `ProfilePage.tsx` — `/profile` — user profile
- `EquipmentPage.tsx` — `/equipment` — personal equipment
- `EquipmentInventoryPage.tsx` — `/equipment/inventory` — inventory
- `AnnouncementsPage.tsx` — `/announcements`
- `AlertsPage.tsx` — `/alerts`
- `CalendarPage.tsx` — `/calendar`
- `Report1Page.tsx` — `/report1` — company state
- `RasapPage.tsx` — `/rasap` — logistics chief surface
- `LogisticsRotationsPage.tsx` — `/rasap/rotations`
- `CoveragePage.tsx` — `/coverage` — coverage summary
- `DelegationsPage.tsx` — `/delegations`
- `DemoGuidePage.tsx` — `/demo-guide` — demo personas list
- `PlatoonGapsPage.tsx` — `/platoon/gaps` — PC's gaps view
- `PlatoonStructurePage.tsx` — `/platoon/:id/structure` — platoon structure editor
- `EngineDebugPage.tsx` — `/engine/debug` — engine inspection

### `src/data/mockData.ts` (2,050 lines)

Seed data. Read sparingly — it's data, not logic. But know what's
seeded:
- 75 soldiers
- 13 mock users (operators)
- 3 combat platoons + 1 חפ״ק + 1 מפלג
- 4 active missions
- 10 doctrine families + 9 seed templates
- 2 blocked dates
- Default leave policy + coverage rules

### `src/App.tsx`

The route map. Sections:
- Imports (lazy + eager)
- `FULL_SCREEN_PATHS` (login / start / create)
- `AppRoutes` — the Routes block
- `App` — the outer providers

### `src/providers/`

- `AppProviders.tsx` — wraps everything in AppContext + AuthProvider +
  AlertsProvider + ErrorBoundary

### `src/api/`

The Supabase scaffolding. Today mostly unused.

### `index.html`, `vite.config.ts`, `tailwind.config.js`, `tsconfig.json`

Build infrastructure. Don't touch unless you know why.

---

## Closing

Read this once at onboarding. Re-read sections as you touch them.

When you ship a substantial change, **update this document in the
same PR** — the file is the source of truth for "how the product
thinks." Stale documentation is worse than no documentation; it
actively misleads.

The product is honest about its gaps. Keep it that way.

— maintained alongside the developer's memory bank:
  - `feedback_pilot_mindset.md`
  - `feedback_engine_ux_principles.md`
  - `feedback_deploy_each_change.md`
  - `project_shavatz_na.md`
  - `project_mission_operations_layer.md`

**Project**: הפלוגה שלי (formerly שבץ-נא)
**Repository**: github.com:YoavBenMoshe20b/shabetz-na
**Production**: https://shabetz-na.vercel.app
**Stack**: React 19 · Vite · TypeScript strict · Tailwind · RTL Hebrew · PWA
**Architecture**: localStorage today · Supabase scaffolding ready · pure engine
**Last major phase**: Phase 7.3 — archetypes, conflict resolution, emergency state, leave planning wizard, operational timeline, visual leave board

