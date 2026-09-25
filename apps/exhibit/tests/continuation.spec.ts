import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { expect, test } from '@playwright/test';
import { begin } from './visit.ts';

/**
 * T18: the code a visitor scans must resolve to that same person's public
 * record, and never to localhost, a staff route or kiosk-only media.
 *
 * Verified by decoding the pixels actually drawn on the display rather than by
 * reading back the string that was passed in. A code is only as good as what a
 * phone camera sees.
 */
const person = { id: 'alex-machaskee-2010', name: 'Alex Machaskee' };
const expectedUrl = `https://clevelandinternationalhalloffame.com/cihof/people/${person.id}/`;

async function openShare(page: import('@playwright/test').Page) {
  await begin(page);

  await page.evaluate((name) => {
    const tile = [...document.querySelectorAll('.tile')].find((button) => button.textContent?.includes(name));
    (tile as HTMLButtonElement).click();
  }, person.name);

  await page.getByRole('button', { name: 'Read the record' }).click();
  await page.getByRole('button', { name: 'Take it with you' }).click();
  await expect(page.locator('.share canvas')).toBeVisible();
}

test('the rendered code decodes to that person on the public site', async ({ page }) => {
  await openShare(page);

  const shot = await page.locator('.share canvas').screenshot();
  const png = PNG.sync.read(shot);
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);

  expect(decoded?.data, 'the code a phone camera reads').toBe(expectedUrl);
});

test('the address is offered as text as well as a code', async ({ page }) => {
  await openShare(page);
  // A code is unusable to anyone who cannot hold a phone to the wall.
  await expect(page.locator('.share__url')).toHaveText('clevelandinternationalhalloffame.com/cihof/people/alex-machaskee-2010/');
});

test('the code never points anywhere a visitor cannot reach', async ({ page }) => {
  await openShare(page);
  const shot = await page.locator('.share canvas').screenshot();
  const png = PNG.sync.read(shot);
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data ?? '';

  expect(decoded.startsWith('https://')).toBe(true);
  for (const forbidden of ['localhost', '127.0.0.1', '192.168.', '/portal', '/admin', '/staff', 'media/videos']) {
    expect(decoded, `must not contain ${forbidden}`).not.toContain(forbidden);
  }
});

test('closing the code returns to the record it came from', async ({ page }) => {
  await openShare(page);
  await page.getByRole('button', { name: 'Close' }).first().click();
  await expect(page.locator('.share')).toHaveCount(0);
  await expect(page.locator('.record h2')).toHaveText(person.name);
});

test('a release with no reachable destination offers no code at all', async ({ page }) => {
  // The failure this guards against is an installed display showing a code that
  // resolves to the machine behind the wall. Better to offer nothing.
  await page.route('**/data/exhibit.json', async (route) => {
    const response = await route.fetch();
    const bundle = await response.json();
    await route.fulfill({ json: { ...bundle, continuationBase: null } });
  });

  await begin(page);
  await page.evaluate(() => {
    const tile = [...document.querySelectorAll('.tile')].find((button) => button.textContent?.includes('Alex Machaskee'));
    (tile as HTMLButtonElement).click();
  });
  await page.getByRole('button', { name: 'Read the record' }).click();

  await expect(page.locator('.record')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Take it with you' })).toHaveCount(0);
});

test('a destination that only resolves on this machine is refused', async ({ page }) => {
  await page.route('**/data/exhibit.json', async (route) => {
    const response = await route.fetch();
    const bundle = await response.json();
    await route.fulfill({ json: { ...bundle, continuationBase: 'https://localhost:4330/cihof/' } });
  });

  await begin(page);
  await page.evaluate(() => {
    const tile = [...document.querySelectorAll('.tile')].find((button) => button.textContent?.includes('Alex Machaskee'));
    (tile as HTMLButtonElement).click();
  });
  await page.getByRole('button', { name: 'Read the record' }).click();
  await page.getByRole('button', { name: 'Take it with you' }).click();

  // The panel opens and explains itself rather than drawing a code to nowhere.
  await expect(page.locator('.share canvas')).toHaveCount(0);
  await expect(page.locator('.share__problem')).toContainText('only works on this machine');
});
