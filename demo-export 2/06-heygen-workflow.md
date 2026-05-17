# HeyGen Workflow — Step by Step

A 1:45 cinematic with VO + screen frames. HeyGen's strength here is its **Voice + Slide** workflow (not the avatar). Skip the talking head — it competes with the UI.

## Pre-flight checklist

- [ ] All 21 mobile PNGs in `assets/mobile/`
- [ ] All 4 external frames placed in `assets/external/` (chaos × 3 + brand close × 1)
- [ ] Hebrew voice picked (HeyGen built-in OR ElevenLabs WAV imported)
- [ ] Music bed downloaded
- [ ] License confirmed for any track you use

## Two production paths

### Path A · ElevenLabs VO (recommended)

Higher VO quality, more control over performance, slightly more steps.

1. **Generate VO**: open ElevenLabs, paste `02-narration.txt` (single shot) OR generate 7 separate WAVs from `03-narration-by-scene/*.txt`
2. **Voice settings**:
   - Voice: Hebrew male, mid-30s briefing-room register
   - Stability: 0.55
   - Similarity: 0.75
   - Style: 0.20
   - Speaker Boost: ON
3. **Trim**: cut leading/trailing silence per WAV
4. **Import to HeyGen**: Asset Library → Upload → drop your WAV(s) under "Audio"

### Path B · HeyGen native VO

Faster but less control. Use if you want to iterate on script quickly.

1. In HeyGen, create a new video → **Voiceover Video** template
2. Paste `02-narration.txt`
3. Voice: pick a Hebrew voice from the catalog (test 2-3, pick the most clipped/professional)
4. Speed: 1.0× or 0.95× if it reads rushed
5. HeyGen generates the audio inline — no upload needed

---

## Assembly steps (HeyGen Editor)

### Step 1 · Create project
- Format: **9:16 (1080×1920)** for the mobile pass
- Title: "הפלוגה שלי — Operational Demo"

### Step 2 · Build 25 scenes
- One HeyGen "scene" per shot row in `01-shot-order.md`
- Don't use HeyGen's auto-scene-split — manual control gives cleaner cuts

For each scene:
1. **Upload the image** from `assets/mobile/` (or `assets/external/` for scenes 1.1-1.3 and 7.x)
2. **Set duration** per the cut sheet (`Dur` column in `01-shot-order.md`)
3. **Background fit**: Fill (so the image fills the 9:16 frame). For desktop-aspect captures cropped on mobile, expect some letterboxing — it's fine.
4. **Subtle motion**: enable "Ken Burns" zoom only on 2.4 (wizard) and 3.3 (engine outcome). Scale: 1.00 → 1.05 over duration. Everything else stays static.
5. **No HeyGen transitions** between scenes. Set transition to "None" / "Cut". Manual hard cuts ONLY. Single 0.3s cross-dissolve allowed between Scene 1 → Scene 2 (the chaos → clean app moment).

### Step 3 · Drop VO under all scenes
- Path A: drag each ElevenLabs WAV onto its scene; HeyGen auto-aligns to scene start. Adjust offsets to match the cut sheet timing.
- Path B: paste your script per scene into HeyGen's voice tool. Generated audio attaches to the scene automatically.

### Step 4 · Add music bed
- Import your licensed track into Asset Library → Audio
- Add as **background track** spanning the entire timeline
- Volume: **-22 LUFS** under the VO (HeyGen's mixer doesn't show LUFS — set it to roughly 25-30% of the VO bar)
- Sidechain: HeyGen doesn't do native sidechain; do a manual gentle 4 dB dip under VO peaks

### Step 5 · Subtitles
- Open `04-subtitles.srt` — verify times still match your final cut
- HeyGen → Subtitles → Import SRT
- Position: bottom-third
- Font: a clean Hebrew sans (Heebo if available; else Assistant)
- Style: white text, 6px black stroke for legibility on any background
- Burn-in: ON (so they survive re-uploads to Instagram / WhatsApp / etc.)

### Step 6 · Export
- Resolution: 1080×1920 (9:16)
- Frame rate: 30fps
- Format: MP4 H.264
- Audio: AAC 192 kbps
- File name: `hapluga-sheli-cinematic-vertical-v1.mp4`

### Step 7 · Desktop pass (optional, do after vertical is approved)
- Duplicate the project
- Change canvas to **16:9 (1920×1080)**
- Swap each scene's image source to `assets/desktop/`
- Re-position subtitles
- Export as `hapluga-sheli-cinematic-horizontal-v1.mp4`

---

## Common pitfalls

| Problem | Fix |
|---|---|
| Auto-zoom on every scene looks busy | Disable HeyGen's default zoom; enable manually only on 2.4 + 3.3 |
| HeyGen's default transition is a glow flash | Set transitions to "Cut" on every boundary |
| Subtitle import shows English fallback for Hebrew | Manually pick a Hebrew font. If the font picker doesn't have one, use the SRT as a reference and re-type natively in HeyGen |
| VO reads too warm / salesy | Reduce ElevenLabs Style to 0.10. Or re-record with a flatter voice. |
| Music overpowers VO on phone speakers | Don't trust HeyGen's preview — export and listen on actual AirPods / phone speaker |
| Scene durations don't add up to 1:45 | Lock total to 1:45.00 in HeyGen's timeline. If VO is shorter, add silence to closing. If longer, tighten Scene 4 first (it's the most compressible). |

---

## Quality gate before publishing

Watch the final export with:
- [ ] Phone speakers
- [ ] AirPods / headphones
- [ ] Muted (subtitles alone must carry the story)

If all three reads land — ship.

If the muted version doesn't carry the story, the subtitles are too sparse. Tighten them in the SRT before re-export.

---

## Alternative: Skip HeyGen, use CapCut

HeyGen is great for VO + slides. If you already use CapCut, the workflow is identical:
1. Import the same image bundle
2. Lay out timeline per `01-shot-order.md`
3. Drop the same WAV
4. Apply the SRT
5. Export

CapCut's keyframe controls are more granular if you want the Ken Burns zoom to feel cinematic. HeyGen wins on speed; CapCut wins on polish.

Pick one. Don't bounce between them.
