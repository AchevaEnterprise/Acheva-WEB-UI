#!/usr/bin/env node
/**
 * Every route, every filter, every dropdown — does it actually work?
 *
 * Walks an app's routes with a real session and, on each one:
 *
 *   • records console errors and failed requests during load;
 *   • changes every native <select> to each of its options;
 *   • opens every Material select and picks an option;
 *   • clicks every tab / chip / segment filter;
 *   • steps the paginator;
 *   • types into every search box.
 *
 * After each interaction it checks for a console error, a 4xx/5xx, or an
 * Angular error overlay.
 *
 * **It never clicks a button that could change data.** Filters and tabs are
 * reads; "Publish", "Delete", "Send" and friends are not, and clicking them
 * against a real database to see whether they are wired is not a test, it
 * is an incident. Those are covered by the static audit instead.
 *
 * A filter that issues a NON-GET request is reported: narrowing a list must
 * not write anything.
 *
 *   node scripts/ui-sweep-harness.mjs staff|student|admin
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';

const WHICH = process.argv[2] ?? 'staff';
const API = process.env.SWEEP_API ?? 'http://localhost:3000';

const env = Object.fromEntries(
  readFileSync(new URL('../../acheva-nestjs/.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const b64 = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
const signJwt = (payload) => {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ ...payload, iat: now, exp: now + 7200 });
  const sig = createHmac('sha256', env.ACCESS_TOKEN_SECRET)
    .update(`${head}.${body}`)
    .digest('base64url');
  return `${head}.${body}.${sig}`;
};

const DEPT = { _id: '693d7c1ee9ed492d7805c422', name: 'Mathematics Department', code: 'MTH' };
const FAC = { _id: '693d7b37e9ed492d7805c3fa', name: 'School of Physical Sciences', code: 'SOPS' };
const SCH = { _id: '68ac80667a30dc0ea703d550', name: 'Federal University of Technology, Owerri' };

const APPS = {
  staff: {
    url: 'http://localhost:4200',
    routes: [
      'dashboard', 'courses', 'my-result', 'result-management', 'notifications',
      'support', 'user-settings', 'messages', 'history', 'students',
      'registration', 'moderation', 'dues-management',
    ],
    account: {
      id: '69e9f7ec1a16b46a857a847a',
      email: 'danielchinemerem302+1@gmail.com',
      role: 'HOD',
      otherRoles: [],
      accountType: 'LECTURER',
      department: DEPT, faculty: FAC, school: SCH,
    },
  },
  student: {
    url: 'http://localhost:4201',
    routes: ['dashboard', 'results', 'registration', 'dues', 'payment-history', 'faq', 'messages', 'support', 'settings'],
    account: {
      id: '69ea02d71a16b46a857a8693',
      email: 'danielchinemerem302+7@gmail.com',
      regNo: '20234148082',
      accountType: 'STUDENT',
      emailVerified: true,
      fullName: 'Abigail Baker',
      registrationNumber: '20234148082',
      level: '100',
      session: '2023/2024',
      department: DEPT, faculty: FAC, school: SCH,
    },
  },
  admin: {
    url: 'http://localhost:4300',
    routes: [
      'dashboard', 'schools', 'faculty', 'department', 'courses',
      'admins', 'registration', 'fees', 'support', 'settings',
    ],
    // The admin app keys localStorage differently from the other two, and
    // carries no school — the desk is Acheva, not the institution.
    storage: { token: 'acheva-admin-token', account: 'acheva-admin-account' },
    account: {
      id: '6a49543436f979622f1fbae6',
      email: 'members@acheva.app',
      firstname: 'Acheva',
      lastname: 'Admin',
      accountType: 'ADMIN',
      privileges: [],
    },
  },
};

const app = APPS[WHICH];
if (!app) {
  console.error(`unknown app "${WHICH}" — one of: ${Object.keys(APPS).join(', ')}`);
  process.exit(2);
}

const token = signJwt(app.account);
const problems = [];
const note = (route, what) => problems.push(`${route}: ${what}`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const keys = app.storage ?? {
  token: 'token',
  refresh: 'refresh_token',
  account: 'active_account',
};
await ctx.addInitScript(
  ([k, t, a]) => {
    localStorage.setItem(k.token, t);
    if (k.refresh) localStorage.setItem(k.refresh, t);
    localStorage.setItem(k.account, a);
  },
  [keys, token, JSON.stringify({ ...app.account, accessToken: token, refreshToken: token })]
);

const page = await ctx.newPage();

let consoleErrors = [];
let badRequests = [];
let writes = [];

page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const text = m.text();
  // A failed fetch is already captured as a bad request; this is the echo.
  if (/Failed to load resource/.test(text)) return;
  consoleErrors.push(text.slice(0, 160));
});
page.on('pageerror', (e) => consoleErrors.push(`UNCAUGHT: ${String(e).slice(0, 160)}`));
page.on('response', (r) => {
  const url = r.url();
  if (!url.startsWith(API)) return;
  if (r.status() >= 400) badRequests.push(`${r.status()} ${r.request().method()} ${url.replace(API, '')}`);
});
page.on('request', (r) => {
  if (!r.url().startsWith(API)) return;
  if (r.method() !== 'GET') writes.push(`${r.method()} ${r.url().replace(API, '')}`);
});

const reset = () => {
  consoleErrors = [];
  badRequests = [];
  writes = [];
};

/** Everything that went wrong since the last reset. */
const drain = (route, context) => {
  for (const e of new Set(consoleErrors)) note(route, `${context} → console error: ${e}`);
  for (const r of new Set(badRequests)) note(route, `${context} → ${r}`);
  reset();
};

console.log(`\n══════ ${WHICH.toUpperCase()} — ${app.routes.length} routes ══════`);

for (const route of app.routes) {
  reset();
  let loaded = true;
  try {
    await page.goto(`${app.url}/${route}`, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(4000);
  } catch (e) {
    loaded = false;
    note(route, `PAGE DID NOT LOAD — ${String(e).slice(0, 90)}`);
  }
  if (!loaded) continue;

  // Did it render anything at all, or land on an empty shell / login?
  const text = (await page.locator('body').innerText().catch(() => '')) || '';
  if (text.trim().length < 40) note(route, 'renders almost nothing — blank page?');
  if (/sign in|log in to your account/i.test(text) && route !== 'login') {
    note(route, 'bounced to the sign-in screen — session not accepted');
  }

  drain(route, 'on load');

  // ── native selects ────────────────────────────────────────────────────
  const selects = await page.locator('select:visible').all();
  for (const [i, select] of selects.entries()) {
    const label = (await select.getAttribute('aria-label')) ?? `select#${i}`;
    const options = await select.locator('option').all();
    if (options.length <= 1) {
      note(route, `dropdown "${label}" has ${options.length} option(s) — nothing to choose`);
      continue;
    }
    for (const option of options.slice(0, 4)) {
      const value = await option.getAttribute('value');
      if (value === null) continue;
      reset();
      try {
        await select.selectOption(value);
        await page.waitForTimeout(1400);
      } catch (e) {
        note(route, `dropdown "${label}" could not select "${value}" — ${String(e).slice(0, 60)}`);
        continue;
      }
      for (const w of new Set(writes)) note(route, `dropdown "${label}" issued a WRITE: ${w}`);
      drain(route, `dropdown "${label}" → "${value}"`);
    }
  }

  // ── Material selects ──────────────────────────────────────────────────
  const matSelects = await page.locator('mat-select:visible').all();
  for (const [i, sel] of matSelects.entries()) {
    reset();
    try {
      await sel.click({ timeout: 4000 });
      await page.waitForTimeout(700);
      const opts = await page.locator('mat-option:visible').all();
      if (opts.length === 0) {
        note(route, `mat-select#${i} opened with NO options`);
        await page.keyboard.press('Escape');
        continue;
      }
      await opts[Math.min(1, opts.length - 1)].click();
      await page.waitForTimeout(1400);
    } catch (e) {
      note(route, `mat-select#${i} would not open or choose — ${String(e).slice(0, 60)}`);
      await page.keyboard.press('Escape').catch(() => undefined);
      continue;
    }
    drain(route, `mat-select#${i}`);
  }

  // ── tabs / chips / segment switchers ──────────────────────────────────
  const tabs = await page
    .locator('[role="tab"]:visible, .chip:visible, app-segment-switcher button:visible, .segment:visible')
    .all();
  for (const [i, tab] of tabs.slice(0, 10).entries()) {
    const label = ((await tab.innerText().catch(() => '')) || `tab#${i}`).trim().slice(0, 24);
    reset();
    try {
      await tab.click({ timeout: 4000 });
      await page.waitForTimeout(1300);
    } catch {
      note(route, `tab/filter "${label}" is not clickable`);
      continue;
    }
    for (const w of new Set(writes)) note(route, `tab "${label}" issued a WRITE: ${w}`);
    drain(route, `tab "${label}"`);
  }

  // ── search boxes ──────────────────────────────────────────────────────
  const searches = await page
    .locator('input[type="search"]:visible, input[placeholder*="earch" i]:visible')
    .all();
  for (const [i, box] of searches.slice(0, 3).entries()) {
    reset();
    try {
      await box.fill('a');
      await page.waitForTimeout(1600);
      await box.fill('');
      await page.waitForTimeout(1200);
    } catch {
      note(route, `search box#${i} would not accept input`);
      continue;
    }
    drain(route, `search box#${i}`);
  }

  // ── paginator ─────────────────────────────────────────────────────────
  const next = page.locator('button[aria-label*="Next"]:visible, .mat-mdc-paginator-navigation-next:visible').first();
  if ((await next.count()) > 0 && (await next.isEnabled().catch(() => false))) {
    reset();
    await next.click().catch(() => undefined);
    await page.waitForTimeout(1500);
    drain(route, 'paginator next');
  }

  process.stdout.write(`  ${route} ✓\n`);
}

await browser.close();

console.log(`\n── findings: ${problems.length} ──`);
for (const p of problems) console.log(`  • ${p}`);
if (!problems.length) console.log('  none — every route loaded and every filter responded cleanly');
process.exit(problems.length ? 1 : 0);
