import { expect, test } from '@playwright/test';

test.describe('portal profile readiness checklist', () => {
  test('review workbench shows per-profile readiness and updates staged status', async ({ page }) => {
    await page.goto('./portal.html');

    await expect(page.getByRole('heading', { name: 'Review & Edit' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Selected profile editor' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Selected profile readiness checklist' })).toBeVisible();

    const checklist = page.getByRole('region', { name: 'Selected profile readiness checklist' });
    await expect(checklist).toContainText('Profile readiness');
    await expect(checklist).toContainText('Focused Hall copy');
    await expect(checklist).toContainText('Story summary');
    await expect(checklist).toContainText('Portrait media');

    await page.getByLabel('Documented context line').fill('Curator-staged context line for the focused Hall.');
    await page.getByLabel('HONORED FOR summary').fill('Recognized for documented civic and cultural leadership in the Cleveland community.');

    await expect(checklist.locator('.portal-profile-readiness__item--drafted')).toContainText('Focused Hall copy');
  });
});
