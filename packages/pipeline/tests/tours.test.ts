import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyTourDecisions, publishedTours, tourDecisions, tourPeople, tourVersion } from '../src/build/tours.ts';

const person = (id: string, sortName: string, biography: string, contributions: string[] = []) => ({ id, sortName, biography, contributions });
const people = [
  person('a', 'Adams', 'She resettled refugees and taught citizenship; citizenship classes for refugees. Refugees remember her.'),
  person('b', 'Brown', 'A painter.', ['Newcomer Support']),
  person('c', 'Cole', 'An engineer who once met a refugee.'),
  person('d', 'Dunn', 'Taught citizenship to refugees, and resettled families; refugees, refugees, refugees, refugees.'),
];
const draft = { id: 'helped-arrive', label: 'Newcomer Support', prompt: 'Welcome', description: 'Welcome work.', terms: ['refugee', 'citizenship', 'resettled'], themes: ['newcomer support'], reviewStatus: 'draft' };
// Approved, naming the version of the tour that was approved.
const lens = { ...draft, reviewStatus: 'approved', review: { contentVersion: tourVersion(draft) } };

test('a tour visits the people its terms and themes find, strongest first, and not the passing mention', () => {
  // Brown by an honour (8), Dunn (7) and Adams (6) by their stories; Cole's one mention is not enough.
  assert.deepEqual(tourPeople(people, lens), ['b', 'd', 'a']);
});

test('pinned people lead, excluded people never appear, and the length is capped', () => {
  assert.deepEqual(tourPeople(people, { ...lens, pinnedPersonIds: ['c'], excludedPersonIds: ['d'] }), ['c', 'b', 'a']);
  assert.deepEqual(tourPeople(people, { ...lens, maxPortraits: 1 }), ['b']);
});

test('only an approved tour reaches a display; a preview shows drafts, marked', () => {
  const stored = { lenses: [lens, { ...lens, id: 'draft', reviewStatus: 'draft' }, { ...lens, id: 'off', enabled: false }] };
  assert.deepEqual(publishedTours(people, { stored }).map((tour) => tour.id), ['helped-arrive']);
  const preview = publishedTours(people, { stored, preview: true });
  assert.deepEqual(preview.map((tour) => [tour.id, tour.unreviewed ?? false]), [['helped-arrive', false], ['draft', true]]);
});

test('a tour that finds nobody is not published', () => {
  assert.deepEqual(publishedTours(people, { stored: { lenses: [{ ...lens, terms: ['astronaut'], themes: [] }] } }), []);
});

test('the release today publishes no tour, since none is approved', () => {
  assert.deepEqual(publishedTours(people), []);
});

test('an approved tour that has changed since is held back until it is approved again', () => {
  const edited = { ...lens, description: 'Other words.' };
  assert.deepEqual(publishedTours(people, { stored: { lenses: [edited] } }), []);
  assert.deepEqual(publishedTours(people, { stored: { lenses: [{ ...lens, terms: [...lens.terms, 'newcomer'] }] } }), []);
  // Marked as a draft in an editor's preview.
  assert.equal(publishedTours(people, { stored: { lenses: [edited] }, preview: true })[0]?.unreviewed, true);
  // An approval with no version at all is not enough either.
  assert.deepEqual(publishedTours(people, { stored: { lenses: [{ ...draft, reviewStatus: 'approved' }] } }), []);
});

const sheet = (...rows: string[][]) => ['tourId,decision,contentVersion,decisionReference,note', ...rows.map((row) => row.join(','))].join('\n');

test('a sheet approves the tour the reviewer saw, and nothing else', () => {
  const stored = { lenses: [draft, { ...draft, id: 'other' }] };
  const version = tourVersion(draft);
  const { decisions, errors, blank } = tourDecisions(sheet(['helped-arrive', 'approve', version, 'tours-review-2026-10-01', 'Checked.'], ['other', '', '', '', '']), stored);
  assert.deepEqual(errors, []);
  assert.equal(blank, 1);
  const next = applyTourDecisions(stored, decisions, '2026-10-01T10:00:00.000Z');
  assert.deepEqual(publishedTours(people, { stored: next }).map((tour) => tour.id), ['helped-arrive']);
  assert.deepEqual(next.lenses?.[0]?.review, { contentVersion: version, decisionReference: 'tours-review-2026-10-01', reviewedAt: '2026-10-01T10:00:00.000Z', note: 'Checked.' });
  assert.equal(next.lenses?.[1]?.reviewStatus, 'draft');
});

test('a sheet refuses an approval of a tour that changed, an unknown tour, and a withdrawal of a draft', () => {
  const stored = { lenses: [draft] };
  const refused = (row: string[]) => tourDecisions(sheet(row), stored).errors;
  assert.match(refused(['helped-arrive', 'approve', 'tour-000000000000', 'ref', ''])[0]!, /changed since this sheet was made/);
  assert.match(refused(['nowhere', 'approve', tourVersion(draft), 'ref', ''])[0]!, /no tour "nowhere"/);
  assert.match(refused(['helped-arrive', 'withdraw', '', 'ref', ''])[0]!, /nothing to withdraw/);
  assert.match(refused(['helped-arrive', 'approve', tourVersion(draft), '', ''])[0]!, /decisionReference/);
});

test('a withdrawal takes an approved tour off the displays', () => {
  const stored = { lenses: [lens] };
  const { decisions, errors } = tourDecisions(sheet(['helped-arrive', 'withdraw', '', 'tours-review-2026-10-02', '']), stored);
  assert.deepEqual(errors, []);
  const next = applyTourDecisions(stored, decisions, '2026-10-02T10:00:00.000Z');
  assert.deepEqual(publishedTours(people, { stored: next }), []);
  assert.equal(next.lenses?.[0]?.reviewStatus, 'draft');
});
