import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPeople } from '../src/build/people.ts';
import {
  applyProfileDecisions, buildProfileSheet, profileContentVersion, profileDecisions, profileSheetCsv, profileState,
} from '../src/build/profiles.ts';

const people = buildPeople();
const person = people[0]!;
const rows = buildProfileSheet([person], new Map(), new Map());
const sheet = (decision: string, over: { note?: string; version?: string; reference?: string } = {}) =>
  profileSheetCsv(rows).replace(
    /,,,\n$/,
    `,${decision},${over.reference ?? 'profiles-review-2026-10-01'},${over.note ?? ''}\n`,
  ).replace(rows[0]!.contentVersion, over.version ?? rows[0]!.contentVersion);

test('the version changes with anything a visitor sees, and only that', () => {
  const version = profileContentVersion(person, 'abc');
  assert.equal(profileContentVersion({ ...person }, 'abc'), version);
  assert.notEqual(profileContentVersion({ ...person, name: `${person.name}.` }, 'abc'), version);
  assert.notEqual(profileContentVersion({ ...person, biography: { ...person.biography!, text: 'Another text.' } }, 'abc'), version);
  assert.notEqual(profileContentVersion(person, 'a replaced portrait file'), version);
  const other = person.biography!.provenance === 'curated' ? 'source' : 'curated';
  assert.notEqual(profileContentVersion({ ...person, biography: { ...person.biography!, provenance: other } }, 'abc'), version,
    'the same words credited differently are a different profile');
});

test('an approval reads as approved until the profile changes', () => {
  const review = { status: 'approved' as const, decisionReference: 'r', contentVersion: 'profile-1', reviewedAt: 't' };
  assert.equal(profileState(undefined, 'profile-1'), 'unreviewed');
  assert.equal(profileState(review, 'profile-1'), 'approved');
  assert.equal(profileState(review, 'profile-2'), 'changed-since-approval');
  assert.equal(profileState({ ...review, status: 'changes-requested' }, 'profile-1'), 'changes-requested');
});

test('an approval covers the profile as the reviewer saw it, or is refused', () => {
  const ok = profileDecisions(sheet('approve'), rows);
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.decisions[0]?.status, 'approved');
  const stale = profileDecisions(sheet('approve', { version: 'profile-000000000000' }), rows);
  assert.match(stale.errors[0] ?? '', /changed since this sheet was made/);
});

test('a request for changes says what, and every decision names its reference', () => {
  assert.match(profileDecisions(sheet('changes'), rows).errors[0] ?? '', /say in the note what needs changing/);
  assert.match(profileDecisions(sheet('approve', { reference: '' }), rows).errors[0] ?? '', /no decisionReference/);
  assert.equal(profileDecisions(sheet('changes', { note: 'Wrong class year' }), rows).decisions[0]?.status, 'changes-requested');
});

test('a request for changes keeps the version the reviewer saw, even if the profile moved on', () => {
  const [decision] = profileDecisions(sheet('changes', { note: 'Portrait is wrong', version: 'profile-seen0000000' }), rows).decisions;
  assert.equal(decision?.contentVersion, 'profile-seen0000000');
});

test('the decision is written beside the legacy status, which follows it', () => {
  const { decisions } = profileDecisions(sheet('approve'), rows);
  const next = applyProfileDecisions({ inductees: { [person.id]: { approvalStatus: 'draft' } } }, decisions, '2026-10-01T00:00:00Z');
  const record = next.inductees[person.id]!;
  assert.equal(record['approvalStatus'], 'approved');
  assert.deepEqual(record['profileReview'], {
    status: 'approved', decisionReference: 'profiles-review-2026-10-01',
    contentVersion: rows[0]!.contentVersion, reviewedAt: '2026-10-01T00:00:00Z',
  });
});

test('every person has a profile row', () => {
  assert.equal(buildProfileSheet(people).length, people.length);
});
