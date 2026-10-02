import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { begin, choose, chooseSomeoneWithFilm } from './visit.ts';

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
  await chooseSomeoneWithFilm(page);
  await page.getByRole('button', { name: 'Read their story' }).click();
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

    for (const lens of ['Years', 'Connections']) {
      test(lens, async ({ page }) => {
        await begin(page, `./?theme=${theme}`);
        await page.getByRole('navigation', { name: 'Ways to explore' }).getByRole('button', { name: new RegExp(`^${lens}`) }).click();
        await expect(page.locator('[aria-current="page"], [aria-pressed="true"]').first()).toBeVisible();
        if (lens === 'Connections') await expect(page.locator('.tile[data-ring="focus"]')).toBeVisible();
        expect(await scan(page)).toEqual([]);
      });
    }

    test('Connections by place, with somebody chosen', async ({ page }) => {
      await begin(page, `./?theme=${theme}`);
      await page.getByRole('navigation', { name: 'Ways to explore' }).getByRole('button', { name: /^Connections/ }).click();
      await page.getByRole('button', { name: /^Same place/ }).click();
      await page.locator('.tile[aria-label="Wael Khoury"]').click();
      await expect(page.locator('.sheet__ties-list')).toBeVisible();
      expect(await scan(page)).toEqual([]);
    });

    test('the tour chooser', async ({ page }) => {
      await begin(page, `./?theme=${theme}`);
      await page.getByRole('navigation', { name: 'Ways to explore' }).getByRole('button', { name: /^Tour/ }).click();
      await expect(page.locator('dialog.tours')).toBeVisible();
      expect(await scan(page)).toEqual([]);
    });

    test('search, with results', async ({ page }) => {
      await begin(page, `./?theme=${theme}`);
      await page.getByRole('navigation', { name: 'Ways to explore' }).getByRole('button', { name: /^Search/ }).click();
      await page.getByRole('searchbox').fill('cultural gardens');
      await expect(page.locator('.search__row').first()).toBeVisible();
      expect(await scan(page)).toEqual([]);
    });

    test('a record, and its film', async ({ page }) => {
      // Scanning a whole story takes longer than a test build's idle; the
      // clock is held so the visit is not ended under the scan.
      await page.clock.install();
      await begin(page, `./?theme=${theme}`);
      await openRecordWithFilm(page);
      await page.clock.setFixedTime(await page.evaluate(() => Date.now()));
      expect(await scan(page)).toEqual([]);
      await page.locator('dialog.record').getByRole('button', { name: /Watch the film/ }).click();
      await expect(page.locator('dialog.film')).toBeVisible();
      expect(await scan(page, 'dialog.film')).toEqual([]);
    });

    test('taking a record away', async ({ page }) => {
      await begin(page, `./?theme=${theme}`);
      await choose(page, 'Alex Machaskee');
      await page.getByRole('button', { name: 'Read their story' }).click();
      await page.getByRole('button', { name: 'Take it with you' }).click();
      await expect(page.locator('.share canvas')).toBeVisible();
      expect(await scan(page)).toEqual([]);
    });

    test('the offer of How this works, as a visitor comes in', async ({ page }) => {
      // Held still, so neither the offer nor the visit times out mid-scan.
      await page.clock.install();
      await page.goto(`./?theme=${theme}`);
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
      await page.locator('[data-begin]').first().click();
      await expect(page.locator('.invitation')).toBeVisible();
      // The offer retires on a timer a second away in the test build. While the
      // scan works the page's clock creeps on a millisecond at a time: enough
      // for the scan's own short steps, nowhere near enough to retire the offer.
      let scanning = true;
      let crept = 0;
      const scanned = scan(page).finally(() => { scanning = false; });
      while (scanning && crept < 900) { await page.clock.runFor(1); crept += 1; await page.waitForTimeout(5); }
      expect(await scanned).toEqual([]);
      await expect(page.locator('.invitation')).toBeVisible();
    });

    test('How this works, pointing at a key on the bar', async ({ page }) => {
      // Held still, so the test build's short idle does not end the visit mid-scan.
      await page.clock.install();
      await page.goto(`./?theme=${theme}`);
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
      await page.locator('[data-begin]').first().click();
      await page.locator('.invitation').getByRole('button', { name: 'How this works' }).click();
      await page.locator('dialog.tutorial .tutorial__next').click();
      await expect(page.locator('dialog.tutorial .tutorial__ring')).toBeVisible();
      await page.clock.setFixedTime(await page.evaluate(() => Date.now()));
      await page.clock.resume();
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
