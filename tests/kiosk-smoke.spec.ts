import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe('museum kiosk smoke', () => {
  test('loads the portrait wall and publishes health status', async ({ page }) => {
    await page.goto('./');

    await expect(page.getByRole('toolbar', { name: 'Ways to explore the Hall of Fame' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Arrange Hall by portraits' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.museum-brand strong')).toHaveText('PORTRAITS');
    await expect(page.locator('.hall-surface')).toHaveCount(1);
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'portraits');
    await expect(page.locator('.living-hall__touchCue')).toHaveText('TOUCH A PORTRAIT');
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

  test('locks document scroll inside the persistent Hall surface', async ({ page }) => {
    await page.goto('./?view=world');
    await expect(page.locator('.hall-surface')).toHaveCount(1);
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'traces');
    await expect(page.locator('button.living-portrait').first()).toBeVisible();
    await expect(page.locator('.living-hall__tracePanel')).toBeVisible();
    await expect(page.locator('.world-lens')).toHaveCount(0);
    await expect(page.locator('.human-network')).toHaveCount(0);
    await expect(page.locator('.detail--visitor')).toHaveCount(0);

    await openTraceChooser(page);
    const placeControl = page.locator('.living-hall__traceControl').filter({ hasText: 'Place' }).first();
    if (await placeControl.count()) {
      await placeControl.click();
      await expect(page.locator('.living-hall')).toHaveAttribute('data-trace-focus-key', /^country:/);
      await expect(page.locator('.living-hall__tracePanel')).toBeVisible();
    }

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
    expect(lockState.stageOverflowY).toBe('hidden');
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

      const questionTrigger = page.getByRole('button', { name: cityQuestion.prompt });
      const questionDialog = page.getByRole('dialog', { name: cityQuestion.prompt });

      await expect(questionTrigger).toBeVisible();
      await questionTrigger.click();
      await expect(questionDialog).toBeVisible();
      await expect(questionDialog).toHaveAttribute('aria-modal', 'true');

      const navBox = await page.getByRole('button', { name: 'Arrange Hall by documented places and connections' }).boundingBox();
      expect(navBox).toBeTruthy();
      await page.mouse.click((navBox?.x ?? 0) + (navBox?.width ?? 0) / 2, (navBox?.y ?? 0) + (navBox?.height ?? 0) / 2);
      await expect(questionDialog).toBeHidden();
      await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'portraits');

      await questionTrigger.click();
      await expect(questionDialog).toBeVisible();
      await page.getByRole('button', { name: new RegExp(`^${escapeRegExp(option.label)}$`) }).click();

      await expect(page.locator('.city-question__ack')).toContainText(option.label);
      const afterCounts = await readCityQuestionCounts(page, cityQuestion.storageKey);
      expect(afterCounts[option.id] ?? 0).toBe((beforeCounts[option.id] ?? 0) + 1);
      await expect(page.locator('.living-hall')).toHaveAttribute('data-city-question-total', String(beforeTotal + 1));
    }

    for (const item of [
      { label: 'Arrange Hall by documented places and connections', lens: 'traces' },
      { label: 'Arrange Hall by induction history', lens: 'legacies' },
    ]) {
      await page.getByRole('button', { name: item.label }).click();
      await expect(page.getByRole('button', { name: item.label })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.hall-surface')).toHaveCount(1);
      await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', item.lens);
      await expect(page.locator('button.living-portrait').first()).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`lens=${item.lens}`));
      const health = await waitForKioskHealth(page, (snapshot) => snapshot.currentView === 'living-hall');
      expect(health.lastInteractionSource).toBe(`nav:${item.lens}`);
      if (item.lens === 'traces') {
        await expect(page.locator('.living-hall__tracePanel')).toBeVisible();
        await expect(page.locator('.living-hall__traceLine').first()).toBeAttached();
        await expect(page.locator('.world-lens')).toHaveCount(0);
        await expect(page.locator('.human-network')).toHaveCount(0);
      }
      if (item.lens === 'legacies') {
        await expect(page.locator('.living-hall__legacyControls')).toBeVisible();
        await expect(page.locator('.living-hall')).toHaveAttribute('data-legacy-active-year', /\d{4}/);
        await expect(page.locator('.living-hall__groupLabel').first()).toBeVisible();
        await expect(page.locator('.time-lens')).toHaveCount(0);
        await expect(page.locator('.hall-surface__lensPanel--legacies')).toHaveCount(0);
        await expect(page.locator('.detail--visitor')).toHaveCount(0);
      }
    }

    await dismissLegacyFocusIfOpen(page);
    await page.getByRole('button', { name: 'Arrange Hall by portraits' }).click();
    await expect(page.getByRole('button', { name: 'Arrange Hall by portraits' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'portraits');
    await expect(page.locator('button.living-portrait').first()).toBeVisible();
  });

  test('maps legacy visitor URLs into persistent Hall lens state', async ({ page }) => {
    const deepLink = await readDeepLinkCandidateData(page);
    expect(deepLink.id).toBeTruthy();

    for (const alias of ['living-hall', 'people', 'explore']) {
      await page.goto(`./?view=${alias}`);
      await expect(page.locator('.hall-surface')).toHaveCount(1);
      await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'portraits');
      await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', '');
      await expect(page.locator('.world-lens')).toHaveCount(0);
      await expect(page.locator('.time-lens')).toHaveCount(0);
      await expect(page.locator('.human-network')).toHaveCount(0);
      await expect(page.locator('.detail--visitor')).toHaveCount(0);
    }

    await page.goto(`./?view=connections&person=${deepLink.id}`);
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'traces');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', deepLink.id);
    await expect(page.locator('.living-hall__tracePanel')).toBeVisible();
    await expect(page.locator('.human-network')).toHaveCount(0);
    await expect(page.locator('.detail--visitor')).toHaveCount(0);
    await expect(page).toHaveURL(/lens=traces/);
    await expect(page).not.toHaveURL(/view=connections/);

    await page.goto(`./?view=routes&world=${encodeURIComponent(deepLink.countryTraceKey)}`);
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'traces');
    await expect(page.locator('.living-hall')).toHaveAttribute('data-trace-focus-key', deepLink.countryTraceKey);
    await expect(page.locator('.world-lens')).toHaveCount(0);
    await expect(page).toHaveURL(/lens=traces/);
    await expect(page).toHaveURL(new RegExp(`world=${encodeURIComponent(deepLink.countryTraceKey)}`));

    await page.goto(`./?view=timeline&year=${deepLink.classYear}`);
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'legacies');
    await expect(page.locator('.living-hall')).toHaveAttribute('data-legacy-active-year', String(deepLink.classYear));
    await expect(page.locator('.time-lens')).toHaveCount(0);
    await expect(page).toHaveURL(/lens=legacies/);
    await expect(page).not.toHaveURL(/view=timeline/);

    await page.goto(`./?person=${deepLink.id}`);
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'portraits');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', deepLink.id);
    await expect(page.locator(`button.living-portrait[data-transition-person="${deepLink.id}"]`)).toHaveClass(/living-portrait--focused/);
    await expect(page.locator('.detail--visitor')).toHaveCount(0);
  });

  test('focuses a portrait frame in place and returns to portraits', async ({ page }) => {
    await page.goto('./');
    const firstPortrait = page.locator('button.living-portrait').first();
    await expect(firstPortrait).toBeVisible();
    const selectedPersonId = await firstPortrait.getAttribute('data-transition-person');
    expect(selectedPersonId).toBeTruthy();

    await firstPortrait.click();

    await expect(page.locator('.hall-surface')).toHaveCount(1);
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'portraits');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', selectedPersonId ?? '');
    await expect(page.locator('.living-hall')).toBeVisible();
    await expect(page.locator(`button.living-portrait[data-transition-person="${selectedPersonId}"]`)).toHaveClass(/living-portrait--focused/);
    await expect(page.locator('button.living-portrait:not(.living-portrait--focused)').first()).toBeVisible();
    await expect(page.locator('.living-hall__focusCard')).toBeVisible();
    await expect(page.locator('.living-hall__focusCard')).toContainText('HONORED FOR');
    await expect(page.locator('.detail--visitor')).toHaveCount(0);
    const selectedHealth = await waitForKioskHealth(page, (snapshot) => snapshot.currentView === 'living-hall' && snapshot.selectedPersonId === selectedPersonId);
    expect(selectedHealth.selectedPersonId).toBe(selectedPersonId);

    await page.getByRole('button', { name: 'Close focused portrait' }).click();
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', '');
    await expect(page.locator('.living-hall__focusCard')).toBeHidden();
    await expect(page.locator('.detail--museum')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Arrange Hall by portraits' })).toHaveAttribute('aria-pressed', 'true');

    await waitForKioskHealth(page, (snapshot) => snapshot.currentView === 'living-hall' && snapshot.selectedPersonId === '');
  });

  test('reindexes traces around persistent portrait frames', async ({ page }) => {
    await page.goto('./');
    const firstPortrait = page.locator('button.living-portrait').first();
    await expect(firstPortrait).toBeVisible();
    const firstPersonId = await firstPortrait.getAttribute('data-transition-person');
    expect(firstPersonId).toBeTruthy();

    await firstPortrait.click();
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', firstPersonId ?? '');
    await expect(page.locator('.transition-input-guard')).toBeHidden({ timeout: 2_500 });

    await page.getByRole('button', { name: 'Arrange Hall by documented places and connections' }).click();
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'traces');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', firstPersonId ?? '');
    await expect(page.locator(`button.living-portrait[data-transition-person="${firstPersonId}"]`)).toHaveClass(/living-portrait--focused/);
    await expect(page.locator('.living-hall__tracePanel')).toBeVisible();
    await expect(page.locator('.living-hall__traceLine').first()).toBeAttached();
    await expect(page.locator('.world-lens')).toHaveCount(0);
    await expect(page.locator('.human-network')).toHaveCount(0);
    await expect(page.locator('.detail--visitor')).toHaveCount(0);
    await expect(page.locator('.transition-input-guard')).toBeHidden({ timeout: 2_500 });

    const relatedConnection = page.locator('.living-hall__traceConnection').first();
    await expect(relatedConnection).toBeVisible();
    const relatedPersonId = await relatedConnection.getAttribute('data-trace-person');
    expect(relatedPersonId).toBeTruthy();
    await relatedConnection.click();
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'traces');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', relatedPersonId ?? '');
    await expect(page.locator(`button.living-portrait[data-transition-person="${relatedPersonId}"]`)).toHaveClass(/living-portrait--focused/);
    await expect(page.locator(`button.living-portrait[data-transition-person="${firstPersonId}"]`)).toBeVisible();
    await expect(page.locator('.detail--visitor')).toHaveCount(0);

    await openTraceChooser(page);
    const conceptControl = page.locator('.living-hall__traceControl').filter({ hasText: 'Concept' }).first();
    if (await conceptControl.count()) {
      await conceptControl.click();
      await expect(page.locator('.living-hall')).toHaveAttribute('data-trace-focus-key', /^concept:/);
      await expect(page.locator('.living-hall__tracePanel')).toBeVisible();
    }

    await openTraceChooser(page);
    const placeControl = page.locator('.living-hall__traceControl').filter({ hasText: 'Place' }).first();
    if (await placeControl.count()) {
      await placeControl.click();
      await expect(page.locator('.living-hall')).toHaveAttribute('data-trace-focus-key', /^country:/);
      await expect(page.locator('.living-hall__tracePanel')).toBeVisible();
      await expect(page.locator('.world-lens')).toHaveCount(0);
    }
  });

  test('keeps person actions anchored to the focused portrait and lens', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('button.living-portrait').first()).toBeVisible();
    const watchPerson = await readWatchCandidateData(page);
    expect(watchPerson.id).toBeTruthy();

    await page.locator(`button.living-portrait[data-transition-person="${watchPerson.id}"]`).click();
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'portraits');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', watchPerson.id);
    await expect(page.locator('.living-hall__focusCard')).toContainText('HONORED FOR');
    await expect(page.getByRole('button', { name: 'IN COMMON' })).toHaveCount(0);
    await expect(page.locator('.transition-input-guard')).toBeHidden({ timeout: 2_500 });

    await exerciseAnchoredStoryAndQr(page, 'portraits', watchPerson.id, true);

    await page.getByRole('button', { name: 'WATCH INDUCTION' }).click();
    await expect(page.locator('.living-hall__personActionPanel .media-experience')).toBeVisible();
    await expect(page.locator('.living-hall')).toBeVisible();
    await expect(page.locator('.detail--visitor:not(.living-hall__personActionPanel)')).toHaveCount(0);
    await page.locator('.living-hall__personActionHeader button').click();
    await expect(page.locator('.living-hall__personActionPanel')).toHaveCount(0);
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'portraits');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', watchPerson.id);

    await page.getByRole('button', { name: 'Arrange Hall by documented places and connections' }).click();
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'traces');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', watchPerson.id);
    await expect(page.locator('.transition-input-guard')).toBeHidden({ timeout: 2_500 });
    await expectPortraitActionsHidden(page);
    await expect(page.locator('.living-hall__traceFocus')).toBeVisible();

    await page.getByRole('button', { name: 'Arrange Hall by induction history' }).click();
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'legacies');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', watchPerson.id);
    await expect(page.locator('.transition-input-guard')).toBeHidden({ timeout: 2_500 });
    await expect(page.getByRole('dialog', { name: /cohort navigator/i })).toBeVisible();
    await expectPortraitActionsHidden(page);
  });

  test('arranges legacies as a horizontal persistent chronology', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('button.living-portrait').first()).toBeVisible();
    const initialFrameCount = await page.locator('button.living-portrait').count();
    const firstFrameId = await page.locator('button.living-portrait').first().getAttribute('data-transition-person');
    expect(firstFrameId).toBeTruthy();

    await page.getByRole('button', { name: 'Arrange Hall by induction history' }).click();
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'legacies');
    await expect(page.locator('.museum-brand strong')).toHaveText('LEGACIES');
    await expect(page.locator('.living-hall__touchCue')).toHaveText('SWIPE THE CLASSES');
    await expect(page.locator('button.living-portrait')).toHaveCount(initialFrameCount);
    await expect(page.locator(`button.living-portrait[data-transition-person="${firstFrameId}"]`)).toHaveCount(1);
    await expect(page.locator(`button.living-portrait[data-transition-person="${firstFrameId}"]`)).toHaveAttribute('data-transition-role', 'time-portrait');
    await expect(page.locator('.living-hall__legacyControls')).toBeVisible();
    await expect(page.locator('.time-lens')).toHaveCount(0);
    await expect(page.locator('.hall-surface__lensPanel--legacies')).toHaveCount(0);
    await expect(page.locator('.transition-input-guard')).toBeHidden({ timeout: 2_500 });

    const rowCount = await page.evaluate(() => {
      const rows = new Set<number>();
      document.querySelectorAll<HTMLButtonElement>('button.living-portrait').forEach((button) => {
        const rect = button.getBoundingClientRect();
        if (rect.right < 0 || rect.left > window.innerWidth || rect.bottom < 0 || rect.top > window.innerHeight) return;
        rows.add(Math.round(rect.top / 24));
      });
      return rows.size;
    });
    expect(rowCount).toBeGreaterThanOrEqual(2);

    const beforePan = await readLegacyPan(page);
    const hallBox = await page.locator('.living-hall').boundingBox();
    expect(hallBox).toBeTruthy();
    if (!hallBox) throw new Error('Living Hall bounds unavailable.');
    await page.mouse.move(hallBox.x + hallBox.width * 0.68, hallBox.y + hallBox.height * 0.48);
    await page.mouse.down();
    await page.mouse.move(hallBox.x + hallBox.width * 0.24, hallBox.y + hallBox.height * 0.48, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => readLegacyPan(page)).toBeGreaterThan(beforePan);
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', '');
    await page.waitForTimeout(820);

    const visiblePortrait = await visiblePortraitTarget(page);
    expect(visiblePortrait.id).toBeTruthy();
    await page.mouse.click(visiblePortrait.x, visiblePortrait.y);
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'legacies');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', visiblePortrait.id);
    await expect(page.locator(`button.living-portrait[data-transition-person="${visiblePortrait.id}"]`)).toHaveClass(/living-portrait--focused/);
    const cohortDialog = page.getByRole('dialog', { name: /cohort navigator/i });
    await expect(cohortDialog).toBeVisible();
    await expect(cohortDialog).toContainText('COHORT NAVIGATION');
    await expect(cohortDialog).toContainText('Class Corridor');
    await expect(page.locator('.detail--visitor')).toHaveCount(0);
    await expect(page.locator('.transition-input-guard')).toBeHidden({ timeout: 2_500 });

    await dismissLegacyFocus(page);
    await page.getByRole('button', { name: 'Arrange Hall by documented places and connections' }).click();
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'traces');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', visiblePortrait.id);
    await expect(page.locator(`button.living-portrait[data-transition-person="${visiblePortrait.id}"]`)).toHaveClass(/living-portrait--focused/);
    await expect(page.locator('.living-hall__tracePanel')).toBeVisible();
    await expect(page.locator('.detail--visitor')).toHaveCount(0);
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

    await expect(page.locator('.living-hall__focusCard')).toBeVisible();
    await expect(page.locator('.detail--visitor')).toHaveCount(0);
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
      const hallSurfaceCount = document.querySelectorAll('.hall-surface').length;
      const hallLens = document.querySelector<HTMLElement>('.hall-surface')?.dataset.hallLens ?? '';
      const health = (window as unknown as { __CIHOF_KIOSK_STATUS__?: KioskHealthForTest }).__CIHOF_KIOSK_STATUS__;
      return { hallLens, hallSurfaceCount, visibleSurfaces, view: health?.currentView ?? '' };
    });

    expect(stableState.view).toBe('living-hall');
    expect(['portraits', 'traces', 'legacies']).toContain(stableState.hallLens);
    expect(stableState.hallSurfaceCount).toBe(1);
    expect(stableState.visibleSurfaces).toContain('.living-hall');
  });

  test('idle reset enters attract mode and touch returns home', async ({ page }) => {
    const deepLink = await readDeepLinkCandidateData(page);
    await page.goto(
      `./?kiosk=1&lens=legacies&timeYear=${deepLink.classYear}&person=${deepLink.id}`,
      { waitUntil: 'domcontentloaded' },
    );
    await page.keyboard.press('Shift');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'legacies');
    await page.keyboard.press('Shift');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', deepLink.id);
    await page.keyboard.press('Shift');
    await expect(page.locator('button.living-portrait').first()).toBeVisible();
    await page.keyboard.press('Shift');
    await dismissLegacyFocusIfOpen(page);
    const hallBox = await page.locator('.living-hall').boundingBox();
    expect(hallBox).toBeTruthy();
    if (!hallBox) throw new Error('Living Hall bounds unavailable.');
    await page.mouse.move(hallBox.x + hallBox.width * 0.72, hallBox.y + hallBox.height * 0.48);
    await page.mouse.down();
    await page.mouse.move(hallBox.x + hallBox.width * 0.28, hallBox.y + hallBox.height * 0.48, { steps: 6 });
    await page.mouse.up();

    const latestClass = await readLatestClassData(page);
    await expect(page.locator('.living-hall--attract')).toBeVisible({ timeout: 6_000 });
    await waitForKioskHealth(page, (snapshot) => snapshot.attractActive === true && snapshot.lastResetReason === 'idle');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'portraits');
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', '');
    await expect(page.locator('.living-hall')).toHaveAttribute('data-trace-focus-key', '');
    await expect(page.locator('.living-hall')).toHaveAttribute('data-legacy-pan', '');
    await expect(page).not.toHaveURL(/lens=traces|lens=legacies|person=|trace=|world=|timeYear=/);
    const latestSequence = page.locator('.latest-class-sequence');
    await expect(latestSequence).toBeVisible({ timeout: 9_000 });
    await expect(latestSequence).toContainText(`Class Of ${latestClass.year}`);

    await page.mouse.click(60, 60);

    await expect(page.locator('.living-hall--attract')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Arrange Hall by portraits' })).toHaveAttribute('aria-pressed', 'true');
    const health = await waitForKioskHealth(page, (snapshot) => snapshot.attractActive === false);
    expect(health.currentView).toBe('living-hall');

    await page.getByRole('button', { name: 'Arrange Hall by induction history' }).click();
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'legacies');
    await expect.poll(() => readLegacyPan(page)).toBe(0);

    await expect(page.locator('.transition-input-guard')).toBeHidden({ timeout: 2_500 });
    await page.getByRole('button', { name: 'Arrange Hall by documented places and connections' }).click();
    await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', 'traces');
    await expect(page.locator('.living-hall')).toHaveAttribute('data-trace-focus-key', '');
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

async function dismissLegacyFocusIfOpen(page: Page) {
  const dialog = page.getByRole('dialog', { name: /cohort navigator/i });
  if (await dialog.isVisible().catch(() => false)) {
    await dismissLegacyFocus(page);
  }
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
  if (!candidate || typeof candidate.classYear !== 'number') throw new Error('No deep-link candidate with class year and country tag found.');
  const country = (candidate.countryTags ?? []).find((tag) => tag && tag !== 'United States') ?? '';
  if (!country) throw new Error('No presentation country tag found for deep-link candidate.');
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

async function exerciseAnchoredStoryAndQr(page: Page, lens: string, personId: string, includeQr = false) {
  await page.getByRole('button', { name: 'LIFE + WORK' }).click();
  await expect(page.locator('.living-hall__personActionPanel .story-mode')).toBeVisible();
  await expect(page.locator('.living-hall')).toBeVisible();
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', lens);
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', personId);
  await expect(page.locator('.detail--visitor:not(.living-hall__personActionPanel)')).toHaveCount(0);
  await page.locator('.living-hall__personActionHeader button').click();
  await expect(page.locator('.living-hall__personActionPanel')).toHaveCount(0);
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', lens);
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', personId);

  if (!includeQr) return;

  await page.getByRole('button', { name: 'TAKE IT WITH YOU' }).click();
  await expect(page.locator('.living-hall__personActionPanel .qr-continuation')).toBeVisible();
  await expect(page.locator('.living-hall')).toBeVisible();
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', lens);
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', personId);
  await expect(page.locator('.living-hall__personActionPanel')).toHaveCount(0, { timeout: 7_000 });
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-hall-lens', lens);
  await expect(page.locator('.hall-surface')).toHaveAttribute('data-focused-person-id', personId);
}

async function expectPortraitActionsHidden(page: Page) {
  for (const name of ['FOLLOW THE TRACE →', 'LIFE + WORK', 'FULL TEXT', 'WATCH INDUCTION', 'TAKE IT WITH YOU', 'SAVE TO VISIT']) {
    await expect(page.getByRole('button', { name })).toHaveCount(0);
  }
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
    prompt: typeof config.prompt === 'string' && config.prompt.trim() ? config.prompt : 'WHAT DO WE BUILD TOGETHER?',
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

async function openTraceChooser(page: Page) {
  const chooser = page.locator('.living-hall__traceContextButton');
  await expect(chooser).toBeVisible();
  await chooser.click();
  await expect(page.locator('.living-hall__traceControl').first()).toBeVisible();
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
