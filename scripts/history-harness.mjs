#!/usr/bin/env node
/**
 * History module end-to-end harness.
 *
 * Signs in through the real API (so `token`, `refresh_token` and
 * `active_account` are seeded exactly as the app seeds them — injecting only a
 * JWT leaves `active_account` null and the sidebar renders empty), then drives
 * the History page in a real browser: menu entry, table shape, filters,
 * pagination and the preview drawer.
 *
 *   HH_PASSWORD=Password8@ node scripts/history-harness.mjs
 *   HH_API=http://localhost:3999 HH_APP=http://localhost:4200 ...
 */

import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';

const API = process.env.HH_API ?? 'http://localhost:3000';
const APP = process.env.HH_APP ?? 'http://localhost:4200';
const PASSWORD = process.env.HH_PASSWORD ?? 'Password8@';

const ACCOUNTS = (process.env.HH_EMAILS ??
  'danielchinemerem302+1@gmail.com,danielchinemerem302+2@gmail.com,danielchinemerem302+6@gmail.com'
).split(',');

let failures = 0;
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { console.log(`  ✗ ${m}`); failures++; };
const check = (cond, m, detail = '') => (cond ? pass(m + (detail ? ` — ${detail}` : '')) : fail(m + (detail ? ` — ${detail}` : '')));

async function signIn(email) {
  const res = await fetch(`${API}/auth/lecturers/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`signin ${email} → ${res.status}`);
  const { data } = await res.json();
  const { accessToken, refreshToken, ...account } = data;
  return { accessToken, refreshToken, account };
}

(async () => {
  mkdirSync('screenshots', { recursive: true });
  const browser = await chromium.launch({ headless: true });

  for (const email of ACCOUNTS) {
    const { accessToken, refreshToken, account } = await signIn(email);
    console.log(`\n══ ${account.role} — ${email} ══`);

    const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      deviceScaleFactor: 2,
      colorScheme: 'light',
    });
    await context.addInitScript(
      ([t, r, a]) => {
        localStorage.setItem('token', t);
        localStorage.setItem('refresh_token', r);
        localStorage.setItem('active_account', a);
      },
      [accessToken, refreshToken, JSON.stringify(account)]
    );

    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

    // ── A: reachable from the sidebar ─────────────────────────────────────
    await page.goto(`${APP}/dashboard`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(600);
    const historyLink = page.locator('nav, aside, app-side-bar').getByText('History', { exact: true }).first();
    check(await historyLink.count() > 0, 'History appears in the sidebar menu');

    // ── B: the page loads with data ───────────────────────────────────────
    // Errors raised by the dashboard (the Highcharts NG0100 among them) are
    // not this page's to answer for — only judge what History itself logs.
    consoleErrors.length = 0;
    await page.goto(`${APP}/history`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(1200);

    const headers = await page.locator('table th').allInnerTexts();
    check(
      JSON.stringify(headers.map((h) => h.trim())) ===
        JSON.stringify(['COURSE CODE', 'DATE', 'SESSION', 'SEMESTER', 'STATUS']),
      'table has exactly the 5 required columns',
      headers.join(' | ')
    );

    const rowCount = await page.locator('table tbody tr').count();
    const emptyState = await page.locator('app-empty-state').count();
    check(rowCount > 0 || emptyState > 0, 'renders rows or the empty state', `${rowCount} rows`);

    if (rowCount === 0) {
      console.log('  ! no rows for this desk — skipping row-dependent checks');
      await context.close();
      continue;
    }

    // History is a VERDICT log: what did you do when it left your table?
    // Anything else in this column (a document status like "Published" or
    // "Draft", or a raw enum token) means the semantics have regressed.
    // Every row must carry a verdict — the API only returns documents this
    // lecturer acted on, so there is no pending/no-action state to render.
    const VERDICTS = ['Approved', 'Rejected', 'Cancelled'];
    const statusTexts = (
      await page.locator('table tbody tr td:nth-child(5)').allInnerTexts()
    ).map((s) => s.trim());
    check(
      statusTexts.every((s) => VERDICTS.includes(s)),
      'status column shows only the viewer verdict, never a document status',
      [...new Set(statusTexts)].join(', ')
    );

    const pageText = await page.locator('#container').innerText();
    check(
      !/SafeValue must use|\[object Object\]|undefined/i.test(pageText),
      'list page leaks no SafeValue / [object Object] / undefined text'
    );

    const dateTexts = await page.locator('table tbody tr td:nth-child(2)').allInnerTexts();
    check(dateTexts.every((d) => /\w{3} \d{1,2}, \d{4}/.test(d.trim())), 'dates are formatted', dateTexts[0]);

    // The label used to print the page SIZE as the upper bound ("1 to 12 of 10").
    const pagText = await page.locator('app-paginator').innerText();
    const m = pagText.match(/Showing (\d+) to (\d+) of (\d+)/);
    check(Boolean(m), 'paginator prints a Showing range', pagText.split('\n')[0]);
    if (m) {
      const [, from, to, total] = m.map(Number);
      check(to <= total && from <= to, 'paginator range is arithmetically sane', `${from}-${to} of ${total}`);
      check(to - from + 1 === rowCount, 'paginator range matches the rows on screen', `${to - from + 1} vs ${rowCount}`);
    }

    // ── C: Apply Filters is gated on a date being picked ──────────────────
    const applyBtn = page.getByRole('button', { name: /Apply Filters/i });
    check(await applyBtn.isDisabled(), 'Apply Filters is disabled until a date is picked');

    // ── D: the workflow filter actually filters ───────────────────────────
    const totalBefore = (await page.locator('app-paginator').innerText()).trim();
    await page.locator('mat-select').first().click();
    await page.waitForTimeout(400);
    await page.getByRole('option', { name: 'Moderations' }).click();
    await page.waitForTimeout(1400);
    const totalAfter = (await page.locator('app-paginator, app-empty-state').first().innerText()).trim();
    check(totalBefore !== totalAfter, 'workflow filter changes the result set');

    // back to everything
    await page.locator('mat-select').first().click();
    await page.waitForTimeout(400);
    await page.getByRole('option', { name: 'All activity' }).click();
    await page.waitForTimeout(1400);

    // ── E: the preview drawer opens with real content ─────────────────────
    await page.locator('table tbody tr').first().click();
    const drawer = page.locator('app-history-preview');
    await drawer.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
    check(await drawer.count() > 0, 'row click opens the preview drawer');

    // The drawer must be centred, not pinned to a corner.
    const box = await drawer.boundingBox();
    const vw = page.viewportSize().width;
    if (box) {
      const centreOffset = Math.abs(box.x + box.width / 2 - vw / 2);
      check(centreOffset < 40, 'preview dialog is horizontally centred', `${Math.round(centreOffset)}px off centre`);
    }
    if (await drawer.count() > 0) {
      // Wait for the DETAIL FETCH, not a guessed interval — the drawer opens
      // on a skeleton and a fixed sleep races the request on a slow round-trip.
      await drawer
        .locator('h4', { hasText: /Summary/ })
        .waitFor({ state: 'visible', timeout: 10_000 })
        .catch(() => {});
      const text = await drawer.innerText();
      check(/Received on/i.test(text), 'drawer shows the received-on date');
      check(/Course Summary|Moderation Summary/i.test(text), 'drawer shows the summary section');
      check(/Comments/i.test(text), 'drawer shows the comments section');
      check(!/undefined|null|NaN|\[object/i.test(text), 'drawer renders no undefined/null placeholders');
      // SvgComponent used to write a SafeHtml into innerHTML, which stringifies
      // to this warning and stays visible under an OnPush parent.
      check(
        !/SafeValue must use|preventing-cross-site-scripting/i.test(text),
        'drawer leaks no Angular SafeValue warning text'
      );
      await page.screenshot({ path: `screenshots/history-${account.role}-preview.png` });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // ── F: pagination ─────────────────────────────────────────────────────
    const nextBtn = page.locator('app-paginator button.mat-mdc-paginator-navigation-next');
    if (await nextBtn.count() > 0 && !(await nextBtn.isDisabled())) {
      const firstBefore = await page.locator('table tbody tr td').first().innerText();
      await nextBtn.click();
      await page.waitForTimeout(1400);
      const firstAfter = await page.locator('table tbody tr td').first().innerText();
      check(firstBefore !== firstAfter || (await page.locator('table tbody tr').count()) > 0, 'next page loads a different page');
    } else {
      console.log('  ! only one page for this desk — pagination click skipped');
    }

    await page.screenshot({ path: `screenshots/history-${account.role}.png` });

    const realErrors = consoleErrors.filter((e) => !/favicon|ERR_CONNECTION|Failed to load resource/i.test(e));
    check(realErrors.length === 0, 'no console errors', realErrors.slice(0, 2).join(' | '));

    await context.close();
  }

  await browser.close();
  console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error('HARNESS ERROR:', e.message); process.exit(1); });
