import { expect, test, type Page } from '@playwright/test';
import { skipTutorial } from './visit.ts';

/**
 * How this works: shown once to each visitor who comes in from the attract
 * screen, with Next, Start again and Stop on every step, armed again whenever
 * the visit ends, and there to ask for from the bar at any time.
 */

const tutorial = (page: Page) => page.locator('dialog.tutorial');
const bar = (page: Page) => page.getByRole('navigation', { name: 'Ways to explore' });
const heading = (page: Page) => tutorial(page).locator('h2');
const control = (page: Page, name: string) => tutorial(page).getByRole('button', { name, exact: true });

/** The display's build: every lens, films, and a story to take home. */
const displaySteps = [
  'How to explore the Hall', 'People', 'Arrange the wall', 'Choose someone', 'Two at once', 'Their story',
  'Films', 'Take it with you', 'Years', 'Connections', 'Your thread', 'Kinds of tie',
  'Search', 'Tour', 'Light or dark', 'Start over, or see this again',
];

/** The public release: the same lenses, and no films, places or continuation address. */
const publicSteps = [
  'How to explore the Hall', 'People', 'Arrange the wall', 'Choose someone', 'Two at once', 'Their story',
  'Years', 'Connections', 'Your thread', 'Kinds of tie',
  'Search', 'Tour', 'Light or dark', 'Start over, or see this again',
];

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

/**
 * Holds the page's clock still once it has loaded, so the test build's short
 * idle cannot end the visit while a long walk is read through.
 */
async function holdStill(page: Page) {
  await page.clock.setFixedTime(await page.evaluate(() => Date.now()));
}

async function enterDisplay(page: Page) {
  await page.clock.install();
  await page.goto('.');
  await holdStill(page);
  await page.locator('[data-begin]').click();
  await expect(tutorial(page)).toBeVisible();
}

/** Every step's title and body, read by walking it through to the end with Next. */
async function walk(page: Page): Promise<{ titles: string[]; bodies: string[] }> {
  const titles: string[] = [];
  const bodies: string[] = [];
  const next = tutorial(page).locator('.tutorial__next');
  for (;;) {
    titles.push((await heading(page).textContent()) ?? '');
    bodies.push((await tutorial(page).locator('.tutorial__body').textContent()) ?? '');
    // The three ways on are there on every step.
    await expect(control(page, 'Stop')).toBeEnabled();
    await expect(control(page, 'Start again')).toBeVisible();
    await expect(next).toBeEnabled();
    if (await next.textContent() === 'Start exploring') break;
    await next.click();
  }
  await next.click();
  await expect(tutorial(page)).toHaveCount(0);
  return { titles, bodies };
}

async function goTo(page: Page, title: string) {
  const next = tutorial(page).locator('.tutorial__next');
  while ((await heading(page).textContent()) !== title) {
    expect(await next.textContent(), `a step called ${title}`).toBe('Next');
    await next.click();
  }
}

/** Whether the ring sits on the control, measured as the screen draws them. */
async function ringOn(page: Page, selector: string) {
  const ring = await tutorial(page).locator('.tutorial__ring').boundingBox();
  const key = await page.locator(selector).first().boundingBox();
  return Boolean(ring && key) && Math.abs(ring!.x - key!.x) < 2 && Math.abs(ring!.y - key!.y) < 2
    && Math.abs(ring!.width - key!.width) < 2 && Math.abs(ring!.height - key!.height) < 2;
}

test('leaving the attract screen opens How this works on its first step', async ({ page }) => {
  await page.goto('.');
  await expect(tutorial(page)).toHaveCount(0);
  await page.locator('[data-begin]').click();
  await expect(tutorial(page)).toBeVisible();
  await expect(heading(page)).toHaveText('How to explore the Hall');
  await expect(tutorial(page).locator('.tutorial__kicker')).toContainText(`1 of ${displaySteps.length}`);
  await expect(tutorial(page).locator('.tutorial__body')).toContainText('3 ways in, along the bottom of the screen: People, Years and Connections');
  await expect(heading(page)).toBeFocused();
});

test('the display walks every lens, a person\'s record, the films, the code to take home, and the bar', async ({ page }) => {
  await enterDisplay(page);
  const { titles, bodies } = await walk(page);
  expect(titles).toEqual(displaySteps);
  const said = (title: string) => bodies[titles.indexOf(title)]!;
  expect(said('Films')).toMatch(/^\d+ of the 111 have a film/);
  expect(said('Take it with you')).toContain('phone camera');
  expect(said('Kinds of tie')).toMatch(/Same place shows the \d+ places/);
  expect(said('Their story')).toContain('Back to the wall returns you to where you were');
  // The test build's own short timing, as the session runs it: never a number of the guide's own.
  expect(said('Start over, or see this again')).toMatch(/for a second, it asks whether you are still there, and starts over a second later/);
  expect(said('Start over, or see this again')).toContain('clears your visit for the next person');
});

test('each key on the bar is lit in turn as its step comes up', async ({ page }) => {
  await enterDisplay(page);
  for (const [title, selector] of [
    ['People', '.lensbar__lens[data-lens="people"]'],
    ['Years', '.lensbar__lens[data-lens="years"]'],
    ['Connections', '.lensbar__lens[data-lens="links"]'],
    ['Search', '.lensbar__search'],
    ['Tour', '.lensbar__tour'],
    ['Light or dark', '.lensbar__theme'],
    ['Start over, or see this again', '.lensbar__help'],
  ] as const) {
    await goTo(page, title);
    await expect.poll(() => ringOn(page, selector), { message: title }).toBe(true);
  }
});

test('a step about something not on screen is shown unlit, never pointing at the wrong thing', async ({ page }) => {
  await enterDisplay(page);
  // Nobody is chosen, so there is no Read their story to point at.
  await goTo(page, 'Their story');
  await expect(tutorial(page).locator('.tutorial__ring')).toHaveCount(0);
  await expect(tutorial(page).locator('.tutorial__layer')).not.toHaveAttribute('data-lit');
});

test('coming in by touching a face opens it over that person, and points at their story', async ({ page }) => {
  await page.clock.install();
  await page.goto('./?attract=stacked');
  await holdStill(page);
  await page.locator('.attract__face').nth(2).click();
  await expect(tutorial(page)).toBeVisible();
  await goTo(page, 'Their story');
  await expect.poll(() => ringOn(page, '.sheet[data-open] .sheet__story')).toBe(true);
  await skipTutorial(page);
  await expect(page.locator('.sheet[data-open]')).toHaveCount(1);
});

test('Next skips to the following step, and Back returns to the one before', async ({ page }) => {
  await enterDisplay(page);
  // On the first step there is nothing to go back to, and the keys stay put.
  await expect(control(page, 'Back')).toBeDisabled();
  await expect(control(page, 'Start again')).toBeDisabled();
  await control(page, 'Next').click();
  await expect(heading(page)).toHaveText('People');
  await control(page, 'Next').click();
  await expect(heading(page)).toHaveText('Arrange the wall');
  await expect(tutorial(page).locator('.tutorial__kicker')).toContainText('3 of');
  await control(page, 'Back').click();
  await expect(heading(page)).toHaveText('People');
  await control(page, 'Back').click();
  await expect(heading(page)).toHaveText('How to explore the Hall');
  // Back went away under the finger; the step's title has the focus, not the page behind.
  await expect(heading(page)).toBeFocused();
});

test('Start again goes back to the first step from any step, the last included', async ({ page }) => {
  await enterDisplay(page);
  await goTo(page, 'Connections');
  await control(page, 'Start again').click();
  await expect(heading(page)).toHaveText('How to explore the Hall');
  await expect(tutorial(page).locator('.tutorial__kicker')).toContainText('1 of');
  await expect(heading(page)).toBeFocused();
  await goTo(page, 'Start over, or see this again');
  await control(page, 'Start again').click();
  await expect(heading(page)).toHaveText('How to explore the Hall');
  // Started again, it walks the same steps through to the end.
  expect((await walk(page)).titles).toEqual(displaySteps);
});

test('Stop closes it from any step, and it does not come back during the visit', async ({ page }) => {
  await enterDisplay(page);
  await goTo(page, 'Their story');
  await control(page, 'Stop').click();
  await expect(tutorial(page)).toHaveCount(0);
  await bar(page).getByRole('button', { name: /^Years/ }).click();
  await bar(page).getByRole('button', { name: /^People/ }).click();
  await expect(tutorial(page)).toHaveCount(0);
  // And from the last step.
  await bar(page).getByRole('button', { name: 'How this works' }).click();
  await goTo(page, 'Start over, or see this again');
  await control(page, 'Stop').click();
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

test('every key on the panel is one a finger can find', async ({ page }) => {
  await enterDisplay(page);
  await control(page, 'Next').click();
  for (const name of ['Stop', 'Start again', 'Back', 'Next']) {
    // Measured in the design's pixels: the test's window shows the stage scaled down.
    const height = await control(page, name).evaluate((el) => el.getBoundingClientRect().height
      / Number(getComputedStyle(document.documentElement).getPropertyValue('--stage-scale')));
    expect(height, name).toBeGreaterThanOrEqual(48);
  }
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
  await enterDisplay(page);
  await skipTutorial(page);
  const help = bar(page).getByRole('button', { name: 'How this works' });
  const height = await help.evaluate((el) => el.getBoundingClientRect().height
    / Number(getComputedStyle(document.documentElement).getPropertyValue('--stage-scale')));
  expect(height, 'a key a finger can find').toBeGreaterThanOrEqual(48);
  await help.click();
  await expect(tutorial(page).locator('.tutorial__kicker')).toContainText('1 of');
  await walk(page);
  await expect(help).toBeFocused();
});

/**
 * The public release: no attract screen, no films, no places, no continuation
 * address, and whatever lenses its gates open. The suite runs the display's
 * build, so the bundle is rewritten as the public release would carry it.
 */
async function asPublished(page: Page, lenses: readonly string[], { tours }: { tours?: readonly unknown[] } = {}) {
  await page.route('**/data/exhibit.json', async (route) => {
    const bundle = await (await route.fetch()).json();
    await route.fulfill({
      json: {
        ...bundle, target: 'public', lenses, continuationBase: null, places: [],
        people: bundle.people.map((person: object) => ({ ...person, films: [] })),
        ...(tours ? { tours } : {}),
      },
    });
  });
  await page.clock.install();
  await page.goto('.');
  await expect(page.locator('.tile').first()).toBeVisible();
  await holdStill(page);
}

test('a website does not interrupt a visitor who has just opened it, and offers it on the bar', async ({ page }) => {
  await asPublished(page, ['people', 'years', 'links']);
  await expect(page.locator('.attract')).toHaveCount(0);
  await expect(tutorial(page)).toHaveCount(0);
  await bar(page).getByRole('button', { name: 'How this works' }).click();
  const { titles, bodies } = await walk(page);
  expect(titles).toEqual(publicSteps);
  const all = bodies.join('\n');
  expect(all).not.toMatch(/film/i);
  expect(all).not.toMatch(/phone|Take it with you/);
  expect(all).not.toMatch(/Same place/);
  expect(all).not.toMatch(/next (person|visitor)|this display/);
  expect(bodies[titles.indexOf('Light or dark')]).toContain('This device keeps your choice');
});

test('on the website too, Next, Start again and Stop do what they say', async ({ page }) => {
  await asPublished(page, ['people', 'years', 'links']);
  await bar(page).getByRole('button', { name: 'How this works' }).click();
  await control(page, 'Next').click();
  await expect(heading(page)).toHaveText('People');
  await goTo(page, 'Kinds of tie');
  await control(page, 'Start again').click();
  await expect(heading(page)).toHaveText('How to explore the Hall');
  await goTo(page, 'Search');
  await control(page, 'Stop').click();
  await expect(tutorial(page)).toHaveCount(0);
});

test('a lens its gate closed has no step', async ({ page }) => {
  // A release with no Connections, and no curated tour approved.
  await asPublished(page, ['people', 'years'], { tours: [] });
  await expect(bar(page).getByRole('button', { name: /^Connections/ })).toHaveCount(0);
  await bar(page).getByRole('button', { name: 'How this works' }).click();
  await expect(tutorial(page).locator('.tutorial__body')).toContainText('2 ways in, along the bottom of the screen: People and Years.');
  // No Connections to save a thread in and no curated tour: Tour has nothing to show round yet.
  const { titles, bodies } = await walk(page);
  expect(titles).toEqual([
    'How to explore the Hall', 'People', 'Arrange the wall', 'Choose someone', 'Two at once', 'Their story',
    'Years', 'Search', 'Light or dark', 'Start over, or see this again',
  ]);
  expect(bodies.join('\n')).not.toMatch(/Connections|thread|Tour/);
});

test('the ring follows its control when the screen is turned or resized while it is open', async ({ page }) => {
  // The website takes the screen's shape: a phone turned upright rearranges the whole bar.
  await page.setViewportSize({ width: 1280, height: 800 });
  await asPublished(page, ['people', 'years', 'links']);
  await bar(page).getByRole('button', { name: 'How this works' }).click();
  await goTo(page, 'Years');
  const fits = () => ringOn(page, '.lensbar__lens[data-lens="years"]');
  await expect.poll(fits).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('html')).toHaveAttribute('data-shape', 'phone');
  await expect.poll(fits, { timeout: 3000 }).toBe(true);
});
