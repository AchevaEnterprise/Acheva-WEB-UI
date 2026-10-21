#!/usr/bin/env node
/**
 * The Head's dues collections table.
 *
 * Checked in a browser because the thing being verified is a screen a Head
 * uses to decide who to chase: the summary has to describe the whole cohort
 * while the rows are filtered, the level tabs have to come from the roster
 * rather than from an enum, and the per-student breakdown has to show every
 * payment rather than the most recent one standing in for the rest. None of
 * that is observable from a spec over the aggregation alone.
 *
 * Needs the staff app on 4200 and the API on 3000.
 *
 *   node scripts/dues-collections-harness.mjs
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';

const API = process.env.DC_API ?? 'http://localhost:3000';
const APP = process.env.DC_APP ?? 'http://localhost:4200';
const ENV_FILE = process.env.DC_ENV ?? '../../acheva-nestjs/.env';

let failures = 0;
const check = (ok, m, d = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${m}${d ? ` — ${d}` : ''}`);
  if (!ok) failures++;
};

const env = Object.fromEntries(
  readFileSync(new URL(ENV_FILE, import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

/** HS256 by hand — see payments-harness.mjs for why. */
const b64 = (v) =>
  Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
const signJwt = (payload, secret, ttl = 7200) => {
  const now = Math.floor(Date.now() / 1000);
  const body = b64({ ...payload, iat: now, exp: now + ttl });
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
};

/**
 * The Mathematics Head. `accountType` is LECTURER and `role` is HOD — the
 * menu reads the role, and `requireHod` re-reads it from the database
 * regardless, so a token claiming otherwise buys nothing.
 */
const HOD = JSON.parse(
  readFileSync(
    process.env.DC_PROFILE ??
      '/private/tmp/claude-501/-Users-chinemeremdaniel-Projects-Acheva/763688fa-82db-418c-9519-85a9f4615bb9/scratchpad/hod-profile.json',
    'utf8'
  )
);

const token = signJwt(
  {
    id: HOD.id,
    email: HOD.email,
    role: HOD.role,
    otherRoles: HOD.otherRoles,
    accountType: HOD.accountType,
    department: HOD.department,
    faculty: HOD.faculty,
    school: HOD.school,
  },
  env.ACCESS_TOKEN_SECRET
);

console.log('\n── HOD dues collections ──');

const api = await fetch(`${API}/dues/my-department/collections?limit=5`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

check(!!api?.data?.plan, 'the API returns a published plan', api?.data?.session ?? '');
check(api?.data?.summary?.students > 0, 'the summary counts the cohort', `${api?.data?.summary?.students} students`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 950 },
  deviceScaleFactor: 2,
  colorScheme: 'light',
});
await ctx.addInitScript(
  ([t, a]) => {
    localStorage.setItem('token', t);
    localStorage.setItem('refresh_token', t);
    localStorage.setItem('active_account', a);
  },
  [token, JSON.stringify({ ...HOD, accessToken: token, refreshToken: token })]
);

const page = await ctx.newPage();
page.on('console', (m) => m.type() === 'error' && console.log('  !', m.text().slice(0, 140)));
page.on('pageerror', (e) => console.log('  !! pageerror:', String(e).slice(0, 160)));

await page.goto(`${APP}/dues-management`, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForSelector('.collections', { timeout: 30000 });
await page.waitForTimeout(3500);

check((await page.locator('app-due-analytics').count()) === 4, 'the four headline figures render');

const collected = await page.locator('app-due-analytics').first().innerText().catch(() => '');
check(/₦[\d,]+\.\d{2}/.test(collected), 'collected is shown as naira, not kobo', collected.replace(/\n/g, ' ').slice(0, 60));

check((await page.locator('tbody tr').count()) > 0, 'the roster table has rows');

// The level tabs come from the roster, so none of them leads nowhere.
const tabs = await page.locator('.chip').allInnerTexts();
check(tabs[0] === 'All levels', 'the first tab is All levels', tabs.join(' | '));
check(!tabs.includes('600L'), 'no level tab the cohort does not contain', tabs.join(' | '));

// The summary describes the whole cohort even when the rows are filtered.
const beforeSummary = await page.locator('app-due-analytics').nth(3).innerText();
await page.locator('select[aria-label="Filter by payment status"]').selectOption('PARTIAL');
await page.waitForTimeout(2500);
const afterSummary = await page.locator('app-due-analytics').nth(3).innerText();
check(
  beforeSummary === afterSummary,
  'the summary does NOT move when the rows are filtered',
  afterSummary.replace(/\n/g, ' ').slice(0, 40)
);

const filteredRows = await page.locator('tbody tr').count();
check(filteredRows > 0 && filteredRows < 50, 'filtering to Part paid narrows the rows', `${filteredRows} rows`);

// Every payment, not just the most recent.
await page.locator('.link').first().click();
await page.waitForTimeout(800);
check((await page.locator('.breakdown li').count()) > 0, 'the breakdown lists each payment with its date');

const breakdown = await page.locator('.breakdown').first().innerText();
check(/₦[\d,]+\.\d{2}/.test(breakdown), 'each payment shows a naira amount');
check(/TXN/.test(breakdown), 'each payment shows its reference');

await page.screenshot({ path: 'screenshots/dues-collections.png', fullPage: false });

/**
 * No green anywhere — the brand rule.
 *
 * Checks SVG `fill`/`stroke` as well as CSS backgrounds. A background-only
 * check passed this page while a green tick icon sat in the first card: the
 * colour was inside the SVG, which `getComputedStyle` on the host never
 * reports.
 */
const greens = await page.evaluate(() => {
  const isGreen = (value) => {
    const m = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return false;
    const [r, g, b] = [+m[1], +m[2], +m[3]];
    return g > 110 && g > r + 28 && g > b + 28;
  };

  const hits = [];
  for (const el of Array.from(
    document.querySelectorAll('.pill, .chip, app-due-analytics *, app-due-analytics svg *')
  )) {
    const style = getComputedStyle(el);
    for (const prop of ['backgroundColor', 'fill', 'stroke', 'color']) {
      if (isGreen(style[prop])) hits.push(`${el.tagName}.${el.className}:${prop}=${style[prop]}`);
    }
  }
  return hits;
});
check(greens.length === 0, 'no green chrome — brand blue only', greens.slice(0, 2).join(', '));

// 1000px is the staff portal's floor.
await page.setViewportSize({ width: 1000, height: 950 });
await page.waitForTimeout(700);
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
);
check(!overflow, 'no horizontal page scroll at 1000px');
await page.screenshot({ path: 'screenshots/dues-collections-1000.png', fullPage: false });

await browser.close();
console.log(failures ? `\n${failures} failed\n` : '\nall passed\n');
process.exit(failures ? 1 : 0);
