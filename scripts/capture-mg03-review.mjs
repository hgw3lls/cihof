import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.CIHOF_BASE_URL ?? 'http://127.0.0.1:4175/cihof/';
const outputDirectory = resolve(process.env.CIHOF_MG03_DIR ?? 'artifacts/mg03-review');
const fixtureRoot = resolve('tests/fixtures/media');
const fixtureBase = '/media/videos/__mg03__';

const states = [
  { name: 'chronology-zero-films-desktop', viewport: { width: 1920, height: 1080 }, path: '?scene=years' },
  { name: 'chronology-zero-films-mobile', viewport: { width: 390, height: 844 }, hasTouch: true, path: '?scene=years' },
  { name: 'approved-film-desktop', viewport: { width: 1920, height: 1080 }, path: '?scene=years', withFilm: true },
  { name: 'approved-transcript-mobile', viewport: { width: 390, height: 844 }, hasTouch: true, path: '?scene=years', withFilm: true, transcript: true },
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
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    if (state.withFilm) await installFilmFixture(page);
    await page.goto(new URL(state.path, baseUrl).href, { waitUntil: 'networkidle' });
    await page.locator('.year-person').first().waitFor();
    await page.evaluate(() => document.fonts.ready);

    if (state.withFilm) {
      await page.getByRole('button', { name: /Jump to 2015 induction class/ }).click();
      await page.getByRole('button', { name: /Watch film 1 for Bishop Anthony Pilla/ }).click();
      await page.locator('.film-projection video').evaluate((video) => new Promise((resolveLoad) => {
        if (video.readyState >= 1) resolveLoad(undefined);
        else video.addEventListener('loadedmetadata', () => resolveLoad(undefined), { once: true });
      }));
      await page.locator('.film-projection__transcript-body').waitFor({ state: 'attached' });
      if (state.transcript) await page.getByRole('tab', { name: 'TRANSCRIPT' }).click();
    }

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
console.log(`Captured ${captures.length} MG-03 review images in ${outputDirectory}.`);
console.log(`Recorded ${errorCount} console or page errors.`);

async function installFilmFixture(page) {
  await page.route('**/data/cihof-runtime-data.json', async (route) => {
    const response = await route.fetch();
    const bundle = await response.json();
    bundle.mediaManifest.assets['bishop-anthony-pilla-2015'].videos = [{
      runtimePath: `${fixtureBase}/chronology-test.mp4`,
      posterRuntimePath: `${fixtureBase}/chronology-test.png`,
      captionRuntimePath: `${fixtureBase}/chronology-test.en.vtt`,
      transcriptRuntimePath: `${fixtureBase}/chronology-test.transcript.txt`,
      durationSeconds: 3,
      rightsStatus: 'approved',
      captionStatus: 'approved',
      transcriptStatus: 'approved',
      approvedForPublicWeb: true,
    }];
    await route.fulfill({ response, json: bundle });
  });
  await page.route(`**${fixtureBase}/chronology-test.mp4`, (route) => route.fulfill({ path: resolve(fixtureRoot, 'chronology-test.mp4'), contentType: 'video/mp4' }));
  await page.route(`**${fixtureBase}/chronology-test.png`, (route) => route.fulfill({ path: resolve(fixtureRoot, 'chronology-test.png'), contentType: 'image/png' }));
  await page.route(`**${fixtureBase}/chronology-test.en.vtt`, (route) => route.fulfill({ path: resolve(fixtureRoot, 'chronology-test.en.vtt'), contentType: 'text/vtt' }));
  await page.route(`**${fixtureBase}/chronology-test.transcript.txt`, (route) => route.fulfill({ path: resolve(fixtureRoot, 'chronology-test.transcript.txt'), contentType: 'text/plain' }));
}
