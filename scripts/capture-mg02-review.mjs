import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.CIHOF_BASE_URL ?? 'http://127.0.0.1:4175/cihof/';
const outputDirectory = resolve(process.env.CIHOF_MG02_DIR ?? 'artifacts/mg02-review');

const states = [
  {
    name: 'public-neutral-desktop',
    viewport: { width: 1920, height: 1080 },
    path: '',
  },
  {
    name: 'public-neutral-mobile',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    path: '',
  },
  {
    name: 'kiosk-warning-qr-desktop',
    viewport: { width: 1920, height: 1080 },
    path: '?kiosk=1&person=alex-machaskee-2010',
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Open full record for Alex Machaskee' }).click();
      await page.getByRole('button', { name: 'TAKE THIS RECORD' }).click();
      await page.locator('.qr-continuation__code img').waitFor();
      await page.clock.fastForward(12_100);
      await page.locator('.session-warning').waitFor();
    },
  },
  {
    name: 'kiosk-warning-record-mobile',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    path: '?kiosk=1&person=alex-machaskee-2010',
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Open full record for Alex Machaskee' }).tap();
      await page.clock.fastForward(12_100);
      await page.locator('.session-warning').waitFor();
    },
  },
];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
const browserVersion = browser.version();
const captures = [];

try {
  for (const state of states) {
    const context = await browser.newContext({
      viewport: state.viewport,
      hasTouch: state.hasTouch,
      serviceWorkers: 'block',
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.clock.install({ time: new Date('2026-09-20T12:00:00Z') });
    await page.addInitScript(() => {
      window.localStorage.setItem('cihof.kiosk-settings.v1', JSON.stringify({ idleTimeoutMs: 15_000, idleWarningMs: 3_000 }));
      window.localStorage.setItem('cihof-color-mode', 'light');
    });

    await page.goto(new URL(state.path, baseUrl).href, { waitUntil: 'networkidle' });
    await page.locator('.installation').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
    await state.prepare?.(page);

    const fileName = `${state.viewport.width}x${state.viewport.height}-${state.name}.png`;
    await page.screenshot({ path: resolve(outputDirectory, fileName), fullPage: false });
    captures.push({
      state: state.name,
      viewport: state.viewport,
      hasTouch: Boolean(state.hasTouch),
      file: fileName,
      url: page.url(),
      consoleErrors,
      pageErrors,
    });
    await context.close();
  }
} finally {
  await browser.close();
}

const manifest = {
  capturedAt: new Date().toISOString(),
  baseUrl,
  browser: { name: chromium.name(), version: browserVersion },
  platform: process.platform,
  architecture: process.arch,
  node: process.version,
  captureCount: captures.length,
  captures,
};
await writeFile(resolve(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const errorCount = captures.reduce((count, capture) => count + capture.consoleErrors.length + capture.pageErrors.length, 0);
console.log(`Captured ${captures.length} MG-02 review images in ${outputDirectory}.`);
console.log(`Recorded ${errorCount} console or page errors.`);
