/**
 * The student details gate and the admin console's Lecturers, Students and
 * Logs pages, in real browsers against a real server.
 *
 *  Student portal — a student who has not given their details signs in and
 *  lands on "Complete your details"; every other page sends them back there,
 *  remembering where they were going; once saved they arrive there and are
 *  never stopped again; Settings shows the details and can edit them.
 *
 *  Admin console — the Lecturers and Students lists filter by school,
 *  faculty, department and level; a student's row opens their details; a
 *  ticket is raised, worked and resolved on the Logs page with its trail.
 *
 *   AU_API=http://localhost:3100 AU_STUDENT_APP=http://localhost:4401 \
 *   AU_ADMIN_APP=http://localhost:4301 node scripts/admin-console-ui-harness.mjs
 *
 * Both apps call :3000; the harness reroutes that to AU_API. Refuses to run
 * unless the database name contains "e2e" or "test". Restores the student's
 * details and deletes the tickets it raised. Screenshots go to AU_SHOTS.
 */
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';

// The staff app has no database driver; borrow the backend's.
const backend = createRequire(new URL('../../acheva-nestjs/package.json', import.meta.url));
const mongoose = backend('mongoose');

const API = process.env.AU_API ?? 'http://localhost:3100';
const STUDENT_APP = process.env.AU_STUDENT_APP ?? 'http://localhost:4401';
const ADMIN_APP = process.env.AU_ADMIN_APP ?? 'http://localhost:4301';
const DB = process.env.AU_DB ?? 'AchevaDB_e2e';
const PASSWORD = process.env.AU_PASSWORD ?? 'Password8@';
const STUDENT = process.env.AU_STUDENT ?? 'sim.mth200.3@acheva.sim';
const ADMIN = process.env.AU_ADMIN ?? 'members@acheva.app';
const SHOTS = process.env.AU_SHOTS ?? '/tmp/admin-console-shots';

if (!/e2e|test/i.test(DB)) {
  console.error(`Refusing to run against "${DB}" — use a test database.`);
  process.exit(2);
}
mkdirSync(SHOTS, { recursive: true });

const env = readFileSync(new URL('../../acheva-nestjs/.env', import.meta.url), 'utf8');
const uri = env
  .match(/^DATABASE_URI=(.*)$/m)[1]
  .trim()
  .replace(/^["']|["']$/g, '')
  .replace(/\/AchevaDB(\?|$)/, `/${DB}$1`);

let failures = 0;
let checks = 0;
const check = (name, pass, detail = '') => {
  checks += 1;
  if (!pass) failures += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const signIn = async (path, email) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const r = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    if (r.status === 429) {
      console.log(`  (sign-in rate limit — waiting a minute before ${email})`);
      await new Promise((resolve) => setTimeout(resolve, 61_000));
      continue;
    }
    const body = await r.json();
    if (!body?.data?.accessToken) throw new Error(`sign-in ${email} → ${r.status}`);
    return body.data;
  }
  throw new Error(`sign-in for ${email} kept hitting the rate limit`);
};

const newContext = async (browser, viewport = { width: 1440, height: 1000 }) => {
  const context = await browser.newContext({ viewport });
  await context.route(/^http:\/\/localhost:3000\//, (route) =>
    route.continue({ url: route.request().url().replace('http://localhost:3000', API) })
  );
  return context;
};

/**
 * The brand rule, checked on the rendered page rather than trusted: nothing
 * in the given region heavier than 500 (shared buttons and table headers
 * predate the rule and are skipped), and no green anywhere.
 */
const brandProblems = (page, selector) =>
  page.evaluate((root) => {
    const problems = [];
    const hue = (rgb) => {
      const m = rgb.match(/\d+(\.\d+)?/g);
      if (!m) return null;
      const [r, g, b, a = '1'] = m.map(Number);
      if (Number(a) === 0) return null;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max - min < 40) return null;
      let h;
      if (max === r) h = ((g - b) / (max - min)) % 6;
      else if (max === g) h = (b - r) / (max - min) + 2;
      else h = (r - g) / (max - min) + 4;
      return (h * 60 + 360) % 360;
    };
    for (const el of document.querySelectorAll(`${root} *`)) {
      const style = getComputedStyle(el);
      const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      const legacy = el.closest('.adm-btn, th, .mat-mdc-option, mat-option');
      if (text && !legacy && Number(style.fontWeight) > 500) {
        problems.push(`weight ${style.fontWeight}: "${el.textContent.trim().slice(0, 40)}"`);
      }
      for (const colour of [style.color, style.backgroundColor, style.borderTopColor]) {
        const h = hue(colour);
        if (h !== null && h >= 80 && h <= 170) {
          problems.push(`green ${colour}: <${el.tagName.toLowerCase()} class="${el.className}">`);
        }
      }
    }
    return [...new Set(problems)].slice(0, 8);
  }, selector);

await mongoose.connect(uri);
const db = mongoose.connection;
const Students = db.collection('students');
const Tickets = db.collection('tickets');
const DETAIL_FIELDS = ['sex', 'dateOfBirth', 'nationality', 'stateOfOrigin', 'modeOfEntry', 'programmeOption'];
const studentDoc = await Students.findOne({ email: STUDENT });
if (!studentDoc) throw new Error(`No student ${STUDENT} in ${DB}`);
const savedDetails = Object.fromEntries(DETAIL_FIELDS.map((f) => [f, studentDoc[f] ?? null]));
const startedAt = new Date();

const browser = await chromium.launch();
try {
  // ── Student portal: the details gate ─────────────────────────────────────
  await Students.updateOne(
    { _id: studentDoc._id },
    { $set: Object.fromEntries(DETAIL_FIELDS.map((f) => [f, null])) }
  );

  const studentContext = await newContext(browser);
  const page = await studentContext.newPage();
  await page.goto(`${STUDENT_APP}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[formcontrolname="email"]').fill(STUDENT);
  await page.locator('input[formcontrolname="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL(/\/details/, { timeout: 30_000 }).catch(() => undefined);
  check('signing in lands on "Complete your details"', /\/details/.test(page.url()), page.url());
  await page.getByText('Complete Your Details').waitFor({ timeout: 15_000 }).catch(() => undefined);
  check(
    'the page says what it wants and the menu is not there',
    (await page.getByText('Complete Your Details').count()) === 1 &&
      (await page.locator('app-side-bar').count()) === 0
  );

  await page.goto(`${STUDENT_APP}/results`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/details/, { timeout: 15_000 }).catch(() => undefined);
  check(
    'every other page sends them back, remembering where they were going',
    /\/details\?next=%2Fresults/.test(page.url()),
    page.url()
  );
  await page.getByText('Complete Your Details').waitFor({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.locator('.field-error').first().waitFor({ timeout: 5_000 }).catch(() => undefined);
  check(
    'saving an empty form shows what is missing instead of sending it',
    (await page.locator('.field-error').count()) >= 4 && /\/details/.test(page.url())
  );
  await page.screenshot({ path: `${SHOTS}/student-details-empty.png`, fullPage: true });

  const pick = async (selectId, option) => {
    await page.locator(`mat-select#${selectId}`).click();
    await page.locator('mat-option').filter({ hasText: new RegExp(`^\\s*${option}\\s*$`) }).click();
  };
  await pick('details-sex', 'Female');
  await page.locator('#details-dob').fill('2004-08-21');
  await pick('details-state', 'Imo');
  await pick('details-entry', 'UTME');
  await page.screenshot({ path: `${SHOTS}/student-details-filled.png`, fullPage: true });
  const studentBrand = await brandProblems(page, 'app-student-details');
  check('the details page keeps to the brand', studentBrand.length === 0, studentBrand.join('; '));

  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.waitForURL(/\/results/, { timeout: 20_000 }).catch(() => undefined);
  check('saving takes them where they were going', /\/results$/.test(page.url()), page.url());

  await page.goto(`${STUDENT_APP}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.locator('app-dashboard').waitFor({ timeout: 20_000 }).catch(() => undefined);
  check('they are never stopped again', /\/dashboard$/.test(page.url()), page.url());

  const stored = await Students.findOne({ _id: studentDoc._id });
  check(
    'what they chose is what was stored',
    stored.sex === 'FEMALE' &&
      stored.stateOfOrigin === 'Imo' &&
      stored.nationality === 'Nigerian' &&
      stored.dateOfBirth?.toISOString().startsWith('2004-08-21') &&
      stored.modeOfEntry === 'UTME'
  );

  await page.goto(`${STUDENT_APP}/settings/profile`, { waitUntil: 'domcontentloaded' });
  // The headings are static; wait for the profile itself to arrive.
  await page
    .locator('app-profile')
    .getByText(studentDoc.registrationNumber)
    .waitFor({ timeout: 20_000 });
  const profileText = await page.locator('app-profile').innerText();
  check(
    'Settings shows the details, the date day-first',
    /Imo/.test(profileText) && /21\/08\/2004/.test(profileText) && /UTME/.test(profileText),
    profileText.match(/Date of birth\s*\n?\s*(\S+)/)?.[1]
  );
  await page.screenshot({ path: `${SHOTS}/student-settings-profile.png`, fullPage: true });

  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByText('Your Details').waitFor({ timeout: 15_000 });
  const stateShown = await page.locator('mat-select#details-state').innerText();
  check('editing opens the form filled in', /Imo/.test(stateShown), stateShown);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.waitForURL(/\/settings\/profile/, { timeout: 15_000 }).catch(() => undefined);
  check('cancel goes back to Settings', /\/settings\/profile/.test(page.url()));

  const phone = await (await newContext(browser, { width: 390, height: 844 })).newPage();
  await phone.goto(`${STUDENT_APP}/auth/login`, { waitUntil: 'domcontentloaded' });
  const session = await page.evaluate(() => ({ ...localStorage }));
  await phone.evaluate((stored) => {
    for (const [key, value] of Object.entries(stored)) localStorage.setItem(key, value);
  }, session);
  await phone.goto(`${STUDENT_APP}/details`, { waitUntil: 'domcontentloaded' });
  await phone.getByText('Your Details').waitFor({ timeout: 15_000 });
  const overflow = await phone.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  check('the form fits a phone without sideways scrolling', !overflow);
  await phone.screenshot({ path: `${SHOTS}/student-details-phone.png`, fullPage: true });

  // ── Admin console ────────────────────────────────────────────────────────
  const admin = await signIn('/auth/admins/login', ADMIN);
  const { accessToken: adminToken, refreshToken: adminRefresh, ...adminAccount } = admin;
  const adminContext = await newContext(browser);
  await adminContext.addInitScript(
    ([t, r, a]) => {
      if (!localStorage.getItem('acheva-admin-token')) {
        localStorage.setItem('acheva-admin-token', t);
        if (r) localStorage.setItem('acheva-admin-refresh', r);
        localStorage.setItem('acheva-admin-account', a);
      }
    },
    [adminToken, adminRefresh ?? '', JSON.stringify(adminAccount)]
  );
  const adminPage = await adminContext.newPage();

  // Lecturers
  await adminPage.goto(`${ADMIN_APP}/lecturers`, { waitUntil: 'domcontentloaded' });
  await adminPage.locator('table.adm-table tbody tr').first().waitFor({ timeout: 30_000 });
  const allLecturers = await adminPage.locator('table.adm-table tbody tr').count();
  check('Lecturers lists staff', allLecturers > 0, `${allLecturers} rows`);

  const dept = await db.collection('departments').findOne({ _id: studentDoc.department });
  const faculty = await db.collection('faculties').findOne({ _id: dept.faculty });
  /** Change a filter and wait for the list it asks for to come back and render. */
  const filter = async (selector, value, path) => {
    await Promise.all([
      adminPage.waitForResponse(
        (r) => r.url().includes(path) && r.request().method() === 'GET' && r.status() === 200
      ),
      adminPage.locator(selector).selectOption(value),
    ]);
    await adminPage.locator('table.adm-table tbody tr, .adm-empty').first().waitFor();
  };
  await filter('#pf-school', String(studentDoc.school), '/admins/lecturers');
  await filter('#pf-faculty', String(faculty._id), '/admins/lecturers');
  await filter('#pf-department', String(dept._id), '/admins/lecturers');
  const deptCells = await adminPage.locator('table.adm-table tbody tr td:nth-child(2)').allInnerTexts();
  check(
    'narrowing to a department lists only its staff',
    deptCells.length > 0 && deptCells.every((cell) => cell.includes(dept.name)),
    `${deptCells.length} in ${dept.name}`
  );
  await filter('#lec-role', 'HOD', '/admins/lecturers');
  const officeCells = await adminPage.locator('table.adm-table tbody tr td:nth-child(3)').allInnerTexts();
  check(
    'and to an office',
    officeCells.length > 0 && officeCells.every((cell) => /Head of Department/.test(cell))
  );
  await adminPage.screenshot({ path: `${SHOTS}/admin-lecturers.png`, fullPage: true });
  const lecturerBrand = await brandProblems(adminPage, 'app-lecturers');
  check('Lecturers keeps to the brand', lecturerBrand.length === 0, lecturerBrand.join('; '));

  // Students
  await adminPage.goto(`${ADMIN_APP}/students`, { waitUntil: 'domcontentloaded' });
  await adminPage.locator('table.adm-table tbody tr').first().waitFor({ timeout: 30_000 });
  await filter('#pf-school', String(studentDoc.school), '/admins/students');
  await filter('#pf-faculty', String(faculty._id), '/admins/students');
  await filter('#pf-department', String(dept._id), '/admins/students');
  await filter('#stu-level', studentDoc.level, '/admins/students');
  const levelCells = await adminPage.locator('table.adm-table tbody tr td:nth-child(4)').allInnerTexts();
  check(
    'Students narrows to one department and level',
    levelCells.length > 0 && levelCells.every((cell) => cell.trim() === studentDoc.level),
    `${levelCells.length} at ${studentDoc.level}`
  );

  await Promise.all([
    adminPage.waitForResponse((r) => r.url().includes(`search=${studentDoc.registrationNumber}`)),
    adminPage.locator('#stu-search').fill(studentDoc.registrationNumber),
  ]);
  const row = adminPage.locator('table.adm-table tbody tr', { hasText: studentDoc.registrationNumber });
  check(
    "the student's row reports their details complete",
    /Complete/.test(await row.innerText())
  );
  await row.click();
  const dialog = adminPage.locator('app-student-dialog');
  await dialog.waitFor({ timeout: 10_000 });
  // A trial click waits for the open animation to settle.
  await dialog.getByRole('button', { name: 'Done' }).click({ trial: true });
  const dialogText = await dialog.innerText();
  check(
    'opening a student shows what they gave',
    /Imo/.test(dialogText) && /21\/08\/2004/.test(dialogText) && /Female/.test(dialogText)
  );
  await adminPage.screenshot({ path: `${SHOTS}/admin-student-dialog.png` });
  // Material caps a dialog's width; content wider than the cap is clipped
  // off the left edge with no scrollbar, which no other check would notice.
  const clipped = await dialog.evaluate((el) => {
    const box = el.querySelector('.adm-dialog').getBoundingClientRect();
    const frame = el.closest('.mat-mdc-dialog-surface').getBoundingClientRect();
    return box.left < frame.left - 1 || box.right > frame.right + 1;
  });
  check('the student view fits inside its dialog', !clipped);
  const dialogBrand = await brandProblems(adminPage, 'app-student-dialog');
  check('the student view keeps to the brand', dialogBrand.length === 0, dialogBrand.join('; '));
  await dialog.getByRole('button', { name: 'Done' }).click();

  // Logs
  await adminPage.goto(`${ADMIN_APP}/logs`, { waitUntil: 'domcontentloaded' });
  await adminPage.getByRole('button', { name: /New ticket/ }).click();
  const form = adminPage.locator('app-ticket-form-dialog');
  await form.waitFor({ timeout: 10_000 });
  // The dialog focuses its first field once it has finished opening; typing
  // before that lands in a field that is about to be replaced.
  await adminPage.waitForFunction(
    () => document.activeElement?.getAttribute('formcontrolname') === 'title',
    null,
    { timeout: 10_000 }
  );
  await form.locator('input[formcontrolname="title"]').fill('Harness: student cannot download transcript');
  await form.locator('textarea[formcontrolname="description"]').fill('Raised by the browser harness.');
  await form.locator('select[formcontrolname="category"]').selectOption('TRANSCRIPT');
  await form.locator('select[formcontrolname="priority"]').selectOption('HIGH');
  await form.locator('input[formcontrolname="reporterName"]').fill('Ada Harness');
  await form.getByRole('button', { name: 'Create ticket' }).click();
  await adminPage.waitForURL(/\/logs\/[0-9a-f]{24}/, { timeout: 15_000 }).catch(() => undefined);
  check('creating a ticket opens it', /\/logs\/[0-9a-f]{24}/.test(adminPage.url()), adminPage.url());
  // From the page header — the "TKT-0004 created." toast also carries it.
  const header = adminPage.locator('app-ticket-detail .adm-page-head p').first();
  await header.filter({ hasText: /^TKT-\d{4,}$/ }).waitFor({ timeout: 10_000 });
  const reference = (await header.innerText()).trim();

  await adminPage.getByRole('button', { name: 'Start work' }).click();
  await adminPage.getByText('started work on it').waitFor({ timeout: 10_000 });
  const trailAfterStart = await adminPage.locator('.ticket-trail').innerText();
  check('starting work makes it yours and says so', /took it/.test(trailAfterStart));

  await adminPage.getByRole('button', { name: 'Mark resolved' }).click();
  await adminPage.locator('#move-note').fill('Re-issued the transcript serial.');
  await adminPage.locator('.ticket-confirm').getByRole('button', { name: 'Mark resolved' }).click();
  await adminPage.getByText('Resolution').waitFor({ timeout: 10_000 });
  check(
    'resolving asks how, and shows the answer',
    /Re-issued the transcript serial/.test(await adminPage.locator('.ticket-resolution').innerText())
  );
  await adminPage.screenshot({ path: `${SHOTS}/admin-ticket.png`, fullPage: true });
  const ticketBrand = await brandProblems(adminPage, 'app-ticket-detail');
  check('the ticket page keeps to the brand', ticketBrand.length === 0, ticketBrand.join('; '));

  await adminPage.goto(`${ADMIN_APP}/logs`, { waitUntil: 'domcontentloaded' });
  await adminPage.getByRole('tab', { name: /Resolved/ }).click();
  await adminPage.locator('table.adm-table tbody tr', { hasText: reference }).waitFor({ timeout: 10_000 });
  check('the Resolved tab lists it', true, reference);
  await adminPage.screenshot({ path: `${SHOTS}/admin-logs.png`, fullPage: true });
  const logsBrand = await brandProblems(adminPage, 'app-logs');
  check('Logs keeps to the brand', logsBrand.length === 0, logsBrand.join('; '));
} catch (error) {
  failures += 1;
  console.log(`FAIL  harness crashed — ${error.stack ?? error}`);
} finally {
  await browser.close();
  await Students.updateOne({ _id: studentDoc._id }, { $set: savedDetails });
  const removed = await Tickets.deleteMany({ title: /^Harness: /, createdAt: { $gte: startedAt } });
  console.log(`\n(restored ${STUDENT}'s details; removed ${removed.deletedCount} harness tickets; shots in ${SHOTS})`);
  await mongoose.disconnect();
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
