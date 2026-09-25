import { expect, test } from '@playwright/test';

/**
 * The attract screen: what an installed display shows while nobody is using
 * it, and the way every visit starts and ends.
 */

for (const mode of ['mosaic', 'names', 'stacked']) {
  test(`the ${mode} attract screen shows the hall and invites a touch`, async ({ page }) => {
    await page.goto(`./?attract=${mode}`);
    await expect(page.locator(`.attract--${mode}`)).toBeVisible();
    await expect(page.locator('[data-begin]')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cleveland International Hall of Fame');
    // Every name or face on it is somebody a visitor can go straight to.
    await expect(page.locator(mode === 'names' ? '.attract__name' : '.attract__face').first()).toBeVisible();
  });
}

test('an address with an unknown attract screen falls back to the mosaic', async ({ page }) => {
  await page.goto('./?attract=carousel');
  await expect(page.locator('.attract--mosaic')).toBeVisible();
});

test('the call to action is the first thing a keyboard reaches', async ({ page }) => {
  await page.goto('.');
  await expect(page.locator('.attract')).toBeVisible();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.hasAttribute('data-begin'))).toBe(true);
});

test('touching the call to action starts on People with nobody chosen', async ({ page }) => {
  await page.goto('.');
  await page.locator('[data-begin]').click();
  await expect(page.locator('.lensbar__lens[aria-current="page"]')).toHaveText('People');
  await expect(page.locator('.tile[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('.focus .prompt')).toBeVisible();
});

test('touching a face starts on People with that person chosen', async ({ page }) => {
  await page.goto('./?attract=stacked');
  const face = page.locator('.attract__face').nth(3);
  const name = await face.getAttribute('aria-label');
  await face.click();
  await expect(page.locator('.focus__name')).toHaveText(name ?? '');
  await expect(page.locator('.tile[aria-pressed="true"]')).toHaveCount(1);
});

test('touching a name on the name wall starts with that person chosen', async ({ page }) => {
  await page.goto('./?attract=names&motion=0');
  const name = page.locator('.attract__row').first().locator('.attract__name').first();
  const text = (await name.textContent())?.trim() ?? '';
  await name.click();
  await expect(page.locator('.focus__name')).toHaveText(text);
});

test('Start over returns to the attract screen, with nothing of the visit kept', async ({ page }) => {
  await page.goto('.');
  await page.locator('[data-begin]').click();
  await page.locator('.tile').first().click();
  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(page.locator('.attract')).toBeVisible();
  await page.locator('[data-begin]').click();
  await expect(page.locator('.tile[aria-pressed="true"]')).toHaveCount(0);
});

test('a visit left alone ends on the attract screen, and the attract screen never asks if anyone is there', async ({ page }) => {
  await page.goto('.');
  await page.locator('[data-begin]').click();
  // The test build's idle and warning are a few seconds; production floors them.
  await expect(page.locator('[data-session-warning]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.attract')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(4_000);
  await expect(page.locator('[data-session-warning]')).toHaveCount(0);
  await expect(page.locator('.attract')).toBeVisible();
});

test('the rows of names stand still for a visitor who asked for less motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./?attract=names');
  const animation = await page.locator('.attract__track').first().evaluate((el) => getComputedStyle(el).animationName);
  expect(animation).toBe('none');
});

test('the rows stand still when the display turns motion off, and drift when it is on', async ({ page }) => {
  await page.goto('./?attract=names&motion=0');
  expect(await page.locator('.attract__track').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await page.goto('./?attract=names&motion=1');
  expect(await page.locator('.attract__track').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('drift');
});

test('the spotlight moves on its own, and the lit face and the lit name are the same person', async ({ page }) => {
  await page.goto('./?attract=stacked&spotlight=4&motion=0');
  const lit = page.locator('.attract__strip .attract__face[aria-current="true"]');
  const first = await lit.getAttribute('aria-label');
  await expect(page.locator('.attract__name[aria-current="true"]').first()).toHaveText(first ?? '');
  await expect.poll(async () => lit.getAttribute('aria-label'), { timeout: 8_000 }).not.toBe(first);
  const next = await lit.getAttribute('aria-label');
  await expect(page.locator('.attract__name[aria-current="true"]').first()).toHaveText(next ?? '');
});
