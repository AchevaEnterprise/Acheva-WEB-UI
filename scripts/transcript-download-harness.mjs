#!/usr/bin/env node
/**
 * The academic-record download, and where Paystack sends a student back to.
 *
 *   1. The download is FREE (the user, 2026-11-10: "take this 2000 naira fee
 *      for downloading results off"). The button names no price, pressing it
 *      downloads the PDF without going near Paystack, and there is no longer
 *      a way to buy one (`POST /transactions/transcript` is gone).
 *   2. `/dues/complete` must exist. Paystack's `callback_url` points at it
 *      and it fell through the `**` wildcard to the dashboard, so a student
 *      paid real money and the app said nothing about it. Old transcript
 *      payments still confirm there.
 *
 * Needs the student app and an API (TP_APP, TP_API — the app's :3000 calls
 * are rerouted to TP_API).
 *
 *   node scripts/transcript-download-harness.mjs
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';

const API = process.env.TP_API ?? 'http://localhost:3000';
const APP = process.env.TP_APP ?? 'http://localhost:4201';
const ENV_FILE = process.env.TP_ENV ?? '../../acheva-nestjs/.env';

let failures = 0;
const check = (ok, m, d = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${m}${d ? ` — ${d}` : ''}`);
  if (!ok) failures++;
};

const env = Object.fromEntries(
  readFileSync(new URL(ENV_FILE, import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const b64 = (v) =>
  Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
const signJwt = (payload, secret, ttl = 7200) => {
  const now = Math.floor(Date.now() / 1000);
  const body = b64({ ...payload, iat: now, exp: now + ttl });
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
};

const STUDENT = {
  id: process.env.TP_STUDENT ?? '69ea02d71a16b46a857a8693',
  email: 'danielchinemerem302+7@gmail.com',
  regNo: '20234148082',
  department: { _id: '693d7c1ee9ed492d7805c422', name: 'Mathematics Department' },
  faculty: { _id: '693d7b37e9ed492d7805c3fa', name: 'School of Physical Sciences' },
  school: { _id: '68ac80667a30dc0ea703d550', name: 'Federal University of Technology, Owerri' },
};

const token = signJwt(
  {
    id: STUDENT.id,
    email: STUDENT.email,
    regNo: STUDENT.regNo,
    accountType: 'STUDENT',
    emailVerified: true,
    department: STUDENT.department,
    faculty: STUDENT.faculty,
    school: STUDENT.school,
  },
  env.ACCESS_TOKEN_SECRET
);

const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

console.log('\n── the academic record is free ──');

const buy = await fetch(`${API}/transactions/transcript`, { method: 'POST', headers: auth });
check(buy.status === 404, 'there is no longer a way to pay for a download', `HTTP ${buy.status}`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 950 },
  deviceScaleFactor: 2,
  acceptDownloads: true,
});
if (API !== 'http://localhost:3000') {
  await ctx.route(/^http:\/\/localhost:3000\//, (route) =>
    route.continue({ url: route.request().url().replace('http://localhost:3000', API) })
  );
}
await ctx.addInitScript(
  ([t, a]) => {
    localStorage.setItem('token', t);
    localStorage.setItem('refresh_token', t);
    localStorage.setItem('active_account', a);
  },
  [
    token,
    JSON.stringify({
      // Past the details gate, which has its own harness (test:admin-console-ui).
      detailsRequired: false,
      id: STUDENT.id,
      fullName: 'Abigail Baker',
      registrationNumber: STUDENT.regNo,
      email: STUDENT.email,
      accountType: 'STUDENT',
      emailVerified: true,
      level: '100',
      session: '2023/2024',
      department: STUDENT.department,
      faculty: STUDENT.faculty,
      school: STUDENT.school,
      accessToken: token,
      refreshToken: token,
    }),
  ]
);

const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  !! pageerror:', String(e).slice(0, 140)));

await page.goto(`${APP}/results`, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForSelector('app-transcript-download', { timeout: 30000 });
await page.waitForTimeout(3000);

const label = (await page.locator('app-transcript-download button').first().innerText()).trim();
const blurb = await page.locator('app-transcript-download p').first().innerText();
check(/^Download academic record$/i.test(label), 'the button names no price', label);
check(!/₦|paid|charged/i.test(blurb), 'and nothing on it mentions paying', blurb.replace(/\s+/g, ' ').slice(0, 80));

// Pressing it downloads the record — and never reaches Paystack.
let wentToPaystack = null;
await page.route('https://checkout.paystack.com/**', (route) => {
  wentToPaystack = route.request().url();
  return route.abort();
});
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 45000 }).catch(() => null),
  page.locator('app-transcript-download button').first().click(),
]);
check(!!download, 'pressing it downloads the record', download?.suggestedFilename() ?? '');
check(!wentToPaystack, 'without going near Paystack', String(wentToPaystack ?? 'no checkout'));

console.log('\n── the page Paystack returns to ──');

// It exists at all — this used to fall through to the dashboard.
await page.goto(`${APP}/dues/complete?reference=TXN5ZH2CFTIZLM6K`, {
  waitUntil: 'domcontentloaded',
  timeout: 40000,
});
await page.waitForSelector('.complete', { timeout: 30000 });
await page.waitForTimeout(3500);

const body = await page.locator('.complete').innerText();
check(/Payment confirmed/i.test(body), 'a settled payment is confirmed to the student');
check(/₦[\d,]+\.\d{2}/.test(body), 'it states the amount', (body.match(/₦[\d,]+\.\d{2}/) ?? [''])[0]);
check(/TXN5ZH2CFTIZLM6K/.test(body), 'it states the reference to quote');
await page.screenshot({ path: 'screenshots/payment-complete.png' });

// Somebody else's reference must not be confirmed.
await page.goto(`${APP}/dues/complete?reference=TXN-NOT-MINE-0000`, {
  waitUntil: 'domcontentloaded',
  timeout: 40000,
});
await page.waitForSelector('.complete', { timeout: 30000 });
await page.waitForTimeout(3500);
const unknown = await page.locator('.complete').innerText();
check(
  /could not confirm/i.test(unknown) && !/Payment confirmed/i.test(unknown),
  'a reference that is not theirs is NOT reported as paid'
);
check(/do not pay again/i.test(unknown), 'and it tells them not to pay twice');

await browser.close();
console.log(failures ? `\n${failures} failed\n` : '\nall passed\n');
process.exit(failures ? 1 : 0);
