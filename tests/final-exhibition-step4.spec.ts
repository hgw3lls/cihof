import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const screenshotDir = process.env.CIHOF_FINAL_SCREENSHOT_DIR ?? '/tmp/cihof-final';

test.describe('final installation choreography screenshots', () => {
  test('captures final persistent Hall states without replacing the collection', async ({ page }) => {
    mkdirSync(screenshotDir, { recursive: true });

    await page.goto('./?kiosk=1');
    await expect(page.locator('.hall-surface')).toHaveCount(1);
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'portraits');
    await expect(page.locator('button.living-portrait').first()).toBeVisible();
    const initialPortraitCount = await portraitCount(page);
    await expect(page.locator('.living-hall--attract')).toBeVisible({ timeout: 7_000 });
    await screenshotHall(page, '01-portraits-idle');

    await page.goto('./');
    await expect(page.locator('.hall-surface')).toHaveCount(1);
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'portraits');

    const candidateId = await clickFirstPortrait(page);
    await expectHall(page, 'portraits', candidateId);
    await screenshotHall(page, '02-portraits-focused');

    await waitForGuard(page);
    await page.getByRole('button', { name: 'Arrange Hall by heritage and connections' }).click();
    await expectHall(page, 'traces', candidateId);
    await screenshotHall(page, '03-traces');

    await ensureConceptTraceAvailable(page);
    const conceptControl = page.locator('.living-hall__traceControl').filter({ hasText: 'Concept' }).first();
    await expect(conceptControl).toBeVisible();
    await conceptControl.click();
    await waitForGuard(page);
    for (let index = 0; index < 3; index += 1) {
      await clickVisibleRelatedPortrait(page);
      await waitForGuard(page);
    }
    await expect(page.locator('.living-hall')).toHaveAttribute('data-trace-focus-key', /^concept:/);
    await expect(page.locator('.cleveland-trace--trail .cleveland-trace__path--main').first()).toBeVisible();
    await screenshotHall(page, '04-follow-the-trace');

    await page.getByRole('button', { name: 'Arrange Hall by induction history' }).click();
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'legacies');
    await expect(page.locator('button.living-portrait')).toHaveCount(initialPortraitCount);
    await screenshotHall(page, '05-legacies');

    await dismissLegacyFocus(page);
    await waitForGuard(page);
    await page.getByRole('button', { name: 'Arrange Hall by portraits' }).click();
    await expectHall(page, 'portraits', await focusedPersonId(page));
    await waitForGuard(page);
    await page.getByRole('button', { name: 'LIFE + WORK' }).click();
    await expect(page.locator('.living-hall__personActionPanel .story-mode')).toBeVisible();
    await expect(page.locator('.living-hall')).toBeVisible();
    await screenshotHall(page, '06-focused-media-reading');
  });
});

async function expectHall(page: Page, lens: string, personId: string) {
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', lens);
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', personId);
  await expect(page.locator('.living-hall')).toBeVisible();
  await expect(page.locator(`button.living-portrait[data-transition-person="${personId}"]`)).toHaveClass(/living-portrait--focused/);
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

async function focusedPersonId(page: Page) {
  return await page.locator('.hall-surface').getAttribute('data-focused-person-id') ?? '';
}

async function dismissLegacyFocus(page: Page) {
  const dialog = page.getByRole('dialog', { name: /cohort navigator/i });
  if (await dialog.count() === 0) return;
  const surfaceBox = await page.locator('.hall-surface').boundingBox();
  expect(surfaceBox).toBeTruthy();
  await page.mouse.click(
    (surfaceBox?.x ?? 0) + (surfaceBox?.width ?? 0) - 96,
    (surfaceBox?.y ?? 0) + (surfaceBox?.height ?? 0) / 2,
  );
  await expect(dialog).toBeHidden();
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', '');
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'legacies');
}

async function portraitCount(page: Page) {
  return await page.locator('button.living-portrait').count();
}

async function clickVisibleRelatedPortrait(page: Page) {
  const target = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button.living-portrait--emphasis:not(.living-portrait--focused)'));
    const visible = buttons.find((button) => {
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return rect.width > 30
        && rect.height > 40
        && rect.left > 16
        && rect.right < window.innerWidth - 16
        && rect.top > 42
        && rect.bottom < window.innerHeight - 110
        && Boolean(hit && button.contains(hit));
    });
    if (!visible) return null;
    const rect = visible.getBoundingClientRect();
    return {
      id: visible.dataset.transitionPerson ?? '',
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  });
  if (!target?.id) throw new Error('No visible related portrait was available to continue the trace.');
  await page.mouse.click(target.x, target.y);
  return target.id;
}

async function clickFirstPortrait(page: Page) {
  const portrait = page.locator('button.living-portrait').first();
  await expect(portrait).toBeVisible();
  const personId = await portrait.getAttribute('data-transition-person');
  expect(personId).toBeTruthy();
  await portrait.click();
  return personId ?? '';
}

async function ensureConceptTraceAvailable(page: Page) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await openTraceChooser(page);
    if (await page.locator('.living-hall__traceControl').filter({ hasText: 'Concept' }).first().count()) return;
    await clickVisibleRelatedPortrait(page);
    await waitForGuard(page);
  }
}

async function openTraceChooser(page: Page) {
  const chooser = page.locator('.living-hall__traceContextButton');
  await expect(chooser).toBeVisible();
  await chooser.click();
  await expect(page.locator('.living-hall__traceControl').first()).toBeVisible();
}
