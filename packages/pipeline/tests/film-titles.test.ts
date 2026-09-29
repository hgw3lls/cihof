import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPeople } from '../src/build/people.ts';
import { buildRuntimeBundle } from '../src/build/emit.ts';
import { collectDifferences, emptyLedger, filmTitlesByPerson, readPublishedRecord, reconcile, recordDecision } from '../src/build/parity.ts';
import { applyFilmTitleDecisions, approvedFilmTitle, filmTitleDecisions, filmTitleLimit, filmTitleVersion, type StoredFilmTitles } from '../src/build/film-titles.ts';

const films = new Set(['abc', 'def']);
const sheet = (...rows: string[][]) => ['filmId,decision,title,decisionReference,note', ...rows.map((row) => row.map((cell) => (/[",]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(','))].join('\n');
const approved = (title: string, filmId = 'abc'): StoredFilmTitles => ({
  titles: { [filmId]: { title, review: { status: 'approved', decisionReference: 'ref', contentVersion: filmTitleVersion(filmId, title) }, publication: { kiosk: true, publicWeb: false } } },
});

test('a title reaches the display only approved, in the words approved, and not the website', () => {
  assert.equal(approvedFilmTitle(approved('Anda Cook, inducted'), 'abc', 'kiosk'), 'Anda Cook, inducted');
  assert.equal(approvedFilmTitle(approved('Anda Cook, inducted'), 'abc', 'public'), null, 'films are approved for the display only');
  assert.equal(approvedFilmTitle(approved('Anda Cook, inducted'), 'def', 'kiosk'), null, 'another film has no title');
  // Words changed after approval are not the words approved.
  const edited = approved('Anda Cook, inducted');
  const changed = { titles: { abc: { ...edited.titles['abc']!, title: 'Something else' } } };
  assert.equal(approvedFilmTitle(changed, 'abc', 'kiosk'), null);
  const draft = { titles: { abc: { title: 'A draft', review: { status: 'draft' }, publication: { kiosk: true } } } };
  assert.equal(approvedFilmTitle(draft, 'abc', 'kiosk'), null);
});

test('a sheet approves the title it names, as written, for the display', () => {
  const { decisions, errors, blank } = filmTitleDecisions(sheet(['abc', 'approve', 'Anda Cook  inducted by Dagmar Celeste', 'film-titles-review-2026-10-01', 'From YouTube.'], ['def', '', '', '', '']), films);
  assert.deepEqual(errors, []);
  assert.equal(blank, 1);
  const next = applyFilmTitleDecisions({ titles: {} }, decisions, '2026-10-01T10:00:00.000Z');
  assert.equal(approvedFilmTitle(next, 'abc', 'kiosk'), 'Anda Cook inducted by Dagmar Celeste', 'spaces tidied, words kept');
  assert.deepEqual(next.titles['abc']?.publication, { kiosk: true, publicWeb: false });
  assert.equal(next.titles['abc']?.review.note, 'From YouTube.');
});

test('a sheet refuses an unknown film, a missing or overlong title, and a missing reference', () => {
  const refused = (row: string[]) => filmTitleDecisions(sheet(row), films).errors[0] ?? '';
  assert.match(refused(['xyz', 'approve', 'A title', 'ref', '']), /no film "xyz"/);
  assert.match(refused(['abc', 'approve', '', 'ref', '']), /needs the title/);
  assert.match(refused(['abc', 'approve', 'x'.repeat(filmTitleLimit + 1), 'ref', '']), /room for/);
  assert.match(refused(['abc', 'approve', 'A title', '', '']), /decisionReference/);
  assert.match(refused(['abc', 'rename', 'A title', 'ref', '']), /approve, clear or empty/);
});

test('clearing takes a title away', () => {
  const { decisions } = filmTitleDecisions(sheet(['abc', 'clear', '', 'ref', '']), films);
  const next = applyFilmTitleDecisions(approved('Anda Cook, inducted'), decisions, '2026-10-02T10:00:00.000Z');
  assert.equal(approvedFilmTitle(next, 'abc', 'kiosk'), null);
});

test('a built bundle calls an approved film by its title, on everybody who has that film', () => {
  const people = buildPeople();
  // A ceremony shared by several people: every copy carries the title.
  const stored = approved('The 2024 induction ceremony', 'P34omi5XUiY');
  const bundle = buildRuntimeBundle(people, 'kiosk', { filmTitles: stored });
  const titled = bundle.people.flatMap((person) => person.films).filter((film) => film.id === 'P34omi5XUiY');
  assert.ok(titled.length > 1);
  assert.ok(titled.every((film) => film.title === 'The 2024 induction ceremony'));
  assert.ok(bundle.people.flatMap((person) => person.films).filter((film) => film.id !== 'P34omi5XUiY').every((film) => film.title === undefined));
});

test('a title is a visible difference from the published record, recorded for everybody whose film it is', () => {
  const people = buildPeople();
  const stored = approved('The 2024 induction ceremony', 'P34omi5XUiY');
  const titled = collectDifferences(people, readPublishedRecord(), filmTitlesByPerson(stored))
    .filter((difference) => difference.includes('.filmTitles:'));
  assert.equal(titled.length, 6, 'the six people the ceremony stands for');
  assert.ok(titled.every((difference) => difference.endsWith('-> rebuilt "The 2024 induction ceremony"')));
  // No title approved: no difference.
  assert.deepEqual(collectDifferences(people, readPublishedRecord(), filmTitlesByPerson({ titles: {} })).filter((difference) => difference.includes('.filmTitles:')), []);

  // Recorded under the decision for those people, and nobody else's lines are excused.
  const owners = new Set(titled.map((difference) => difference.split('.')[0]!));
  const { ledger } = recordDecision(emptyLedger(), titled, { ids: owners, decisionReference: 'film-titles-review-2026-10-01', recordedAt: '2026-10-01T00:00:00Z' });
  assert.deepEqual(reconcile(titled, ledger).unrecorded, []);
});
