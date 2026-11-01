/**
 * The transfers UI, driven as the two people who use it.
 *
 * Signs in through the real API and seeds `token` / `refresh_token` /
 * `active_account` exactly as the app does — a bare JWT leaves
 * `active_account` null, which renders an empty sidebar and makes every menu
 * assertion pass on nothing.
 *
 * It creates a real transfer request, has the receiving Head APPROVE it
 * through the UI, and withdraws it afterwards. Approval only schedules the
 * move for the end of the session, so the student is never actually moved.
 *
 *   npm run test:transfers-ui
 *   TU_APP=http://localhost:4210 TU_API=http://localhost:3100 npm run test:transfers-ui
 *
 * A TU_API other than :3000 reroutes the app's calls there (the dev build is
 * compiled against :3000).
 *
 * Note: every navigation waits on a SELECTOR, never `networkidle`. The shell
 * opens the messaging SSE stream for the whole session, so the network never
 * falls quiet and `networkidle` times out on every page.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const APP = process.env.TU_APP ?? 'http://localhost:4200';
const API = process.env.TU_API ?? 'http://localhost:3000';
const PASSWORD = process.env.TU_PASSWORD ?? 'Password8@';
const CA = 'danielchinemerem302+21@gmail.com';     // Mathematics, 300L
const HOD = 'danielchinemerem302+4@gmail.com';     // Physics
const PHYSICS_DEPT = '693d7c26e9ed492d7805c427';

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

/**
 * Credential routes are throttled, and this harness signs in twice per run.
 * A 429 is the throttler working, not a failure — wait out the window rather
 * than reporting a broken app.
 */
async function signIn(email, attempt = 1) {
  const res = await fetch(`${API}/auth/lecturers/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });

  if (res.status === 429 && attempt <= 4) {
    const wait = 20_000 * attempt;
    console.log(`  (throttled signing in ${email} — waiting ${wait / 1000}s)`);
    await new Promise((resolve) => setTimeout(resolve, wait));
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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

/** Navigate and wait for the PAGE — never the network: the shell holds the
 *  messaging SSE stream open, so `networkidle` never fires. */
const open = async (page, path, waitFor) => {
  await page.goto(`${APP}${path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  await page.locator(waitFor).first().waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1200); // one beat for the first data fetch
};

const newContext = async (browser, session) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
  });
  if (API !== 'http://localhost:3000') {
    await context.route(/^http:\/\/localhost:3000\//, (route) =>
      route.continue({ url: route.request().url().replace('http://localhost:3000', API) })
    );
  }
  await context.addInitScript(
    ([t, r, a]) => {
      localStorage.setItem('token', t);
      localStorage.setItem('refresh_token', r);
      localStorage.setItem('active_account', a);
    },
    [session.accessToken, session.refreshToken, JSON.stringify(session.account)]
  );
  return context;
};

mkdirSync('screenshots', { recursive: true });
const browser = await chromium.launch({ headless: true });

const caSession = await signIn(CA);
const hodSession = await signIn(HOD);

let transferId = null;
let studentId = null;

try {
  // ── The advisor's view ────────────────────────────────────────────────
  const caContext = await newContext(browser, caSession);
  const caPage = await caContext.newPage();
  const caErrors = [];
  caPage.on('console', (m) => m.type() === 'error' && caErrors.push(m.text()));

  await open(caPage, `/transfers`, 'h3:has-text("Department Transfers")');
  const heading = await caPage.locator('h3', { hasText: 'Department Transfers' }).count();
  check('the advisor can open /transfers', heading > 0);

  const sidebar = await caPage.locator('a[href="/transfers"], a[href*="transfers"]').count();
  check('Transfers appears in the sidebar', sidebar > 0, `${sidebar} link(s)`);

  const composeBtn = caPage.getByText('New transfer request', { exact: false }).first();
  check('the advisor is offered the compose button', await composeBtn.count() > 0);

  await caPage.screenshot({ path: 'screenshots/transfers-advisor-empty.png', fullPage: true });

  // ── The composer, filled in as a person would ─────────────────────────
  await open(caPage, `/transfers/new`, 'quill-editor');
  const editor = await caPage.locator('quill-editor').count();
  check('the letter editor renders', editor > 0);

  const selects = caPage.locator('select');
  check('the composer offers student, faculty, department and level',
    (await selects.count()) === 4, `${await selects.count()} selects`);
  // A transferred student always starts a new session's first semester,
  // so there is nothing to choose — and nothing should be offered.
  check('no semester is offered — the move always starts a first semester',
    (await caPage.locator('option', { hasText: '2ND SEMESTER' }).count()) === 0);

  // The page loads the advisor's own cohort through the same API the app
  // uses, so a populated list is itself the proof that call is right.
  const studentSelect = selects.nth(0);
  const studentOptions = await studentSelect.locator('option').count();
  check('the advisor’s own cohort is loaded into the picker',
    studentOptions > 1, `${studentOptions - 1} student(s)`);

  studentId = await studentSelect.locator('option').nth(1).getAttribute('value');
  await studentSelect.selectOption(studentId);

  // Wait for the eligibility round-trip to RESOLVE — either verdict will do.
  // A fixed sleep here made this check fail intermittently on a slower API
  // while the rest of the run proved the data had in fact arrived.
  const standing = caPage.getByText(/Currently .* level in|transfer request in progress|account is deactivated/i);
  await standing.first().waitFor({ timeout: 30_000 }).catch(() => undefined);
  check('picking a student reports their current standing',
    (await caPage.getByText(/Currently .* level in/i).count()) > 0);

  // The registrar's rule: one level at most, either way.
  const standingText = await caPage.getByText(/Currently .* level in/i).first().innerText();
  const currentLevel = Number(standingText.match(/Currently (\d{3})/)?.[1]);
  const offered = (await selects.nth(3).locator('option').allInnerTexts())
    .map((label) => label.match(/(\d{3})/)?.[1])
    .filter(Boolean)
    .map(Number);
  const expected = [currentLevel - 100, currentLevel, currentLevel + 100].filter((l) => l >= 100);
  check('only levels within one of the student’s are offered',
    JSON.stringify(offered) === JSON.stringify(expected),
    `at ${currentLevel}: offered ${offered.join(', ')}`);
  check('the page says when the move happens',
    (await caPage.getByText(/after finishing .* starts .* first semester/i).count()) > 0);

  // Faculty → department is a two-step picker; the second must populate from
  // the first, and must not offer the department they are already in.
  const facultySelect = selects.nth(1);
  check('faculties are loaded into the picker',
    (await facultySelect.locator('option').count()) > 1);

  const sops = await facultySelect
    .locator('option', { hasText: 'Physical Sciences' })
    .first()
    .getAttribute('value');
  await facultySelect.selectOption(sops);

  const deptSelect = selects.nth(2);
  // Wait for the dependent fetch to populate it, rather than sleeping.
  await caPage
    .waitForFunction(
      () => (document.querySelectorAll('select')[2]?.options.length ?? 0) > 1,
      { timeout: 30_000 }
    )
    .catch(() => undefined);
  const deptNames = await deptSelect.locator('option').allInnerTexts();
  check('departments populate from the chosen faculty',
    deptNames.length > 1, deptNames.slice(1).join(', '));
  check('the student’s own department is not offered as a destination',
    !deptNames.some((name) => /Mathematics/i.test(name)));

  await deptSelect.selectOption(PHYSICS_DEPT);
  await selects.nth(3).selectOption('300');

  // Typed, not `fill`ed: Quill is a contenteditable and ngx-quill updates
  // the Angular control from Quill's own text-change event. `fill` sets the
  // DOM directly, the control stays empty, and the send button stays
  // disabled — which looks like a broken button rather than a test bug.
  await caPage.locator('quill-editor .ql-editor').first().click();
  await caPage.keyboard.type(
    'I write to request the transfer of the above-named student from the ' +
      'Department of Mathematics to the Department of Physics, at 300 level. ' +
      'Their record is attached.'
  );
  await caPage.waitForTimeout(600);

  const sendButton = caPage
    .locator('button', { hasText: 'Send to the Head' })
    .first();
  check('the send button enables once the form is complete',
    await sendButton.isEnabled());

  await caPage.screenshot({ path: 'screenshots/transfers-composer.png', fullPage: true });

  // ── Send it, through the button ───────────────────────────────────────
  await sendButton.click();
  await caPage.waitForURL(`${APP}/transfers`, { timeout: 30_000 }).catch(() => undefined);
  await caPage.waitForTimeout(1500);

  const mine = await api('GET', '/transfers', caSession.accessToken);
  const raised = (mine.body?.data ?? []).find(
    (row) => String(row.student?._id ?? row.student) === String(studentId)
  );
  transferId = raised?._id ?? null;
  check('sending the form raised AND submitted the request',
    raised?.status === 'PENDING_RECEIVING_HOD',
    `status=${raised?.status ?? 'none'}`);

  await open(caPage, `/transfers`, 'h3:has-text("Department Transfers")');
  await caPage
    .getByText('Awaiting approval')
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => undefined);
  const awaitingText = await caPage.getByText('Awaiting approval').count();
  check('the advisor sees it as awaiting approval, in words not enum tokens',
    awaitingText > 0);
  const rawToken = await caPage.getByText('PENDING_RECEIVING_HOD').count();
  check('no raw workflow token leaks into the UI', rawToken === 0);

  await caPage.screenshot({ path: 'screenshots/transfers-advisor-sent.png', fullPage: true });

  // ── The Head's view ───────────────────────────────────────────────────
  const hodContext = await newContext(browser, hodSession);
  const hodPage = await hodContext.newPage();
  const hodErrors = [];
  hodPage.on('console', (m) => m.type() === 'error' && hodErrors.push(m.text()));

  await open(hodPage, `/transfers`, 'h3:has-text("Department Transfers")');
  await hodPage
    .getByText('Awaiting your approval')
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => undefined);
  const queue = await hodPage.getByText('Awaiting your approval').count();
  check('the receiving Head sees it in their queue', queue > 0);
  await hodPage.screenshot({ path: 'screenshots/transfers-hod-queue.png', fullPage: true });

  await open(hodPage, `/transfers/${transferId}`, '.td-letter');
  check('the Head can read the letter',
    (await hodPage.getByText('I write to request the transfer').count()) > 0);
  check('the attached record is shown',
    (await hodPage.getByText('Academic record').count()) > 0);
  check('the student’s standing is shown', (await hodPage.getByText('CGPA').count()) > 0);
  check('the Head is offered approve and return',
    (await hodPage.getByText('Approve the transfer').count()) > 0 &&
      (await hodPage.getByText('Return to advisor').count()) > 0);

  await hodPage.screenshot({ path: 'screenshots/transfers-hod-detail.png', fullPage: true });

  // ── The Head approves — which SCHEDULES the move ─────────────────────
  await hodPage.locator('button', { hasText: 'Approve the transfer' }).first().click();
  // Wait for the dialog's content, not just its frame — it animates in.
  await hodPage
    .locator('mat-dialog-container button', { hasText: 'Confirm' })
    .waitFor({ timeout: 15_000 });
  await hodPage
    .locator('mat-dialog-container', { hasText: /finish/i })
    .waitFor({ timeout: 5_000 })
    .catch(() => undefined);
  const confirmText = await hodPage.locator('mat-dialog-container').innerText();
  check('the confirmation says the student finishes the session first',
    /finish the current session/i.test(confirmText), confirmText.replace(/\s+/g, ' ').slice(0, 90));
  await hodPage.locator('mat-dialog-container button', { hasText: 'Confirm' }).click();
  await hodPage.getByText(/Approved — moves when/).first().waitFor({ timeout: 30_000 }).catch(() => undefined);
  check('the page shows it approved for the end of the session',
    (await hodPage.getByText(/Approved — moves when/).count()) > 0);
  // The page replaces its copy with the action's response; if that response
  // is not populated the departments and the advisor's name go blank.
  const scheduledText = await hodPage.locator('.td-scheduled').first().innerText().catch(() => '');
  check('after approving, departments are still named (not "—")',
    /Mathematics/i.test(scheduledText) && /Physics/i.test(scheduledText) && !/ in —/.test(scheduledText),
    scheduledText.replace(/\s+/g, ' ').slice(0, 120));
  check('the badge reads in words, not a token',
    (await hodPage.getByText('Approved · moves at session end').count()) > 0 &&
      (await hodPage.getByText(/\bAPPROVED\b/).count()) === 0);

  const stillHere = await api('GET', `/transfers/${transferId}`, caSession.accessToken);
  check('approval did not move the student', stillHere.body?.data?.status === 'APPROVED' &&
    String(stillHere.body?.data?.student?.level ?? '') === String(currentLevel),
    `status=${stillHere.body?.data?.status} level=${stillHere.body?.data?.student?.level}`);
  await hodPage.screenshot({ path: 'screenshots/transfers-hod-approved.png', fullPage: true });

  // The advisor can still withdraw it before the session closes.
  await open(caPage, `/transfers/${transferId}`, '.td-letter');
  check('the advisor is offered “Withdraw the transfer” while it waits',
    (await caPage.locator('button', { hasText: 'Withdraw the transfer' }).count()) > 0);

  // ── Overflow at the DESKTOP width too ────────────────────────────────
  // The first version of this page only checked 1000px, where the grid is
  // already single-column — so the two-column layout's overflow went unseen
  // until somebody looked at the screenshot.
  const wideOverflow = await hodPage.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
  check('no horizontal overflow at 1440px', !wideOverflow);

  const asideVisible = await hodPage.evaluate(() => {
    const aside = document.querySelector('aside');
    if (!aside) return false;
    const box = aside.getBoundingClientRect();
    return box.right <= window.innerWidth + 1 && box.width > 100;
  });
  check('the side column is fully on screen, not clipped', asideVisible);

  // ── 1000px, the staff UI's floor ─────────────────────────────────────
  await hodPage.setViewportSize({ width: 1000, height: 1100 });
  await open(hodPage, `/transfers/${transferId}`, '.td-letter');
  const overflow = await hodPage.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
  check('no horizontal overflow at 1000px', !overflow);
  await hodPage.screenshot({ path: 'screenshots/transfers-hod-1000.png', fullPage: true });

  // ── Nothing leaked into the console, and no Angular artefacts ────────
  const noisy = [...caErrors, ...hodErrors].filter(
    (text) => !/favicon|404|net::ERR/i.test(text)
  );
  check('no console errors', noisy.length === 0, noisy.slice(0, 2).join(' | '));

  const leak = await hodPage.getByText(/SafeValue|\[object Object\]|undefined/).count();
  check('no SafeValue / [object Object] / undefined on screen', leak === 0);

  /**
   * A DatePipe pattern treats every unquoted letter as a format specifier,
   * so `date: 'MMM d, y · shortTime'` silently renders "109ortTi9e" rather
   * than failing. Nothing above would notice — it is not undefined, not an
   * object, and not an enum token. So look for the shape itself.
   */
  const trailText = await hodPage.locator('.td-trail').innerText();
  check('dates in the trail are real dates, not a mangled format string',
    !/\d+ort|ortTi/i.test(trailText) && /\d{4}/.test(trailText),
    trailText.replace(/\s+/g, ' ').slice(0, 80));
} catch (error) {
  // Without this the `finally`'s process.exit swallows the stack and the
  // run reports "0/0 passed", which looks like success.
  check('the harness ran to completion', false, String(error).split('\n')[0]);
} finally {
  // Approval only schedules the move, so the student was never moved;
  // withdrawing the request is the whole cleanup. (If the run stopped before
  // approval, return it first so the advisor holds it again.)
  if (transferId) {
    await api('PATCH', `/transfers/${transferId}/reject`, hodSession.accessToken, {
      reason: 'Harness cleanup — not a real decision.',
    });
    await api('PATCH', `/transfers/${transferId}/cancel`, caSession.accessToken);
  }
  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  console.log('screenshots → Acheva-WEB-UI/screenshots/transfers-*.png');
  process.exit(failed.length ? 1 : 0);
}
