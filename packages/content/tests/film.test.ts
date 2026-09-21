import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filmShortfalls, publishableFilms } from '../src/index.ts';

const cleared = {
  runtimePath: '/media/videos/x/film.mp4',
  posterRuntimePath: '/media/videos/x/film.webp',
  captionRuntimePath: '/media/videos/x/film.en.vtt',
  transcriptRuntimePath: '/media/videos/x/film.transcript.txt',
  captionStatus: 'approved',
  transcriptStatus: 'approved',
  rightsStatus: 'approved',
  approvedForKiosk: true,
  approvedForPublicWeb: false,
  durationSeconds: 825,
  youtubeVideoId: 'abc123',
};

test('a fully cleared film is publishable to the target that approved it', () => {
  assert.deepEqual(filmShortfalls(cleared, 'kiosk'), []);
  assert.deepEqual(publishableFilms([cleared], 'kiosk').map((film) => film.id), ['abc123']);

  assert.deepEqual(filmShortfalls(cleared, 'public'), ['target'], 'kiosk approval is not public approval');
  assert.equal(publishableFilms([cleared], 'public').length, 0);
});

test('a film without approved captions is not published', () => {
  // Not a judgement call: a film nobody deaf can follow is not finished.
  assert.deepEqual(filmShortfalls({ ...cleared, captionStatus: 'needs-review' }, 'kiosk'), ['captions']);
  assert.deepEqual(filmShortfalls({ ...cleared, captionRuntimePath: '' }, 'kiosk'), ['captions']);
  assert.equal(publishableFilms([{ ...cleared, captionStatus: 'needs-review' }], 'kiosk').length, 0);
});

test('a film without an approved transcript is not published', () => {
  assert.deepEqual(filmShortfalls({ ...cleared, transcriptStatus: 'needs-review' }, 'kiosk'), ['transcript']);
  assert.deepEqual(filmShortfalls({ ...cleared, transcriptRuntimePath: '' }, 'kiosk'), ['transcript']);
});

test('rights are required however complete the assets are', () => {
  assert.deepEqual(filmShortfalls({ ...cleared, rightsStatus: 'needs-review' }, 'kiosk'), ['rights']);
  assert.equal(publishableFilms([{ ...cleared, rightsStatus: 'needs-review' }], 'kiosk').length, 0);
});

test('missing assets are each reported, so a report can say what is left to do', () => {
  const bare = { rightsStatus: 'approved', approvedForKiosk: true };
  assert.deepEqual(filmShortfalls(bare, 'kiosk'), ['file', 'poster', 'captions', 'transcript']);
});

test('the collection as it stands publishes no films', () => {
  // All 93 holdings carry needs-review on rights, captions and transcript.
  const holding = { ...cleared, rightsStatus: 'needs-review', captionStatus: 'needs-review', transcriptStatus: 'needs-review', approvedForKiosk: false };
  assert.equal(publishableFilms([holding], 'kiosk').length, 0);
  assert.deepEqual(filmShortfalls(holding, 'kiosk'), ['captions', 'transcript', 'rights', 'target']);
});
