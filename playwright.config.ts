// playwright.config.ts — demo capture pipeline.
//
// Runs the capture specs against the deployed production site by default.
// Override with: BASE_URL=http://localhost:5173 npx playwright test
//
// All outputs land in demo-assets/ (gitignored). The capture specs use
// the helpers in demo/helpers.ts to login, switch users, load demo
// states, and snapshot.

import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'https://shabetz-na.vercel.app';

export default defineConfig({
  testDir: './demo/specs',
  // Captures must run serially — they share localStorage state and
  // sequencing matters (login → seed scenario → screenshot → move on).
  fullyParallel: false,
  workers: 1,
  // Cinematic captures: zero retries, no timeout pressure. Better a slow
  // perfect frame than a flaky fast one.
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    // Captures look real when the device emulation is real.
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    // Always trace failures so we can diagnose without re-running.
    trace: 'retain-on-failure',
    screenshot: 'off', // we drive screenshots explicitly
    video: 'off',
  },

  projects: [
    // Primary device. iPhone 14 Pro viewport, but rendered by Chromium
    // — keeps the cinematic look without requiring a WebKit install on
    // every contributor's machine. Pure visual emulation is fine for
    // captures; we're not testing browser-engine fidelity.
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 393, height: 852 }, // iPhone 14 Pro logical px
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent: devices['iPhone 14 Pro'].userAgent,
        locale: 'he-IL',
        timezoneId: 'Asia/Jerusalem',
      },
    },
    // Secondary: desktop for landscape comparison shots.
    {
      name: 'desktop',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 2,
        isMobile: false,
        hasTouch: false,
        locale: 'he-IL',
        timezoneId: 'Asia/Jerusalem',
      },
    },
  ],

  outputDir: 'demo-assets/test-runs',
});
