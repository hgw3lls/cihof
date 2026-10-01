import { expect, type Page } from '@playwright/test';

/**
 * An installed display opens on its attract screen. Most specs are about what
 * happens after a visitor touches it, so they begin the way a visitor does:
 * with the call to action, which the attract screen offers first.
 */
export async function begin(page: Page, address = '.') {
  // Faces glide into place and the sheet slides in. A test build ends a visit
  // after a couple of idle seconds, and waiting for things to stop moving can
  // run into that, so these specs see the wall without its motion.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(address);
  await enter(page);
  await expect(page.locator('.tile').first()).toBeVisible();
}

/**
 * Touches the call to action on an attract screen already showing. Every
 * visitor who comes in is shown How this works first; these specs are about
 * what comes after it, so they skip it, as a visitor may.
 */
export async function enter(page: Page) {
  await page.locator('[data-begin]').first().click();
  await skipTutorial(page);
}

export async function skipTutorial(page: Page) {
  const tutorial = page.locator('dialog.tutorial');
  await tutorial.getByRole('button', { name: 'Skip' }).click();
  await expect(tutorial).toHaveCount(0);
}

/** Touches somebody's face on the wall, as a visitor would, and waits for their sheet. */
export async function choose(page: Page, name: string) {
  await page.locator(`.tile[aria-label="${name}"]`).click();
  await expect(page.locator('.sheet__name')).toHaveText(name);
}

/** Opens somebody's story from their sheet. */
export async function openStory(page: Page, name: string) {
  await choose(page, name);
  await page.getByRole('button', { name: 'Read their story' }).click();
}

/**
 * Chooses faces in turn until one whose sheet offers a film. Which people have
 * films is the content's business, so the specs do not name one.
 */
export async function chooseSomeoneWithFilm(page: Page) {
  const tiles = page.locator('.tile');
  for (let index = 0; index < 40; index += 1) {
    const name = await tiles.nth(index).getAttribute('aria-label');
    if (!name) continue;
    await choose(page, name);
    if (await page.locator('.sheet__film').count() > 0) return name;
  }
  throw new Error('nobody with a film among the first 40 people');
}
