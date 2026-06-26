#!/usr/bin/env node
/**
 * Responsive Design Visual Verification
 *
 * Tests critical pages at 1000px viewport to catch spacing/layout issues
 * before committing responsive changes.
 *
 * Usage:
 *   npm run verify:responsive
 */

import { chromium } from '@playwright/test';
import { resolve, dirname } from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.APP_URL ?? 'http://localhost:4200';

const VIEWPORT = { width: 1000, height: 1200 };
const PAGES = [
  { name: 'login', path: '/auth/login', requiresAuth: false },
];

mkdirSync(resolve(__dirname, '..', 'screenshots'), { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });

  console.log(`\n📱 Responsive Design Verification at ${VIEWPORT.width}px viewport\n`);

  for (const page of PAGES) {
    try {
      const context = await browser.newContext({ viewport: VIEWPORT });
      const browserPage = await context.newPage();

      await browserPage.goto(`${BASE_URL}${page.path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = resolve(
        __dirname,
        '..',
        'screenshots',
        `responsive-${page.name}-${VIEWPORT.width}px-${timestamp}.png`
      );

      await browserPage.screenshot({ path: filename });
      console.log(`✓ ${page.name} → screenshots/responsive-${page.name}-${VIEWPORT.width}px-${timestamp}.png`);

      await context.close();
    } catch (error) {
      console.error(`✗ ${page.name} → ${error.message}`);
    }
  }

  await browser.close();
  console.log('\n✓ Responsive verification complete. Review screenshots before committing.\n');
})();
