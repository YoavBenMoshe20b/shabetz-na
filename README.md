# שבץ־נא · Shabetz-na

מערכת ניהול שמירות, שיבוצים ומילואים ברמת מחלקה / פלטון.
A platoon-level scheduling and manpower management PWA, built mobile-first in Hebrew (RTL).

> **Status:** Frontend MVP. Mock data only — no backend, no Firebase, no real auth.
> Authentication is mocked and **must** be replaced with Firebase Auth (or equivalent) before production.

---

## What it does

* Onboarding flow — soldier joins an existing platoon by code/QR, or a manager creates a new platoon and invites others.
* Schedule period engine — manager defines a period, adds mission types (guard, ops room, kitchen, standby, patrol…) with timing, role, equipment, mixing, and conflict rules, then auto-generates a draft schedule.
* Constraint-aware generator — fairness scoring across periods (guard hours, night shifts, mission-type repetition, rest gap), enemy-confusion within shift bounds, mission-conflict rules, class mixing.
* Manager-only warnings — understaffing, missing roles, class violations, insufficient rest, unfair distribution. Hidden from soldiers.
* Manual override — manager can click any slot to swap, remove, or force-assign a soldier, or regenerate just that one slot. The system assists; the commander decides.
* Daily manpower report — who's on base / at home / unavailable, breakdown by class, pending leave requests with inline approve/reject.
* Soldier dashboard — current operational state, "המשמרת הבאה שלי" countdown with teammates, and a "תעיר אותי" reminder (5 / 15 / 30 / 60 min).
* Leave requests — soldier submits → manager (מ״מ / סמל) approves or rejects.

---

## Tech stack

* React 18 + TypeScript
* Vite 8
* Tailwind CSS 3 (custom `mil-*` palette: warm cream, light olive, sand, no black/dark backgrounds)
* React Router v6 with role-based `ProtectedRoute`
* React Context API for global state — no Redux, no backend SDK

---

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production bundle
```

## Demo accounts (mock auth, password: `Test@1234`)

| Username   | Name           | Role     | Has platoon? |
| ---------- | -------------- | -------- | ------------ |
| `yosi123`  | יוסי כהן       | Owner    | Yes (מחלקה א׳) |
| `david99`  | דוד לוי        | Manager  | Yes (מחלקה א׳) |
| `moshe7`   | משה ישראלי     | Soldier  | Yes (מחלקה א׳) |
| `amit22`   | עמית גרין      | Soldier  | **No** — sees the StartPage |

You can also click "הרשמה" on the login screen to create a brand-new user, which lands on the same StartPage flow.

---

## Project structure

```
src/
  pages/
    LoginPage.tsx         # Login + Register tabs (identity only)
    StartPage.tsx         # "join existing" vs "create new" choice
    JoinPlatoonPage.tsx   # 4-step join flow (code → role/class → leaves → done)
    CreatePlatoonPage.tsx # 5-step create flow (name → roles → command → confusion → invite code)
    DashboardPage.tsx     # Manager: action cards · Soldier: ops + next-shift + wake-me-up
    SchedulePage.tsx      # Period hub + 5-step mission wizard + warnings + override modal
    LeavesPage.tsx        # Approved leaves + leave-request approval queue
    ReportPage.tsx        # Daily manpower report
    SoldiersPage.tsx · ProfilePage.tsx · MyGroupsPage.tsx · ...
  components/
    Header.tsx · BottomNav.tsx · ProtectedRoute.tsx · WarningBadge.tsx
  context/
    AppContext.tsx        # All global state · login / register / joinGroup / createGroup
  utils/
    scheduleAlgo.ts       # Engine: generateSchedule · regenerateSlot · applyEnemyConfusion
    permissions.ts        # canEditSchedule / canPublishSchedule / canTriggerEmergency / ...
  data/
    mockData.ts           # Soldiers, periods, leaves, history, groups
  types/
    index.ts              # MissionType · TimeSlot · ShiftWarning · FairnessScore · ...
```

---

## Engine architecture (high level)

1. Manager creates a `SchedulePeriod` (name + start/end).
2. Manager adds `MissionType`s inside the period, each with min/recommended/max soldiers, required roles, shift bounds, conflict & overlap rules, soldier-mixing & class-mixing policies, equipment, and enemy-confusion settings.
3. `generateSchedule(ctx)` runs:
    - hard-constraint filter: leave overlap, mission conflicts, dedicated-mission rule, class-mixing rule, rest gap (≥6h)
    - soft fairness scoring: current-period load · lifetime hours · mission-type repetition · night/difficult shift count · last-assignment recency · role-match bonus
    - greedy pick of `recommendedSoldiers` lowest scores per slot
    - returns updated mission types + manager-only warnings + per-soldier fairness scores
4. Manager can manually override any slot or call `regenerateSlot()` to re-pick one slot only.
5. When ready, manager clicks "פרסם" — soldiers can now see the schedule on their dashboards.

All warnings carry `managerOnly: true`. The soldier UI never displays them.

---

## What's intentionally not done yet

* No real auth / backend. Login is a string compare against `mockUsers`.
* No persistence — refreshing the page resets state.
* No push notifications. "תעיר אותי" sets a `ReminderSetting` in context but doesn't fire anything.
* No real AI — the engine is heuristic. Architecture is shaped to be replaced with a real solver later.
* QR codes are placeholder boxes; share/copy buttons use `navigator.share` / `navigator.clipboard` if available.
* No tests. Manual QA only.

See `REVIEW_GUIDE.md` for a step-by-step walkthrough of every flow.
