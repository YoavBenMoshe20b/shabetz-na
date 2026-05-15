// demo/helpers.ts — Playwright capture helpers for "הפלוגה שלי".
//
// Centralizes:
//   • Authentication via the mock-mode signIn form (phone + Test@1234)
//   • In-session user switching via the UserSwitcher dropdown
//   • Demo-state injection — write specific slices to localStorage so
//     the app loads in a known scenario (chaos / clean / shortage / etc)
//   • Asset writes — every screenshot goes under demo-assets/, organized
//     by category × project (mobile / desktop)
//
// Demo state files live in demo/states/*.json. Each file is an object
// keyed by slice name (matches `usePersistedState` slice argument).
// The helper translates the slice name into the full localStorage key
// (`ha-pluga-sheli:state:<slice>:v<version>`) at write time.

import { type Page, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MOCK_PASSWORD = 'Test@1234';
const STORAGE_PREFIX = 'ha-pluga-sheli:state:';

// Slice versions — must match the version param in AppContext's
// usePersistedState calls. If those bump, update here too.
const SLICE_VERSION: Record<string, number> = {
  missions: 2,
  // Everything else is v1 for now.
};

function storageKeyFor(slice: string): string {
  const v = SLICE_VERSION[slice] ?? 1;
  return `${STORAGE_PREFIX}${slice}:v${v}`;
}

// ─── Canonical demo personas ─────────────────────────────────────────

export const PERSONA = {
  cc:        { phone: '0501234567', role: 'מ״פ',    label: 'יוסי כהן' },
  dcc:       { phone: '0507777666', role: 'סמ״פ',   label: 'דנה לוי' },
  pcG1:      { phone: '0502222111', role: 'מ״מ 1',  label: 'רוני שמש' },
  pcG2:      { phone: '0501414141', role: 'מ״מ 2',  label: 'עומר בר' },
  pcG3:      { phone: '0501919191', role: 'מ״מ 3',  label: 'יואב סער' },
  psG1:      { phone: '0509999888', role: 'סמל 1',  label: 'ניסים דהן' },
  psG2:      { phone: '0501818181', role: 'סמל 2',  label: 'אייל גלעד' },
  psG3:      { phone: '0502121212', role: 'סמל 3',  label: 'שגיא ברנר' },
  rasap:     { phone: '0502323232', role: 'רס״פ',   label: 'אבי כהן' },
  shalish:   { phone: '0502424242', role: 'שליש',   label: 'רון אביב' },
  soldier1:  { phone: '0509876543', role: 'חייל 1', label: 'משה ישראלי' },
  soldier2:  { phone: '0503333222', role: 'חייל 2', label: 'אורן פרץ' },
} as const;

export type PersonaKey = keyof typeof PERSONA;

// ─── Storage management ─────────────────────────────────────────────

/** Clear ALL persisted demo state. After reload the app re-seeds. */
export async function resetDemo(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate((prefix) => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
    // Also clear the quiet-mode prefix and the mock-session phone, so
    // every capture starts at /login.
    const auxPrefixes = ['ha-pluga-sheli:quietMode:', 'ha-pluga-sheli/mock-session-phone'];
    const auxKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && auxPrefixes.some((p) => k.startsWith(p))) auxKeys.push(k);
    }
    for (const k of auxKeys) localStorage.removeItem(k);
  }, STORAGE_PREFIX);
  await page.reload();
}

/** Load a demo-state JSON file and overwrite the matching slices in
 *  localStorage. The page is then reloaded so the new state takes
 *  effect. */
export async function loadDemoState(page: Page, stateName: string): Promise<void> {
  const path = resolve(process.cwd(), 'demo', 'states', `${stateName}.json`);
  const raw = readFileSync(path, 'utf8');
  const state = JSON.parse(raw) as Record<string, unknown>;

  // Convert {slice: payload} → {fullStorageKey: payload}
  const entries = Object.entries(state).map(([slice, payload]) => [
    storageKeyFor(slice),
    JSON.stringify(payload),
  ]);

  await page.goto('/');
  await page.evaluate((kvs) => {
    for (const [k, v] of kvs) localStorage.setItem(k, v as string);
  }, entries);
  await page.reload();
}

// ─── Auth ───────────────────────────────────────────────────────────
//
// Pre-loads the persistedState slots for currentUser + currentRole
// instead of driving the UI form. This is faster, deterministic, and
// not vulnerable to React-controlled-input timing in dev mode. The
// only mock user fields the app reads on a fresh login are `id`, `name`,
// `phone`, `role`, `companyId`, `commandedPlatoonId`, `platoonId`,
// `squadId`, `soldierProfileId`, and `operationalRoles` — we set them
// from a built-in persona table so the helper has no I/O dependency
// on the bundled JS.

const PERSONA_BY_PHONE: Record<string, {
  id: string; name: string; phone: string;
  role: 'companyCommander' | 'deputyCompanyCommander' | 'platoonCommander' | 'platoonSergeant' | 'soldier';
  companyId: string;
  commandedPlatoonId?: string;
  platoonId?: string;
  squadId?: string;
  soldierProfileId?: string;
  operationalRoles?: string[];
  teamClass?: string;
}> = {
  '0501234567': { id: 'u1',  name: 'יוסי כהן',   phone: '0501234567', role: 'companyCommander',       companyId: 'co1', commandedPlatoonId: 'g-chapack', platoonId: 'g-chapack', squadId: 'sq-chap-1',   soldierProfileId: 's68', operationalRoles: ['מ״פ'],  teamClass: 'חפ״ק' },
  '0507777666': { id: 'u7',  name: 'דנה לוי',    phone: '0507777666', role: 'deputyCompanyCommander', companyId: 'co1', platoonId: 'g-chapack', squadId: 'sq-chap-1',   soldierProfileId: 's69', operationalRoles: ['סמ״פ'], teamClass: 'חפ״ק' },
  '0502222111': { id: 'u2',  name: 'רוני שמש',   phone: '0502222111', role: 'platoonCommander',       companyId: 'co1', commandedPlatoonId: 'g1', platoonId: 'g1', squadId: 'su-g1-a', soldierProfileId: 's2',  operationalRoles: ['מ״מ', 'קשר מ״מ'], teamClass: 'כיתה א' },
  '0501414141': { id: 'u9',  name: 'עומר בר',    phone: '0501414141', role: 'platoonCommander',       companyId: 'co1', commandedPlatoonId: 'g2', platoonId: 'g2', squadId: 'su-g2-a', soldierProfileId: 's14', operationalRoles: ['מ״מ'], teamClass: 'כיתה א' },
  '0501919191': { id: 'u10', name: 'יואב סער',   phone: '0501919191', role: 'platoonCommander',       companyId: 'co1', commandedPlatoonId: 'g3', platoonId: 'g3', squadId: 'su-g3-a', soldierProfileId: 's19', operationalRoles: ['מ״מ'], teamClass: 'כיתה א' },
  '0509999888': { id: 'u5',  name: 'ניסים דהן',  phone: '0509999888', role: 'platoonSergeant',        companyId: 'co1', commandedPlatoonId: 'g1', platoonId: 'g1', squadId: 'su-g1-a', soldierProfileId: 's9',  operationalRoles: ['סמל', 'חובש'], teamClass: 'כיתה א' },
  '0501818181': { id: 'u11', name: 'אייל גלעד',  phone: '0501818181', role: 'platoonSergeant',        companyId: 'co1', commandedPlatoonId: 'g2', platoonId: 'g2', squadId: 'su-g2-c', soldierProfileId: 's18', operationalRoles: ['סמל'], teamClass: 'כיתה ג' },
  '0502121212': { id: 'u12', name: 'שגיא ברנר',  phone: '0502121212', role: 'platoonSergeant',        companyId: 'co1', commandedPlatoonId: 'g3', platoonId: 'g3', squadId: 'su-g3-b', soldierProfileId: 's21', operationalRoles: ['סמל'], teamClass: 'כיתה ב' },
  '0502323232': { id: 'u6',  name: 'אבי כהן',    phone: '0502323232', role: 'soldier',                companyId: 'co1', commandedPlatoonId: 'g-meflag', platoonId: 'g-meflag', squadId: 'su-meflag-1', soldierProfileId: 's23', operationalRoles: ['רס״פ'], teamClass: 'מפלג' },
  '0502424242': { id: 'u8',  name: 'רון אביב',   phone: '0502424242', role: 'soldier',                companyId: 'co1', platoonId: 'g-meflag', squadId: 'su-meflag-1', soldierProfileId: 's24', operationalRoles: ['שליש'], teamClass: 'מפלג' },
  '0509876543': { id: 'u3',  name: 'משה ישראלי', phone: '0509876543', role: 'soldier',                companyId: 'co1', platoonId: 'g1', squadId: 'su-g1-a', soldierProfileId: 's1',  operationalRoles: ['קלע', 'חובש'], teamClass: 'כיתה א' },
  '0503333222': { id: 'u14', name: 'אורן פרץ',   phone: '0503333222', role: 'soldier',                companyId: 'co1', platoonId: 'g1', squadId: 'su-g1-b', soldierProfileId: 's3',  operationalRoles: ['נגביסט'], teamClass: 'כיתה ב' },
};

/** Pre-seat a logged-in session for the given phone. Avoids the form. */
export async function login(page: Page, phone: string): Promise<void> {
  const persona = PERSONA_BY_PHONE[phone];
  if (!persona) throw new Error(`Unknown persona for phone ${phone}`);

  // First navigate to / so we're on the right origin for localStorage,
  // then inject session, then navigate to /home so the app hydrates.
  await page.goto('/');
  await page.evaluate(({ user, role }) => {
    localStorage.setItem(
      'ha-pluga-sheli:state:currentUser:v1',
      JSON.stringify(user),
    );
    localStorage.setItem(
      'ha-pluga-sheli:state:currentRole:v1',
      JSON.stringify(role),
    );
  }, { user: persona, role: persona.role });
  await page.goto('/home');
  await page.waitForLoadState('networkidle');
}

/** Same as login() — kept for legibility in walkthrough specs that
 *  describe in-session "switching". Both go through the same direct
 *  seat mechanism. */
export async function switchUser(page: Page, phone: string): Promise<void> {
  await login(page, phone);
}

// (MOCK_PASSWORD retained as a documented constant for any future spec
//  that decides to drive the actual sign-in form.)
void MOCK_PASSWORD;

// ─── Stabilization ──────────────────────────────────────────────────

/** Wait for animations / async loads to settle before capturing. */
export async function settle(page: Page, ms = 500): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(ms);
}

// ─── Captures ───────────────────────────────────────────────────────

export interface ShotMeta {
  id: string;
  category: string;
  title?: string;
}

/** Take a full-page screenshot and write to demo-assets/<category>/
 *  <project>/<id>.png. */
export async function shoot(
  page: Page,
  meta: ShotMeta,
  testInfo: { project: { name: string } },
): Promise<void> {
  const project = testInfo.project.name;
  const path = resolve(
    process.cwd(),
    'demo-assets',
    meta.category,
    project,
    `${meta.id}.png`,
  );
  await settle(page);
  await page.screenshot({ path, fullPage: true });
}

/** Take a viewport-only (no scroll) screenshot. Use for hero shots
 *  where the fold matters. */
export async function shootViewport(
  page: Page,
  meta: ShotMeta,
  testInfo: { project: { name: string } },
): Promise<void> {
  const project = testInfo.project.name;
  const path = resolve(
    process.cwd(),
    'demo-assets',
    meta.category,
    project,
    `${meta.id}-viewport.png`,
  );
  await settle(page);
  await page.screenshot({ path, fullPage: false });
}

// ─── Sanity ─────────────────────────────────────────────────────────

/** Verify the brand wordmark appears — confirms we hit the right app. */
export async function expectBrand(page: Page): Promise<void> {
  await expect(page.getByText('הפלוגה שלי').first()).toBeVisible({ timeout: 10_000 });
}
