import { expect, test } from '@playwright/test';
import { begin } from './visit.ts';

/**
 * The search and filters belong to People. Moving to another lens shows the
 * whole collection there; the person chosen comes along, and the filters are
 * still set on returning to People.
 */
test('filters narrow People only; the chosen person carries across', async ({ page }) => {
  await begin(page);
  const lensbar = page.getByRole('navigation', { name: 'Ways to explore' });
  await lensbar.getByRole('button', { name: 'Years' }).click();
  const classes = page.getByRole('navigation', { name: 'Induction classes' }).getByRole('button');
  const allClasses = await classes.count();
  expect(allClasses).toBeGreaterThan(1);

  await lensbar.getByRole('button', { name: 'People' }).click();
  const everyone = await page.locator('.tile').count();
  await page.getByLabel('Find a person by name or year').fill('Grasselli');
  await expect(page.locator('.tile')).toHaveCount(1);
  await page.locator('.tile').first().click();
  expect(await page.locator('.tile').count()).toBeLessThan(everyone);

  await lensbar.getByRole('button', { name: 'Years' }).click();
  await expect(classes).toHaveCount(allClasses);
  await expect(page.getByRole('group', { name: 'Selected person' })).toContainText('Jeanette Grasselli Brown');
  await expect(page.getByRole('navigation', { name: 'Induction classes' }).getByRole('button', { name: '2010' })).toHaveAttribute('aria-current', 'true');

  await lensbar.getByRole('button', { name: 'People' }).click();
  await expect(page.getByLabel('Find a person by name or year')).toHaveValue('Grasselli');
  await expect(page.locator('.tile')).toHaveCount(1);
});
