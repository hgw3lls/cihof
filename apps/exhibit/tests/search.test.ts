import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildIndex, captionWords, closeness, distance, queryTerms, search } from '../src/state/search.ts';
import type { RuntimePerson, RuntimePlace } from '../src/data/runtime.ts';
import { publishedBundle } from './bundle.ts';

const person = (id: string, name: string, extra: Partial<RuntimePerson> = {}): RuntimePerson => ({
  id, name, sortName: name, classYear: 2010, portrait: null, biography: '', biographyCurated: false,
  contributions: [], communities: [], countries: [], sourceUrl: null, presentedBy: null, films: [], ...extra,
});

const people = [
  person('jure', 'Jure Žmauc', { communities: ['Slovenian'], contributions: ['Education'], biography: 'He taught at the Slovenian school for many years.\n\nLater he founded a choir.' }),
  person('jeanette', 'Jeanette Grasselli Brown', { communities: ['European Heritage'], contributions: ['Science and Technology'], biography: 'A chemist who led research at BP America.', classYear: 1995 }),
  person('slovak', 'Anna Slovak', { biography: 'Anna ran a bakery on Slovenian Road.' }),
  person('le', 'Lê Nguyên', { communities: ['Vietnamese'], classYear: 2019, presentedBy: { recordedName: 'Mary Smith', inducteeId: null } }),
];
const places = [{ id: 'place:gardens', name: 'Cleveland Cultural Gardens', neighborhood: 'Rockefeller Park', shortHistory: 'Gardens for each community.', personIds: ['jure'] }] as unknown as RuntimePlace[];
const index = buildIndex({ people, places, relationships: [], contexts: [], films: [
  { personId: 'le', filmId: 'f1', words: [{ text: 'we', at: 1 }, { text: 'opened', at: 1.5 }, { text: 'the', at: 2 }, { text: 'first', at: 2.2 }, { text: 'pho', at: 3 }, { text: 'restaurant', at: 3.4 }] },
] });

test('accents fold, so a visitor can type plainly', () => {
  assert.equal(search(index, 'zmauc').people[0]?.person.id, 'jure');
  assert.equal(search(index, 'le nguyen').people[0]?.person.id, 'le');
});

test('a word is found from its start while it is still being typed', () => {
  assert.equal(search(index, 'grass').people[0]?.person.id, 'jeanette');
  assert.equal(search(index, 'jean').people[0]?.person.id, 'jeanette');
});

test('a slip of a letter is forgiven', () => {
  assert.equal(search(index, 'grasseli').people[0]?.person.id, 'jeanette');
  assert.equal(search(index, 'chemsit').people[0]?.person.id, 'jeanette');
  assert.equal(distance('chemsit', 'chemist', 2), 1, 'a swapped pair is one slip');
  assert.equal(closeness('xyzzy', 'chemist'), 0);
});

test('every word typed must be found, and a name outranks a story', () => {
  const both = search(index, 'slovenian anna');
  assert.deepEqual(both.people.map((hit) => hit.person.id), ['slovak']);
  const one = search(index, 'slovak');
  assert.equal(one.people[0]?.person.id, 'slovak', 'the name Slovak ranks first');
  assert.equal(one.people[0]?.where, 'Name');
});

test('each result says where it matched, with the words marked', () => {
  const hit = search(index, 'choir').people[0]!;
  assert.equal(hit.where, 'Story');
  assert.deepEqual(hit.snippet.filter((part) => part.mark).map((part) => part.text), ['choir']);
  const presented = search(index, 'mary smith').people[0]!;
  assert.equal(presented.where, 'Presented by');
});

test('the collection’s groupings, places and film words are found too', () => {
  const groups = search(index, 'slovenian').groups;
  assert.equal(groups[0]?.label, 'Slovenian');
  assert.deepEqual(groups[0]?.people.map((p) => p.id), ['jure']);
  assert.equal(search(index, '2019').groups[0]?.label, 'Class of 2019');
  assert.equal(search(index, 'rockefeller').places[0]?.place.id, 'place:gardens');
  const film = search(index, 'pho restaurant').films[0]!;
  assert.equal(film.person.id, 'le');
  assert.equal(film.at, 3, 'the film opens where the words are said');
});

test('common words alone do not flood the results, and one letter only finds names', () => {
  assert.deepEqual(queryTerms('the history of the gardens'), ['history', 'gardens']);
  assert.deepEqual(queryTerms('the'), ['the']);
  assert.deepEqual(search(index, 'a').people.map((hit) => hit.person.id), ['slovak'], 'only Anna’s name starts with A');
  assert.equal(search(index, '   ').people.length, 0);
});

test('caption files give each word the moment it is said, without the repeats', () => {
  const vtt = `WEBVTT\n\n00:00:17.010 --> 00:00:20.130\n \nby<00:00:18.010><c> my</c><00:00:18.640><c> dad</c>\n\n00:00:20.130 --> 00:00:20.140\nby my dad\n \n\n00:00:20.140 --> 00:00:20.939\nby my dad\ntime<00:00:20.439><c> is</c>\n`;
  assert.deepEqual(captionWords(vtt), [
    { text: 'by', at: 17.01 }, { text: 'my', at: 18.01 }, { text: 'dad', at: 18.64 },
    { text: 'time', at: 20.14 }, { text: 'is', at: 20.439 },
  ]);
  const plain = `WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello there\n\n00:00:02.000 --> 00:00:03.000\nHello there\n\n00:00:03.000 --> 00:00:04.000\nGood evening\n`;
  assert.deepEqual(captionWords(plain).map((word) => `${word.text}@${word.at}`), ['Hello@1', 'there@1', 'Good@3', 'evening@3']);
});

test('the whole published collection searches quickly', () => {
  const bundle = publishedBundle();
  const full = buildIndex({ people: bundle.people, places: bundle.places, relationships: bundle.relationships, contexts: bundle.contexts ?? [] });
  const began = performance.now();
  for (const query of ['m', 'ma', 'mar', 'slovenian', 'cultural gardens', 'grasseli', 'education 2010']) search(full, query);
  const each = (performance.now() - began) / 7;
  assert.ok(each < 60, `a search took ${each.toFixed(1)}ms`);
});

test('a match in a list shows only the items that matched, and years are exact', () => {
  const listed = buildIndex({ people: [person('p', 'Pat Doe', { communities: ['Irish', 'Slovenian', 'Polish'] })], places: [], relationships: [], contexts: [] });
  const hit = search(listed, 'slovenian').people[0]!;
  assert.equal(hit.snippet.map((part) => part.text).join(''), 'Slovenian');
  assert.equal(search(index, '2010').people.every((each) => each.person.classYear === 2010), true);
  assert.equal(closeness('2014', '2010'), 0);
});

test('a word the collection uses is taken as meant, not as a slip for another', () => {
  const family = buildIndex({ people: [
    person('g', 'Gina Mother', { biography: 'She was a grandmother of nine.' }),
    person('f', 'Fred Father', { biography: 'He was a grandfather of six.' }),
  ], places: [], relationships: [], contexts: [] });
  assert.deepEqual(search(family, 'grandmother').people.map((hit) => hit.person.id), ['g']);
  assert.deepEqual(search(family, 'grandmothr').people.map((hit) => hit.person.id), ['g'], 'a real slip is still forgiven');
});

test('a ceremony film is searched once, and a moment is credited to whoever’s part it falls in', () => {
  const ceremony = { id: 'c', source: { kind: 'local-file', src: '/c.mp4' }, poster: '/c.webp', captions: '/c.vtt', transcript: '/c.txt', durationSeconds: 600 };
  const shared = [
    person('one', 'First Person', { films: [{ ...ceremony, startSeconds: 0 }] as never }),
    person('two', 'Second Person', { films: [{ ...ceremony, startSeconds: 300 }] as never }),
  ];
  const words = [{ text: 'welcome', at: 10 }, { text: 'orchestra', at: 320 }];
  const built = buildIndex({ people: shared, places: [], relationships: [], contexts: [], films: [
    { personId: 'one', filmId: 'c', words }, { personId: 'two', filmId: 'c', words },
  ] });
  assert.deepEqual(search(built, 'orchestra').films.map((hit) => [hit.person.id, hit.at]), [['two', 320]]);
  assert.deepEqual(search(built, 'welcome').films.map((hit) => hit.person.id), ['one']);
});

test('a story’s italics are searched without their asterisks and kept in the result', () => {
  const titled = buildIndex({ people: [person('m', 'Alex Page', { biography: 'He spent decades at *The Plain Dealer* in Cleveland.' })], places: [], relationships: [], contexts: [] });
  const hit = search(titled, 'plain dealer').people[0]!;
  assert.ok(!hit.snippet.some((part) => part.text.includes('*')));
  assert.deepEqual(hit.snippet.filter((part) => part.em).map((part) => part.text), ['The ', 'Plain', ' ', 'Dealer']);
  assert.deepEqual(hit.snippet.filter((part) => part.mark).map((part) => part.text), ['Plain', 'Dealer']);
});
