import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { canonicalContinuationUrl } from '../src/features/inductee-detail/personDetailModel';
import type { Inductee } from '../src/data/types';

test.use({ serviceWorkers: 'block' });
const personId = 'alex-machaskee-2010';
const publicUrl = `https://clevelandinternationalhalloffame.com/${personId}/`;
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

test('QR is genuinely modal, cycles focus, blocks background, and restores its trigger', async ({ page }) => {
  await record(page);
  const take = page.getByRole('button', { name: 'TAKE THIS RECORD' });
  await take.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  const close = dialog.getByRole('button', { name: 'Return To Portrait' });
  const reset = dialog.getByRole('button', { name: 'START OVER', exact: true });
  await expect(close).toBeFocused();
  expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(true);
  await page.locator('#startOverButton').evaluate((element: HTMLElement) => element.focus());
  await expect(close).toBeFocused();
  for (let index = 0; index < 3; index++) {
    await page.keyboard.press('Tab'); await expect(reset).toBeFocused();
    await page.keyboard.press('Tab'); await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(reset).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(close).toBeFocused();
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(take).toBeFocused();
  await expect(page.locator('.record-view')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#selectedPersonRecordButton')).toBeFocused();
});

test('the actual rendered QR decodes to a clean public person URL', async ({ page }) => {
  await record(page);
  await page.getByRole('button', { name: 'TAKE THIS RECORD' }).click();
  const image = page.locator('.qr-continuation__code img');
  await expect(image).toBeVisible();
  const png = PNG.sync.read(await image.screenshot());
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  expect(decoded?.data).toBe(publicUrl);
});

test('continuation URLs reject private and staff routes and remove session parameters', () => {
  const urlFor = (profileUrl: string) => canonicalContinuationUrl({ profileUrl } as Inductee);
  for (const unsafe of ['http://localhost/person/', 'http://127.0.0.1/person/', 'http://192.168.1.2/person/',
    'https://[::1]/person/', 'https://example.com/person/', 'javascript:alert(1)',
    'https://clevelandinternationalhalloffame.com/wp-admin/', 'https://clevelandinternationalhalloffame.com/portal/',
    'https://user:secret@clevelandinternationalhalloffame.com/person/']) expect(urlFor(unsafe)).toBe('');
  expect(urlFor(`${publicUrl}?admin=1&session=secret#settings`)).toBe(publicUrl);
  expect(urlFor('https://clevelandinternationalhalloffame.com/inductees-europe/basil-russo/')).not.toBe('');
  expect(urlFor('https://clevelandinternationalhalloffame.com/john-jack-coyne-2013')).not.toBe('');
});

test('all existing person continuation paths remain eligible', async ({ request }) => {
  const response = await request.get('./data/inductees.json');
  const people: Inductee[] = await response.json();
  expect(people).toHaveLength(111);
  for (const person of people) expect(canonicalContinuationUrl(person), person.id).toBe(person.profileUrl);
});

test('skip, disappearing selection controls, and relationship navigation retain useful focus', async ({ page }) => {
  await boot(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to exhibit' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#exhibitContent')).toBeFocused();
  await page.getByRole('button', { name: 'LINKS', exact: true }).click();
  const explore = page.getByRole('button', { name: /Explore links for Alex Machaskee,/ });
  await explore.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#mapCenterButton')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#recordTitle')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#mapCenterButton')).toBeFocused();
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await expect(page.locator('#selectionTitle')).toBeFocused();
});

test('stale person links return to a usable collection with an honest notice', async ({ page }) => {
  await boot(page, '?person=not-a-real-person&scene=years');
  await expect(page.getByRole('status')).toContainText('This record is unavailable');
  expect(new URL(page.url()).searchParams.has('person')).toBe(false);
  await expect(page.locator('.year-person')).toHaveCount(111);
});

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

test('chronology and connection-list alternatives work without dragging', async ({ page }) => {
  await boot(page, `?scene=years&person=${personId}`);
  const chronology = page.locator('.film-line__viewport');
  await chronology.focus();
  await page.keyboard.press('End');
  await expect(page.locator('.film-line__current')).toHaveAttribute('data-year', '2026');
  await page.keyboard.press('Home');
  await expect(page.locator('.film-line__current')).toHaveAttribute('data-year', '2010');
  await page.getByRole('button', { name: 'LINKS', exact: true }).click();
  await page.getByRole('button', { name: 'Connection list' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#linkRelationListTitle')).toBeFocused();
});

for (const theme of ['light', 'dark']) {
  test(`on-map preview and optional connection list are accessible in ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page, `?scene=links&person=${personId}`);
    if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await page.locator('.map-node:not(.map-node--center)').first().click();
    await expect(page.locator('#linkConnectionDetail')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: 'Connection list' }).click();
    await expect(page.locator('#linkRelationListTitle')).toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
  test(`automated accessibility checks cover scenes and QR in ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    for (const scene of ['PEOPLE', 'LINKS', 'YEARS']) {
      await page.getByRole('button', { name: scene, exact: true }).click();
      const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(scan.violations, `${theme} ${scene}`).toEqual([]);
    }
    await page.getByRole('button', { name: 'PEOPLE', exact: true }).click();
    await page.getByRole('button', { name: /Select Alex Machaskee,/ }).click();
    await page.getByRole('button', { name: 'Open full record for Alex Machaskee' }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: 'TAKE THIS RECORD' }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

test('narrow reflow, reduced motion, and reachable prototype retain complete reading', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const viewport of [{ width: 320, height: 700 }, { width: 960, height: 540 }]) {
    await page.setViewportSize(viewport);
    await record(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    await page.locator('.record-view__story').scrollIntoViewIfNeeded();
    await expect(page.locator('.record-view__story')).toContainText('Alex Machaskee');
    await page.getByRole('button', { name: 'TAKE THIS RECORD' }).click();
    await expect(page.getByRole('button', { name: 'Return To Portrait' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await boot(page, '?kiosk=1&reach=1');
  const rect = await page.locator('.installation').boundingBox();
  expect(rect!.y).toBeGreaterThan(300);
  await page.getByRole('button', { name: 'START OVER', exact: true }).click();
  await expect(page.locator('.installation')).toHaveAttribute('data-reachable', 'true');
});

test('record text remains available at 200 percent text size', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await record(page);
  await page.evaluate(() => {
    const elements = [...document.querySelectorAll<HTMLElement>('.installation *')];
    const sizes = elements.map((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    elements.forEach((element, index) => { element.style.fontSize = `${sizes[index] * 2}px`; });
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(960);
  const brand = await page.locator('.brand').boundingBox();
  const navigation = await page.locator('.views').boundingBox();
  expect(brand!.y).toBeGreaterThanOrEqual(0);
  expect(brand!.y + brand!.height).toBeLessThanOrEqual(navigation!.y + 1);
  await page.locator('.record-view__story').scrollIntoViewIfNeeded();
  await expect(page.locator('.record-view__story')).toContainText('Alex Machaskee');
  await page.getByRole('button', { name: 'TAKE THIS RECORD' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'TAKE THIS RECORD' })).toBeFocused();
});
