#!/usr/bin/env node
/**
 * Local-first score-entry test harness.
 *
 * Drives the running app (ng serve) against a real backend and verifies the
 * durability / sync / data-safety guarantees of the result-upload tables.
 *
 * Usage (dev servers must be running on 4200 + 3000):
 *   LF_EMAIL=you@example.com LF_PASSWORD=secret npm run test:localfirst
 *
 * Optional: LF_RESULT_ID=<draftId> to target a specific DRAFT result.
 * Exits non-zero if any scenario fails.
 *
 * KEEP THIS UPDATED: every new local-first behaviour should get a scenario here.
 */
import { chromium } from '@playwright/test';

const BASE = process.env.APP_URL ?? 'http://localhost:4200';
const API = process.env.API_URL ?? 'http://localhost:3000';
const EMAIL = process.env.LF_EMAIL;
const PASSWORD = process.env.LF_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Set LF_EMAIL and LF_PASSWORD env vars to run the harness.');
  process.exit(2);
}

let failures = 0;
const pass = (m) => console.log('  ✅', m);
const fail = (m) => {
  failures++;
  console.log('  ❌', m);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const readIDB = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open('acheva-results');
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('entries')) return resolve([]);
          const all = db
            .transaction('entries', 'readonly')
            .objectStore('entries')
            .getAll();
          all.onsuccess = () => resolve(all.result);
          all.onerror = () => resolve([]);
        };
        req.onerror = () => resolve([]);
      })
  );

const serverEntries = (page, rid, category = 'REGULAR') =>
  page.evaluate(
    async ({ api, rid, category }) => {
      const t = localStorage.getItem('token');
      const r = await fetch(
        `${api}/results/${rid}/entries?category=${category}`,
        { headers: { Authorization: `Bearer ${t}` } }
      );
      const j = await r.json();
      return j.data?.entries || [];
    },
    { api: API, rid, category }
  );

async function waitFor(fn, timeout = 12000, step = 400) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await fn()) return true;
    await sleep(step);
  }
  return false;
}

const regNoAt = (page, i) =>
  page.evaluate((idx) => {
    const input = document.querySelector(
      `input[data-row="${idx}"][data-col="test"]`
    );
    const cells = input?.closest('tr')?.querySelectorAll('td');
    return cells?.[1]?.textContent?.trim();
  }, i);

const val = (page, i, col) =>
  page.inputValue(`input[data-row="${i}"][data-col="${col}"]`);

// Read a score cell by registration number (survives row re-sorting on reload).
const scoreByReg = (page, reg, col) =>
  page.evaluate(
    ({ reg, col }) => {
      for (const tr of document.querySelectorAll('tr')) {
        const cells = tr.querySelectorAll('td');
        if (cells[1]?.textContent?.trim() === reg) {
          const input = tr.querySelector(`input[data-col="${col}"]`);
          return input ? input.value : null;
        }
      }
      return null;
    },
    { reg, col }
  );

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 },
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

  try {
    // ── login ────────────────────────────────────────────────────────────
    await page.goto(`${BASE}/auth/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', EMAIL);
    await page.fill('input[formcontrolname="password"]', PASSWORD);
    await page.getByRole('button', { name: /log in/i }).click();
    await page.waitForFunction(() => !!localStorage.getItem('token'), {
      timeout: 20000,
    });

    const rid =
      process.env.LF_RESULT_ID ??
      (await page.evaluate(async ({ api }) => {
        const t = localStorage.getItem('token');
        const j = await (
          await fetch(`${api}/results?status=DRAFT`, {
            headers: { Authorization: `Bearer ${t}` },
          })
        ).json();
        const list = j.data?.result || j.data?.data || [];
        return (
          list.find((r) => !r.hasBeenSent) || list[0]
        )?._id;
      }, { api: API }));
    if (!rid) throw new Error('No DRAFT result found for this account.');
    console.log('Using DRAFT result:', rid);

    const open = async () => {
      await page.goto(
        `${BASE}/my-result/upload-result?resultId=${rid}&status=DRAFT`,
        { waitUntil: 'networkidle' }
      );
      await page.waitForSelector('input[data-col="test"]', { timeout: 20000 });
    };
    await open();

    // ── A: durable local save → sync → SERVER actually has it ─────────────
    console.log('\nA: edit saves locally and to the server');
    const regA = await regNoAt(page, 0);
    await page.fill('input[data-row="0"][data-col="test"]', '20');
    await page.fill('input[data-row="0"][data-col="lab"]', '10');
    await page.fill('input[data-row="0"][data-col="exam"]', '50');
    await sleep(150);
    let idb = await readIDB(page);
    if (idb.find((e) => e.registrationNumber === regA)?.total === 80)
      pass('row saved to IndexedDB immediately');
    else fail('row not in IndexedDB');
    const syncedA = await waitFor(async () => {
      idb = await readIDB(page);
      return idb.find((e) => e.registrationNumber === regA)?.syncStatus === 'synced';
    });
    syncedA ? pass('row synced (status=synced, serverId set)') : fail('row never synced');
    const srvA = await serverEntries(page, rid);
    srvA.find((e) => e.registrationNumber === regA && e.total === 80)
      ? pass('SERVER has the entry (data is really saving)')
      : fail('entry not found on the server');

    // ── B: offline durability + auto-drain + survives reload ──────────────
    console.log('\nB: offline edits are safe and drain on reconnect');
    await context.setOffline(true);
    const regB = await regNoAt(page, 1);
    await page.fill('input[data-row="1"][data-col="test"]', '15');
    await page.fill('input[data-row="1"][data-col="lab"]', '15');
    await page.fill('input[data-row="1"][data-col="exam"]', '40');
    await sleep(1600);
    idb = await readIDB(page);
    idb.find((e) => e.registrationNumber === regB)?.exam === 40
      ? pass('offline edit saved locally')
      : fail('offline edit lost');
    (await page.locator('span:has-text("Offline")').count())
      ? pass('offline banner shown')
      : fail('no offline banner');
    await context.setOffline(false);
    const drained = await waitFor(async () => {
      idb = await readIDB(page);
      return idb.find((e) => e.registrationNumber === regB)?.syncStatus === 'synced';
    });
    drained ? pass('offline work auto-synced on reconnect') : fail('did not drain');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('input[data-col="test"]');
    idb = await readIDB(page);
    idb.find((e) => e.registrationNumber === regB)?.exam === 40
      ? pass('work persisted across reload')
      : fail('work lost after reload');

    // ── C: delete-sync (clear a synced row removes it server-side) ─────────
    console.log('\nC: clearing a synced row deletes it locally + on the server');
    for (const c of ['test', 'lab', 'exam'])
      await page.fill(`input[data-row="0"][data-col="${c}"]`, '');
    const goneLocal = await waitFor(async () => {
      idb = await readIDB(page);
      return !idb.find((e) => e.registrationNumber === regA);
    });
    goneLocal ? pass('row removed from IndexedDB') : fail('row still local');
    const srvC = await serverEntries(page, rid);
    !srvC.find((e) => e.registrationNumber === regA && e.total != null)
      ? pass('entry deleted on the server')
      : fail('entry still on server');
    // reload → the deleted score must NOT come back (gone from server + local)
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('input[data-col="test"]');
    const reTest = await scoreByReg(page, regA, 'test');
    idb = await readIDB(page);
    (reTest === '' || reTest === null) && !idb.find((e) => e.registrationNumber === regA)
      ? pass('after reload the deleted score did NOT reappear')
      : fail(`deleted score reappeared (input="${reTest}")`);

    // ── D: edit while search-filtered hits the right student ──────────────
    console.log('\nD: editing a filtered row targets the correct student');
    const regD = await regNoAt(page, 3);
    await page.locator('input[placeholder="Search students"]').fill(regD);
    await waitFor(
      async () => (await page.locator('input[data-col="test"]').count()) === 1,
      6000
    );
    await page.fill('input[data-row="0"][data-col="test"]', '30');
    await page.fill('input[data-row="0"][data-col="lab"]', '20');
    await page.fill('input[data-row="0"][data-col="exam"]', '25');
    await sleep(200);
    idb = await readIDB(page);
    const dRow = idb.find((e) => e.registrationNumber === regD);
    const stray = idb.find(
      (e) => e.registrationNumber !== regD && e.exam === 25 && e.lab === 20
    );
    dRow?.exam === 25 && !stray
      ? pass('edit landed on the filtered student, no positional mismatch')
      : fail('search-edit wrote to the wrong row');
    await page.locator('input[placeholder="Search students"]').fill('');
    // wait for the filter to clear and the full table to re-render
    await waitFor(
      async () => (await page.locator('input[data-col="test"]').count()) > 5,
      6000
    );

    // ── E: over-100 undoes ONLY the offending keystroke ───────────────────
    console.log('\nE: a sum over 100 reverts only the edited cell, keeps the rest');
    await page.fill('input[data-row="5"][data-col="test"]', '20');
    await page.fill('input[data-row="5"][data-col="lab"]', '10');
    await page.fill('input[data-row="5"][data-col="exam"]', '50'); // total 80, ok
    await sleep(200);
    await page.fill('input[data-row="5"][data-col="exam"]', '80'); // would be 110
    await sleep(200);
    const regE = await regNoAt(page, 5); // read now that the row is rendered
    const tE = await val(page, 5, 'test');
    const lE = await val(page, 5, 'lab');
    const eE = await val(page, 5, 'exam');
    if (tE === '20' && lE === '10')
      pass(`test (${tE}) and lab (${lE}) preserved after over-100 keystroke`);
    else fail(`other scores wiped: test=${tE} lab=${lE}`);
    if (eE !== '80')
      pass(`offending exam keystroke reverted (now "${eE}", not 80)`);
    else fail('over-100 value was accepted');
    idb = await readIDB(page);
    const eRow = idb.find((e) => e.registrationNumber === regE);
    eRow && eRow.test === 20 && eRow.lab === 10 && (eRow.total ?? 0) <= 100
      ? pass(`stored row is consistent (total=${eRow.total})`)
      : fail(`stored row wrong: ${JSON.stringify(eRow)}`);

    // ── F: tab switching works after edits (no stale "unsaved" block) ─────
    console.log('\nF: tabs switch freely after editing');
    consoleErrors.length = 0;
    await page.getByText('Reference', { exact: true }).click();
    await sleep(800);
    (await page.locator('text=Changes not saved').count()) === 0
      ? pass('switched to Reference with no blocking toast')
      : fail('"Changes not saved" toast blocked the switch');
    await page.getByText('Unregistered', { exact: true }).click();
    await sleep(800);
    await page.getByText('Regular', { exact: true }).click();
    await sleep(600);
    pass('cycled all tabs');

    // ── G: brand check — no green chrome ──────────────────────────────────
    console.log('\nG: no green sync chrome');
    (await page.locator('.sync-dot').count()) === 0
      ? pass('no sync dots')
      : fail('sync dots present');
    (await page.locator('text=All changes saved').count()) === 0
      ? pass('no green "All changes saved" pill')
      : fail('green pill present');
    (await page.locator('tr.completed').count()) === 0
      ? pass('no green completed-row backgrounds')
      : fail('green rows present');

    // ── H: leaving with unsynced work uses the in-app modal, not confirm() ─
    console.log('\nH: navigating away with unsynced work shows the modal');
    let nativeDialog = false;
    page.on('dialog', (d) => {
      nativeDialog = true;
      void d.dismiss();
    });
    await context.setOffline(true); // guarantees the edit stays unsynced
    await page.fill('input[data-row="7"][data-col="test"]', '11');
    await page.fill('input[data-row="7"][data-col="lab"]', '11');
    await page.fill('input[data-row="7"][data-col="exam"]', '11');
    await sleep(400);
    await page.getByText('Dashboard', { exact: true }).click().catch(() => {});
    await sleep(900);
    const modalShown =
      (await page.locator('app-confirmation').count()) > 0 ||
      (await page.locator('text=Some scores haven').count()) > 0;
    modalShown ? pass('in-app confirmation modal shown') : fail('no modal shown');
    !nativeDialog
      ? pass('native confirm() was NOT used')
      : fail('native confirm still used');
    if (modalShown) {
      await page.getByRole('button', { name: /^cancel$/i }).click().catch(() => {});
      await sleep(500);
    }
    page.url().includes('upload-result')
      ? pass('Cancel kept the user on the page')
      : fail('navigated away despite Cancel');
    // cleanup: clear the test row locally (still offline → no server write)
    for (const c of ['test', 'lab', 'exam'])
      await page.fill(`input[data-row="7"][data-col="${c}"]`, '').catch(() => {});
    await sleep(400);
    await context.setOffline(false);
    await sleep(800);

    // ── I: delete works the same on the Unregistered tab (no reappear) ────
    console.log('\nI: unregistered delete round-trips (no reappear)');
    const UREG = 'LF-DEL-TEST';
    await page.getByText('Unregistered', { exact: true }).click();
    await waitFor(
      async () => (await page.locator('input[data-col="test"]').count()) > 0,
      6000
    );
    await page.locator('input[formcontrolname="registrationNumber"]').first().fill(UREG);
    await page.locator('input[formcontrolname="registrationNumber"]').first().press('Tab');
    await page.locator('input[formcontrolname="fullName"]').first().fill('Delete Test');
    await page.locator('input[formcontrolname="fullName"]').first().press('Tab');
    await page.fill('input[data-row="0"][data-col="test"]', '10');
    await page.fill('input[data-row="0"][data-col="lab"]', '10');
    await page.fill('input[data-row="0"][data-col="exam"]', '10');
    const uSynced = await waitFor(async () => {
      idb = await readIDB(page);
      return idb.find((e) => e.registrationNumber === UREG)?.syncStatus === 'synced';
    });
    uSynced ? pass('unregistered entry synced') : fail('unregistered entry did not sync');
    for (const c of ['test', 'lab', 'exam'])
      await page.fill(`input[data-row="0"][data-col="${c}"]`, '');
    const uGone = await waitFor(async () => {
      idb = await readIDB(page);
      return !idb.find((e) => e.registrationNumber === UREG);
    });
    uGone ? pass('unregistered entry removed locally') : fail('still local');
    const srvU = await serverEntries(page, rid, 'UNREGISTERED');
    !srvU.find((e) => e.registrationNumber === UREG)
      ? pass('unregistered entry deleted on the server')
      : fail('still on server');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('input[data-col="test"]');
    await page.getByText('Unregistered', { exact: true }).click();
    await sleep(900);
    idb = await readIDB(page);
    const srvU2 = await serverEntries(page, rid, 'UNREGISTERED');
    !idb.find((e) => e.registrationNumber === UREG) &&
    !srvU2.find((e) => e.registrationNumber === UREG)
      ? pass('after reload the unregistered entry did NOT reappear')
      : fail('unregistered entry reappeared');

    // Offline scenarios (B, H) deliberately cause network failures — those are
    // expected. Only flag genuine app/JS errors.
    const realErrors = consoleErrors.filter(
      (e) =>
        !/ERR_INTERNET_DISCONNECTED|ERR_NETWORK|Failed to load resource|HttpErrorResponse/i.test(
          e
        )
    );
    realErrors.length
      ? fail(`console errors: ${realErrors.slice(0, 3).join(' | ')}`)
      : pass('no unexpected console/page errors during the run');
  } catch (err) {
    fail('HARNESS ERROR: ' + err.message);
  } finally {
    await browser.close();
  }

  console.log(`\n${failures === 0 ? '✅ ALL PASSED' : `❌ ${failures} FAILURE(S)`}`);
  process.exit(failures === 0 ? 0 : 1);
})();
