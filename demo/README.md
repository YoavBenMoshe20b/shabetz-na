# Demo capture pipeline

Automated production-grade asset bundle for the "הפלוגה שלי" feedback / pitch video.

## What it does

Runs Playwright against the deployed app, logs in as each persona, walks through every role / scenario / flow, and writes screenshots + recordings to `demo-assets/`.

Outputs:

```
demo-assets/
├── roles/
│   ├── mobile/        # iPhone 14 Pro frames, 21 stills
│   └── desktop/       # 1280×800 frames, 21 stills
├── scenarios/
│   ├── mobile/        # state-driven mood frames, 12 stills
│   └── desktop/
└── flows/
    ├── mobile/        # interaction stills + .webm clips
    └── desktop/
```

## Run it

One-time setup (already done in this repo):

```bash
npm install
npx playwright install chromium
```

Capture everything against production:

```bash
npm run capture-demo
```

Capture against localhost (after `npm run dev`):

```bash
BASE_URL=http://localhost:5173 npm run capture-demo
```

Capture a single category:

```bash
npx playwright test demo/specs/roles.spec.ts
npx playwright test demo/specs/scenarios.spec.ts
npx playwright test demo/specs/flows.spec.ts
```

Capture only the mobile project:

```bash
npx playwright test --project=mobile
```

## How it works

1. **Helpers (`demo/helpers.ts`)**
   - `resetDemo(page)` — clears every `ha-pluga-sheli:*` localStorage key
   - `loadDemoState(page, name)` — reads `demo/states/<name>.json` and writes those slices to localStorage, then reloads. The app rehydrates into that scenario.
   - `login(page, phone)` — fills the LoginPage form with `Test@1234`
   - `shoot(page, meta, testInfo)` — full-page screenshot to `demo-assets/<category>/<project>/<id>.png`

2. **Demo states (`demo/states/*.json`)**
   Each file is a `{ slice: payload }` object. The helper translates `slice` names into the full storage key (`ha-pluga-sheli:state:<slice>:v<version>`). The seed version table lives in `helpers.ts` — if `AppContext`'s `usePersistedState` slice version changes, bump the corresponding entry here.

3. **Specs (`demo/specs/*.spec.ts`)**
   - `roles.spec.ts` — 12-persona walkthrough, one test per persona
   - `scenarios.spec.ts` — state-driven mood captures
   - `flows.spec.ts` — interaction recordings (WebM + frame stills)

4. **Config (`playwright.config.ts`)**
   - Defaults to `BASE_URL=https://shabetz-na.vercel.app`
   - Two projects: `mobile` (iPhone 14 Pro) + `desktop` (1280×800)
   - Serial execution — captures share localStorage state
   - `outputDir: demo-assets/test-runs/` for traces / video artifacts

## Shot list & storyboard

- `demo/shot-list.md` — every shot ID, persona, surface, file location
- `demo/storyboard.md` — narrative beat sheet for the cinematic edit

## Editing tips

- **Mobile frames** are full viewport without the device chrome. Add the iPhone bezel in post (`Figma`, `Mobbin`, or `Frame.io` overlay).
- **Desktop frames** include the browser-window content only. Add chrome / safari overlay in post if needed.
- **Videos** are raw browser captures at the project's viewport. They include cursor moves and short waits — trim 0.5s padding from start and end before cutting.
- **State files are deterministic** — re-running the capture produces identical pixels for any non-time-dependent scenario.

## Why production by default

The user explicitly asked: captures must reflect what reviewers see on the live URL, not just localhost. Localhost may have unmerged code; production is the source of truth for "what we ship".

## Limits

- I (the agent) can write the pipeline but cannot run it from this session. The captures themselves run on your machine.
- The video output is raw — no music, no titles, no bezels. That's intentional. The editor adds the cinematic layer; the pipeline provides reproducible source material.
- All states are time-anchored to seeded ISO timestamps (mostly 2026-05-15). Relative-time renderings ("בעוד 2 שעות") will drift as the wall clock advances. For pinned-time cinematic, freeze the system clock or capture at a known time of day.
