import { expect, test, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const personId = 'bishop-anthony-pilla-2015';
const fixtureRoot = resolve('tests/fixtures/media');
const fixtureBase = '/media/videos/__mg03__';

test.use({ serviceWorkers: 'block' });

type VideoOverrides = Record<string, unknown>;

function readyVideo(overrides: VideoOverrides = {}) {
  return {
    runtimePath: `${fixtureBase}/chronology-test.mp4`,
    posterRuntimePath: `${fixtureBase}/chronology-test.png`,
    captionRuntimePath: `${fixtureBase}/chronology-test.en.vtt`,
    transcriptRuntimePath: `${fixtureBase}/chronology-test.transcript.txt`,
    durationSeconds: 3,
    rightsStatus: 'approved',
    captionStatus: 'approved',
    transcriptStatus: 'approved',
    approvedForKiosk: true,
    approvedForPublicWeb: true,
    ...overrides,
  };
}

async function routeBundle(page: Page, mutate: (bundle: any) => void) {
  await page.route('**/data/cihof-runtime-data.json', async (route) => {
    const response = await route.fetch();
    const bundle = await response.json();
    mutate(bundle);
    await route.fulfill({ response, json: bundle });
  });
}

async function routeFixtureMedia(page: Page, failures: { video?: boolean; captions?: boolean; transcript?: boolean } = {}) {
  await page.route(`**${fixtureBase}/chronology-test.mp4`, (route) => failures.video
    ? route.fulfill({ status: 500, contentType: 'text/plain', body: 'fixture video unavailable' })
    : route.fulfill({ path: resolve(fixtureRoot, 'chronology-test.mp4'), contentType: 'video/mp4' }));
  await page.route(`**${fixtureBase}/chronology-test.png`, (route) => route.fulfill({ path: resolve(fixtureRoot, 'chronology-test.png'), contentType: 'image/png' }));
  await page.route(`**${fixtureBase}/chronology-test.en.vtt`, (route) => failures.captions
    ? route.fulfill({ status: 500, contentType: 'text/plain', body: 'fixture captions unavailable' })
    : route.fulfill({ path: resolve(fixtureRoot, 'chronology-test.en.vtt'), contentType: 'text/vtt' }));
  await page.route(`**${fixtureBase}/chronology-test.transcript.txt`, (route) => failures.transcript
    ? route.fulfill({ status: 500, contentType: 'text/plain', body: 'fixture transcript unavailable' })
    : route.fulfill({ path: resolve(fixtureRoot, 'chronology-test.transcript.txt'), contentType: 'text/plain' }));
}

async function bootYears(page: Page) {
  await page.goto('./');
  await expect(page.locator('.person-tile')).toHaveCount(111);
  await page.getByRole('button', { name: 'YEARS', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Induction class chronology' })).toBeVisible();
}

async function openFixtureFilm(page: Page) {
  await page.getByRole('button', { name: /Jump to 2015 induction class/ }).click();
  const trigger = page.getByRole('button', { name: /Watch film 1 for Bishop Anthony Pilla/ });
  await trigger.click();
  await expect(page.locator('.film-projection video')).toHaveCount(1);
  return trigger;
}

test('record return preserves the browsed year independently of the selected person', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./?person=alex-machaskee-2010&scene=years');
  const viewport = page.locator('.film-line__viewport');
  await page.getByRole('button', { name: /Jump to 2026 induction class/ }).click();
  const before = await viewport.evaluate((element) => element.scrollLeft);
  expect(before).toBeGreaterThan(1000);
  for (let visit = 0; visit < 2; visit += 1) {
    await page.locator('#selectedPersonRailRecordButton').click();
    await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
    await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBe(before);
    await expect(page.locator('#selectedPersonRailRecordButton')).toBeFocused();
  }
  await page.getByRole('button', { name: 'START OVER', exact: true }).click();
  await page.getByRole('button', { name: 'YEARS', exact: true }).click();
  await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBe(0);
});

test('Years remains complete with zero films and represents an unknown induction year honestly', async ({ page }) => {
  await routeBundle(page, (bundle) => {
    for (const record of Object.values<any>(bundle.mediaManifest.assets)) record.videos = [];
    bundle.inductees.find((person: any) => person.id === 'alex-machaskee-2010').classYear = null;
  });
  await bootYears(page);

  await expect(page.locator('.year-person')).toHaveCount(111);
  await expect(page.getByRole('button', { name: /Watch film/i })).toHaveCount(0);
  await page.getByRole('button', { name: /Jump to records with no induction year, 1 people/ }).click();
  await expect(page.getByRole('heading', { name: 'YEAR NOT RECORDED' })).toBeVisible();
  const alex = page.getByRole('button', { name: 'Select Alex Machaskee, induction year not recorded' });
  await alex.focus();
  await page.keyboard.press('Enter');
  await expect(alex).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#year-record-alex-machaskee-2010').click();
  await expect(page.getByRole('region', { name: 'Alex Machaskee full record' })).toContainText('Year not recorded');
});

test('pending, onsite-only, and incomplete films stay hidden while a web-approved film remains optional', async ({ page }) => {
  await routeBundle(page, (bundle) => {
    bundle.mediaManifest.assets[personId].videos = [
      readyVideo({ rightsStatus: 'needs-review', approvedForPublicWeb: undefined }),
      readyVideo({ approvedForPublicWeb: undefined }),
      readyVideo(),
      readyVideo({ captionRuntimePath: undefined }),
      readyVideo({ transcriptStatus: 'needs-review' }),
    ];
  });
  await bootYears(page);
  await page.getByRole('button', { name: /Jump to 2015 induction class/ }).click();

  await expect(page.locator('.year-person')).toHaveCount(111);
  await expect(page.getByRole('button', { name: /Watch film 3 for Bishop Anthony Pilla/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Watch film [1245] for Bishop Anthony Pilla/ })).toHaveCount(0);
  await expect(page.getByText(/awaiting approval|not yet on view/i)).toHaveCount(0);
  await expect(page.locator('#year-record-alex-machaskee-2010')).toBeAttached();
});

test('the synthetic film decodes, progresses, seeks, replays, loads captions, and preserves the full transcript', async ({ page }) => {
  await routeFixtureMedia(page);
  await routeBundle(page, (bundle) => { bundle.mediaManifest.assets[personId].videos = [readyVideo()]; });
  await bootYears(page);
  const trigger = await openFixtureFilm(page);
  const video = page.locator('.film-projection video');

  await expect(page.locator('.film-projection__identity h2')).toBeFocused();
  await expect.poll(() => video.evaluate((media) => media.readyState)).toBeGreaterThanOrEqual(1);
  await expect.poll(() => video.evaluate((media) => media.textTracks[0]?.cues?.length ?? 0)).toBe(2);
  await expect(page.locator('.film-projection__transcript-body')).toContainText('This final sentence verifies that the complete transcript is preserved.');

  await page.locator('.film-projection__header').getByRole('button', { name: 'PLAY', exact: true }).click();
  await expect.poll(() => video.evaluate((media) => media.currentTime)).toBeGreaterThan(0.15);
  await video.evaluate((media) => { media.currentTime = 2.5; });
  await expect.poll(() => video.evaluate((media) => media.currentTime)).toBeGreaterThan(2.45);
  await expect(page.locator('.film-projection__header').getByRole('button', { name: 'REPLAY', exact: true })).toBeVisible({ timeout: 5_000 });
  await page.locator('.film-projection__header').getByRole('button', { name: 'REPLAY', exact: true }).click();
  await expect.poll(() => video.evaluate((media) => media.currentTime)).toBeGreaterThan(0.05);

  await page.getByRole('button', { name: 'Close film', exact: true }).click();
  await expect(trigger).toBeFocused();
});

test('caption and transcript load failures stay visible and independently retryable', async ({ page }) => {
  let transcriptRequests = 0;
  await routeFixtureMedia(page, { captions: true, transcript: true });
  await page.on('request', (request) => { if (request.url().endsWith('chronology-test.transcript.txt')) transcriptRequests += 1; });
  await routeBundle(page, (bundle) => { bundle.mediaManifest.assets[personId].videos = [readyVideo()]; });
  await bootYears(page);
  await openFixtureFilm(page);

  await expect(page.getByText('CAPTIONS COULD NOT LOAD. THE TRANSCRIPT REMAINS AVAILABLE.')).toBeVisible();
  await expect(page.getByText('TRANSCRIPT COULD NOT LOAD')).toBeVisible();
  await page.getByRole('button', { name: 'RETRY TRANSCRIPT' }).click();
  await expect.poll(() => transcriptRequests).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'RETRY CAPTIONS' }).click();
  await expect(page.getByText('CAPTIONS COULD NOT LOAD. THE TRANSCRIPT REMAINS AVAILABLE.')).toBeVisible();
});

test('a network video failure offers retry and a usable return to the associated record', async ({ page }) => {
  await routeFixtureMedia(page, { video: true });
  await routeBundle(page, (bundle) => { bundle.mediaManifest.assets[personId].videos = [readyVideo()]; });
  await bootYears(page);
  await openFixtureFilm(page);

  await expect(page.getByText('FILM UNAVAILABLE')).toBeVisible();
  await expect(page.getByRole('button', { name: 'RETRY FILM' })).toBeVisible();
  await page.getByRole('button', { name: 'OPEN PERSON RECORD' }).click();
  await expect(page.getByRole('region', { name: 'Bishop Anthony Pilla full record' })).toBeVisible();
  await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
  await expect(page.locator('#filmRecordButton')).toBeFocused();
});

test('a rejected play promise becomes a recoverable player state without an unhandled page error', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('Synthetic play rejection', 'NotAllowedError'));
  });
  await routeFixtureMedia(page);
  await routeBundle(page, (bundle) => { bundle.mediaManifest.assets[personId].videos = [readyVideo()]; });
  await bootYears(page);
  await openFixtureFilm(page);
  await page.locator('.film-projection__header').getByRole('button', { name: 'PLAY', exact: true }).click();

  await expect(page.getByText('FILM UNAVAILABLE')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('the public artifact withholds pending media metadata, local paths, and binary sidecars', async ({ request }) => {
  const bundleResponse = await request.get('./data/cihof-runtime-data.json');
  expect(bundleResponse.ok()).toBe(true);
  const bundleText = await bundleResponse.text();
  expect(bundleText).not.toContain('/media/videos/');
  expect(bundleText).not.toContain('"sourceField": "localVideoPaths"');
  expect(bundleText).not.toContain('"sourceField": "youtubeVideoIds"');
  const bundle = JSON.parse(bundleText);
  const videoCount = Object.values<any>(bundle.mediaManifest.assets).reduce((count, record) => count + record.videos.length, 0);
  expect(videoCount).toBe(0);
  expect(bundle.entities.entities.some((entity: any) => entity.attributes?.mediaType === 'video')).toBe(false);
  expect(bundle.entityRelationships.relationships.some((relationship: any) =>
    ['localVideoPaths', 'youtubeVideoIds', 'videoUrls'].includes(relationship.provenance?.sourceField),
  )).toBe(false);
  const bishop = bundle.inductees.find((person: any) => person.id === personId);
  expect(bishop).not.toHaveProperty('localVideoPaths');
  expect(bishop).not.toHaveProperty('videoUrls');
  expect(bishop).not.toHaveProperty('mediaReviewStatus');

  for (const path of ['inductees.json', 'entities.json', 'entity-relationships.json', 'linked-art-export.json', 'cidoc-crm-export.json']) {
    const response = await request.get(`./data/${path}`);
    expect(response.ok(), path).toBe(true);
    const text = await response.text();
    expect(text, path).not.toContain('/media/videos/');
    expect(text, path).not.toContain('"sourceField": "localVideoPaths"');
    expect(text, path).not.toContain('"sourceField": "youtubeVideoIds"');
  }

  const pendingPath = resolve('dist/media/videos/bishop-anthony-pilla-2015/bishop-anthony-pilla-2015_PpXIVZKq49U.mp4');
  expect(existsSync(pendingPath)).toBe(false);
  expect(existsSync(resolve('dist/data/source-curation-packet.json'))).toBe(false);
  const pendingVideo = await request.get('./media/videos/bishop-anthony-pilla-2015/bishop-anthony-pilla-2015_PpXIVZKq49U.mp4');
  expect(pendingVideo.headers()['content-type']).not.toContain('video/');
});
