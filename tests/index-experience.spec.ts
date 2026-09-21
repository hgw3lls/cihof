import { expect, test, type Browser } from '@playwright/test';

async function openInducteeFixture(
  browser: Browser,
  url: string,
  mutate: (person: Record<string, unknown>) => void,
  options: { hasTouch?: boolean; viewport?: { width: number; height: number } } = {},
) {
  const context = await browser.newContext({
    serviceWorkers: 'block',
    hasTouch: options.hasTouch,
    viewport: options.viewport,
  });
  const fixturePage = await context.newPage();
  await fixturePage.addInitScript(() => window.localStorage.setItem('cihof.kiosk-settings.v1', JSON.stringify({ idleTimeoutMs: 120000 })));
  await fixturePage.route('**/data/cihof-runtime-data.json', async (route) => {
    const response = await route.fetch();
    const bundle = await response.json() as { inductees?: Array<Record<string, unknown>> };
    const person = bundle.inductees?.find((item) => item.id === 'alex-machaskee-2010');
    expect(person).toBeTruthy();
    mutate(person!);
    await route.fulfill({ response, json: bundle });
  });
  await fixturePage.goto(url);
  await expect(fixturePage.locator('.person-tile')).toHaveCount(111);
  return { context, fixturePage };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('cihof.kiosk-settings.v1', JSON.stringify({ idleTimeoutMs: 120000 })));
  await page.goto('./');
  await expect(page.locator('.person-tile')).toHaveCount(111);
});

test('starts without privileging an inductee in any scene', async ({ page }) => {
  await expect(page.locator('.installation')).toHaveAttribute('data-selection', 'none');
  await expect(page.getByRole('heading', { name: 'Choose a person' })).toBeVisible();
  await page.getByRole('button', { name: 'LINKS', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Relationship index' })).toBeVisible();
  await expect(page.locator('.map-node')).toHaveCount(0);
  await page.getByRole('button', { name: 'YEARS', exact: true }).click();
  await expect(page.locator('.installation')).toHaveAttribute('data-selection', 'none');
  await expect(page.locator('.year-person')).toHaveCount(111);
  await expect(page.locator('.film-line__year[aria-current="date"]')).toHaveText('2010');
});

test('sorts the People wall by name or induction class', async ({ page }) => {
  const firstTile = page.locator('.person-tile').first();
  await expect(firstTile).toContainText('Abby Mina');
  await page.getByRole('combobox', { name: 'Sort people' }).selectOption('newest');
  await expect(firstTile).toContainText('Aklilu Demessie');
  await expect(firstTile).toContainText('CLASS OF 2026');
  await page.getByRole('combobox', { name: 'Sort people' }).selectOption('earliest');
  await expect(firstTile).toContainText('Alex Machaskee');
  await expect(firstTile).toContainText('CLASS OF 2010');
});

test('searches People, pins one portrait, and opens the complete record and QR', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Find a person or year' }).fill('Alex Machaskee');
  await page.getByRole('button', { name: /Select Alex Machaskee/ }).click();
  await expect(page.getByRole('complementary', { name: 'Selected person' })).toContainText('Alex Machaskee');
  const selectedTile = page.locator('.person-tile[data-person-id="alex-machaskee-2010"]');
  await expect(selectedTile).toHaveAttribute('aria-pressed', 'true');
  await expect(selectedTile).toContainText('IN FOCUS');
  await expect(page.locator('.person-tile')).toHaveCount(1);
  await page.getByRole('button', { name: 'Open full record for Alex Machaskee' }).click();
  await expect(page.getByRole('region', { name: 'Alex Machaskee full record' })).toContainText('Biography');
  await expect(page.locator('.record-view__story')).toContainText('The Plain Dealer');
  await page.getByRole('button', { name: 'TAKE THIS RECORD' }).click();
  await expect(page.getByRole('dialog', { name: 'Take Alex Machaskee record with you' })).toBeVisible();
  await expect(page.locator('.qr-continuation__code img')).toHaveCount(1);
  await page.getByRole('button', { name: 'Return To Portrait' }).click();
  await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open full record for Alex Machaskee' })).toBeFocused();
  await expect(page.getByRole('searchbox', { name: 'Find a person or year' })).toHaveValue('Alex Machaskee');
  await expect(selectedTile).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await expect(page.locator('.installation')).toHaveAttribute('data-selection', 'none');
});

test('keeps an eligible no-image person reachable across deep links and all scenes', async ({ browser, page }) => {
  const { context, fixturePage } = await openInducteeFixture(
    browser,
    new URL('?person=alex-machaskee-2010', page.url()).href,
    (person) => { person.primaryImageUrl = ''; },
    { hasTouch: true, viewport: { width: 390, height: 844 } },
  );
  try {
    await expect(fixturePage.getByRole('complementary', { name: 'Selected person' })).toContainText('Alex Machaskee');
    await expect(fixturePage.locator('.focus .photo')).toHaveAttribute('data-image-state', 'missing');
    await expect(fixturePage.locator('.focus .photo img')).toHaveCount(0);
    const selectedTile = fixturePage.locator('.person-tile[data-person-id="alex-machaskee-2010"]');
    await expect(selectedTile).toHaveAttribute('aria-pressed', 'true');
    await expect(selectedTile).toContainText('PORTRAIT NOT AVAILABLE');

    await fixturePage.getByRole('button', { name: 'Clear selection' }).tap();
    await selectedTile.tap();
    await expect(selectedTile).toHaveAttribute('aria-pressed', 'true');

    await fixturePage.getByRole('button', { name: 'LINKS', exact: true }).tap();
    await expect(fixturePage.locator('.map-node--center')).toContainText('Alex Machaskee');
    await expect(fixturePage.locator('.map-node--center .photo')).toHaveAttribute('data-image-state', 'missing');

    await fixturePage.getByRole('button', { name: 'YEARS', exact: true }).tap();
    await expect(fixturePage.getByRole('complementary', { name: 'Selected person' })).toContainText('Alex Machaskee');
    await expect(fixturePage.locator('.year-person[data-person-id="alex-machaskee-2010"] .photo')).toHaveAttribute('data-image-state', 'missing');
  } finally {
    await context.close();
  }
});

test('uses the portrait fallback for a broken image and fits an unusually long name', async ({ browser, page }) => {
  const longName = 'Alexandra Machaskee With An Extraordinarily Long Museum Label';
  const { context, fixturePage } = await openInducteeFixture(
    browser,
    page.url(),
    (person) => {
      person.name = longName;
      person.primaryImageUrl = '/media/images/__mg01-broken__/primary.jpg';
    },
  );
  try {
    await fixturePage.getByRole('searchbox', { name: 'Find a person or year' }).fill('Extraordinarily');
    const tile = fixturePage.locator('.person-tile[data-person-id="alex-machaskee-2010"]');
    await tile.focus();
    await fixturePage.keyboard.press('Enter');
    await expect(tile).toHaveAttribute('aria-pressed', 'true');
    await expect(tile.locator('.photo')).toHaveAttribute('data-image-state', 'failed');
    await expect(tile).toContainText('PORTRAIT NOT AVAILABLE');
    const dimensions = await tile.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
    await expect(fixturePage.getByRole('heading', { name: longName })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('restores a far-down People position, sort, and record trigger focus', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Sort people' }).selectOption('earliest');
  const field = page.locator('.field__content');
  const tile = page.locator('.person-tile[data-person-id="lucy-torres-2026"]');
  await tile.scrollIntoViewIfNeeded();
  await tile.focus();
  await page.keyboard.press('Enter');
  await expect(tile).toHaveAttribute('aria-pressed', 'true');
  const scrollBeforeRecord = await field.evaluate((element) => element.scrollTop);
  expect(scrollBeforeRecord).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Open full record for Lucy Torres' }).click();
  await expect(page.getByRole('region', { name: 'Lucy Torres full record' })).toBeVisible();
  await page.getByRole('button', { name: 'CLOSE', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Open full record for Lucy Torres' })).toBeFocused();
  await expect(page.getByRole('combobox', { name: 'Sort people' })).toHaveValue('earliest');
  await expect(tile).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => field.evaluate((element) => element.scrollTop)).toBe(scrollBeforeRecord);
});

test('re-centers Links and carries selection between scenes', async ({ page }) => {
  await page.getByRole('button', { name: 'LINKS', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Find a person in the relationship index' }).fill('Alex Machaskee');
  await page.getByRole('button', { name: /Explore links for Alex Machaskee/ }).click();
  await expect(page.locator('.link-map__legend')).toContainText('0 DOCUMENTED RELATIONSHIPS');
  await expect(page.locator('.link-map__legend')).toContainText('HONORED IN THE SAME YEAR');
  await expect(page.locator('.map-node--center')).toContainText('Alex Machaskee');
  await page.locator('#mapCenterButton').click();
  await expect(page.getByRole('region', { name: 'Alex Machaskee full record' })).toBeVisible();
  await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
  await expect(page.locator('#mapCenterButton')).toBeFocused();
  const next = await page.locator('.map-node--class').first().locator('strong').textContent();
  await page.locator('.map-node--class').first().click();
  await expect(page.locator('#linkConnectionDetail')).toContainText('Honored in the same year');
  await page.locator('#linkConnectionDetail').getByRole('button', { name: /CENTER ON/ }).click();
  await expect(page.locator('.map-node--center')).toContainText(next ?? '');
  await page.getByRole('button', { name: 'YEARS', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Selected person' })).toContainText(next ?? '');
  await page.getByRole('button', { name: 'PEOPLE', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Selected person' })).toContainText(next ?? '');
  await page.getByRole('button', { name: 'Back to previous person' }).click();
  await expect(page.getByRole('complementary', { name: 'Selected person' })).toContainText('Alex Machaskee');
});

test('navigates induction classes and keeps pending media out of the visitor chronology', async ({ page }) => {
  await page.getByRole('button', { name: 'YEARS', exact: true }).click();
  const viewport = page.locator('.film-line__viewport');
  const start = await viewport.evaluate((element) => element.scrollLeft);
  await page.getByRole('button', { name: 'Next induction class' }).click();
  await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(start);
  await page.getByRole('button', { name: /Jump to 2026 induction class/ }).click();
  await expect(page.locator('.film-line__year[aria-current="date"]')).toHaveText('2026');
  await viewport.focus();
  await page.keyboard.press('Home');
  await expect(page.locator('.film-line__year[aria-current="date"]')).toHaveText('2010');
  await page.getByRole('button', { name: /Jump to 2015 induction class/ }).click();
  await expect(page.locator('#induction-year-2015 .year-person[data-person-id="bishop-anthony-pilla-2015"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /film .* for Bishop Anthony Pilla/i })).toHaveCount(0);
  await expect(page.getByText(/awaiting approval/i)).toHaveCount(0);
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.locator('track')).toHaveCount(0);
  await page.locator('#year-record-bishop-anthony-pilla-2015').click();
  await expect(page.locator('.record-view')).toContainText('Bishop Anthony Pilla');
  await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
  await expect(page.locator('#year-record-bishop-anthony-pilla-2015')).toBeFocused();
});

test('swipes the film line on a touch screen', async ({ browser, page }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const touchPage = await context.newPage();
  try {
    await touchPage.goto(page.url());
    await touchPage.getByRole('button', { name: 'YEARS', exact: true }).click();
    const viewport = touchPage.locator('.film-line__viewport');
    const start = await viewport.evaluate((element) => element.scrollLeft);
    const bounds = await viewport.boundingBox();
    expect(bounds).not.toBeNull();
    const y = Math.round(bounds!.y + bounds!.height / 2);
    const cdp = await context.newCDPSession(touchPage);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y }] });
    for (const x of [260, 220, 180, 140, 100]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(start + 100);
  } finally {
    await context.close();
  }
});

test('maps old deep links, persists theme, and keeps mobile controls inside the screen', async ({ page }) => {
  await page.goto('./?view=world&person=alex-machaskee-2010');
  await expect(page.locator('.installation')).toHaveAttribute('data-view', 'links');
  await expect(page.locator('.map-node--center')).toContainText('Alex Machaskee');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('.installation')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('.installation')).toHaveAttribute('data-theme', 'dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'YEARS', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await expect(page.getByRole('button', { name: 'Next induction class' })).toBeInViewport();
});

for (const viewport of [
  { width: 390, height: 844 }, { width: 768, height: 1024 },
  { width: 1920, height: 1080 }, { width: 3840, height: 2160 },
]) {
  test(`keeps portrait tiles consistent at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.evaluate(() => document.fonts.ready);
    const heights = await page.locator('.person-tile .photo').evaluateAll((photos) => photos.map((photo) => photo.getBoundingClientRect().height));
    expect(heights).toHaveLength(111);
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  });
}

test('publishes collection exports and the offline worker', async ({ page, request }) => {
  const response = await request.get('./data/standards-index.json');
  expect(response.ok()).toBe(true);
  const index = await response.json() as { coverage?: { inductees?: number; iiifManifests?: number } };
  expect(index.coverage?.inductees).toBe(111);
  expect(index.coverage?.iiifManifests).toBeGreaterThan(100);
  await page.goto('./?kiosk=1');
  const worker = await page.evaluate(async () => {
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 8_000)),
    ]);
    return registration?.active?.scriptURL ?? registration?.installing?.scriptURL ?? '';
  });
  expect(worker).toContain('/sw.js');
});
