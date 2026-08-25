import { expect, test } from '@playwright/test';

test.describe('portal relationship source leads', () => {
  test('resolved original-site relationship leads can be reviewed as documented drafts', async ({ page }) => {
    await page.goto('./portal.html');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    await page.getByRole('button', { name: /^Relationships/ }).click();

    const relationshipReview = page.getByRole('region', { name: 'Relationship review' });
    await expect(relationshipReview).toBeVisible();
    await expect(relationshipReview).toContainText('Source Leads');

    await relationshipReview.locator('.portal-relationship-queue select').selectOption('source-leads');
    await expect(relationshipReview.getByText('Original-site source lead').first()).toBeVisible();
    await expect(relationshipReview).toContainText('This relationship is a resolved original-site source lead');

    await relationshipReview.getByRole('button', { name: 'Approve As Documented' }).click();

    await expect(relationshipReview.getByText(/1 ready/)).toBeVisible();
  });
});
