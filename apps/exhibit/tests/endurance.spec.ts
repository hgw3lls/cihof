import { expect, test } from '@playwright/test';
import { measure, startMeasuring, summarise, visit, type Sample } from './endurance/visit.ts';

/**
 * The visits `npm run endurance` repeats for hours, run a few times here so
 * that they keep up with the exhibit: a visit that can no longer find a
 * button would make a long run report nothing but its own mistakes.
 */
for (const mode of ['mosaic', 'names', 'stacked']) {
  test(`simulated visits from the ${mode} attract screen each end back on it`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`./?attract=${mode}`);
    const session = await startMeasuring(page);
    const began = Date.now();
    const samples: Sample[] = [];
    for (let index = 0; index < 6; index += 1) {
      // The test build ends a visit after a few seconds.
      const result = await visit(page, index, { filmMs: 500, idleWaitMs: 15_000 });
      samples.push({ ...result, ...(await measure(session)), atMs: Date.now() - began });
    }

    expect(samples.map((sample) => sample.problems).flat()).toEqual([]);
    expect(samples.every((sample) => sample.returned)).toBe(true);
    expect(new Set(samples.map((sample) => sample.ended))).toEqual(new Set(['start over', 'left alone']));
    expect(samples.some((sample) => sample.opened)).toBe(true);
    expect(samples.some((sample) => sample.film)).toBe(true);
    expect(samples[0]!.nodes).toBeGreaterThan(0);
    expect(samples[0]!.heapMB).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    expect(summarise(samples, errors.length).concerns).toEqual([]);
  });
}

test('watching films leaves nothing of them behind', async ({ page }) => {
  // A closed film's captions once kept its video, and everything else it
  // touched, for as long as the page ran.
  await page.goto('.');
  const session = await startMeasuring(page);
  const counts: number[] = [];
  for (let index = 0; index < 5; index += 1) {
    await page.locator('[data-begin]').first().click();
    const tiles = page.locator('.tile');
    for (let person = 0; person < 30; person += 1) {
      await tiles.nth(person).click();
      await page.getByRole('button', { name: 'Read the record' }).click();
      if (await page.getByRole('button', { name: /Watch the film/ }).isVisible()) break;
      await page.keyboard.press('Escape');
    }
    await page.getByRole('button', { name: /Watch the film/ }).click();
    await expect(page.locator('dialog.film')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog.film')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Start over' }).click();
    await expect(page.locator('.attract')).toBeVisible();
    counts.push((await measure(session)).nodes);
  }
  expect(counts.at(-1)!, `elements held after each visit: ${counts.join(', ')}`).toBeLessThanOrEqual(counts[0]! + 100);
});

test('a run that leaks, or fails to return, says so', () => {
  const sample = (index: number, heapMB: number, nodes: number, returned = true): Sample => ({
    visit: index, started: 'call to action', lenses: ['People'], opened: 'Someone', film: false, share: false,
    ended: 'left alone', returned, problems: [], ms: 1000, heapMB, nodes, listeners: 100, documents: 1,
    atMs: index * 360_000,
  });
  // Steady, with the swing between visits a real run shows.
  const steady = Array.from({ length: 40 }, (_, index) => sample(index, 20 + (index % 3), index % 2 ? 1450 : 310));
  expect(summarise(steady, 0).concerns).toEqual([]);

  const leaking = Array.from({ length: 40 }, (_, index) => sample(index, 20 + index, 1500 + index * 150, index !== 12));
  const concerns = summarise(leaking, 2).concerns.join(' ');
  expect(concerns).toContain('1 visit(s) did not end on the attract screen');
  expect(concerns).toContain('2 error(s)');
  expect(concerns).toContain('memory the page keeps grew');
  expect(concerns).toContain('more elements at the end');
});
