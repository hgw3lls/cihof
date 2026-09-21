import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.CIHOF_BASE_URL ?? 'http://127.0.0.1:4175/cihof/';
const directory = resolve('artifacts/mg05-review');
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const captures = [];
try {
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      await page.locator('.person-tile').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click();
      for (const state of ['neutral', 'filtered', 'selected', 'record']) {
        if (state === 'filtered') await page.getByRole('combobox', { name: 'Filter by contribution' }).selectOption('Education');
        if (state === 'selected') {
          await page.getByRole('combobox', { name: 'Filter by contribution' }).selectOption('');
          await page.getByRole('searchbox', { name: 'Find a person or year' }).fill('Alex Machaskee');
          await page.getByRole('button', { name: /Select Alex Machaskee/ }).click();
        }
        if (state === 'record') await page.getByRole('button', { name: 'Open full record for Alex Machaskee' }).click();
        await page.evaluate(() => document.fonts.ready);
        const file = `${viewport.width}-${theme}-${state}.png`;
        await page.screenshot({ path: resolve(directory, file), fullPage: true });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        captures.push({ viewport, theme, state, file, overflow, errors: [...errors] });
      }
      await context.close();
    }
  }
} finally { await browser.close(); }
await writeFile(resolve(directory, 'manifest.json'), JSON.stringify({ capturedAt: new Date().toISOString(), baseUrl, captures }, null, 2));
const failures = captures.filter((capture) => capture.overflow || capture.errors.length);
console.log(`Captured ${captures.length} images; ${failures.length} captures with overflow or browser errors.`);
if (failures.length) process.exitCode = 1;
