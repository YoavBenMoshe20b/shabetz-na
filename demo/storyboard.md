# Storyboard — "הפלוגה שלי" cinematic feedback demo

A 90-second feedback piece, not a marketing reel. The goal: a viewer who's never seen the product understands within 90 seconds:
1. **What** the system does (operational scheduling for a platoon)
2. **Why** it exists (because chaos happens and someone has to staff slots fast)
3. **How** it differs (engine + explainability + audit, not an ERP form)
4. **Who** uses it (CC, PC, soldier — three POVs that all matter)

## Tone

- Calm and confident. No urgency music. Real product, real problems.
- Hebrew throughout. English subtitles optional in post.
- No fake notifications, no stock footage, no "you won't believe…" beats.

---

## Beat sheet

### Beat 1 — Cold open (0:00–0:08)
**Frame:** `scenarios/mobile/chaos-cc-home.png`
**Voiceover:** "ב-06:00 בבוקר, המ״פ פותח את הטלפון."
**Cut:** Hold on the frame. Critical alerts visible in bell badge. Focus section showing 3 items demanding decisions.

### Beat 2 — Identifying the storm (0:08–0:18)
**Frames:** `scenarios/mobile/chaos-cc-alerts.png` → `scenarios/mobile/chaos-pc-g1-home.png`
**Voiceover:** "שלוש מחלקות מתחת לסד״כ. הקפצה פעילה. חייל בלי מימייה. הוא צריך לפעול."
**Cut:** Bell tap → AlertsSheet with grouped warnings. Then UserSwitcher transition to מ״מ 1.

### Beat 3 — The PC stages a response (0:18–0:32)
**Frames:** `roles/mobile/pc-g1-home.png` → `roles/mobile/pc-g1-schedule.png`
**Voiceover:** "המ״מ של מחלקה 1 רואה: שלוש משבצות דורשות איוש. נפתח השבצ״ק."
**Cut:** "שבצ״ק המחלקה" CTA → 7-day grid. Fatigue dots visible. "אייש" chips on understaffed slots.

### Beat 4 — Engine reveal (0:32–0:50)
**Video:** `flows/mobile/staffing.webm` (use the middle 5-6 seconds)
**Frames as cuts:**
- `flows/mobile/staffing-3-sheet-open.png` (badge + mission)
- `flows/mobile/staffing-4-engine-outcome.png` (clean picks + decay reasons)
- `flows/mobile/staffing-5-confirm-cta.png` (confirm button)
**Voiceover:** "המנוע מציע. ביטחון 72%. למה לא 100%? כי יש שני חיילים בכפייה. אנחנו לא מסתירים את זה."
**Beat:** This is the explainability moment. Linger on the decay reasons list. The cinematic punchline.

### Beat 5 — The soldier sees it (0:50–1:02)
**Frame:** `roles/mobile/soldier1-home.png`
**Voiceover:** "תוך שניות החייל רואה את המשמרת בלו״ז שלו. שותפים, שעות, מיקום."
**Cut:** SoldierDashboard "המשמרת הקרובה" with assigned teammates visible.

### Beat 6 — Friction is shown, not hidden (1:02–1:14)
**Frames:** `roles/mobile/soldier2-home.png` → `roles/mobile/soldier2-leaves.png`
**Voiceover:** "חייל אחר ביקש יציאה. הבקשה מחכה. המ״מ יראה אותה ביחד עם המשימה. שום דבר לא ייעלם."
**Cut:** Soldier 2 dashboard → his pending leave row in /leaves.

### Beat 7 — Logistics in parallel (1:14–1:24)
**Frames:** `scenarios/mobile/logistics-rasap-board.png` → `roles/mobile/rasap-meflag-structure.png`
**Voiceover:** "במקביל, הרס״פ מקבל את החוסרים. ארבעה ליקויים. סיכומי מידות. תפקידי מפלג מוגדרים גמיש לפי הצורך."
**Cut:** Damage queue → MAFLAG structure chip editor.

### Beat 8 — Audit (1:24–1:36)
**Frames:** `flows/mobile/audit-1-mission-detail.png` → `flows/mobile/audit-2-history-section.png`
**Voiceover:** "כל שיבוץ מתועד. מי החליט, מתי, איזה חיילים נשקלו, אילו חריגות אושרו, ולמה הביטחון ירד."
**Beat:** Pin the audit row. This is the institutional memory pitch.

### Beat 9 — Calm (1:36–1:50)
**Frames:** `scenarios/mobile/clean-cc-home.png`
**Voiceover:** "בסוף הסבב — הכל ירוק. המנוע עזר. המ״מ החליט. החייל הגיע. הרס״פ סגר. המ״פ ישן."
**Beat:** Mirror image of Beat 1. Same frame, different content. The before/after.

### Beat 10 — Close (1:50–1:55)
**Frame:** `roles/desktop/cc-home.png` (desktop hero for the final logo lockup)
**Logo/tagline:** "הפלוגה שלי — המוח של הפלוגה."

---

## Cuts and rhythm

- Default beat: 1.5-2 seconds per still
- Engine reveal (beat 4): hold 4-5 seconds — explanatory text needs reading time
- All cuts on `cmd+J` or `[J,K,L]` style — no flashy transitions
- Background: soft ambient. No drums. No "epic" music.

## Subtitles / English version

For each VO line above, an English equivalent can be generated. Avoid literal translation — match the operational register ("מתחת לסד״כ" → "below floor manpower", not "under the basic personnel count").

## Production notes

- **Recording:** all stills + 1 short video come from the Playwright capture pipeline (`npm run capture-demo`). Run twice: once for `mobile`, once for `desktop`.
- **Pinned states:** state JSONs in `demo/states/` reproduce each scenario deterministically. If a state needs editing, edit the JSON, not the recording.
- **Mobile bezel:** the editor adds the iPhone bezel in post — Playwright captures the pure viewport. This keeps assets reusable for both bezeled and bezel-less framings.
- **Asset reuse:** mobile frames map 1:1 to a Reels / Stories / Shorts crop. Desktop frames map to a 16:9 cinematic crop.
