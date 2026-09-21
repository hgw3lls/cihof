import { expect, test, type Page } from '@playwright/test';

/**
 * A03: focus behaves predictably around modal layers.
 *
 * Every panel declared aria-modal before this, while Tab wandered freely into
 * the page behind. These check the claim is now true rather than asserted —
 * that focus is trapped, the rest is genuinely inert, Escape closes only the
 * top layer, and the visitor is put back where they were.
 */
async function openRecord(page: Page) {
  await page.goto('.');
  await expect(page.locator('.tile').first()).toBeVisible();
  await page.evaluate(() => {
    const tile = [...document.querySelectorAll('.tile')].find((b) => b.textContent?.includes('Alex Machaskee'));
    (tile as HTMLButtonElement).click();
  });
  await page.getByRole('button', { name: 'Read the record' }).click();
  await expect(page.locator('dialog.record')).toBeVisible();
}

test('a record is a real modal, not just labelled as one', async ({ page }) => {
  await openRecord(page);
  expect(await page.locator('dialog.record').evaluate((el) => el.matches(':modal'))).toBe(true);
});

test('tabbing cannot walk out of the record into the collection behind it', async ({ page }) => {
  await openRecord(page);

  // Round-trip the dialog several times over. The browser parks focus on the
  // body as the cycle wraps, which is not an escape — what must never happen is
  // focus reaching a control behind the dialog.
  const escaped: string[] = [];
  for (let step = 0; step < 30; step += 1) {
    await page.keyboard.press('Tab');
    const where = await page.evaluate(() => {
      const active = document.activeElement;
      if (!active || active === document.body) return 'wrapping';
      if (active.closest('dialog.record')) return 'inside';
      return `behind:${active.className || active.tagName}`;
    });
    if (where.startsWith('behind:')) escaped.push(`step ${step}: ${where}`);
  }

  expect(escaped, 'focus must never reach a control behind the open record').toEqual([]);
});

test('shift-tabbing backwards cannot escape either', async ({ page }) => {
  await openRecord(page);

  const escaped: string[] = [];
  for (let step = 0; step < 20; step += 1) {
    await page.keyboard.press('Shift+Tab');
    const behind = await page.evaluate(() => {
      const active = document.activeElement;
      if (!active || active === document.body) return null;
      return active.closest('dialog.record') ? null : (active.className || active.tagName);
    });
    if (behind) escaped.push(`step ${step}: ${behind}`);
  }

  expect(escaped, 'backwards tabbing must not reach the collection either').toEqual([]);
});

test('the collection behind a modal is inert, not merely covered', async ({ page }) => {
  await openRecord(page);

  // A covered element can still be clicked through by assistive tooling or a
  // stray script. An inert one cannot be focused at all.
  const focusable = await page.evaluate(() => {
    const tile = document.querySelector<HTMLButtonElement>('.tile');
    tile?.focus();
    return Boolean(document.activeElement?.closest('.tile'));
  });

  expect(focusable, 'a tile behind the dialog must not take focus').toBe(false);
});

test('a film over a record closes back to the record, one layer at a time', async ({ page }) => {
  await page.route('**/data/exhibit.json', async (route) => {
    const bundle = await (await route.fetch()).json();
    await route.fulfill({
      json: {
        ...bundle,
        people: bundle.people.map((p: { id: string }) => p.id === 'alex-machaskee-2010'
          ? { ...p, films: [{ id: 'f', src: '/x.mp4', poster: '/x.png', captions: '/x.vtt', transcript: '/x.txt', durationSeconds: 3 }] }
          : p),
      },
    });
  });
  await openRecord(page);
  await page.getByRole('button', { name: 'Watch the film' }).click();
  await expect(page.locator('dialog.film')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('dialog.film')).toHaveCount(0);
  await expect(page.locator('dialog.record')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('dialog.record')).toHaveCount(0);
});

test('closing returns the visitor to the control they opened it from', async ({ page }) => {
  await openRecord(page);
  await page.keyboard.press('Escape');

  const returned = await page.evaluate(() => document.activeElement?.textContent?.trim());
  expect(returned).toBe('Read the record');
});
