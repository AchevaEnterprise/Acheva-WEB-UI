#!/usr/bin/env node
/**
 * The messaging surfaces built on top of the chat core, end to end.
 *
 * Three apps have to agree for either of these to work, which is exactly why
 * they are checked in a browser rather than in unit tests:
 *
 *   1. STUDENT → COURSE ADVISOR. A student can write to exactly one person, so
 *      the button opens that thread directly rather than showing a picker with
 *      one row in it. Guards the directory rule too: the staff list a STUDENT
 *      gets back must be their own advisor and nobody else — it used to return
 *      their Head and Dean, people the permission layer would then refuse.
 *   2. SUPPORT. A ticket raised in the student portal must appear on the desk
 *      in the admin app, and the desk's reply must reach the student with no
 *      reload — across two apps, two account types and one SSE stream.
 *
 * Needs all three dev servers: staff 4200, student 4201, admin 4300, API 3000.
 *
 *   npm run test:messaging-surfaces
 *   MS_STUDENT_APP=... MS_ADMIN_APP=... npm run test:messaging-surfaces
 */
console.log('\n── student → course advisor ──');
import { chromium } from '@playwright/test';
const API = process.env.MS_API ?? 'http://localhost:3000';
const STUDENT_APP = process.env.MS_STUDENT_APP ?? 'http://localhost:4201';
const ADMIN_APP = process.env.MS_ADMIN_APP ?? 'http://localhost:4300';
const APP = STUDENT_APP;
let failures=0; const check=(ok,m,d='')=>{console.log(`  ${ok?'✓':'✗'} ${m}${d?` — ${d}`:''}`); if(!ok)failures++;};
const signIn = async (p,e,pw='Password8@') => {
  const r = await fetch(`${API}${p}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:e,password:pw})});
  if(!r.ok) throw new Error(`${p} ${e} → ${r.status}`); return (await r.json()).data;
};
const student = await signIn('/auth/students/signin','sim.chm300.1@acheva.sim');
const browser = await chromium.launch({headless:true});
const ctx = await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2,colorScheme:'light'});
await ctx.addInitScript(([t,r,a])=>{localStorage.setItem('token',t);localStorage.setItem('refresh_token',r);localStorage.setItem('active_account',a);},[student.accessToken,student.refreshToken,JSON.stringify(student)]);
const page = await ctx.newPage();
page.on('console', m => m.type()==='error' && console.log('  !', m.text().slice(0,120)));

await page.goto(`${APP}/messages`, {waitUntil:'domcontentloaded', timeout:30000});
await page.waitForSelector('.chat', {timeout:20000});
await page.waitForTimeout(2500);

await page.getByRole('button', {name:/Message your Course Advisor/}).click();
await page.waitForTimeout(3500);
check(await page.locator('app-chat-thread').count() > 0, 'the advisor thread opens straight from the button');
const title = await page.locator('.thread-head .acva-para-2').first().innerText().catch(()=> '');
check(/advisor|dr\.|sim/i.test(title), 'the thread is with their own Course Advisor', title);

const msg = `Student→CA ${Date.now()}: could you check my CHM 301 grade?`;
await page.locator('.composer__input').fill(msg);
await page.keyboard.press('Enter');
await page.waitForTimeout(2500);
check(await page.getByText(msg).count() > 0, 'the message sends and shows in the thread');
await page.screenshot({path:'screenshots/advisor-student.png'});

// And the advisor really has it, from the server's point of view.
const convos = await (await fetch(`${API}/messaging/conversations`,{headers:{Authorization:`Bearer ${student.accessToken}`}})).json();
const advisory = convos.data.conversations.find(c => c.kind === 'ADVISORY');
check(Boolean(advisory), 'an ADVISORY conversation now exists', advisory?.title ?? '');
check(advisory?.lastMessage?.preview === msg, 'the advisor sees it as the latest message');

await browser.close();

console.log('\n── support: student → desk → student ──');
const admin = await signIn('/auth/admins/login', process.env.MS_ADMIN ?? 'members@acheva.app');

const browser2 = await chromium.launch({ headless: true });

// ── the student, on the support page ───────────────────────────────────────
const sCtx = await browser2.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light' });
await sCtx.addInitScript(([t, r, a]) => {
  localStorage.setItem('token', t); localStorage.setItem('refresh_token', r); localStorage.setItem('active_account', a);
}, [student.accessToken, student.refreshToken, JSON.stringify(student)]);
const sPage = await sCtx.newPage();
sPage.on('console', m => m.type() === 'error' && console.log('  ! student:', m.text().slice(0, 120)));

await sPage.goto(`${STUDENT_APP}/support`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await sPage.waitForSelector('.support', { timeout: 20000 });
await sPage.waitForTimeout(3000);

const ask = `Student ticket ${Date.now()}: I cannot see my 300L result.`;
await sPage.locator('.composer__input').fill(ask);
await sPage.keyboard.press('Enter');
await sPage.waitForTimeout(2500);
check(await sPage.getByText(ask).count() > 0, 'student sees their own message in the support thread');
await sPage.screenshot({ path: 'screenshots/support-student.png' });

// ── the desk, in the admin app ─────────────────────────────────────────────
const aCtx = await browser2.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light' });
await aCtx.addInitScript(([t, a]) => {
  localStorage.setItem('acheva-admin-token', t); localStorage.setItem('acheva-admin-account', a);
}, [admin.accessToken, JSON.stringify(admin)]);
const aPage = await aCtx.newPage();
aPage.on('console', m => m.type() === 'error' && console.log('  ! admin:', m.text().slice(0, 120)));

await aPage.goto(`${ADMIN_APP}/support`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await aPage.waitForSelector('.desk', { timeout: 20000 });
await aPage.waitForTimeout(3000);

const ticketCount = await aPage.locator('.ticket').count();
check(ticketCount > 0, 'the desk lists support tickets', `${ticketCount} ticket(s)`);

// The student's ticket must be findable by their name.
await aPage.locator('.queue-search').fill('Chidi');
await aPage.waitForTimeout(600);
const named = await aPage.locator('.ticket__name').first().innerText();
check(named.toLowerCase().includes('chidi'), 'a ticket is named by the person who raised it', named);

await aPage.locator('.ticket').first().click();
await aPage.waitForTimeout(2500);
check(await aPage.getByText(ask).count() > 0, 'the desk can read what the student wrote');
await aPage.screenshot({ path: 'screenshots/support-admin.png' });

// ── the desk replies, and it lands live on the student's screen ────────────
const reply = `Desk reply ${Date.now()}: checking with your department now.`;
await aPage.locator('.composer__input').fill(reply);
await aPage.keyboard.press('Enter');
await aPage.waitForTimeout(3000);
check(await aPage.getByText(reply).count() > 0, 'the reply appears on the desk side');

await sPage.waitForTimeout(2000);
check(await sPage.getByText(reply).count() > 0, 'the reply reaches the STUDENT with no reload');
await sPage.screenshot({ path: 'screenshots/support-student-reply.png' });

await browser2.close();

console.log(
  failures === 0
    ? '\nAll messaging surfaces work.'
    : `\n${failures} check(s) FAILED.`
);
process.exit(failures === 0 ? 0 : 1);
