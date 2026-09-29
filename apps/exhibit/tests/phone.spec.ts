import { expect, test } from '@playwright/test';
import { begin, choose } from './visit.ts';

/**
 * The public site on a phone held upright: the stage takes the screen's shape
 * rather than showing a small landscape wall in a band across it. The suite
 * runs the display's build, so it asks for the public site's fit by address.
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('an upright phone is filled by the phone arrangement', async ({ page }) => {
  await begin(page, '.?fit=fill');
  await expect(page.locator('html')).toHaveAttribute('data-shape', 'phone');
  const stage = await page.locator('.stage').boundingBox();
  expect(stage && Math.round(stage.width)).toBe(390);
  expect(stage && Math.round(stage.height)).toBe(844);
  // The type stays readable: the header is at least 20 screen pixels.
  const size = await page.getByRole('heading', { level: 1 }).evaluate((el) => el.getBoundingClientRect().height);
  expect(size).toBeGreaterThan(20);
  await expect(page.locator('.tile')).toHaveCount(111);
});

test('a chosen person\'s sheet rises from below, and the wall above stays in view', async ({ page }) => {
  await begin(page, '.?fit=fill');
  await choose(page, 'Jeanette Grasselli Brown');
  const sheet = await page.locator('.sheet[data-open]').boundingBox();
  const face = await page.locator('.tile[aria-label="Jeanette Grasselli Brown"]').boundingBox();
  expect(sheet && sheet.x).toBe(0);
  expect(sheet && face && face.y + face.height <= sheet.y + 1).toBe(true);
  await page.getByRole('button', { name: 'Read their story' }).click();
  await expect(page.locator('#recordTitle')).toHaveText('Jeanette Grasselli Brown');
  const next = page.getByRole('button', { name: 'Next page' });
  if (await next.isEnabled()) {
    await next.click();
    await expect(page.getByText(/^Page 2 of/)).toBeVisible();
  }
});

test('search drops from above, clear of a phone\'s own keyboard', async ({ page }) => {
  await begin(page, '.?fit=fill');
  await page.locator('.lensbar__search').click();
  const input = page.getByRole('searchbox').or(page.locator('.search input'));
  await expect(input.first()).toBeFocused();
  const box = await input.first().boundingBox();
  expect(box && box.y < 844 / 3).toBe(true);
});
