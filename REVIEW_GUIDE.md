# Review Guide · הפלוגה שלי

A 10-minute walkthrough that exercises the CC → PC → Soldier flow end-to-end. Works against the deployed demo or `npm run dev`.

**Production:** https://shabetz-na.vercel.app/

---

## 0. Reset (optional)

Open the site. Click **"החלף"** in the header → **"איפוס נתוני דמו"** to wipe persisted state and start clean. Refresh.

## 1. Login

Default tab is **התחברות**. Open the collapsed **"חשבונות דמו"** panel under the form — tap any row to autofill phone + password (`Test@1234`).

Start as **u1 יוסי כהן (מ״פ)**.

## 2. As מ״פ — create a mission

1. CC Dashboard → **קיצורי דרך** → **"ניהול משימות"** → `/missions`
2. **"+ משימה חדשה"** opens the 6-step wizard:
   - Step 1: name + `assignedPlatoonIds` (try g1)
   - Steps 2-5: fatigue / time / command / rotation / equipment
   - Step 6: review + create
3. The new mission lands with status `active-unstaffed`.

Browse the CC dashboard:
- **FocusSection** — decisions requiring action now (max 5)
- **CriticalAlertsBanner** — itemized criticals with direct CTAs
- **מחלקות** — readiness per platoon
- **ב-12 השעות הקרובות** — timeline
- **קיצורי דרך** — מבנה חפ״ק / מבנה מפלג CTAs

## 3. Switch to PC

Header **"החלף"** → **u2 רוני שמש (מ״מ g1)**.

PC Dashboard:
- Hero with in-base / total + floor warning
- Critical alerts banner (if any)
- Active missions card
- **"פתח שבצ״ק השבוע"** → `/platoon`

## 4. As מ״מ — staff a slot (the heart of the demo)

On `/platoon`:
- 7-day rows. Each slot shows time / mission / status pill / assigned names.
- Soldiers with fatigue above the platoon's p75 get a yellow dot next to their name.
- Understaffed slots show an **"אייש"** chip on the right.

Tap **"אייש"** on any slot:

`StaffingSheet` opens:
- **Engine outcome** — confidence % with explicit `decayReasons` (no magic numbers)
- **מומלצים** — clean picks, score per dimension (load / fatigue / qualMatch / cohesion / burden)
- **דחיפת מועמדים** (forced) — hidden behind a toggle; each forced pick demands a reason
- **נדחים — why-not** — every rejected candidate with hard-filter codes (e.g. "soldier on leave", "missing qualification")

Pick → **"אשר שיבוץ"**.

The assignment **persists** (localStorage in mock mode, Supabase when flag is on). Every surface in the app (CC dashboard, PC dashboard, SoldierDashboard, CalendarPage, SchedulePage, MissionDetailPage) materializes the slot with your soldiers instead of the engine's auto-pick.

## 5. Verify audit

Tap the slot body (not the "אייש" chip) to navigate to `/mission/:id`.

**"היסטוריית שיבוץ"** section shows every commit:
- actor + role + confidence
- expand: alternates considered, violations, decay reasons, forced reasons

## 6. Switch to soldier

Header **"החלף"** → **u3 משה ישראלי (חייל)**.

SoldierDashboard:
- **המשמרת הקרובה** — countdown + teammates (if you staffed them, they appear)
- **השבוע שלי** — collapsible week of personal slots
- **תעיר אותי** — reminders
- **בקש יציאה** — leave request

## 7. Back to CC

Header **"החלף"** → **u1** again. The mission status reflects the staffing.

## 8. CHAPAK / MAFLAG

From the CC shortcuts → **מבנה חפ״ק** (`/platoon/g-chapack/structure`):
- 8 members of the forward-command unit (including CC as soldier s68, DCC as s69)
- Each has a chip cluster of functional roles
- **"ערוך תפקידים"** opens the chip palette: אחראי ציוד חפ״ק / אחראי קשר / מפעיל רחפן / נהג / מ״ק חפ״ק

**מבנה מפלג** (`/platoon/g-meflag/structure`):
- 6 members: רס״פ (u6 אבי כהן), סרס״פ (u13 יואב מורן), שליש (u8), אחראי מטבח, אחראי מים, etc.
- Same chip editor with the MAFLAG catalog

## 9. רס״פ

Header **"החלף"** → **u6 אבי כהן**.

RasapDashboard — logistics-aware soldier view. Manages equipment lifecycle, MAFLAG members, signing.

## 10. QuietMode

Profile (avatar menu) → **מצב שקט** section. Exactly four durations: 30m / 1h / 2h / 4h. Critical alerts always break through; non-critical alerts go silent on the dashboard layer until you open the AlertsSheet manually.

---

## What persists vs. what resets

**Persisted (survives refresh):** current user + role, missions, slot assignments, selector outcomes, mission notes, leaves, leave requests, orders, announcements, escalations, override alerts, equipment gaps, signed equipment, soldier status events, QuietMode preference.

**Reset to seed:** soldier catalog (rare mutations), users, platoons, squads, qualifications, equipment items, dutyExclusions, leave policy.

**Storage prefix:** `ha-pluga-sheli:state:*` and `ha-pluga-sheli:quietMode:*` in localStorage.

---

## Known gaps

- Vercel project name still `shabetz-na` — URL alias rename pending dashboard action by the maintainer.
- Engine debug page `/engine/debug` (CC only) wraps engine context in chaos overrides but does NOT use persisted assignments (intentional — chaos is hypothetical).
- Supabase migration 0009 (assignments / selector_outcomes / engine_overrides) exists but `VITE_USE_SUPABASE=false` by default.
