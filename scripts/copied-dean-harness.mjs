/**
 * The Dean is copied when a result reaches another department's Head —
 * against a REAL server, database and staff app.
 *
 * The user's rule (2026-11-10), for accountability: when a course is taken by
 * another department's students, the course department's Head sends the
 * approved result to the Head of the students' department (status APPROVED).
 * That Head's Dean is copied — an in-app notice, an email saying a result was
 * sent to a department in their faculty, and the result in their Approved tab
 * to follow. They approve nothing.
 *
 * Only an EXTERNAL Dean is copied: when the students' department is in the
 * course's own faculty, its Dean verified the result and is not copied. The
 * test data keeps every department in one faculty, so the run first checks
 * exactly that, then stages a second faculty with its own Dean, moves the
 * students' department into it and checks the copy. Everything is put back
 * in a `finally`. Refuses to run unless the database name contains "e2e" or
 * "test".
 *
 *   CD_API=http://localhost:3100 CD_STAFF_APP=http://localhost:4210 \
 *     node scripts/copied-dean-harness.mjs
 *
 * The API must run with EMAIL_DELIVERY=log, its output in CD_LOG, so the
 * delivered subject can be read back.
 */
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';

const backend = createRequire(new URL('../../acheva-nestjs/package.json', import.meta.url));
const mongoose = backend('mongoose');

const API = process.env.CD_API ?? 'http://localhost:3100';
const STAFF_APP = process.env.CD_STAFF_APP ?? 'http://localhost:4210';
const DB = process.env.CD_DB ?? 'AchevaDB_e2e';
const PASSWORD = process.env.CD_PASSWORD ?? 'Password8@';
const LOG = process.env.CD_LOG ?? '';
const SHOTS = process.env.CD_SHOTS ?? '';

if (!/e2e|test/i.test(DB)) {
  console.error(`Refusing to run against "${DB}" — use a test database.`);
  process.exit(2);
}

const env = readFileSync(new URL('../../acheva-nestjs/.env', import.meta.url), 'utf8');
const uri = env
  .match(/^DATABASE_URI=(.*)$/m)[1]
  .trim()
  .replace(/^["']|["']$/g, '')
  .replace(/\/AchevaDB(\?|$)/, `/${DB}$1`);

let failures = 0;
const check = (name, pass, detail = '') => {
  if (!pass) failures += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const call = async (method, path, token, body) => {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const signIn = async (email) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const r = await call('POST', '/auth/lecturers/signin', null, { email, password: PASSWORD });
    if (r.status === 429) {
      console.log(`  (sign-in rate limit — waiting a minute before ${email})`);
      await new Promise((resolve) => setTimeout(resolve, 61_000));
      continue;
    }
    if (!r.body?.data?.accessToken) throw new Error(`sign-in ${email} → ${r.status} ${r.body?.message ?? ''}`);
    return r.body.data;
  }
  throw new Error(`sign-in for ${email} kept hitting the rate limit`);
};

/** A member of staff in a given office, switching into it first if need be. */
const staffSession = async (email, role) => {
  const session = await signIn(email);
  if (session.role === role) return session;
  await call('PATCH', '/auth/lecturers/switch-role', session.accessToken, { role });
  return signIn(email);
};

/** Poll until `done()` is true or the time runs out — never a fixed sleep. */
const waitFor = async (done, timeoutMs = 40_000) => {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (await done()) return true;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return false;
};

await mongoose.connect(uri);
const db = mongoose.connection;
const Results = db.collection('results');
const Courses = db.collection('courses');
const Lecturers = db.collection('lecturers');
const Faculties = db.collection('faculties');
const Departments = db.collection('departments');
const Outbox = db.collection('emailoutbox');
const Notifications = db.collection('notifications');

// ── A result for another department's students ──────────────────────────────
// Its course department has a Head and a Dean (who verified it), and the
// students' department has a Head and a Course Advisor for the cohort.
let picked = null;
for (const result of await Results.find({ uploadedBy: { $ne: null } }).toArray()) {
  const course = await Courses.findOne({ _id: result.course });
  if (!course || String(course.department) === String(result.department)) continue;
  const [courseHod, studentsHod, courseDean, advisor] = await Promise.all([
    Lecturers.findOne({ department: course.department, accessLevel: 'HOD', school: result.school }),
    Lecturers.findOne({ department: result.department, accessLevel: 'HOD', school: result.school }),
    Lecturers.findOne({ faculty: course.faculty, accessLevel: 'DEAN', school: result.school }),
    Lecturers.findOne({
      department: result.department,
      school: result.school,
      assignedLevel: result.level,
      $or: [{ role: 'COURSE_ADVISOR' }, { otherRoles: 'COURSE_ADVISOR' }],
    }),
  ]);
  if (courseHod?.email && studentsHod?.email && courseDean?.email && advisor?.email) {
    picked = { result, course, courseHod, studentsHod, courseDean, advisor };
    break;
  }
}
if (!picked) throw new Error('no result for another department’s students with both Heads, a Dean and an advisor');

const { result, course, courseHod, studentsHod, courseDean, advisor } = picked;
const studentsDepartment = await Departments.findOne({ _id: result.department });
const originalFaculty = await Faculties.findOne({ _id: studentsDepartment.faculty });
console.log(
  `result: ${course.courseCode} (${result.session}) · course Head ${courseHod.email} → students' Head ${studentsHod.email} (${studentsDepartment.name})\n`,
);

// ── Stage: the students' department in a faculty of its own ─────────────────
const stamp = Date.now().toString(36);
const tempFacultyId = new mongoose.Types.ObjectId();
const tempDeanId = new mongoose.Types.ObjectId();
const tempDeanEmail = `dean.copied.${stamp}@acheva.test`;
const { _id: _f, ...facultyFields } = originalFaculty;
await Faculties.insertOne({
  ...facultyFields,
  _id: tempFacultyId,
  name: `Copied Dean Test Faculty ${stamp}`,
  code: `CD${stamp.slice(-4).toUpperCase()}`,
});
// A Dean account like the real one — same password hash — in the new faculty.
const { _id: _d, ...deanFields } = courseDean;
await Lecturers.insertOne({
  ...deanFields,
  _id: tempDeanId,
  email: tempDeanEmail,
  firstname: null,
  middlename: null,
  lastname: null,
  masterUserId: null,
  faculty: tempFacultyId,
  role: 'DEAN',
  accessLevel: 'DEAN',
});

/** The result on the course department's Head's desk for the second pass, verified by their own Dean. */
const onSecondPass = (extra = {}) =>
  Results.updateOne(
    { _id: result._id },
    {
      $set: {
        status: 'VERIFIED',
        hasBeenSent: true,
        currentHandler: courseDean._id,
        receivingHandler: courseHod._id,
        lastAction: 'FORWARDED',
        approvedBy: courseDean._id,
        copiedDeans: [],
        ...extra,
      },
    },
  );

const startedAt = new Date();
let externalStartedAt = startedAt;
const deanCopies = () =>
  Notifications.countDocuments({ recipient: tempDeanId, relatedResult: result._id, createdAt: { $gte: startedAt } });
const deanEmails = () =>
  Outbox.find({ recipient: tempDeanId, 'resultMovement.result': result._id, createdAt: { $gte: startedAt } }).toArray();

let browser;
try {
  const hodToken = (await staffSession(courseHod.email, 'HOD')).accessToken;

  // ── Same faculty: the Dean who verified it is not copied ──────────────────
  if (String(studentsDepartment.faculty) === String(course.faculty)) {
    await onSecondPass();
    const sameStartedAt = new Date();
    const approvedSame = await call('PATCH', `/results/${result._id}/approve`, hodToken, { action: 'APPROVED' });
    const sentSame = await call('PATCH', `/results/${result._id}/send/${studentsHod._id}?role=HOD`, hodToken);
    check('same faculty: the Head approves it and sends it to the students’ Head',
      approvedSame.status === 200 && sentSame.status === 200,
      `HTTP ${approvedSame.status} / ${sentSame.status}`);
    const sameAfter = await Results.findOne({ _id: result._id });
    check('…the faculty’s own Dean is not copied', (sameAfter.copiedDeans ?? []).length === 0,
      JSON.stringify(sameAfter.copiedDeans));
    const sameNotes = await Notifications.countDocuments({
      recipient: courseDean._id, relatedResult: result._id, createdAt: { $gte: sameStartedAt },
    });
    check('…gets no notice', sameNotes === 0, `${sameNotes}`);
    const sameEmails = await Outbox.countDocuments({
      recipient: courseDean._id, 'resultMovement.result': result._id, createdAt: { $gte: sameStartedAt },
    });
    check('…and no email', sameEmails === 0, `${sameEmails}`);
  } else {
    console.log('(the students are already in another faculty — same-faculty check skipped)');
  }

  // ── Another faculty: the students' department moves into the staged one ──
  await Departments.updateOne({ _id: studentsDepartment._id }, { $set: { faculty: tempFacultyId } });
  await Lecturers.updateOne({ _id: studentsHod._id }, { $set: { faculty: tempFacultyId } });
  await onSecondPass({ faculty: tempFacultyId });
  externalStartedAt = new Date();

  // ── The course department's Head approves and sends it on ─────────────────
  const approved = await call('PATCH', `/results/${result._id}/approve`, hodToken, { action: 'APPROVED' });
  check('the course department’s Head approves it', approved.status === 200,
    `HTTP ${approved.status} ${approved.body?.message ?? ''}`);
  const statusNow = (await Results.findOne({ _id: result._id }))?.status;
  check('…and it becomes APPROVED (another department’s students)', statusNow === 'APPROVED', statusNow);

  const sent = await call('PATCH', `/results/${result._id}/send/${studentsHod._id}?role=HOD`, hodToken);
  check('…and sends it to the students’ department Head', sent.status === 200,
    `HTTP ${sent.status} ${sent.body?.message ?? ''}`);

  // ── The Dean of that Head's faculty is copied ─────────────────────────────
  const after = await Results.findOne({ _id: result._id });
  check('the receiving Head’s Dean is recorded on the result',
    (after.copiedDeans ?? []).some((id) => String(id) === String(tempDeanId)),
    JSON.stringify(after.copiedDeans));
  check('…and only that Dean — not the course’s Dean',
    (after.copiedDeans ?? []).length === 1, `${(after.copiedDeans ?? []).length} copied`);
  check('the chain is unchanged: the students’ Head holds it',
    String(after.receivingHandler) === String(studentsHod._id));

  const note = await Notifications.findOne({ recipient: tempDeanId, relatedResult: result._id, createdAt: { $gte: startedAt } });
  check('the Dean gets an in-app notice', !!note, note?.message);
  check('…saying it went to a department in their faculty',
    /in your faculty/.test(note?.message ?? '') && note?.message?.includes(studentsDepartment.name),
    note?.message);
  check('…that opens the result in its Approved state',
    note?.meta?.type === 'result' && note?.meta?.status === 'APPROVED', JSON.stringify(note?.meta));

  const emailed = await waitFor(async () => (await deanEmails()).some((row) => row.status === 'SENT'));
  const [emailRow] = await deanEmails();
  check('the Dean is emailed', emailed, `status=${emailRow?.status} to=${emailRow?.to}`);
  check('…as a COPY, not as work to do', emailRow?.resultMovement?.movement === 'COPIED',
    emailRow?.resultMovement?.movement);
  check('…naming the department it went to',
    emailRow?.resultMovement?.note?.includes(`the Head of ${studentsDepartment.name}, a department in your faculty`),
    emailRow?.resultMovement?.note);
  if (LOG) {
    const log = readFileSync(LOG, 'utf8');
    check('…delivered with a "Copied to you" subject',
      log.includes(`to=${tempDeanEmail} subject="Copied to you: ${course.courseCode}`),
      'see the API log');
  }

  const hodEmail = await Outbox.findOne({ recipient: studentsHod._id, 'resultMovement.result': result._id, createdAt: { $gte: externalStartedAt } });
  check('the students’ Head still gets their own email to review it',
    hodEmail?.resultMovement?.movement === 'APPROVED', hodEmail?.resultMovement?.movement);

  // ── What the Dean sees ───────────────────────────────────────────────────
  const dean = await signIn(tempDeanEmail);
  const approvedTab = await call('GET', '/results?status=APPROVED', dean.accessToken);
  const inTab = (approvedTab.body?.data?.result ?? []).find((row) => String(row._id) === String(result._id));
  check('it is in the Dean’s Approved tab', !!inTab, `HTTP ${approvedTab.status}, ${approvedTab.body?.data?.total} row(s)`);

  const counts = await call('GET', '/results/status-counts', dean.accessToken);
  check('…and counted on their dashboard', (counts.body?.data?.statusCounts?.APPROVED ?? 0) >= 1,
    JSON.stringify(counts.body?.data?.statusCounts));

  const opened = await call('GET', `/results/${result._id}`, dean.accessToken);
  check('the Dean can open it and read every student', opened.status === 200 && opened.body?.data?.viewerScope?.access === 'FULL',
    `HTTP ${opened.status} ${JSON.stringify(opened.body?.data?.viewerScope)}`);

  const refusedApprove = await call('PATCH', `/results/${result._id}/approve`, dean.accessToken, { action: 'APPROVED' });
  check('…but cannot approve it', refusedApprove.status >= 400, `HTTP ${refusedApprove.status}`);
  const refusedReject = await call('PATCH', `/results/${result._id}/reject`, dean.accessToken, { action: 'REJECTED', comment: 'Not mine to reject.' });
  check('…or reject it', refusedReject.status >= 400, `HTTP ${refusedReject.status}`);
  check('…and the attempts changed nothing', (await Results.findOne({ _id: result._id }))?.status === 'APPROVED');

  // ── A resend tells the Dean nothing new ───────────────────────────────────
  const resent = await call('PATCH', `/results/${result._id}/send/${studentsHod._id}?role=HOD`, hodToken);
  check('the Head resends it', resent.status === 200, `HTTP ${resent.status}`);
  check('…and the Dean is told once, not twice', (await deanCopies()) === 1, `${await deanCopies()} notices`);
  check('…with one email', (await deanEmails()).length === 1, `${(await deanEmails()).length} rows`);

  // ── The staff app ─────────────────────────────────────────────────────────
  browser = await chromium.launch();
  const { accessToken, refreshToken, ...account } = dean;
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
    [accessToken, refreshToken ?? accessToken, JSON.stringify(account)],
  );
  const page = await context.newPage();

  await page.goto(`${STAFF_APP}/result-management?tab=APPROVED`, { waitUntil: 'domcontentloaded' });
  const row = page.locator('tr.mat-mdc-row').filter({ hasText: course.courseCode }).first();
  const rowShown = await row.waitFor({ timeout: 20_000 }).then(() => true, () => false);
  check('the Dean’s Approved tab lists it in the browser', rowShown);
  check('…marked "Copied to you"', rowShown && (await row.innerText()).includes('Copied to you'));
  const deanButtons = await page.locator('app-button').filter({ hasText: /^\s*Approve\s*$/ }).count();
  check('…with no Approve button on the tab', deanButtons === 0, `${deanButtons}`);
  const checkboxDisabled = rowShown && (await row.locator('input[type="checkbox"]').isDisabled());
  check('…and the row cannot be selected for an action', checkboxDisabled);
  const marker = row.getByText('Copied to you');
  const markerColour = rowShown ? await marker.evaluate((el) => getComputedStyle(el).color) : '';
  check('…in brand blue', markerColour === 'rgb(39, 147, 255)', markerColour);
  if (SHOTS) {
    mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: `${SHOTS}/dean-approved-tab.png` });
  }

  await page.goto(`${STAFF_APP}/result-management/edit-results?resultId=${result._id}&status=APPROVED`, {
    waitUntil: 'domcontentloaded',
  });
  const pill = page.getByText('View only — copied to you: sent to a department in your faculty');
  check('the result page says it is a copy, view only',
    await pill.waitFor({ timeout: 20_000 }).then(() => true, () => false));
  // Count only once the students have loaded — a skeleton has no inputs either.
  const gradesShown = await page
    .locator('table tr.mat-mdc-row, table tbody tr')
    .first()
    .waitFor({ timeout: 20_000 })
    .then(() => true, () => false);
  await page.locator('app-skeleton-table').first().waitFor({ state: 'detached', timeout: 20_000 }).catch(() => undefined);
  const students = await page.locator('table tbody tr').count();
  const editable = await page.locator('table input').count();
  check('…listing the students’ grades', gradesShown && students > 0, `${students} rows`);
  check('…with no score fields to edit', gradesShown && editable === 0, `${editable} inputs`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/dean-result-page.png` });

  // ── The Dean can follow it on to Complete ─────────────────────────────────
  const hod2Token = (await staffSession(studentsHod.email, 'HOD')).accessToken;
  const approved2 = await call('PATCH', `/results/${result._id}/approve`, hod2Token, { action: 'APPROVED' });
  check('the students’ Head approves it', approved2.status === 200,
    `HTTP ${approved2.status} ${approved2.body?.message ?? ''}`);
  const sent2 = await call('PATCH', `/results/${result._id}/send/${advisor._id}?role=COURSE_ADVISOR`, hod2Token);
  check('…and sends it to the Course Advisor', sent2.status === 200, `HTTP ${sent2.status}`);
  const completeTab = await call('GET', '/results?status=COMPLETE', dean.accessToken);
  check('the Dean finds it in their Complete tab',
    (completeTab.body?.data?.result ?? []).some((row) => String(row._id) === String(result._id)));
  check('…and was not copied again', (await deanCopies()) === 1, `${await deanCopies()} notices`);
} catch (error) {
  check('the harness ran to completion', false, String(error?.stack ?? error).split('\n').slice(0, 3).join(' | '));
} finally {
  await browser?.close();
  // ── Put everything back ───────────────────────────────────────────────────
  await Results.replaceOne({ _id: result._id }, result);
  await Departments.updateOne({ _id: studentsDepartment._id }, { $set: { faculty: studentsDepartment.faculty } });
  await Lecturers.updateOne({ _id: studentsHod._id }, { $set: { faculty: studentsHod.faculty } });
  if (courseHod.role !== 'HOD') {
    await Lecturers.updateOne({ _id: courseHod._id }, { $set: { role: courseHod.role, otherRoles: courseHod.otherRoles ?? [] } });
  }
  if (studentsHod.role !== 'HOD') {
    await Lecturers.updateOne({ _id: studentsHod._id }, { $set: { role: studentsHod.role, otherRoles: studentsHod.otherRoles ?? [] } });
  }
  await Lecturers.deleteOne({ _id: tempDeanId });
  await Faculties.deleteOne({ _id: tempFacultyId });
  const outboxGone = await Outbox.deleteMany({ 'resultMovement.result': result._id, createdAt: { $gte: startedAt } });
  const notesGone = await Notifications.deleteMany({ relatedResult: result._id, createdAt: { $gte: startedAt } });
  console.log(
    `\nrestored the result, department and Head; removed the staged faculty and Dean, ${outboxGone.deletedCount} outbox rows, ${notesGone.deletedCount} notifications`,
  );
  await mongoose.disconnect();
  console.log(failures === 0 ? 'All copied-Dean checks passed.' : `${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}
