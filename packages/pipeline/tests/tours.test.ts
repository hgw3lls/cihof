import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyTourDecisions, blankTourChanges, editedLens, newTourId, publishedTours, readTours, tourChangesOf, tourChangesProblems, tourDecisions, tourEditColumns, tourPeople, tourPublished, tourVersion, type TourChanges } from '../src/build/tours.ts';

const person = (id: string, sortName: string, biography: string, contributions: string[] = []) => ({ id, sortName, biography, contributions });
const people = [
  person('a', 'Adams', 'She resettled refugees and taught citizenship; citizenship classes for refugees. Refugees remember her.'),
  person('b', 'Brown', 'A painter.', ['Newcomer Support']),
  person('c', 'Cole', 'An engineer who once met a refugee.'),
  person('d', 'Dunn', 'Taught citizenship to refugees, and resettled families; refugees, refugees, refugees, refugees.'),
];
const draft = { id: 'helped-arrive', label: 'Newcomer Support', prompt: 'Welcome', description: 'Welcome work.', terms: ['refugee', 'citizenship', 'resettled'], themes: ['newcomer support'], reviewStatus: 'draft' };
// Approved, naming the version of the tour that was approved.
const lens = { ...draft, reviewStatus: 'approved', review: { contentVersion: tourVersion(draft) }, publication: { kiosk: true, publicWeb: false } };

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
  assert.deepEqual(publishedTours(people, 'kiosk', { stored }).map((tour) => tour.id), ['helped-arrive']);
  const preview = publishedTours(people, 'kiosk', { stored, preview: true });
  assert.deepEqual(preview.map((tour) => [tour.id, tour.unreviewed ?? false]), [['helped-arrive', false], ['draft', true]]);
});

test('a tour that finds nobody is not published', () => {
  assert.deepEqual(publishedTours(people, 'kiosk', { stored: { lenses: [{ ...lens, terms: ['astronaut'], themes: [] }] } }), []);
});

test('a release publishes only tours approved for its target, in the version approved', () => {
  const stored = readTours();
  for (const target of ['kiosk', 'public'] as const) {
    const approvedHere = new Set((stored.lenses ?? [])
      .filter((each) => each.enabled !== false && tourPublished(each, target))
      .map((each) => each.id));
    // Every tour it publishes is approved here, never merely because it exists.
    for (const tour of publishedTours(people, target)) assert.ok(approvedHere.has(tour.id), `${tour.id} on ${target}`);
  }
});

test('an approved tour that has changed since is held back until it is approved again', () => {
  const edited = { ...lens, description: 'Other words.' };
  assert.deepEqual(publishedTours(people, 'kiosk', { stored: { lenses: [edited] } }), []);
  assert.deepEqual(publishedTours(people, 'kiosk', { stored: { lenses: [{ ...lens, terms: [...lens.terms, 'newcomer'] }] } }), []);
  // Marked as a draft in an editor's preview.
  assert.equal(publishedTours(people, 'kiosk', { stored: { lenses: [edited] }, preview: true })[0]?.unreviewed, true);
  // An approval with no version at all is not enough either.
  assert.deepEqual(publishedTours(people, 'kiosk', { stored: { lenses: [{ ...draft, reviewStatus: 'approved' }] } }), []);
});

const sheet = (...rows: string[][]) => ['tourId,decision,contentVersion,targets,decisionReference,note', ...rows.map((row) => row.map((cell) => (cell.includes(',') ? `"${cell}"` : cell)).join(','))].join('\n');

test('a sheet approves the tour the reviewer saw, and nothing else', () => {
  const stored = { lenses: [draft, { ...draft, id: 'other' }] };
  const version = tourVersion(draft);
  const { decisions, errors, blank } = tourDecisions(sheet(['helped-arrive', 'approve', version, 'kiosk', 'tours-review-2026-10-01', 'Checked.'], ['other', '', '', '', '', '']), stored);
  assert.deepEqual(errors, []);
  assert.equal(blank, 1);
  const next = applyTourDecisions(stored, decisions, '2026-10-01T10:00:00.000Z');
  assert.deepEqual(publishedTours(people, 'kiosk', { stored: next }).map((tour) => tour.id), ['helped-arrive']);
  assert.deepEqual(next.lenses?.[0]?.review, { contentVersion: version, decisionReference: 'tours-review-2026-10-01', reviewedAt: '2026-10-01T10:00:00.000Z', note: 'Checked.' });
  assert.equal(next.lenses?.[1]?.reviewStatus, 'draft');
});

test('a sheet refuses an approval of a tour that changed, an unknown tour, and a withdrawal of a draft', () => {
  const stored = { lenses: [draft] };
  const refused = (row: string[]) => tourDecisions(sheet(row), stored).errors;
  assert.match(refused(['helped-arrive', 'approve', 'tour-000000000000', 'kiosk', 'ref', ''])[0]!, /changed since this sheet was made/);
  assert.match(refused(['nowhere', 'approve', tourVersion(draft), 'kiosk', 'ref', ''])[0]!, /no tour "nowhere"/);
  assert.match(refused(['helped-arrive', 'withdraw', '', '', 'ref', ''])[0]!, /nothing to withdraw/);
  assert.match(refused(['helped-arrive', 'approve', tourVersion(draft), 'kiosk', '', ''])[0]!, /decisionReference/);
  assert.match(refused(['helped-arrive', 'approve', tourVersion(draft), '', 'ref', ''])[0]!, /needs targets/);
  assert.match(refused(['helped-arrive', 'approve', tourVersion(draft), 'kiosk,web', 'ref', ''])[0]!, /"web" is not a target/);
});

test('a withdrawal takes an approved tour off the displays', () => {
  const stored = { lenses: [lens] };
  const { decisions, errors } = tourDecisions(sheet(['helped-arrive', 'withdraw', '', '', 'tours-review-2026-10-02', '']), stored);
  assert.deepEqual(errors, []);
  const next = applyTourDecisions(stored, decisions, '2026-10-02T10:00:00.000Z');
  assert.deepEqual(publishedTours(people, 'kiosk', { stored: next }), []);
  assert.equal(next.lenses?.[0]?.reviewStatus, 'draft');
});

test('the display and the website are decided apart', () => {
  const stored = { lenses: [lens] };
  assert.deepEqual(publishedTours(people, 'kiosk', { stored }).map((tour) => tour.id), ['helped-arrive']);
  assert.deepEqual(publishedTours(people, 'public', { stored }), []);
  // No flags at all is not an approval for anywhere.
  const { publication, ...unflagged } = lens;
  void publication;
  assert.deepEqual(publishedTours(people, 'kiosk', { stored: { lenses: [unflagged] } }), []);

  const both = tourDecisions(sheet(['helped-arrive', 'approve', tourVersion(draft), 'kiosk,public-web', 'ref', '']), { lenses: [draft] });
  const next = applyTourDecisions({ lenses: [draft] }, both.decisions, '2026-10-01T10:00:00.000Z');
  assert.deepEqual(next.lenses?.[0]?.publication, { kiosk: true, publicWeb: true });
  assert.deepEqual(publishedTours(people, 'public', { stored: next }).map((tour) => tour.id), ['helped-arrive']);

  const withdrawn = applyTourDecisions(next, tourDecisions(sheet(['helped-arrive', 'withdraw', '', '', 'ref', '']), next).decisions, '2026-10-02T10:00:00.000Z');
  assert.deepEqual(withdrawn.lenses?.[0]?.publication, { kiosk: false, publicWeb: false });
});

const editSheet = (rows: { tourId: string; contentVersion: string; targets?: string; changes: TourChanges; decision?: string }[]) => {
  const quote = (cell: string) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);
  return [
    ['tourId', 'decision', 'contentVersion', 'targets', 'decisionReference', 'note', ...tourEditColumns].join(','),
    ...rows.map(({ tourId, contentVersion, targets = '', changes, decision = 'edit' }) => [
      tourId, decision, contentVersion, targets, 'tours-review-2026-10-02', 'Edited.',
      changes.label, changes.prompt, changes.description, changes.terms.join(';'), changes.themes.join(';'),
      changes.pinnedPersonIds.join(';'), changes.excludedPersonIds.join(';'), String(changes.maxPortraits),
    ].map(quote).join(',')),
  ].join('\n');
};
const known = new Set(people.map((each) => each.id));

test('an edit with targets rewrites the tour and approves it as edited, for them alone', () => {
  const changes = { ...tourChangesOf(lens), label: 'Welcome Home', description: 'Who made newcomers, at home.', pinnedPersonIds: ['c'], excludedPersonIds: ['d'] };
  const { decisions, errors } = tourDecisions(editSheet([{ tourId: 'helped-arrive', contentVersion: tourVersion(lens), targets: 'kiosk', changes }]), { lenses: [lens] }, known);
  assert.deepEqual(errors, []);
  const next = applyTourDecisions({ lenses: [lens] }, decisions, '2026-10-02T10:00:00.000Z');
  const [tour] = publishedTours(people, 'kiosk', { stored: next });
  assert.equal(tour?.label, 'Welcome Home');
  assert.deepEqual(tour?.personIds, ['c', 'b', 'a']);
  assert.equal(next.lenses?.[0]?.review?.contentVersion, tourVersion(editedLens(lens, changes)));
  assert.deepEqual(publishedTours(people, 'public', { stored: next }), []);
});

test('an edit with the target none leaves the tour a draft, shown nowhere, even if it was approved', () => {
  const changes = { ...tourChangesOf(lens), terms: [...lens.terms, 'newcomer'] };
  const { decisions, errors } = tourDecisions(editSheet([{ tourId: 'helped-arrive', contentVersion: tourVersion(lens), targets: 'none', changes }]), { lenses: [lens] }, known);
  assert.deepEqual(errors, []);
  const next = applyTourDecisions({ lenses: [lens] }, decisions, '2026-10-02T10:00:00.000Z');
  assert.equal(next.lenses?.[0]?.reviewStatus, 'draft');
  assert.deepEqual(next.lenses?.[0]?.publication, { kiosk: false, publicWeb: false });
  assert.deepEqual(publishedTours(people, 'kiosk', { stored: next }), []);
  assert.deepEqual(next.lenses?.[0]?.terms, [...lens.terms, 'newcomer']);
});

test('an edit is refused over a tour that changed since it began, or when it changes nothing', () => {
  const changes = { ...tourChangesOf(lens), label: 'Elsewhere' };
  const stale = tourDecisions(editSheet([{ tourId: 'helped-arrive', contentVersion: 'tour-000000000000', targets: 'none', changes }]), { lenses: [lens] }, known);
  assert.match(stale.errors[0]!, /changed since this edit began/);
  const same = tourDecisions(editSheet([{ tourId: 'helped-arrive', contentVersion: tourVersion(lens), targets: 'none', changes: tourChangesOf(lens) }]), { lenses: [lens] }, known);
  assert.match(same.errors[0]!, /changes nothing/);
  // An old sheet without the edit columns cannot carry an edit.
  const bare = tourDecisions(sheet(['helped-arrive', 'edit', tourVersion(lens), 'none', 'ref', '']), { lenses: [lens] }, known);
  assert.match(bare.errors[0]!, /needs the column\(s\) label/);
});

test('an edit that does not say whether it is approved is refused, never taken off the displays by default', () => {
  const changes = { ...tourChangesOf(lens), label: 'Elsewhere' };
  const unchosen = tourDecisions(editSheet([{ tourId: 'helped-arrive', contentVersion: tourVersion(lens), changes }]), { lenses: [lens] }, known);
  assert.equal(unchosen.decisions.length, 0);
  assert.match(unchosen.errors[0]!, /an edit needs targets/);
  assert.match(tourDecisions(editSheet([{ tourId: 'helped-arrive', contentVersion: tourVersion(lens), targets: 'kiosk,none', changes }]), { lenses: [lens] }, known).errors[0]!, /"none" is not a target/);
  // none is a choice for an edit only; an approval still names who may see the tour.
  assert.match(tourDecisions(sheet(['helped-arrive', 'approve', tourVersion(lens), 'none', 'ref', '']), { lenses: [lens] }).errors[0]!, /"none" is not a target/);
});

test('an edit says what is wrong with it, in the curator\'s terms', () => {
  const base = tourChangesOf(lens);
  const problems = (change: Partial<TourChanges>) => tourChangesProblems({ ...base, ...change }, known).join(' ');
  assert.equal(problems({}), '');
  assert.match(problems({ label: ' ' }), /The name is empty/);
  assert.match(problems({ description: 'x'.repeat(181) }), /room for 180/);
  assert.match(problems({ terms: ['an'] }), /too short to look for/);
  assert.match(problems({ pinnedPersonIds: ['nobody'] }), /nobody "nobody"/);
  assert.match(problems({ pinnedPersonIds: ['a'], excludedPersonIds: ['a'] }), /both always first and never included/);
  assert.match(problems({ pinnedPersonIds: ['a', 'b'], maxPortraits: 1 }), /more than the 1/);
  assert.match(problems({ maxPortraits: 0 }), /At most 1 to/);
  // Without knowing who is in the collection, nobody may be named.
  assert.match(tourChangesProblems({ ...base, pinnedPersonIds: ['a'] }, new Set()).join(' '), /nobody "a"/);
});

const fresh: TourChanges = { ...blankTourChanges, label: 'Painters', prompt: 'The arts', description: 'Who painted the city.', themes: ['newcomer support'], pinnedPersonIds: ['c'] };

test('a new tour is added after the others, approved as written for the targets it names', () => {
  const { decisions, errors } = tourDecisions(editSheet([{ tourId: 'painters', contentVersion: '', targets: 'kiosk', decision: 'create', changes: fresh }]), { lenses: [lens] }, known);
  assert.deepEqual(errors, []);
  const next = applyTourDecisions({ lenses: [lens] }, decisions, '2026-10-02T10:00:00.000Z');
  assert.deepEqual(next.lenses?.map((each) => each.id), ['helped-arrive', 'painters']);
  const tours = publishedTours(people, 'kiosk', { stored: next });
  assert.deepEqual(tours.map((tour) => [tour.id, tour.label]), [['helped-arrive', 'Newcomer Support'], ['painters', 'Painters']]);
  assert.deepEqual(tours[1]?.personIds, ['c', 'b']);
  assert.deepEqual(publishedTours(people, 'public', { stored: next }), []);
  assert.equal(next.lenses?.[1]?.enabled, true);
});

test('a new tour left for somebody else is a draft, shown nowhere until it is approved', () => {
  const { decisions } = tourDecisions(editSheet([{ tourId: 'painters', contentVersion: '', targets: 'none', decision: 'create', changes: fresh }]), { lenses: [] }, known);
  const next = applyTourDecisions({ lenses: [] }, decisions, '2026-10-02T10:00:00.000Z');
  assert.equal(next.lenses?.[0]?.reviewStatus, 'draft');
  assert.deepEqual(publishedTours(people, 'kiosk', { stored: next }), []);
  // Approved later, as it is.
  const approved = tourDecisions(sheet(['painters', 'approve', tourVersion(next.lenses![0]!), 'kiosk', 'ref', '']), next, known);
  assert.deepEqual(approved.errors, []);
  assert.deepEqual(publishedTours(people, 'kiosk', { stored: applyTourDecisions(next, approved.decisions, '2026-10-03T10:00:00.000Z') }).map((tour) => tour.id), ['painters']);
});

test('a new tour is refused under a name already taken, a name that cannot be one, without a choice, or with nobody to choose', () => {
  const refused = (tourId: string, changes: TourChanges, targets = 'kiosk') =>
    tourDecisions(editSheet([{ tourId, contentVersion: '', targets, decision: 'create', changes }]), { lenses: [lens] }, known).errors[0] ?? '';
  assert.match(refused('helped-arrive', fresh), /already a tour "helped-arrive"/);
  assert.match(refused('Painters!', fresh), /cannot name a tour/);
  assert.match(refused('painters', fresh, ''), /a new tour needs targets/);
  assert.match(refused('painters', { ...fresh, themes: [], pinnedPersonIds: [] }), /nobody in it/);
  assert.match(refused('painters', { ...fresh, label: '' }), /The name is empty/);
});

test('a new tour is named from its words, and never takes a name already in use', () => {
  assert.equal(newTourId('Care + Health', new Set()), 'care-health');
  assert.equal(newTourId('Ōtautahi Artists', new Set()), 'otautahi-artists');
  assert.equal(newTourId('Arts', new Set(['arts', 'arts-2'])), 'arts-3');
  assert.equal(newTourId('!!!', new Set()), 'tour');
});

test('a deleted tour is taken out of the records, off every display, and its name is free again', () => {
  const stored = { lenses: [lens, { ...draft, id: 'other' }] };
  const { decisions, errors } = tourDecisions(sheet(['helped-arrive', 'delete', tourVersion(lens), '', 'tours-review-2026-10-02', 'Replaced by another.']), stored, known);
  assert.deepEqual(errors, []);
  const next = applyTourDecisions(stored, decisions, '2026-10-02T10:00:00.000Z');
  assert.deepEqual(next.lenses?.map((each) => each.id), ['other']);
  assert.deepEqual(publishedTours(people, 'kiosk', { stored: next }), []);
  // A new tour may take its name afterwards.
  const again = tourDecisions(editSheet([{ tourId: 'helped-arrive', contentVersion: '', targets: 'none', decision: 'create', changes: fresh }]), next, known);
  assert.deepEqual(again.errors, []);
});

test('a tour is not deleted unseen: one changed since, or one that is not there, is refused', () => {
  const stored = { lenses: [lens] };
  assert.match(tourDecisions(sheet(['helped-arrive', 'delete', 'tour-000000000000', '', 'ref', '']), stored).errors[0]!, /changed since it was chosen for deleting/);
  assert.match(tourDecisions(sheet(['gone', 'delete', 'tour-000000000000', '', 'ref', '']), stored).errors[0]!, /no tour "gone"/);
  assert.match(tourDecisions(sheet(['helped-arrive', 'delete', tourVersion(lens), '', '', '']), stored).errors[0]!, /decisionReference/);
});
