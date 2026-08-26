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
/**
 * Export is for EVERY role, not just the lecturer who computed the result —
 * the Head of Department and the Dean are the ones who sign the paper form.
 * Each account is checked on the page that role actually uses.
 */
const ACCOUNTS = (process.env.EH_EMAILS ??
  'danielchinemerem302+2@gmail.com,danielchinemerem302+1@gmail.com,danielchinemerem302@gmail.com,danielchinemerem302+6@gmail.com'
).split(',');
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

  const browser = await chromium.launch({ headless: true });

  for (const email of ACCOUNTS) {
    const signin = await fetch(`${API}/auth/lecturers/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    if (!signin.ok) { console.log(`\n! ${email} — sign-in failed, skipped`); continue; }
    const { data } = await signin.json();
    const { accessToken, refreshToken, ...account } = data;

    const results = await fetch(`${API}/results/prepared-results`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then((r) => r.json());
    const target =
      (results?.data?.results ?? []).find((r) => r.students > 0) ??
      results?.data?.results?.[0];
    if (!target) { console.log(`\n! ${account.role} — no result on this desk, skipped`); continue; }

    // Lecturers compute on upload-result; every other role opens the same
    // result through result-management's edit-results.
    const isLecturer = account.role === 'LECTURER';
    const route = isLecturer
      ? `/my-result/upload-result?resultId=${target._id}&status=${target.status}`
      : `/result-management/edit-results?resultId=${target._id}&status=${target.status}`;

    console.log(`\n══ ${account.role} — ${target.course?.courseCode} (${isLecturer ? 'upload-result' : 'edit-results'}) ══`);

    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
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

    await page.goto(`${APP}${route}`, { waitUntil: 'networkidle', timeout: 40_000 });
    await page.waitForTimeout(2500);

    const exportBtn = page.getByRole('button', { name: /^Export$/i });
    check((await exportBtn.count()) > 0, 'Export button is present');
    if ((await exportBtn.count()) === 0) { await context.close(); continue; }
    await exportBtn.first().click();

    const dialog = page.locator('app-export-result-dialog');
    await dialog.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
    check((await dialog.count()) > 0, 'export dialog opens');

    const frame = dialog.locator('iframe.export-dialog__frame');
    await frame.waitFor({ state: 'attached', timeout: 30_000 }).catch(() => {});
    const src = await frame.getAttribute('src').catch(() => null);
    // Headless Chromium has no PDF viewer, so the blob URL is the evidence —
    // the pixels are always blank here even when it works.
    check(Boolean(src && src.startsWith('blob:')), 'preview is the generated PDF blob');

    for (const [label, ext] of [['Download PDF', '.pdf'], ['Download Excel', '.xlsx']]) {
      const waitFor = page.waitForEvent('download', { timeout: 30_000 });
      await dialog.getByRole('button', { name: new RegExp(label, 'i') }).click();
      try {
        const dl = await waitFor;
        const name = dl.suggestedFilename();
        const path = `${downloadDir}/${account.role}-${name}`;
        await dl.saveAs(path);
        check(name.endsWith(ext) && statSync(path).size > 1000, `${label} → ${name}`, `${statSync(path).size} bytes`);
      } catch (e) {
        check(false, `${label} produced a file`, e.message.split('\n')[0]);
      }
    }

    const real = errors.filter((e) => !/favicon|ERR_CONNECTION|Failed to load resource/i.test(e));
    check(real.length === 0, 'no console errors', real.slice(0, 2).join(' | '));

    await context.close();
  }

  await browser.close();
  console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error('HARNESS ERROR:', e.message); process.exit(1); });
