#!/usr/bin/env node
/**
 * End to end: a student signs up, a result travels the whole approval chain,
 * and the student sees it.
 *
 *   student signs up → verifies email → lecturer imports scores → sends to CC
 *   → CC approves → HOD (1st pass) → Dean → HOD (2nd pass) → Course Advisor
 *   publishes → the student signs in and sees the grade
 *
 * Every staff step is CLICKED through the staff portal. The student's sign-up
 * and verification go through the same API calls the sign-up page makes,
 * with the emailed code read from the database (a test cannot read an inbox).
 *
 * It writes data — a new student, a result, its entries — so it refuses to
 * run against a database whose name does not contain "e2e" or "test" unless
 * E2E_ALLOW_ANY_DB=1.
 *
 * Usage (servers must be running: API, staff portal, student portal):
 *   MONGO_URI="mongodb+srv://…/AchevaDB_e2e" node scripts/e2e-signup-to-publish.mjs
 *
 * Optional env (defaults are the test-copy accounts, password Password8@):
 *   API_URL=http://localhost:3000  STAFF_URL=http://localhost:4200
 *   STUDENT_URL=http://localhost:4201  PASSWORD=Password8@
 *   LECTURER=… HOD=… DEAN=… CA=…  CC=… (default: the course's coordinator)
 *   COURSE_CODE=… (default: first course in the lecturer's department with a
 *   coordinator and a free session for the intake)
 *   INTAKE=2023  LEVEL=400  HEADED=1 (watch it run)
 *
 * API_URL other than localhost:3000 also reroutes the portals' own calls to
 * it, so a test backend can be used without rebuilding the frontends.
 */
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const backend = createRequire(new URL('../../acheva-nestjs/package.json', import.meta.url));
const { chromium } = require('playwright');
const { MongoClient, ObjectId } = backend('mongodb');
const XLSX = backend('xlsx');

const env = (k, d) => process.env[k] ?? d;
const API = env('API_URL', 'http://localhost:3000');
const STAFF = env('STAFF_URL', 'http://localhost:4200');
const STUDENT = env('STUDENT_URL', 'http://localhost:4201');
const PASSWORD = env('PASSWORD', 'Password8@');
const LECTURER = env('LECTURER', 'danielchinemerem302+2@gmail.com');
const HOD = env('HOD', 'danielchinemerem302+1@gmail.com');
const DEAN = env('DEAN', 'danielchinemerem302@gmail.com');
const CA = env('CA', 'danielchinemerem302+22@gmail.com');
const COURSE_CODE = env('COURSE_CODE', '');
let COURSE = COURSE_CODE;
let CC_EMAIL = env('CC', '');
const INTAKE = env('INTAKE', '2023');
const LEVEL = env('LEVEL', '400');
const MONGO_URI = process.env.MONGO_URI;

let failures = 0;
const step = (n, msg) => console.log(`\n[${n}] ${msg}`);
const ok = (msg) => console.log(`   ✓ ${msg}`);
const bad = (msg) => { failures++; console.log(`   ✗ ${msg}`); };
const check = (cond, pass, fail) => (cond ? ok(pass) : bad(fail));

if (!MONGO_URI) {
  console.error('Set MONGO_URI to the TEST database (needed for sign-up codes and checks).');
  process.exit(2);
}
const mongo = await MongoClient.connect(MONGO_URI);
const db = mongo.db();
if (!/e2e|test/i.test(db.databaseName) && process.env.E2E_ALLOW_ANY_DB !== '1') {
  console.error(`Refusing to write to "${db.databaseName}" — point MONGO_URI at a test database.`);
  process.exit(2);
}

const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
const consoleErrors = [];

/** A fresh, signed-in browser context for one person. */
async function as(portal, email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // The portals are built against localhost:3000. Pointing API_URL anywhere
  // else (a test backend) reroutes their calls there too, so the browser and
  // this script always talk to the same database.
  if (API !== 'http://localhost:3000') {
    await context.route(/^http:\/\/localhost:3000\//, (route) =>
      route.continue({ url: route.request().url().replace('http://localhost:3000', API) })
    );
  }
  const page = await context.newPage();
  page.on('pageerror', (e) => consoleErrors.push(`${email}: ${e.message}`));
  const base = portal === 'staff' ? STAFF : STUDENT;
  for (let attempt = 1; attempt <= 4; attempt++) {
    await page.goto(`${base}/auth/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[formcontrolname="email"]').fill(email);
    await page.locator('input[formcontrolname="password"]').fill(PASSWORD);
    const resp = page.waitForResponse((r) => /\/signin$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST');
    await page.getByRole('button', { name: /log in/i }).click();
    if ((await resp).status() === 429) { console.log('   … sign-in rate limit, waiting a minute'); await page.waitForTimeout(62_000); continue; }
    await page.waitForURL((u) => !u.pathname.includes('/auth/'), { timeout: 30_000 });
    return { context, page };
  }
  throw new Error(`could not sign in as ${email}`);
}

/** Put a staff session into `role` with the sidebar's Switch Roles menu. */
async function ensureRole(page, role, menuLabel) {
  const current = await page.evaluate(() => JSON.parse(localStorage.getItem('active_account') || '{}').role);
  if (current === role) return;
  await page.getByRole('button', { name: /switch roles/i }).click();
  await page.getByRole('menuitem', { name: menuLabel }).click();
  await page.waitForTimeout(2500);
}

const token = (page) => page.evaluate(() => (localStorage.getItem('token') ?? '').replace(/^"|"$/g, ''));
const resultDoc = (id) => db.collection('results').findOne({ _id: new ObjectId(id) });
const lecturerId = async (email) => (await db.collection('lecturers').findOne({ email }))?._id;

/** Select the result's row on a Result Management tab, press `button`, confirm. */
async function act(page, tab, rowHint, button) {
  await page.goto(`${STAFF}/result-management`, { waitUntil: 'domcontentloaded' });
  await page.locator('app-segment-switcher').waitFor();
  await page.getByRole('button', { name: tab, exact: true }).click();
  const row = page.locator('tr', { hasText: COURSE }).filter({ hasText: rowHint }).first();
  await row.waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await row.locator('mat-checkbox').click();
  await page.getByRole('button', { name: button, exact: true }).click();
  const dialog = page.locator('mat-dialog-container');
  await dialog.waitFor({ timeout: 10_000 });
  await dialog.getByRole('button', { name: 'Confirm' }).click();
  await page.locator('app-toast').first().waitFor({ timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

try {
  // ── 0. Setup: the course, an unused session, and a roll entry to claim ──
  step(0, 'Setup');
  // A course with a coordinator, and a session from the intake year onwards
  // that has no result yet for this intake — a session before the students
  // were admitted would never show on their results page.
  const startYear = Number(INTAKE);
  const settings = await db.collection('schoolsettings').findOne({});
  const lastYear = Number(String(settings?.activeSession ?? `${startYear}/`).slice(0, 4));
  const sessions = [];
  for (let y = startYear; y <= Math.max(lastYear, startYear); y++) sessions.push(`${y}/${y + 1}`);
  const lecturer = await db.collection('lecturers').findOne({ email: LECTURER });
  const candidates = process.env.COURSE_CODE
    ? await db.collection('courses').find({ courseCode: COURSE_CODE }).toArray()
    : await db.collection('courses').find({ department: lecturer?.department, assignedTo: { $ne: null } }).toArray();
  let course = null;
  let session = null;
  for (const c of candidates) {
    if (!c.assignedTo) continue;
    for (const s of sessions) {
      if (!(await db.collection('results').findOne({ course: c._id, session: s, admissionYear: INTAKE }))) { course = c; session = s; break; }
    }
    if (course) break;
  }
  if (!course) throw new Error(`no course with a coordinator has a free session for the ${INTAKE} intake`);
  COURSE = course.courseCode;
  const ccEmail = process.env.CC ?? (await db.collection('lecturers').findOne({ _id: course.assignedTo }))?.email;
  CC_EMAIL = ccEmail;
  const dept = await db.collection('departments').findOne({ _id: course.department });
  const regNo = `E2E${Date.now().toString().slice(-8)}`;
  const studentEmail = `e2e.${regNo.toLowerCase()}@example.com`;
  const roll = await db.collection('students').insertOne({
    fullName: 'Ada E2E Student', registrationNumber: regNo, admissionYear: INTAKE, level: LEVEL,
    department: course.department, faculty: course.faculty, school: course.school,
    emailVerified: false, isActive: true, createdAt: new Date(), updatedAt: new Date(),
  });
  ok(`${COURSE} (coordinator ${CC_EMAIL}) · ${session} · ${INTAKE} intake · new roll entry ${regNo} (${dept?.name ?? 'department'})`);

  // ── 1. Student signs up and verifies the email ──
  step(1, 'Student signs up and verifies their email');
  const signUp = await fetch(`${API}/auth/students/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fullName: 'Ada E2E Student', registrationNumber: regNo, faculty: String(course.faculty),
      department: String(course.department), school: String(course.school), email: studentEmail,
      password: PASSWORD, confirmPassword: PASSWORD, level: LEVEL }),
  });
  check(signUp.ok, `sign-up accepted (${signUp.status})`, `sign-up refused: ${signUp.status} ${(await signUp.text()).slice(0, 200)}`);
  const code = (await db.collection('verifications').find({ userId: roll.insertedId }).sort({ _id: -1 }).limit(1).toArray())[0]?.token;
  check(!!code, 'verification code issued', 'no verification code found');
  const verify = await fetch(`${API}/auth/verify-email/${roll.insertedId}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: code }),
  });
  check(verify.ok, 'email verified', `verification refused: ${verify.status}`);
  const again = await fetch(`${API}/auth/students/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fullName: 'Intruder', registrationNumber: regNo, faculty: String(course.faculty),
      department: String(course.department), school: String(course.school), email: `intruder.${regNo}@example.com`,
      password: PASSWORD, confirmPassword: PASSWORD, level: LEVEL }),
  });
  check(again.status === 409, 'a second sign-up with the same reg number is refused (409)', `second sign-up was NOT refused: ${again.status}`);

  // ── 2. Lecturer creates the result and imports scores (UI) ──
  step(2, 'Lecturer creates the result and imports scores');
  const lect = await as('staff', LECTURER);
  await ensureRole(lect.page, 'LECTURER', /^lecturer/i);
  const auth = { authorization: `Bearer ${await token(lect.page)}`, 'content-type': 'application/json' };
  const created = await (await fetch(`${API}/results`, { method: 'POST', headers: auth, body: JSON.stringify({
    course: String(course._id), session, admissionYear: INTAKE, level: LEVEL, semester: course.semester,
    school: String(course.school), department: String(course.department), faculty: String(course.faculty), status: 'DRAFT' }) })).json();
  if (!created.status) throw new Error(`result not created: ${created.message}`);
  const resultId = created.data._id;
  ok(`result ${resultId}`);
  const classList = await db.collection('students').find({ school: course.school, department: course.department, admissionYear: INTAKE }).toArray();
  const rows = [[], [null, 'FEDERAL UNIVERSITY OF TECHNOLOGY, OWERRI'], [], ['SN', 'NAMES', 'REG. NO.', 'PROGRAM', 'TEST', 'LAB', 'EXAM', 'TOTAL', 'GRADE']];
  classList.forEach((s, i) => rows.push([i + 1, s.fullName, s.registrationNumber, dept?.code ?? '', 25, 0, 40 + (i % 5), 65 + (i % 5), '']));
  const sheet = join(mkdtempSync(join(tmpdir(), 'acheva-e2e-')), 'scores.xlsx');
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1'); XLSX.writeFile(wb, sheet);
  await lect.page.goto(`${STAFF}/my-result/upload-result?resultId=${resultId}`, { waitUntil: 'domcontentloaded' });
  await lect.page.getByText('Student Grade').waitFor();
  await lect.page.waitForTimeout(1500);
  await lect.page.getByRole('button', { name: /upload results/i }).click();
  await lect.page.locator('mat-dialog-container input[type=file]').setInputFiles(sheet);
  await lect.page.locator('mat-dialog-container').getByRole('button', { name: /confirm/i }).click();
  const imported = lect.page.locator('app-toast', { hasText: /Results Imported|Nothing Imported|Invalid/ }).first();
  await imported.waitFor({ timeout: 30_000 }).catch(() => {});
  const importText = (await imported.innerText().catch(() => '')).replace(/\s+/g, ' ');
  check(/Results Imported/.test(importText), importText, `import failed: ${importText || 'no message'}`);
  const entries = await db.collection('resultentries').countDocuments({ result: new ObjectId(resultId) });
  check(entries === classList.length, `${entries} scores recorded for ${classList.length} students`, `${entries} scores for ${classList.length} students`);

  // ── 3. Lecturer sends to the Course Coordinator (UI) ──
  step(3, 'Lecturer sends it to the Course Coordinator');
  await act(lect.page, 'Drafts', session, 'Send to CC');
  let r = await resultDoc(resultId);
  check(r.status === 'DRAFT' && r.hasBeenSent, 'with the Course Coordinator (DRAFT, sent)', `status ${r.status}, sent ${r.hasBeenSent}`);
  await lect.context.close();

  // ── 4. Course Coordinator approves (UI) ──
  step(4, 'Course Coordinator approves');
  const cc = await as('staff', CC_EMAIL);
  await ensureRole(cc.page, 'COURSE_COORDINATOR', /course coordinator/i);
  await cc.page.goto(`${STAFF}/result-management`, { waitUntil: 'domcontentloaded' });
  await cc.page.locator('tr.mat-mdc-row', { hasText: COURSE }).first().click();
  const ccRow = cc.page.locator('tr.mat-mdc-row', { hasText: `${INTAKE} intake` }).first();
  await ccRow.waitFor({ timeout: 30_000 });
  await cc.page.waitForTimeout(1500);
  await ccRow.locator('mat-checkbox input').check();
  await cc.page.getByRole('button', { name: 'Approve to HOD' }).click();
  await cc.page.locator('mat-dialog-container').getByRole('button').last().click();
  await cc.page.waitForTimeout(4000);
  r = await resultDoc(resultId);
  check(r.status === 'PENDING' && String(r.receivingHandler) === String(await lecturerId(HOD)), 'PENDING with the HOD', `status ${r.status}`);
  // Leave the account as a lecturer, as the next run's step 2 expects.
  await ensureRole(cc.page, 'LECTURER', /^lecturer/i).catch(() => {});
  await cc.context.close();

  // ── 5–8. HOD → Dean → HOD → Course Advisor publishes (UI) ──
  const chain = [
    [5, 'HOD approves (1st pass)', HOD, 'Pending', 'Approve to Dean', 'UNVERIFIED', DEAN],
    [6, 'Dean approves', DEAN, 'Unverified', 'Approve to HOD', 'VERIFIED', HOD],
    [7, 'HOD approves (2nd pass)', HOD, 'Verified', 'Approve', 'COMPLETE', CA],
    [8, 'Course Advisor publishes', CA, 'Complete', 'Publish', 'PUBLISHED', null],
  ];
  for (const [n, label, who, tab, button, expected, next] of chain) {
    step(n, label);
    const s = await as('staff', who);
    await act(s.page, tab, session, button);
    r = await resultDoc(resultId);
    const nextOk = !next || String(r.receivingHandler) === String(await lecturerId(next));
    check(r.status === expected && nextOk, `${expected}${next ? ` → ${next}` : ''}`, `status ${r.status} (expected ${expected})`);
    await s.context.close();
    if (r.status !== expected) break;
  }

  // ── 9. The student signs in and sees the grade (UI) ──
  step(9, 'Student signs in and sees the published grade');
  const stu = await as('student', studentEmail);
  await stu.page.goto(`${STUDENT}/results`, { waitUntil: 'domcontentloaded' });
  // Results are grouped by level; open the session that holds this one.
  const sessionEntry = stu.page.getByText(`${session} Academic Session`).first();
  await sessionEntry.waitFor({ timeout: 30_000 }).catch(() => {});
  await sessionEntry.click().catch(() => {});
  await stu.page.waitForTimeout(3000);
  const text = await stu.page.locator('body').innerText();
  check(new RegExp(COURSE.replace(' ', '\\s?')).test(text), `${COURSE} is on the student's results page`, `${COURSE} not visible to the student`);
  await stu.context.close();
} catch (error) {
  bad(`stopped: ${error.message}`);
} finally {
  if (consoleErrors.length) bad(`page errors: ${consoleErrors.slice(0, 5).join(' | ')}`);
  await browser.close();
  await mongo.close();
  console.log(failures ? `\nFAILED — ${failures} check(s) failed` : '\nPASSED — sign-up to publish works end to end');
  process.exit(failures ? 1 : 0);
}
