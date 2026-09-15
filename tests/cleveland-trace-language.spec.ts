import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const screenshotDir = process.env.CIHOF_TRACE_SCREENSHOT_DIR ?? '/tmp/cihof-cleveland-trace-screenshots';

test.describe('Cleveland-derived TRACES line language', () => {
  test('uses local Cleveland motifs for portraits, traces, follow-the-trace, and legacies', async ({ page }) => {
    test.setTimeout(60_000);
    mkdirSync(screenshotDir, { recursive: true });
    const gisRequests: string[] = [];
    await page.route(/gis\.cuyahogacounty\.gov/, async (route) => {
      gisRequests.push(route.request().url());
      await route.abort();
    });

    await page.goto('./');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'portraits');
    await expect(page.locator('.cleveland-trace-field--portraits[data-runtime-gis="false"]')).toBeVisible();
    await page.screenshot({ path: `${screenshotDir}/01-portraits-latent.png` });

    const firstPortrait = page.locator('button.living-portrait').first();
    await expect(firstPortrait).toBeVisible();
    const firstPersonId = await firstPortrait.getAttribute('data-transition-person');
    expect(firstPersonId).toBeTruthy();
    await firstPortrait.click();
    await waitForGuard(page);

    await page.getByRole('button', { name: 'Arrange Hall by heritage and connections' }).click();
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'traces');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', firstPersonId ?? '');
    await expect(page.locator('.cleveland-trace-field--traces[data-runtime-gis="false"]')).toBeVisible();
    await expect(page.locator('.living-hall__traceFocus')).toBeVisible();
    await expect(page.locator('.living-hall__traceConnection').first()).toBeVisible();
    await expect(page.locator('.living-hall__tracePanel')).toHaveCount(0);
    const initialRelationshipPaths = page.locator('.cleveland-trace--relationship .cleveland-trace__path--main');
    await expect(initialRelationshipPaths.first()).toBeVisible();
    expect(await initialRelationshipPaths.count()).toBeGreaterThanOrEqual(4);
    await page.screenshot({ path: `${screenshotDir}/02-traces-focused.png` });

    const secondPortrait = page.locator('button.living-portrait--emphasis:not(.living-portrait--focused)').first();
    await expect(secondPortrait).toBeVisible();
    const secondPersonId = await secondPortrait.getAttribute('data-transition-person');
    expect(secondPersonId).toBeTruthy();
    await secondPortrait.click();
    await waitForGuard(page);
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'traces');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', secondPersonId ?? '');
    await expect(page.locator('.cleveland-trace-field--traces[data-runtime-gis="false"]')).toBeVisible();
    await page.screenshot({ path: `${screenshotDir}/03-traces-redraw-second-focus.png` });

    for (let index = 0; index < 3; index += 1) {
      const nextPortrait = page.locator('button.living-portrait--emphasis:not(.living-portrait--focused)').first();
      await expect(nextPortrait).toBeVisible();
      await nextPortrait.click();
      await waitForGuard(page);
      await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'traces');
    }

    await expect(page.locator('.living-hall')).toHaveAttribute('data-trace-trail-size', /^[3-5]$/);
    await expect(page.locator('.cleveland-trace--trail .cleveland-trace__path--main').first()).toBeVisible();
    await page.screenshot({ path: `${screenshotDir}/04-follow-the-trace-accumulated.png` });

    await page.getByRole('button', { name: 'Arrange Hall by induction history' }).click();
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'legacies');
    await expect(page.locator('.cleveland-trace-field--legacies[data-runtime-gis="false"]')).toBeVisible();
    await page.screenshot({ path: `${screenshotDir}/05-legacies-register.png` });

    expect(gisRequests).toEqual([]);
  });
});

async function waitForGuard(page: Page) {
  await expect(page.locator('.transition-input-guard')).toBeHidden({ timeout: 2_500 });
}
