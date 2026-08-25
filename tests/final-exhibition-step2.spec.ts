import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const screenshotDir = process.env.CIHOF_FINAL_STEP2_SCREENSHOT_DIR ?? '/tmp/cihof-final-step2';

test.describe('focused portrait as in-place record', () => {
  test('keeps focus/actions anchored to the same Hall lens', async ({ page }) => {
    mkdirSync(screenshotDir, { recursive: true });
    await page.goto('./');

    const candidate = await readActionCandidateData(page);
    await page.locator(`button.living-portrait[data-transition-person="${candidate.id}"]`).click();
    await expectHall(page, 'portraits', candidate.id);
    await expect(page.getByRole('button', { name: 'FOLLOW THE TRACE →' })).toBeVisible();
    await screenshotHall(page, 'portraits-focus');

    await waitForGuard(page);
    await page.getByRole('button', { name: 'Arrange Hall by documented places and connections' }).click();
    await expectHall(page, 'traces', candidate.id);
    await screenshotHall(page, 'traces-focus');

    await waitForGuard(page);
    await page.getByRole('button', { name: 'Arrange Hall by induction history' }).click();
    await expectHall(page, 'legacies', candidate.id);
    await screenshotHall(page, 'legacies-focus');

    await waitForGuard(page);
    await page.getByRole('button', { name: 'Arrange Hall by portraits' }).click();
    await expectHall(page, 'portraits', candidate.id);

    await waitForGuard(page);
    await page.getByRole('button', { name: 'LIFE + WORK' }).click();
    await expect(page.locator('.living-hall__personActionPanel .story-mode')).toBeVisible();
    await expectHall(page, 'portraits', candidate.id);
    await screenshotHall(page, 'life-work');
    await page.locator('.living-hall__personActionHeader button').click();
    await expect(page.locator('.living-hall__personActionPanel')).toHaveCount(0);
    await expectHall(page, 'portraits', candidate.id);

    await page.getByRole('button', { name: 'WATCH INDUCTION' }).click();
    await expect(page.locator('.living-hall__personActionPanel .media-experience')).toBeVisible();
    await expectHall(page, 'portraits', candidate.id);
    await screenshotHall(page, 'watch');
    await page.locator('.living-hall__personActionHeader button').click();
    await expect(page.locator('.living-hall__personActionPanel')).toHaveCount(0);
    await expectHall(page, 'portraits', candidate.id);

    await page.getByRole('button', { name: 'TAKE IT WITH YOU' }).click();
    await expect(page.locator('.living-hall__personActionPanel .qr-continuation')).toBeVisible();
    await expect(page.locator('.qr-continuation--hall-focus')).toContainText('Scan to continue on the Cleveland International Hall of Fame website.');
    await expectHall(page, 'portraits', candidate.id);
    await screenshotHall(page, 'qr');
    await expect(page.locator('.living-hall__personActionPanel')).toHaveCount(0, { timeout: 7_000 });
    await expectHall(page, 'portraits', candidate.id);
  });
});

async function expectHall(page: Page, lens: string, personId: string) {
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', lens);
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', personId);
  await expect(page.locator(`button.living-portrait[data-transition-person="${personId}"]`)).toHaveClass(/living-portrait--focused/);
  await expect(page.locator('.living-hall')).toBeVisible();
  await expect(page.locator('.detail--visitor:not(.living-hall__personActionPanel)')).toHaveCount(0);
}

async function screenshotHall(page: Page, name: string) {
  await page.locator('.hall-surface').screenshot({
    animations: 'disabled',
    path: `${screenshotDir}/${name}.png`,
  });
}

async function waitForGuard(page: Page) {
  await expect(page.locator('.transition-input-guard')).toBeHidden({ timeout: 2_500 });
}

async function readActionCandidateData(page: Page) {
  const response = await page.request.get('data/inductees.json');
  expect(response.ok()).toBe(true);
  const inductees = await response.json() as Array<{
    id: string;
    name: string;
    localVideoPaths?: string[];
    profileUrl?: string;
    youtubeVideoIds?: string[];
  }>;
  const candidate = inductees.find((inductee) => {
    const mediaCount = (inductee.youtubeVideoIds?.length ?? 0) + (inductee.localVideoPaths?.length ?? 0);
    return Boolean(inductee.id && inductee.profileUrl && mediaCount > 0);
  });
  if (!candidate) throw new Error('No inductee with media and continuation URL found in test data.');
  return { id: candidate.id, name: candidate.name };
}
