import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const screenshotDir = process.env.CIHOF_SCREENSHOT_DIR ?? '/tmp/cihof-hall-screenshots';

test.describe('persistent Hall final acceptance', () => {
  test('Test A: Load app -> PORTRAITS -> focus a portrait -> close focus', async ({ page }) => {
    await page.goto('./');
    await expectHall(page, 'portraits');
    await expect(page.getByRole('button', { name: 'Arrange Hall by portraits' })).toHaveAttribute('aria-pressed', 'true');
    await screenshotHall(page, 'portraits');

    const personId = await clickFirstPortrait(page);
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', personId);
    await expect(page.locator('.living-hall__focusCard')).toContainText('HONORED FOR');
    await expectNoVisitorDestination(page);

    await page.getByRole('button', { name: 'Close focused portrait' }).click();
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', '');
    await expect(page.locator('.living-hall__focusCard')).toBeHidden();
    await expectHall(page, 'portraits');
  });

  test('Test B: PORTRAITS -> TRACES -> touch related portrait -> touch another related portrait', async ({ page }) => {
    await page.goto('./');
    const firstPersonId = await clickFirstPortrait(page);
    await waitForGuard(page);

    await page.getByRole('button', { name: 'Arrange Hall by heritage and connections' }).click();
    await expectHall(page, 'traces', firstPersonId);
    const traceInfo = page.locator('.living-hall__traceFocus');
    await expect(traceInfo).toBeVisible();
    await expect(traceInfo.locator('.living-hall__traceConnection').first()).toBeVisible();
    await screenshotHall(page, 'traces');

    const secondPersonId = await clickRelatedPortrait(page, firstPersonId);
    await expectHall(page, 'traces', secondPersonId);
    await expect(traceInfo).toBeVisible();
    await expect(traceInfo.locator('.living-hall__traceConnection').first()).toBeVisible();
    await waitForGuard(page);

    const thirdPersonId = await clickRelatedPortrait(page, secondPersonId);
    expect(thirdPersonId).not.toBe(secondPersonId);
    await expectHall(page, 'traces', thirdPersonId);
    await expectNoVisitorDestination(page);
  });

  test('Test C: Focused TRACES -> PORTRAITS -> TRACES again preserves focus', async ({ page }) => {
    await page.goto('./');
    const personId = await clickFirstPortrait(page);
    await waitForGuard(page);

    await page.getByRole('button', { name: 'Arrange Hall by heritage and connections' }).click();
    await expectHall(page, 'traces', personId);
    await waitForGuard(page);

    await page.getByRole('button', { name: 'Arrange Hall by portraits' }).click();
    await expectHall(page, 'portraits', personId);
    await waitForGuard(page);

    await page.getByRole('button', { name: 'Arrange Hall by heritage and connections' }).click();
    await expectHall(page, 'traces', personId);
    await expect(page.locator(`button.living-portrait[data-transition-person="${personId}"]`)).toHaveClass(/living-portrait--focused/);
    await expectNoVisitorDestination(page);
  });

  test('Test D: PORTRAITS -> LEGACIES -> horizontal swipe -> focus portrait', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('button.living-portrait').first()).toBeVisible();
    const initialIds = await visiblePortraitIds(page);

    await page.getByRole('button', { name: 'Arrange Hall by induction history' }).click();
    await expectHall(page, 'legacies');
    await screenshotHall(page, 'legacies');
    await expectSameCollection(page, initialIds);
    await waitForGuard(page);

    const beforePan = await readLegacyPan(page);
    await dragHallHorizontally(page);
    await expect.poll(() => readLegacyPan(page)).toBeGreaterThan(beforePan);
    await page.waitForTimeout(820);

    const target = await visiblePortraitTarget(page);
    await page.mouse.click(target.x, target.y);
    await expectHall(page, 'legacies', target.id);
    const cohortDialog = page.getByRole('dialog', { name: /cohort navigator/i });
    await expect(cohortDialog).toBeVisible();
    await expect(cohortDialog).toContainText('COHORT NAVIGATION');
    await expect(cohortDialog).toContainText('Class Corridor');
    await screenshotHall(page, 'legacies-focus');
    await expectNoVisitorDestination(page);
  });

  test('Test E: Focused LEGACIES -> TRACES keeps same person as anchor', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Arrange Hall by induction history' }).click();
    await expectHall(page, 'legacies');
    await waitForGuard(page);
    await waitForHallFieldMotion(page);

    const target = await visiblePortraitTarget(page);
    await page.mouse.click(target.x, target.y);
    await expectHall(page, 'legacies', target.id);
    await waitForGuard(page);

    await dismissLegacyFocus(page);
    await page.getByRole('button', { name: 'Arrange Hall by heritage and connections' }).click();
    await expectHall(page, 'traces', target.id);
    await expect(page.locator(`button.living-portrait[data-transition-person="${target.id}"]`)).toHaveClass(/living-portrait--focused/);
    await expectNoVisitorDestination(page);
  });

  test('Test F: Focused person -> LIFE + WORK -> close -> WATCH where available -> close -> QR -> auto-close', async ({ page }) => {
    await page.goto('./');
    const watchPerson = await readWatchCandidateData(page);
    await page.locator(`button.living-portrait[data-transition-person="${watchPerson.id}"]`).click();
    await expectHall(page, 'portraits', watchPerson.id);
    await waitForGuard(page);

    await page.getByRole('button', { name: 'LIFE + WORK' }).click();
    await expect(page.locator('.living-hall__personActionPanel .story-mode')).toBeVisible();
    await expectHall(page, 'portraits', watchPerson.id);
    await page.locator('.living-hall__personActionHeader button').click();
    await expect(page.locator('.living-hall__personActionPanel')).toHaveCount(0);

    await page.getByRole('button', { name: 'WATCH INDUCTION' }).click();
    await expect(page.locator('.living-hall__personActionPanel .media-experience')).toBeVisible();
    await expectHall(page, 'portraits', watchPerson.id);
    await page.locator('.living-hall__personActionHeader button').click();
    await expect(page.locator('.living-hall__personActionPanel')).toHaveCount(0);

    await page.getByRole('button', { name: 'TAKE IT WITH YOU' }).click();
    await expect(page.locator('.living-hall__personActionPanel .qr-continuation')).toBeVisible();
    await expectHall(page, 'portraits', watchPerson.id);
    await expect(page.locator('.living-hall__personActionPanel')).toHaveCount(0, { timeout: 7_000 });
    await expectHall(page, 'portraits', watchPerson.id);
  });

  test('Test G: Abandon interaction -> idle reset -> default PORTRAITS attract state', async ({ page }) => {
    await page.goto('./?kiosk=1&lens=legacies');
    await keepKioskAwakeUntil(page, async () => {
      return await page.locator('.hall-surface').getAttribute('data-hall-lens').catch(() => '') === 'legacies';
    }, 6_000);
    await dragHallHorizontally(page);

    await expect(page.locator('.living-hall--attract')).toBeVisible({ timeout: 7_000 });
    await expectHall(page, 'portraits');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', '');
    await expect(page.locator('.living-hall')).toHaveAttribute('data-trace-focus-key', '');
    await expect(page.locator('.living-hall')).toHaveAttribute('data-legacy-pan', '');
    await expectNoVisitorDestination(page);
  });

  test('Test H: Legacy URLs for connections/world/time/person map into the new Hall model', async ({ page }) => {
    const deepLink = await readDeepLinkCandidateData(page);

    await page.goto(`./?view=connections&person=${deepLink.id}`);
    await expectHall(page, 'traces', deepLink.id);
    await expect(page).toHaveURL(/lens=traces/);
    await expectNoVisitorDestination(page);

    await page.goto(`./?view=world&world=${encodeURIComponent(deepLink.countryTraceKey)}`);
    await expectHall(page, 'traces', null);
    await expect(page.locator('.living-hall')).toHaveAttribute('data-trace-focus-key', deepLink.countryTraceKey);
    await expect(page).toHaveURL(/lens=traces/);
    await expectNoVisitorDestination(page);

    await page.goto(`./?view=time&year=${deepLink.classYear}`);
    await expectHall(page, 'legacies');
    await expect(page.locator('.living-hall')).toHaveAttribute('data-legacy-active-year', String(deepLink.classYear));
    await expect(page).toHaveURL(/lens=legacies/);
    await expectNoVisitorDestination(page);

    await page.goto(`./?person=${deepLink.id}`);
    await expectHall(page, 'portraits', deepLink.id);
    await expect(page.locator(`button.living-portrait[data-transition-person="${deepLink.id}"]`)).toHaveClass(/living-portrait--focused/);
    await expectNoVisitorDestination(page);
  });
});

async function expectHall(page: Page, lens: string, focusedPersonId: string | null = '') {
  await expect(page.locator('.hall-surface')).toHaveCount(1);
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', lens);
  if (focusedPersonId !== null) {
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', focusedPersonId);
  }
  await expect(page.locator('.living-hall')).toBeVisible();
  await expect(page.locator('button.living-portrait').first()).toBeVisible();
}

async function expectNoVisitorDestination(page: Page) {
  await expect(page.locator('.detail--visitor:not(.living-hall__personActionPanel)')).toHaveCount(0);
  await expect(page.locator('.world-lens')).toHaveCount(0);
  await expect(page.locator('.time-lens')).toHaveCount(0);
  await expect(page.locator('.human-network')).toHaveCount(0);
}

async function waitForGuard(page: Page) {
  await expect(page.locator('.transition-input-guard')).toBeHidden({ timeout: 2_500 });
}

async function waitForHallFieldMotion(page: Page) {
  await page.waitForTimeout(820);
}

async function clickFirstPortrait(page: Page) {
  const firstPortrait = page.locator('button.living-portrait').first();
  await expect(firstPortrait).toBeVisible();
  const personId = await firstPortrait.getAttribute('data-transition-person');
  expect(personId).toBeTruthy();
  await firstPortrait.click();
  return personId ?? '';
}

async function clickRelatedPortrait(page: Page, currentPersonId: string) {
  const connection = page.locator(`.living-hall__traceConnection:not([data-trace-person="${currentPersonId}"])`).first();
  if (await connection.count()) {
    await expect(connection).toBeVisible();
    const personId = await connection.getAttribute('data-trace-person');
    expect(personId).toBeTruthy();
    await connection.click();
    return personId ?? '';
  }

  const related = page.locator(`button.living-portrait--emphasis:not(.living-portrait--focused):not([data-transition-person="${currentPersonId}"])`).first();
  await expect(related).toBeVisible();
  const personId = await related.getAttribute('data-transition-person');
  expect(personId).toBeTruthy();
  await related.click();
  return personId ?? '';
}

async function screenshotHall(page: Page, name: 'portraits' | 'traces' | 'legacies') {
  mkdirSync(screenshotDir, { recursive: true });
  await page.locator('.hall-surface').screenshot({
    animations: 'disabled',
    path: `${screenshotDir}/${name}.png`,
  });
}

async function visiblePortraitIds(page: Page) {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll<HTMLButtonElement>('button.living-portrait'))
      .map((button) => button.dataset.transitionPerson ?? '')
      .filter(Boolean)
      .sort();
  });
}

async function expectSameCollection(page: Page, expectedIds: string[]) {
  const nextIds = await visiblePortraitIds(page);
  expect(nextIds).toEqual(expectedIds);
}

async function dragHallHorizontally(page: Page) {
  const hallBox = await page.locator('.living-hall').boundingBox();
  expect(hallBox).toBeTruthy();
  if (!hallBox) throw new Error('Living Hall bounds unavailable.');
  await page.mouse.move(hallBox.x + hallBox.width * 0.7, hallBox.y + hallBox.height * 0.48);
  await page.mouse.down();
  await page.mouse.move(hallBox.x + hallBox.width * 0.26, hallBox.y + hallBox.height * 0.48, { steps: 8 });
  await page.mouse.up();
}

async function visiblePortraitTarget(page: Page) {
  return page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button.living-portrait'));
    const visible = buttons.find((button) => {
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return rect.width > 30
        && rect.height > 40
        && rect.left > 24
        && rect.right < window.innerWidth - 24
        && rect.top > 70
        && rect.bottom < window.innerHeight - 120
        && Boolean(hit && button.contains(hit));
    });
    if (!visible) return { id: '', x: 0, y: 0 };
    const rect = visible.getBoundingClientRect();
    return {
      id: visible.dataset.transitionPerson ?? '',
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  });
}

async function readLegacyPan(page: Page) {
  return page.evaluate(() => Number(document.querySelector<HTMLElement>('.living-hall')?.dataset.legacyPan ?? 0));
}

async function dismissLegacyFocus(page: Page) {
  const dialog = page.getByRole('dialog', { name: /cohort navigator/i });
  await expect(dialog).toBeVisible();
  const point = await pointOutsideDialog(page);
  await page.mouse.click(point.x, point.y);
  await expect(dialog).toBeHidden();
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', '');
}

async function pointOutsideDialog(page: Page) {
  const point = await page.evaluate(() => {
    const hall = document.querySelector<HTMLElement>('.living-hall')?.getBoundingClientRect() ?? null;
    const dialog = document.querySelector<HTMLElement>('.living-hall__focusCard')?.getBoundingClientRect() ?? null;
    if (!hall) return null;
    const candidates = [
      { x: hall.right - 96, y: hall.top + hall.height * 0.52 },
      { x: hall.left + hall.width * 0.52, y: hall.bottom - 148 },
      { x: hall.right - 96, y: hall.top + 128 },
    ];
    return candidates.find(({ x, y }) => {
      if (!dialog) return true;
      return x < dialog.left || x > dialog.right || y < dialog.top || y > dialog.bottom;
    }) ?? candidates[0];
  });

  if (!point) throw new Error('No point outside the cohort navigator was available.');
  return point;
}

async function readWatchCandidateData(page: Page) {
  const response = await page.request.get('data/inductees.json');
  expect(response.ok()).toBe(true);
  const inductees = await response.json() as Array<{
    id: string;
    name: string;
    youtubeVideoIds?: string[];
    localVideoPaths?: string[];
  }>;
  const candidate = inductees.find((inductee) => {
    return (inductee.youtubeVideoIds?.length ?? 0) > 0 || (inductee.localVideoPaths?.length ?? 0) > 0;
  });
  if (!candidate) throw new Error('No watch-capable inductee found in test data.');
  return { id: candidate.id, name: candidate.name };
}

async function readDeepLinkCandidateData(page: Page) {
  const response = await page.request.get('data/inductees.json');
  expect(response.ok()).toBe(true);
  const inductees = await response.json() as Array<{
    id: string;
    classYear: number | null;
    countryTags?: string[];
  }>;
  const candidate = inductees.find((inductee) => {
    return Boolean(inductee.id)
      && typeof inductee.classYear === 'number'
      && (inductee.countryTags ?? []).some((country) => country && country !== 'United States');
  });
  if (!candidate || typeof candidate.classYear !== 'number') throw new Error('No deep-link candidate with class year and nationality tag found.');
  const country = (candidate.countryTags ?? []).find((tag) => tag && tag !== 'United States') ?? '';
  if (!country) throw new Error('No presentation nationality tag found for deep-link candidate.');
  return {
    id: candidate.id,
    classYear: candidate.classYear,
    countryTraceKey: `country:${slugForTraceKey(country)}`,
  };
}

function slugForTraceKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function keepKioskAwakeUntil(page: Page, predicate: () => Promise<boolean>, timeoutMs = 3_000) {
  const startedAt = Date.now();
  let tick = 0;
  while (Date.now() - startedAt < timeoutMs) {
    await page.mouse.click(18 + tick, 18);
    if (await predicate()) return;
    tick += 1;
    await page.waitForTimeout(120);
  }
  expect(await predicate()).toBe(true);
}
