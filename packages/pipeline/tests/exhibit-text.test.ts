import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attractTextVersion, publishedAttractText } from '../src/build/exhibit-text.ts';

const words = { headline: 'A headline.', tagline: 'A tagline.' };
const version = attractTextVersion(words.headline, words.tagline);
const approved = (over: object = {}) => ({
  attract: {
    ...words,
    review: { status: 'approved', decisionReference: 'text-2026-10-01', contentVersion: version },
    publication: { kiosk: true, publicWeb: false },
    ...over,
  },
});

test('approved words for this target are shown', () => {
  assert.deepEqual(publishedAttractText('kiosk', { stored: approved() }).text, words);
});

test('words nobody has approved are held back, so the hall name shows alone', () => {
  const pending = publishedAttractText('kiosk', { stored: { attract: { ...words, review: { status: 'needs-review' } } } });
  assert.equal(pending.text, null);
  assert.match(pending.problem ?? '', /needs-review/);
  assert.equal(pending.contentVersion, version, 'it says what an approval of these words would record');
});

test('an edit after approval holds the words back until they are approved again', () => {
  const edited = publishedAttractText('kiosk', { stored: approved({ headline: 'A different headline.' }) });
  assert.equal(edited.text, null);
  assert.match(edited.problem ?? '', /changed since/);
});

test('an approval for the display is not an approval for the website', () => {
  assert.equal(publishedAttractText('public', { stored: approved() }).text, null);
});

test("an editor's preview shows unapproved words, marked", () => {
  const preview = publishedAttractText('kiosk', { preview: true, stored: { attract: { ...words, review: { status: 'needs-review' } } } });
  assert.deepEqual(preview.text, { ...words, unreviewed: true });
});
