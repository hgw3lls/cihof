import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe('saved visit collection', () => {
  test('collects multiple portraits into one continuation QR path', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('.hall-surface')).toHaveCount(1);
    await expect(page.locator('button.living-portrait').first()).toBeVisible();

    const firstId = await clickVisiblePortrait(page);
    await expectFocused(page, firstId);
    await waitForGuard(page);

    await page.getByRole('button', { name: 'SAVE TO VISIT', exact: true }).click();
    await expect(page.locator('.living-hall')).toHaveAttribute('data-visit-collection-count', '1');

    const tray = page.getByLabel('Saved visit collection');
    await expect(tray).toBeVisible();
    await expect(tray).toContainText('1 saved record');
    await expect(tray.locator(`[data-visit-person="${firstId}"]`)).toBeVisible();

    const secondId = await clickVisiblePortrait(page, [firstId]);
    await expectFocused(page, secondId);
    await waitForGuard(page);

    await page.getByRole('button', { name: 'SAVE TO VISIT', exact: true }).click();
    await expect(page.locator('.living-hall')).toHaveAttribute('data-visit-collection-count', '2');
    await expect(tray).toContainText('2 saved records');
    await expect(tray.locator(`[data-visit-person="${secondId}"]`)).toBeVisible();
    await expect(page).toHaveURL(/visit=/);

    await tray.getByRole('button', { name: 'Visit QR', exact: true }).click();
    const qrPanel = page.getByRole('dialog', { name: 'Saved visit QR' });
    await expect(qrPanel).toBeVisible();
    await expect(qrPanel.locator('.qr-continuation--visit-session')).toHaveAttribute('aria-label', '2 saved records visit continuation QR');

    const qrUrl = await qrPanel.locator('.qr-continuation--visit-session small').textContent();
    expect(qrUrl).toContain('person=');
    expect(qrUrl).toContain('visit=');
    expect(qrUrl).toContain(firstId);
    expect(qrUrl).toContain(secondId);

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

async function clickVisiblePortrait(page: Page, skipIds: string[] = []) {
  const target = await page.evaluate((idsToSkip) => {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button.living-portrait'));
    const visible = buttons.find((button) => {
      const id = button.dataset.transitionPerson ?? '';
      if (!id || idsToSkip.includes(id) || button.classList.contains('living-portrait--focused')) return false;
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return rect.width > 24
        && rect.height > 32
        && rect.left > 8
        && rect.right < window.innerWidth - 8
        && rect.top > 32
        && rect.bottom < window.innerHeight - 96
        && Boolean(hit && button.contains(hit));
    });

    if (!visible) return null;
    const rect = visible.getBoundingClientRect();
    return {
      id: visible.dataset.transitionPerson ?? '',
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }, skipIds);

  if (!target?.id) throw new Error('No visible portrait was available for the saved visit test.');
  await page.mouse.click(target.x, target.y);
  return target.id;
}

async function expectFocused(page: Page, personId: string) {
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', personId);
  await expect(page.locator(`button.living-portrait[data-transition-person="${personId}"]`)).toHaveClass(/living-portrait--focused/);
}

async function waitForGuard(page: Page) {
  await expect(page.locator('.transition-input-guard')).toBeHidden({ timeout: 2_500 });
}
