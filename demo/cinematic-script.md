# Operational Demo Film — "הפלוגה שלי"

A 90-second cinematic operational walkthrough. Not a trailer. Not a tutorial. A reviewer should finish it and immediately know HOW to navigate the demo, with the system feeling **tactical / operational / modern / premium / grounded / believable / military / high-end**.

**Producers note (read first):** the assets below come from the live production app via the Playwright capture pipeline (`demo/specs/cinematic.spec.ts`). Final assembly happens in HeyGen / ElevenLabs / CapCut — outside this repo. This document is the source of truth for what goes where.

---

## Premise

A day in a platoon's life through the system. The viewer experiences operational pressure → command response → ground reality → audit calm. Every cut shows the system in a real state.

---

## Visual & sonic direction

| Element | Direction |
|---|---|
| Aesthetic | Mobile-first, RTL Hebrew UI on a clean light background. Premium typography. No bezels (raw viewport — the editor can add a phone frame in post if desired). |
| Camera | Static frames with subtle parallax / focus shifts. Occasional slow zoom on a specific section (5–7% over 2s). No shaky-cam, no whip pans. |
| Transitions | Hard cuts on the beat. Single 0.3s cross-dissolve allowed per scene boundary. No flashy wipes, no glow stings. |
| Music | One sustained ambient bed throughout — sparse, military-adjacent, no drops, no drum builds. Volume sits at -22 LUFS under VO. Recommended search terms for licensing: *ambient operational*, *tactical underscore*, *military procedural*. NO trailer trap, NO action movie. |
| Sound design | One soft "tap" on each significant UI interaction (StaffingSheet open, Publish, Lock). Subtle "swoosh" only between scenes. |
| VO language | Hebrew, calm, professional, slightly clipped. Avoid sales register. Avoid emotional swell. Think briefing-room. |
| Captions | Hebrew bottom-third with 6px stroke for legibility. English subs optional in a second pass — translate intent, not literal. |
| Color grade | Slight cool shift in chaos opens, neutral in calm states. No teal-and-orange. |

---

## Scene-by-scene script + shot list

### Scene 1 · 0:00 – 0:10 · Cold open. Chaos.

**VO (Hebrew):**
> *"06:00. עוד יום בפלוגה."*
> *(0.5s beat)*
> *"וואטסאפ. אקסלים. שינויים של הרגע האחרון. אנשים לא יודעים מה הם עושים היום."*

**Visuals — 4 cuts × ~2.5s each:**

| # | Frame | Notes |
|---|---|---|
| 1.1 | `cinematic/chaos-1-whatsapp.png` *(external — not from app)* | Stylized mock WhatsApp group thread on phone — "מי בבית?" "מי במשמרת?" "פספסתי" "תפסיק לזרוק לי הודעות" |
| 1.2 | `cinematic/chaos-2-excel.png` *(external)* | Cluttered Hebrew Excel screenshot, names highlighted in conflict |
| 1.3 | `cinematic/chaos-3-handwritten.png` *(external)* | Photo of a handwritten שבצ״ק whiteboard with arrows and crossouts |
| 1.4 | App frame: CC home with NO data, the brand wordmark at the top. From `cinematic/scene1-cc-cold-open.png` | Held for 2s as the transition. This is the "what if this was different" pivot frame. |

**External assets — provided OUTSIDE the Playwright pipeline:** 1.1, 1.2, 1.3. Source them yourself or use AI-generated stylized mocks. The pipeline only captures the app.

**Transition:** Hard cut on the last word of VO. Drop the chaos music slightly. App frame fades up.

---

### Scene 2 · 0:10 – 0:25 · CC takes command

**VO:**
> *"המ״פ פותח את הטלפון. רואה את כל הפלוגה במסך אחד."*
> *(beat)*
> *"שלוש מחלקות. רצפת מינימום. מצב המוכנות. ב-12 השעות הקרובות — מה כבר חי."*
> *(beat)*
> *"הוא יוצר משימה חדשה. בוחר את המחלקה. סגור."*

**Visuals — 4 cuts:**

| # | State | Shot ID | Captured by |
|---|---|---|---|
| 2.1 | CC home, clean operation | `cinematic/scene2-cc-home.png` | Playwright |
| 2.2 | Focus on the "מחלקות" table (slow zoom 5%) | `cinematic/scene2-cc-platoons-detail.png` | Playwright (cropped post-capture) |
| 2.3 | CC `/missions` list | `cinematic/scene2-cc-missions.png` | Playwright |
| 2.4 | CC MissionWizardPage — step 1 (assignedPlatoonIds shown) | `cinematic/scene2-cc-wizard.png` | Playwright |

**Demo state:** `clean-operation` (existing).

**Pacing:** 3 stills × 3s + 1 still × 6s (the wizard, lingering on platoon-pick chips).

---

### Scene 3 · 0:25 – 0:45 · PC stages the response

**VO:**
> *"המ״מ פותח את המסך."*
> *(beat)*
> *"שלוש משבצות דורשות איוש. הוא רואה את זה תוך שנייה."*
> *(beat — opens StaffingSheet)*
> *"המנוע מציע. ביטחון 72%. למה לא 100%? כי יש שני חיילים בכפייה. שום דבר לא מוסתר."*
> *(beat — operator interaction)*
> *"מחליף חייל. נועל זוג. החייל לא יוצא — עד הערב."*
> *(beat)*
> *"פרסם שבצ״ק."*

**Visuals — 6 cuts:**

| # | State | Shot ID |
|---|---|---|
| 3.1 | PC dashboard with Action Center warn-tile (X משבצות דורשות איוש) | `cinematic/scene3-pc-action-center.png` |
| 3.2 | PC `/platoon/missions` list | `cinematic/scene3-pc-missions.png` |
| 3.3 | StaffingSheet open — confidence + decay reasons visible | `cinematic/scene3-staffing-sheet.png` |
| 3.4 | Slot Ops Sheet — squad-grouped, pair-lock section, replace flow | `cinematic/scene3-slot-ops.png` |
| 3.5 | Excused-until form with reason field filled | `cinematic/scene3-excuse.png` |
| 3.6 | PC mission card showing 🔒 N נעולים + 🚫 N הוצאות chips | `cinematic/scene3-locks-chips.png` |

**Demo state:** `partial-staffing-pressure` (new — see state JSONs below).

**Pacing:** 6 stills × ~3.3s. Linger on 3.3 (engine outcome) — that's the emotional center.

---

### Scene 4 · 0:45 – 1:00 · RasaP + Shalish

**VO:**
> *"במקביל — הרס״פ."*
> *(beat)*
> *"ארבעה ליקויי ציוד. אחראי ציוד החפ״ק יודע שהוא בבסיס. סיכומי מידות. הזמנה מהיר."*
> *(beat)*
> *"השליש פותח דוח 1. תמונה מלאה של מי בבית, מי בבסיס, איפה הסד״כ."*

**Visuals — 4 cuts:**

| # | State | Shot ID |
|---|---|---|
| 4.1 | RasaP dashboard with logistics summary + "המפלג שלי" section | `cinematic/scene4-rasap-home.png` |
| 4.2 | `/rasap` damage queue with 4 active gaps | `cinematic/scene4-rasap-board.png` |
| 4.3 | `/platoon/g-meflag/structure` chip editor | `cinematic/scene4-meflag-structure.png` |
| 4.4 | Shalish `/report1` | `cinematic/scene4-shalish-report1.png` |

**Demo state:** `logistics-pressure` (existing).

---

### Scene 5 · 1:00 – 1:20 · Operational Leaves

**VO:**
> *"המ״פ פותח לוח יציאות."*
> *(beat)*
> *"מחלקה שבועות בבית. סבב חודש קדימה. המערכת לא משבצת מחלקה בבית למשימה — אלא אם המ״פ מחליט אחרת."*
> *(beat)*
> *"חפ״ק לא עובד כמו מחלקה. הרס״פ צריך מינימום שלושה אנשי חפ״ק בבסיס תמיד. נהג. איש קשר. המערכת מתריעה — וזהו."*

**Visuals — 4 cuts:**

| # | State | Shot ID |
|---|---|---|
| 5.1 | `/coverage/platoons` full view — combat grid with rotation visible | `cinematic/scene5-leave-board.png` |
| 5.2 | Focus on warnings strip (5+ coverage rule breaches) | `cinematic/scene5-warnings.png` |
| 5.3 | Coverage Rules section — list of 5 seeded rules | `cinematic/scene5-coverage-rules.png` |
| 5.4 | A PC's view of their platoon's upcoming leave days (TBD — needs PC widget) | `cinematic/scene5-pc-leave-view.png` |

**Demo state:** `leave-rotation-active` (new — see below).

---

### Scene 6 · 1:20 – 1:35 · Soldier sees it

**VO:**
> *"החייל פותח את הטלפון."*
> *(beat)*
> *"רואה את המשמרת הבאה. השעה. עם מי. הציוד. הצל״ם הסתיים אתמול בערב — הכל ירוק."*
> *(beat)*
> *"הוא יודע בדיוק מה הוא עושה הלילה."*

**Visuals — 3 cuts:**

| # | State | Shot ID |
|---|---|---|
| 6.1 | SoldierDashboard with full "המשמרת הקרובה" + teammates | `cinematic/scene6-soldier-home.png` |
| 6.2 | ChecklistRunSheet — most items checked, status badge "עבר" | `cinematic/scene6-checklist-passed.png` |
| 6.3 | Soldier's "השבוע שלי" expanded with multiple slots visible | `cinematic/scene6-week.png` |

**Demo state:** `clean-operation` + a completed checklist run seeded.

---

### Closing · 1:35 – 1:45 · Brand

**VO:**
> *"פלוגה שלמה. תמונת מצב אחת."*
> *(2s silence)*
> *"הפלוגה שלי."*

**Visuals — 2 cuts:**

| # | Frame | Shot ID |
|---|---|---|
| 7.1 | Full-bleed app icon / wordmark on a calm background | External — designer asset |
| 7.2 | Single static frame: brand wordmark + URL `shabetz-na.vercel.app` | External |

---

## Demo states required

These are state JSON files in `demo/states/`. Most exist; new ones added in this slice are marked **NEW**.

| File | Used in | Status |
|---|---|---|
| `clean-operation.json` | Scenes 2, 6 | exists |
| `partial-staffing-pressure.json` | Scene 3 | **NEW** |
| `logistics-pressure.json` | Scene 4 | exists |
| `leave-rotation-active.json` | Scene 5 | **NEW** |

---

## Asset organization

```
demo-assets/cinematic/
├── scene1-cc-cold-open.png            (Playwright)
├── scene2-cc-home.png
├── scene2-cc-platoons-detail.png      (cropped post-capture)
├── scene2-cc-missions.png
├── scene2-cc-wizard.png
├── scene3-pc-action-center.png
├── scene3-pc-missions.png
├── scene3-staffing-sheet.png
├── scene3-slot-ops.png
├── scene3-excuse.png
├── scene3-locks-chips.png
├── scene4-rasap-home.png
├── scene4-rasap-board.png
├── scene4-meflag-structure.png
├── scene4-shalish-report1.png
├── scene5-leave-board.png
├── scene5-warnings.png
├── scene5-coverage-rules.png
├── scene5-pc-leave-view.png          (TBD — pending PC widget)
├── scene6-soldier-home.png
├── scene6-checklist-passed.png
└── scene6-week.png
```

Counts: 20 Playwright stills + 4 external designer assets (chaos opens + final logo). Run via `npm run capture-demo:cinematic`.

---

## Capture plan

The new Playwright spec at `demo/specs/cinematic.spec.ts` produces every Playwright asset above. Mobile + desktop captures are produced in parallel.

Run protocol:
1. Stabilize the system per the "what must be polished first" list (below)
2. Open the production URL once in a browser to warm Vercel's bot-protection cache
3. `npm run capture-demo:cinematic` — produces all stills
4. Sanity-check each frame against this script
5. Pass the bundle to the editor

---

## VO production notes (ElevenLabs)

- Recommend voice: **Hebrew male**, mid-30s register, news/briefing tone. ElevenLabs has Hebrew voices — pick one that does NOT push warmth. Cold-warm: ~30%.
- Stability: 0.55 · Similarity: 0.75 · Style: 0.20 · Speaker boost: ON.
- Record each scene's VO as a separate WAV. Editor cuts to picture.
- Pause beats are intentional — generate the VO with explicit `(beat)` cuts and trim manually rather than relying on natural prosody.
- Do NOT auto-translate. Hebrew first, English subs in post.

## Editing direction

- Total runtime: 1:45. Hard cap 2:00.
- Background music level: -22 LUFS. VO at -16 LUFS.
- Aspect: 9:16 (mobile-first, for Reels / Shorts) PLUS a 16:9 desktop crop.
- Captions burned-in for accessibility, not auto-generated.

---

## What must be polished BEFORE we capture

Honest list. The film won't be cinematic if the underlying frames have rough edges. None of these are blockers, but each one shows up on camera.

1. **PC view of platoon leave schedule** — Scene 5 references a soldier-facing "this is when my platoon is home" widget. Doesn't exist yet. Either:
   - (a) build it before capture
   - (b) cut shot 5.4 from the script
2. **Coverage Rules ADD form** — Scene 5 surfaces existing rules but the user can't add new ones from the UI. Either build it, or stop the camera at the "list" view (acceptable).
3. **Engine enforces coverage rules** — currently they're warnings only. The VO says "המערכת מתריעה — וזהו" so we're already honest, but worth tightening.
4. **Mission detail צל״ם section visual polish** — works, but the "0 פעיל" empty-state needs more visual weight to read on camera.
5. **PC dashboard Action Center loud state** — the orange "דורש איוש" tile is great but needs to actually render in production. With auto-pick filling slots, it's hidden by default. Either:
   - (a) seed `partial-staffing-pressure.json` to under-staff slots (this is what we plan)
   - (b) verify the tile renders against the new seed
6. **Soldier checklist passed visual** — Scene 6 needs an EXISTING completed run with most items checked. Seed one in `clean-operation.json` OR record the operator actually checking through during capture (slower but more authentic).
7. **Stable fonts / no FOIT** — verify Heebo loads cleanly on the captured frames (Playwright waits for `networkidle` — should be fine, but worth a spot-check).
8. **No demo bell badges** — Scene 2's CC home shouldn't have a critical-count badge on the bell. Clean state takes care of this.

---

## Out of scope for this repo

- Music selection (rights / licensing — your call)
- HeyGen avatar generation if you're going that route (the script is plain VO; if you want a HeyGen on-camera presenter, treat the VO above as their script)
- Final edit (CapCut / Premiere) — the assets are the source material

---

## Status

- Plan committed
- New state JSONs + capture spec committed alongside
- **NOT YET RUN.** Holding until polish punchlist closed + user "go".
