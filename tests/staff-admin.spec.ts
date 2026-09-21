import { expect, test, type Page } from '@playwright/test';

// Runs against the kiosk artifact, which is the target that actually ships the
// staff panel. EV-02 removed that panel from the public build, so exercising it
// there would be testing a configuration that is not supposed to exist.

test.use({ serviceWorkers: 'block' });
const personId = 'alex-machaskee-2010';

async function boot(page: Page, suffix = '') {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(`./${suffix}`);
  await expect(page.locator('.installation')).toBeVisible();
  await expect(page.getByText('LOADING INDEX', { exact: true })).toHaveCount(0);
}

async function record(page: Page) {
  await boot(page, `?person=${personId}`);
  const trigger = page.getByRole('button', { name: 'Open full record for Alex Machaskee' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#recordTitle')).toBeFocused();
}

test('admin is modal and Escape does not close the underlying record', async ({ page }) => {
  await record(page);
  await page.keyboard.press('Control+Alt+a');
  const admin = page.getByRole('dialog', { name: 'Admin data and app settings' });
  await expect(admin).toBeVisible();
  expect(await admin.evaluate((element) => element.matches(':modal'))).toBe(true);
  for (let step = 0; step < 8; step++) {
    await page.keyboard.press(step < 4 ? 'Tab' : 'Shift+Tab');
    expect(await admin.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(admin).toHaveCount(0);
  await expect(page.locator('#recordTitle')).toBeFocused();
});
