#!/usr/bin/env node
/**
 * The transcript paywall, and where Paystack sends the student back to.
 *
 * Two things that only show up in a browser:
 *
 *   1. The download button must NAME ITS PRICE before it is pressed. It used
 *      to call `POST /transcripts/me/issue` directly and turn the 402 into
 *      "something went wrong building the document" — wrong, and nothing the
 *      student can act on.
 *   2. `/dues/complete` must exist. Paystack's `callback_url` points at it
 *      and it fell through the `**` wildcard to the dashboard, so a student
 *      paid real money and the app said nothing about it.
 *
 * Needs the student app on 4201 and the API on 3000.
 *
 *   node scripts/transcript-paywall-harness.mjs
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

console.log('\n── transcript paywall ──');

const fees = await fetch(`${API}/platform-settings/fees`, { headers: auth }).then((r) => r.json());
const feeKobo = fees?.data?.transcriptFeeKobo;
check(feeKobo > 0, 'the platform states a transcript fee', `${feeKobo} kobo`);

/**
 * The student may or may not be holding a paid, unspent download — a
 * previous run of this harness leaves one behind the moment its payment
 * settles. Rather than assume a state and fail noisily on the other, the
 * harness asserts the behaviour CORRECT FOR THE STATE IT FINDS, and covers
 * the other half through the API.
 */
const ent = await fetch(`${API}/transactions/transcript/entitlement`, { headers: auth }).then((r) =>
  r.json()
);
const entitled = ent?.data?.entitled === true;
console.log(`  · student is ${entitled ? 'HOLDING a paid download' : 'UNPAID'}`);

if (!entitled) {
  // Unpaid issue must be refused, and refused as PAYMENT REQUIRED — not as
  // a generic 500 the page can only describe as "something went wrong".
  const issue = await fetch(`${API}/transcripts/me/issue`, { method: 'POST', headers: auth });
  check(issue.status === 402, 'issuing without paying is refused 402', String(issue.status));
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 950 },
  deviceScaleFactor: 2,
  acceptDownloads: true,
});
await ctx.addInitScript(
  ([t, a]) => {
    localStorage.setItem('token', t);
    localStorage.setItem('refresh_token', t);
    localStorage.setItem('active_account', a);
  },
  [
    token,
    JSON.stringify({
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

if (entitled) {
  // Already paid: the button must not look like it will charge again.
  check(/^Download academic record$/i.test(label), 'a paid student sees no price on the button', label);
  check(/already paid for one download/i.test(blurb), 'and is told the download is already paid for');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 45000 }).catch(() => null),
    page.locator('app-transcript-download button').first().click(),
  ]);
  check(!!download, 'pressing it downloads the record', download?.suggestedFilename() ?? '');

  // The credit was for ONE copy, and spending it must be visible.
  const after = await fetch(`${API}/transactions/transcript/entitlement`, { headers: auth }).then(
    (r) => r.json()
  );
  check(after?.data?.entitled === false, 'the download spends the credit — one fee, one copy');
} else {
  check(
    /Pay\s+₦[\d,]+\.\d{2}\s+and download/i.test(label),
    'the button names its price BEFORE it is pressed',
    label
  );
  check(/charged separately/i.test(blurb), 'the page says each download is charged');

  // Pressing it must reach the provider, not the issue endpoint.
  let wentToProvider = null;
  await page.route('https://checkout.paystack.com/**', (route) => {
    wentToProvider = route.request().url();
    return route.abort();
  });
  await page.locator('app-transcript-download button').first().click();
  await page.waitForTimeout(6000);
  check(!!wentToProvider, 'pressing it hands the student to Paystack', String(wentToProvider).slice(0, 44));
}

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
