import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { begin } from './visit.ts';

/**
 * An automated accessibility scan of every screen a visitor reaches, in the
 * dark theme and the light one, against WCAG 2.1 A and AA.
 *
 * A scan finds what a machine can: contrast, names, roles, structure. It does
 * not certify the installation. Reach, a screen reader on the display itself,
 * and a visitor's own judgement stay with the accessibility sign-off.
 */

const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function scan(page: Page, within?: string) {
  let builder = new AxeBuilder({ page }).withTags(tags);
  if (within) builder = builder.include(within);
  const results = await builder.analyze();
  return results.violations.map((violation) => ({
    rule: `${violation.id}: ${violation.help}`,
    where: violation.nodes.slice(0, 3).map((node) => `${node.target.join(' ')} ${node.failureSummary?.split('\n').slice(1, 2).join('') ?? ''}`.trim()),
  }));
}

async function openRecordWithFilm(page: Page) {
  const tiles = page.locator('.tile');
  for (let index = 0; index < 30; index += 1) {
    await tiles.nth(index).click();
    await page.getByRole('button', { name: 'Read the record' }).click();
    if (await page.getByRole('button', { name: /Watch the film/ }).isVisible()) return;
    await page.keyboard.press('Escape');
  }
  throw new Error('no record with a film among the first 30 people');
}

for (const theme of ['dark', 'light'] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      // Motion off, so nothing is caught halfway through a fade.
      await page.emulateMedia({ reducedMotion: 'reduce' });
    });

    for (const mode of ['mosaic', 'names', 'stacked']) {
      test(`the ${mode} attract screen`, async ({ page }) => {
        await page.goto(`./?theme=${theme}&attract=${mode}`);
        await expect(page.locator('[data-begin]').first()).toBeVisible();
        expect(await scan(page)).toEqual([]);
      });
    }

    test('People, with somebody chosen', async ({ page }) => {
      await begin(page, `./?theme=${theme}`);
      await page.locator('.tile').first().click();
      expect(await scan(page)).toEqual([]);
    });

    for (const lens of ['Years', 'Connections', 'Places']) {
      test(lens, async ({ page }) => {
        await begin(page, `./?theme=${theme}`);
        await page.getByRole('button', { name: lens, exact: true }).click();
        await expect(page.locator('[aria-current="page"], [aria-pressed="true"]').first()).toBeVisible();
        if (lens === 'Connections') await expect(page.locator('.map__person--focus')).toBeVisible();
        if (lens === 'Places') await expect(page.locator('.places__place h2')).toBeVisible();
        expect(await scan(page)).toEqual([]);
      });
    }

    test('a record, and its film', async ({ page }) => {
      await begin(page, `./?theme=${theme}`);
      await openRecordWithFilm(page);
      expect(await scan(page)).toEqual([]);
      await page.getByRole('button', { name: /Watch the film/ }).click();
      await expect(page.locator('dialog.film')).toBeVisible();
      expect(await scan(page, 'dialog.film')).toEqual([]);
    });

    test('taking a record away', async ({ page }) => {
      await begin(page, `./?theme=${theme}`);
      await page.locator('.tile').first().click();
      await page.getByRole('button', { name: 'Read the record' }).click();
      await page.getByRole('button', { name: 'Take it with you' }).click();
      await expect(page.locator('.share canvas')).toBeVisible();
      expect(await scan(page)).toEqual([]);
    });

    test('the warning before a visit ends', async ({ page }) => {
      // The warning lasts moments in the test build; the clock is held while it is scanned.
      await page.clock.install();
      await begin(page, `./?theme=${theme}`);
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
      await page.locator('.tile').first().click();
      await page.clock.runFor(1_800);
      await expect(page.locator('[data-session-warning]')).toBeVisible();
      // Time stands still for the page, but its timers run again, which the scan needs.
      await page.clock.setFixedTime(await page.evaluate(() => Date.now()));
      await page.clock.resume();
      expect(await scan(page)).toEqual([]);
      await expect(page.locator('[data-session-warning]')).toBeVisible();
    });
  });
}
