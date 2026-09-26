import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clock, judgeFilm } from '../scripts/film-judge.mjs';

/** What the film check makes of what it saw, one film at a time. */

const good = {
  shown: null, missing: [], width: 1280, duration: 360, openedAt: 0, played: 4, audioBytes: 4096,
  captionsShowing: true, cues: 120, lastCueEnd: 355, transcriptChars: 2400, transcriptProblem: null,
};

test('a film that plays with picture, sound, captions and a transcript passes', () => {
  assert.deepEqual(judgeFilm({ durationSeconds: 361 }, good), []);
});

test('a film the display cannot play says what the display shows, and which file is missing', () => {
  const problems = judgeFilm({ durationSeconds: 360 }, {
    ...good, shown: 'This film could not be played on this display.', missing: ['/media/videos/a/a.mp4'], width: 0, played: 0,
  });
  assert.deepEqual(problems, [
    'The display shows "This film could not be played on this display." instead of the film.',
    'Missing file: /media/videos/a/a.mp4.',
  ]);
});

test('no picture, no movement and no sound are each named', () => {
  const problems = judgeFilm({ durationSeconds: 360 }, { ...good, width: 0, played: 0.2, audioBytes: 0 });
  assert.deepEqual(problems, ['There is no picture.', 'It did not play (it moved 0.2 s).', 'No sound was heard while it played.']);
});

test('a browser that does not report sound is not taken to mean silence', () => {
  assert.deepEqual(judgeFilm({ durationSeconds: 360 }, { ...good, audioBytes: null }), []);
});

test('a film of the wrong length is caught, and a small difference is not', () => {
  assert.deepEqual(judgeFilm({ durationSeconds: 363 }, good), []);
  assert.deepEqual(judgeFilm({ durationSeconds: 6240 }, good), ['It is 6:00 long; the exhibit expects 1:44:00.']);
  assert.deepEqual(judgeFilm({ durationSeconds: 360 }, { ...good, duration: Number.POSITIVE_INFINITY }), ['The video does not say how long it is.']);
});

test('a ceremony film must open at the person’s part', () => {
  assert.deepEqual(judgeFilm({ durationSeconds: 360, startSeconds: 120 }, { ...good, openedAt: 121 }), []);
  assert.deepEqual(judgeFilm({ durationSeconds: 360, startSeconds: 120 }, { ...good, openedAt: 0 }),
    ['It opened at 0:00, not at 2:00, where this person\'s part begins.']);
});

test('captions that are hidden, empty, or longer than the film are caught', () => {
  assert.deepEqual(judgeFilm({ durationSeconds: 360 }, { ...good, captionsShowing: false }), ['Its captions are not shown.']);
  assert.deepEqual(judgeFilm({ durationSeconds: 360 }, { ...good, cues: 0, lastCueEnd: null }), ['Its captions have no lines.']);
  assert.deepEqual(judgeFilm({ durationSeconds: 360 }, { ...good, lastCueEnd: 3725 }),
    ['Its captions run to 1:02:05, past the end of the film at 6:00: they may belong to another film.']);
});

test('a missing or failed transcript is named, whether or not the film played', () => {
  assert.deepEqual(judgeFilm({ durationSeconds: 360 }, { ...good, transcriptChars: 0 }), ['Its transcript is empty.']);
  assert.deepEqual(judgeFilm({}, { ...good, shown: 'x', transcriptProblem: 'The transcript could not be loaded.' }),
    ['The display shows "x" instead of the film.', 'Its transcript: "The transcript could not be loaded."']);
});

test('times read the way the film shows them', () => {
  assert.equal(clock(65), '1:05');
  assert.equal(clock(3756), '1:02:36');
});
