import { expect, test } from '@playwright/test';

test.describe('hidden admin access and kiosk settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test('admin password, hotkey, settings, and diagnostics are browser-local', async ({ page }) => {
    await page.goto('./?admin=1');

    await expect(page.getByRole('dialog', { name: 'Admin data and app settings' })).toBeVisible();
    await page.getByLabel('Password').fill('cihof-admin');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page.getByText('Admin data tools unlocked.')).toBeVisible();

    await page.getByRole('button', { name: 'App Settings' }).click();
    await expect(page.getByRole('heading', { name: 'App Settings' })).toBeVisible();
    await page.getByLabel('Admin hotkey').selectOption('Ctrl+Shift+H');
    await expect(page.getByText('App settings saved for this browser.')).toBeVisible();

    await page.getByLabel('Current password').fill('cihof-admin');
    await page.getByRole('textbox', { name: 'New password', exact: true }).fill('cihof-new-pass');
    await page.getByLabel('Confirm new password').fill('cihof-new-pass');
    await page.getByRole('button', { name: 'Update Password' }).click();
    await expect(page.getByText('Admin password updated for this browser.')).toBeVisible();

    await page.getByRole('button', { name: 'Lock' }).click();
    await expect(page.getByRole('dialog', { name: 'Admin data and app settings' })).toBeHidden();

    await page.keyboard.press('Control+Shift+H');
    await expect(page.getByRole('dialog', { name: 'Admin data and app settings' })).toBeVisible();
    await page.getByLabel('Password').fill('cihof-admin');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page.getByText('Password did not match.')).toBeVisible();

    await page.getByLabel('Password').fill('cihof-new-pass');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page.getByText('Admin data tools unlocked.')).toBeVisible();

    await page.getByRole('button', { name: 'Diagnostics' }).click();
    await expect(page.getByRole('heading', { name: 'Diagnostics' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Data diagnostics' })).toContainText('Profiles');
    await expect(page.getByRole('button', { name: 'Export Diagnostics' })).toBeVisible();
  });
});
