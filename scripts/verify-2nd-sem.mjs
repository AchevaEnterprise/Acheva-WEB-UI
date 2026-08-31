import { chromium } from '@playwright/test';

const BASE = 'http://localhost:4200';
const EMAIL = 'danielchinemerem302+7@gmail.com';
const PASSWORD = 'Password8@';
const SHOT = '/private/tmp/claude-501/-Users-chinemeremdaniel-Projects-Acheva/b8ec8427-c127-46bd-87be-21069c88a9af/scratchpad';

const log = (...a) => console.log(...a);

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') log('  [console.error]', m.text().slice(0, 160)); });

try {
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"], input[formcontrolname="email"]', EMAIL);
  await page.fill('input[type="password"], input[formcontrolname="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  log('✅ logged in');

  await page.goto(`${BASE}/results`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Confirm "2 Pages"
  const pagesText = await page.textContent('body');
  log('Header says 2 Pages:', /2\s*\n?\s*Pages/i.test(pagesText));

  // Initial table content (should be 1st semester = PHY 105)
  const firstTable = (await page.textContent('app-result-view table')) ?? '';
  log('Initial table has PHY 105:', firstTable.includes('PHY 105'), '| has MTH 106:', firstTable.includes('MTH 106'));

  await page.screenshot({ path: `${SHOT}/before-click.png`, fullPage: true });

  // Click the SECOND preview thumbnail (2nd semester)
  const thumbs = page.locator('app-result-preview [tabindex="0"]');
  const count = await thumbs.count();
  log('Preview thumbnails found:', count);
  if (count < 2) throw new Error('Second-semester thumbnail not present');

  await thumbs.nth(1).click();
  await page.waitForTimeout(1200);

  const secondTable = (await page.textContent('app-result-view table')) ?? '';
  const semLabel = (await page.textContent('app-result-view')) ?? '';
  log('After click — table has MTH 106:', secondTable.includes('MTH 106'), '| has PHY 105:', secondTable.includes('PHY 105'));
  log('After click — shows 2ND SEMESTER label:', /2ND SEMESTER/i.test(semLabel));

  await page.screenshot({ path: `${SHOT}/after-click.png`, fullPage: true });

  if (secondTable.includes('MTH 106') && !secondTable.includes('PHY 105')) {
    log('\n🎉 PASS — second-semester result (MTH 106) is now viewable.');
  } else {
    log('\n❌ FAIL — clicking the 2nd page did not switch to MTH 106.');
    process.exitCode = 1;
  }
} catch (e) {
  log('❌ ERROR:', e.message);
  await page.screenshot({ path: `${SHOT}/error.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
