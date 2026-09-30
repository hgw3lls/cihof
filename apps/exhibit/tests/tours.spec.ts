import { expect, test, type Page } from '@playwright/test';
import { begin, choose } from './visit.ts';

/**
 * Tours: curated ones, shown only once approved, and threads a visitor saved
 * in Connections, kept on the display for the visitors after them.
 */
const bar = (page: Page) => page.getByRole('navigation', { name: 'Ways to explore' });
const chooser = (page: Page) => page.getByRole('dialog', { name: 'Curated tours, and threads that were followed.' });

async function walkAndSave(page: Page) {
  await choose(page, 'Wael Khoury');
  await page.getByRole('button', { name: /connections$/ }).click();
  await page.locator('.tile[aria-label^="Pierre Bejjani,"]').click();
  await page.locator('.tile[aria-label^="Richard A. Ganim,"]').click();
  await page.getByRole('button', { name: 'Save this thread' }).click();
  await expect(page.getByRole('button', { name: 'Saved to Tours' })).toBeDisabled();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('kept')) { localStorage.removeItem('cihof-wall-threads'); sessionStorage.setItem('kept', '1'); } });
});

test('with no curated tour approved, the chooser says so', async ({ page }) => {
  // A release whose curators have approved no tour yet.
  await page.route('**/data/exhibit.json', async (route) => {
    const bundle = await (await route.fetch()).json();
    await route.fulfill({ json: { ...bundle, tours: [] } });
  });
  await begin(page);
  await expect(bar(page).getByRole('button', { name: /^Tour/ })).toContainText('0 curated · 0 followed');
  await bar(page).getByRole('button', { name: /^Tour/ }).click();
  await expect(chooser(page)).toContainText('No curated tour is ready yet.');
  await expect(chooser(page)).toContainText('None yet.');
  await chooser(page).getByRole('button', { name: 'Back to the wall' }).click();
  await expect(chooser(page)).toHaveCount(0);
});

test('a thread saved in Connections is offered to the next visitor, named for its ends', async ({ page }) => {
  await begin(page);
  await walkAndSave(page);
  await page.getByRole('button', { name: 'Start over' }).click();
  await page.reload();
  await page.locator('[data-begin]').click();
  await expect(bar(page).getByRole('button', { name: /^Tour/ })).toContainText('1 followed');
  await bar(page).getByRole('button', { name: /^Tour/ }).click();
  await expect(chooser(page).locator('.tours__thread-name')).toHaveText('From Wael Khoury to Richard A. Ganim');
  // Nobody types a name that the next visitor would read.
  await expect(chooser(page).getByRole('textbox')).toHaveCount(0);
});

test('following a thread walks it a person at a time', async ({ page }) => {
  await begin(page);
  await walkAndSave(page);
  await bar(page).getByRole('button', { name: /^Tour/ }).click();
  await chooser(page).getByRole('button', { name: 'Follow it' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('From Wael Khoury to Richard A. Ganim');
  await expect(page.locator('.sheet__name')).toHaveText('Wael Khoury');
  await expect(page.locator('.chips__note')).toHaveText('Thread · 1 of 3');
  await page.getByRole('button', { name: 'Next person →' }).click();
  await expect(page.locator('.sheet__name')).toHaveText('Pierre Bejjani');
  await page.getByRole('button', { name: 'Next person →' }).click();
  await expect(page.getByRole('button', { name: 'Back to the start' })).toBeVisible();
  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(page.locator('.chips__note')).toHaveText('Thread · 2 of 3');
  await page.getByRole('button', { name: 'End tour' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Everyone, A to Z');
});

test('a thread can be reordered, shortened to two, or deleted', async ({ page }) => {
  await begin(page);
  await walkAndSave(page);
  await bar(page).getByRole('button', { name: /^Tour/ }).click();
  await chooser(page).getByRole('button', { name: /^Edit / }).click();
  const editor = page.getByRole('dialog', { name: 'From Wael Khoury to Richard A. Ganim' });
  await editor.getByRole('button', { name: 'Move Richard A. Ganim up' }).click();
  await expect(page.getByRole('dialog', { name: 'From Wael Khoury to Pierre Bejjani' })).toBeVisible();
  const edited = page.getByRole('dialog', { name: 'From Wael Khoury to Pierre Bejjani' });
  await edited.getByRole('button', { name: 'Remove Richard A. Ganim' }).click();
  await expect(edited.getByRole('button', { name: /^Remove / }).first()).toBeDisabled();
  await edited.getByRole('button', { name: 'Delete thread' }).click();
  // Back on the chooser, with the thread gone.
  await expect(chooser(page)).toContainText('None yet.');
});

test('an approved tour is offered and walked', async ({ page }) => {
  await page.route('**/data/exhibit.json', async (route) => {
    const bundle = await (await route.fetch()).json();
    const ids = bundle.people.slice(0, 5).map((person: { id: string }) => person.id);
    await route.fulfill({ json: { ...bundle, tours: [{ id: 't', label: 'A tour', prompt: 'Testing', description: 'Five people.', personIds: ids }] } });
  });
  await begin(page);
  await bar(page).getByRole('button', { name: /^Tour/ }).click();
  await chooser(page).getByRole('button', { name: /A tour/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A tour');
  await expect(page.locator('.chips__note')).toHaveText('Testing · 1 of 5');
  await expect(bar(page).getByRole('button', { name: /^Tour/ })).toHaveAttribute('aria-pressed', 'true');
});

test('staff can clear every saved thread from the recovery panel, after asking twice', async ({ page }) => {
  await begin(page);
  // Two threads saved by earlier visitors.
  await page.evaluate(async () => {
    const bundle = await (await fetch('data/exhibit.json')).json();
    const ids = bundle.people.slice(0, 4).map((person: { id: string }) => person.id);
    localStorage.setItem('cihof-wall-threads', JSON.stringify([
      { id: 't1', name: '', personIds: ids.slice(0, 2), created: '' },
      { id: 't2', name: '', personIds: ids.slice(2, 4), created: '' },
    ]));
  });
  await page.goto('./?recovery=1');
  const panel = page.locator('dialog.recovery');
  await expect(panel).toContainText('2 threads are saved on this display');

  // Asked once, then kept: nothing is lost.
  await panel.getByRole('button', { name: 'Clear all saved threads' }).click();
  await panel.getByRole('button', { name: 'Keep them' }).click();
  await expect(panel).toContainText('2 threads are saved on this display');

  await panel.getByRole('button', { name: 'Clear all saved threads' }).click();
  await panel.getByRole('button', { name: 'Yes, clear all 2' }).click();
  await expect(panel.getByRole('status')).toHaveText('Cleared 2 saved threads.');
  await expect(panel).toContainText('No threads are saved on this display.');
  await expect(panel.getByRole('button', { name: 'Clear all saved threads' })).toBeDisabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cihof-wall-threads') ?? '[]'))).toEqual([]);

  await page.goto('./');
  await page.locator('[data-begin]').click();
  await expect(bar(page).getByRole('button', { name: /^Tour/ })).toContainText('0 followed');
});
