# Review Guide · שבץ־נא

This document walks a reviewer through every flow in the MVP. The whole app is frontend-only with mock data — refresh resets state. Run `npm run dev` and open http://localhost:5173.

> **Note:** This is an MVP. Auth is mocked, there is no backend, no persistence between page reloads, and no push notifications. The focus is on correct operational flow and UX, not infrastructure.

---

## 1. Login & Register

Open the site → you land on `/login`.

* **Login tab** is the default. Click any user in the "משתמשי דמו" panel at the bottom to autofill credentials, then "התחברות".
* **Register tab** lets you create a fresh user with no platoon. Try `Test@1234` for the password (it satisfies the live-validated rules).
* Login screen is identity-only — no platoon-related buttons appear here.

After login/register:

* Users **with** a platoon → `/dashboard`
* Users **without** a platoon → `/start`

**Test:** click "amit22" in the dev panel (no group) → land on `/start`.

---

## 2. StartPage — choose path

`/start` shows two big cards:

1. **"הצטרף למחלקה קיימת"** → `/join-platoon`
2. **"צור מחלקה חדשה"** → `/create-platoon`

There is no bottom navigation here — the user hasn't chosen a context yet.

---

## 3. Join existing platoon (4 steps)

`/join-platoon`

* **Step 1:** Enter a platoon code. Use the demo: **`UNIT-4821`**. (Mock QR placeholder is shown but not functional.)
* **Step 2:** Confirm platoon info. Pick a role from the platoon's `availableRoles` and a class (`כיתה 1` / `כיתה 2` / `כיתה 3` / `מפקדה` / `אחר`).
* **Step 3:** Optional — submit one or more leave requests with date/time/reason.
* **Step 4:** Success screen. "כניסה למחלקה →" goes to the soldier dashboard.

**What to test:**

* Wrong code → friendly error in Hebrew, lets you retry.
* If you added leave requests, log in as `david99` (manager of `מחלקה א׳`) and verify they appear in the pending-approval queue.

---

## 4. Create new platoon (5 steps)

`/create-platoon`

* **Step 1:** Platoon name + unit + headcount.
* **Step 2:** Define available roles. Preset chips (`קלע`, `חובש`, `נגביסט`, `מאגיסט`, `קשר מ״מ`, `רחפן`, `מ״מ`, `סמל`, `מ״כ`, `תצפיתן`) + a "+ custom" input. Selected roles are what soldiers can pick when they join.
* **Step 3:** Commander (מ״מ) and Sergeant (סמל) names. They're auto-promoted to managers.
* **Step 4:** Enemy confusion toggle. If enabled, slider for deviation (5–60 min). The system clamps deviation to `(maxShift − minShift) / 2` per mission so it never violates shift bounds.
* **Step 5:** Success — generated invite code (`UNIT-XXXX`), QR placeholder, share/copy buttons, "התחל לבנות שיבוץ" → `/schedule`.

**What to test:**

* Custom role you added in step 2 should show up in the join flow for soldiers entering the new code.

---

## 5. Manager dashboard

Login as `yosi123` (owner) or `david99` (manager).

You see:

* Platoon header with name + unit + miluim period.
* Two large action cards: **"הכנס משימות לתקופה"** and **"הכנס יציאות"**.
* "מצב כוח אדם" stats: בבסיס / בבית / לא זמין, plus a "צפה בדוח כוח אדם מלא" button.
* "בקשות יציאה ממתינות" — inline approve/reject for any pending requests.
* Bottom nav: מצב · שיבוץ · דוח · חיילים · יציאות (· בלת״מ).

---

## 6. Soldier dashboard

Login as `moshe7`.

You see:

* Greeting with platoon + class + role.
* "מצב כרגע" — grid of currently-active missions and who's assigned (computed from wall-clock time vs. slot windows).
* "המשמרת הבאה שלי" — countdown, time, teammates, and the **"תעיר אותי"** wake-me-up panel with `5 / 15 / 30 / 60` min buttons. Selection is highlighted; "✓ נקבעה תזכורת" appears.
* "חיילי המחלקה" — full roster with status dots: green = on base, yellow = at home, gray = unavailable.
* No manager warnings. No fairness data. No edit affordances.

**What to test:**

* Soldier never sees warnings or fairness output.
* Soldier sees only published periods on `/schedule`.

---

## 7. Schedule period engine

`/schedule` (manager only for editing, soldier for viewing).

* Period selector at top — switch between periods, click "+ תקופה" to create one (name + start/end).
* For the selected period: stats (משימות / משמרות / בעיות), "הוסף משימה", "חשב שיבוץ", "פרסם".

**Mission wizard (5 steps)** — opens via "+ הוסף משימה" or clicking "ערוך" on any mission:

1. שם וקטגוריה
2. כוח אדם + זמני פעילות + משך משמרת + min/max דקות + recurring vs manual slot
3. תפקידים נדרשים + ערך־ ל־מ״מ / חובש + ציוד
4. חפיפות + ערבוב חיילים + ערבוב כיתות
5. קאדר + בלבול אויב (with live "deviation must stay within `(max−min)/2`" validation)

**Click "חשב שיבוץ"** — runs the engine. After it finishes:

* The "אזהרות מנהל" panel appears (manager-only) with critical / warning / info severity groupings.
* The "איזון עומסים" panel (collapsible) shows per-soldier load index (0–100), current-period hours, total hours, with bars colored by `flag: overloaded | underloaded | balanced`.

**Click any time slot** — opens the manual-override modal:

* Lists currently assigned soldiers with "הסר" buttons.
* Soldier picker dropdown + "+ שבץ ידנית".
* "↻ חשב משמרת זו מחדש" — re-runs the engine for that one slot only.
* Footer: "הסידור הוא עזר. ההחלטה הסופית בידי המפקד."

**Click "פרסם"** — soldiers can now see this period.

---

## 8. Leave management

`/leaves` (manager only).

* Two tabs:
    1. **יציאות מאושרות** — currently-approved leaves (individual / class / platoon-wide), with "הוסף יציאה" form.
    2. **בקשות ממתינות** — soldier-submitted requests with inline approve/reject.

When a manager approves a request, the soldier's status flips to "בבית" automatically wherever applicable.

---

## 9. Daily manpower report

`/report` (manager only). Click "דוח" in the bottom nav or the "צפה בדוח כוח אדם מלא" link from the dashboard.

* Horizontal date picker (period days, with leave-count badges).
* Daily stats: בבסיס / בבית / לא זמין.
* Breakdown by class with progress bars.
* Active missions for the selected day, with night-shift indicator.
* Pending leave requests (inline approve/reject).
* Soldiers on leave for the selected date.

---

## 10. Manager warnings — what to look for

After clicking "חשב שיבוץ" with the seeded period (`שבוע 12–18 במאי`), you should see a mix of:

* **קריטי** — `understaffed`, `missingRole`, `onLeave` (soldier scheduled while on leave).
* **אזהרה** — `commanderMissing`, `medicMissing`, `classViolation`, `insufficientRest`, `confusionViolation`.
* **מידע** — `unfairDistribution` if hours spread > 12h between max-loaded and min-loaded soldier.

**Test:** assign s2 (רוני שמש) to a slot during their leave (2024-05-20) — re-run the engine — `onLeave` warning should appear.

---

## 11. Fairness engine — what to look for

The seeded `mockSoldierHistory` has spread:

* s3 (אורן פרץ) and s9 (ניסים דהן) are heavily loaded → should trend toward `overloaded`.
* s4 (נועם כץ) and s8 (יניב שלום) are lightly loaded → should trend toward `underloaded`.

After running the engine, the fairness panel should show s4/s8 selected for new slots more often than s3/s9 because their score is lower.

---

## 12. Things to give feedback on

* **Operational realism** — does any flow feel wrong for actual platoon command-and-control?
* **Hebrew/RTL polish** — any text that's clipped, mis-aligned, mixed direction, or feels translated rather than native?
* **Manager vs soldier separation** — are warnings/fairness correctly hidden from soldiers? Any soldier-side affordance that shouldn't be there?
* **Engine fairness** — does the auto-generated draft "feel fair" for the seeded data, or does it always pick the same people?
* **Manual override** — is the slot-edit modal fast enough for real use? Should it be inline instead of modal?
* **Onboarding** — the 4/5-step flows: too many steps? not enough? Too much info on one screen?
* **Bottom nav** — right tabs for managers? for soldiers? Anything missing?

---

## Limitations to keep in mind

* No persistence — refresh = reset.
* No real auth — the password is compared as plain text against `mockUsers`.
* No push notifications — "תעיר אותי" stores a `ReminderSetting` but doesn't fire.
* QR is a styled placeholder.
* The engine is a heuristic, not a real solver. It is shaped to be replaced.

If something doesn't behave as described here, that's the bug — please file an issue.
