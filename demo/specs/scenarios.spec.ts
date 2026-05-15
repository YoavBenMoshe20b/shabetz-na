// scenarios.spec.ts — operational scenarios as still captures.
//
// Each test loads a demo-state JSON, logs in as the persona who'd most
// naturally see that scenario, and screenshots the surfaces where the
// scenario reads loudest. Use these as cinematic intercut frames.
//
// Outputs to demo-assets/scenarios/<project>/<scenario>-<surface>.png

import { test } from '@playwright/test';
import {
  login, loadDemoState, shoot, settle, PERSONA,
} from '../helpers';

test.describe.configure({ mode: 'serial' });

test('clean operation — CC sees a quiet morning', async ({ page }, testInfo) => {
  await loadDemoState(page, 'clean-operation');
  await login(page, PERSONA.cc.phone);
  await shoot(page, { id: 'clean-cc-home', category: 'scenarios' }, testInfo);
  await page.goto('/platoon');
  await settle(page);
  await shoot(page, { id: 'clean-cc-platoon', category: 'scenarios' }, testInfo);
});

test('chaos shortage — CC opens to a storm', async ({ page }, testInfo) => {
  await loadDemoState(page, 'chaos-shortage');
  await login(page, PERSONA.cc.phone);
  await shoot(page, { id: 'chaos-cc-home', category: 'scenarios' }, testInfo);
  await page.goto('/alerts');
  await settle(page);
  await shoot(page, { id: 'chaos-cc-alerts', category: 'scenarios' }, testInfo);
});

test('chaos shortage — PC sees their platoon under floor', async ({ page }, testInfo) => {
  await loadDemoState(page, 'chaos-shortage');
  await login(page, PERSONA.pcG1.phone);
  await shoot(page, { id: 'chaos-pc-g1-home', category: 'scenarios' }, testInfo);
  await page.goto('/platoon');
  await settle(page);
  await shoot(page, { id: 'chaos-pc-g1-schedule', category: 'scenarios' }, testInfo);
});

test('escalation active — banner state on CC', async ({ page }, testInfo) => {
  await loadDemoState(page, 'escalation-active');
  await login(page, PERSONA.cc.phone);
  await shoot(page, { id: 'escalation-cc-home', category: 'scenarios' }, testInfo);
});

test('logistics pressure — רס״פ queue', async ({ page }, testInfo) => {
  await loadDemoState(page, 'logistics-pressure');
  await login(page, PERSONA.rasap.phone);
  await shoot(page, { id: 'logistics-rasap-home', category: 'scenarios' }, testInfo);
  await page.goto('/rasap');
  await settle(page);
  await shoot(page, { id: 'logistics-rasap-board', category: 'scenarios' }, testInfo);
});

test('soldier friction — חייל 2 with pending leave + gap', async ({ page }, testInfo) => {
  await loadDemoState(page, 'soldier-friction');
  await login(page, PERSONA.soldier2.phone);
  await shoot(page, { id: 'friction-soldier2-home', category: 'scenarios' }, testInfo);
  await page.goto('/leaves');
  await settle(page);
  await shoot(page, { id: 'friction-soldier2-leaves', category: 'scenarios' }, testInfo);
  await page.goto('/equipment');
  await settle(page);
  await shoot(page, { id: 'friction-soldier2-equipment', category: 'scenarios' }, testInfo);
});
