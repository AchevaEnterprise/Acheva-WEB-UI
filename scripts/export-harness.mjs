#!/usr/bin/env node
/**
 * Result export harness — drives the Export dialog on the computation page.
 *
 * Checks the whole path a lecturer takes: the button, the preview (which is the
 * real PDF, not a lookalike), and both downloads actually producing a file.
 *
 *   EH_API=http://localhost:3999 node scripts/export-harness.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync, statSync } from 'fs';

const API = process.env.EH_API ?? 'http://localhost:3000';
const APP = process.env.EH_APP ?? 'http://localhost:4200';
const EMAIL = process.env.EH_EMAIL ?? 'danielchinemerem302+6@gmail.com';
const PASSWORD = process.env.EH_PASSWORD ?? 'Password8@';

let failures = 0;
const check = (ok, m, d = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${m}${d ? '  — ' + d : ''}`);
  if (!ok) failures++;
};

(async () => {
  mkdirSync('screenshots', { recursive: true });
  const downloadDir = '/tmp/acheva-export-test';
  mkdirSync(downloadDir, { recursive: true });

  const signin = await fetch(`${API}/auth/lecturers/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const { data } = await signin.json();
  const { accessToken, refreshToken, ...account } = data;

  // A result with entries the exporter can actually render.
  const results = await fetch(`${API}/results/prepared-results`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then((r) => r.json());
  const target = (results?.data?.results ?? []).find((r) => r.students > 0) ?? results?.data?.results?.[0];
  if (!target) throw new Error('no result available for this account');
  console.log(`target: ${target.course?.courseCode} · ${target.session} · ${target.status}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
    acceptDownloads: true,
  });
  await context.addInitScript(([t, r, a]) => {
    localStorage.setItem('token', t);
    localStorage.setItem('refresh_token', r);
    localStorage.setItem('active_account', a);
  }, [accessToken, refreshToken, JSON.stringify(account)]);

  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(
    `${APP}/my-result/upload-result?resultId=${target._id}&status=${target.status}`,
    { waitUntil: 'networkidle', timeout: 40_000 },
  );
  await page.waitForTimeout(2500);

  console.log('── the button lives on the computation page ──');
  const exportBtn = page.getByRole('button', { name: /^Export$/i });
  check((await exportBtn.count()) > 0, 'Export button is present');
  await exportBtn.first().click();

  console.log('\n── the preview is the real PDF ──');
  const dialog = page.locator('app-export-result-dialog');
  await dialog.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
  check((await dialog.count()) > 0, 'export dialog opens');

  const frame = dialog.locator('iframe.export-dialog__frame');
  await frame.waitFor({ state: 'attached', timeout: 30_000 }).catch(() => {});
  check((await frame.count()) > 0, 'a PDF preview is rendered (not an HTML mock)');
  const src = await frame.getAttribute('src').catch(() => null);
  check(Boolean(src && src.startsWith('blob:')), 'preview is a generated blob', src?.slice(0, 24));

  await page.screenshot({ path: 'screenshots/export-preview.png' });

  console.log('\n── both downloads produce a file ──');
  for (const [label, expectExt] of [['Download PDF', '.pdf'], ['Download Excel', '.xlsx']]) {
    const waitFor = page.waitForEvent('download', { timeout: 30_000 });
    await dialog.getByRole('button', { name: new RegExp(label, 'i') }).click();
    try {
      const dl = await waitFor;
      const name = dl.suggestedFilename();
      const path = `${downloadDir}/${name}`;
      await dl.saveAs(path);
      const size = statSync(path).size;
      check(name.endsWith(expectExt) && size > 1000, `${label} → ${name}`, `${size} bytes`);
    } catch (e) {
      check(false, `${label} produced a file`, e.message.split('\n')[0]);
    }
  }

  const real = errors.filter((e) => !/favicon|ERR_CONNECTION|Failed to load resource/i.test(e));
  check(real.length === 0, 'no console errors', real.slice(0, 2).join(' | '));

  await browser.close();
  console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error('HARNESS ERROR:', e.message); process.exit(1); });
