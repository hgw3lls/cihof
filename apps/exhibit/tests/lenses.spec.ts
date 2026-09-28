import { expect, test } from '@playwright/test';
import { begin, choose } from './visit.ts';

/**
 * Every lens is the same wall arranged another way. Arranging People moves
 * the faces and never chooses or unchooses anybody; the person chosen comes
 * along to the next lens.
 */
test('arranging People moves the faces and keeps the chosen person', async ({ page }) => {
  await begin(page);
  const face = page.locator('.tile[aria-label="Jeanette Grasselli Brown"]');
  const before = await face.boundingBox();
  await choose(page, 'Jeanette Grasselli Brown');

  await page.getByRole('button', { name: 'By community' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Everyone, by community');
  await expect.poll(async () => (await face.boundingBox())?.x).not.toBe(before?.x);
  await expect(page.locator('.sheet__name')).toHaveText('Jeanette Grasselli Brown');
  await expect(page.locator('.tile')).toHaveCount(111);
});

test('the letter rail steps back everyone else, and waits while somebody is chosen', async ({ page }) => {
  await begin(page);
  const rail = page.getByRole('navigation', { name: 'Letters' });
  await rail.getByRole('button', { name: 'M', exact: true }).click();
  await expect(rail.getByRole('button', { name: 'M', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const opacity = (name: string) => page.locator(`.tile[aria-label="${name}"]`).evaluate((el) => getComputedStyle(el).opacity);
  await expect.poll(() => opacity('Alex Machaskee')).toBe('1');
  await expect.poll(() => opacity('Jeanette Grasselli Brown')).toBe('0.28');

  await choose(page, 'Alex Machaskee');
  await expect(rail.getByRole('button', { name: 'M', exact: true })).toBeDisabled();
});

test('the chosen person carries across to Years, on their class', async ({ page }) => {
  await begin(page);
  await choose(page, 'Jeanette Grasselli Brown');
  const lensbar = page.getByRole('navigation', { name: 'Ways to explore' });
  await lensbar.getByRole('button', { name: /^Years/ }).click();
  await expect(page.locator('.sheet__name')).toHaveText('Jeanette Grasselli Brown');
  await expect(page.getByRole('navigation', { name: 'Induction classes' }).getByRole('button', { name: '2010' })).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.years__year')).toContainText('2010');
});

test('two faces chosen together are set side by side', async ({ page }) => {
  await begin(page);
  await choose(page, 'Alex Machaskee');
  // Shift with a second face does on a keyboard and mouse what two fingers do on the wall.
  await page.locator('.tile[aria-label="Jeanette Grasselli Brown"]').click({ modifiers: ['Shift'] });
  await expect(page.locator('.pair')).toBeVisible();
  await expect(page.locator('.pair__name')).toHaveText(['Alex Machaskee', 'Jeanette Grasselli Brown']);
  await expect(page.locator('.pair__share')).not.toBeEmpty();
  await page.locator('.pair__close').click();
  await expect(page.locator('.sheet[data-open]')).toHaveCount(0);
});

test('Years shows one class at a time, and a year touched brings its class', async ({ page }) => {
  await begin(page);
  await page.getByRole('navigation', { name: 'Ways to explore' }).getByRole('button', { name: /^Years/ }).click();
  const years = page.getByRole('navigation', { name: 'Induction classes' });
  const newest = years.getByRole('button').first();
  await expect(newest).toHaveAttribute('aria-current', 'true');
  const shown = () => page.locator('.tile:not([aria-hidden="true"])').count();
  const before = await shown();
  expect(before).toBeGreaterThan(0);
  await years.getByRole('button', { name: '2010' }).click();
  await expect(years.getByRole('button', { name: '2010' })).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.years__year')).toContainText('2010');
  await expect.poll(shown).toBe(13);
});

test('a person chosen in Years can be opened with one more touch', async ({ page }) => {
  await begin(page);
  await page.getByRole('navigation', { name: 'Ways to explore' }).getByRole('button', { name: /^Years/ }).click();
  const tile = page.locator('.tile:not([aria-hidden="true"])').first();
  const name = (await tile.getAttribute('aria-label')) ?? '';
  await tile.click();
  await expect(page.locator('.sheet__name')).toHaveText(name);
  await page.getByRole('button', { name: 'Read their story' }).click();
  await expect(page.locator('#recordTitle')).toHaveText(name);
});
