/**
 * What a department transfer looks like to the three people it touches, in
 * real browsers — the student, the advisor they leave and the one they join.
 *
 * The student signs in to the student portal BEFORE the transfer and keeps
 * that tab open throughout. The transfer is raised, approved and then carried
 * out by a real session rollover. Without anyone reloading:
 *
 *  - the student's open dashboard switches to the new department and level,
 *    and their profile names the new Course Advisor;
 *  - the receiving advisor's Students page lists them;
 *  - the old advisor's Students page no longer does.
 *
 * A rollover promotes the whole school, so every level, intake and the
 * session are snapshotted first and restored in a `finally`. Refuses to run
 * unless the database name contains "e2e" or "test".
 *
 *   TE_API=http://localhost:3100 TE_STAFF_APP=http://localhost:4210 \
 *     node scripts/transfer-effect-ui-harness.mjs
 *
 * Both apps are compiled against :3000; a TE_API elsewhere reroutes their
 * calls with `route.continue`, so the SSE stream still streams.
 */
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const backend = createRequire(new URL('../../acheva-nestjs/package.json', import.meta.url));
const { chromium } = require('playwright');
const mongoose = backend('mongoose');

const API = process.env.TE_API ?? 'http://localhost:3100';
const DB = process.env.TE_DB ?? 'AchevaDB_e2e';
const STUDENT_APP = process.env.TE_STUDENT_APP ?? 'http://localhost:4200';
const STAFF_APP = process.env.TE_STAFF_APP ?? 'http://localhost:4210';
const PASSWORD = process.env.TE_PASSWORD ?? 'Password8@';
const STUDENT = process.env.TE_STUDENT ?? 'sim.mth300.1@acheva.sim'; // Maths 300L, 2024
const OLD_CA = 'danielchinemerem302+21@gmail.com'; // Maths 300L
const PHYSICS_HOD = 'danielchinemerem302+4@gmail.com';
const ADMIN = 'members@acheva.app';
const PHYSICS_DEPT = '693d7c26e9ed492d7805c427';

if (!/e2e|test/i.test(DB)) {
  console.error(`Refusing to run against "${DB}" — this harness rolls a session over.`);
  process.exit(2);
}

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

/** Sign-in is rate limited per IP; wait the window out rather than fail. */
const signIn = async (email, path = '/auth/lecturers/signin') => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const r = await call('POST', path, null, { email, password: PASSWORD });
    if (r.status === 429) {
      console.log(`  (sign-in rate limit — waiting a minute before ${email})`);
      await new Promise((resolve) => setTimeout(resolve, 61_000));
      continue;
    }
    if (!r.body?.data?.accessToken) throw new Error(`sign-in ${email} → ${r.status}`);
    const { accessToken, refreshToken, ...account } = r.body.data;
    return { accessToken, refreshToken, account };
  }
  throw new Error(`sign-in for ${email} kept hitting the rate limit`);
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
      // Seed once — on a reload the app's own refreshed copy must survive.
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

const studentRowsFor = async (browser, session) => {
  const page = await (await newContext(browser, session)).newPage();
  await page.goto(`${STAFF_APP}/students`, { waitUntil: 'domcontentloaded' });
  await page.locator('tr[mat-row], app-empty-state').first().waitFor({ timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  const names = (await page.locator('tr[mat-row]').allInnerTexts()).map((row) => row.toLowerCase());
  return { page, names };
};

// ── Database: snapshot everything a rollover rewrites ──────────────────────
const env = readFileSync(new URL('../../acheva-nestjs/.env', import.meta.url), 'utf8');
const uri = env
  .match(/^DATABASE_URI=(.*)$/m)[1]
  .trim()
  .replace(/^["']|["']$/g, '')
  .replace(/\/AchevaDB(\?|$)/, `/${DB}$1`);
await mongoose.connect(uri);
const db = mongoose.connection;
const Students = db.collection('students');
const Lecturers = db.collection('lecturers');
const Settings = db.collection('schoolsettings');
const Transfers = db.collection('departmenttransfers');

const student = await Students.findOne({ email: STUDENT });
if (!student) throw new Error(`no student ${STUDENT}`);
const school = student.school;
const settings = await Settings.findOne({ school });
const [start] = settings.activeSession.split('/').map(Number);
const nextSession = `${start + 1}/${start + 2}`;

// Since 2026-11-09 a rollover also decides graduations and extra years and
// walks every advisor up a level with their set — all restored below.
const studentSnapshot = await Students.find({ school })
  .project({
    level: 1, department: 1, faculty: 1, admissionYear: 1, originalAdmissionYear: 1, transferredFrom: 1,
    academicStanding: 1, extraYear: 1, graduatedSession: 1, pendingSession: 1, standingClosedSession: 1,
  })
  .toArray();
const lecturerSnapshot = await Lecturers.find({ school })
  .project({ assignedLevel: 1, assignedLevelAdmissionYear: 1, extraYearIntakes: 1, setFollowedSession: 1, role: 1, otherRoles: 1 })
  .toArray();
const harnessStartedAt = new Date();
const settingsSnapshot = {
  activeSession: settings.activeSession,
  activeSemester: settings.activeSemester,
  registrationDeadline: settings.registrationDeadline ?? null,
};

mkdirSync('screenshots', { recursive: true });
const browser = await chromium.launch({ headless: true });
let transferId = null;
let rolloverAttempted = false;

try {
  const studentSession = await signIn(STUDENT, '/auth/students/signin');
  // Past the details gate, which has its own harness (test:admin-console-ui).
  studentSession.account.detailsRequired = false;
  const caSession = await signIn(OLD_CA);
  const hodSession = await signIn(PHYSICS_HOD);

  // ── The student's tab, open before anything happens ─────────────────────
  const studentPage = await (await newContext(browser, studentSession)).newPage();
  await studentPage.goto(`${STUDENT_APP}/dashboard`, { waitUntil: 'domcontentloaded' });
  await studentPage.getByText(/Department, \d{3} Level/).first().waitFor({ timeout: 30_000 });
  const headerBefore = await studentPage.getByText(/Department, \d{3} Level/).first().innerText();
  // "300 Level" since 2026-11-09 — the same label that reads "Extra Year 1".
  check('before: the student’s dashboard says Mathematics, 300 Level',
    /Mathematics/i.test(headerBefore) && /300 Level/.test(headerBefore), headerBefore);
  await studentPage.waitForTimeout(2500); // let the stream connect

  const before = await studentRowsFor(browser, caSession);
  check('before: the student is on the Maths 300L advisor’s list',
    before.names.some((row) => row.includes(student.fullName.toLowerCase())));
  await before.page.context().close();

  // ── Raise → send → approve (API; the screens for these have their own harness)
  const raised = await call('POST', '/transfers', caSession.accessToken, {
    student: String(student._id),
    toDepartment: PHYSICS_DEPT,
    toLevel: '200',
    letterBody: 'I write to request the transfer of this student to Physics, stepping back to 200 level.',
  });
  transferId = raised.body?.data?._id ?? null;
  await call('PATCH', `/transfers/${transferId}/submit`, caSession.accessToken);
  const approved = await call('PATCH', `/transfers/${transferId}/approve`, hodSession.accessToken, {});
  check('the transfer is approved and waits for the session to close',
    approved.body?.data?.status === 'APPROVED', `status=${approved.body?.data?.status}`);

  // ── The session closes ──────────────────────────────────────────────────
  const adminSession = await signIn(ADMIN, '/auth/admins/login');
  // The dashboard's dues and chart were loaded for Mathematics; once the move
  // lands they must be fetched again, not left showing the old department.
  // Generous: the window opens BEFORE the rollover is sent, and a rollover now
  // also decides every final-year standing and walks every advisor up — some
  // 30s from a laptop to the remote test database.
  const duesRefetched = studentPage
    .waitForRequest((request) => /\/transactions\/dues\/my-standing/.test(request.url()), {
      timeout: 120_000,
    })
    .then(() => true)
    .catch(() => false);
  rolloverAttempted = true;
  await Settings.updateOne({ school }, { $set: { registrationDeadline: new Date(`${start + 1}-10-15`) } });
  const rollover = await call('POST', `/school-settings/rollover?schoolId=${school}`, adminSession.accessToken, {
    fromSession: settings.activeSession,
    toSession: nextSession,
  });
  check('the session closes and carries the transfer out',
    rollover.body?.data?.transfersApplied === 1, `HTTP ${rollover.status} applied=${rollover.body?.data?.transfersApplied}`);

  // ── The student's SAME tab, never reloaded ──────────────────────────────
  await studentPage.getByText('Your department has changed').first().waitFor({ timeout: 25_000 }).catch(() => undefined);
  check('the student’s open portal tells them they have moved',
    (await studentPage.getByText('Your department has changed').count()) > 0);
  const headerAfter = await studentPage.getByText(/Department, \d{3} Level/).first().innerText();
  check('…and the dashboard now says Physics, 200 Level — without a reload',
    /Physics/i.test(headerAfter) && /200 Level/.test(headerAfter), headerAfter);
  check('…and its dues are fetched again for the new department', await duesRefetched);
  await studentPage.screenshot({ path: 'screenshots/transfer-student-dashboard.png' });

  await studentPage.goto(`${STUDENT_APP}/settings/profile`, { waitUntil: 'domcontentloaded' });
  // Wait for the PROFILE to load — the toolbar already says "Physics", so a
  // bare text wait returns before the page has any data.
  await studentPage
    .locator('app-profile')
    .getByText(/Department, \d{3}/)
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => undefined);
  const profileText = (await studentPage.locator('app-profile').innerText()).replace(/\s+/g, ' ');
  // Any advisor of the student's new set — the test seed has two Physics
  // advisors on one intake, which follow-the-set no longer hides.
  const newCas = await Lecturers.find({
    department: new mongoose.Types.ObjectId(PHYSICS_DEPT),
    assignedLevelAdmissionYear: String(start),
  }).toArray();
  const nameOf = (ca) => [ca?.firstname, ca?.lastname].filter(Boolean).join(' ');
  const newCa =
    newCas.find((ca) => nameOf(ca) && profileText.toLowerCase().includes(nameOf(ca).toLowerCase())) ?? newCas[0];
  const newCaName = nameOf(newCa);
  check('the student’s profile shows Physics at 200 level',
    /Physics Department, 200/i.test(profileText), profileText.match(/[A-Za-z ]+Department, \d{3}/)?.[0] ?? '');
  // The page title-cases names ("Refca-physics Routingtest").
  check('the student’s profile names their NEW Course Advisor',
    !!newCaName && profileText.toLowerCase().includes(newCaName.toLowerCase()),
    `expected "${newCaName}"`);
  await studentPage.screenshot({ path: 'screenshots/transfer-student-profile.png' });

  // ── The two advisors' Students pages ────────────────────────────────────
  const newCaSession = await signIn(newCa.email);
  const joined = await studentRowsFor(browser, newCaSession);
  check('the student is on the Physics advisor’s Students page',
    joined.names.some((row) => row.includes(student.fullName.toLowerCase())),
    `${joined.names.length} students listed for ${newCa.email}`);
  await joined.page.screenshot({ path: 'screenshots/transfer-new-ca-students.png' });

  const left = await studentRowsFor(browser, caSession);
  check('…and has left the Maths advisor’s Students page',
    !left.names.some((row) => row.includes(student.fullName.toLowerCase())),
    `${left.names.length} students listed`);
} catch (error) {
  check('the harness ran to completion', false, String(error).split('\n')[0]);
} finally {
  await browser.close();
  if (rolloverAttempted) {
    await Students.bulkWrite(
      studentSnapshot.map(({ _id, ...fields }) => ({
        updateOne: {
          filter: { _id },
          update: {
            $set: {
              level: fields.level,
              department: fields.department,
              faculty: fields.faculty,
              admissionYear: fields.admissionYear ?? null,
              originalAdmissionYear: fields.originalAdmissionYear ?? null,
              transferredFrom: fields.transferredFrom ?? [],
              academicStanding: fields.academicStanding ?? 'IN_PROGRAMME',
              extraYear: fields.extraYear ?? 0,
              graduatedSession: fields.graduatedSession ?? null,
              pendingSession: fields.pendingSession ?? null,
              standingClosedSession: fields.standingClosedSession ?? null,
            },
          },
        },
      }))
    );
    await Lecturers.bulkWrite(
      lecturerSnapshot.map(({ _id, ...fields }) => ({
        updateOne: {
          filter: { _id },
          update: {
            $set: {
              assignedLevel: fields.assignedLevel ?? 'NONE',
              assignedLevelAdmissionYear: fields.assignedLevelAdmissionYear ?? null,
              extraYearIntakes: fields.extraYearIntakes ?? [],
              setFollowedSession: fields.setFollowedSession ?? null,
              role: fields.role,
              otherRoles: fields.otherRoles ?? [],
            },
          },
        },
      }))
    );
    await Settings.updateOne({ school }, { $set: settingsSnapshot });
    await db.collection('advisedsets').deleteMany({ createdAt: { $gte: harnessStartedAt } });
    await db.collection('notifications').deleteMany({
      createdAt: { $gte: harnessStartedAt },
      'meta.type': { $in: ['standing', 'advising'] },
    });
  }
  if (transferId) await Transfers.deleteOne({ _id: new mongoose.Types.ObjectId(transferId) });
  const back = await Students.findOne({ _id: student._id });
  console.log(`\nrestored: session=${(await Settings.findOne({ school })).activeSession} level=${back.level} intake=${back.admissionYear}`);
  await mongoose.disconnect();
  console.log(failures === 0 ? 'All transfer-effect checks passed.' : `${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}
