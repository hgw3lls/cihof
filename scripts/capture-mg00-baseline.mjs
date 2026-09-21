import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.CIHOF_BASE_URL ?? 'http://127.0.0.1:4176/cihof/';
const outputDirectory = resolve(process.env.CIHOF_BASELINE_DIR ?? 'artifacts/mg00-baseline');
const viewports = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1920, height: 1080 },
  { width: 3840, height: 2160 },
];

const states = [
  { name: 'people-neutral', path: '' },
  {
    name: 'people-selected',
    path: '?person=alex-machaskee-2010',
  },
  {
    name: 'people-searched',
    path: '',
    prepare: async (page) => page.getByRole('searchbox', { name: 'Find a person or year' }).fill('Alex Machaskee'),
  },
  {
    name: 'people-no-results',
    path: '',
    prepare: async (page) => page.getByRole('searchbox', { name: 'Find a person or year' }).fill('No such inductee'),
  },
  {
    name: 'full-record',
    path: '?person=alex-machaskee-2010',
    prepare: async (page) => page.getByRole('button', { name: 'Open full record for Alex Machaskee' }).click(),
  },
  { name: 'links-neutral', path: '?scene=links' },
  { name: 'links-selected', path: '?scene=links&person=alex-machaskee-2010' },
  { name: 'years-neutral', path: '?scene=years' },
  { name: 'years-selected', path: '?scene=years&person=alex-machaskee-2010' },
  {
    name: 'pending-media',
    path: '?scene=years',
    prepare: async (page) => {
      await page.getByRole('button', { name: /Jump to 2015/ }).click();
      const filmButton = page.getByRole('button', { name: /Open film 1 for Bishop Anthony Pilla/ });
      if (await filmButton.count() === 0) {
        return { note: 'Pending film controls are absent from the public artifact as required.' };
      }
      await filmButton.click();
      await page.locator('.film-projection--pending').waitFor();
      return { note: 'Pending film state is available in this target.' };
    },
  },
  {
    name: 'qr-dialog',
    path: '?person=alex-machaskee-2010',
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Open full record for Alex Machaskee' }).click();
      await page.getByRole('button', { name: 'TAKE THIS RECORD' }).click();
      await page.locator('.qr-continuation__code img').waitFor();
    },
  },
  {
    name: 'dark-theme',
    path: '',
    prepare: async (page) => page.getByRole('button', { name: 'Switch to dark mode' }).click(),
  },
  {
    name: 'keyboard-focus',
    path: '',
    prepare: async (page) => page.keyboard.press('Tab'),
  },
  { name: 'invalid-person', path: '?person=not-a-canonical-person' },
  { name: 'reach-mode', path: '?reach=1' },
  { name: 'reduced-motion', path: '', reducedMotion: 'reduce' },
];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch();
const browserVersion = browser.version();
const captures = [];

try {
  for (const viewport of viewports) {
    for (const state of states) {
      const context = await browser.newContext({
        viewport,
        deviceScaleFactor: 1,
        colorScheme: 'light',
        reducedMotion: state.reducedMotion ?? 'no-preference',
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

      await page.goto(new URL(state.path, baseUrl).href, { waitUntil: 'networkidle' });
      await page.locator('.installation').waitFor();
      await page.evaluate(() => document.fonts.ready);
      const setup = await state.prepare?.(page);
      await page.waitForTimeout(250);
      await settleAnimations(page);

      const fileName = `${viewport.width}x${viewport.height}-${state.name}.jpg`;
      await page.screenshot({
        path: resolve(outputDirectory, fileName),
        type: 'jpeg',
        quality: 82,
        fullPage: false,
      });
      captures.push({
        viewport,
        deviceScaleFactor: 1,
        state: state.name,
        file: fileName,
        url: page.url(),
        consoleErrors,
        pageErrors,
        note: setup?.note ?? null,
      });
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const manifest = {
  capturedAt: new Date().toISOString(),
  baseUrl,
  browser: {
    name: chromium.name(),
    version: browserVersion,
  },
  platform: process.platform,
  architecture: process.arch,
  node: process.version,
  captureCount: captures.length,
  states: states.map((state) => state.name),
  viewports,
  captures,
};
await writeFile(resolve(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const errorCount = captures.reduce((count, capture) => count + capture.consoleErrors.length + capture.pageErrors.length, 0);
console.log(`Captured ${captures.length} MG-00 baseline images in ${outputDirectory}.`);
console.log(`Recorded ${errorCount} console or page errors.`);

// Screenshots are baseline evidence, so a frame must not be captured mid-transition.
// Running states are now captured with motion enabled, so wait for in-flight
// animations to finish. Indefinite animations never settle; the race bounds them.
async function settleAnimations(page) {
  await page.evaluate(async () => {
    const running = document.getAnimations().filter((animation) => animation.playState === 'running');
    if (running.length === 0) return;
    await Promise.race([
      Promise.allSettled(running.map((animation) => animation.finished)),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  });
}
