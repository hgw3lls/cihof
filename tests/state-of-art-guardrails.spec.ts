import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

type TargetViolation = {
  label: string;
  selector: string;
  width: number;
  height: number;
};

test.describe('state-of-art guardrails', () => {
  test('public kiosk controls expose museum-grade touch targets', async ({ page }) => {
    await page.goto('./?kiosk=1');
    await page.mouse.click(960, 540);
    await expect(page.locator('.living-hall')).toBeVisible();
    await expect(page.locator('button.living-portrait').first()).toBeVisible();

    await expectTouchTargets(page, 'portraits');

    const firstPortrait = page.locator('button.living-portrait').first();
    await firstPortrait.click();
    await expect(page.locator('.living-hall__focusCard')).toBeVisible();
    await expectTouchTargets(page, 'focused portrait');

    await waitForGuard(page);
    await page.getByRole('button', { name: 'Arrange Hall by documented places and connections' }).click();
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'traces');
    await expectTouchTargets(page, 'traces');

    await waitForGuard(page);
    await page.getByRole('button', { name: 'Arrange Hall by induction history' }).click();
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'legacies');
    await expectTouchTargets(page, 'legacies');
  });

  test('legacies focus is a modal cohort navigator', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('.hall-surface')).toHaveCount(1);
    await expect(page.locator('button.living-portrait').first()).toBeVisible();

    await clickVisiblePortrait(page);
    await waitForGuard(page);
    await page.getByRole('button', { name: 'Arrange Hall by induction history' }).click();
    await waitForGuard(page);

    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'legacies');
    await expect(page.getByRole('dialog', { name: /cohort navigator/i })).toBeVisible();
    await expect(page.locator('.living-hall__focusCard .living-hall__focusActions')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'LIFE + WORK' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'SAVE TO VISIT', exact: true })).toHaveCount(0);

    const panBeforeWheel = await readLegacyPan(page);
    const wheelPoint = await legacyTimelinePointOutsideDialog(page);
    const wheelDelta = await legacyWheelDeltaAwayFromBoundary(page);
    await page.mouse.move(wheelPoint.x, wheelPoint.y);
    await page.mouse.wheel(wheelDelta, 0);
    await page.waitForTimeout(160);
    expect(await readLegacyPan(page)).toBe(panBeforeWheel);

    const navBox = await page.getByRole('button', { name: 'Arrange Hall by portraits' }).boundingBox();
    expect(navBox).toBeTruthy();
    await page.mouse.click((navBox?.x ?? 0) + (navBox?.width ?? 0) / 2, (navBox?.y ?? 0) + (navBox?.height ?? 0) / 2);
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'legacies');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', '');

    const focusedAgain = await clickVisiblePortrait(page);
    await waitForGuard(page);
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', focusedAgain);

    const panBeforeDismissSwipe = await readLegacyPan(page);
    await dragLegacyTimelineAwayFromBoundary(page);
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'legacies');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', '');
    expect(await readLegacyPan(page)).toBe(panBeforeDismissSwipe);

    const beforeUnlockedPan = await readLegacyPan(page);
    const unlockedDrag = await dragLegacyTimelineAwayFromBoundary(page);
    if (unlockedDrag.direction === 'increase') {
      await expect.poll(() => readLegacyPan(page)).toBeGreaterThan(beforeUnlockedPan);
    } else {
      await expect.poll(() => readLegacyPan(page)).toBeLessThan(beforeUnlockedPan);
    }

    await page.waitForTimeout(620);
    const focusedAfterUnlockedDrag = await clickVisiblePortrait(page);
    await waitForGuard(page);
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', focusedAfterUnlockedDrag);

    const outsidePortrait = await visiblePortraitOutsideFocusCard(page, [focusedAfterUnlockedDrag]);
    await page.mouse.click(outsidePortrait.x, outsidePortrait.y);
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'legacies');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', '');
    await expect(page.locator(`button.living-portrait[data-transition-person="${outsidePortrait.id}"]`)).not.toHaveClass(/living-portrait--focused/);
  });

  test('production build publishes offline and interoperability entrypoints', async ({ page, request }) => {
    const standards = await request.get('./data/standards-index.json');
    expect(standards.ok()).toBe(true);
    const standardsJson = (await standards.json()) as {
      exports?: Record<string, { path?: string }>;
      coverage?: { inductees?: number; iiifManifests?: number };
    };

    expect(standardsJson.exports?.linkedArt?.path).toBe('/data/linked-art-export.json');
    expect(standardsJson.exports?.cidocCrm?.path).toBe('/data/cidoc-crm-export.json');
    expect(standardsJson.exports?.iiifCollection?.path).toBe('/data/iiif-collection.json');
    expect(standardsJson.coverage?.inductees).toBeGreaterThan(100);
    expect(standardsJson.coverage?.iiifManifests).toBeGreaterThan(100);

    const linkedArt = await request.get('./data/linked-art-export.json');
    const cidoc = await request.get('./data/cidoc-crm-export.json');
    const iiif = await request.get('./data/iiif-collection.json');
    expect(linkedArt.ok()).toBe(true);
    expect(cidoc.ok()).toBe(true);
    expect(iiif.ok()).toBe(true);

    await page.goto('./?kiosk=1');
    const registration = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return { supported: false, registered: false };
      const ready = await Promise.race([
        navigator.serviceWorker.ready.then((value) => value),
        new Promise<ServiceWorkerRegistration | null>((resolve) => {
          window.setTimeout(() => resolve(null), 8_000);
        }),
      ]);
      return {
        supported: true,
        registered: Boolean(ready),
        scriptUrl: ready?.active?.scriptURL ?? ready?.installing?.scriptURL ?? ready?.waiting?.scriptURL ?? '',
      };
    });

    expect(registration.supported).toBe(true);
    expect(registration.registered).toBe(true);
    expect(registration.scriptUrl).toContain('/sw.js');
  });
});

async function expectTouchTargets(page: Page, stateLabel: string) {
  const violations = await page.evaluate<TargetViolation[]>(() => {
    const interactive = Array.from(document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"])'));
    return interactive
      .filter((element) => {
        if (element.closest('[aria-hidden="true"], [hidden]')) return false;
        if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true') return false;
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        if (rect.right < 0 || rect.bottom < 0 || rect.left > viewportWidth || rect.top > viewportHeight) return false;
        return rect.width < 44 || rect.height < 44;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const classes = Array.from(element.classList).slice(0, 4).join('.');
        return {
          label: element.getAttribute('aria-label') || element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80) || element.tagName.toLowerCase(),
          selector: `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ''}`,
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10,
        };
      });
  });

  expect(violations, `${stateLabel} has undersized visible controls`).toEqual([]);
}

async function clickVisiblePortrait(page: Page, skipIds: string[] = []) {
  const target = await visiblePortraitTarget(page, skipIds);
  await page.mouse.click(target.x, target.y);
  return target.id;
}

async function visiblePortraitOutsideFocusCard(page: Page, skipIds: string[] = []) {
  return visiblePortraitTarget(page, skipIds, true);
}

async function readLegacyPan(page: Page) {
  return page.evaluate(() => Number(document.querySelector<HTMLElement>('.living-hall')?.dataset.legacyPan ?? 0));
}

async function legacyWheelDeltaAwayFromBoundary(page: Page) {
  const { pan, maxPan } = await legacyPanBounds(page);
  expect(maxPan).toBeGreaterThan(0);
  return pan > maxPan * 0.5 ? -520 : 520;
}

async function legacyPanBounds(page: Page) {
  return page.evaluate(() => {
    const hall = document.querySelector<HTMLElement>('.living-hall');
    const field = document.querySelector<HTMLElement>('.living-hall__field');
    const viewport = field?.parentElement as HTMLElement | null;
    return {
      pan: Number(hall?.dataset.legacyPan ?? 0),
      maxPan: Math.max(0, (field?.offsetWidth ?? 0) - (viewport?.clientWidth ?? 0)),
    };
  });
}

async function legacyTimelinePointOutsideDialog(page: Page) {
  const point = await page.evaluate(() => {
    const hall = document.querySelector<HTMLElement>('.living-hall')?.getBoundingClientRect() ?? null;
    const dialog = document.querySelector<HTMLElement>('.living-hall__focusCard')?.getBoundingClientRect() ?? null;
    if (!hall) return null;
    const candidates = [
      { x: hall.left + hall.width * 0.72, y: hall.top + hall.height * 0.48 },
      { x: hall.left + hall.width * 0.36, y: hall.top + hall.height * 0.64 },
      { x: hall.left + hall.width * 0.82, y: hall.top + hall.height * 0.35 },
      { x: hall.left + hall.width * 0.52, y: hall.top + hall.height * 0.78 },
    ];
    return candidates.find(({ x, y }) => {
      if (x < 12 || x > window.innerWidth - 12 || y < 44 || y > window.innerHeight - 100) return false;
      if (!dialog) return true;
      return x < dialog.left || x > dialog.right || y < dialog.top || y > dialog.bottom;
    }) ?? candidates[0];
  });

  if (!point) throw new Error('No timeline point was available.');
  return point;
}

async function dragLegacyTimelineAwayFromBoundary(page: Page) {
  const { pan, maxPan } = await legacyPanBounds(page);
  expect(maxPan).toBeGreaterThan(0);
  const point = await legacyTimelinePointOutsideDialog(page);
  const direction = pan > maxPan * 0.5 ? 'decrease' : 'increase';
  const moveX = direction === 'increase' ? -260 : 260;
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + moveX, point.y, { steps: 8 });
  await page.mouse.up();
  return { direction };
}

async function visiblePortraitTarget(page: Page, skipIds: string[] = [], outsideFocusCard = false) {
  const target = await page.evaluate(({ outsideCard, idsToSkip }) => {
    const card = document.querySelector('.living-hall__focusCard')?.getBoundingClientRect() ?? null;
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button.living-portrait'));
    const visible = buttons.find((button) => {
      const id = button.dataset.transitionPerson ?? '';
      if (!id || idsToSkip.includes(id) || button.classList.contains('living-portrait--focused')) return false;
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      if (outsideCard && card && x >= card.left && x <= card.right && y >= card.top && y <= card.bottom) return false;
      const hit = document.elementFromPoint(x, y);
      return rect.width > 24
        && rect.height > 32
        && rect.left > 8
        && rect.right < window.innerWidth - 8
        && rect.top > 32
        && rect.bottom < window.innerHeight - 96
        && Boolean(hit && button.contains(hit));
    });

    if (!visible) return null;
    const rect = visible.getBoundingClientRect();
    return {
      id: visible.dataset.transitionPerson ?? '',
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }, { idsToSkip: skipIds, outsideCard: outsideFocusCard });

  if (!target?.id) throw new Error('No visible portrait was available.');
  return target;
}

async function waitForGuard(page: Page) {
  await expect(page.locator('.transition-input-guard')).toBeHidden({ timeout: 2_500 });
}
