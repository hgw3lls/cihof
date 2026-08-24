import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe('museum kiosk smoke', () => {
  test('loads the portrait wall and publishes health status', async ({ page }) => {
    await page.goto('./');

    await expect(page.getByRole('toolbar', { name: 'Experience lenses' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Switch to Living Hall' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('TOUCH SOMEONE')).toBeVisible();
    await expect(page.locator('button.living-portrait').first()).toBeVisible();
    const latestClass = await readLatestClassData(page);
    await expect(page.locator('.living-hall')).toHaveAttribute('data-latest-class-year', String(latestClass.year));
    await expect(page.locator('.living-hall')).toHaveAttribute('data-latest-class-size', String(latestClass.people));

    const cityQuestion = await readCityQuestionData(page);
    await expect(page.locator('.living-hall')).toHaveAttribute('data-city-question-enabled', cityQuestion.enabled ? 'true' : 'false');

    const health = await waitForKioskHealth(page, (snapshot) => snapshot.dataStatus === 'ready' && snapshot.peopleCount > 0);
    expect(health.currentView).toBe('living-hall');
    expect(health.kioskMode).toBe(false);
    expect(health.selectedPersonId).toBe('');
    expect(health.relationshipsCount).toBeGreaterThanOrEqual(0);
    expect(health.buildInfo.buildTarget).toBe('kiosk');
    expect(health.buildInfo.gitCommitShort).toMatch(/^[a-f0-9]{7,12}$|^unknown$/);

    const buildInfo = await page.request.get('data/build-info.json');
    expect(buildInfo.ok()).toBe(true);
    const buildInfoJson = await buildInfo.json() as KioskHealthForTest['buildInfo'];
    expect(buildInfoJson.buildTarget).toBe('kiosk');
    expect(buildInfoJson.gitCommitShort).toBe(health.buildInfo.gitCommitShort);
  });

  test('locks document scroll while allowing the museum stage to scroll', async ({ page }) => {
    await page.goto('./?view=world');
    await expect(page.locator('.world-lens')).toBeVisible();
    await expect(page.getByRole('button', { name: /^CLEVELAND/ })).toBeVisible();
    await page.locator('.world-region').first().click();
    await expect(page.locator('.world-person').first()).toBeVisible();

    const lockState = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>('.museum-stage');
      const bodyStyle = window.getComputedStyle(document.body);
      const rootStyle = window.getComputedStyle(document.documentElement);
      const stageStyle = stage ? window.getComputedStyle(stage) : null;

      window.scrollTo({ left: 0, top: 500, behavior: 'auto' });
      stage?.scrollTo({ left: 0, top: 500, behavior: 'auto' });

      return {
        bodyOverflow: bodyStyle.overflow,
        rootOverflow: rootStyle.overflow,
        stageOverflowY: stageStyle?.overflowY ?? '',
        stageScrollTop: stage?.scrollTop ?? 0,
        viewportHeight: document.documentElement.style.getPropertyValue('--cihof-vh'),
        windowScrollY: window.scrollY,
      };
    });

    expect(lockState.bodyOverflow).toBe('hidden');
    expect(lockState.rootOverflow).toBe('hidden');
    expect(lockState.stageOverflowY).toMatch(/auto|scroll/);
    expect(lockState.viewportHeight).toMatch(/px$/);
    expect(lockState.windowScrollY).toBe(0);
    expect(lockState.stageScrollTop).toBeGreaterThanOrEqual(0);

    await page.getByRole('button', { name: 'Reset' }).click();
    await expect.poll(() => page.evaluate(() => document.querySelector<HTMLElement>('.museum-stage')?.scrollTop ?? -1)).toBe(0);
  });

  test('keeps bottom navigation usable across primary views', async ({ page }) => {
    await page.goto('./');

    const cityQuestion = await readCityQuestionData(page);
    if (cityQuestion.enabled && cityQuestion.options.length > 0) {
      const option = cityQuestion.options[0];
      const beforeCounts = await readCityQuestionCounts(page, cityQuestion.storageKey);
      const beforeTotal = totalCityQuestionResponses(cityQuestion.options, beforeCounts);

      await expect(page.getByRole('button', { name: cityQuestion.prompt })).toBeVisible();
      await page.getByRole('button', { name: cityQuestion.prompt }).click();
      await expect(page.getByRole('dialog', { name: cityQuestion.prompt })).toBeVisible();
      await page.getByRole('button', { name: new RegExp(`^${escapeRegExp(option.label)}$`) }).click();

      await expect(page.locator('.city-question__ack')).toContainText(option.label);
      const afterCounts = await readCityQuestionCounts(page, cityQuestion.storageKey);
      expect(afterCounts[option.id] ?? 0).toBe((beforeCounts[option.id] ?? 0) + 1);
      await expect(page.locator('.living-hall')).toHaveAttribute('data-city-question-total', String(beforeTotal + 1));
    }

    for (const item of [
      { label: 'Switch to World', view: 'world' },
      { label: 'Switch to Time', view: 'time' },
    ]) {
      await page.getByRole('button', { name: item.label }).click();
      await expect(page.getByRole('button', { name: item.label })).toHaveAttribute('aria-pressed', 'true');
      await expect(page).toHaveURL(new RegExp(`view=${item.view}`));
      const health = await waitForKioskHealth(page, (snapshot) => snapshot.currentView === item.view);
      expect(health.lastInteractionSource).toBe(`nav:${item.view}`);
      if (item.view === 'time') {
        await expect(page.locator('.time-lens')).toBeVisible();
        const timeRange = page.locator('.time-lens__range');
        await expect(timeRange).toBeVisible();
        await expect(page.locator('.time-build-person').first()).toBeVisible();
        const yearReadout = page.locator('.time-lens__yearReadout strong');
        const startingYear = Number(await yearReadout.textContent());
        await timeRange.focus();
        await page.keyboard.press('ArrowLeft');
        await expect(yearReadout).toHaveText(String(startingYear - 1));
        await page.getByRole('button', { name: 'Open Class Media' }).click();
        await expect(page.locator('.detail--action-watch')).toBeVisible();
        await expect(page.locator('.media-experience, .person-watch-empty')).toBeVisible();
      }
    }

    await page.getByRole('button', { name: 'Switch to Living Hall' }).click();
    await expect(page.getByRole('button', { name: 'Switch to Living Hall' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('button.living-portrait').first()).toBeVisible();
  });

  test('opens a person view and returns to Living Hall', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('button.living-portrait').first()).toBeVisible();
    await page.locator('button.living-portrait').first().dispatchEvent('pointerdown');

    await expect(page.locator('.detail--museum')).toBeVisible();
    await expect(page.getByText('WHY ARE THEY HERE?')).toBeVisible();
    await expect(page.getByRole('button', { name: /^STORY$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^WATCH/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^CONNECTIONS$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^FOLLOW A THREAD ->$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^CONTINUE THIS STORY ->$/ })).toBeVisible();
    const selectedHealth = await waitForKioskHealth(page, (snapshot) => snapshot.currentView === 'person' && Boolean(snapshot.selectedPersonId));
    expect(selectedHealth.selectedPersonId).not.toBe('');

    await page.getByRole('button', { name: /^CONTINUE THIS STORY ->$/ }).click();
    await expect(page.locator('.qr-continuation')).toBeVisible();
    await expect(page.locator('.qr-continuation__code img')).toHaveAttribute('src', /^data:image\/svg\+xml/);
    await expect(page.locator('.qr-continuation')).toContainText('Scan with your phone');
    await page.getByRole('button', { name: 'Return To Profile' }).click();
    await expect(page.locator('.qr-continuation')).toBeHidden();

    await page.getByRole('button', { name: /^WATCH/ }).click();
    await expect(page.locator('.media-experience, .person-watch-empty')).toBeVisible();

    await page.getByRole('button', { name: /^FOLLOW A THREAD ->$/ }).click();
    await expect(page.locator('.human-network')).toBeVisible();
    await expect(page.locator('.human-network__threadChooser')).toBeVisible();
    await expect(page.getByText('FOLLOW A THREAD ->')).toBeVisible();
    await page.locator('.human-network__threadButton').first().click();
    await expect(page.locator('.human-network--threading')).toBeVisible();
    await expect(page.getByText('ANOTHER PERSON IN THIS STORY ->').first()).toBeVisible();
    await expect(page.locator('.human-network__center')).toBeVisible();
    await expect(page.locator('.human-network__node').first()).toBeVisible();
    await page.locator('.human-network__node').first().click();
    await expect(page.locator('.human-network')).toBeVisible();
    await expect(page.locator('.human-network--threading')).toBeVisible();
    await expect(page.locator('.human-network__threadButton--active')).toBeVisible();
    await waitForKioskHealth(page, (snapshot) => snapshot.currentView === 'connections' && snapshot.selectedPersonId === '');

    await page.getByRole('button', { name: 'Switch to Living Hall' }).click();
    await expect(page.locator('.detail--museum')).toBeHidden();
    await expect(page.locator('.human-network')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Switch to Living Hall' })).toHaveAttribute('aria-pressed', 'true');

    await waitForKioskHealth(page, (snapshot) => snapshot.currentView === 'living-hall' && snapshot.selectedPersonId === '');
  });

  test('rapid repeated transition input settles into a valid lens', async ({ page }) => {
    await page.goto('./');
    const firstPortrait = page.locator('button.living-portrait').first();
    await expect(firstPortrait).toBeVisible();

    await firstPortrait.evaluate((button) => {
      for (let index = 0; index < 8; index += 1) {
        button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: index + 1, pointerType: 'touch' }));
        button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: index + 1, pointerType: 'touch' }));
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });

    await expect(page.locator('.detail--museum')).toBeVisible();
    await expect(page.locator('.transition-input-guard')).toBeHidden({ timeout: 2_500 });

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.experience-dock__item'));
      for (let index = 0; index < 12; index += 1) {
        buttons[index % buttons.length]?.click();
      }
    });

    await expect(page.locator('.transition-input-guard')).toBeHidden({ timeout: 2_500 });
    const stableState = await page.evaluate(() => {
      const visibleSurfaces = ['.living-hall', '.detail--museum', '.human-network', '.world-lens', '.time-lens'].filter((selector) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      });
      const health = (window as unknown as { __CIHOF_KIOSK_STATUS__?: KioskHealthForTest }).__CIHOF_KIOSK_STATUS__;
      return { visibleSurfaces, view: health?.currentView ?? '' };
    });

    expect(['living-hall', 'person', 'connections', 'world', 'time']).toContain(stableState.view);
    expect(stableState.visibleSurfaces.length).toBe(1);
  });

  test('idle reset enters attract mode and touch returns home', async ({ page }) => {
    await page.goto('./?kiosk=1');
    await expect(page.locator('button.living-portrait').first()).toBeVisible();

    const latestClass = await readLatestClassData(page);
    await expect(page.locator('.living-hall--attract')).toBeVisible({ timeout: 6_000 });
    await waitForKioskHealth(page, (snapshot) => snapshot.attractActive === true && snapshot.lastResetReason === 'idle');
    const latestSequence = page.locator('.latest-class-sequence');
    await expect(latestSequence).toBeVisible({ timeout: 9_000 });
    await expect(latestSequence).toContainText(`Class Of ${latestClass.year}`);

    await page.mouse.click(60, 60);

    await expect(page.locator('.living-hall--attract')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Switch to Living Hall' })).toHaveAttribute('aria-pressed', 'true');
    const health = await waitForKioskHealth(page, (snapshot) => snapshot.attractActive === false);
    expect(health.currentView).toBe('living-hall');
  });
});

async function waitForKioskHealth(
  page: Page,
  predicate: (snapshot: KioskHealthForTest) => boolean,
) {
  await expect.poll(async () => {
    const snapshot = await readKioskHealth(page);
    return snapshot ? predicate(snapshot) : false;
  }).toBe(true);

  const snapshot = await readKioskHealth(page);
  if (!snapshot) throw new Error('Kiosk health status was not published.');
  return snapshot;
}

async function readKioskHealth(page: Page) {
  return page.evaluate(() => {
    return (window as unknown as { __CIHOF_KIOSK_STATUS__?: KioskHealthForTest }).__CIHOF_KIOSK_STATUS__ ?? null;
  }) as Promise<KioskHealthForTest | null>;
}

async function readLatestClassData(page: Page) {
  const response = await page.request.get('data/inductees.json');
  expect(response.ok()).toBe(true);
  const inductees = await response.json() as Array<{
    classYear: number | null;
    bioText?: string;
    storySummary?: string;
  }>;
  const years = inductees
    .map((inductee) => inductee.classYear)
    .filter((year): year is number => typeof year === 'number');
  const year = Math.max(...years);
  const people = inductees.filter((inductee) => inductee.classYear === year);
  const stories = people.filter((inductee) => Boolean((inductee.storySummary || inductee.bioText || '').trim())).length || people.length;

  return {
    year,
    people: people.length,
    stories,
    cities: people.length > 0 ? 1 : 0,
  };
}

async function readCityQuestionData(page: Page) {
  const response = await page.request.get('data/city-question.json');
  expect(response.ok()).toBe(true);
  const config = await response.json() as {
    enabled?: boolean;
    prompt?: string;
    storageKey?: string;
    options?: Array<{ id?: string; label?: string }>;
  };

  return {
    enabled: config.enabled === true,
    prompt: typeof config.prompt === 'string' && config.prompt.trim() ? config.prompt : 'WHAT HOLDS A CITY TOGETHER?',
    storageKey: typeof config.storageKey === 'string' && config.storageKey.trim()
      ? config.storageKey
      : 'cihof.city-question.responses.v1',
    options: Array.isArray(config.options)
      ? config.options
        .filter((option): option is { id: string; label: string } => {
          return typeof option.id === 'string' && option.id.trim().length > 0 &&
            typeof option.label === 'string' && option.label.trim().length > 0;
        })
        .map((option) => ({ id: option.id, label: option.label }))
      : [],
  };
}

async function readCityQuestionCounts(page: Page, storageKey: string) {
  return page.evaluate((key) => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return {};
      return parsed as Record<string, number>;
    } catch {
      return {};
    }
  }, storageKey) as Promise<Record<string, number>>;
}

function totalCityQuestionResponses(options: Array<{ id: string }>, counts: Record<string, number>) {
  return options.reduce((total, option) => total + (typeof counts[option.id] === 'number' ? counts[option.id] : 0), 0);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type KioskHealthForTest = {
  buildInfo: {
    buildTarget: string;
    gitCommitShort: string;
  };
  currentView: string;
  kioskMode: boolean;
  attractActive: boolean;
  selectedPersonId: string;
  peopleCount: number;
  relationshipsCount: number;
  dataStatus: string;
  lastInteractionSource: string;
  lastResetReason: string;
  resetCount: number;
};
