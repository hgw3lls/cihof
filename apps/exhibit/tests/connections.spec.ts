import { expect, test, type Page } from '@playwright/test';
import { begin } from './visit.ts';

/**
 * The Connections map, in a browser.
 *
 * The unit tests cover the arrangement. These cover the things only a real
 * display shows: that the lens is offered at all, that touching a portrait
 * moves the map under it, and that what a visitor reads on a line is the
 * wording a curator approved rather than its reverse.
 */

async function openMap(page: Page) {
  await begin(page);
  await page.getByRole('button', { name: 'Connections' }).click();
  await expect(page.locator('.map__field')).toBeVisible();
  // The settle animation finishes before anything is measured.
  await expect(page.locator('.map__person--focus')).toBeVisible();
}

test('the lens is offered, because the relationships behind it were approved', async ({ page }) => {
  await begin(page);
  await expect(page.getByRole('button', { name: 'Connections' })).toBeVisible();
});

test('the map opens on somebody, with their relationships drawn to them', async ({ page }) => {
  await openMap(page);
  const focus = page.locator('.map__person--focus');
  await expect(focus).toHaveCount(1);
  // Lines to the centre are the ones a source supports for this person.
  // Counted rather than asserted visible: a tie drawn due east of the centre
  // is a perfectly horizontal line, whose bounding box has no height, and
  // Playwright reports an empty box as hidden however well it is drawn.
  await expect(page.locator('.map__tie--focus')).not.toHaveCount(0);
  await expect(page.locator('.map__person--tie').first()).toBeVisible();
});

test('touching somebody brings them to the centre', async ({ page }) => {
  await openMap(page);
  const before = await page.locator('.map__person--focus').getAttribute('aria-label');

  const incoming = page.locator('.map__person--tie').first();
  const name = await incoming.getAttribute('aria-label');
  await incoming.click();

  await expect
    .poll(async () => page.locator('.map__person--focus').getAttribute('aria-label'))
    .not.toBe(before);
  // The label on a tie carries the claim as well as the name, so the centre's
  // own label is the plain name it is now shown under.
  expect(name).toContain((await page.locator('.map__person--focus').getAttribute('aria-label')) ?? '');
});

test('the wording on a line is the claim, read outwards from the centre', async ({ page }) => {
  await openMap(page);
  const tie = page.locator('.map__person--tie').first();
  const label = await tie.locator('.map__label').innerText();
  expect(label.trim().length).toBeGreaterThan(0);

  // Centring that person reverses the reading rather than repeating it.
  const centreName = (await page.locator('.map__person--focus .map__name').innerText()).trim();
  await tie.click();
  await expect(page.locator('.map__person--focus')).toBeVisible();
  const back = page.locator('.map__person--tie').filter({ hasText: centreName }).first();
  await expect(back).toBeVisible();
  const reversed = (await back.locator('.map__label').innerText()).trim();
  expect(reversed).not.toEqual(label.trim());
});

test('every person on the map is reachable by keyboard', async ({ page }) => {
  await openMap(page);
  // Real buttons, so the display is operable without a touchscreen — which is
  // how it is serviced and how it is tested.
  const people = page.locator('.map__person');
  await expect(people.first()).toBeVisible();
  await people.first().focus();
  await expect(people.first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.map__person--focus')).toHaveCount(1);
});

test('the map says how much of the collection it is showing', async ({ page }) => {
  await openMap(page);
  // "31 relationships" alone would let a visitor read the rim as the whole
  // collection. The reading line names what is off to the side.
  await expect(page.locator('.map__reading')).toContainText(/connects to|no documented relationship/);
  await expect(page.locator('.map__note')).toContainText('documented relationship');
});

test('a record still opens from the map', async ({ page }) => {
  await openMap(page);
  await page.locator('.map__open').click();
  await expect(page.locator('.record')).toBeVisible();
});
