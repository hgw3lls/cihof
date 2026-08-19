import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe('museum kiosk smoke', () => {
  test('loads the portrait wall and publishes health status', async ({ page }) => {
    await page.goto('./?kiosk=1');

    await expect(page.getByRole('navigation', { name: 'Museum navigation' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'All People', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.portrait-tile').first()).toBeVisible();

    const health = await waitForKioskHealth(page, (snapshot) => snapshot.dataStatus === 'ready' && snapshot.peopleCount > 0);
    expect(health.currentView).toBe('all-people');
    expect(health.kioskMode).toBe(true);
    expect(health.selectedPersonId).toBe('');
    expect(health.relationshipsCount).toBeGreaterThanOrEqual(0);
  });

  test('keeps bottom navigation usable across primary views', async ({ page }) => {
    await page.goto('./');

    for (const item of [
      { label: 'Time', view: 'time' },
      { label: 'Places', view: 'places' },
      { label: 'Journeys', view: 'journeys' },
      { label: 'Search', view: 'search' },
    ]) {
      await page.getByRole('button', { name: item.label, exact: true }).click();
      await expect(page.getByRole('button', { name: item.label, exact: true })).toHaveAttribute('aria-current', 'page');
      await expect(page).toHaveURL(new RegExp(`view=${item.view}`));
      const health = await waitForKioskHealth(page, (snapshot) => snapshot.currentView === item.view);
      expect(health.lastInteractionSource).toBe(`nav:${item.view}`);
    }
  });

  test('opens a person view and reset returns to All People', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('button.portrait-tile').first()).toBeVisible();
    await page.locator('button.portrait-tile').first().click();

    await expect(page.locator('.detail--museum')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Their Story' })).toBeVisible();
    const selectedHealth = await waitForKioskHealth(page, (snapshot) => Boolean(snapshot.selectedPersonId));
    expect(selectedHealth.selectedPersonId).not.toBe('');

    await page.locator('.detail__topbar').getByRole('button', { name: 'Reset' }).click();
    await expect(page.locator('.detail--museum')).toBeHidden();
    await expect(page.getByRole('button', { name: 'All People', exact: true })).toHaveAttribute('aria-current', 'page');

    const resetHealth = await waitForKioskHealth(page, (snapshot) => snapshot.selectedPersonId === '' && snapshot.resetCount > 0);
    expect(resetHealth.lastResetReason).toBe('detail');
  });

  test('idle reset enters attract mode and touch returns home', async ({ page }) => {
    await page.goto('./?kiosk=1');
    await expect(page.locator('.portrait-tile').first()).toBeVisible();

    await expect(page.locator('.attract')).toBeVisible({ timeout: 6_000 });
    await waitForKioskHealth(page, (snapshot) => snapshot.attractActive === true && snapshot.lastResetReason === 'idle');

    await page.mouse.click(60, 60);

    await expect(page.locator('.attract')).toBeHidden();
    await expect(page.getByRole('button', { name: 'All People', exact: true })).toHaveAttribute('aria-current', 'page');
    const health = await waitForKioskHealth(page, (snapshot) => snapshot.attractActive === false);
    expect(health.currentView).toBe('all-people');
  });
});

async function waitForKioskHealth(
  page: Page,
  predicate: (snapshot: KioskHealthForTest) => boolean,
) {
  await expect.poll(async () => {
    const snapshot = await readKioskHealth(page);
    return snapshot ? predicate(snapshot) : false;
  }).toBe(true);

  const snapshot = await readKioskHealth(page);
  if (!snapshot) throw new Error('Kiosk health status was not published.');
  return snapshot;
}

async function readKioskHealth(page: Page) {
  return page.evaluate(() => {
    return (window as unknown as { __CIHOF_KIOSK_STATUS__?: KioskHealthForTest }).__CIHOF_KIOSK_STATUS__ ?? null;
  }) as Promise<KioskHealthForTest | null>;
}

type KioskHealthForTest = {
  currentView: string;
  kioskMode: boolean;
  attractActive: boolean;
  selectedPersonId: string;
  peopleCount: number;
  relationshipsCount: number;
  dataStatus: string;
  lastInteractionSource: string;
  lastResetReason: string;
  resetCount: number;
};
