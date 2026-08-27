#!/usr/bin/env node
/**
 * Document verification, end to end: export a sheet, then check the serial it
 * printed resolves on the PUBLIC endpoint with no credentials at all.
 *
 *   VH_API=http://localhost:3999 node scripts/verify-harness.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync, statSync } from 'fs';

const API = process.env.VH_API ?? 'http://localhost:3000';
const APP = process.env.VH_APP ?? 'http://localhost:4200';
const EMAIL = process.env.VH_EMAIL ?? 'danielchinemerem302+1@gmail.com';
const PASSWORD = process.env.VH_PASSWORD ?? 'Password8@';

let failures = 0;
const check = (ok, m, d = '') => { console.log(`  ${ok ? '✓' : '✗'} ${m}${d ? '  — ' + d : ''}`); if (!ok) failures++; };

(async () => {
  mkdirSync('/tmp/acheva-verify-test', { recursive: true });

  const { data } = await fetch(`${API}/auth/lecturers/signin`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  }).then((r) => r.json());
  const { accessToken, refreshToken, ...account } = data;

  const results = await fetch(`${API}/results/prepared-results`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then((r) => r.json());
  const target =
    (results?.data?.results ?? []).find((r) => r.students > 0) ??
    results?.data?.results?.[0];
  if (!target) throw new Error('no result on this desk');
  console.log(`target: ${target.course?.courseCode} · ${target.session}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await context.addInitScript(([t, r, a]) => {
    localStorage.setItem('token', t); localStorage.setItem('refresh_token', r); localStorage.setItem('active_account', a);
  }, [accessToken, refreshToken, JSON.stringify(account)]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto(`${APP}/result-management/edit-results?resultId=${target._id}&status=${target.status}`, { waitUntil: 'networkidle', timeout: 40_000 });
  await page.waitForTimeout(2500);

  console.log('── the preview mints nothing ──');
  await page.getByRole('button', { name: /^Export$/i }).first().click();
  const dialog = page.locator('app-export-result-dialog');
  await dialog.waitFor({ state: 'visible', timeout: 15_000 });
  await dialog.locator('iframe.export-dialog__frame').waitFor({ state: 'attached', timeout: 30_000 }).catch(() => {});
  const before = await dialog.innerText();
  check(!/ACV-/.test(before), 'no serial on screen before a download');
  check(/not the preview/i.test(before), 'the drawer says the serial is added on download');

  console.log('\n── downloading mints one ──');
  const waitFor = page.waitForEvent('download', { timeout: 40_000 });
  await dialog.getByRole('button', { name: /Download PDF/i }).click();
  const dl = await waitFor;
  const path = `/tmp/acheva-verify-test/${dl.suggestedFilename()}`;
  await dl.saveAs(path);
  check(statSync(path).size > 1000, `PDF downloaded`, `${statSync(path).size} bytes`);

  await page.waitForTimeout(2500);
  const after = await dialog.innerText();
  const serial = (after.match(/ACV-[2-9A-HJ-NP-TV-Z]{4}-[2-9A-HJ-NP-TV-Z]{4}-[2-9A-HJ-NP-TV-Z]{4}/) ?? [])[0];
  check(Boolean(serial), 'the drawer now shows the serial', serial);
  check(/verify\./.test(after), 'and where to check it');

  console.log('\n── anyone can check it, with no account ──');
  const pub = await fetch(`${API}/verify/${serial}`);       // NO Authorization header
  const body = (await pub.json())?.data;
  check(pub.status === 200, 'public endpoint answers', `${pub.status}`);
  check(body?.status === 'GENUINE', 'reports GENUINE');
  check(body?.document?.course?.code === target.course?.courseCode, 'shows the right course', body?.document?.course?.code);
  check((body?.document?.entries?.length ?? 0) > 0, 'and the full sheet', `${body?.document?.entries?.length} rows`);

  console.log('\n── a serial that was never issued ──');
  const fake = await fetch(`${API}/verify/ACV-2222-3333-4444`).then((r) => r.json());
  check(fake?.data?.status === 'NOT_FOUND', 'reports NOT_FOUND');

  const real = errors.filter((e) => !/favicon|ERR_CONNECTION|Failed to load resource/i.test(e));
  check(real.length === 0, 'no console errors', real.slice(0, 2).join(' | '));

  await browser.close();
  console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error('HARNESS ERROR:', e.message); process.exit(1); });
