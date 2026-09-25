import { expect, test, type Page } from '@playwright/test';
import { begin } from './visit.ts';

/**
 * Light and dark. The display's admin chooses (the kiosk app puts it on the
 * address); a film plays on black whichever is chosen.
 */
const ground = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const dark = 'rgb(18, 18, 17)';
const light = 'rgb(244, 242, 236)';

test('an installed display is dark by default, whatever the device prefers', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await begin(page);
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  expect(await ground(page)).toBe(dark);
});

test('the admin’s light choice turns the whole exhibit light', async ({ page }) => {
  await begin(page, './?theme=light');
  expect(await ground(page)).toBe(light);
  // Reading text is the dark ink.
  expect(await page.locator('.focus .prompt').evaluate((el) => getComputedStyle(el).color)).toBe('rgb(58, 57, 54)');
});

test('auto follows the device', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await begin(page, './?theme=auto');
  expect(await ground(page)).toBe(light);
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await ground(page)).toBe(dark);
});

test('the lockup is one colour on light paper, as the brand guide asks', async ({ page }) => {
  await begin(page, './?theme=light');
  const fill = await page.locator('.masthead .skyline').evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(fill).toBe('none');
  await begin(page, './?theme=dark');
  expect(await page.locator('.masthead .skyline').evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('gradient');
});

test('a film plays on black with light text, even in the light theme', async ({ page }) => {
  await begin(page, './?theme=light');
  const tiles = page.locator('.tile');
  for (let index = 0; index < 30; index += 1) {
    await tiles.nth(index).click();
    await page.getByRole('button', { name: 'Read the record' }).click();
    if (await page.getByRole('button', { name: /Watch the film/ }).isVisible()) break;
    await page.keyboard.press('Escape');
  }
  await page.getByRole('button', { name: /Watch the film/ }).click();
  const film = page.locator('dialog.film');
  await expect(film).toBeVisible();
  expect(await film.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(0, 0, 0)');
  expect(await film.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(242, 241, 236)');
});
