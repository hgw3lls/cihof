import { expect, test } from '@playwright/test';
import { begin } from './visit.ts';

/**
 * The About words are a curator's, shown only once approved. A release with no
 * approved words offers no About at all; one with them opens a panel that
 * returns the visitor to the key they used.
 */

test('with no approved About words, no About is offered', async ({ page }) => {
  await page.route('**/data/exhibit.json', async (route) => {
    const bundle = await (await route.fetch()).json();
    await route.fulfill({ json: { ...bundle, about: null } });
  });
  await begin(page);
  await expect(page.locator('.lensbar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'About', exact: true })).toHaveCount(0);
});

test('approved About words open in a panel, in paragraphs, and Close returns to the key', async ({ page }) => {
  await page.route('**/data/exhibit.json', async (route) => {
    const bundle = await (await route.fetch()).json();
    await route.fulfill({ json: { ...bundle, about: { body: 'First paragraph.\n\nSecond paragraph.' } } });
  });
  await begin(page);
  const key = page.getByRole('button', { name: 'About', exact: true });
  await key.click();

  const panel = page.locator('dialog.about');
  await expect(panel.getByRole('heading', { name: 'About the Hall of Fame' })).toBeFocused();
  await expect(panel.locator('p')).toHaveText(['First paragraph.', 'Second paragraph.']);

  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(key).toBeFocused();
});

test('with About offered, every key in the aid column is still a full touch target', async ({ page }) => {
  await page.route('**/data/exhibit.json', async (route) => {
    const bundle = await (await route.fetch()).json();
    await route.fulfill({ json: { ...bundle, about: { body: 'Words.' } } });
  });
  await begin(page);
  const heights = await page.locator('.lensbar__aid > button').evaluateAll((keys) => keys.map((key) => (key as HTMLElement).offsetHeight));
  expect(heights).toHaveLength(3);
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(48);
});

test('Start over closes About, so the next visitor does not meet it open', async ({ page }) => {
  await page.route('**/data/exhibit.json', async (route) => {
    const bundle = await (await route.fetch()).json();
    await route.fulfill({ json: { ...bundle, about: { body: 'Words.' } } });
  });
  await begin(page);
  await page.getByRole('button', { name: 'About', exact: true }).click();
  await expect(page.locator('dialog.about')).toBeVisible();
  // Start over is behind the modal for a visitor; the idle reset reaches the same state.
  await page.evaluate(() => (document.querySelector('#restart') as HTMLButtonElement).click());
  await expect(page.locator('dialog.about')).toHaveCount(0);
  await page.locator('[data-begin]').click();
  await expect(page.locator('dialog.about')).toHaveCount(0);
});
