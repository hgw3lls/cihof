import { expect, test, type Page } from '@playwright/test';
import { begin, openStory } from './visit.ts';

/**
 * A person's story: turned a page at a time, with the next story along the
 * wall one touch away, and back to the wall where the visitor left it.
 */
const story = (page: Page) => page.locator('dialog.record');
const pageLabel = (page: Page) => story(page).locator('.story__page [aria-live]');

test('a long story turns page by page, by the arrows, the keys, or a swipe', async ({ page }) => {
  await begin(page);
  await openStory(page, 'Raj Aggarwal');
  await expect(story(page).getByRole('heading', { level: 2 })).toHaveText('Raj Aggarwal');
  await expect(pageLabel(page)).toHaveText(/^Page 1 of [2-9]$/);
  const previous = story(page).getByRole('button', { name: 'Previous page' });
  const next = story(page).getByRole('button', { name: 'Next page' });
  await expect(previous).toBeDisabled();

  await next.click();
  await expect(pageLabel(page)).toHaveText(/^Page 2 of/);
  await page.keyboard.press('ArrowLeft');
  await expect(pageLabel(page)).toHaveText(/^Page 1 of/);

  const box = (await story(page).locator('.story__reading').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(pageLabel(page)).toHaveText(/^Page 2 of/);

  // Every page's words are there to read; the last page shows the last words.
  const pages = Number(/of (\d+)/.exec((await pageLabel(page).textContent()) ?? '')?.[1]);
  for (let turn = 2; turn < pages; turn += 1) await next.click();
  await expect(next).toBeDisabled();
  await expect(story(page).locator('.story__credit')).toBeInViewport();
});

test('the next story is the next face along the wall, and starts on its first page', async ({ page }) => {
  await begin(page);
  const order = await page.locator('.tile').evaluateAll((tiles) => tiles
    .map((tile) => ({ name: tile.getAttribute('aria-label'), box: tile.getBoundingClientRect() }))
    .sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left)
    .map((tile) => tile.name));
  const first = order[0]!;
  await openStory(page, first);
  const turn = story(page).getByRole('button', { name: 'Next page' });
  if (await turn.isEnabled()) await turn.click();
  await story(page).locator('.story__next').click();
  await expect(story(page).getByRole('heading', { level: 2 })).toHaveText(order[1]!);
  await expect(pageLabel(page)).toHaveText(/^Page 1 of/);
});

test('back to the wall leaves the person chosen, and a writer’s italics are italics', async ({ page }) => {
  await begin(page);
  await openStory(page, 'Alex Machaskee');
  await expect(story(page).locator('.story__columns em').first()).toHaveText('The Plain Dealer');
  expect(await story(page).locator('.story__columns').textContent()).not.toContain('*');
  await story(page).getByRole('button', { name: 'Back to the wall' }).click();
  await expect(story(page)).toHaveCount(0);
  await expect(page.locator('.sheet__name')).toHaveText('Alex Machaskee');
});

test('a person with no film is offered none', async ({ page }) => {
  await page.route('**/data/exhibit.json', async (route) => {
    const bundle = await (await route.fetch()).json();
    await route.fulfill({ json: { ...bundle, people: bundle.people.map((entry: object) => ({ ...entry, films: [] })) } });
  });
  await begin(page);
  await openStory(page, 'Raj Aggarwal');
  await expect(story(page).getByRole('button', { name: /^Watch/ })).toHaveCount(0);
});
