/**
 * "Nothing here yet" is not an error (the user, 2026-11-10).
 *
 * Opening a page that simply has no data — a department with no results, a
 * university with no session yet — used to raise red toasts. This harness
 * builds a brand-new university on the TEST database (school, faculty, one
 * empty department, a member of staff in every office and one student),
 * signs each of them in, opens every page of their app, and records every
 * toast and every failed request. It runs twice: before the university has
 * an active session, and after.
 *
 * Every page should load quietly. A toast or a 4xx/5xx is a finding.
 *
 *   EP_API=http://localhost:3100 EP_STAFF_APP=http://localhost:4210 \
 *   EP_STUDENT_APP=http://localhost:4401 node scripts/empty-pages-harness.mjs
 *
 * Everything it creates is deleted at the end; it refuses to run unless the
 * database name contains "e2e" or "test".
 */
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';

const backend = createRequire(new URL('../../acheva-nestjs/package.json', import.meta.url));
const mongoose = backend('mongoose');

const API = process.env.EP_API ?? 'http://localhost:3100';
const STAFF_APP = process.env.EP_STAFF_APP ?? 'http://localhost:4210';
const STUDENT_APP = process.env.EP_STUDENT_APP ?? 'http://localhost:4401';
const DB = process.env.EP_DB ?? 'AchevaDB_e2e';
const SHOTS = process.env.EP_SHOTS ?? '/tmp/empty-pages-shots';
const PASSWORD = 'Password8@';
const TEMPLATE_ACCOUNT = 'danielchinemerem302+1@gmail.com'; // only its password hash is borrowed
const WAIT_MS = Number(process.env.EP_WAIT_MS ?? 3500);

/**
 * Each office's own pages — what its menu offers (`@core/constant/menu.ts`).
 * Typing in another office's page is bounced, rightly, with a toast saying
 * so; that is not an empty page, so it is not visited.
 */
const EVERYONE = ['dashboard', 'result-management', 'messages', 'history', 'notifications', 'support'];
const STAFF_ROUTES = {
  HOD: [...EVERYONE, 'school-fees', 'moderation', 'transfers', 'dues-management', 'user-settings'],
  DEAN: [...EVERYONE, 'moderation', 'transfers'],
  COURSE_ADVISOR: [
    ...EVERYONE, 'students', 'extra-year', 'advised-sets', 'school-fees', 'registration', 'moderation', 'transfers',
  ],
  COURSE_COORDINATOR: [...EVERYONE],
  LECTURER: [...EVERYONE, 'courses', 'my-result', 'moderation'],
};
const STUDENT_ROUTES = [
  'dashboard', 'results', 'registration', 'messages', 'school-fees', 'dues',
  'payment-history', 'support', 'settings/profile', 'notifications',
];

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
    if (!r.body?.data?.accessToken) throw new Error(`sign-in ${email} → ${r.status} ${JSON.stringify(r.body?.message)}`);
    return r.body.data;
  }
  throw new Error(`sign-in for ${email} kept hitting the rate limit`);
};

await mongoose.connect(uri, { serverSelectionTimeoutMS: 30_000 });
const db = mongoose.connection;
const Lecturers = db.collection('lecturers');
const Students = db.collection('students');
const stamp = Date.now().toString(36);
const created = { school: null, faculty: null, department: null, lecturers: [], student: null };
const findings = [];

const passwordHash = (await Lecturers.findOne({ email: TEMPLATE_ACCOUNT })).password;

/** A browser signed in as `session`, with the apps' :3000 calls sent to the test API. */
const contextFor = async (browser, session, storageExtra = {}) => {
  const { accessToken, refreshToken, ...account } = session;
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
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
      // Every toast that appears, whatever it says, for the harness to read.
      window.__toasts = [];
      new MutationObserver(() => {
        for (const node of document.querySelectorAll('mat-snack-bar-container, .mat-mdc-snack-bar-container')) {
          if (node.dataset.seen) continue;
          node.dataset.seen = '1';
          setTimeout(() => window.__toasts.push(node.innerText.replace(/\s+/g, ' ').trim()), 150);
        }
      }).observe(document, { childList: true, subtree: true });
    },
    [accessToken, refreshToken ?? accessToken, JSON.stringify({ ...account, ...storageExtra })],
  );
  return context;
};

/** Open every route as one person and note anything that complains. */
const sweep = async (browser, label, app, routes, session, storageExtra) => {
  const context = await contextFor(browser, session, storageExtra);
  const page = await context.newPage();
  let failed = [];
  page.on('response', (r) => {
    if (!/localhost:(3000|3100)/.test(r.url()) || r.status() < 400) return;
    if (r.request().headers()['x-silent-error']) return;
    failed.push(`${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, '').split('?')[0]}`);
  });
  for (const route of routes) {
    failed = [];
    try {
      await page.goto(`${app}/${route}`, { waitUntil: 'domcontentloaded', timeout: 40_000 });
      await page.waitForTimeout(WAIT_MS);
    } catch (error) {
      findings.push(`${label} /${route}: did not load — ${String(error).slice(0, 80)}`);
      continue;
    }
    const toasts = await page.evaluate(() => {
      const seen = window.__toasts ?? [];
      window.__toasts = [];
      return seen;
    });
    const where = page.url().replace(app, '');
    for (const toast of new Set(toasts)) findings.push(`${label} /${route} (at ${where}): TOAST "${toast.slice(0, 140)}"`);
    for (const request of new Set(failed)) findings.push(`${label} /${route} (at ${where}): ${request}`);
    if (toasts.length) {
      await page.screenshot({ path: `${SHOTS}/${label.replace(/\W+/g, '-')}-${route.replace(/\W+/g, '-')}.png` }).catch(() => undefined);
    }
  }
  await context.close();
};

const browser = await chromium.launch();
try {
  // ── A new university with nothing in it ──────────────────────────────────
  const now = new Date();
  created.school = (
    await db.collection('schools').insertOne({
      name: `Empty Pages University ${stamp}`,
      acronym: 'EPU',
      address: 'Nowhere',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  ).insertedId;
  created.faculty = (
    await db.collection('faculties').insertOne({
      name: 'Faculty of Nothing Yet',
      code: `F${stamp}`.toUpperCase().slice(0, 8),
      school: created.school,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  ).insertedId;
  created.department = (
    await db.collection('departments').insertOne({
      name: 'Department of Nothing Yet',
      code: `D${stamp}`.toUpperCase().slice(0, 8),
      faculty: created.faculty,
      isActive: true,
      options: [],
      createdAt: now,
      updatedAt: now,
    })
  ).insertedId;

  const offices = [
    { role: 'HOD', accessLevel: 'HOD' },
    { role: 'DEAN', accessLevel: 'DEAN' },
    { role: 'COURSE_ADVISOR', accessLevel: 'LECTURER', assignedLevel: '100', assignedLevelAdmissionYear: '2025' },
    { role: 'COURSE_COORDINATOR', accessLevel: 'LECTURER' },
    { role: 'LECTURER', accessLevel: 'LECTURER' },
  ];
  for (const office of offices) {
    const email = `empty.${office.role.toLowerCase()}.${stamp}@example.com`;
    await Lecturers.insertOne({
      titles: [],
      firstname: 'Empty',
      lastname: office.role.replace('_', ' '),
      email,
      password: passwordHash,
      faculty: created.faculty,
      department: created.department,
      school: created.school,
      emailVerified: true,
      isActive: true,
      role: office.role,
      otherRoles: [],
      accountType: 'LECTURER',
      assignedLevel: office.assignedLevel ?? 'NONE',
      assignedLevelAdmissionYear: office.assignedLevelAdmissionYear ?? null,
      accessLevel: office.accessLevel,
      extraYearIntakes: [],
      setFollowedSession: null,
      refreshTokens: [],
      createdAt: now,
      updatedAt: now,
    });
    created.lecturers.push({ email, role: office.role });
  }
  const studentEmail = `empty.student.${stamp}@example.com`;
  created.student = (
    await Students.insertOne({
      fullName: 'Empty Pages Student',
      registrationNumber: `EP${stamp}`.toUpperCase(),
      email: studentEmail,
      password: passwordHash,
      admissionYear: '2025',
      level: '100',
      department: created.department,
      faculty: created.faculty,
      school: created.school,
      emailVerified: true,
      isActive: true,
      accountType: 'STUDENT',
      academicStanding: 'IN_PROGRAMME',
      extraYear: 0,
      transferredFrom: [],
      sex: 'FEMALE',
      dateOfBirth: new Date('2006-02-03'),
      nationality: 'Nigerian',
      stateOfOrigin: 'Imo',
      modeOfEntry: 'UTME',
      programmeOption: null,
      programmeOptionId: null,
      refreshTokens: [],
      createdAt: now,
      updatedAt: now,
    })
  ).insertedId;

  for (const phase of ['no session yet', 'session open']) {
    if (phase === 'session open') {
      await db.collection('schoolsettings').insertOne({
        school: created.school,
        activeSession: '2025/2026',
        activeSemester: '1ST SEMESTER',
        registrationGraceDays: 14,
        registrationDeadline: null,
        registrationGate: 'AUTO',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    console.log(`\n── ${phase} ──`);
    for (const { email, role } of created.lecturers) {
      const session = await signIn('/auth/lecturers/signin', email);
      await sweep(browser, `${phase} · ${role}`, STAFF_APP, STAFF_ROUTES[role], session);
    }
    const student = await signIn('/auth/students/signin', studentEmail);
    await sweep(browser, `${phase} · STUDENT`, STUDENT_APP, STUDENT_ROUTES, student, { detailsRequired: false });
  }
} catch (error) {
  findings.push(`harness crashed — ${String(error?.stack ?? error).split('\n').slice(0, 4).join(' | ')}`);
} finally {
  await browser.close();
  await db.collection('schoolsettings').deleteMany({ school: created.school });
  await Lecturers.deleteMany({ email: { $in: created.lecturers.map((row) => row.email) } });
  if (created.student) await Students.deleteOne({ _id: created.student });
  if (created.department) await db.collection('departments').deleteOne({ _id: created.department });
  if (created.faculty) await db.collection('faculties').deleteOne({ _id: created.faculty });
  if (created.school) await db.collection('schools').deleteOne({ _id: created.school });
  console.log(`\n${findings.length} finding(s):`);
  for (const finding of findings) console.log(`  ${finding}`);
  console.log(`\nremoved the test university; screenshots of toasts in ${SHOTS}`);
  await mongoose.disconnect();
  process.exit(findings.length ? 1 : 0);
}
