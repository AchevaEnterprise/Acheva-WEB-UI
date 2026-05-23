#!/usr/bin/env node
/**
 * Acheva UI Screenshot Tool
 *
 * Spins up a headless Chromium session, navigates to a route in the running
 * Angular dev server, and saves a high-DPI PNG that Claude can read and
 * compare against a Figma design.
 *
 * Usage (dev server must be running — `ng serve`):
 *   npm run screenshot                          → screenshots /login
 *   npm run screenshot -- /dashboard            → screenshots /dashboard
 *   npm run screenshot -- /result-management screenshots/rm.png
 *   AUTH_TOKEN=<jwt> npm run screenshot -- /dashboard
 *
 * Output is saved to screenshots/<timestamp>.png by default.
 * Claude reads the PNG via the Read tool to compare with Figma.
 */

import { chromium } from '@playwright/test';
import { resolve, dirname } from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL   = process.env.APP_URL   ?? 'http://localhost:4200';
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? '';

const route      = process.argv[2] ?? '/auth/login';
const outputArg  = process.argv[3];
const timestamp  = new Date().toISOString().replace(/[:.]/g, '-');
const outputFile = outputArg ?? `screenshots/${timestamp}.png`;
const outputPath = resolve(__dirname, '..', outputFile);

// Ensure output directory exists
mkdirSync(dirname(outputPath), { recursive: true });

// ─── Viewports to capture ──────────────────────────────────────────────────────
// We default to 1440 px (design baseline) but also save a 375 px mobile snap
// when a second --mobile flag is passed.
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  ...(process.argv.includes('--mobile')
    ? [{ name: 'mobile', width: 375, height: 812 }]
    : []),
];

(async () => {
  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    const vpSuffix = VIEWPORTS.length > 1 ? `-${vp.name}` : '';
    const vpOutput = outputPath.replace('.png', `${vpSuffix}.png`);

    const context = await browser.newContext({
      viewport:          { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,           // retina quality — matches Figma @2x export
      colorScheme:       'light',
    });

    const page = await context.newPage();

    // ── Inject auth token so protected routes render correctly ─────────────────
    if (AUTH_TOKEN) {
      await page.addInitScript((token) => {
        localStorage.setItem('access_token', token);
      }, AUTH_TOKEN);
    }

    try {
      await page.goto(`${BASE_URL}${route}`, {
        waitUntil: 'networkidle',
        timeout:   30_000,
      });

      // Let Angular finish any deferred rendering / animations
      await page.waitForTimeout(800);

      // Disable CSS animations so the screenshot is stable
      await page.addStyleTag({
        content: `*, *::before, *::after {
          animation-duration: 0ms !important;
          transition-duration: 0ms !important;
        }`,
      });

      await page.screenshot({
        path:       vpOutput,
        fullPage:   false,
        animations: 'disabled',
      });

      console.log(`✓ ${vp.name.padEnd(8)} → ${vpOutput}`);
    } catch (err) {
      console.error(`✗ ${vp.name}: ${err.message}`);
      if (err.message.includes('ERR_CONNECTION_REFUSED')) {
        console.error('  Is the Angular dev server running?  →  ng serve');
      }
    } finally {
      await context.close();
    }
  }

  await browser.close();

  console.log('');
  console.log('Claude: use the Read tool on the PNG path above to view and');
  console.log('compare with the Figma design. Run with --mobile for both sizes.');
})();
