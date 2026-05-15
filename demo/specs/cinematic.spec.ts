// cinematic.spec.ts — capture spec for the 90-second Operational Demo
// Film. Produces the 20 in-app stills referenced in cinematic-script.md.
// Run with: BASE_URL=https://shabetz-na.vercel.app npm run capture-demo:cinematic
//
// Each test maps 1:1 to a scene/shot in the script. Demo state is
// loaded BEFORE login so the materializer rehydrates with the right
// scenario. Stills land under demo-assets/cinematic/<project>/.
//
// IMPORTANT: this spec depends on system state that is unstable today.
// Read `demo/cinematic-script.md` § "What must be polished BEFORE we
// capture" before running. If polish items aren't closed, frames will
// look wrong.

import { test } from '@playwright/test';
import {
  login, loadDemoState, resetDemo, shoot, settle, PERSONA,
} from '../helpers';

test.describe.configure({ mode: 'serial' });

// ─── Scene 1 · Cold open ────────────────────────────────────────────
// (Only the app frame; chaos visuals 1.1-1.3 are external assets.)

test('cinematic — 1.4 cold-open app frame', async ({ page }, testInfo) => {
  await resetDemo(page);
  await login(page, PERSONA.cc.phone);
  await settle(page, 800);
  await shoot(page, { id: 'scene1-cc-cold-open', category: 'cinematic' }, testInfo);
});

// ─── Scene 2 · CC takes command ─────────────────────────────────────

test('cinematic — 2.1 CC home (clean)', async ({ page }, testInfo) => {
  await loadDemoState(page, 'clean-operation');
  await login(page, PERSONA.cc.phone);
  await settle(page, 800);
  await shoot(page, { id: 'scene2-cc-home', category: 'cinematic' }, testInfo);
});

test('cinematic — 2.2 CC platoons section', async ({ page }, testInfo) => {
  await loadDemoState(page, 'clean-operation');
  await login(page, PERSONA.cc.phone);
  // Scroll into the platoons table — the editor crops in post.
  await page.mouse.wheel(0, 400);
  await settle(page, 500);
  await shoot(page, { id: 'scene2-cc-platoons-detail', category: 'cinematic' }, testInfo);
});

test('cinematic — 2.3 CC /missions', async ({ page }, testInfo) => {
  await loadDemoState(page, 'clean-operation');
  await login(page, PERSONA.cc.phone);
  await page.goto('/missions');
  await settle(page, 800);
  await shoot(page, { id: 'scene2-cc-missions', category: 'cinematic' }, testInfo);
});

test('cinematic — 2.4 CC mission wizard step 1', async ({ page }, testInfo) => {
  await loadDemoState(page, 'clean-operation');
  await login(page, PERSONA.cc.phone);
  await page.goto('/missions/new');
  await settle(page, 1000);
  await shoot(page, { id: 'scene2-cc-wizard', category: 'cinematic' }, testInfo);
});

// ─── Scene 3 · PC stages the response ──────────────────────────────

test('cinematic — 3.1 PC action center under pressure', async ({ page }, testInfo) => {
  await loadDemoState(page, 'partial-staffing-pressure');
  await login(page, PERSONA.pcG1.phone);
  await settle(page, 800);
  await shoot(page, { id: 'scene3-pc-action-center', category: 'cinematic' }, testInfo);
});

test('cinematic — 3.2 PC /platoon/missions', async ({ page }, testInfo) => {
  await loadDemoState(page, 'partial-staffing-pressure');
  await login(page, PERSONA.pcG1.phone);
  await page.goto('/platoon/missions');
  await settle(page, 800);
  await shoot(page, { id: 'scene3-pc-missions', category: 'cinematic' }, testInfo);
});

test('cinematic — 3.3 StaffingSheet open (engine outcome visible)', async ({ page }, testInfo) => {
  await loadDemoState(page, 'partial-staffing-pressure');
  await login(page, PERSONA.pcG1.phone);
  await page.goto('/mission/mi-gate-north');
  await settle(page, 800);
  // Open the first slot row → triggers StaffingSheet
  const firstSlotBtn = page.getByText('איוש ←').first();
  await firstSlotBtn.waitFor({ state: 'visible', timeout: 8000 });
  await firstSlotBtn.click();
  await settle(page, 1000);
  await shoot(page, { id: 'scene3-staffing-sheet', category: 'cinematic' }, testInfo);
});

test('cinematic — 3.4 Slot Operations sheet', async ({ page }, testInfo) => {
  await loadDemoState(page, 'partial-staffing-pressure');
  await login(page, PERSONA.pcG1.phone);
  await page.goto('/mission/mi-gate-north');
  await settle(page, 800);
  const opsBtn = page.getByRole('button', { name: 'ניהול תפעולי' }).first();
  await opsBtn.waitFor({ state: 'visible', timeout: 8000 });
  await opsBtn.click();
  await settle(page, 800);
  await shoot(page, { id: 'scene3-slot-ops', category: 'cinematic' }, testInfo);
});

test('cinematic — 3.5 Excuse-soldier form', async ({ page }, testInfo) => {
  await loadDemoState(page, 'partial-staffing-pressure');
  await login(page, PERSONA.pcG1.phone);
  await page.goto('/mission/mi-gate-north');
  await settle(page, 800);
  const opsBtn = page.getByRole('button', { name: 'ניהול תפעולי' }).first();
  await opsBtn.waitFor({ state: 'visible', timeout: 8000 });
  await opsBtn.click();
  await settle(page, 800);
  // Scroll to the excuses section
  await page.mouse.wheel(0, 600);
  await settle(page, 400);
  await shoot(page, { id: 'scene3-excuse', category: 'cinematic' }, testInfo);
});

test('cinematic — 3.6 Locks chips on mission slot rows', async ({ page }, testInfo) => {
  await loadDemoState(page, 'partial-staffing-pressure');
  await login(page, PERSONA.pcG1.phone);
  await page.goto('/mission/mi-gate-north');
  await settle(page, 800);
  // Scroll to משמרות השבוע so the chip row is visible
  await page.mouse.wheel(0, 800);
  await settle(page, 400);
  await shoot(page, { id: 'scene3-locks-chips', category: 'cinematic' }, testInfo);
});

// ─── Scene 4 · RasaP + Shalish ─────────────────────────────────────

test('cinematic — 4.1 RasaP home', async ({ page }, testInfo) => {
  await loadDemoState(page, 'logistics-pressure');
  await login(page, PERSONA.rasap.phone);
  await settle(page, 800);
  await shoot(page, { id: 'scene4-rasap-home', category: 'cinematic' }, testInfo);
});

test('cinematic — 4.2 RasaP /rasap board', async ({ page }, testInfo) => {
  await loadDemoState(page, 'logistics-pressure');
  await login(page, PERSONA.rasap.phone);
  await page.goto('/rasap');
  await settle(page, 800);
  await shoot(page, { id: 'scene4-rasap-board', category: 'cinematic' }, testInfo);
});

test('cinematic — 4.3 MAFLAG structure', async ({ page }, testInfo) => {
  await loadDemoState(page, 'logistics-pressure');
  await login(page, PERSONA.rasap.phone);
  await page.goto('/platoon/g-meflag/structure');
  await settle(page, 800);
  await shoot(page, { id: 'scene4-meflag-structure', category: 'cinematic' }, testInfo);
});

test('cinematic — 4.4 Shalish report 1', async ({ page }, testInfo) => {
  await loadDemoState(page, 'logistics-pressure');
  await login(page, PERSONA.shalish.phone);
  await page.goto('/report1');
  await settle(page, 800);
  await shoot(page, { id: 'scene4-shalish-report1', category: 'cinematic' }, testInfo);
});

// ─── Scene 5 · Operational Leaves ──────────────────────────────────

test('cinematic — 5.1 Leave board full view', async ({ page }, testInfo) => {
  await loadDemoState(page, 'leave-rotation-active');
  await login(page, PERSONA.cc.phone);
  await page.goto('/coverage/platoons');
  await settle(page, 1000);
  await shoot(page, { id: 'scene5-leave-board', category: 'cinematic' }, testInfo);
});

test('cinematic — 5.2 Coverage warnings strip', async ({ page }, testInfo) => {
  await loadDemoState(page, 'leave-rotation-active');
  await login(page, PERSONA.cc.phone);
  await page.goto('/coverage/platoons');
  await settle(page, 1000);
  // Scroll to surface the warnings strip in the viewport
  await page.mouse.wheel(0, 500);
  await settle(page, 400);
  await shoot(page, { id: 'scene5-warnings', category: 'cinematic' }, testInfo);
});

test('cinematic — 5.3 Coverage rules list', async ({ page }, testInfo) => {
  await loadDemoState(page, 'leave-rotation-active');
  await login(page, PERSONA.cc.phone);
  await page.goto('/coverage/platoons');
  await settle(page, 1000);
  await page.mouse.wheel(0, 1800);
  await settle(page, 400);
  await shoot(page, { id: 'scene5-coverage-rules', category: 'cinematic' }, testInfo);
});

test('cinematic — 5.4 PC platoon-leave widget on dashboard', async ({ page }, testInfo) => {
  await loadDemoState(page, 'leave-rotation-active');
  await login(page, PERSONA.pcG1.phone);
  await settle(page, 800);
  // Scroll until the יציאות המחלקה section is in viewport.
  await page.mouse.wheel(0, 700);
  await settle(page, 400);
  await shoot(page, { id: 'scene5-pc-leave-view', category: 'cinematic' }, testInfo);
});

// ─── Scene 6 · Soldier sees it ─────────────────────────────────────

test('cinematic — 6.1 Soldier home', async ({ page }, testInfo) => {
  await loadDemoState(page, 'clean-operation');
  await login(page, PERSONA.soldier1.phone);
  await settle(page, 800);
  await shoot(page, { id: 'scene6-soldier-home', category: 'cinematic' }, testInfo);
});

test('cinematic — 6.3 Soldier weekly schedule expanded', async ({ page }, testInfo) => {
  await loadDemoState(page, 'clean-operation');
  await login(page, PERSONA.soldier1.phone);
  await settle(page, 800);
  // Expand "הסידור שלי השבוע"
  const weekBtn = page.getByText(/הסידור שלי השבוע/).first();
  if (await weekBtn.count() > 0) {
    await weekBtn.click();
    await settle(page, 500);
  }
  await shoot(page, { id: 'scene6-week', category: 'cinematic' }, testInfo);
});

// (6.2 ChecklistRunSheet "passed" state — needs a seeded completed run.
//  Capture manually for v1 or seed a passed run in clean-operation.json.)
