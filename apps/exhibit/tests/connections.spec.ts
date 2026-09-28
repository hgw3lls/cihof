import { expect, test, type Page } from '@playwright/test';
import { begin, choose } from './visit.ts';

/**
 * Connections, on the wall. The unit tests cover the arrangement; these cover
 * what only a display shows: the lens is offered, touching a face walks to
 * it, the wording on a tie is the claim read outwards from the centre, the
 * places are a layer and a view, and everything is reachable by keyboard.
 */
const bar = (page: Page) => page.getByRole('navigation', { name: 'Ways to explore' });
const focus = (page: Page) => page.locator('.tile[data-ring="focus"]');
const ties = (page: Page) => page.locator('.tile[data-ring="tie"]');

async function openConnections(page: Page) {
  await begin(page);
  await bar(page).getByRole('button', { name: /^Connections/ }).click();
  await expect(focus(page)).toHaveCount(1);
}

test('the lens is offered, and Places is a layer of it rather than a lens of its own', async ({ page }) => {
  await begin(page);
  await expect(bar(page).getByRole('button', { name: /^Connections/ })).toBeVisible();
  await expect(bar(page).getByRole('button', { name: /^Places/ })).toHaveCount(0);
});

test('it opens on somebody, their ties round them, each worded', async ({ page }) => {
  await openConnections(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^At the centre: /);
  expect(await ties(page).count()).toBeGreaterThan(0);
  // A tie reads out as the person and the claim.
  expect(await ties(page).first().getAttribute('aria-label')).toMatch(/^.+, .+/);
});

test('touching a tie walks to that person, and the walk is kept along the top', async ({ page }) => {
  await openConnections(page);
  const first = ties(page).first();
  const name = (await first.getAttribute('aria-label'))!.split(',')[0]!;
  await first.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  await expect(page.locator('.sheet__name')).toHaveText(name);

  const next = ties(page).first();
  const nextName = (await next.getAttribute('aria-label'))!.split(',')[0]!;
  await next.click();
  const trail = page.getByRole('navigation', { name: 'Your thread' });
  await expect(trail.locator('.trail__step button')).toHaveCount(2);
  await expect(trail.getByRole('button', { name: 'Save this thread' })).toBeVisible();
  await expect(trail.getByRole('button', { name: nextName })).toHaveAttribute('aria-current', 'step');

  // Back along it.
  await trail.getByRole('button', { name }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  await expect(trail).toHaveCount(0);
});

test('the wording on a tie is the claim, read outwards from the centre', async ({ page }) => {
  await begin(page);
  await choose(page, 'Wael Khoury');
  await page.getByRole('button', { name: /connections$/ }).click();
  const mary = page.locator('.tile[aria-label^="Hon. Mary Rose Oakar,"]');
  await expect(mary).toHaveAttribute('aria-label', 'Hon. Mary Rose Oakar, inducted Hon. Mary Rose Oakar');
  await mary.click();
  // From her side the same tie reads the other way.
  await expect(page.locator('.tile[aria-label^="Wael Khoury,"]')).toHaveAttribute('aria-label', /Wael Khoury, was inducted by/);
});

test('context stays apart from relationships: it is worded as appearing together', async ({ page }) => {
  await begin(page);
  await choose(page, 'Wael Khoury');
  await page.getByRole('button', { name: /connections$/ }).click();
  await expect(page.locator('.tile[data-ring="tie"][aria-label*="Appeared together · "]').first()).toBeAttached();
  await expect(page.locator('.sheet__ties-list')).toContainText('Appeared together · ');
});

test('turning a layer off takes its ties away', async ({ page }) => {
  await begin(page);
  await choose(page, 'Wael Khoury');
  await page.getByRole('button', { name: /connections$/ }).click();
  const welcomed = page.getByRole('button', { name: /^Welcomed in/ });
  await expect(welcomed).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.tile[aria-label^="Hon. Mary Rose Oakar,"]')).toHaveCount(1);
  await welcomed.click();
  await expect(welcomed).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.tile[aria-label^="Hon. Mary Rose Oakar,"]')).toHaveCount(0);
});

test('a place can be brought to the centre, with the people tied to it', async ({ page }) => {
  await begin(page);
  await choose(page, 'Wael Khoury');
  await page.getByRole('button', { name: /connections$/ }).click();
  await page.locator('.sheet__ties-list button', { hasText: 'Cleveland Cultural Gardens' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cleveland Cultural Gardens');
  await expect(page.locator('.sheet__kicker')).toHaveText(/^Place/);
  const people = await page.locator('.sheet__ties-list li').count();
  await expect(ties(page)).toHaveCount(people);
  await page.locator('.sheet__ties-list button').first().click();
  await expect(focus(page)).toHaveCount(1);
});

test('by place sets every place out in the city, and choosing somebody lights their ties', async ({ page }) => {
  await openConnections(page);
  await page.getByRole('button', { name: /^Same place/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('By place');
  await expect(page.locator('.masthead p')).toHaveText(/^13 places/);
  await page.locator('.tile[aria-label="Wael Khoury"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wael Khoury');
  await expect(page.locator('.masthead p')).toHaveText(/ties reach across the city$/);
});

test('zoom goes out and in, and back to the centre', async ({ page }) => {
  await openConnections(page);
  const level = page.locator('.field__zoom > span');
  await expect(level).toHaveText('100%');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(level).toHaveText('130%');
  await page.getByRole('button', { name: 'Back to the centre' }).click();
  await expect(level).toHaveText('100%');
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect(level).toHaveText('50%');
});

test('every face on the diagram is reachable by keyboard', async ({ page }) => {
  await openConnections(page);
  const tie = ties(page).first();
  const name = (await tie.getAttribute('aria-label'))!.split(',')[0]!;
  await tie.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
});

test('a story still opens from Connections', async ({ page }) => {
  await openConnections(page);
  await ties(page).first().click();
  await page.getByRole('button', { name: 'Read their story' }).click();
  await expect(page.locator('dialog.record')).toBeVisible();
});
