/**
 * School fees in real browsers, all three apps (2026-11-09).
 *
 *  Admin console — Acheva adds Maths' options in a dialog, then on School
 *  Fees sets two payment dates, the Maths fee for every level (one typed,
 *  the rest filled from it) and a dearer Statistics fee at 400, saves and
 *  publishes.
 *
 *  Student portal — the student is held on their details until they choose
 *  an option from the list; registration tells them it is waiting on their
 *  fees and links to them; the School Fees page shows their option's fee,
 *  refuses a token amount and opens Paystack for a real one. Once Paystack's
 *  signed webhook settles it, the page says first semester is open to them.
 *
 *  Staff portal — the Head sees the department's counts and finds the
 *  student under "Part paid"; the Course Advisor sees only their students.
 *
 *  Receipts (2026-11-10) — online, the button includes Paystack's charge,
 *  paid on top. A payment made at the bank is uploaded on its own page (two
 *  files, RRR, amount) and counts at once; the Head opens it from the list;
 *  Acheva rejects it in the admin console and it stops counting. The API
 *  must run with `STORAGE_DRIVER=local` (or a bucket).
 *
 *   SU_API=http://localhost:3100 SU_ADMIN_APP=http://localhost:4301 \
 *   SU_STAFF_APP=http://localhost:4210 SU_STUDENT_APP=http://localhost:4401 \
 *   node scripts/school-fees-ui-harness.mjs
 *
 * Test database only; everything it writes is removed afterwards. Paystack's
 * TEST API sometimes refuses new subaccounts, so the university's payout
 * account is staged on the sandbox subaccount Maths already has — the
 * account dialog itself is covered by `npm run test:school-fees`.
 */
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';

const backend = createRequire(new URL('../../acheva-nestjs/package.json', import.meta.url));
const mongoose = backend('mongoose');

const API = process.env.SU_API ?? 'http://localhost:3100';
const ADMIN_APP = process.env.SU_ADMIN_APP ?? 'http://localhost:4301';
const STAFF_APP = process.env.SU_STAFF_APP ?? 'http://localhost:4210';
const STUDENT_APP = process.env.SU_STUDENT_APP ?? 'http://localhost:4401';
const DB = process.env.SU_DB ?? 'AchevaDB_e2e';
const SHOTS = process.env.SU_SHOTS ?? '/tmp/school-fees-shots';
const PASSWORD = 'Password8@';
const ADMIN = 'members@acheva.app';
const HOD = 'danielchinemerem302+1@gmail.com';
const ADVISOR = 'danielchinemerem302+22@gmail.com'; // Maths 400, 2023 set
const STUDENT = process.env.SU_STUDENT ?? 'e2e.e2e47645069@example.com'; // no registration yet this semester
const MATHS = '693d7c1ee9ed492d7805c422';

if (!/e2e|test/i.test(DB)) {
  console.error(`Refusing to run against "${DB}" — use a test database.`);
  process.exit(2);
}
mkdirSync(SHOTS, { recursive: true });

const env = readFileSync(new URL('../../acheva-nestjs/.env', import.meta.url), 'utf8');
const read = (key) => env.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1].trim().replace(/^["']|["']$/g, '');
const uri = read('DATABASE_URI').replace(/\/AchevaDB(\?|$)/, `/${DB}$1`);
const paystackSecret = read('PAYSTACK_SECRET_KEY') ?? read('PAYSTACK_LIVE_SECRET_KEY');

let failures = 0;
let checks = 0;
const check = (name, pass, detail = '') => {
  checks += 1;
  if (!pass) failures += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const call = async (method, path, token, body, headers = {}) => {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
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

/** A member of staff in a given office, switching into it first if need be. */
const staffSession = async (email, role) => {
  const session = await signIn('/auth/lecturers/signin', email);
  if (session.role === role) return session;
  await call('PATCH', '/auth/lecturers/switch-role', session.accessToken, { role });
  return signIn('/auth/lecturers/signin', email);
};

/** A browser context whose :3000 calls go to the test API. */
const newContext = async (browser) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route(/^http:\/\/localhost:3000\//, (route) =>
    route.continue({ url: route.request().url().replace('http://localhost:3000', API) }),
  );
  return context;
};

/** Signed in already, the way the staff app stores a session. */
const staffContext = async (browser, session) => {
  const { accessToken, refreshToken, ...account } = session;
  const context = await newContext(browser);
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
      const legacy = el.closest('button, th, mat-option, app-empty-state, .adm-chip');
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

/**
 * Click, and if the element will not hold still (seen intermittently on the
 * admin console's dialogs), say what is still animating and click anyway —
 * so the next occurrence names its cause instead of timing out.
 */
const steadyClick = async (locator) => {
  try {
    await locator.click({ timeout: 5_000 });
  } catch (error) {
    if (!/not stable/.test(String(error))) throw error;
    const moving = await locator.page().evaluate(() =>
      document
        .getAnimations()
        .map((a) => `${a.animationName ?? a.transitionProperty ?? 'animation'} on ${a.effect?.target?.tagName ?? '?'}.${a.effect?.target?.className ?? ''}`)
        .slice(0, 5),
    );
    console.log(`  (an element would not hold still; running: ${moving.join(', ') || 'nothing'} — clicked anyway)`);
    await locator.click({ force: true });
  }
};

/** Wait for a dialog to finish opening: nothing animating on the page. */
const dialogOpen = (page) =>
  page
    .waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 5_000 })
    .catch(() => undefined);

/** Open a Material select and choose `text` — retried, since the options arrive from the API. */
const pickOption = async (page, select, text) => {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.locator(select).click();
    const option = page.locator('mat-option').filter({ hasText: text }).first();
    if (await option.waitFor({ timeout: 5_000 }).then(() => true, () => false)) {
      await option.click();
      return;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1_000);
  }
  throw new Error(`"${text}" never appeared in ${select}`);
};

await mongoose.connect(uri, { serverSelectionTimeoutMS: 30_000 });
const db = mongoose.connection;
const oid = (id) => new mongoose.Types.ObjectId(String(id));
const Students = db.collection('students');
const Departments = db.collection('departments');

const student = await Students.findOne({ email: STUDENT });
const school = student.school;
const schoolDoc = await db.collection('schools').findOne({ _id: school });
const settings = await db.collection('schoolsettings').findOne({ school });
const session = settings.activeSession;
const maths = await Departments.findOne({ _id: oid(MATHS) });
const faculty = await db.collection('faculties').findOne({ _id: maths.faculty });
const startedAt = new Date();
const snapshot = {
  options: maths.options ?? [],
  student: Object.fromEntries(
    ['programmeOption', 'programmeOptionId', 'sex', 'dateOfBirth', 'nationality', 'stateOfOrigin', 'modeOfEntry'].map(
      (field) => [field, student[field] ?? null],
    ),
  ),
};
if (
  (await db.collection('schoolfeeplans').countDocuments({ school, session })) ||
  (await db.collection('accounts').countDocuments({ school, purpose: 'SCHOOL_FEES' }))
) {
  throw new Error('The test school already has school fees set up — this harness expects a clean slate.');
}

const browser = await chromium.launch();
try {
  // The bio details are filled in, the option is not: only the option is asked.
  await Students.updateOne(
    { _id: student._id },
    {
      $set: {
        sex: 'FEMALE',
        dateOfBirth: new Date('2003-04-05'),
        nationality: 'Nigerian',
        stateOfOrigin: 'Imo',
        modeOfEntry: 'UTME',
        programmeOption: null,
        programmeOptionId: null,
      },
    },
  );
  const sandbox = await db.collection('accounts').findOne({ department: oid(MATHS) });
  await db.collection('accounts').insertOne({
    createdBy: student._id,
    school,
    department: null,
    faculty: null,
    accountName: 'FUTO BURSARY (STAGED)',
    accountNumber: '0000000000',
    bankCode: '000015',
    recipientCode: sandbox.recipientCode,
    provider: 'PAYSTACK',
    currency: 'NGN',
    usage: 'COLLECTION',
    accountCategory: 'DYNAMIC',
    purpose: 'SCHOOL_FEES',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // ── Admin console: options ───────────────────────────────────────────────
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
    [adminToken, adminRefresh ?? '', JSON.stringify(adminAccount)],
  );
  const adminPage = await adminContext.newPage();
  await adminPage.goto(`${ADMIN_APP}/department`, { waitUntil: 'domcontentloaded' });
  await adminPage.locator('mat-select#dep-school').waitFor({ timeout: 30_000 });
  await pickOption(adminPage, 'mat-select#dep-school', schoolDoc.name);
  await pickOption(adminPage, 'mat-select#dep-faculty', faculty.name);
  const mathsRow = adminPage.locator('tr').filter({ hasText: maths.name });
  await mathsRow.waitFor({ timeout: 20_000 });
  await mathsRow.getByRole('button', { name: `Options for ${maths.name}` }).click();
  const optionsDialog = adminPage.locator('app-department-options');
  await optionsDialog.waitFor({ timeout: 10_000 });
  await dialogOpen(adminPage);
  for (const name of ['Pure Mathematics', 'Statistics']) {
    await optionsDialog.getByPlaceholder('e.g Statistics').fill(name);
    await steadyClick(optionsDialog.getByRole('button', { name: 'Add option' }));
    await optionsDialog.locator(`input[aria-label="Name of ${name}"]`).waitFor({ timeout: 10_000 });
  }
  check('Acheva adds Maths’ options in the department’s Options dialog', (await optionsDialog.locator('.opt-list__row').count()) === 2);
  await adminPage.screenshot({ path: `${SHOTS}/admin-options.png` });
  await optionsDialog.getByRole('button', { name: 'Done' }).click();
  await mathsRow.getByText('Statistics').waitFor({ timeout: 10_000 }).catch(() => undefined);
  check('the department row lists them', /Pure Mathematics/.test(await mathsRow.innerText()) && /Statistics/.test(await mathsRow.innerText()));
  const statsId = String(
    (await Departments.findOne({ _id: oid(MATHS) })).options.find((option) => option.name === 'Statistics')._id,
  );

  // ── Admin console: the plan ──────────────────────────────────────────────
  await adminPage.goto(`${ADMIN_APP}/school-fees`, { waitUntil: 'domcontentloaded' });
  await adminPage.locator('mat-select#sf-school').waitFor({ timeout: 30_000 });
  if (!(await adminPage.locator('mat-select#sf-school').innerText()).includes(schoolDoc.name)) {
    await pickOption(adminPage, 'mat-select#sf-school', schoolDoc.name);
  }
  await adminPage.getByText('Payout account').waitFor({ timeout: 20_000 });
  check(
    'the payout account shows as confirmed by Paystack',
    (await adminPage.getByText('Confirmed by Paystack').count()) === 1 &&
      (await adminPage.getByText('FUTO BURSARY (STAGED)').count()) === 1,
  );
  await adminPage.getByRole('button', { name: '2 payments' }).click();
  const dates = adminPage.locator('.sf-dates input[type="date"]');
  await dates.nth(0).fill('2026-11-01');
  await dates.nth(1).fill('2027-02-15');
  await adminPage.getByPlaceholder('Find a department or faculty').fill('Mathematics');
  const section = adminPage.locator('details.sf-dept').filter({ hasText: maths.name }).first();
  await section.locator('summary').click();
  await section.getByLabel(`${maths.name} 100 Level fee`, { exact: true }).fill('150000');
  await section.getByRole('button', { name: /Use the 100 Level fee for every blank level/ }).click();
  await section.getByLabel(`${maths.name} 400 Level Statistics fee`, { exact: true }).fill('180000');
  await section.locator('summary').getByText('5 of 5 levels').waitFor({ timeout: 5_000 }).catch(() => undefined);
  const summaryText = await section.locator('summary').innerText();
  check('one fee typed fills every level', /5 of 5 levels/.test(summaryText), summaryText.replace(/\s+/g, ' '));
  await adminPage.screenshot({ path: `${SHOTS}/admin-school-fees-editing.png`, fullPage: true });
  await adminPage.getByRole('button', { name: 'Save plan' }).click();
  await adminPage.locator('.sf-bar__status').filter({ hasText: 'Draft' }).waitFor({ timeout: 20_000 });
  const saved = await db.collection('schoolfees').find({ school, session }).toArray();
  check(
    'saving stores six fees in kobo — five levels and Statistics at 400',
    saved.length === 6 &&
      saved.filter((fee) => !fee.option).every((fee) => fee.amount === 15_000_000) &&
      saved.find((fee) => String(fee.option) === statsId)?.amount === 18_000_000,
    saved.map((fee) => `${fee.level}${fee.option ? '/opt' : ''}=${fee.amount}`).join(' '),
  );
  await adminPage.getByRole('button', { name: 'Publish' }).click();
  await adminPage.locator('.sf-bar__status').filter({ hasText: 'Published' }).waitFor({ timeout: 20_000 });
  check('publishing opens it for payment', (await adminPage.locator('.sf-bar__status').innerText()).includes('Published'));
  await adminPage.screenshot({ path: `${SHOTS}/admin-school-fees.png`, fullPage: true });
  const adminBrand = await brandProblems(adminPage, 'app-school-fees');
  check('the admin page keeps to the brand', adminBrand.length === 0, adminBrand.join('; '));

  // ── Student portal ───────────────────────────────────────────────────────
  const studentContext = await newContext(browser);
  const page = await studentContext.newPage();
  await page.goto(`${STUDENT_APP}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[formcontrolname="email"]').fill(STUDENT);
  await page.locator('input[formcontrolname="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL(/\/details/, { timeout: 30_000 }).catch(() => undefined);
  check('a student in a department with options is held until they choose one', /\/details/.test(page.url()), page.url());
  await page.locator('mat-select#details-option').waitFor({ timeout: 15_000 });
  await page.locator('mat-select#details-option').click();
  const offered = await page.locator('mat-option').allInnerTexts();
  check('they choose from the department’s list', offered.map((text) => text.trim()).join(',') === 'Pure Mathematics,Statistics', offered.join(','));
  await page.locator('mat-option').filter({ hasText: 'Statistics' }).click();
  await page.screenshot({ path: `${SHOTS}/student-details-option.png`, fullPage: true });
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 }).catch(() => undefined);
  check('and are let in', /\/dashboard/.test(page.url()), page.url());

  await page.goto(`${STUDENT_APP}/registration`, { waitUntil: 'domcontentloaded' });
  const feesLink = page.getByRole('link', { name: 'Pay your school fees' });
  await feesLink.waitFor({ timeout: 20_000 }).catch(() => undefined);
  const blockedText = await page.locator('.sreg-empty').first().innerText().catch(() => '');
  check(
    'registration says it is waiting on their school fees, and links to them',
    (await feesLink.count()) === 1 && /at least ₦54,000\.00/.test(blockedText),
    blockedText.replace(/\s+/g, ' ').slice(0, 140),
  );
  await feesLink.click();
  await page.waitForURL(/\/school-fees/, { timeout: 15_000 });
  await page.locator('#fees-amount').waitFor({ timeout: 20_000 });
  const pageText = await page.locator('app-school-fees').innerText();
  check(
    'School Fees shows their option’s fee and that registration needs a payment first',
    /₦180,000\.00/.test(pageText) && /Statistics/.test(pageText) && /Pay something first/.test(pageText),
  );
  check(
    'the amount is prefilled with an even split',
    (await page.locator('#fees-amount').inputValue()) === '90000',
    await page.locator('#fees-amount').inputValue(),
  );
  await page.locator('#fees-amount').fill('1000');
  const payButton = page.locator('.pay__row .btn--primary');
  await page.waitForFunction(() => document.querySelector('.pay__row .btn--primary')?.hasAttribute('disabled'));
  check(
    'a token ₦1,000 disables the button and says why',
    (await payButton.isDisabled()) && /at least ₦54,000\.00/.test(await page.locator('#fees-amount-rule').innerText()),
    await page.locator('#fees-amount-rule').innerText(),
  );
  await page.locator('#fees-amount').fill('60000');
  await page.waitForFunction(() => !document.querySelector('.pay__row .btn--primary')?.hasAttribute('disabled'));
  check(
    'online, the button charges Paystack’s fee on top and says so',
    /Pay ₦61,015\.23/.test(await payButton.innerText()) &&
      /₦1,015\.23 is\s+Paystack's charge/.test(await page.locator('#fees-amount-charge').innerText()),
    `${await payButton.innerText()} — ${await page.locator('#fees-amount-charge').innerText()}`,
  );
  await page.screenshot({ path: `${SHOTS}/student-school-fees.png`, fullPage: true });
  const studentBrand = await brandProblems(page, 'app-school-fees');
  check('the page keeps to the brand', studentBrand.length === 0, studentBrand.join('; '));
  await payButton.click();
  await page.waitForURL(/checkout\.paystack\.com/, { timeout: 30_000 }).catch(() => undefined);
  check('paying ₦60,000 opens Paystack', /checkout\.paystack\.com/.test(page.url()), page.url());

  // Paystack's signed webhook settles it.
  const tx = await db.collection('transactions').findOne(
    { payer: student._id, type: 'SCHOOL_FEES', status: 'PENDING' },
    { sort: { createdAt: -1 } },
  );
  check('the checkout was for ₦60,000', tx?.amount === 6_000_000, String(tx?.amount));
  const hookBody = JSON.stringify({ event: 'charge.success', data: { reference: tx.ref, amount: tx.amount, status: 'success' } });
  await call('POST', '/transactions/webhook/paystack', null, hookBody, {
    'x-paystack-signature': createHmac('sha512', paystackSecret).update(hookBody).digest('hex'),
  });
  await page.goto(`${STUDENT_APP}/school-fees`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Open to you').first().waitFor({ timeout: 20_000 }).catch(() => undefined);
  const afterText = await page.locator('app-school-fees').innerText();
  check(
    'once paid, first semester is open to them and ₦120,000 is left',
    /Open to you/.test(afterText) && /Needs the full fee/.test(afterText) && /₦120,000\.00/.test(afterText),
  );
  await page.screenshot({ path: `${SHOTS}/student-school-fees-paid.png`, fullPage: true });
  await page.goto(`${STUDENT_APP}/dues/complete?reference=${tx.ref}`, { waitUntil: 'domcontentloaded' });
  const back = page.getByRole('link', { name: 'Back to my school fees' });
  await back.waitFor({ timeout: 20_000 }).catch(() => undefined);
  check('the payment page sends them back to their school fees', (await back.count()) === 1);

  // ── A payment made at the bank: the receipt ───────────────────────────────
  await page.goto(`${STUDENT_APP}/school-fees`, { waitUntil: 'domcontentloaded' });
  const uploadLink = page.getByRole('link', { name: 'Upload a receipt' });
  await uploadLink.waitFor({ timeout: 20_000 });
  await uploadLink.click();
  await page.waitForURL(/\/school-fees\/receipt/, { timeout: 15_000 });
  await page.locator('#upload-rrr').waitFor({ timeout: 20_000 });
  const owedLine = await page.locator('.owed').innerText();
  check('the upload page says what they still owe', /₦120,000\.00/.test(owedLine), owedLine);
  await page.getByRole('button', { name: 'Upload receipt' }).click();
  await page.locator('.field-error').first().waitFor({ timeout: 5_000 }).catch(() => undefined);
  const missing = await page.locator('.field-error').allInnerTexts();
  check(
    'pressing upload too early says what is missing, sending nothing',
    missing.some((text) => /school fees receipt/.test(text)) && missing.some((text) => /Remita receipt/.test(text)),
    missing.join(' | '),
  );
  const PNG_1PX = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
  await page.setInputFiles('#upload-school-fee-receipt', {
    name: 'futo-school-fees.png',
    mimeType: 'image/png',
    buffer: Buffer.concat([PNG_1PX, Buffer.from(`\nschool ${startedAt.getTime()}`)]),
  });
  await page.setInputFiles('#upload-remita-receipt', {
    name: 'remita.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(`%PDF-1.4\n% remita ${startedAt.getTime()}\ntrailer << >>\n%%EOF\n`),
  });
  const rrr = `2805${String(startedAt.getTime()).slice(-8)}`;
  await page.locator('#upload-rrr').fill(rrr);
  check(
    'the RRR is grouped the way Remita prints it',
    /^\d{4}-\d{4}-\d{4}$/.test(await page.locator('#upload-rrr').inputValue()),
    await page.locator('#upload-rrr').inputValue(),
  );
  await page.locator('#upload-amount').fill('130000');
  const over = await page.locator('.field-error').allInnerTexts();
  check('an amount above what is owed is caught as it is typed', over.some((text) => /more than the ₦120,000\.00/.test(text)));
  await page.locator('#upload-amount').fill('50000');
  await page.locator('#upload-declaration').check();
  await page.screenshot({ path: `${SHOTS}/student-receipt-upload.png`, fullPage: true });
  const uploadBrand = await brandProblems(page, 'app-receipt-upload');
  check('the upload page keeps to the brand', uploadBrand.length === 0, uploadBrand.join('; '));
  await page.getByRole('button', { name: 'Upload receipt' }).click();
  await page.waitForURL(/\/school-fees$/, { timeout: 20_000 }).catch(() => undefined);
  await page.getByText('Counted · not yet checked').waitFor({ timeout: 20_000 }).catch(() => undefined);
  const withReceipt = await page.locator('app-school-fees').innerText();
  check(
    'it counts at once — ₦70,000 left — and is listed as not yet checked',
    /\/school-fees$/.test(page.url()) && /₦70,000\.00/.test(withReceipt) && /Counted · not yet checked/.test(withReceipt),
    page.url(),
  );
  const secondRow = (await page.locator('.schedule__row').nth(1).innerText()).replace(/\s+/g, ' ');
  check(
    'the schedule shows the bank payment as payment 2, and what is left as one payment',
    /paid/.test(secondRow) && /₦50,000\.00/.test(secondRow) && /The rest of your fees/.test(await page.locator('.pay__label').innerText()),
    secondRow,
  );
  await page.screenshot({ path: `${SHOTS}/student-school-fees-receipt.png`, fullPage: true });

  // ── Staff portal ─────────────────────────────────────────────────────────
  const hod = await (await staffContext(browser, await staffSession(HOD, 'HOD'))).newPage();
  await hod.goto(`${STAFF_APP}/school-fees`, { waitUntil: 'domcontentloaded' });
  await hod.locator('.tile').first().waitFor({ timeout: 30_000 });
  check('the Head has School Fees in the menu', (await hod.getByText('School Fees', { exact: true }).count()) > 0);
  const tiles = (await hod.locator('.tiles').innerText()).replace(/\s+/g, ' ');
  check('and sees the department’s counts', /All students/.test(tiles) && /Not started/.test(tiles), tiles.slice(0, 160));
  await hod.locator('.tile').filter({ hasText: 'Part paid' }).click();
  // The unfiltered rows are on screen until the filtered list arrives.
  await hod
    .locator('.fee-table tbody tr')
    .filter({ hasText: student.registrationNumber })
    .waitFor({ timeout: 20_000 })
    .catch(() => undefined);
  const partRows = await hod.locator('.fee-table tbody tr').allInnerTexts();
  check(
    '"Part paid" finds the student, with the bank payment counted and marked unchecked',
    partRows.some(
      (row) =>
        row.includes(student.registrationNumber) &&
        /₦110,000\.00/.test(row) &&
        /of ₦180,000\.00/.test(row) &&
        /1 receipt · not yet checked/.test(row),
    ),
    partRows.map((row) => row.replace(/\s+/g, ' ')).join(' | ').slice(0, 200),
  );
  await hod.getByRole('button', { name: /1 receipt/ }).click();
  const receiptsDialog = hod.locator('app-school-fee-receipts-dialog');
  await receiptsDialog.getByText(`RRR ${rrr}`).waitFor({ timeout: 10_000 }).catch(() => undefined);
  check('the Head can see the receipt', (await receiptsDialog.innerText()).includes(rrr));
  const [opened] = await Promise.all([
    hod.waitForEvent('popup', { timeout: 15_000 }).catch(() => null),
    // The PNG one: headless Chromium has no PDF viewer, so a PDF downloads
    // instead of showing — a real browser shows either.
    receiptsDialog.getByRole('button', { name: 'School fees receipt' }).click(),
  ]);
  // The tab opens on the click (so no popup blocker stops it), then goes to the file.
  await opened?.waitForURL(/^blob:/, { timeout: 15_000 }).catch(() => undefined);
  check('and open it in a new tab', !!opened && /^blob:/.test(opened.url()), opened?.url() ?? 'no tab');
  await hod.screenshot({ path: `${SHOTS}/staff-receipts-dialog.png` });
  await opened?.close();
  await receiptsDialog.getByRole('button', { name: 'Close' }).click();
  await hod.screenshot({ path: `${SHOTS}/staff-hod-school-fees.png`, fullPage: true });
  const hodBrand = await brandProblems(hod, 'app-school-fees');
  check('the staff page keeps to the brand', hodBrand.length === 0, hodBrand.join('; '));

  const advisor = await (await staffContext(browser, await staffSession(ADVISOR, 'COURSE_ADVISOR'))).newPage();
  await advisor.goto(`${STAFF_APP}/school-fees`, { waitUntil: 'domcontentloaded' });
  await advisor.locator('.tile').first().waitFor({ timeout: 30_000 });
  const advisorHead = await advisor.locator('.fees__head').innerText();
  await advisor.getByPlaceholder('Search by name or registration number').fill(student.registrationNumber);
  await advisor.locator('.fee-table tbody tr').filter({ hasText: student.registrationNumber }).waitFor({ timeout: 20_000 }).catch(() => undefined);
  check(
    'the Course Advisor sees their own students, the student among them',
    /Who among your students/.test(advisorHead) &&
      (await advisor.locator('.fee-table tbody tr').filter({ hasText: student.registrationNumber }).count()) === 1,
  );

  // ── Acheva checks the receipt ────────────────────────────────────────────
  await adminPage.goto(`${ADMIN_APP}/school-fees`, { waitUntil: 'domcontentloaded' });
  const receiptRow = adminPage.locator('app-receipts-review tr').filter({ hasText: rrr });
  await receiptRow.waitFor({ timeout: 30_000 });
  check('Acheva’s receipts list has it, not yet checked', (await receiptRow.innerText()).includes(student.registrationNumber));
  await receiptRow.getByRole('button', { name: 'Reject' }).click();
  const rejectDialog = adminPage.locator('app-reject-receipt');
  await rejectDialog.waitFor({ timeout: 10_000 });
  await rejectDialog.locator('textarea').waitFor({ state: 'visible' });
  await dialogOpen(adminPage);
  // Typed again if the dialog's form was not listening yet the first time.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await rejectDialog.locator('textarea').fill('The QR code is for a different RRR.');
    const enabled = await adminPage
      .waitForFunction(
        () => document.querySelector('app-reject-receipt button[type="submit"]')?.disabled === false,
        null,
        { timeout: 1_500 },
      )
      .then(() => true, () => false);
    if (enabled) break;
  }
  await adminPage.screenshot({ path: `${SHOTS}/admin-reject-receipt.png` });
  await steadyClick(rejectDialog.getByRole('button', { name: 'Reject' }));
  await rejectDialog.waitFor({ state: 'detached', timeout: 10_000 });
  // Saved once the "Not yet checked" list no longer has it.
  await receiptRow.waitFor({ state: 'detached', timeout: 20_000 }).catch(() => undefined);
  await adminPage.locator('app-receipts-review').scrollIntoViewIfNeeded();
  await adminPage.screenshot({ path: `${SHOTS}/admin-receipts.png`, fullPage: true });
  await page.goto(`${STUDENT_APP}/school-fees`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Not accepted').waitFor({ timeout: 20_000 }).catch(() => undefined);
  const afterReject = await page.locator('app-school-fees').innerText();
  check(
    'once Acheva rejects it, it stops counting — ₦120,000 again — and the student sees why',
    /Not accepted/.test(afterReject) && /different RRR/.test(afterReject) && /₦120,000\.00/.test(afterReject),
  );
} catch (error) {
  failures += 1;
  console.log(`FAIL  harness crashed — ${String(error?.stack ?? error).split('\n').slice(0, 12).join(' | ')}`);
} finally {
  await browser.close();
  await Departments.updateOne({ _id: oid(MATHS) }, { $set: { options: snapshot.options } });
  await Students.updateOne({ _id: student._id }, { $set: snapshot.student });
  const plans = await db.collection('schoolfeeplans').find({ school, createdAt: { $gte: startedAt } }).toArray();
  await db.collection('schoolfees').deleteMany({ plan: { $in: plans.map((plan) => plan._id) } });
  await db.collection('schoolfeeplans').deleteMany({ _id: { $in: plans.map((plan) => plan._id) } });
  const removed = await db.collection('transactions').deleteMany({ type: 'SCHOOL_FEES', createdAt: { $gte: startedAt } });
  await db.collection('schoolfeereceipts').deleteMany({ createdAt: { $gte: startedAt } });
  await db.collection('accounts').deleteMany({ school, purpose: 'SCHOOL_FEES', createdAt: { $gte: startedAt } });
  await db.collection('notifications').deleteMany({ createdAt: { $gte: startedAt } });
  console.log(`\nrestored: removed ${plans.length} plan(s), ${removed.deletedCount} payment(s); shots in ${SHOTS}`);
  console.log(`\n${checks - failures}/${checks} checks passed`);
  await mongoose.disconnect();
  process.exit(failures ? 1 : 0);
}
