import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { begin } from './visit.ts';

/**
 * Search: everything a visitor can see, found from the bar along the bottom
 * and typed on the display's own keys.
 */
const panel = (page: Page) => page.getByRole('search', { name: 'Search the collection' });
const field = (page: Page) => panel(page).getByRole('searchbox');

async function openSearch(page: Page, address = '.') {
  await begin(page, address);
  await page.getByRole('navigation', { name: 'Ways to explore' }).getByRole('button', { name: /^Search/ }).click();
  await expect(field(page)).toBeFocused();
}

test('typed on a keyboard, it lights the people it finds and says why', async ({ page }) => {
  await openSearch(page);
  await expect(page.getByRole('group', { name: 'Keyboard' })).toHaveCount(0);
  await page.keyboard.type('machaskee');
  await expect(field(page)).toHaveValue('machaskee');

  const people = panel(page).getByRole('region', { name: 'People' });
  await expect(people.locator('.search__row').first()).toContainText('Alex Machaskee');
  // Others are found through him: who he presented, and his ties.
  await expect(people.locator('.search__kicker', { hasText: 'Presented by' }).first()).toBeVisible();
  await expect(people.locator('mark').first()).toHaveText(/Machaskee/);

  const lit = await page.locator('.tile img[data-colour]').count();
  expect(lit).toBe(await people.locator('.search__row').count());

  await page.keyboard.press('Backspace');
  await expect(field(page)).toHaveValue('machaske');
  await page.keyboard.press('Escape');
  await expect(panel(page)).toHaveCount(0);
});

test('a writer’s italics show as italics, never as asterisks', async ({ page }) => {
  await openSearch(page);
  await page.keyboard.type('plain dealer');
  const first = panel(page).getByRole('region', { name: 'People' }).locator('.search__row').first();
  // The title is in italics, the words searched for marked within it.
  await expect.poll(async () => (await first.locator('em').allTextContents()).join('')).toBe('The Plain Dealer');
  expect(await panel(page).locator('.search__results').textContent()).not.toContain('*');
  await first.click();
  await expect(page.locator('.sheet__teaser em').first()).toBeVisible();
  expect(await page.locator('.sheet__teaser').textContent()).not.toContain('*');
});

test('a slip is forgiven, a word is found as it is typed, and nothing found is said', async ({ page }) => {
  await openSearch(page);
  await field(page).fill('grasseli');
  await expect(panel(page).locator('.search__row').first()).toContainText('Jeanette Grasselli Brown');
  await field(page).fill('jean');
  await expect(panel(page).locator('.search__row', { hasText: 'Jeanette Grasselli Brown' })).toBeVisible();
  await field(page).fill('qqxxzz');
  await expect(panel(page).getByRole('status')).toHaveText('Nothing in the collection matches “qqxxzz”.');
});

test('choosing a person opens them, and the people found stay lit until let go', async ({ page }) => {
  await openSearch(page);
  await field(page).fill('slovenian');
  await panel(page).getByRole('region', { name: 'People' }).locator('.search__row').first().click();
  await expect(panel(page)).toHaveCount(0);
  await expect(page.locator('.sheet[data-open] .sheet__name')).toBeVisible();

  const chip = page.getByRole('button', { name: 'Clear “slovenian”' });
  await expect(chip).toBeVisible();
  await expect(page.locator('.tile img[data-colour]').first()).toBeVisible();
  await page.locator('.sheet__close').click();
  await chip.click();
  await expect(page.locator('.tile img[data-colour]')).toHaveCount(0);
});

test('a grouping the collection makes lights all its people on the wall', async ({ page }) => {
  await openSearch(page);
  await field(page).fill('2010');
  const group = panel(page).getByRole('region', { name: 'In the collection' }).locator('.search__row').first();
  await expect(group).toContainText('Class of 2010');
  const count = Number(/(\d+) people/.exec((await group.textContent()) ?? '')?.[1]);
  await group.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Everyone, A to Z');
  await expect(page.locator('.tile img[data-colour]')).toHaveCount(count);
  await expect(page.locator('.masthead p')).toHaveText(`${count} of 111 lit for Class of 2010`);
});

test('a place found opens on that place', async ({ page }) => {
  await openSearch(page);
  await field(page).fill('rockefeller');
  const place = panel(page).getByRole('region', { name: 'Places' }).locator('.search__row').first();
  const name = (await place.locator('.search__title').textContent())?.trim() ?? '';
  await place.click();
  await expect(page.locator('.places__place h2')).toHaveText(name);
});

test('words said in a film are found, and the film opens where they are said', async ({ page }) => {
  // One synthetic film, so the test does not depend on which films are on this machine.
  const fixture = fileURLToPath(new URL('./fixtures/media/chronology-test.en.vtt', import.meta.url));
  await page.route('**/data/exhibit.json', async (route) => {
    const bundle = await (await route.fetch()).json();
    await route.fulfill({
      json: {
        ...bundle,
        people: bundle.people.map((entry: { id: string }) => ({
          ...entry,
          films: entry.id === 'alex-machaskee-2010'
            ? [{ id: 'fixture-film', source: { kind: 'local-file', src: '/media/videos/__fixture__/chronology-test.mp4' }, poster: '/media/videos/__fixture__/chronology-test.png', captions: '/media/videos/__fixture__/chronology-test.en.vtt', transcript: '/media/videos/__fixture__/chronology-test.transcript.txt', durationSeconds: 4 }]
            : [],
        })),
      },
    });
  });
  await page.route('**/__fixture__/chronology-test.en.vtt', (route) => route.fulfill({ path: fixture, contentType: 'text/vtt' }));

  await openSearch(page);
  await field(page).fill('seeking replay');
  const film = panel(page).getByRole('region', { name: 'Said in the films' }).locator('.search__row').first();
  await expect(film).toContainText('Alex Machaskee');
  await expect(film).toContainText('at 0:01');
  await expect(film.locator('mark')).toHaveText(['seeking', 'replay']);
  await film.click();
  await expect(page.locator('dialog.film')).toBeVisible();
  await expect(page.locator('dialog.film')).toContainText('from the words you searched for');
});

test('search is kept to the wall: another lens closes it and lets its people go', async ({ page }) => {
  await openSearch(page);
  await field(page).fill('irish');
  await page.getByRole('navigation', { name: 'Ways to explore' }).getByRole('button', { name: /^Years/ }).click();
  await expect(panel(page)).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Ways to explore' }).getByRole('button', { name: /^People/ }).click();
  await expect(page.locator('.tile img[data-colour]')).toHaveCount(0);
});
