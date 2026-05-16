# Kapwing Assembly — Step by Step

This is the **execution sheet** for Kapwing. No judgment calls required. Read top-to-bottom, paste values verbatim.

**Target output:** 1:45 vertical (9:16, 1080×1920), single export, ready to publish.

---

## Pre-flight (5 minutes)

### A. Upload assets

Open Kapwing → **Studio** → **New project** (don't pick a template).

Drag these folders/files into the **Assets** panel (left side):

1. Every PNG in `/Users/yoavbenmoshe/MyFirstApp/demo-export/assets/mobile/` (21 files)
2. Every PNG in `/Users/yoavbenmoshe/MyFirstApp/demo-export/assets/external/` (5 files — provide these yourself per `_README.md`)
3. Your narration audio (single WAV from ElevenLabs OR 7 per-scene WAVs)
4. Your music bed (one ambient track per `05-music-direction.md`)

### B. Set project canvas

Top toolbar → **Output Size** → **Custom**:
- Width: **1080**
- Height: **1920**
- FPS: **30**
- Background color: `#000000` (black) — only visible if a frame doesn't fill

### C. Set subtitle defaults (once, before importing SRT)

**Subtitles** menu → **Settings**:
- Font: **Heebo Bold** (Hebrew). Fallback: Assistant Bold.
- Size: 48 px
- Color: white `#FFFFFF`
- Stroke: black, 6 px
- Position: bottom center, 220 px from bottom
- Max chars per line: 38
- Direction: **RTL**

---

## Assembly · 25 scenes

Every row below = **one Kapwing scene**. The scenes appear in the timeline IN THIS ORDER. Drag the image into the timeline, set the duration, set the transition INTO it, set the animation.

### Reading the table

- **In/Out**: timestamp in the final 1:45 timeline
- **Dur**: exact scene duration to paste into Kapwing's "Scene Length" field
- **File**: asset to drag from your uploads. All from `assets/mobile/` unless prefixed `EXT:` (then from `assets/external/`)
- **Trans-in**: transition INTO this scene from the previous. Kapwing dropdown options: `Cut`, `Fade`, `Cross-Dissolve`, `Slide-Right`, `Slide-Left`, `Zoom-In`
- **Animation**: per-scene motion. `None` / `KenBurns(start% → end%, anchor)` / `ZoomIn(start% → end%)` / `Pan(direction)`
- **VO line**: the Hebrew VO that plays under this scene (from `02-narration.txt`)
- **Subtitle**: text shown bottom-third — verbatim from `04-subtitles.srt`

---

### Scene 1 · Cold open · 0:00–0:10

| # | In | Out | Dur | File | Trans-in | Animation | Subtitle |
|---|---|---|---|---|---|---|---|
| 1.1 | 0:00 | 0:02.5 | 2.5s | `EXT: chaos-1-whatsapp.png` | Cut (project start) | None | **"06:00. עוד יום בפלוגה."** |
| 1.2 | 0:02.5 | 0:05 | 2.5s | `EXT: chaos-2-excel.png` | Cut | None | *(no subtitle — 0.5s dramatic silence)* |
| 1.3 | 0:05 | 0:07.5 | 2.5s | `EXT: chaos-3-handwritten.png` | Cut | None | **"וואטסאפ. אקסלים. שינויים של הרגע האחרון."** |
| 1.4 | 0:07.5 | 0:10 | 2.5s | `scene1-cc-cold-open.png` | **Cross-Dissolve 0.3s** ← key transition | KenBurns(100% → 102%, center) | **"אנשים לא יודעים מה הם עושים היום."** |

**Note:** scene 1.4 is the chaos → calm pivot. The cross-dissolve is the ONE non-cut transition in the entire film. Music drops 2 dB under this transition.

---

### Scene 2 · CC takes command · 0:10–0:25

| # | In | Out | Dur | File | Trans-in | Animation | Subtitle |
|---|---|---|---|---|---|---|---|
| 2.1 | 0:10 | 0:13 | 3.0s | `scene2-cc-home.png` | Cut | None | **"המ״פ פותח את הטלפון. רואה את כל הפלוגה במסך אחד."** |
| 2.2 | 0:13 | 0:16 | 3.0s | `scene2-cc-platoons-detail.png` | Cut | ZoomIn(100% → 108%) | **"שלוש מחלקות. רצפת מינימום. מצב המוכנות."** |
| 2.3 | 0:16 | 0:19 | 3.0s | `scene2-cc-missions.png` | Cut | None | **"ב-12 השעות הקרובות — מה כבר חי."** |
| 2.4 | 0:19 | 0:25 | 6.0s | `scene2-cc-wizard.png` | Cut | KenBurns(100% → 105%, center-top) | **"הוא יוצר משימה חדשה. בוחר את המחלקה. סגור."** |

**Linger:** 2.4 is held for 6s — the slow zoom does the visual work. Don't rush.

---

### Scene 3 · PC stages the response · 0:25–0:45

| # | In | Out | Dur | File | Trans-in | Animation | Subtitle |
|---|---|---|---|---|---|---|---|
| 3.1 | 0:25 | 0:28 | 3.0s | `scene3-pc-action-center.png` | Cut | None | **"המ״מ פותח את המסך."** |
| 3.2 | 0:28 | 0:31 | 3.0s | `scene3-pc-missions.png` | Cut | None | **"שלוש משבצות דורשות איוש. הוא רואה את זה תוך שנייה."** |
| 3.3 | 0:31 | 0:37 | **6.0s** | `scene3-staffing-sheet.png` | Cut | ZoomIn(100% → 103%) | **"המנוע מציע. ביטחון 72%. למה לא 100%? כי יש שני חיילים בכפייה. שום דבר לא מוסתר."** ← **EMPHASIS POINT** |
| 3.4 | 0:37 | 0:40 | 3.0s | `scene3-slot-ops.png` | Cut | None | **"מחליף חייל. נועל זוג."** |
| 3.5 | 0:40 | 0:43 | 3.0s | `scene3-excuse.png` | Cut | None | **"החייל לא יוצא — עד הערב."** |
| 3.6 | 0:43 | 0:45 | 2.0s | `scene3-locks-chips.png` | Cut | None | **"פרסם שבצ״ק."** |

**Emphasis on 3.3:** in Kapwing subtitle editor, select the words **"ביטחון 72%"** and apply color `#E25D5D` (mil-alert red). Select **"שום דבר לא מוסתר"** and apply Bold. This is the emotional center of the film. The 6-second hold + the color emphasis = the punchline lands.

**SFX optional:** add a soft "tap" sound at 0:31.0 (StaffingSheet opens) at -28 LUFS. Find one in Kapwing's audio library searching "ui tap".

---

### Scene 4 · RasaP + Shalish · 0:45–1:00

| # | In | Out | Dur | File | Trans-in | Animation | Subtitle |
|---|---|---|---|---|---|---|---|
| 4.1 | 0:45 | 0:49 | 4.0s | `scene4-rasap-home.png` | Cut | None | **"במקביל — הרס״פ."** |
| 4.2 | 0:49 | 0:53 | 4.0s | `scene4-rasap-board.png` | Cut | ZoomIn(100% → 104%) | **"ארבעה ליקויי ציוד. סיכומי מידות. הזמנה מהירה."** |
| 4.3 | 0:53 | 0:56 | 3.0s | `scene4-meflag-structure.png` | Cut | None | **"אחראי ציוד החפ״ק יודע שהוא בבסיס."** |
| 4.4 | 0:56 | 1:00 | 4.0s | `scene4-shalish-report1.png` | Cut | None | **"השליש פותח דוח 1. תמונה מלאה — מי בבית, מי בבסיס, איפה הסד״כ."** |

---

### Scene 5 · Operational Leaves · 1:00–1:20

| # | In | Out | Dur | File | Trans-in | Animation | Subtitle |
|---|---|---|---|---|---|---|---|
| 5.1 | 1:00 | 1:05 | 5.0s | `scene5-leave-board.png` | Cut | KenBurns(100% → 104%, center) | **"המ״פ פותח לוח יציאות. מחלקה שבועות בבית. סבב חודש קדימה."** |
| 5.2 | 1:05 | 1:10 | 5.0s | `scene5-warnings.png` | Cut | ZoomIn(100% → 106%) ← **EMPHASIS POINT** | **"המערכת לא משבצת מחלקה בבית למשימה — אלא אם המ״פ מחליט אחרת."** |
| 5.3 | 1:10 | 1:15 | 5.0s | `scene5-coverage-rules.png` | Cut | None | **"חפ״ק לא עובד כמו מחלקה. מינימום שלושה אנשי חפ״ק בבסיס תמיד. נהג. איש קשר."** |
| 5.4 | 1:15 | 1:20 | 5.0s | `scene5-pc-leave-view.png` | Cut | None | **"המ״מ רואה בדיוק מתי המחלקה שלו בבית. המערכת מתריעה — וזהו."** |

**Emphasis on 5.2:** select **"אלא אם המ״פ מחליט אחרת"** in the Kapwing subtitle editor and apply Bold. The zoom-in animation reinforces this beat.

**Emphasis on 5.3:** select **"המערכת מתריעה — וזהו"** and apply Bold + 110% scale. This is the second-strongest line in the film.

---

### Scene 6 · Soldier sees it · 1:20–1:35

| # | In | Out | Dur | File | Trans-in | Animation | Subtitle |
|---|---|---|---|---|---|---|---|
| 6.1 | 1:20 | 1:25 | 5.0s | `scene6-soldier-home.png` | Cut | None | **"החייל פותח את הטלפון."** |
| 6.2 | 1:25 | 1:30 | 5.0s | `scene6-week.png` | Cut | KenBurns(100% → 103%, center-bottom) | **"רואה את המשמרת הבאה. השעה. עם מי. הציוד."** |
| 6.3 | 1:30 | 1:35 | 5.0s | `scene6-week.png` (same — held) | Cut | None | **"הוא יודע בדיוק מה הוא עושה הלילה."** |

**Note 6.3:** same image as 6.2 — Kapwing keeps the frame static while the VO finishes the thought. In Kapwing's timeline, you can either (a) extend 6.2 to 10s and split the subtitle, or (b) drag the same asset in twice with different durations. Either works. Method (a) is cleaner.

---

### Closing · Brand · 1:35–1:45

| # | In | Out | Dur | File | Trans-in | Animation | Subtitle |
|---|---|---|---|---|---|---|---|
| 7.1 | 1:35 | 1:40 | 5.0s | `EXT: brand-wordmark.png` | Cross-Dissolve 0.5s | None | **"פלוגה שלמה. תמונת מצב אחת."** |
| 7.2 | 1:40 | 1:45 | 5.0s | `EXT: brand-close.png` | Cut | None | *(silence 2s, then VO: "הפלוגה שלי" at 1:42)* — subtitle: **"הפלוגה שלי."** (large, centered, 120% scale) |

**Final 2 seconds (1:43–1:45):** all elements fade. Music ramps -8 dB. Black hold for 1s after the wordmark fades.

---

## Audio layer setup

### Narration track (primary)

**Option A — single WAV:**
1. Drag `02-narration.txt` content into ElevenLabs → generate one WAV
2. Drop into Kapwing's audio track at 0:00.0
3. Track volume: **0 dB (100%)**
4. Trim end if total > 1:45

**Option B — per-scene WAVs (better sync):**
1. Generate 7 WAVs from `03-narration-by-scene/*.txt`
2. Drop each at the scene's IN time (use the table above)
3. Track volume: **0 dB**

### Music bed (secondary)

1. Upload your licensed track (see `05-music-direction.md`)
2. Drop at 0:00.0
3. Loop / extend to 1:45 — Kapwing has a "loop" option in the audio properties
4. **Volume: -22 LUFS** — Kapwing doesn't show LUFS, set the slider to roughly **25%**
5. **Fade-in: 1.5s** from 0:00.0
6. **Fade-out: 2.5s** from 1:42.5
7. **Ducking:** Kapwing → Audio properties → "Auto-duck under voiceover" — enable. Set duck depth to **-4 dB**.

### Subtitle import

1. Subtitles menu → **Import SRT**
2. File: `/Users/yoavbenmoshe/MyFirstApp/demo-export/04-subtitles.srt`
3. Verify direction is RTL after import
4. Apply emphasis per the "EMPHASIS POINT" notes above

---

## Per-scene cheatsheet (one screen)

When you're inside Kapwing, this is the only thing you need.

```
1.1  CHAOS-WHATSAPP       2.5s  Cut          None              06:00. עוד יום בפלוגה.
1.2  CHAOS-EXCEL          2.5s  Cut          None              [no sub]
1.3  CHAOS-HANDWRITTEN    2.5s  Cut          None              וואטסאפ. אקסלים. שינויים.
1.4  CC-COLD-OPEN         2.5s  Dissolve     KenBurns 100-102  אנשים לא יודעים.

2.1  CC-HOME              3.0s  Cut          None              המ"פ פותח. רואה הכל.
2.2  CC-PLATOONS          3.0s  Cut          ZoomIn 100-108    שלוש מחלקות. רצפה.
2.3  CC-MISSIONS          3.0s  Cut          None              ב-12 השעות הקרובות.
2.4  CC-WIZARD            6.0s  Cut          KenBurns 100-105  משימה חדשה. סגור.

3.1  PC-ACTION-CENTER     3.0s  Cut          None              המ"מ פותח.
3.2  PC-MISSIONS          3.0s  Cut          None              שלוש משבצות. שנייה.
3.3  STAFFING-SHEET       6.0s  Cut          ZoomIn 100-103    ביטחון 72%. *EMPHASIS*
3.4  SLOT-OPS             3.0s  Cut          None              מחליף. נועל זוג.
3.5  EXCUSE               3.0s  Cut          None              לא יוצא — עד הערב.
3.6  LOCKS-CHIPS          2.0s  Cut          None              פרסם שבצ"ק.

4.1  RASAP-HOME           4.0s  Cut          None              במקביל — הרס"פ.
4.2  RASAP-BOARD          4.0s  Cut          ZoomIn 100-104    4 ליקויים. מידות.
4.3  MEFLAG-STRUCTURE     3.0s  Cut          None              אחראי ציוד חפ"ק.
4.4  SHALISH-REPORT1      4.0s  Cut          None              דוח 1. תמונה מלאה.

5.1  LEAVE-BOARD          5.0s  Cut          KenBurns 100-104  לוח יציאות.
5.2  WARNINGS             5.0s  Cut          ZoomIn 100-106    *EMPHASIS — bold*
5.3  COVERAGE-RULES       5.0s  Cut          None              *EMPHASIS — bold*
5.4  PC-LEAVE-VIEW        5.0s  Cut          None              מ"מ רואה. מתריעה.

6.1  SOLDIER-HOME         5.0s  Cut          None              החייל פותח.
6.2  WEEK                 5.0s  Cut          KenBurns 100-103  המשמרת הבאה.
6.3  WEEK (held)          5.0s  Cut          None              יודע מה עושה הלילה.

7.1  BRAND-WORDMARK       5.0s  Dissolve     None              פלוגה שלמה. תמונת מצב.
7.2  BRAND-CLOSE          5.0s  Cut          None              הפלוגה שלי. *LARGE*
```

---

## Export settings

Top right → **Export** → **MP4** → Custom:

| Setting | Value |
|---|---|
| Resolution | **1080×1920** |
| FPS | **30** |
| Bitrate | **10 Mbps** (high quality) |
| Audio | AAC 192 kbps |
| Subtitles | **Burn-in** (so they survive WhatsApp / IG re-encoding) |
| Format | MP4 H.264 |
| Filename | `hapluga-sheli-vertical-v1.mp4` |

Export. Watch once on phone speakers. Watch again on AirPods. If both pass — ship.

---

## Common Kapwing pitfalls (and fixes)

| Problem | Fix |
|---|---|
| Auto-generated subtitles overlap with the imported SRT | Disable "Auto-subtitle" in Subtitle settings before importing the SRT |
| Hebrew subtitle direction is wrong after SRT import | Subtitle Settings → Direction → RTL (Kapwing sometimes defaults to LTR despite the file) |
| Default scene transition is "Fade" not "Cut" | Project Settings → Default Transition → Cut. Apply to all. |
| Music doesn't loop cleanly at 1:45 | Trim the music to exactly the right length BEFORE importing, OR use Kapwing's "loop" property |
| Image looks cropped on 9:16 | Per-scene → Background Fit → "Fit" (letterboxed) or "Fill" (cropped). Most of our 9:16 captures are already 9:16-friendly. |
| Render is slow / queue is long | Kapwing free tier has slow queue. If you have a paid account, the queue jumps. Otherwise the export takes 10-15 min for a 1:45 video. |

---

## After export

1. Watch silently with subtitles only → does the story land?
2. Watch with audio on phone speakers → does the VO carry?
3. Watch on AirPods → does the music sit under the VO?

If all three pass: send it.

If the muted version doesn't carry → the SRT is too sparse. Tighten and re-export.
If the phone-speaker version sounds music-heavy → reduce music volume by 3-5 dB and re-export.
If the AirPods version sounds VO-tinny → ElevenLabs Style was probably too high. Re-generate at Style 0.10.

---

## Total time to assemble (realistic)

- Upload + project setup: **5 min**
- Drag in 25 scenes + set durations: **15 min**
- Set transitions + animations: **10 min**
- Audio + subtitle layer: **10 min**
- Preview + adjust: **10 min**
- Export + watch: **15 min**

**Total: ~65 minutes** from "open Kapwing" to "send to first reviewer."

If you're past 2 hours, something is wrong with the source assets (likely the 4 external frames). Don't add more polish — fix the source.
