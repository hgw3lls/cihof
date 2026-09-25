import { expect, type Page } from '@playwright/test';

/**
 * An installed display opens on its attract screen. Most specs are about what
 * happens after a visitor touches it, so they begin the way a visitor does:
 * with the call to action, which the attract screen offers first.
 */
export async function begin(page: Page, address = '.') {
  await page.goto(address);
  await page.locator('[data-begin]').first().click();
  await expect(page.locator('.tile').first()).toBeVisible();
}
