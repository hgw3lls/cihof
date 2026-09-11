import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe('saved visit collection', () => {
  test('collects multiple portraits into one continuation QR path', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('.hall-surface')).toHaveCount(1);
    await expect(page.locator('button.living-portrait').first()).toBeVisible();

    const firstId = await focusPersonFromSearch(page, 'Helen Karpinski', 'Helen Karpinski');
    await expectFocused(page, firstId);
    await waitForGuard(page);

    await page.getByRole('button', { name: 'SAVE TO VISIT', exact: true }).click();
    await expect(page.locator('.living-hall')).toHaveAttribute('data-visit-collection-count', '1');

    const tray = page.getByLabel('Saved visit collection');
    await expect(tray).toBeVisible();
    await expect(tray).toContainText('1 saved record');
    await expect(tray.locator(`[data-visit-person="${firstId}"]`)).toBeVisible();

    const secondId = await focusPersonFromSearch(page, 'Jeanette Grasselli Brown', 'Jeanette Grasselli Brown');
    await expectFocused(page, secondId);
    await waitForGuard(page);

    await page.getByRole('button', { name: 'SAVE TO VISIT', exact: true }).click();
    await expect(page.locator('.living-hall')).toHaveAttribute('data-visit-collection-count', '2');
    await expect(tray).toContainText('2 saved records');
    await expect(tray.locator(`[data-visit-person="${secondId}"]`)).toBeVisible();
    await expect(page).toHaveURL(/visit=/);
    await waitForGuard(page);

    await tray.getByRole('button', { name: 'Start journey', exact: true }).click();
    await expect(tray).toHaveAttribute('data-journey-active', 'true');
    await expect(tray).toHaveAttribute('data-journey-index', '0');
    await expect(tray).toHaveAttribute('data-route-title', 'Class of 2010 Legacy Path');
    await expect(tray).toHaveAttribute('data-suggested-next', secondId);
    await expect(tray.getByLabel('Visit route insight')).toContainText('Class of 2010');
    await expect(tray.getByLabel('Guided visit journey')).toContainText('1 / 2');
    await expect(tray.getByLabel('Guided visit journey')).toContainText('Curated');
    await expect(tray.getByLabel('Guided visit journey')).toContainText('Related profile ids');
    await expect(page.locator('.living-hall')).toHaveAttribute('data-journey-active', 'true');
    await expect(page.locator(`button.living-portrait[data-transition-person="${firstId}"]`)).toHaveAttribute('data-journey-step', '1');
    await expect(page.locator(`button.living-portrait[data-transition-person="${firstId}"]`)).toHaveAttribute('data-journey-current', 'true');
    await expect(page.locator(`button.living-portrait[data-transition-person="${secondId}"]`)).toHaveAttribute('data-journey-step', '2');
    await expect(page.locator(`button.living-portrait[data-transition-person="${secondId}"]`)).toHaveAttribute('data-journey-suggested', 'true');
    await expect(page.locator(`button.living-portrait[data-transition-person="${secondId}"] .living-portrait__journeyBadge`)).toContainText('Suggested next');
    await expectFocused(page, firstId);
    await waitForGuard(page);

    await tray.getByRole('button', { name: 'Suggested next: Jeanette Grasselli Brown', exact: true }).click();
    await expect(tray).toHaveAttribute('data-journey-index', '1');
    await expect(tray.locator(`[data-visit-person="${secondId}"]`)).toHaveAttribute('aria-current', 'step');
    await expect(page.locator(`button.living-portrait[data-transition-person="${secondId}"]`)).toHaveAttribute('data-journey-current', 'true');
    await expectFocused(page, secondId);
    await waitForGuard(page);

    await tray.getByRole('button', { name: 'Visit QR', exact: true }).click();
    const qrPanel = page.getByRole('dialog', { name: 'Saved visit QR' });
    await expect(qrPanel).toBeVisible();
    await expect(qrPanel.locator('.qr-continuation--visit-session')).toHaveAttribute('aria-label', 'Class of 2010 Legacy Path visit continuation QR');

    const qrUrl = await qrPanel.locator('.qr-continuation--visit-session small').textContent();
    expect(qrUrl).toContain('person=');
    expect(qrUrl).toContain('visit=');
    expect(qrUrl).toContain(firstId);
    expect(qrUrl).toContain(secondId);
    expect(new URL(qrUrl ?? '').searchParams.get('route')).toBe('Class of 2010 Legacy Path');

    if (await qrPanel.isVisible()) {
      await qrPanel.getByRole('button', { name: 'Close', exact: true }).click();
    }
    await expect(qrPanel).toBeHidden();

    await tray.locator(`[data-visit-person="${firstId}"]`).click();
    await expectFocused(page, firstId);
    await waitForGuard(page);

    await tray.locator(`[data-remove-visit-person="${secondId}"]`).click();
    await expect(page.locator('.living-hall')).toHaveAttribute('data-visit-collection-count', '1');
    await expect(tray.locator(`[data-visit-person="${secondId}"]`)).toHaveCount(0);

    await tray.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(page.locator('.living-hall')).toHaveAttribute('data-visit-collection-count', '0');
    await expect(tray).toBeHidden();
    await expect(page).not.toHaveURL(/visit=/);
  });
});

async function focusPersonFromSearch(page: Page, query: string, resultText: string) {
  const search = page.locator('#museum-command-search');
  await search.fill(query);
  await expect(page.locator('.museum-command')).toHaveClass(/museum-command--open/);
  await page.locator('.museum-command__result').filter({ hasText: resultText }).first().click();
  const focusedId = await page.locator('.hall-surface').getAttribute('data-focused-person-id');
  expect(focusedId).toBeTruthy();
  return focusedId ?? '';
}

async function expectFocused(page: Page, personId: string) {
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', personId);
  await expect(page.locator(`button.living-portrait[data-transition-person="${personId}"]`)).toHaveClass(/living-portrait--focused/);
}

async function waitForGuard(page: Page) {
  await expect(page.locator('.transition-input-guard')).toBeHidden({ timeout: 2_500 });
}
