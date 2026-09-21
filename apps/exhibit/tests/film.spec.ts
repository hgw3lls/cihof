import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * Film playback, exercised with a synthetic fixture.
 *
 * No real film is publishable: all 93 holdings are withheld on rights,
 * captions and transcript. Testing against a fixture is what lets the player be
 * finished and verified before a reviewer clears anything, and the fixture is
 * injected per test so it can never reach an artifact.
 */
const fixtureRoot = resolve('tests/fixtures/media');
const person = 'alex-machaskee-2010';

const fixtureFilm = {
  id: 'fixture-film',
  src: '/media/videos/__fixture__/chronology-test.mp4',
  poster: '/media/videos/__fixture__/chronology-test.png',
  captions: '/media/videos/__fixture__/chronology-test.en.vtt',
  transcript: '/media/videos/__fixture__/chronology-test.transcript.txt',
  durationSeconds: 4,
};

async function withFixtureFilm(page: Page, failures: { video?: boolean; transcript?: boolean } = {}) {
  await page.route('**/data/exhibit.json', async (route) => {
    const bundle = await (await route.fetch()).json();
    await route.fulfill({
      json: {
        ...bundle,
        people: bundle.people.map((entry: { id: string }) =>
          entry.id === person ? { ...entry, films: [fixtureFilm] } : entry),
      },
    });
  });

  await page.route('**/__fixture__/chronology-test.mp4', (route) => failures.video
    ? route.fulfill({ status: 500, contentType: 'text/plain', body: 'unavailable' })
    : route.fulfill({ path: `${fixtureRoot}/chronology-test.mp4`, contentType: 'video/mp4' }));
  await page.route('**/__fixture__/chronology-test.png', (route) =>
    route.fulfill({ path: `${fixtureRoot}/chronology-test.png`, contentType: 'image/png' }));
  await page.route('**/__fixture__/chronology-test.en.vtt', (route) =>
    route.fulfill({ path: `${fixtureRoot}/chronology-test.en.vtt`, contentType: 'text/vtt' }));
  await page.route('**/__fixture__/chronology-test.transcript.txt', (route) => failures.transcript
    ? route.fulfill({ status: 500, contentType: 'text/plain', body: 'unavailable' })
    : route.fulfill({ path: `${fixtureRoot}/chronology-test.transcript.txt`, contentType: 'text/plain' }));
}

async function openFilm(page: Page) {
  await page.goto('.');
  await expect(page.locator('.tile').first()).toBeVisible();
  await page.evaluate(() => {
    const tile = [...document.querySelectorAll('.tile')].find((b) => b.textContent?.includes('Alex Machaskee'));
    (tile as HTMLButtonElement).click();
  });
  await page.getByRole('button', { name: 'Read the record' }).click();
  await page.getByRole('button', { name: 'Watch the film' }).click();
  await expect(page.locator('.film')).toBeVisible();
}

test('a cleared film plays, with captions and a transcript', async ({ page }) => {
  await withFixtureFilm(page);
  await openFilm(page);

  const state = await page.evaluate(async () => {
    const video = document.querySelector('video')!;
    await video.play();
    await new Promise((r) => setTimeout(r, 700));
    return {
      played: video.currentTime > 0,
      paused: video.paused,
      captionTracks: video.textTracks.length,
      captionKind: video.textTracks[0]?.kind,
    };
  });

  expect(state.played, 'the film actually advances').toBe(true);
  expect(state.paused).toBe(false);
  expect(state.captionTracks).toBe(1);
  expect(state.captionKind).toBe('captions');

  // The transcript is present without opening anything.
  await expect(page.locator('.film__transcript p').first()).not.toBeEmpty();
});

test('a film that will not load still gives the visitor the words', async ({ page }) => {
  await withFixtureFilm(page, { video: true });
  await openFilm(page);

  await expect(page.locator('.film__problem').first()).toContainText('could not be played');
  await expect(page.locator('.film__transcript p').first()).not.toBeEmpty();
});

test('a missing transcript is stated rather than left blank', async ({ page }) => {
  await withFixtureFilm(page, { transcript: true });
  await openFilm(page);
  await expect(page.locator('.film__transcript')).toContainText('could not be loaded');
});

test('closing a film stops it and returns focus to the record', async ({ page }) => {
  await withFixtureFilm(page);
  await openFilm(page);
  await page.evaluate(() => document.querySelector('video')!.play());
  await page.getByRole('button', { name: 'Close film' }).click();

  await expect(page.locator('.film')).toHaveCount(0);
  // Audio must not outlive the panel.
  expect(await page.evaluate(() => document.querySelectorAll('video').length)).toBe(0);
  await expect(page.locator('.record')).toBeVisible();
});

test('a paused film does not hold the display open', async ({ page }) => {
  await withFixtureFilm(page);
  await openFilm(page);

  // The test build uses a short idle. A paused film must not defeat it.
  await page.evaluate(async () => {
    const video = document.querySelector('video')!;
    await video.play();
    await new Promise((r) => setTimeout(r, 400));
    video.pause();
  });

  await expect(page.locator('.warning')).toBeVisible({ timeout: 15_000 });
});

test('no real film is published in the artifact', async ({ page }) => {
  await page.goto('.');
  const published = await page.evaluate(async () => {
    const bundle = await (await fetch('data/exhibit.json')).json();
    return {
      films: bundle.people.reduce((n: number, p: { films: unknown[] }) => n + p.films.length, 0),
      held: bundle.filmReport.held,
    };
  });

  expect(published.films, 'every holding is still withheld').toBe(0);
  expect(published.held).toBe(93);
});
