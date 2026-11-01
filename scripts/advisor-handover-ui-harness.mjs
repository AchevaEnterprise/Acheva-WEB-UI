/**
 * A Course Advisor handover, watched from the two tabs it affects.
 *
 * Three people are signed in at once: the outgoing advisor (parked on their
 * Students page), the lecturer taking over (parked on the dashboard), and the
 * Head, who does the handover through the real dialog on Lecturer
 * Management. Neither advisor reloads or signs in again. What has to happen:
 *
 *  - the outgoing advisor's tab is told, leaves the Students page, and its
 *    stored account no longer holds the office;
 *  - the incoming advisor's tab is told, and their Students page now lists
 *    the whole cohort.
 *
 * That is the `account:changed` push over the messaging stream plus the
 * server re-reading each person's office per request — only a real server
 * and real browsers show both working together. Hands the cohort back after.
 *
 *   HU_API=http://localhost:3100 node scripts/advisor-handover-ui-harness.mjs
 *
 * HU_API other than :3000 reroutes the app's API calls there (the dev build
 * is compiled against :3000) — `route.continue`, so the SSE stream still
 * streams rather than being buffered.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const APP = process.env.HU_APP ?? 'http://localhost:4200';
const API = process.env.HU_API ?? 'http://localhost:3100';
const PASSWORD = process.env.HU_PASSWORD ?? 'Password8@';
const OUTGOING = process.env.HU_FROM ?? 'danielchinemerem302+31@gmail.com'; // Physics 300L
const INCOMING = process.env.HU_TO ?? 'danielchinemerem302+93@gmail.com';
const HOD = process.env.HU_HOD ?? 'danielchinemerem302+4@gmail.com';

let failures = 0;
const check = (name, pass, detail = '') => {
  if (!pass) failures += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

async function signIn(email, attempt = 1) {
  const res = await fetch(`${API}/auth/lecturers/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (res.status === 429 && attempt <= 4) {
    console.log(`  (throttled signing in ${email} — waiting ${20 * attempt}s)`);
    await new Promise((resolve) => setTimeout(resolve, 20_000 * attempt));
    return signIn(email, attempt + 1);
  }
  if (!res.ok) throw new Error(`signin ${email} → ${res.status}`);
  const { data } = await res.json();
  const { accessToken, refreshToken, ...account } = data;
  return { accessToken, refreshToken, account };
}

const api = async (method, path, token, body) => {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const newContext = async (browser, session) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  if (API !== 'http://localhost:3000') {
    await context.route(/^http:\/\/localhost:3000\//, (route) =>
      route.continue({ url: route.request().url().replace('http://localhost:3000', API) })
    );
  }
  await context.addInitScript(
    ([t, r, a]) => {
      // Seed once: on a reload the app's own refreshed copy must survive.
      if (!localStorage.getItem('token')) {
        localStorage.setItem('token', t);
        localStorage.setItem('refresh_token', r);
        localStorage.setItem('active_account', a);
      }
    },
    [session.accessToken, session.refreshToken, JSON.stringify(session.account)]
  );
  return context;
};

const storedAccount = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('active_account') ?? 'null'));

const studentRows = async (page) => {
  await page.goto(`${APP}/students`, { waitUntil: 'domcontentloaded' });
  // Wait for the list or its empty state, never the network (the SSE
  // stream keeps it busy forever).
  await page
    .locator('tr[mat-row], app-empty-state')
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => undefined);
  await page.waitForTimeout(800);
  return page.locator('tr[mat-row]').count();
};

mkdirSync('screenshots', { recursive: true });
const browser = await chromium.launch({ headless: true });

const outgoing = await signIn(OUTGOING);
const incoming = await signIn(INCOMING);
const hod = await signIn(HOD);
let handedOver = false;
let hodPage = null;
let step = 'start';

try {
  const outPage = await (await newContext(browser, outgoing)).newPage();
  const inPage = await (await newContext(browser, incoming)).newPage();
  hodPage = await (await newContext(browser, hod)).newPage();

  const cohort = await studentRows(outPage);
  check('the outgoing advisor sees their cohort before', cohort > 0, `${cohort} rows`);

  await inPage.goto(`${APP}/dashboard`, { waitUntil: 'domcontentloaded' });
  await inPage.waitForTimeout(2500); // let the stream connect

  // ── The Head hands over through the real dialog ──────────────────────────
  await hodPage.goto(`${APP}/user-settings/hod/lecturer-management`, {
    waitUntil: 'domcontentloaded',
  });
  const row = hodPage.locator('tr', { hasText: OUTGOING });
  await row.waitFor({ timeout: 30_000 });
  step = 'open dialog';
  // The dialog loads its candidates on open; wait for THAT response rather
  // than racing it — a select with no options opens nothing.
  const candidatesLoaded = hodPage.waitForResponse((r) => /\/lecturers\/all\//.test(r.url()));
  await row.locator('button', { hasText: 'Hand over' }).click();
  await candidatesLoaded;
  await hodPage.waitForTimeout(400);

  const dialog = hodPage.locator('app-handover-course-advisor');
  await dialog.waitFor({ timeout: 15_000 });
  step = 'pick incoming';
  await dialog.locator('.mat-mdc-select-trigger').click();
  const options = hodPage.locator('mat-option');
  await options.first().waitFor({ timeout: 10_000 });
  const labels = await options.allInnerTexts();
  const name = [incoming.account.firstname, incoming.account.lastname].filter(Boolean).join(' ');
  const pick = labels.findIndex((label) => (name && label.includes(name)) || label.includes(INCOMING));
  if (pick < 0) throw new Error(`incoming lecturer not offered; options: ${labels.join(' | ')}`);
  await options.nth(pick).click();

  step = 'await preview';
  await dialog.getByText(/WHAT MOVES TO/i).waitFor({ timeout: 20_000 });
  const previewText = await dialog.innerText();
  check('the dialog shows the cohort size before anything moves',
    new RegExp(`${cohort}\\s*student`).test(previewText.replace(/\s+/g, ' ')),
    previewText.replace(/\s+/g, ' ').slice(0, 120));
  check('the dialog says the outgoing advisor loses the role at once',
    /stops being a Course Advisor the moment you confirm/i.test(previewText));
  await hodPage.screenshot({ path: 'screenshots/handover-dialog.png' });

  step = 'confirm';
  await dialog.locator('button', { hasText: /^\s*Hand over\s*$/ }).click();
  await hodPage.getByText('Cohort handed over').first().waitFor({ timeout: 20_000 });
  handedOver = true;
  check('the Head’s handover succeeds through the UI', true);

  // ── The outgoing advisor's tab, untouched by them ────────────────────────
  await outPage
    .getByText('Your role was updated')
    .first()
    .waitFor({ timeout: 20_000 })
    .catch(() => undefined);
  check('the outgoing advisor’s open tab is told',
    (await outPage.getByText('Your role was updated').count()) > 0);
  check('…and is taken off the Students page',
    outPage.url().includes('/dashboard'), outPage.url());
  const outAccount = await storedAccount(outPage);
  check('…and its stored account no longer holds the office',
    outAccount?.role !== 'COURSE_ADVISOR' &&
      !(outAccount?.otherRoles ?? []).includes('COURSE_ADVISOR') &&
      outAccount?.assignedLevel === 'NONE',
    `role=${outAccount?.role} level=${outAccount?.assignedLevel}`);
  await outPage.screenshot({ path: 'screenshots/handover-outgoing-tab.png' });
  check('the outgoing advisor’s Students page is now empty', (await studentRows(outPage)) === 0);

  // ── The incoming advisor's tab ───────────────────────────────────────────
  await inPage
    .getByText('Your role was updated')
    .first()
    .waitFor({ timeout: 20_000 })
    .catch(() => undefined);
  check('the incoming advisor’s open tab is told',
    (await inPage.getByText('Your role was updated').count()) > 0);
  const inAccount = await storedAccount(inPage);
  check('…and its stored account now holds the office',
    inAccount?.role === 'COURSE_ADVISOR' && inAccount?.assignedLevel !== 'NONE',
    `role=${inAccount?.role} level=${inAccount?.assignedLevel}`);
  const inherited = await studentRows(inPage);
  check('the incoming advisor’s Students page lists the WHOLE cohort',
    inherited === cohort, `${inherited} of ${cohort}`);
  await inPage.screenshot({ path: 'screenshots/handover-incoming-students.png' });
} catch (error) {
  check('the harness ran to completion', false, `at "${step}": ${String(error).split('\n')[0]}`);
  await hodPage?.screenshot({ path: 'screenshots/handover-failure.png' }).catch(() => undefined);
} finally {
  if (handedOver) {
    const ids = await Promise.all([
      api('GET', '/auth/lecturers/me', outgoing.accessToken),
      api('GET', '/auth/lecturers/me', incoming.accessToken),
    ]);
    const back = await api('PATCH', '/lecturers/course-advisor/handover', hod.accessToken, {
      from: ids[1].body?.data?.id,
      to: ids[0].body?.data?.id,
    });
    check('handed back to the original advisor', back.status === 200, `HTTP ${back.status}`);
  }
  await browser.close();
  console.log(failures === 0 ? '\nAll handover UI checks passed.' : `\n${failures} check(s) FAILED.`);
  console.log('screenshots → Acheva-WEB-UI/screenshots/handover-*.png');
  process.exit(failures === 0 ? 0 : 1);
}
