# Final Export Package — "הפלוגה שלי" Operational Demo Film

Everything you need to assemble the 1:45 cinematic in HeyGen + ElevenLabs.

**Bundle was generated:** by `demo/build-export-package.sh` from the live production capture at `https://shabetz-na.vercel.app/`. Re-run to refresh.

## What's in this folder

```
demo-export/
├── README.md                    ← you are here
├── 01-shot-order.md             ← every shot with timing, VO, source asset
├── 02-narration.txt             ← single Hebrew script for ElevenLabs (one shot)
├── 03-narration-by-scene/       ← scene-split scripts (preferred for VO sync)
│   ├── scene1.txt
│   ├── scene2.txt
│   ├── scene3.txt
│   ├── scene4.txt
│   ├── scene5.txt
│   ├── scene6.txt
│   └── closing.txt
├── 04-subtitles.srt             ← burn-in / overlay subtitle file
├── 05-music-direction.md        ← tone + LUFS + recommended search terms
├── 06-heygen-workflow.md        ← step-by-step assembly guide
└── assets/
    ├── mobile/                  ← 21 PNGs for 9:16 frames
    ├── desktop/                 ← 21 PNGs for 16:9 inserts
    └── external/                ← list of 4 frames YOU need to source
```

## The 30-second version

1. Open `01-shot-order.md` — that's the master cut sheet.
2. Send `02-narration.txt` to **ElevenLabs** (or `03-narration-by-scene/` if you want per-scene WAVs).
3. Load each shot's PNG into **HeyGen** as a scene-image, sync to the VO from step 2.
4. Apply music per `05-music-direction.md` (single ambient bed, -22 LUFS under VO).
5. Drop `04-subtitles.srt` over the cut.
6. Export 1080×1920 (9:16) for Reels / Stories. Optional second pass: 1920×1080 for the desktop crop.

## Two render targets

| Target | Source | Use case |
|---|---|---|
| 9:16 Reels / Shorts | `assets/mobile/` | Primary — the way reviewers will watch on a phone |
| 16:9 Desktop | `assets/desktop/` | Secondary — for the website / pitch deck |

The shot order is identical; only the source folder changes per pass.

## Total runtime

1:45 — hard cap 2:00. If the VO comes back tighter than the script suggests, tighten the per-shot durations proportionally; don't add filler.

## Sources you must provide yourself

Outside the app — they live in `assets/external/_README.md`:

- **3 chaos frames** for Scene 1 (WhatsApp mock, Excel mock, whiteboard photo)
- **1 brand close** for the final logo lockup

The Playwright pipeline cannot generate these. AI-generated stylized mocks or stock photography work fine. Keep the aesthetic consistent — premium, military-adjacent, no startup-glow.

## Decisions already made for you

| Question | Decision |
|---|---|
| Avatar or no avatar? | **No avatar.** This is a UI walkthrough; a talking head competes with the screens. VO only. |
| Hebrew first or English first? | **Hebrew first**, English subs in a second pass. Translate intent, not literal. |
| Music style? | Ambient operational underscore. No drops. No trailer trap. See `05-music-direction.md`. |
| Pacing? | Mostly 3-second beats, with deliberate 5-6s linger on engine outcome (Scene 3.3) and warnings strip (Scene 5.2). |
| Captions on screen? | Yes — burn-in. Hebrew bottom-third. The SRT in `04-subtitles.srt` is the source. |

## Files at a glance

| File | Purpose |
|---|---|
| `01-shot-order.md` | The cut sheet. Tells the editor what plays when and what VO line goes over it. |
| `02-narration.txt` | One-shot Hebrew script. Paste into ElevenLabs, generate single WAV. |
| `03-narration-by-scene/` | Same script, split per scene. Better for sync — generate 7 WAVs, lay them on timeline. |
| `04-subtitles.srt` | Industry-standard SRT. Drop into HeyGen / CapCut / Premiere. |
| `05-music-direction.md` | What to license, what to avoid, target levels. |
| `06-heygen-workflow.md` | Step-by-step inside HeyGen's editor. |
| `assets/mobile/` | 21 PNG frames at iPhone 14 Pro viewport. |
| `assets/desktop/` | 21 PNG frames at 1280×800 viewport. |

## Quality bar

This package is the source material. It is NOT the film. The film needs:
- A 5-minute trim of `02-narration.txt` to verify it flows aloud
- An ElevenLabs voice that doesn't push warmth (briefing-room tone)
- A single licensed music bed — not stacked tracks
- The 4 external frames at production quality
- A patient editor who lets the engine-outcome shot breathe

If any of these are rushed, the film will feel like a startup ad. Don't.
