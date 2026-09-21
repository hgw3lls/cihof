import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filmShortfalls, publishableFilms, youtubeEmbedUrl } from '../src/index.ts';

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

test('a film served from YouTube still has to clear captions and rights', () => {
  // The only thing delivery changes is where the picture comes from. Whether
  // the film may be shown, and whether everyone can follow it, is untouched.
  assert.deepEqual(filmShortfalls({ ...cleared, captionStatus: 'needs-review' }, 'kiosk', 'youtube'), ['captions']);
  assert.deepEqual(filmShortfalls({ ...cleared, rightsStatus: 'needs-review' }, 'kiosk', 'youtube'), ['rights']);
  assert.deepEqual(filmShortfalls({ ...cleared, transcriptRuntimePath: '' }, 'kiosk', 'youtube'), ['transcript']);
});

test('a missing local file is no obstacle on YouTube, and a missing id is', () => {
  // The 41 GB of MP4 is not in the repository, so this is the state of every
  // film on a fresh checkout.
  const noFile = { ...cleared, runtimePath: '' };
  assert.deepEqual(filmShortfalls(noFile, 'kiosk', 'local-file'), ['file']);
  assert.deepEqual(filmShortfalls(noFile, 'kiosk', 'youtube'), []);
  assert.deepEqual(filmShortfalls({ ...cleared, youtubeVideoId: '' }, 'kiosk', 'youtube'), ['file']);
});

test('each delivery publishes the source it can actually play', () => {
  const local = publishableFilms([cleared], 'kiosk', 'local-file')[0]!;
  assert.deepEqual(local.source, { kind: 'local-file', src: '/media/videos/x/film.mp4' });

  const remote = publishableFilms([cleared], 'kiosk', 'youtube')[0]!;
  assert.deepEqual(remote.source, {
    kind: 'youtube',
    videoId: 'abc123',
    embedUrl: 'https://www.youtube-nocookie.com/embed/abc123',
  });
  assert.equal(remote.captions, local.captions, 'the reviewed captions travel either way');
  assert.equal(remote.transcript, local.transcript);
});

test('the embed is the no-cookie player and the id is escaped', () => {
  assert.equal(youtubeEmbedUrl('abc'), 'https://www.youtube-nocookie.com/embed/abc');
  assert.ok(!youtubeEmbedUrl('abc').includes('//www.youtube.com'), 'no tracking-cookie host');
  assert.equal(youtubeEmbedUrl('a/../b?x=1'), 'https://www.youtube-nocookie.com/embed/a%2F..%2Fb%3Fx%3D1');
});

test('local-file remains the default when nobody chooses', () => {
  // A kiosk that silently needed the network would be the worst failure here.
  assert.deepEqual(publishableFilms([cleared], 'kiosk')[0]!.source, { kind: 'local-file', src: '/media/videos/x/film.mp4' });
  assert.deepEqual(filmShortfalls({ ...cleared, runtimePath: '' }, 'kiosk'), ['file']);
});
