#!/usr/bin/env node
/**
 * The student payments page and the receipt it produces.
 *
 * Checked in a browser rather than in unit tests because the thing being
 * verified is a PDF rendered by pdfmake inside an iframe: the list, the
 * receipt fetch, the lazy library load and the browser's own PDF viewer all
 * have to line up, and none of that is observable from a spec.
 *
 * The session is injected rather than signed into, because the student who
 * holds the test payment is a seeded account whose password is not known
 * here. The token is minted against ACCESS_TOKEN_SECRET with the same payload
 * the sign-in route issues.
 *
 * Needs the student app on 4201 and the API on 3000.
 *
 *   node scripts/payments-harness.mjs
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';

/**
 * HS256 by hand, rather than pulling `jsonwebtoken` into the frontend's
 * dependencies for one script. The payload below mirrors exactly what
 * `students-auth.service.ts` signs.
 */
const b64 = (value) =>
  Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))
    .toString('base64url');

const signJwt = (payload, secret, ttlSeconds = 7200) => {
  const now = Math.floor(Date.now() / 1000);
  const body = b64({ ...payload, iat: now, exp: now + ttlSeconds });
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
};

const API = process.env.PAY_API ?? 'http://localhost:3000';
const APP = process.env.PAY_APP ?? 'http://localhost:4201';
// Relative to this file, which sits in `scripts/`.
const ENV_FILE = process.env.PAY_ENV ?? '../../acheva-nestjs/.env';

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

/** The student who holds the seeded dues payment (Mathematics, 100L). */
const STUDENT = {
  id: process.env.PAY_STUDENT ?? '69ea02d71a16b46a857a8693',
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

console.log('\n── student payments & receipt ──');

// The page is only worth looking at if the API agrees there is a payment.
const history = await fetch(`${API}/transactions/mine`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());
check(
  history?.data?.items?.length > 0,
  'the API has at least one payment to show',
  `${history?.data?.total ?? 0} total`
);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: 'light',
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
page.on('console', (m) => m.type() === 'error' && console.log('  !', m.text().slice(0, 140)));
page.on('pageerror', (e) => console.log('  !! pageerror:', String(e).slice(0, 140)));

await page.goto(`${APP}/payment-history`, { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForSelector('.payments', { timeout: 30000 });
await page.waitForTimeout(4000);

check((await page.locator('.row').count()) > 0, 'the payment list renders rows');

const title = await page.locator('.row__title').first().innerText().catch(() => '');
check(/dues|transcript|payment/i.test(title), 'a row names what was paid for', title);

const amount = await page.locator('.row__amount').first().innerText().catch(() => '');
check(/^₦[\d,]+\.\d{2}$/.test(amount.trim()), 'the amount is formatted naira', amount);

check((await page.locator('.chip--paid').count()) > 0, 'a completed payment reads as Paid');

// The newest receipt opens by itself — a student arriving from a payment is
// here for the one they just made.
check(
  (await page.locator('.row--active').count()) === 1,
  'the newest receipt is selected on arrival'
);

const previewed = await page
  .waitForSelector('.detail__preview', { timeout: 25000 })
  .then(() => true)
  .catch(() => false);
check(previewed, 'the receipt PDF renders in the preview pane');

const src = await page.locator('.detail__preview').getAttribute('src').catch(() => '');
check(String(src).startsWith('blob:'), 'the preview is the real generated file, not markup', String(src).slice(0, 24));

await page.screenshot({ path: 'screenshots/payments-receipt.png', fullPage: false });

// The download button must actually produce a file.
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 25000 }).catch(() => null),
  page.getByRole('button', { name: /Download receipt/i }).click(),
]);
check(!!download, 'the download button produces a file', download?.suggestedFilename() ?? '');
check(
  /^Acheva_Receipt_TXN.*\.pdf$/.test(download?.suggestedFilename() ?? ''),
  'the file is named so it can be found again later',
  download?.suggestedFilename() ?? ''
);

// Kept so the document itself can be eyeballed. Headless Chromium has no PDF
// viewer, so the preview iframe screenshots blank even when it is working —
// render this with `qlmanage -t -s 1400 -o <dir> screenshots/receipt.pdf`.
if (download) await download.saveAs('screenshots/receipt.pdf');

// Narrow viewport: the two panes must stack rather than crush.
await page.setViewportSize({ width: 820, height: 1000 });
await page.waitForTimeout(800);
const stacked = await page.evaluate(() => {
  const body = document.querySelector('.payments__body');
  return body ? getComputedStyle(body).gridTemplateColumns.split(' ').length === 1 : false;
});
check(stacked, 'the panes stack below 900px rather than crushing the PDF');
await page.screenshot({ path: 'screenshots/payments-receipt-narrow.png', fullPage: false });

await browser.close();
console.log(failures ? `\n${failures} failed\n` : '\nall passed\n');
process.exit(failures ? 1 : 0);
