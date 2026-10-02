import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildPeople } from '../src/build/people.ts';
import { applyProfileEdits, composedLines, profileEditColumns, profileEditDecisions, profileEditOf, profileEditProblems, type ProfileEdit } from '../src/build/profile-edits.ts';
import { profileContentVersion, readPortraitChecksums } from '../src/build/profiles.ts';
import { dataFile } from '../src/paths.ts';

// The real collection, read once; nothing here writes.
const curated = JSON.parse(readFileSync(dataFile('cihof_curated_metadata.json'), 'utf8'));
const people = buildPeople();
const checksums = readPortraitChecksums();
const person = people.find((each) => each.id === 'alex-machaskee-2010')!;
const version = profileContentVersion(person, checksums.get(person.id) ?? '');
const current = profileEditOf(curated.inductees[person.id], person);

const quote = (cell: string) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);
const sheet = (edit: ProfileEdit, contentVersion = version, id: string = person.id) => [
  profileEditColumns.join(','),
  [id, contentVersion, edit.name, edit.sortName, edit.communities.join(';'), edit.contributions.join(';'), edit.countries.join(';'),
    edit.honoredFor, edit.contextLine, edit.portraitAlt, edit.focalPoint, 'profile-edits-review-2026-10-02', 'Checked against the record.'].map(quote).join(','),
].join('\n');
const read = (csv: string) => profileEditDecisions(csv, { people, curated, checksums });

test('an edit is written into the curated record, and the profile shows it', () => {
  const edit = { ...current, sortName: 'Machaskee, Alexander', communities: [...current.communities, 'Serbian American'], focalPoint: '50% 30%' };
  const { decisions, errors } = read(sheet(edit));
  assert.deepEqual(errors, []);
  const next = applyProfileEdits(curated, decisions, '2026-10-02T10:00:00.000Z');
  const edited = buildPeople({ curated: next }).find((each) => each.id === person.id)!;
  assert.equal(edited.sortName, 'Machaskee, Alexander');
  assert.ok(edited.communities.values.includes('Serbian American'));
  assert.equal(edited.portrait?.focalPoint, '50% 30%');
  // Its version changes, so its approval lapses until it is approved as edited.
  assert.notEqual(profileContentVersion(edited, checksums.get(person.id) ?? ''), version);
  assert.match(next.inductees[person.id].curatorNotes.at(-1), /Profile edited under profile-edits-review-2026-10-02 on 2026-10-02/);
  // Nothing else on the record changes.
  assert.deepEqual(next.inductees[person.id].profileReview, curated.inductees[person.id].profileReview);
  assert.equal(next.inductees[person.id].bioTextOverride, curated.inductees[person.id].bioTextOverride);
  assert.equal(next.inductees[person.id].image.rightsStatus, curated.inductees[person.id].image.rightsStatus);
});

test("a line in the curator's own words is credited to the curator; the generator's wording stays the generator's", () => {
  const own = { ...current, honoredFor: 'Led The Plain Dealer for two decades.' };
  const mine = applyProfileEdits(curated, read(sheet(own)).decisions, '2026-10-02T10:00:00.000Z');
  const credited = buildPeople({ curated: mine }).find((each) => each.id === person.id)!;
  assert.equal(credited.contribution?.text, 'Led The Plain Dealer for two decades.');
  assert.equal(credited.contribution?.provenance, 'curated');
  assert.equal(credited.contribution?.origin, 'profile-edits-review-2026-10-02');

  const tags = { ...current, contributions: ['Media and Storytelling'] };
  const generated = { ...tags, honoredFor: composedLines(person.id, tags).honoredFor };
  const theirs = applyProfileEdits(curated, read(sheet(generated)).decisions, '2026-10-02T10:00:00.000Z');
  const composed = buildPeople({ curated: theirs }).find((each) => each.id === person.id)!;
  assert.equal(composed.contribution?.provenance, 'generated');
  assert.equal(theirs.inductees[person.id].honoredForCurated, undefined);
});

test('a curated line is no longer credited once something else changes it', () => {
  const mine = applyProfileEdits(curated, read(sheet({ ...current, honoredFor: 'Led The Plain Dealer.' })).decisions, '2026-10-02T10:00:00.000Z');
  mine.inductees[person.id].honoredForSummary = 'Something else wrote this.';
  const after = buildPeople({ curated: mine }).find((each) => each.id === person.id)!;
  assert.notEqual(after.contribution?.provenance, 'curated');
});

test('an edit is refused over a profile changed since it began, when it changes nothing, or for nobody', () => {
  assert.match(read(sheet({ ...current, sortName: 'X, Y' }, 'profile-000000000000')).errors[0]!, /changed since this edit began/);
  assert.match(read(sheet(current)).errors[0]!, /changes nothing/);
  assert.match(read(sheet({ ...current, sortName: 'X, Y' }, version, 'nobody-1900')).errors[0]!, /no profile "nobody-1900"/);
  assert.match(read(profileEditColumns.slice(0, 3).join(',')).errors[0]!, /missing the column/);
});

test('an edit says what is wrong with it, in the curator\'s terms', () => {
  const problems = (change: Partial<ProfileEdit>) => profileEditProblems({ ...current, ...change }).join(' ');
  assert.equal(problems({}), '');
  assert.match(problems({ name: ' ' }), /The name is empty/);
  assert.match(problems({ honoredFor: 'x'.repeat(241) }), /keep it to 240/);
  assert.match(problems({ communities: ['A'] }), /too short/);
  assert.match(problems({ countries: ['Irish', 'irish'] }), /listed twice/);
  assert.match(problems({ focalPoint: 'top left' }), /not a place in the picture/);
  assert.equal(problems({ focalPoint: '50% 0%' }), '');
});

test('a community added that visitors would never see is refused; one the profile already has is left alone', () => {
  // "African" is in the curated data, but the community list leaves it out of what visitors see.
  assert.match(profileEditProblems({ ...current, communities: [...current.communities, 'African'] }, current).join(' '), /"African" is not shown to visitors/);
  assert.equal(profileEditProblems({ ...current, communities: ['African'] }, { communities: ['African'] }).join(' '), '');
  assert.equal(profileEditProblems({ ...current, communities: [...current.communities, 'European Heritage'] }, current).filter((problem) => /not shown/.test(problem)).length, 0);
});
