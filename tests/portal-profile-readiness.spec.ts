import { expect, test } from '@playwright/test';

test.describe('portal profile readiness checklist', () => {
  test('review workbench shows first-pass profile readiness content', async ({ page }) => {
    await page.goto('./portal.html');

    await expect(page.getByRole('heading', { name: 'Review & Edit' })).toBeVisible();
    await page.getByRole('button', { name: 'Workbench', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Selected profile editor' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Selected profile readiness checklist' })).toBeVisible();

    const checklist = page.getByRole('region', { name: 'Selected profile readiness checklist' });
    await expect(checklist).toContainText('Profile readiness');
    await expect(checklist).toContainText('Focused Hall copy');
    await expect(checklist).toContainText('Story summary');
    await expect(checklist).toContainText('Portrait media');

    const focusedCopyStarters = page.getByRole('region', { name: 'Focused Hall copy starters' });
    await expect(focusedCopyStarters).toBeVisible();
    await expect(focusedCopyStarters).toContainText('Focused Hall copy starters');

    await expect(page.getByLabel('Documented context line')).not.toHaveValue('');
    await expect(page.getByLabel('HONORED FOR summary')).not.toHaveValue('');
    await expect(page.getByLabel('Life + Work overview')).not.toHaveValue('');
    await expect(checklist).toContainText('Focused Hall copy');
  });
});
