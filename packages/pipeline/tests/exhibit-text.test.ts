import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aboutLimit, aboutTextVersion, applyAttractDecision, attractDecisions, attractLimits, attractTextVersion, publishedAboutText, publishedAttractText } from '../src/build/exhibit-text.ts';

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

const header = 'block,decision,contentVersion,headline,tagline,decisionReference,note';
const pending = { attract: { ...words, review: { status: 'needs-review' }, publication: { kiosk: true, publicWeb: false } } };

test('approving covers the words exactly as the reviewer saw them, for the display only', () => {
  const { decisions, errors } = attractDecisions(`${header}\nattract,approve,${version},,,words-2026-10-01,\n`, pending);
  assert.deepEqual(errors, []);
  const next = applyAttractDecision(pending, decisions[0]!, '2026-10-01T00:00:00Z');
  assert.deepEqual(publishedAttractText('kiosk', { stored: next }).text, words);
  assert.equal(publishedAttractText('public', { stored: next }).text, null, 'the website has no attract screen');
});

test('an approval of words that have changed since the reviewer saw them is refused', () => {
  const { decisions, errors } = attractDecisions(`${header}\nattract,approve,text-000000000000,,,r,\n`, pending);
  assert.equal(decisions.length, 0);
  assert.match(errors[0] ?? '', /changed since/);
});

test("the reviewer's own words are approved as written, and must fit the screen", () => {
  const { decisions } = attractDecisions(`${header}\nattract,reword,,"Home, from everywhere.",A new tagline.,words-2026-10-02,\n`, pending);
  const next = applyAttractDecision(pending, decisions[0]!, '2026-10-02T00:00:00Z');
  assert.deepEqual(publishedAttractText('kiosk', { stored: next }).text, { headline: 'Home, from everywhere.', tagline: 'A new tagline.' });

  const long = 'x'.repeat(attractLimits.headline + 1);
  assert.match(attractDecisions(`${header}\nattract,reword,,${long},,r,\n`, pending).errors[0] ?? '', /room for 60/);
  assert.match(attractDecisions(`${header}\nattract,reword,,,,r,\n`, pending).errors[0] ?? '', /need a headline/);
});

test('a decision needs a reference, and a blank row changes nothing', () => {
  assert.match(attractDecisions(`${header}\nattract,approve,${version},,,,\n`, pending).errors[0] ?? '', /decisionReference/);
  assert.equal(attractDecisions(`${header}\nattract,,,,,,\n`, pending).blank, 1);
});

const aboutBody = 'First paragraph.\n\nSecond paragraph.';
const aboutVersion = aboutTextVersion(aboutBody);
const aboutHeader = 'block,decision,contentVersion,headline,tagline,body,decisionReference,note';
const aboutPending = { about: { body: aboutBody, review: { status: 'proposed' }, publication: { kiosk: true, publicWeb: true } } };

test('About words are held back until approved, then shown on the display and the website', () => {
  const held = publishedAboutText('kiosk', { stored: aboutPending });
  assert.equal(held.text, null);
  assert.equal(held.contentVersion, aboutVersion);
  const { decisions, errors } = attractDecisions(`${aboutHeader}\nabout,approve,${aboutVersion},,,,about-2026-10-01,\n`, aboutPending);
  assert.deepEqual(errors, []);
  const next = applyAttractDecision(aboutPending, decisions[0]!, '2026-10-01T00:00:00Z');
  assert.deepEqual(publishedAboutText('kiosk', { stored: next }).text, { body: aboutBody });
  assert.deepEqual(publishedAboutText('public', { stored: next }).text, { body: aboutBody });
});

test('an edit to approved About words holds them back, and a stale approval is refused', () => {
  const { decisions } = attractDecisions(`${aboutHeader}\nabout,approve,${aboutVersion},,,,r,\n`, aboutPending);
  const next = applyAttractDecision(aboutPending, decisions[0]!, '2026-10-01T00:00:00Z');
  const edited = publishedAboutText('kiosk', { stored: { about: { ...next.about!, body: 'Changed.' } } });
  assert.equal(edited.text, null);
  assert.match(edited.problem ?? '', /changed since/);
  const stale = attractDecisions(`${aboutHeader}\nabout,approve,text-000000000000,,,,r,\n`, aboutPending);
  assert.match(stale.errors[0] ?? '', /changed since/);
});

test('new About words are approved as written and must fit; both blocks can be decided together', () => {
  const tooLong = attractDecisions(`${aboutHeader}\nabout,reword,,,,${'x'.repeat(aboutLimit + 1)},r,\n`, aboutPending);
  assert.match(tooLong.errors[0] ?? '', /room for/);
  const both = attractDecisions(`${aboutHeader}\nabout,reword,,,,"New words.",r,\nattract,reword,,"Home.",,,r,\n`, { ...pending, ...aboutPending });
  assert.deepEqual(both.errors, []);
  assert.deepEqual(both.decisions.map((each) => each.block), ['about', 'attract']);
  let next = { ...pending, ...aboutPending } as Parameters<typeof applyAttractDecision>[0];
  for (const decision of both.decisions) next = applyAttractDecision(next, decision, '2026-10-01T00:00:00Z');
  assert.deepEqual(publishedAboutText('public', { stored: next }).text, { body: 'New words.' });
  assert.equal(publishedAttractText('public', { stored: next }).text, null, 'the attract words stay off the website');
});
