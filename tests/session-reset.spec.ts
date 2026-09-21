import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'node:path';

const idleTimeoutMs = 15_000;
const warningMs = 3_000;
const warningDelayMs = idleTimeoutMs - warningMs + 100;
const fixtureRoot = resolve('tests/fixtures/media');

test.use({ serviceWorkers: 'block' });

async function bootSession(page: Page, path: string, colorMode: 'light' | 'dark' = 'light') {
  await page.clock.install({ time: new Date('2026-09-20T12:00:00Z') });
  await page.addInitScript(({ idle, warning, color }) => {
    window.localStorage.setItem('cihof.kiosk-settings.v1', JSON.stringify({ idleTimeoutMs: idle, idleWarningMs: warning }));
    window.localStorage.setItem('cihof-color-mode', color);
    window.addEventListener('cihof:session-reset', () => {
      const count = Number(window.sessionStorage.getItem('mg02-reset-count') ?? 0);
      window.sessionStorage.setItem('mg02-reset-count', String(count + 1));
    });
  }, { idle: idleTimeoutMs, warning: warningMs, color: colorMode });
  const runtimeReady = page.waitForResponse((response) => response.url().endsWith('/data/cihof-runtime-data.json') && response.ok());
  await page.goto(path);
  await runtimeReady;
  await expect(page.locator('.installation')).toBeVisible();
  await expect(page.locator('.load-message')).toHaveCount(0);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
}

async function showIdleWarning(page: Page) {
  await page.clock.fastForward(warningDelayMs);
  await expect(page.getByRole('region', { name: 'STILL EXPLORING?' })).toBeVisible();
}

async function finishIdleReset(page: Page) {
  await page.clock.fastForward(warningMs + 100);
  await page.clock.runFor(20);
  await expect(page.locator('.installation')).toHaveAttribute('data-session-warning', 'inactive');
}

async function resetCount(page: Page) {
  return page.evaluate(() => Number(window.sessionStorage.getItem('mg02-reset-count') ?? 0));
}

async function approveFixtureFilm(page: Page) {
  await page.route('**/media/videos/__mg03__/chronology-test.mp4', (route) => route.fulfill({ path: resolve(fixtureRoot, 'chronology-test.mp4'), contentType: 'video/mp4' }));
  await page.route('**/media/videos/__mg03__/chronology-test.png', (route) => route.fulfill({ path: resolve(fixtureRoot, 'chronology-test.png'), contentType: 'image/png' }));
  await page.route('**/media/videos/__mg03__/chronology-test.en.vtt', (route) => route.fulfill({ path: resolve(fixtureRoot, 'chronology-test.en.vtt'), contentType: 'text/vtt' }));
  await page.route('**/media/videos/__mg03__/chronology-test.transcript.txt', (route) => route.fulfill({ path: resolve(fixtureRoot, 'chronology-test.transcript.txt'), contentType: 'text/plain' }));
  await page.route('**/data/cihof-runtime-data.json', async (route) => {
    const response = await route.fetch();
    const bundle = await response.json();
    bundle.mediaManifest.assets['bishop-anthony-pilla-2015'].videos = [{
      runtimePath: '/media/videos/__mg03__/chronology-test.mp4',
      posterRuntimePath: '/media/videos/__mg03__/chronology-test.png',
      captionRuntimePath: '/media/videos/__mg03__/chronology-test.en.vtt',
      transcriptRuntimePath: '/media/videos/__mg03__/chronology-test.transcript.txt',
      durationSeconds: 3,
      rightsStatus: 'approved',
      captionStatus: 'approved',
      transcriptStatus: 'approved',
      approvedForKiosk: true,
      approvedForPublicWeb: true,
    }];
    await route.fulfill({ response, json: bundle });
  });
}

async function openFixtureFilm(page: Page) {
  await page.getByRole('button', { name: 'YEARS', exact: true }).click();
  await page.getByRole('button', { name: /Jump to 2015 induction class/ }).click();
  await page.getByRole('button', { name: /Watch film 1 for Bishop Anthony Pilla/ }).click();
  await expect(page.locator('.film-projection video')).toHaveCount(1);
}

async function dispatchMediaEvent(page: Page, type: 'play' | 'pause' | 'ended' | 'timeupdate', currentTime?: number) {
  await page.locator('.film-projection video').evaluate((media, event) => {
    if (event.currentTime !== undefined) {
      Object.defineProperty(media, 'currentTime', { configurable: true, value: event.currentTime });
    }
    media.dispatchEvent(new Event(event.type));
  }, { type, currentTime });
}

for (const action of ['replay', 'backward seek'] as const) {
  test(`${action} continues to count progressing playback as kiosk activity`, async ({ page }) => {
    await approveFixtureFilm(page);
    await bootSession(page, './?kiosk=1');
    await openFixtureFilm(page);
    await dispatchMediaEvent(page, 'play');
    await dispatchMediaEvent(page, 'timeupdate', 600);
    if (action === 'replay') {
      await dispatchMediaEvent(page, 'ended');
      await dispatchMediaEvent(page, 'play');
    }
    for (let second = 1; second <= 4; second += 1) {
      await dispatchMediaEvent(page, 'timeupdate', second);
      await page.clock.fastForward(10_000);
      await expect(page.locator('.film-projection video')).toHaveCount(1);
      await expect(page.locator('.installation')).toHaveAttribute('data-session-warning', 'inactive');
    }
    // Repeated timestamps still represent a stall, not continuing activity.
    await dispatchMediaEvent(page, 'timeupdate', 4);
    await page.clock.fastForward(6_000);
    await expect(page.locator('.film-projection video')).toHaveCount(0);
    expect(await resetCount(page)).toBe(1);
  });
}

test('public companion reading and QR do not inherit kiosk inactivity timing', async ({ page }) => {
  await bootSession(page, './?person=alex-machaskee-2010');
  await expect(page.locator('.installation')).toHaveAttribute('data-session-mode', 'public');
  await page.getByRole('searchbox', { name: 'Find a person or year' }).fill('Alex Machaskee');
  await page.getByRole('button', { name: 'Open full record for Alex Machaskee' }).click();
  await page.getByRole('button', { name: 'TAKE THIS RECORD' }).click();
  await expect(page.getByRole('dialog', { name: 'Take Alex Machaskee record with you' })).toBeVisible();

  await page.clock.fastForward(60_000);

  await expect(page.getByRole('dialog', { name: 'Take Alex Machaskee record with you' })).toBeVisible();
  await expect(page.locator('.installation')).toHaveAttribute('data-selection', 'person');
  await expect(page.locator('.installation')).toHaveAttribute('data-session-warning', 'inactive');
  expect(await resetCount(page)).toBe(0);
});

test('kiosk warning supports ten extensions without changing QR, query, focus, URL, settings, or theme', async ({ page }) => {
  await bootSession(page, './?kiosk=1&person=alex-machaskee-2010', 'dark');
  const settingsBefore = await page.evaluate(() => window.localStorage.getItem('cihof.kiosk-settings.v1'));
  await page.getByRole('searchbox', { name: 'Find a person or year' }).fill('Alex Machaskee');
  await page.getByRole('button', { name: 'Open full record for Alex Machaskee' }).click();
  await page.getByRole('button', { name: 'TAKE THIS RECORD' }).click();
  const qrClose = page.getByRole('button', { name: 'Return To Portrait' });
  await expect(qrClose).toBeFocused();

  await showIdleWarning(page);
  await page.locator('.archive-qr').dispatchEvent('scroll');
  await expect(page.locator('.installation')).toHaveAttribute('data-session-warning', 'inactive');
  await expect(page.locator('.installation')).toHaveAttribute('data-session-extensions', '0');
  await expect(qrClose).toBeFocused();

  for (let extension = 1; extension <= 10; extension += 1) {
    await showIdleWarning(page);
    await expect(page.getByText('This kiosk will start over in 3 seconds.')).toBeVisible();
    await expect(qrClose).toBeFocused();
    const keepExploring = page.getByRole('button', { name: 'KEEP EXPLORING' });
    const resetBox = await page.locator('.qr-reset').boundingBox();
    const warningBox = await page.locator('.session-warning__panel').boundingBox();
    expect(warningBox!.y).toBeGreaterThanOrEqual(resetBox!.y + resetBox!.height);
    if (extension === 1) {
      await keepExploring.focus();
      await page.keyboard.press('Enter');
    } else {
      await keepExploring.click();
    }
    await page.clock.runFor(20);
    await expect(page.locator('.installation')).toHaveAttribute('data-session-extensions', String(extension));
    await expect(page.getByRole('dialog', { name: 'Take Alex Machaskee record with you' })).toBeVisible();
    await expect(qrClose).toBeFocused();
    expect(new URL(page.url()).searchParams.get('person')).toBe('alex-machaskee-2010');
  }

  await qrClose.click();
  await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: 'Find a person or year' })).toHaveValue('Alex Machaskee');
  await expect(page.locator('.installation')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => window.localStorage.getItem('cihof.kiosk-settings.v1'))).toBe(settingsBefore);
  expect(await resetCount(page)).toBe(0);
});

test('Start over clears a QR, no-results search, sort, scroll, and URL in the same scene and is repeatable', async ({ page }) => {
  await bootSession(page, './?kiosk=1&person=alex-machaskee-2010', 'dark');
  const settingsBefore = await page.evaluate(() => window.localStorage.getItem('cihof.kiosk-settings.v1'));
  await page.getByRole('combobox', { name: 'Sort people' }).selectOption('earliest');
  await page.getByRole('searchbox', { name: 'Find a person or year' }).fill('2010');
  await page.locator('.field__content').evaluate((element) => { element.scrollTop = 500; });
  await page.getByRole('button', { name: 'Open full record for Alex Machaskee' }).click();
  await page.getByRole('button', { name: 'TAKE THIS RECORD' }).click();
  await expect(page.getByRole('dialog', { name: 'Take Alex Machaskee record with you' })).toBeVisible();

  await page.getByRole('dialog').getByRole('button', { name: 'START OVER', exact: true }).click();
  await page.clock.runFor(20);

  await expect(page.locator('.installation')).toHaveAttribute('data-view', 'people');
  await expect(page.locator('.installation')).toHaveAttribute('data-selection', 'none');
  await expect(page.locator('.installation')).toHaveAttribute('data-record', 'closed');
  await expect(page.locator('.installation')).toHaveAttribute('data-media', 'closed');
  await expect(page.getByRole('dialog', { name: 'Take Alex Machaskee record with you' })).toHaveCount(0);
  await expect(page.getByRole('searchbox', { name: 'Find a person or year' })).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Sort people' })).toHaveValue('name');
  await expect(page.getByRole('heading', { name: 'Choose a person' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'START OVER', exact: true })).toBeFocused();
  expect(await page.locator('.field__content').evaluate((element) => element.scrollTop)).toBe(0);
  expect(new URL(page.url()).search).toBe('?kiosk=1');
  await expect(page.locator('.installation')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => window.localStorage.getItem('cihof.kiosk-settings.v1'))).toBe(settingsBefore);
  expect(await resetCount(page)).toBe(1);

  await page.getByRole('searchbox', { name: 'Find a person or year' }).fill('No such inductee');
  await expect(page.getByText('NO MATCHING PEOPLE')).toBeVisible();
  await page.getByRole('button', { name: 'START OVER', exact: true }).click();
  await page.clock.runFor(20);
  await expect(page.getByRole('searchbox', { name: 'Find a person or year' })).toHaveValue('');
  await page.getByRole('button', { name: 'START OVER', exact: true }).click();
  await page.clock.runFor(20);
  await expect(page.locator('.installation')).toHaveAttribute('data-session-version', '3');
  expect(await resetCount(page)).toBe(3);
});

test('idle reset reaches the same fresh baseline once per session after reload', async ({ page }) => {
  await bootSession(page, './?kiosk=1&scene=links');
  await page.getByRole('searchbox', { name: 'Find a person in the relationship index' }).fill('No such person');
  await showIdleWarning(page);
  await finishIdleReset(page);

  await expect(page.locator('.installation')).toHaveAttribute('data-view', 'people');
  await expect(page.locator('.installation')).toHaveAttribute('data-selection', 'none');
  await expect(page.getByRole('heading', { name: 'Choose a person' })).toBeVisible();
  expect(new URL(page.url()).search).toBe('?kiosk=1');
  expect(await resetCount(page)).toBe(1);

  await page.reload();
  await expect(page.locator('.person-tile')).toHaveCount(111);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
  await showIdleWarning(page);
  await finishIdleReset(page);
  expect(await resetCount(page)).toBe(2);
});

test('only progressing video extends a kiosk session; paused, stalled, and ended video reset', async ({ page }) => {
  await approveFixtureFilm(page);
  await bootSession(page, './?kiosk=1');
  await openFixtureFilm(page);
  await dispatchMediaEvent(page, 'play');

  for (let second = 1; second <= 4; second += 1) {
    await dispatchMediaEvent(page, 'timeupdate', second);
    await page.clock.fastForward(10_000);
    await expect(page.locator('.film-projection video')).toHaveCount(1);
    await expect(page.locator('.installation')).toHaveAttribute('data-session-warning', 'inactive');
  }

  await dispatchMediaEvent(page, 'timeupdate', 5);
  await dispatchMediaEvent(page, 'pause');
  await showIdleWarning(page);
  await expect(page.locator('.film-projection video')).toHaveCount(1);
  await finishIdleReset(page);
  await expect(page.locator('.installation')).toHaveAttribute('data-media', 'closed');

  await openFixtureFilm(page);
  await dispatchMediaEvent(page, 'play');
  await showIdleWarning(page);
  await finishIdleReset(page);

  await openFixtureFilm(page);
  await dispatchMediaEvent(page, 'play');
  await dispatchMediaEvent(page, 'timeupdate', 1);
  await dispatchMediaEvent(page, 'ended');
  await showIdleWarning(page);
  await finishIdleReset(page);

  expect(await resetCount(page)).toBe(3);
  await expect(page.locator('.installation')).toHaveAttribute('data-view', 'people');
  await expect(page.locator('.installation')).toHaveAttribute('data-selection', 'none');
});
