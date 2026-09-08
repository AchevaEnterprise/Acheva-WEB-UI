#!/usr/bin/env node
/**
 * Messaging realtime harness — does a message actually arrive without a reload?
 *
 * This exists because it once did not, and nothing caught it. The transport
 * (SSE) was researched and correct, the server published every event, and the
 * browser held an open stream — but the app's GLOBAL RESPONSE INTERCEPTOR
 * wrapped each emission in the `{status, statusCode, data}` envelope. That
 * wrapper has no `type`, so Nest wrote no `event:` line, and the client's frame
 * parser required one and dropped every frame in silence. Nothing logged, no
 * request failed, the connection stayed up: the only symptom was that you had
 * to refresh to see a message.
 *
 * A unit test could not have found that — it needed the real server, the real
 * interceptor and a real browser. So this asserts the behaviour a user cares
 * about, end to end:
 *
 *   1. the sidebar badge moves while parked on ANOTHER page (the dashboard)
 *   2. a bubble lands in an open thread with no reload
 *   3. reading the thread clears the badge
 *   4. the SSE wire format still carries its `event:` line and an unwrapped body
 *
 *   RT_PASSWORD=Password8@ npm run test:realtime
 *   RT_API=http://localhost:3999 RT_RECEIVER=a@x.com RT_SENDER=b@x.com ...
 *
 * Both dev servers must be running (ng serve + nest start:dev).
 */

import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';

const API = process.env.RT_API ?? 'http://localhost:3000';
const APP = process.env.RT_APP ?? 'http://localhost:4200';
const PASSWORD = process.env.RT_PASSWORD ?? 'Password8@';
const RECEIVER = process.env.RT_RECEIVER ?? 'danielchinemerem302+1@gmail.com';
const SENDER = process.env.RT_SENDER ?? 'danielchinemerem302+2@gmail.com';

let failures = 0;
const check = (ok, msg, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${msg}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const signIn = async (email) => {
  const res = await fetch(`${API}/auth/lecturers/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(
      `signin ${email} → ${res.status}` +
        (res.status === 429 ? ' (auth throttle — wait a minute and retry)' : '')
    );
  }
  const { data } = await res.json();
  const { accessToken, refreshToken, ...account } = data;
  return { accessToken, refreshToken, account };
};

/** Find-or-create the thread between the two, so the run needs no fixture id. */
const openThread = async (token, targetId) => {
  const res = await fetch(`${API}/messaging/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ targetId }),
  });
  if (!res.ok) throw new Error(`open conversation → ${res.status}`);
  const { data } = await res.json();
  return String(data._id ?? data.id);
};

const send = (token, conversationId, body) =>
  fetch(`${API}/messaging/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ body }),
  });

/**
 * Read one frame straight off the wire.
 *
 * The regression was invisible from inside the app, so this checks the bytes:
 * an `event:` line must be present and the body must NOT be wrapped in the
 * response envelope.
 */
async function assertWireFormat(receiverToken, senderToken, conversationId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  const res = await fetch(`${API}/messaging/stream`, {
    headers: { Authorization: `Bearer ${receiverToken}`, Accept: 'text/event-stream' },
    signal: controller.signal,
  });
  check(res.ok, 'SSE stream accepts an authenticated request', `HTTP ${res.status}`);
  if (!res.ok || !res.body) { clearTimeout(timer); return; }

  setTimeout(() => send(senderToken, conversationId, `wire probe ${Date.now()}`), 500);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let frame = null;

  try {
    while (!frame) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      frame = parts.find((p) => p.includes('data:')) ?? null;
    }
  } catch {
    // Aborted on timeout; `frame` stays null and the checks below report it.
  }
  clearTimeout(timer);
  controller.abort();

  check(Boolean(frame), 'a frame arrived on the stream');
  if (!frame) return;

  check(/^event: .+$/m.test(frame), 'frame carries an `event:` line', frame.split('\n')[0]);

  const dataLine = frame.split('\n').find((l) => l.startsWith('data:'));
  const body = JSON.parse(dataLine.slice(5).trim());
  check(
    !('statusCode' in body),
    'frame body is NOT wrapped in the response envelope',
    Object.keys(body).join(', ')
  );
  check(
    Boolean(body.payload?.conversationId),
    'frame body carries the payload where the client looks for it'
  );
}

(async () => {
  mkdirSync('screenshots', { recursive: true });

  const receiver = await signIn(RECEIVER);
  const sender = await signIn(SENDER);
  const conversationId = await openThread(sender.accessToken, receiver.account.id);
  console.log(`\n══ ${RECEIVER} ← ${SENDER} · thread ${conversationId} ══`);

  console.log('\n── the wire ──');
  await assertWireFormat(receiver.accessToken, sender.accessToken, conversationId);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
  });
  await context.addInitScript(
    ([t, r, a]) => {
      localStorage.setItem('token', t);
      localStorage.setItem('refresh_token', r);
      localStorage.setItem('active_account', a);
    },
    [receiver.accessToken, receiver.refreshToken, JSON.stringify(receiver.account)]
  );

  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && console.log('  ! console:', m.text().slice(0, 140)));

  // ── The badge moves from somewhere that is not the chat ──────────────────
  console.log('\n── the badge, from the dashboard ──');
  // `networkidle` never fires: the SSE stream is a request that stays open.
  await page.goto(`${APP}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('a[href="/messages"]', { timeout: 20_000 });
  await page.waitForTimeout(3000);

  const badge = page.locator('a[href="/messages"] .side-nav__menu-badge');
  const readBadge = async () =>
    (await badge.count()) ? (await badge.first().innerText()).trim() : '';

  const before = await readBadge();
  await send(sender.accessToken, conversationId, `badge probe ${Date.now()}`);
  await page.waitForTimeout(2500);
  const after = await readBadge();

  check(
    after !== before && after !== '',
    'sidebar badge moves with NO reload, while on another page',
    `${before || '(none)'} → ${after || '(none)'}`
  );
  await page.screenshot({ path: 'screenshots/realtime-badge.png' });

  // ── A bubble lands in an open thread ─────────────────────────────────────
  console.log('\n── the open thread ──');
  await page.goto(`${APP}/messages`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('.chat', { timeout: 20_000 });
  await page.waitForTimeout(2000);
  await page.locator('button.thread').first().click();
  await page.waitForTimeout(2000);

  const bubblesBefore = await page.locator('.bubble').count();
  const marker = `bubble probe ${Date.now()}`;
  await send(sender.accessToken, conversationId, marker);
  await page.waitForTimeout(2500);

  check(
    (await page.locator('.bubble').count()) === bubblesBefore + 1,
    'a bubble appears live in the open thread',
    `${bubblesBefore} → ${await page.locator('.bubble').count()}`
  );
  check(
    (await page.getByText(marker).count()) > 0,
    'the new message text is on screen without a reload'
  );
  await page.screenshot({ path: 'screenshots/realtime-bubble.png' });

  // ── Reading it puts the badge away ───────────────────────────────────────
  await page.waitForTimeout(2000);
  check((await readBadge()) === '', 'badge clears once the thread is read');

  await browser.close();

  console.log(
    failures === 0
      ? '\nAll realtime checks passed.'
      : `\n${failures} realtime check(s) FAILED.`
  );
  process.exit(failures === 0 ? 0 : 1);
})();
