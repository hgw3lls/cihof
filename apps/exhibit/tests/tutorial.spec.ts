import { expect, test, type Page } from '@playwright/test';
import { skipTutorial } from './visit.ts';

/**
 * How this works: offered, never imposed, to each visitor who comes in from
 * the attract screen, offered again whenever the visit ends, and there to ask
 * for from the bar at any time. Once open, Next, Start again and Stop are on
 * every step.
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

/** Comes in from the attract screen and asks for the guide from the bar, as a visitor may at any time. */
async function enterDisplay(page: Page) {
  await page.clock.install();
  await page.goto('.');
  await holdStill(page);
  await page.locator('[data-begin]').click();
  await expect(tutorial(page)).toHaveCount(0);
  await bar(page).getByRole('button', { name: 'How this works' }).click();
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

test('asked for over somebody chosen, it points at their story', async ({ page }) => {
  await page.clock.install();
  await page.goto('./?attract=stacked');
  await holdStill(page);
  await page.locator('.attract__face').nth(2).click();
  await bar(page).getByRole('button', { name: 'How this works' }).click();
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
  await enterDisplay(page);
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

/**
 * The offer. Coming in from the attract screen opens nothing: the visitor is
 * offered the guide in one line of the masthead, which they can take, turn
 * down, or simply ignore. These hold the page's clock where the offer must
 * stay up long enough to look at; the test build retires it after a second.
 */
const invitation = (page: Page) => page.locator('.invitation');

async function comeIn(page: Page, address = '.') {
  await page.clock.install();
  await page.goto(address);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
}

test('coming in from the attract screen opens nothing over the wall, and offers How this works', async ({ page }) => {
  await comeIn(page);
  await expect(invitation(page)).toHaveCount(0);
  await page.locator('[data-begin]').click();
  await expect(page.locator('.lensbar')).toBeVisible();
  await expect(tutorial(page)).toHaveCount(0);
  await expect(invitation(page)).toContainText('New here?');
  await expect(invitation(page).getByRole('button', { name: 'How this works' })).toBeVisible();
  await expect(invitation(page).getByRole('button', { name: 'No thanks' })).toBeVisible();
  // It stands in the masthead, clear of the wall, and its keys are full size.
  const offer = (await invitation(page).boundingBox())!;
  const wall = (await page.locator('.field').boundingBox())!;
  expect(offer.y + offer.height <= wall.y + 1, 'above the wall, not over it').toBe(true);
  for (const name of ['How this works', 'No thanks']) {
    const height = await invitation(page).getByRole('button', { name }).evaluate((el) => el.getBoundingClientRect().height
      / Number(getComputedStyle(document.documentElement).getPropertyValue('--stage-scale')));
    expect(height, name).toBeGreaterThanOrEqual(48);
  }
});

test('coming in by touching a face offers it too, beside that person\'s card', async ({ page }) => {
  await comeIn(page, './?attract=stacked');
  await page.locator('.attract__face').nth(2).click();
  await expect(page.locator('.sheet[data-open]')).toHaveCount(1);
  await expect(invitation(page)).toBeVisible();
  await expect(tutorial(page)).toHaveCount(0);
});

test('the first touch anywhere else retires the offer, and still does what it was for', async ({ page }) => {
  await comeIn(page);
  await page.locator('[data-begin]').click();
  await expect(invitation(page)).toBeVisible();
  await page.locator('.tile').nth(4).click();
  await expect(invitation(page)).toHaveCount(0);
  await expect(page.locator('.sheet[data-open]')).toHaveCount(1);
  await expect(page.locator('.masthead p')).toBeVisible();
});

test('No thanks retires the offer, and the key on the bar still opens the guide', async ({ page }) => {
  await comeIn(page);
  await page.locator('[data-begin]').click();
  await invitation(page).getByRole('button', { name: 'No thanks' }).click();
  await expect(invitation(page)).toHaveCount(0);
  await expect(tutorial(page)).toHaveCount(0);
  // Changing lens is not a new visit: the offer is made once.
  await bar(page).getByRole('button', { name: /^Years/ }).click();
  await bar(page).getByRole('button', { name: /^People/ }).click();
  await expect(invitation(page)).toHaveCount(0);
  await bar(page).getByRole('button', { name: 'How this works' }).click();
  await expect(heading(page)).toHaveText('How to explore the Hall');
});

test('left alone, the offer retires by itself in the time the build sets, before the visit ends', async ({ page }) => {
  await page.goto('.');
  await page.locator('[data-begin]').click();
  await expect(invitation(page)).toBeVisible();
  // VITE_CIHOF_INVITATION_MS is a second in the test build; the idle is longer.
  await expect(invitation(page)).toHaveCount(0, { timeout: 2_000 });
  await expect(page.locator('.attract')).toHaveCount(0);
  await expect(tutorial(page)).toHaveCount(0);
});

test('taking the offer opens the whole guide on its first step, and hands focus to the bar when done', async ({ page }) => {
  await comeIn(page);
  await page.locator('[data-begin]').click();
  await invitation(page).getByRole('button', { name: 'How this works' }).click();
  await expect(invitation(page)).toHaveCount(0);
  await expect(heading(page)).toHaveText('How to explore the Hall');
  await expect(tutorial(page).locator('.tutorial__kicker')).toContainText(`1 of ${displaySteps.length}`);
  await expect(tutorial(page).locator('.tutorial__body')).toContainText('3 ways in, along the bottom of the screen: People, Years and Connections');
  await page.clock.resume();
  await expect(heading(page)).toBeFocused();
  await control(page, 'Next').click();
  await expect(heading(page)).toHaveText('People');
  await control(page, 'Stop').click();
  await expect(tutorial(page)).toHaveCount(0);
  // The offer that opened it has gone; the key on the bar that offers the same guide has the focus.
  await expect(bar(page).getByRole('button', { name: 'How this works' })).toBeFocused();
});

test('Start over offers it again to the next visitor, though this one turned it down', async ({ page }) => {
  await comeIn(page);
  await page.locator('[data-begin]').click();
  await invitation(page).getByRole('button', { name: 'No thanks' }).click();
  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(page.locator('.attract')).toBeVisible();
  await page.locator('[data-begin]').click();
  await expect(invitation(page)).toBeVisible();
  await expect(tutorial(page)).toHaveCount(0);
});

test('a visit that ends by itself closes the guide if open, and the next visitor is offered it again', async ({ page }) => {
  await page.goto('.');
  await page.locator('[data-begin]').click();
  await bar(page).getByRole('button', { name: 'How this works' }).click();
  await expect(tutorial(page)).toBeVisible();
  // Left alone with it open: the test build's short idle ends the visit.
  await expect(page.locator('.attract')).toBeVisible({ timeout: 10_000 });
  await expect(tutorial(page)).toHaveCount(0);
  await page.locator('[data-begin]').click();
  await expect(invitation(page)).toBeVisible();
  await expect(tutorial(page)).toHaveCount(0);
});

test('a reload is a new visitor: the attract screen, then the offer', async ({ page }) => {
  await comeIn(page);
  await page.locator('[data-begin]').click();
  await invitation(page).getByRole('button', { name: 'No thanks' }).click();
  await page.reload();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await expect(page.locator('.attract')).toBeVisible();
  await page.locator('[data-begin]').click();
  await expect(invitation(page)).toBeVisible();
  await expect(tutorial(page)).toHaveCount(0);
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
  // Nothing is offered unasked either, on opening the page or on reloading it.
  await expect(page.locator('.invitation')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.tile').first()).toBeVisible();
  await expect(page.locator('.invitation')).toHaveCount(0);
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

test('on a phone the offer fits its masthead, clear of the wall, with full-size keys', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await comeIn(page, './?fit=fill');
  await page.locator('[data-begin]').click();
  await expect(page.locator('html')).toHaveAttribute('data-shape', 'phone');
  await expect(invitation(page)).toBeVisible();
  const offer = (await invitation(page).boundingBox())!;
  const head = (await page.locator('.masthead').boundingBox())!;
  const wall = (await page.locator('.field').boundingBox())!;
  expect(offer.y >= head.y && offer.y + offer.height <= head.y + head.height + 0.5, 'inside the masthead').toBe(true);
  expect(offer.y + offer.height <= wall.y + 0.5, 'clear of the wall').toBe(true);
  for (const name of ['How this works', 'No thanks']) {
    const height = await invitation(page).getByRole('button', { name }).evaluate((el) => el.getBoundingClientRect().height
      / Number(getComputedStyle(document.documentElement).getPropertyValue('--stage-scale')));
    expect(height, name).toBeGreaterThanOrEqual(48);
  }
  // The title is back once the offer has gone.
  await invitation(page).getByRole('button', { name: 'No thanks' }).click();
  await expect(page.locator('.masthead h1')).toBeVisible();
});
