import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const screenshotDir = process.env.CIHOF_FINAL_STEP3_SCREENSHOT_DIR ?? '/tmp/cihof-final-step3';

test.describe('signature TRACES interaction', () => {
  test('reindexes the Hall around direct, conceptual, and nationality traces', async ({ page }) => {
    mkdirSync(screenshotDir, { recursive: true });
    await page.goto('./');

    const firstPersonId = await clickFirstPortrait(page);
    await waitForGuard(page);
    await page.getByRole('button', { name: 'Arrange Hall by heritage and connections' }).click();
    await expectTraceFocus(page, firstPersonId);
    await expectRelationshipCount(page);
    await expect(page.locator('.living-hall__traceEvidenceItem--inferred')).toHaveCount(0);
    await screenshotHall(page, '01-direct-person-1');

    const secondPersonId = await clickRelatedPortrait(page, firstPersonId);
    await expectTraceFocus(page, secondPersonId);
    await expectRelationshipCount(page);
    await screenshotHall(page, '02-direct-person-2');

    const thirdPersonId = await clickRelatedPortrait(page, secondPersonId);
    await expectTraceFocus(page, thirdPersonId);
    await expectRelationshipCount(page);
    await screenshotHall(page, '03-direct-person-3');

    await openTraceChooser(page);
    const conceptControl = page.locator('.living-hall__traceControl').filter({ hasText: 'Concept' }).first();
    await expect(conceptControl).toBeVisible();
    await conceptControl.click();
    await waitForGuard(page);
    await expect(page.locator('.living-hall')).toHaveAttribute('data-trace-focus-key', /^concept:/);

    for (let index = 0; index < 3; index += 1) {
      const currentPersonId = await page.locator('.hall-surface').getAttribute('data-focused-person-id');
      const nextPersonId = await clickRelatedPortrait(page, currentPersonId ?? '');
      await expectTraceFocus(page, nextPersonId);
    }

    await expect(page.locator('.living-hall')).toHaveAttribute('data-trace-trail-size', /^[3-5]$/);
    await expect(page.locator('.cleveland-trace--trail .cleveland-trace__path--main').first()).toBeVisible();
    await screenshotHall(page, '04-follow-the-trace');

    await openTraceChooser(page);
    const placeControl = page.locator('.living-hall__traceControl').filter({ hasText: 'Nationality' }).first();
    if (await placeControl.count()) {
      await placeControl.click();
      await waitForGuard(page);
      await expect(page.locator('.living-hall')).toHaveAttribute('data-trace-focus-key', /^country:/);
      await expect(page.locator('.living-hall__groupLabel').filter({ hasText: /NATIONALITY \/ HERITAGE|CONNECTED HERITAGE|CONNECTED TO/ }).first()).toBeVisible();
      await screenshotHall(page, '05-nationality-trace');
    }
  });
});

async function clickFirstPortrait(page: Page) {
  const portrait = page.locator('button.living-portrait').first();
  await expect(portrait).toBeVisible();
  const personId = await portrait.getAttribute('data-transition-person');
  expect(personId).toBeTruthy();
  await portrait.click();
  return personId ?? '';
}

async function clickRelatedPortrait(page: Page, currentPersonId: string) {
  const connection = page.locator(`.living-hall__traceConnection:not([data-trace-person="${currentPersonId}"])`).first();
  if (await connection.count()) {
    await expect(connection).toBeVisible();
    const personId = await connection.getAttribute('data-trace-person');
    expect(personId).toBeTruthy();
    await connection.click();
    await waitForGuard(page);
    return personId ?? '';
  }

  const portrait = page.locator(`button.living-portrait--emphasis:not(.living-portrait--focused):not([data-transition-person="${currentPersonId}"])`).first();
  await expect(portrait).toBeVisible();
  const personId = await portrait.getAttribute('data-transition-person');
  expect(personId).toBeTruthy();
  await portrait.click();
  await waitForGuard(page);
  return personId ?? '';
}

async function expectTraceFocus(page: Page, personId: string) {
  await waitForGuard(page);
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'traces');
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', personId);
  await expect(page.locator(`button.living-portrait[data-transition-person="${personId}"]`)).toHaveClass(/living-portrait--focused/);
  await expect(page.locator('.cleveland-trace-field--traces[data-runtime-gis="false"]')).toBeVisible();
  await expect(page.locator('.human-network')).toHaveCount(0);
  await expect(page.locator('.world-lens')).toHaveCount(0);
}

async function expectRelationshipCount(page: Page) {
  const relationshipPaths = page.locator('.cleveland-trace--relationship .cleveland-trace__path--main');
  await expect(relationshipPaths.first()).toBeVisible();
  const count = await relationshipPaths.count();
  expect(count).toBeGreaterThanOrEqual(4);
  expect(count).toBeLessThanOrEqual(6);
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

async function openTraceChooser(page: Page) {
  const chooser = page.locator('.living-hall__traceContextButton');
  await expect(chooser).toBeVisible();
  await chooser.click();
  await expect(page.locator('.living-hall__traceControl').first()).toBeVisible();
}
