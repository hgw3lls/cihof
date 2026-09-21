import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.CIHOF_BASE_URL ?? 'http://127.0.0.1:4175/cihof/';
const outputDirectory = resolve(process.env.CIHOF_MG01_DIR ?? 'artifacts/mg01-review');
const fixtureId = 'alex-machaskee-2010';
const longName = 'Alexandra Machaskee With An Extraordinarily Long Museum Label';

const states = [
  {
    name: 'selected-person-desktop',
    viewport: { width: 1920, height: 1080 },
    path: `?person=${fixtureId}`,
  },
  {
    name: 'no-image-deep-link-mobile',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    path: `?person=${fixtureId}`,
    mutate(person) {
      person.primaryImageUrl = '';
    },
    ready: async (page) => page.locator('.focus .photo[data-image-state="missing"]').waitFor(),
  },
  {
    name: 'broken-image-long-name-desktop',
    viewport: { width: 1920, height: 1080 },
    path: `?person=${fixtureId}`,
    mutate(person) {
      person.name = longName;
      person.primaryImageUrl = '/media/images/__mg01-broken__/primary.jpg';
    },
    ready: async (page) => page.locator('.focus .photo[data-image-state="failed"]').waitFor(),
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
    await page.addInitScript(() => {
      window.localStorage.setItem('cihof.kiosk-settings.v1', JSON.stringify({ idleTimeoutMs: 1_200_000 }));
      window.localStorage.setItem('cihof-color-mode', 'light');
    });

    if (state.mutate) {
      await page.route('**/data/cihof-runtime-data.json', async (route) => {
        const response = await route.fetch();
        const bundle = await response.json();
        const person = bundle.inductees?.find((item) => item.id === fixtureId);
        if (!person) throw new Error(`Fixture person ${fixtureId} is missing from the runtime bundle.`);
        state.mutate(person);
        await route.fulfill({ response, json: bundle });
      });
    }

    await page.goto(new URL(state.path, baseUrl).href, { waitUntil: 'networkidle' });
    await page.locator('.installation').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await state.ready?.(page);
    await page.waitForTimeout(250);

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
console.log(`Captured ${captures.length} MG-01 review images in ${outputDirectory}.`);
console.log(`Recorded ${errorCount} console or page errors.`);
