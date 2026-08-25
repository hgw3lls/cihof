import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const screenshotDir = process.env.CIHOF_FRAME_SCREENSHOT_DIR ?? '/tmp/cihof-portrait-frame-screenshots';

test.describe('production PortraitFrame system', () => {
  test('the same real inductee frame renders standard, focus, trace, and legacy states', async ({ page }) => {
    mkdirSync(screenshotDir, { recursive: true });
    await page.goto('./');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'portraits');

    const standardPortrait = page.locator('button.living-portrait').first();
    await expect(standardPortrait).toBeVisible();
    const personId = await standardPortrait.getAttribute('data-transition-person');
    expect(personId).toBeTruthy();
    const id = personId ?? '';

    await expectFrameState(page, id, 'standard');
    await screenshotFrame(page, id, 'standard');

    await page.getByRole('button', { name: 'Arrange Hall by documented places and connections' }).click();
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'traces');
    await waitForGuard(page);
    await expectFrameState(page, id, 'trace');
    await screenshotFrame(page, id, 'trace');

    await page.getByRole('button', { name: 'Arrange Hall by induction history' }).click();
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'legacies');
    await waitForGuard(page);
    await page.waitForTimeout(820);
    await expectFrameState(page, id, 'legacy');
    await expect(page.locator(`button.living-portrait[data-transition-person="${id}"]`)).toHaveCSS('--frame-rotation', '0deg');
    await screenshotFrame(page, id, 'legacy');

    await page.locator(`button.living-portrait[data-transition-person="${id}"]`).click();
    await expectFrameState(page, id, 'focus');
    await screenshotFrame(page, id, 'focus');

    await expect(page.locator(`button.living-portrait[data-transition-person="${id}"] .portrait-frame`)).toHaveAttribute('data-frame-aspect', /^(tall|wide)$/);
    await expect(page.locator(`button.living-portrait[data-transition-person="${id}"] img[src*="/media/images/"], button.living-portrait[data-transition-person="${id}"] .portrait-frame__fallback`)).toBeVisible();
  });
});

async function expectFrameState(page: Page, personId: string, state: string) {
  const portrait = page.locator(`button.living-portrait[data-transition-person="${personId}"]`);
  await expect(portrait).toHaveCount(1);
  await expect(portrait).toHaveAttribute('data-frame-state', state);
  await expect(portrait.locator('.portrait-frame')).toHaveAttribute('data-frame-state', state);
  await expect(portrait.locator('.portrait-frame')).toBeVisible();
}

async function screenshotFrame(page: Page, personId: string, state: string) {
  const frame = page.locator(`button.living-portrait[data-transition-person="${personId}"]`);
  await expect(frame.locator('.portrait-frame__image, .portrait-frame__fallback')).toBeVisible();
  await frame.screenshot({
    animations: 'disabled',
    path: `${screenshotDir}/${state}.png`,
  });
}

async function waitForGuard(page: Page) {
  await expect(page.locator('.transition-input-guard')).toBeHidden({ timeout: 2_500 });
}
