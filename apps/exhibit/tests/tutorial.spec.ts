import { expect, test, type Page } from '@playwright/test';
import { skipTutorial } from './visit.ts';

/**
 * How this works: shown once to each visitor who comes in from the attract
 * screen, skippable at every step, armed again whenever the visit ends, and
 * there to ask for from the bar at any time.
 */

const tutorial = (page: Page) => page.locator('dialog.tutorial');
const bar = (page: Page) => page.getByRole('navigation', { name: 'Ways to explore' });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

/** Every step's title, read by walking it through to the end. */
async function walk(page: Page): Promise<string[]> {
  const titles: string[] = [];
  const next = tutorial(page).locator('.tutorial__next');
  for (;;) {
    titles.push((await tutorial(page).locator('h2').textContent()) ?? '');
    if (await next.textContent() === 'Start exploring') break;
    await next.click();
  }
  await next.click();
  await expect(tutorial(page)).toHaveCount(0);
  return titles;
}

test('leaving the attract screen opens How this works on its first step', async ({ page }) => {
  await page.goto('.');
  await expect(tutorial(page)).toHaveCount(0);
  await page.locator('[data-begin]').click();
  await expect(tutorial(page)).toBeVisible();
  await expect(tutorial(page).locator('h2')).toHaveText('111 faces, one wall');
  await expect(tutorial(page).locator('.tutorial__kicker')).toContainText('1 of');
  await expect(tutorial(page).locator('h2')).toBeFocused();
});

test('coming in by touching a face opens it too, over that person', async ({ page }) => {
  await page.goto('./?attract=stacked');
  await page.locator('.attract__face').nth(2).click();
  await expect(tutorial(page)).toBeVisible();
  await skipTutorial(page);
  await expect(page.locator('.sheet[data-open]')).toHaveCount(1);
});

test('the display\'s steps are the controls it carries, each one lit in turn', async ({ page }) => {
  await page.goto('.');
  await page.locator('[data-begin]').click();
  const next = tutorial(page).locator('.tutorial__next');
  // Years is the second step, and its key on the bar is the one lit.
  await next.click();
  await expect(tutorial(page).locator('h2')).toHaveText('Years');
  const ring = await tutorial(page).locator('.tutorial__ring').boundingBox();
  const key = await bar(page).locator('[data-lens="years"]').boundingBox();
  expect(ring && key && Math.abs(ring.x - key.x) < 2 && Math.abs(ring.y - key.y) < 2).toBe(true);
  await tutorial(page).getByRole('button', { name: 'Back' }).click();
  await expect(tutorial(page).locator('h2')).toHaveText('111 faces, one wall');
  // The kiosk build offers Connections and carries films.
  expect(await walk(page)).toEqual(['111 faces, one wall', 'Years', 'Connections', 'Search', 'Films', 'Tour', 'Start over, or see this again']);
});

test('Skip closes it from any step, and it does not come back during the visit', async ({ page }) => {
  await page.goto('.');
  await page.locator('[data-begin]').click();
  const next = tutorial(page).locator('.tutorial__next');
  await next.click();
  await next.click();
  await expect(tutorial(page).locator('.tutorial__kicker')).toContainText('3 of');
  await tutorial(page).getByRole('button', { name: 'Skip' }).click();
  await expect(tutorial(page)).toHaveCount(0);
  await bar(page).getByRole('button', { name: /^Years/ }).click();
  await bar(page).getByRole('button', { name: /^People/ }).click();
  await expect(tutorial(page)).toHaveCount(0);
});

test('a touch outside the panel lets it go, and so does Escape', async ({ page }) => {
  await page.goto('.');
  await page.locator('[data-begin]').click();
  await expect(tutorial(page)).toBeVisible();
  await page.mouse.click(8, 8);
  await expect(tutorial(page)).toHaveCount(0);

  await bar(page).getByRole('button', { name: 'How this works' }).click();
  await expect(tutorial(page)).toBeVisible();
  // A touch inside the panel is not a touch outside it.
  await tutorial(page).locator('.tutorial__body').click();
  await expect(tutorial(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tutorial(page)).toHaveCount(0);
});

test('Start over arms it again for the next visitor', async ({ page }) => {
  await page.goto('.');
  await page.locator('[data-begin]').click();
  await skipTutorial(page);
  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(page.locator('.attract')).toBeVisible();
  await page.locator('[data-begin]').click();
  await expect(tutorial(page)).toBeVisible();
  await expect(tutorial(page).locator('.tutorial__kicker')).toContainText('1 of');
});

test('a visit that ends by itself arms it again too, and closes it if it was open', async ({ page }) => {
  await page.goto('.');
  await page.locator('[data-begin]').click();
  await expect(tutorial(page)).toBeVisible();
  // Left alone with it open: the test build's short idle ends the visit.
  await expect(page.locator('.attract')).toBeVisible({ timeout: 10_000 });
  await expect(tutorial(page)).toHaveCount(0);
  await page.locator('[data-begin]').click();
  await expect(tutorial(page)).toBeVisible();
});

test('How this works on the bar plays it again from the start, and returns to the bar', async ({ page }) => {
  await page.goto('.');
  await page.locator('[data-begin]').click();
  await skipTutorial(page);
  const help = bar(page).getByRole('button', { name: 'How this works' });
  // Measured in the design's pixels: the test's window shows the stage scaled down.
  const height = await help.evaluate((el) => el.getBoundingClientRect().height
    / Number(getComputedStyle(document.documentElement).getPropertyValue('--stage-scale')));
  expect(height, 'a key a finger can find').toBeGreaterThanOrEqual(48);
  await help.click();
  await expect(tutorial(page).locator('.tutorial__kicker')).toContainText('1 of');
  await walk(page);
  await expect(help).toBeFocused();
});

/**
 * The public release: no attract screen, no films, and whatever lenses its
 * gates open. The suite runs the display's build, so the bundle is rewritten
 * as the public release would carry it.
 */
async function asPublished(page: Page, lenses: readonly string[]) {
  await page.route('**/data/exhibit.json', async (route) => {
    const bundle = await (await route.fetch()).json();
    await route.fulfill({
      json: {
        ...bundle, target: 'public', lenses, continuationBase: null,
        people: bundle.people.map((person: object) => ({ ...person, films: [] })),
      },
    });
  });
  await page.goto('.');
  await expect(page.locator('.tile').first()).toBeVisible();
}

test('a website does not interrupt a visitor who has just opened it, and offers it on the bar', async ({ page }) => {
  await asPublished(page, ['people', 'years', 'links']);
  await expect(page.locator('.attract')).toHaveCount(0);
  await expect(tutorial(page)).toHaveCount(0);
  await bar(page).getByRole('button', { name: 'How this works' }).click();
  await expect(tutorial(page).locator('.tutorial__body')).not.toContainText('film');
  expect(await walk(page)).toEqual(['111 faces, one wall', 'Years', 'Connections', 'Search', 'Tour', 'Start over, or see this again']);
});

test('a lens its gate closed has no step', async ({ page }) => {
  await asPublished(page, ['people', 'years']);
  await expect(bar(page).getByRole('button', { name: /^Connections/ })).toHaveCount(0);
  await bar(page).getByRole('button', { name: 'How this works' }).click();
  // No Connections to save a thread in and no curated tour: Tour has nothing to show round yet.
  expect(await walk(page)).toEqual(['111 faces, one wall', 'Years', 'Search', 'Start over, or see this again']);
});
