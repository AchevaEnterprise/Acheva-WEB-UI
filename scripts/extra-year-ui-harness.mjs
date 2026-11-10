/**
 * Extra Year, Previously Advised Sets, the student's standing and the dues
 * amount box — in real browsers (2026-11-09).
 *
 * Sets the stage straight in the test database rather than through a
 * rollover (`npm run test:extra-year` in the backend covers that path): one
 * advisor who saw the 2022 set through final year, two of its students in
 * Extra Year 1, one graduated, one still awaiting final results. Then checks
 * what each person sees:
 *
 *  - the advisor's Extra Year page lists "2022 set" with those three
 *    students, the courses each owes, and the results the held one is
 *    waiting on; Previously Advised Sets lists the set and opens to every
 *    student with where they stand;
 *  - the extra-year student's dashboard says "Extra Year 1", never EXCEPTION,
 *    and the held student's says "Awaiting final results";
 *  - the dues page lets a student choose an amount, refuses a token one and
 *    says why, and accepts 30% or more;
 *  - the Head's dues editor sets how many payments and when — no amounts.
 *
 *   XY_API=http://localhost:3100 XY_STAFF_APP=http://localhost:4210 \
 *   XY_STUDENT_APP=http://localhost:4401 node scripts/extra-year-ui-harness.mjs
 */
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';

const backend = createRequire(new URL('../../acheva-nestjs/package.json', import.meta.url));
const mongoose = backend('mongoose');

const API = process.env.XY_API ?? 'http://localhost:3100';
const STAFF_APP = process.env.XY_STAFF_APP ?? 'http://localhost:4210';
const STUDENT_APP = process.env.XY_STUDENT_APP ?? 'http://localhost:4401';
const DB = process.env.XY_DB ?? 'AchevaDB_e2e';
const PASSWORD = 'Password8@';
const ADVISOR = 'danielchinemerem302+23@gmail.com'; // Maths 500, 2022 set
const HOD = 'danielchinemerem302+1@gmail.com';
const PAYER = 'e2e.e2e80888582@example.com'; // Maths, no payments, a real-format email
const INTAKE = '2022';
const SHOTS = process.env.XY_SHOTS ?? '/tmp/extra-year-shots';

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

const call = async (method, path, token, body) => {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const signIn = async (path, email) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const r = await call('POST', path, null, { email, password: PASSWORD });
    if (r.status === 429) {
      console.log(`  (sign-in rate limit — waiting a minute before ${email})`);
      await new Promise((resolve) => setTimeout(resolve, 61_000));
      continue;
    }
    if (!r.body?.data?.accessToken) throw new Error(`sign-in ${email} → ${r.status}`);
    return r.body.data;
  }
  throw new Error(`sign-in for ${email} kept hitting the rate limit`);
};

/** A browser already signed in as `session`, with :3000 rerouted to the API. */
const contextFor = async (browser, session, extra = {}) => {
  const { accessToken, refreshToken, ...account } = session;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route(/^http:\/\/localhost:3000\//, (route) =>
    route.continue({ url: route.request().url().replace('http://localhost:3000', API) }),
  );
  await context.addInitScript(
    ([t, r, a]) => {
      if (!localStorage.getItem('token')) {
        localStorage.setItem('token', t);
        localStorage.setItem('refresh_token', r);
        localStorage.setItem('active_account', a);
      }
    },
    [accessToken, refreshToken ?? accessToken, JSON.stringify({ ...account, ...extra })],
  );
  return context;
};

/** Nothing heavier than 500 (shared buttons and table heads predate the rule), and no green. */
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
      const legacy = el.closest('button, th, mat-option, app-empty-state');
      if (text && !legacy && Number(style.fontWeight) > 500) {
        problems.push(`weight ${style.fontWeight}: "${el.textContent.trim().slice(0, 40)}"`);
      }
      for (const colour of [style.color, style.backgroundColor]) {
        const h = hue(colour);
        if (h !== null && h >= 80 && h <= 170) problems.push(`green ${colour}`);
      }
    }
    return [...new Set(problems)].slice(0, 6);
  }, selector);

const screenshotSafe = (page, path) => page.screenshot({ path, fullPage: true }).catch(() => undefined);

await mongoose.connect(uri, { serverSelectionTimeoutMS: 30_000 });
const db = mongoose.connection;
const Students = db.collection('students');
const Lecturers = db.collection('lecturers');
const startedAt = new Date();

const advisor = await Lecturers.findOne({ email: ADVISOR });
const setStudents = await Students.find({ department: advisor.department, admissionYear: INTAKE }).sort({ registrationNumber: 1 }).toArray();
if (setStudents.length < 4) throw new Error(`need four ${INTAKE} students in the advisor's department`);
const [extraA, extraB, graduate, held] = setStudents;
// The held student waits on the courses of a live registration this session.
const heldRegistration = await db
  .collection('courseregistrations')
  .findOne({ student: held._id, session: '2025/2026', status: 'ACTIVE', 'entries.status': 'REGISTERED' });
if (!heldRegistration) throw new Error(`${held.email} needs an ACTIVE 2025/2026 registration`);
const heldCourse = heldRegistration.entries.find((line) => line.status === 'REGISTERED').courseCode;
const studentSnapshot = setStudents.map(({ _id, level, academicStanding, extraYear, graduatedSession, pendingSession }) => ({
  _id, level, academicStanding, extraYear, graduatedSession, pendingSession,
}));
const advisorSnapshot = {
  assignedLevel: advisor.assignedLevel,
  assignedLevelAdmissionYear: advisor.assignedLevelAdmissionYear,
  extraYearIntakes: advisor.extraYearIntakes ?? [],
  role: advisor.role,
  otherRoles: advisor.otherRoles ?? [],
};
const payer = await Students.findOne({ email: PAYER });
const due = await db.collection('dues').findOne({ department: payer.department, status: 'ACTIVE' });
const dueSnapshot = due ? { ...due } : null;

const browser = await chromium.launch();
try {
  // ── The stage: a finished set, two in extra year, one graduated ──────────
  await Lecturers.updateOne(
    { _id: advisor._id },
    {
      $set: { assignedLevel: 'NONE', assignedLevelAdmissionYear: null, extraYearIntakes: [INTAKE] },
    },
  );
  await db.collection('advisedsets').insertOne({
    lecturer: advisor._id,
    department: advisor.department,
    school: advisor.school,
    admissionYear: INTAKE,
    status: 'COMPLETED',
    startedSession: '2021/2022',
    startedLevel: '100',
    endedSession: '2025/2026',
    endedLevel: '500',
    endedReason: 'SET_COMPLETED',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await Students.updateMany(
    { _id: { $in: [extraA._id, extraB._id] } },
    { $set: { academicStanding: 'EXTRA_YEAR', extraYear: 1, level: 'EXCEPTION', graduatedSession: null } },
  );
  await Students.updateOne(
    { _id: graduate._id },
    { $set: { academicStanding: 'GRADUATED', graduatedSession: '2025/2026' } },
  );
  await Students.updateOne(
    { _id: held._id },
    { $set: { academicStanding: 'AWAITING_RESULTS', pendingSession: '2025/2026', level: '500' } },
  );

  // ── The advisor ──────────────────────────────────────────────────────────
  let advisorSession = await signIn('/auth/lecturers/signin', ADVISOR);
  if (advisorSession.role !== 'COURSE_ADVISOR') {
    await call('PATCH', '/auth/lecturers/switch-role', advisorSession.accessToken, { role: 'COURSE_ADVISOR' });
    advisorSession = await signIn('/auth/lecturers/signin', ADVISOR);
  }
  const staff = await (await contextFor(browser, advisorSession)).newPage();

  await staff.goto(`${STAFF_APP}/extra-year`, { waitUntil: 'domcontentloaded' });
  await staff.locator('.set-tab').first().waitFor({ timeout: 30_000 });
  check(
    'the menu offers Extra Year and Advised Sets to a Course Advisor',
    (await staff.getByText('Extra Year', { exact: true }).count()) > 0 &&
      (await staff.getByText('Advised Sets', { exact: true }).count()) > 0,
  );
  const tab = (await staff.locator('.set-tab').first().innerText()).replace(/\s+/g, ' ');
  check(`Extra Year lists the ${INTAKE} set with its three students`, /2022 set\s*3/.test(tab), tab);
  await staff.locator('.set-table tbody tr').first().waitFor({ timeout: 20_000 });
  const rows = await staff.locator('.set-table tbody tr').allInnerTexts();
  check(
    'the list holds the two extra-year students, each with what they owe',
    rows.length === 3 && rows.filter((row) => /Extra Year 1/.test(row)).length === 2 &&
      rows.some((row) => row.includes(extraA.registrationNumber)),
    rows.map((row) => row.replace(/\s+/g, ' ')).join(' | '),
  );
  const heldRow = rows.find((row) => row.includes(held.registrationNumber)) ?? '';
  check(
    '…and the held student, marked "Awaiting final results" with the results not yet out',
    /Awaiting final results/.test(heldRow) && heldRow.includes(heldCourse),
    heldRow.replace(/\s+/g, ' ').slice(0, 160),
  );
  const caption = (await staff.locator('.panel__head').first().innerText()).replace(/\s+/g, ' ');
  check('the set’s heading counts who is awaiting results', /1 awaiting results/.test(caption), caption);
  await staff.screenshot({ path: `${SHOTS}/staff-extra-year.png`, fullPage: true });
  const extraBrand = await brandProblems(staff, 'app-extra-year');
  check('Extra Year keeps to the brand', extraBrand.length === 0, extraBrand.join('; '));

  await staff.locator('.set-table tbody tr').first().getByRole('link', { name: 'View record' }).click();
  await staff.waitForURL(/\/students\/[^/]+$/, { timeout: 15_000 }).catch(() => undefined);
  check('"View record" opens the student’s record', /\/students\//.test(staff.url()), staff.url());

  await staff.goto(`${STAFF_APP}/advised-sets`, { waitUntil: 'domcontentloaded' });
  await staff.locator('.set-table--rows tbody tr').first().waitFor({ timeout: 30_000 });
  const setRow = (await staff.locator('.set-table--rows tbody tr').first().innerText()).replace(/\s+/g, ' ');
  check(
    'Previously Advised Sets lists the set, how it ended and how its students stand',
    /2022 set/.test(setRow) && /Saw through final year/.test(setRow) && /1 graduated/.test(setRow) &&
      /2 extra year/.test(setRow) && /1 awaiting results/.test(setRow),
    setRow,
  );
  await staff.locator('.set-table--rows tbody tr').first().click();
  await staff.locator('.panel').nth(1).locator('tbody tr').first().waitFor({ timeout: 20_000 });
  const everyone = await staff.locator('.panel').nth(1).locator('tbody tr').allInnerTexts();
  check(
    'opening it shows every student with where they stand',
    everyone.some((row) => /Graduated/.test(row)) && everyone.some((row) => /Extra Year 1/.test(row)),
    `${everyone.length} students`,
  );
  await staff.screenshot({ path: `${SHOTS}/staff-advised-sets.png`, fullPage: true });
  const setsBrand = await brandProblems(staff, 'app-advised-sets');
  check('Advised Sets keeps to the brand', setsBrand.length === 0, setsBrand.join('; '));

  // ── The extra-year student ───────────────────────────────────────────────
  const extraSession = await signIn('/auth/students/signin', extraA.email);
  const student = await (await contextFor(browser, extraSession, { detailsRequired: false })).newPage();
  await student.goto(`${STUDENT_APP}/dashboard`, { waitUntil: 'domcontentloaded' });
  await student.locator('app-dashboard h1').waitFor({ timeout: 30_000 });
  const header = await student.locator('app-dashboard').innerText();
  check(
    'the extra-year student’s dashboard says "Extra Year 1", never EXCEPTION',
    /Extra Year 1/.test(header) && !/EXCEPTION/.test(header),
    header.split('\n').slice(0, 3).join(' / '),
  );
  await student.screenshot({ path: `${SHOTS}/student-dashboard-extra-year.png` });

  const heldSession = await signIn('/auth/students/signin', held.email);
  const heldPage = await (await contextFor(browser, heldSession, { detailsRequired: false })).newPage();
  await heldPage.goto(`${STUDENT_APP}/dashboard`, { waitUntil: 'domcontentloaded' });
  await heldPage.locator('app-dashboard h1').waitFor({ timeout: 30_000 });
  const heldHeader = await heldPage.locator('app-dashboard').innerText();
  check(
    'the held student’s dashboard says "Awaiting final results"',
    /Awaiting final results/.test(heldHeader) && !/Graduated/.test(heldHeader.split('\n').slice(0, 3).join(' ')),
    heldHeader.split('\n').slice(0, 3).join(' / '),
  );
  await heldPage.screenshot({ path: `${SHOTS}/student-dashboard-awaiting.png` });

  // ── The dues amount box ──────────────────────────────────────────────────
  if (due) {
    await db.collection('dues').updateOne(
      { _id: due._id },
      { $set: { instalments: [1, 2, 3].map((position) => ({ position, amount: [1250000, 1250000, 1250000][position - 1], dueDate: new Date(2026, 10 + position, 15), note: null })), amount: 3750000 } },
    );
    const payerSession = await signIn('/auth/students/signin', PAYER);
    const duesPage = await (await contextFor(browser, payerSession, { detailsRequired: false })).newPage();
    await duesPage.goto(`${STUDENT_APP}/dues`, { waitUntil: 'domcontentloaded' });
    await duesPage.locator('#dues-amount').waitFor({ timeout: 30_000 });
    check(
      'the dues page offers an amount, prefilled with a sensible split',
      (await duesPage.locator('#dues-amount').inputValue()) === '12500',
      await duesPage.locator('#dues-amount').inputValue(),
    );
    const rule = await duesPage.locator('#dues-amount-rule').innerText();
    check('and states the rule in naira', /₦11,250\.00/.test(rule) && /30%/.test(rule), rule);
    await duesPage.locator('#dues-amount').fill('375');
    const payButton = duesPage.locator('.pay__row .btn--primary');
    await duesPage.waitForFunction(() => document.querySelector('.pay__row .btn--primary')?.hasAttribute('disabled'));
    check(
      'a token amount disables the button and says why',
      (await payButton.isDisabled()) && /at least ₦11,250\.00/.test(await duesPage.locator('#dues-amount-rule').innerText()),
      await duesPage.locator('#dues-amount-rule').innerText(),
    );
    await duesPage.locator('#dues-amount').fill('11250');
    await duesPage.waitForFunction(() => !document.querySelector('.pay__row .btn--primary')?.hasAttribute('disabled'));
    check('30% enables it', !(await payButton.isDisabled()), await payButton.innerText());
    await duesPage.screenshot({ path: `${SHOTS}/student-dues-amount.png`, fullPage: true });
    const duesBrand = await brandProblems(duesPage, 'app-dues');
    check('the dues page keeps to the brand', duesBrand.length === 0, duesBrand.join('; '));
  }

  // ── The Head's dues editor ───────────────────────────────────────────────
  const hodSession = await signIn('/auth/lecturers/signin', HOD);
  const hod = await (await contextFor(browser, hodSession)).newPage();
  await hod.goto(`${STAFF_APP}/user-settings/hod/departmental-dues`, { waitUntil: 'domcontentloaded' });
  await hod.getByText('How it may be paid').waitFor({ timeout: 30_000 }).catch(() => undefined);
  const editor = await hod.locator('app-departmental-dues').innerText().catch(() => '');
  check(
    'the Head sets how many payments and when — no instalment amounts',
    /Payment 1 due by/.test(editor) && !/Scheduled/.test(editor) && /at least 30% of the total/.test(editor),
    editor.match(/They choose[^.]*\./)?.[0] ?? editor.slice(0, 120),
  );
  await hod.screenshot({ path: `${SHOTS}/hod-dues-editor.png`, fullPage: true });

  // ── The Head's Lecturer Management ───────────────────────────────────────
  await hod.goto(`${STAFF_APP}/user-settings/hod/lecturer-management`, { waitUntil: 'domcontentloaded' });
  const advisorRow = hod.locator('tr', { hasText: ADVISOR });
  await advisorRow.waitFor({ timeout: 30_000 });
  const rowText = (await advisorRow.innerText()).replace(/\s+/g, ' ');
  check(
    'an advisor between sets shows their extra-year set, and can be assigned or handed over',
    /Extra years: 2022 set/.test(rowText) &&
      (await advisorRow.getByRole('button', { name: 'Assign' }).count()) === 1 &&
      (await advisorRow.getByRole('button', { name: 'Hand over' }).count()) === 1,
    rowText,
  );
  await advisorRow.getByRole('button', { name: 'Hand over' }).click();
  const handoverDialog = hod.locator('app-handover-course-advisor');
  await handoverDialog.waitFor({ timeout: 10_000 });
  // The body names the sets once the dialog has its data, a beat after the title.
  await handoverDialog.getByText(/extra-year students of the/).waitFor({ timeout: 10_000 }).catch(() => undefined);
  const dialogText = (await handoverDialog.innerText()).replace(/\s+/g, ' ');
  check(
    'the handover dialog says it moves the extra-year students',
    /extra-year students of the 2022 set/.test(dialogText),
    dialogText.slice(0, 140),
  );
  // The candidates arrive from the server after the dialog opens.
  await hod.waitForResponse((r) => /\/lecturers\/all\//.test(r.url()), { timeout: 15_000 }).catch(() => undefined);
  await handoverDialog.locator('mat-select').click();
  await hod.locator('mat-option').first().waitFor({ timeout: 10_000 }).catch(() => undefined);
  const offered = await hod.locator('mat-option').allInnerTexts();
  check(
    'and offers lecturers who already advise a set — they keep it',
    offered.length > 1,
    `${offered.length} lecturers offered`,
  );
  await hod.keyboard.press('Escape');
  await handoverDialog.getByRole('button', { name: /cancel/i }).click().catch(() => undefined);
  await screenshotSafe(hod, `${SHOTS}/hod-lecturer-management.png`);

  const climbingRow = hod.locator('tr', { hasText: 'danielchinemerem302+22@gmail.com' });
  await climbingRow.getByRole('button', { name: 'Unassign' }).click();
  const unassignDialog = hod.locator('app-unassign-course-advisor');
  await unassignDialog.waitFor({ timeout: 10_000 });
  await unassignDialog.getByRole('button', { name: 'Unassign' }).click();
  const refusal = hod.getByText(/cannot be unassigned/).first();
  await refusal.waitFor({ timeout: 15_000 }).catch(() => undefined);
  check(
    'unassigning an advisor who has students is refused, pointing to Hand over',
    (await refusal.count()) > 0 && /Hand over/.test(await refusal.innerText()),
    (await refusal.count()) ? (await refusal.innerText()).slice(0, 120) : 'no message shown',
  );
} catch (error) {
  failures += 1;
  console.log(`FAIL  harness crashed — ${String(error?.stack ?? error).split('\n').slice(0, 3).join(' | ')}`);
} finally {
  await browser.close();
  for (const { _id, ...fields } of studentSnapshot) {
    await Students.updateOne(
      { _id },
      {
        $set: {
          level: fields.level,
          academicStanding: fields.academicStanding ?? 'IN_PROGRAMME',
          extraYear: fields.extraYear ?? 0,
          graduatedSession: fields.graduatedSession ?? null,
          pendingSession: fields.pendingSession ?? null,
        },
      },
    );
  }
  await Lecturers.updateOne({ _id: advisor._id }, { $set: advisorSnapshot });
  await db.collection('advisedsets').deleteMany({ createdAt: { $gte: startedAt } });
  if (dueSnapshot) {
    const { _id, ...fields } = dueSnapshot;
    await db.collection('dues').replaceOne({ _id }, { _id, ...fields });
  }
  console.log(`\n(restored the set, the advisor and the plan; shots in ${SHOTS})`);
  console.log(`\n${checks - failures}/${checks} checks passed`);
  await mongoose.disconnect();
  process.exit(failures ? 1 : 0);
}
