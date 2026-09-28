import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupsBy, inductionClasses, kicker, teaser, undatedCount } from '../src/state/selectors.ts';
import type { RuntimePerson } from '../src/data/runtime.ts';

const person = (id: string, name: string, classYear: number | null, communities: string[], contributions: string[]): RuntimePerson => ({
  id, name, sortName: name, classYear, portrait: null, biography: '', biographyCurated: false,
  contributions, communities, countries: [], sourceUrl: null, presentedBy: null, films: [],
});

const people = [
  person('alpha', 'Alex Machaskee', 2010, ['Serbian'], ['Press']),
  person('beta', 'Jure Žmauc', 2011, ['Slovenian'], ['Press', 'Service']),
  person('gamma', 'Lê Nguyên', null, ['Vietnamese'], ['Service']),
];

test('groups put each person once, under their first tag, largest group first', () => {
  const groups = groupsBy(people, 'contributions');
  assert.deepEqual(groups.map((group) => [group.label, group.people.map((p) => p.id)]), [
    ['Press', ['alpha', 'beta']],
    ['Service', ['gamma']],
  ]);
  const untagged = groupsBy([person('delta', 'Dee', 2012, [], [])], 'communities');
  assert.equal(untagged[0]!.label, 'Not recorded', 'a person with no tag is still on the wall');
});

test('the teaser is the first paragraph, cut at a sentence when it runs long', () => {
  assert.equal(teaser('Short opening.\n\nSecond paragraph.'), 'Short opening.');
  const long = `${'A sentence that goes on for a while. '.repeat(5)}${'x'.repeat(200)}`;
  const cut = teaser(long);
  assert.ok(cut.length <= 260 && cut.endsWith('.'), 'ends at a full stop within the limit');
  assert.ok(teaser('y'.repeat(400)).endsWith('…'), 'with no sentence to end at, it says it was cut');
});

test('the kicker states the class, or that it is not recorded', () => {
  assert.equal(kicker(people[0]!), 'Class of 2010 · Serbian');
  assert.equal(kicker(people[2]!), 'Year not recorded · Vietnamese');
});

test('the chronology groups by class, newest first, sorted within a class', () => {
  const classes = inductionClasses([
    person('a', 'Zoe Adams', 2010, [], []),
    person('b', 'Al Brown', 2010, [], []),
    person('c', 'Kim Cole', 2012, [], []),
    person('d', 'No Year', null, [], []),
  ]);

  assert.deepEqual(classes.map((entry) => entry.year), [2012, 2010], 'newest class first');
  assert.deepEqual(classes[1]!.people.map((p) => p.id), ['b', 'a'], 'sorted by sort name within a class');
});

test('an undated person is left out of the chronology rather than placed in a guessed class', () => {
  const people = [person('a', 'Dated', 2010, [], []), person('b', 'Undated', null, [], [])];
  const classes = inductionClasses(people);
  assert.equal(classes.flatMap((entry) => entry.people).length, 1);
  assert.equal(undatedCount(people), 1, 'the count is reported so the omission can be stated');
});
