import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const screenshotDir = process.env.CIHOF_FINAL_STEP2_SCREENSHOT_DIR ?? '/tmp/cihof-final-step2';

test.describe('focused portrait as in-place record', () => {
  test('keeps focus/actions anchored to the same Hall lens', async ({ page }) => {
    test.setTimeout(90_000);
    mkdirSync(screenshotDir, { recursive: true });
    await page.goto('./');

    const candidate = await readActionCandidateData(page);
    await page.locator(`button.living-portrait[data-transition-person="${candidate.id}"]`).click();
    await expectHall(page, 'portraits', candidate.id);
    await expect(page.getByRole('button', { name: 'FOLLOW THE TRACE →' })).toBeVisible();
    await screenshotHall(page, 'portraits-focus');

    await waitForGuard(page);
    await page.getByRole('button', { name: 'Arrange Hall by heritage and connections' }).click();
    await expectHall(page, 'traces', candidate.id);
    await screenshotHall(page, 'traces-focus');

    await waitForGuard(page);
    await page.getByRole('button', { name: 'Arrange Hall by induction history' }).click();
    await expectHall(page, 'legacies', candidate.id);
    await screenshotHall(page, 'legacies-focus');

    await waitForGuard(page);
    await dismissLegacyFocus(page);
    await page.getByRole('button', { name: 'Arrange Hall by portraits' }).click();
    await expectHall(page, 'portraits', candidate.id);

    await waitForGuard(page);
    await page.getByRole('button', { name: 'LIFE + WORK' }).click();
    await expect(page.locator('.living-hall__personActionPanel .story-mode')).toBeVisible();
    await expectPersonActionHeader(page, candidate.name);
    await expectHall(page, 'portraits', candidate.id);
    await screenshotHall(page, 'life-work');
    await page.locator('.living-hall__personActionHeader button').click();
    await expect(page.locator('.living-hall__personActionPanel')).toHaveCount(0);
    await expectHall(page, 'portraits', candidate.id);

    await page.getByRole('button', { name: 'FULL TEXT' }).click();
    const fullTextPanel = page.locator('.living-hall__personActionPanel .living-hall__fullText');
    await expect(fullTextPanel).toBeVisible();
    await expectPersonActionHeader(page, candidate.name);
    await expect(fullTextPanel.locator('.living-hall__fullTextHeader')).toContainText('Source Biography');
    await expect(fullTextPanel).toHaveAttribute('data-word-count', /[1-9][0-9]+/);
    await expect(fullTextPanel.locator('.living-hall__fullTextBody p').first()).toBeVisible();
    await expectHall(page, 'portraits', candidate.id);
    await screenshotHall(page, 'full-text');
    await page.locator('.living-hall__personActionHeader button').click();
    await expect(page.locator('.living-hall__personActionPanel')).toHaveCount(0);
    await expectHall(page, 'portraits', candidate.id);

    await page.getByRole('button', { name: 'WATCH INDUCTION' }).click();
    await expect(page.locator('.living-hall__personActionPanel .media-experience')).toBeVisible();
    await expectPersonActionHeader(page, candidate.name);
    await expectHall(page, 'portraits', candidate.id);
    await screenshotHall(page, 'watch');
    await page.locator('.living-hall__personActionHeader button').click();
    await expect(page.locator('.living-hall__personActionPanel')).toHaveCount(0);
    await expectHall(page, 'portraits', candidate.id);

    await page.getByRole('button', { name: 'TAKE IT WITH YOU' }).click();
    await expect(page.locator('.living-hall__personActionPanel .qr-continuation')).toBeVisible();
    await expectPersonActionHeader(page, candidate.name);
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

async function expectPersonActionHeader(page: Page, name: string) {
  const heading = page.locator('.living-hall__personActionHeader span');
  await expect(heading).toHaveText(name);
  await expect(heading).not.toHaveText(/^(LIFE \+ WORK|FULL TEXT|WATCH INDUCTION|TAKE IT WITH YOU)$/);
}

async function dismissLegacyFocus(page: Page) {
  const dialog = page.getByRole('dialog', { name: /cohort navigator/i });
  await expect(dialog).toBeVisible();
  const point = await pointOutsideDialog(page);
  await page.mouse.click(point.x, point.y);
  await expect(dialog).toBeHidden();
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', '');
}

async function pointOutsideDialog(page: Page) {
  const point = await page.evaluate(() => {
    const hall = document.querySelector<HTMLElement>('.living-hall')?.getBoundingClientRect() ?? null;
    const dialog = document.querySelector<HTMLElement>('.living-hall__focusCard')?.getBoundingClientRect() ?? null;
    if (!hall) return null;
    const candidates = [
      { x: hall.right - 96, y: hall.top + hall.height * 0.52 },
      { x: hall.left + hall.width * 0.52, y: hall.bottom - 148 },
      { x: hall.right - 96, y: hall.top + 128 },
    ];
    return candidates.find(({ x, y }) => {
      if (!dialog) return true;
      return x < dialog.left || x > dialog.right || y < dialog.top || y > dialog.bottom;
    }) ?? candidates[0];
  });

  if (!point) throw new Error('No point outside the cohort navigator was available.');
  return point;
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
