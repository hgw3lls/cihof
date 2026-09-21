import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * The companion route is read on a phone by someone who has just scanned a code
 * at the wall. It has no JavaScript, so these checks are about the HTML itself.
 */
const person = 'people/alex-machaskee-2010/';

test('a person page has no detectable accessibility violations', async ({ page }) => {
  await page.goto(person);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
});

test('the collection has no detectable accessibility violations', async ({ page }) => {
  await page.goto('.');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
});

test('a person page reads without JavaScript and without sideways scrolling', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(new URL(person, process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4321/cihof/').href);

  await expect(page.locator('h1')).toHaveText('Alex Machaskee');
  await expect(page.locator('.bio p').first()).not.toBeEmpty();

  // The failure this route answers was a 700px document at a 390px viewport.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'the page must not scroll sideways on a phone').toBeLessThanOrEqual(0);
  await context.close();
});

test('every published page is reachable from the collection', async ({ page }) => {
  await page.goto('.');
  await expect(page.locator('.people li')).toHaveCount(111);
});

test('no unapproved portrait is published', async ({ page }) => {
  await page.goto('.');
  const broken = await page.evaluate(async () => {
    const sources = [...document.querySelectorAll<HTMLImageElement>('.people img')].map((image) => image.src);
    const checks = await Promise.all(sources.map(async (src) => ({ src, ok: (await fetch(src)).ok })));
    return checks.filter((check) => !check.ok).map((check) => check.src);
  });
  expect(broken, 'every referenced portrait must exist in the artifact').toEqual([]);
});
