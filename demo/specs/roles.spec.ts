// roles.spec.ts — 12-persona walkthrough captures.
//
// For each persona: login → land on their dashboard → screenshot. Then
// drill into the one or two surfaces that matter for that role (e.g.
// /platoon for PCs, /rasap for RasaP, /report1 for Shalish).
//
// Outputs to demo-assets/roles/<project>/<persona-id>-<surface>.png

import { test } from '@playwright/test';
import {
  login, resetDemo, shoot, settle, PERSONA, expectBrand,
} from '../helpers';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await resetDemo(page);
});

test('מ״פ — CC dashboard', async ({ page }, testInfo) => {
  await login(page, PERSONA.cc.phone);
  await expectBrand(page);
  await shoot(page, { id: 'cc-home', category: 'roles' }, testInfo);
  await page.goto('/missions');
  await settle(page);
  await shoot(page, { id: 'cc-missions', category: 'roles' }, testInfo);
});

test('סמ״פ — DCC dashboard', async ({ page }, testInfo) => {
  await login(page, PERSONA.dcc.phone);
  await shoot(page, { id: 'dcc-home', category: 'roles' }, testInfo);
});

test('מ״מ 1 — PC g1 dashboard + שבצ״ק', async ({ page }, testInfo) => {
  await login(page, PERSONA.pcG1.phone);
  await shoot(page, { id: 'pc-g1-home', category: 'roles' }, testInfo);
  await page.goto('/platoon');
  await settle(page);
  await shoot(page, { id: 'pc-g1-schedule', category: 'roles' }, testInfo);
});

test('מ״מ 2 — PC g2 dashboard + שבצ״ק', async ({ page }, testInfo) => {
  await login(page, PERSONA.pcG2.phone);
  await shoot(page, { id: 'pc-g2-home', category: 'roles' }, testInfo);
  await page.goto('/platoon');
  await settle(page);
  await shoot(page, { id: 'pc-g2-schedule', category: 'roles' }, testInfo);
});

test('מ״מ 3 — PC g3 dashboard + שבצ״ק', async ({ page }, testInfo) => {
  await login(page, PERSONA.pcG3.phone);
  await shoot(page, { id: 'pc-g3-home', category: 'roles' }, testInfo);
  await page.goto('/platoon');
  await settle(page);
  await shoot(page, { id: 'pc-g3-schedule', category: 'roles' }, testInfo);
});

test('סמל 1 — PS g1 dashboard', async ({ page }, testInfo) => {
  await login(page, PERSONA.psG1.phone);
  await shoot(page, { id: 'ps-g1-home', category: 'roles' }, testInfo);
});

test('סמל 2 — PS g2 dashboard', async ({ page }, testInfo) => {
  await login(page, PERSONA.psG2.phone);
  await shoot(page, { id: 'ps-g2-home', category: 'roles' }, testInfo);
});

test('סמל 3 — PS g3 dashboard', async ({ page }, testInfo) => {
  await login(page, PERSONA.psG3.phone);
  await shoot(page, { id: 'ps-g3-home', category: 'roles' }, testInfo);
});

test('רס״פ — logistics chief dashboard + רס״פ page + מבנה מפלג', async ({ page }, testInfo) => {
  await login(page, PERSONA.rasap.phone);
  await shoot(page, { id: 'rasap-home', category: 'roles' }, testInfo);
  await page.goto('/rasap');
  await settle(page);
  await shoot(page, { id: 'rasap-board', category: 'roles' }, testInfo);
  await page.goto('/platoon/g-meflag/structure');
  await settle(page);
  await shoot(page, { id: 'rasap-meflag-structure', category: 'roles' }, testInfo);
});

test('שליש — admin dashboard + Report-1', async ({ page }, testInfo) => {
  await login(page, PERSONA.shalish.phone);
  await shoot(page, { id: 'shalish-home', category: 'roles' }, testInfo);
  await page.goto('/report1');
  await settle(page);
  await shoot(page, { id: 'shalish-report1', category: 'roles' }, testInfo);
});

test('חייל 1 — clean schedule', async ({ page }, testInfo) => {
  await login(page, PERSONA.soldier1.phone);
  await shoot(page, { id: 'soldier1-home', category: 'roles' }, testInfo);
});

test('חייל 2 — friction (pending leave + open gap)', async ({ page }, testInfo) => {
  await login(page, PERSONA.soldier2.phone);
  await shoot(page, { id: 'soldier2-home', category: 'roles' }, testInfo);
  await page.goto('/leaves');
  await settle(page);
  await shoot(page, { id: 'soldier2-leaves', category: 'roles' }, testInfo);
  await page.goto('/equipment');
  await settle(page);
  await shoot(page, { id: 'soldier2-equipment', category: 'roles' }, testInfo);
});
