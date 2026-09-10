import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const screenshotDir = process.env.CIHOF_FINAL_STEP1_SCREENSHOT_DIR ?? '/tmp/cihof-final-step1';

test.describe('final exhibition art direction', () => {
  test('captures PORTRAITS idle, PORTRAITS engaged, TRACES focused, and LEGACIES', async ({ page }) => {
    mkdirSync(screenshotDir, { recursive: true });

    await page.goto('./?kiosk=1');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'portraits');
    await expect(page.locator('button.living-portrait').first()).toBeVisible();
    await expect(page.locator('.living-hall--attract')).toBeVisible({ timeout: 7_000 });
    await page.locator('.hall-surface').screenshot({
      animations: 'disabled',
      path: `${screenshotDir}/portraits-idle.png`,
    });

    await page.mouse.click(72, 72);
    await expect(page.locator('.living-hall--attract')).toBeHidden();

    const firstPortrait = page.locator('button.living-portrait').first();
    const firstPersonId = await firstPortrait.getAttribute('data-transition-person');
    expect(firstPersonId).toBeTruthy();
    await firstPortrait.click();
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', firstPersonId ?? '');
    await expect(page.locator('.living-hall__focusCard')).toContainText('HONORED FOR');
    await page.locator('.hall-surface').screenshot({
      animations: 'disabled',
      path: `${screenshotDir}/portraits-engaged.png`,
    });

    await waitForGuard(page);
    await page.getByRole('button', { name: 'Arrange Hall by heritage and connections' }).click();
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'traces');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', firstPersonId ?? '');
    await expect(page.locator('.cleveland-trace-field--traces[data-runtime-gis="false"]')).toBeVisible();
    await page.locator('.hall-surface').screenshot({
      animations: 'disabled',
      path: `${screenshotDir}/traces-focused.png`,
    });

    await waitForGuard(page);
    await page.getByRole('button', { name: 'Arrange Hall by induction history' }).click();
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'legacies');
    await expect(page.locator('.cleveland-trace-field--legacies[data-runtime-gis="false"]')).toBeVisible();
    await page.locator('.hall-surface').screenshot({
      animations: 'disabled',
      path: `${screenshotDir}/legacies.png`,
    });
  });
});

async function waitForGuard(page: import('@playwright/test').Page) {
  await expect(page.locator('.transition-input-guard')).toBeHidden({ timeout: 2_500 });
}
