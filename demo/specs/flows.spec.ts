// flows.spec.ts — interaction flows recorded as video + frame-by-frame.
//
// These are the most "cinematic" captures. Each test runs with video
// recording on (WebM) AND drops frame stills at every important beat,
// so the editor has both motion and frames to cut from.
//
// We keep the interactions minimal and robust: deep-link to surfaces
// that exist deterministically (no clicking into Sheets that depend on
// engine state we'd have to fabricate). The cinematic value is in the
// SEQUENCE of pages, not the specific clicks.
//
// Flows:
//   • staffing — PC sees their dashboard, opens שבצ״ק, opens a mission
//   • mission-creation — CC opens missions, opens the wizard
//   • audit-trail — CC opens a mission, scrolls to the audit section
//
// Outputs:
//   • Stills:    demo-assets/flows/<project>/<flow>-<beat>.png
//   • Videos:    demo-assets/flows/<project>/<flow>.webm

import { test } from '@playwright/test';
import {
  login, resetDemo, shoot, settle, PERSONA,
} from '../helpers';

test.describe.configure({ mode: 'serial' });
test.use({ video: 'on' });

test('flow — staffing path: PC → שבצ״ק → mission detail', async ({ page }, testInfo) => {
  await resetDemo(page);
  await login(page, PERSONA.pcG2.phone);
  await shoot(page, { id: 'staffing-1-pc-home', category: 'flows' }, testInfo);

  await page.goto('/platoon');
  await settle(page);
  await shoot(page, { id: 'staffing-2-platoon-week', category: 'flows' }, testInfo);

  // Scroll the week page to show fatigue dots / status pills.
  await page.mouse.wheel(0, 600);
  await settle(page, 400);
  await shoot(page, { id: 'staffing-3-platoon-week-mid', category: 'flows' }, testInfo);

  // Deep-link to mi-gate-south (g2's mission) — guaranteed to exist
  // for u9 by seed.
  await page.goto('/mission/mi-gate-south');
  await settle(page, 600);
  await shoot(page, { id: 'staffing-4-mission-detail', category: 'flows' }, testInfo);

  // Scroll to surface the structured definition + slots.
  await page.mouse.wheel(0, 1000);
  await settle(page, 400);
  await shoot(page, { id: 'staffing-5-mission-slots', category: 'flows' }, testInfo);

  // Save the video clip.
  // Video is auto-saved by Playwright to demo-assets/test-runs/<test>/
  // video.webm. The post-run copy step in package.json moves it into
  // demo-assets/flows/<project>/staffing.webm.
});

test('flow — CC creates a mission (wizard hero)', async ({ page }, testInfo) => {
  await resetDemo(page);
  await login(page, PERSONA.cc.phone);
  await page.goto('/missions');
  await settle(page);
  await shoot(page, { id: 'mission-1-list', category: 'flows' }, testInfo);
  await page.goto('/missions/new');
  await settle(page, 800);
  await shoot(page, { id: 'mission-2-wizard-step1', category: 'flows' }, testInfo);

  // Video auto-saved by Playwright; see staffing flow note above.
});

test('flow — audit history on a staffed mission', async ({ page }, testInfo) => {
  await resetDemo(page);
  await login(page, PERSONA.cc.phone);
  // Deep-link directly to a known mission.
  await page.goto('/mission/mi-gate-north');
  await settle(page, 600);
  await shoot(page, { id: 'audit-1-mission-detail', category: 'flows' }, testInfo);
  await page.mouse.wheel(0, 1500);
  await settle(page, 400);
  await shoot(page, { id: 'audit-2-mid-scroll', category: 'flows' }, testInfo);
  await page.mouse.wheel(0, 1500);
  await settle(page, 400);
  await shoot(page, { id: 'audit-3-end', category: 'flows' }, testInfo);
});
