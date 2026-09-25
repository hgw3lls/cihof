import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page, type Route } from '@playwright/test';
import { begin } from './visit.ts';

/**
 * Film playback, exercised with a synthetic fixture.
 *
 * No real film is publishable: all 93 holdings are withheld on rights,
 * captions and transcript. Testing against a fixture is what lets the player be
 * finished and verified before a reviewer clears anything, and the fixture is
 * injected per test so it can never reach an artifact.
 */
const fixtureRoot = fileURLToPath(new URL('./fixtures/media', import.meta.url));
const person = 'alex-machaskee-2010';

const fixtureFilm = {
  id: 'fixture-film',
  source: { kind: 'local-file', src: '/media/videos/__fixture__/chronology-test.mp4' },
  poster: '/media/videos/__fixture__/chronology-test.png',
  captions: '/media/videos/__fixture__/chronology-test.en.vtt',
  transcript: '/media/videos/__fixture__/chronology-test.transcript.txt',
  durationSeconds: 4,
};

/**
 * Serves a file the way the display's own server does (apps/exhibit/kiosk/
 * server.mjs), answering byte ranges. Without them a browser cannot seek in
 * the film, which is what a start time and "Back 10 s" both do.
 */
async function fulfillWithRanges(route: Route, path: string, contentType: string) {
  const body = readFileSync(path);
  const range = /^bytes=(\d*)-(\d*)$/.exec(route.request().headers()['range'] ?? '');
  if (!range) {
    return route.fulfill({ status: 200, contentType, body, headers: { 'Accept-Ranges': 'bytes' } });
  }
  const start = range[1] ? Number(range[1]) : Math.max(0, body.length - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
  return route.fulfill({
    status: 206,
    contentType,
    body: body.subarray(start, end + 1),
    headers: { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${body.length}` },
  });
}

async function withFixtureFilm(page: Page, failures: { video?: boolean; transcript?: boolean } = {}, film: object = fixtureFilm) {
  await page.route('**/data/exhibit.json', async (route) => {
    const bundle = await (await route.fetch()).json();
    await route.fulfill({
      json: {
        ...bundle,
        people: bundle.people.map((entry: { id: string }) =>
          entry.id === person ? { ...entry, films: [film] } : entry),
      },
    });
  });

  await page.route('**/__fixture__/chronology-test.mp4', (route) => failures.video
    ? route.fulfill({ status: 500, contentType: 'text/plain', body: 'unavailable' })
    : fulfillWithRanges(route, `${fixtureRoot}/chronology-test.mp4`, 'video/mp4'));
  await page.route('**/__fixture__/chronology-test.png', (route) =>
    route.fulfill({ path: `${fixtureRoot}/chronology-test.png`, contentType: 'image/png' }));
  await page.route('**/__fixture__/chronology-test.en.vtt', (route) =>
    route.fulfill({ path: `${fixtureRoot}/chronology-test.en.vtt`, contentType: 'text/vtt' }));
  await page.route('**/__fixture__/chronology-test.transcript.txt', (route) => failures.transcript
    ? route.fulfill({ status: 500, contentType: 'text/plain', body: 'unavailable' })
    : route.fulfill({ path: `${fixtureRoot}/chronology-test.transcript.txt`, contentType: 'text/plain' }));
}

async function openFilm(page: Page) {
  await begin(page);
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

test('every published film carries the things that make it usable', async ({ page }) => {
  // This replaces an assertion that no film was published at all, which was
  // true until the rights, captions and transcripts were cleared. The rule it
  // was really protecting survives: nothing reaches a visitor without the
  // captions and transcript that let everyone follow it.
  await page.goto('.');
  const published = await page.evaluate(async () => {
    const bundle = await (await fetch('data/exhibit.json')).json();
    const films: Record<string, unknown>[] = bundle.people
      .flatMap((person: { films: Record<string, unknown>[] }) => person.films);
    return {
      count: films.length,
      held: bundle.filmReport.held,
      withoutCaptions: films.filter((film) => !film['captions']).length,
      withoutTranscript: films.filter((film) => !film['transcript']).length,
      withoutPoster: films.filter((film) => !film['poster']).length,
      withoutSource: films.filter((film) => !film['source']).length,
    };
  });

  expect(published.count, 'the cleared holdings are published').toBe(93);
  expect(published.held, 'and nothing is left withheld').toBe(0);
  expect(published.withoutCaptions).toBe(0);
  expect(published.withoutTranscript).toBe(0);
  expect(published.withoutPoster).toBe(0);
  expect(published.withoutSource).toBe(0);
});

test('a film served from the channel plays there and says whose captions those are', async ({ page }) => {
  // The public build has no local MP4 to serve, so it publishes the embed.
  // An iframe cannot be given our reviewed caption track, and the visitor is
  // told so rather than left to assume the captions were checked.
  await page.route('**/data/exhibit.json', async (route) => {
    const bundle = await (await route.fetch()).json();
    await route.fulfill({
      json: {
        ...bundle,
        people: bundle.people.map((entry: { id: string }) => entry.id === person
          ? { ...entry, films: [{ ...fixtureFilm, source: { kind: 'youtube', videoId: 'abc123', embedUrl: 'https://www.youtube-nocookie.com/embed/abc123' } }] }
          : entry),
      },
    });
  });
  await page.route('**/__fixture__/chronology-test.transcript.txt', (route) =>
    route.fulfill({ path: `${fixtureRoot}/chronology-test.transcript.txt`, contentType: 'text/plain' }));
  await page.route('https://www.youtube-nocookie.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>stand-in for the channel player</p>' }));

  await openFilm(page);
  const frame = page.locator('.film__embed iframe');
  await expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/abc123');
  await expect(page.locator('.film__note')).toContainText('own captions');
  await expect(page.locator('.film video')).toHaveCount(0);
  await expect(page.locator('.film__transcript')).toContainText('chronology');
});

test('a film with no usable source falls through to the words', async ({ page }) => {
  await page.route('**/data/exhibit.json', async (route) => {
    const bundle = await (await route.fetch()).json();
    await route.fulfill({
      json: {
        ...bundle,
        people: bundle.people.map((entry: { id: string }) => entry.id === person
          ? { ...entry, films: [{ ...fixtureFilm, source: { kind: 'local-file', src: '' } }] }
          : entry),
      },
    });
  });
  await page.route('**/__fixture__/chronology-test.transcript.txt', (route) =>
    route.fulfill({ path: `${fixtureRoot}/chronology-test.transcript.txt`, contentType: 'text/plain' }));

  await openFilm(page);
  await expect(page.locator('.film__problem')).toBeVisible();
  await expect(page.locator('.film__transcript')).toContainText('chronology');
});

test('a ceremony film opens at the chosen person\'s part, and can go back to the beginning', async ({ page }) => {
  await withFixtureFilm(page, {}, { ...fixtureFilm, startSeconds: 2 });
  await openFilm(page);
  await expect(page.locator('.film__header span')).toHaveText('Film · from their part of the ceremony');
  const video = page.locator('.film video');
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeGreaterThanOrEqual(2);
  await page.getByRole('button', { name: 'From the beginning' }).click();
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeLessThan(1);
});

test('a film with no start opens at the beginning and offers no "from the beginning"', async ({ page }) => {
  await withFixtureFilm(page);
  await openFilm(page);
  await expect(page.locator('.film__header span')).toHaveText('Film');
  await expect(page.getByRole('button', { name: 'From the beginning' })).toHaveCount(0);
});
