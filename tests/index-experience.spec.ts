import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('cihof.kiosk-settings.v1', JSON.stringify({ idleTimeoutMs: 120000 })));
  await page.goto('./');
  await expect(page.locator('.person-tile')).toHaveCount(111);
});

test('starts without privileging an inductee in any scene', async ({ page }) => {
  await expect(page.locator('.installation')).toHaveAttribute('data-selection', 'none');
  await expect(page.getByRole('heading', { name: '111 INDUCTEES' })).toBeVisible();
  await page.getByRole('button', { name: 'LINKS', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Relationship index' })).toBeVisible();
  await expect(page.locator('.map-node')).toHaveCount(0);
  await page.getByRole('button', { name: 'YEARS', exact: true }).click();
  await expect(page.locator('.installation')).toHaveAttribute('data-selection', 'none');
  await expect(page.locator('.film-event')).toHaveCount(93);
  await expect(page.locator('.film-line__current')).toContainText('2015');
});

test('searches People, pins one portrait, and opens the complete record and QR', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Find a person or year' }).fill('Alex Machaskee');
  await page.getByRole('button', { name: /Select Alex Machaskee/ }).click();
  await expect(page.getByRole('complementary', { name: 'Selected person' })).toContainText('Alex Machaskee');
  await expect(page.locator('.person-tile')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open full record for Alex Machaskee' }).click();
  await expect(page.getByRole('region', { name: 'Alex Machaskee full record' })).toContainText('BIOGRAPHY');
  await expect(page.locator('.record-view__story')).toContainText('The Plain Dealer');
  await page.getByRole('button', { name: 'TAKE THIS RECORD' }).click();
  await expect(page.getByRole('dialog', { name: 'Take Alex Machaskee record with you' })).toBeVisible();
  await expect(page.locator('.qr-continuation__code img')).toHaveCount(1);
  await page.getByRole('button', { name: 'Return To Portrait' }).click();
  await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await expect(page.locator('.installation')).toHaveAttribute('data-selection', 'none');
});

test('re-centers Links and carries selection between scenes', async ({ page }) => {
  await page.getByRole('button', { name: 'LINKS', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Find a person in the relationship index' }).fill('Alex Machaskee');
  await page.getByRole('button', { name: /Explore links for Alex Machaskee/ }).click();
  await expect(page.locator('.map-node--center')).toContainText('Alex Machaskee');
  const next = await page.locator('.map-node--archive').first().locator('strong').textContent();
  await page.locator('.map-node--archive').first().click();
  await expect(page.locator('.map-node--center')).toContainText(next ?? '');
  await page.getByRole('button', { name: 'YEARS', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Selected person' })).toContainText(next ?? '');
  await page.getByRole('button', { name: 'PEOPLE', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Selected person' })).toContainText(next ?? '');
  await page.getByRole('button', { name: 'Back to previous person' }).click();
  await expect(page.getByRole('complementary', { name: 'Selected person' })).toContainText('Alex Machaskee');
});

test('navigates the film line and protects pending media', async ({ page }) => {
  await page.getByRole('button', { name: 'YEARS', exact: true }).click();
  const viewport = page.locator('.film-line__viewport');
  const start = await viewport.evaluate((element) => element.scrollLeft);
  await page.getByRole('button', { name: 'Next year' }).click();
  await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(start);
  await page.getByRole('button', { name: /Jump to 2026/ }).click();
  await expect(page.locator('.film-line__year[aria-current="date"]')).toHaveText('2026');
  await viewport.focus();
  await page.keyboard.press('Home');
  await expect(page.locator('.film-line__year[aria-current="date"]')).toHaveText('2010');
  await page.getByRole('button', { name: /Jump to 2015/ }).click();
  await page.getByRole('button', { name: /Open film 1 for Bishop Anthony Pilla/ }).click();
  await expect(page.locator('.film-projection--pending')).toContainText('FILM AWAITING APPROVAL');
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.locator('track')).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Selected person' })).toContainText('Bishop Anthony Pilla');
  await page.getByRole('button', { name: 'RECORD', exact: true }).first().click();
  await expect(page.locator('.record-view')).toContainText('Bishop Anthony Pilla');
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

test('shows player and transcript only after every approval is present', async ({ browser, page }) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const approvedPage = await context.newPage();
  try {
    await approvedPage.route('**/data/cihof-runtime-data.json', async (route) => {
      const response = await route.fetch();
      const bundle = await response.json();
      const film = bundle.mediaManifest.assets['bishop-anthony-pilla-2015'].videos[0];
      film.rightsStatus = 'approved';
      film.captionStatus = 'approved';
      film.transcriptStatus = 'approved';
      film.approvedForKiosk = true;
      await route.fulfill({ response, json: bundle });
    });
    await approvedPage.goto(page.url());
    await approvedPage.getByRole('button', { name: 'YEARS', exact: true }).click();
    await approvedPage.getByRole('button', { name: /Open film 1 for Bishop Anthony Pilla/ }).click();
    await expect(approvedPage.locator('.film-projection video')).toHaveCount(1);
    await expect(approvedPage.locator('.film-projection track[kind="captions"]')).toHaveCount(1);
    await expect(approvedPage.locator('.film-projection__transcript')).toBeVisible();
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
  await expect(page.getByRole('button', { name: 'Next year' })).toBeInViewport();
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
