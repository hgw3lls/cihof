import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.CIHOF_BASE_URL ?? 'http://127.0.0.1:4175/cihof/';
const output = resolve('artifacts/mg06-review');
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const captures = [];
const person = 'alex-machaskee-2010';
try {
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 960, height: 540 }, { width: 320, height: 700 }]) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce', serviceWorkers: 'block' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${baseUrl}?person=${person}`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Open full record for Alex Machaskee' }).waitFor();
      if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click();
      for (const state of ['record', 'reading', 'qr', 'links', 'years']) {
        if (state === 'record') await page.getByRole('button', { name: 'Open full record for Alex Machaskee' }).click();
        if (state === 'reading') await page.locator('.record-view__story').scrollIntoViewIfNeeded();
        if (state === 'qr') await page.getByRole('button', { name: 'TAKE THIS RECORD' }).click();
        if (state === 'links') {
          await page.keyboard.press('Escape');
          await page.getByRole('button', { name: 'LINKS', exact: true }).click();
        }
        if (state === 'years') await page.getByRole('button', { name: 'YEARS', exact: true }).click();
        await page.evaluate(() => document.fonts.ready);
        const file = `${viewport.width}-${theme}-${state}.png`;
        await page.screenshot({ path: resolve(output, file) });
        captures.push({ viewport, theme, state, file, errors: [...errors], overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
      }
      await context.close();
    }
  }
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, serviceWorkers: 'block' });
  await page.goto(`${baseUrl}?kiosk=1&reach=1`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(output, 'reachable-prototype.png') });
  await page.close();

  const largeText = await browser.newPage({ viewport: { width: 960, height: 720 }, serviceWorkers: 'block' });
  await largeText.goto(`${baseUrl}?person=${person}`, { waitUntil: 'networkidle' });
  await largeText.getByRole('button', { name: 'Open full record for Alex Machaskee' }).click();
  await largeText.evaluate(() => {
    const elements = [...document.querySelectorAll('.installation *')];
    const sizes = elements.map((element) => parseFloat(getComputedStyle(element).fontSize));
    elements.forEach((element, index) => { element.style.fontSize = `${sizes[index] * 2}px`; });
  });
  await largeText.locator('.record-view__story').scrollIntoViewIfNeeded();
  await largeText.evaluate(() => document.fonts.ready);
  await largeText.screenshot({ path: resolve(output, 'text-200-percent.png') });
  await largeText.close();

  if (process.env.CIHOF_CHECK_PUBLIC_QR === '1') {
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const url = `https://clevelandinternationalhalloffame.com/${person}/`;
    try {
      const response = await phone.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await phone.getByRole('heading', { name: 'Alex Machaskee', exact: true }).waitFor();
      await phone.screenshot({ path: resolve(output, 'public-continuation-phone.png'), fullPage: true });
      await writeFile(resolve(output, 'public-continuation.json'), JSON.stringify({ url: phone.url(), status: response?.status(), samePersonHeading: true,
        requestedViewport: { width: 390, height: 844 },
        layout: await phone.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth, scale: visualViewport?.scale,
          viewportMeta: document.querySelector('meta[name=viewport]')?.getAttribute('content'), bodyFont: getComputedStyle(document.body).fontSize })),
        checkedAt: new Date().toISOString() }, null, 2));
    } catch (error) {
      await writeFile(resolve(output, 'public-continuation.json'), JSON.stringify({ url, error: String(error), checkedAt: new Date().toISOString() }, null, 2));
    } finally { await phone.close(); }
  }
} finally { await browser.close(); }
await writeFile(resolve(output, 'manifest.json'), JSON.stringify({ capturedAt: new Date().toISOString(), baseUrl, captures }, null, 2));
const failures = captures.filter((item) => item.errors.length || item.overflow);
console.log(`${captures.length} state captures plus reachable prototype; ${failures.length} with errors or page overflow.`);
if (failures.length) process.exitCode = 1;
