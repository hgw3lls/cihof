import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('button.living-portrait:visible').first()).toBeVisible();
});

test('opens a usable People index with searchable portraits', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Cleveland International Hall of Fame' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Explore the hall' })).toBeVisible();
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'portraits');
  await expect(page.locator('button.living-portrait')).toHaveCount(111);

  await page.getByRole('searchbox', { name: 'Find a person or year' }).fill('Dona Brady');
  await expect(page.locator('button.living-portrait:visible')).toHaveCount(1);
  await page.locator('button.living-portrait:visible').click();
  await expect(page.locator('.living-hall__focusCard')).toContainText('Dona Brady');
  await expect(page.getByRole('button', { name: 'LIFE + WORK' })).toBeVisible();
});

test('keeps biography actions connected to the selected portrait', async ({ page }) => {
  await page.locator('button.living-portrait:visible').first().click();
  const card = page.locator('.living-hall__focusCard');
  await expect(card).toBeVisible();
  await expect(card.locator('img')).toBeVisible();

  await page.getByRole('button', { name: 'LIFE + WORK' }).click();
  await expect(page.locator('.living-hall__personActionPanel')).toHaveAttribute('data-action-label', /life|work|story/i);
  await page.getByRole('button', { name: 'Return To Portrait' }).click();
  await expect(page.locator('.living-hall__personActionPanel')).toHaveCount(0);

  await page.getByRole('button', { name: 'FULL TEXT' }).click();
  await expect(page.locator('.living-hall__personActionPanel')).toBeVisible();
  await page.getByRole('button', { name: 'Return To Portrait' }).click();
  await page.getByRole('button', { name: 'Close focused portrait' }).click();
  await expect(card).toHaveCount(0);
});

test('changes connection modes and focuses a linked person', async ({ page }) => {
  await page.getByRole('button', { name: 'Links', exact: true }).click();
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'traces');
  await expect(page.getByRole('complementary', { name: 'Connection modes' })).toBeVisible();
  await expect(page.locator('button.living-portrait:visible').first()).toBeVisible();

  const choices = page.locator('.index-link-rail button');
  expect(await choices.count()).toBeGreaterThan(1);
  const nextMode = await choices.nth(1).textContent();
  await choices.nth(1).click();
  await expect(page.locator('.index-link-rail button[aria-pressed="true"]')).toHaveText(nextMode ?? '');
  await page.locator('button.living-portrait:visible').first().click();
  await expect(page.locator('.living-hall__focusCard')).toBeVisible();
});

test('selects a year and navigates its cohort', async ({ page }) => {
  await page.getByRole('button', { name: 'Years', exact: true }).click();
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'legacies');
  await page.getByRole('button', { name: 'Class of 2026' }).click();
  await expect(page.locator('.living-hall')).toHaveAttribute('data-legacy-active-year', '2026');
  await expect(page.getByRole('heading', { name: 'Years / 2026' })).toBeVisible();
  await expect(page.locator('button.living-portrait:visible').first()).toBeVisible();
  await page.locator('button.living-portrait:visible').first().click();
  await expect(page.locator('.living-hall__focusCard')).toBeVisible();
  await expect(page.locator('.living-hall__focusCard')).toContainText('2026');
});

test('saves a portrait to the visit collection and opens its QR', async ({ page }) => {
  await page.locator('button.living-portrait').first().click();
  await page.getByRole('button', { name: 'SAVE TO VISIT' }).click();
  await expect(page.locator('.living-hall')).toHaveAttribute('data-visit-collection-count', '1');
  await page.getByRole('button', { name: 'Visit 01' }).click();
  await expect(page.getByRole('complementary', { name: 'Saved visit collection' })).toBeVisible();
  await page.getByRole('button', { name: 'Visit QR' }).click();
  await expect(page.getByRole('dialog', { name: 'Saved visit QR' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Saved visit QR' }).getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog', { name: 'Saved visit QR' })).toHaveCount(0);
});

test('opens recorded media and a take-home profile QR', async ({ page }) => {
  await page.locator('button.living-portrait[data-media-available="true"]').first().click();
  await page.getByRole('button', { name: 'WATCH INDUCTION' }).click();
  await expect(page.locator('.detail--action-watch')).toBeVisible();
  await page.getByRole('button', { name: 'Return To Portrait' }).click();

  await page.getByRole('button', { name: 'TAKE IT WITH YOU' }).click();
  await expect(page.locator('.detail--action-continue')).toBeVisible();
  await expect(page.locator('.qr-continuation--hall-focus')).toBeVisible();
  await page.getByRole('button', { name: 'Return To Portrait' }).click();
});

test('maps old visitor deep links into the current scenes', async ({ page }) => {
  await page.goto('./?view=world');
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'traces');
  await page.goto('./?view=time');
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'legacies');
  await page.goto('./?person=dona-brady-2024');
  await expect(page.locator('.living-hall__focusCard')).toContainText('Dona Brady');
});

test('defaults to light and persists dark mode across reloads', async ({ page }) => {
  await expect(page.locator('.museum-shell')).toHaveAttribute('data-color-mode', 'light');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('.museum-shell')).toHaveAttribute('data-color-mode', 'dark');
  await page.reload();
  await expect(page.locator('.museum-shell')).toHaveAttribute('data-color-mode', 'dark');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('.museum-shell')).toHaveAttribute('data-color-mode', 'light');
});

test('keeps mobile navigation and the year rail inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Years', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Class of 2026' })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    railRight: document.querySelector('.index-year-rail')?.getBoundingClientRect().right ?? 0,
    fieldLeft: document.querySelector('.living-hall__fieldViewport')?.getBoundingClientRect().left ?? 0,
  }));
  expect(dimensions.document).toBe(dimensions.viewport);
  expect(dimensions.railRight).toBe(dimensions.fieldLeft);
});

test('keeps the 4K index populated and framed', async ({ page }) => {
  await page.setViewportSize({ width: 3840, height: 2160 });
  await expect(page.locator('button.living-portrait:visible').first()).toBeVisible();
  const view = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    loadedPortraits: [...document.querySelectorAll<HTMLImageElement>('button.living-portrait img')]
      .filter((image) => image.complete && image.naturalWidth > 0).length,
  }));
  expect(view.document).toBe(view.viewport);
  expect(view.loadedPortraits).toBeGreaterThan(0);
});

test('publishes offline and collection-data entrypoints', async ({ page, request }) => {
  const standards = await request.get('./data/standards-index.json');
  expect(standards.ok()).toBe(true);
  const index = await standards.json() as {
    exports?: Record<string, { path?: string }>;
    coverage?: { inductees?: number; iiifManifests?: number };
  };
  expect(index.exports?.linkedArt?.path).toBe('/data/linked-art-export.json');
  expect(index.exports?.cidocCrm?.path).toBe('/data/cidoc-crm-export.json');
  expect(index.exports?.iiifCollection?.path).toBe('/data/iiif-collection.json');
  expect(index.coverage?.inductees).toBeGreaterThan(100);
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
