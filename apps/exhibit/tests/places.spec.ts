import { expect, test, type Page } from '@playwright/test';
import { begin } from './visit.ts';

/**
 * Places, and the step from a portrait to a record in the lenses that have no
 * focus column of their own.
 *
 * A visitor at the wall cannot be expected to scroll a list they do not know
 * is longer than the screen, or to guess at a double tap. So every place is
 * in view at once, and a chosen person always comes with a visible way in.
 */

async function openPlaces(page: Page) {
  await begin(page);
  await page.getByRole('button', { name: 'Places', exact: true }).click();
  await expect(page.locator('.places__place h2')).toBeVisible();
}

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 900 }]) {
  test(`every place is in view at once at ${viewport.width} × ${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openPlaces(page);
    const hidden = await page.locator('.places__index ul').evaluate((list) => {
      const box = list.getBoundingClientRect();
      return [...list.querySelectorAll('button')]
        .filter((button) => {
          const row = button.getBoundingClientRect();
          return row.top < box.top - 1 || row.bottom > box.bottom + 1;
        })
        .map((button) => button.textContent);
    });
    expect(hidden).toEqual([]);
    expect(await page.locator('.places__index button').count()).toBeGreaterThan(0);
  });
}

test('touching a place shows it, with the people a curator tied to it', async ({ page }) => {
  await openPlaces(page);
  const second = page.locator('.places__index button').nth(1);
  const name = (await second.locator('.places__name').textContent())?.trim() ?? '';
  await second.click();
  await expect(second).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.places__place h2')).toHaveText(name);
});

test('a person chosen in Places can be opened with one more touch', async ({ page }) => {
  await openPlaces(page);
  await expect(page.getByRole('button', { name: 'Read the record' })).toHaveCount(0);
  const tile = page.locator('.places__people .tile').first();
  const name = (await tile.locator('.caption').textContent())?.trim() ?? '';
  await tile.click();
  await expect(page.locator('.chosen__name')).toHaveText(name);
  const open = page.getByRole('button', { name: 'Read the record' });
  await expect(open).toBeInViewport();
  await open.click();
  await expect(page.locator('#recordTitle')).toHaveText(name);
});

test('a person chosen in Years can be opened with one more touch', async ({ page }) => {
  await begin(page);
  await page.getByRole('button', { name: 'Years', exact: true }).click();
  const tile = page.locator('.years__grid .tile').first();
  const name = (await tile.locator('.caption').textContent())?.trim() ?? '';
  await tile.click();
  await expect(page.locator('.chosen__name')).toHaveText(name);
  await page.getByRole('button', { name: 'Read the record' }).click();
  await expect(page.locator('#recordTitle')).toHaveText(name);
});

test('opening Places with somebody chosen opens on a place tied to them', async ({ page }) => {
  await openPlaces(page);
  const place = page.locator('.places__index button').nth(2);
  await place.click();
  const tile = page.locator('.places__people .tile').first();
  const name = (await tile.locator('.caption').textContent())?.trim() ?? '';
  await tile.click();
  await page.getByRole('button', { name: 'People', exact: true }).click();
  await page.getByRole('button', { name: 'Places', exact: true }).click();
  await expect(page.locator('.places__people .tile[aria-pressed="true"] .caption')).toHaveText(name);
  await expect(page.locator('.chosen__name')).toHaveText(name);
});
