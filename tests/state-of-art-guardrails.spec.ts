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

    await page.getByRole('button', { name: 'Arrange Hall by documented places and connections' }).click();
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'traces');
    await expectTouchTargets(page, 'traces');

    await page.getByRole('button', { name: 'Arrange Hall by induction history' }).click();
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'legacies');
    await expectTouchTargets(page, 'legacies');
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
