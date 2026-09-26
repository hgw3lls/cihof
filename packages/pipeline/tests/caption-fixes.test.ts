import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captionFixDecisions, filmFiles, fixCaptions, fixText } from '../src/build/caption-fixes.ts';
import { readVideoHoldings } from '../src/sources/media.ts';

/**
 * Corrections to a film's captions and transcript: the same fix to both, and
 * nothing else in either touched.
 */
const music = { filmId: 'F', fix: 'music' as const, replaceWith: '[music]' };

test('music heard as "heat" becomes one [music] per run, or goes', () => {
  assert.equal(fixText("Now it's time to go. Heat. Heat. Heat. Thank you.", music).text, "Now it's time to go. [music] Thank you.");
  assert.equal(fixText('to go. Heat. Heat. Thank you.', { ...music, replaceWith: '' }).text, 'to go. Thank you.');
  assert.equal(fixText('the theater, and theatre', music).count, 0, 'only the word, never inside another');
});

test('a blank-audio mark goes, and a typed correction replaces exactly what was typed', () => {
  assert.equal(fixText('Please welcome Carolyn Varo. [BLANK_AUDIO]\n', { filmId: 'F', fix: 'blank', replaceWith: '' }).text, 'Please welcome Carolyn Varo.\n');
  const phrase = { filmId: 'F', fix: 'phrase' as const, find: 'Carolyn Varo', replaceWith: 'Carolyn Balogh' };
  assert.deepEqual(fixText('Please welcome Carolyn Varo.', phrase), { text: 'Please welcome Carolyn Balogh.', count: 1 });
  assert.equal(fixText('Please welcome carolyn varo.', phrase).count, 0, 'exactly as typed');
});

test('in the captions, only the lines a fix touches change, and every timing stays', () => {
  const vtt = [
    'WEBVTT', 'Kind: captions', 'Language: en', '',
    '00:00:00.240 --> 00:00:19.230 align:start position:0%', ' ', 'Now<00:00:00.400><c> it\'s</c><00:00:00.480><c> time</c>', '',
    '00:00:30.480 --> 00:00:43.910 align:start position:0%', ' ', 'Heat.<00:00:30.560><c> Heat.</c>', '',
  ].join('\n');
  const fixed = fixCaptions(vtt, music);
  assert.equal(fixed.count, 1);
  const before = vtt.split('\n');
  const after = fixed.text.split('\n');
  assert.equal(after.length, before.length);
  assert.deepEqual(after.filter((_, index) => index !== 10), before.filter((_, index) => index !== 10), 'every other line byte for byte');
  assert.equal(after[10], '[music]');
  assert.equal(fixCaptions(vtt, { ...music, replaceWith: '' }).text.split('\n')[10], ' ', 'an emptied line stays a blank caption line');
});

test('a shared ceremony film is corrected in every copy', () => {
  const films = filmFiles(readVideoHoldings());
  assert.equal(films.get('P34omi5XUiY')?.transcripts.length, 6);
  assert.equal(films.get('P34omi5XUiY')?.captions.length, 6);
});

test('a fix sheet refuses what would change nothing, or is not a fix', () => {
  const films = filmFiles(readVideoHoldings());
  const sheet = [
    'filmId,fix,find,replaceWith,decisionReference,note',
    'DoZUzteeFMU,music,,[music],film-captions-review-2026-10-01,',
    'qzHokEDkXQc,phrase,Carolyn Varo,Carolyn Balogh,film-captions-review-2026-10-01,',
    'DoZUzteeFMU,phrase,zebra crossing,x,ref,',
    'DoZUzteeFMU,music,,[noise],ref,',
    'DoZUzteeFMU,subtitles,,,ref,',
    'nope,blank,,,ref,',
    'qzHokEDkXQc,blank,,,,',
  ].join('\n');
  const { decisions, errors } = captionFixDecisions(sheet, films);
  assert.deepEqual(decisions.map((decision) => [decision.filmId, decision.fix]), [['DoZUzteeFMU', 'music'], ['qzHokEDkXQc', 'phrase']]);
  assert.equal(errors.length, 5);
});
