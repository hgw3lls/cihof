import assert from 'node:assert/strict';
import { test } from 'node:test';
import { worksheetProgress, type ContributionWorksheet } from '@cihof/content';
import { buildPeople } from '../src/build/people.ts';
import { buildRuntimeBundle } from '../src/build/emit.ts';
import { buildContributionWorksheet } from '../src/build/worksheet.ts';
import { readContributionWorksheet } from '../src/sources/worksheet.ts';

const people = buildPeople();
const built = buildContributionWorksheet(people);
const subject = people[0]!.id;

const approved = { status: 'approved', decisionReference: 'cur-2026-051', contentVersion: 'v6' } as const;
const everywhere = { publicWeb: true, kiosk: true };

const written = {
  id: 'con-fixture' as never, subject: subject as never,
  action: { text: 'Founded the language school at the Slovenian National Home', provenance: 'curated' as const, origin: 'cur-2026-051' },
  occurred: { precision: 'year' as const, start: '1972' },
  outcomes: [{ kind: 'organization' as const, name: 'Slovenian National Home language school' }],
  review: approved, publication: everywhere,
  evidence: [{ id: 'ev-w', title: 'Fixture collection record', kind: 'collection-record' as const }],
};

test('the worksheet covers the roster and starts empty', () => {
  assert.equal(built.worksheet.entries.length, 111);
  const progress = worksheetProgress(built.worksheet);
  assert.equal(progress.notStarted, 111);
  assert.equal(progress.written, 0);
  assert.equal(built.orphaned.length, 0);
});

test('every row carries the biography a curator writes from', () => {
  // The sheet cannot draft an account, but it can put the source in front of
  // whoever is writing one.
  const withSource = built.worksheet.entries.filter((entry) => entry.sourceBiography.length > 0);
  assert.equal(withSource.length, 111, 'every person has the institution’s own text');
});

test('the sheet never offers a generated line as source material', () => {
  // `honoredForSummary` is machine-composed for all 111. It appears as the
  // current summary, so the gap is visible, and never as the biography.
  for (const entry of built.worksheet.entries) {
    assert.notEqual(entry.sourceBiography, entry.currentSummary);
  }
});

test('a refresh keeps what was written and rebuilds only the reference columns', () => {
  const edited: ContributionWorksheet = {
    ...built.worksheet,
    entries: built.worksheet.entries.map((entry) => entry.subject === subject
      ? { ...entry, status: 'ready-for-review' as const, contributions: [written], sourceBiography: 'stale text' }
      : entry),
  };
  const again = buildContributionWorksheet(people, edited);
  const row = again.worksheet.entries.find((entry) => entry.subject === subject)!;
  assert.equal(row.status, 'ready-for-review', 'the status is the curator’s');
  assert.equal(row.contributions.length, 1, 'so is what they wrote');
  assert.notEqual(row.sourceBiography, 'stale text', 'the biography comes back from the source');
  assert.deepEqual(again.added, []);
});

test('a written row whose subject left the roster is reported, not discarded', () => {
  const withGhost: ContributionWorksheet = {
    ...built.worksheet,
    entries: [
      ...built.worksheet.entries,
      { subject: 'someone-removed-2009' as never, displayName: 'Someone Removed', classYear: 2009,
        sourceBiography: '', currentSummary: '', status: 'ready-for-review', contributions: [written] },
    ],
  };
  assert.deepEqual(buildContributionWorksheet(people, withGhost).orphaned, ['someone-removed-2009']);
});

test('an untouched row that left the roster is simply dropped', () => {
  const withEmpty: ContributionWorksheet = {
    ...built.worksheet,
    entries: [
      ...built.worksheet.entries,
      { subject: 'never-written-2009' as never, displayName: 'Never Written', classYear: 2009,
        sourceBiography: '', currentSummary: '', status: 'not-started', contributions: [] },
    ],
  };
  assert.deepEqual(buildContributionWorksheet(people, withEmpty).orphaned, [],
    'nobody spent anything on that row');
});

test('the collection as it stands publishes no contribution', () => {
  const bundle = buildRuntimeBundle(people, 'kiosk');
  assert.equal(bundle.contributions.length, 0);
  assert.equal(bundle.contributionReport.peopleNotStarted, 111);
  assert.equal(bundle.contributionReport.written, 0);
});

test('a written and approved contribution reaches the bundle', () => {
  const filled: ContributionWorksheet = {
    ...built.worksheet,
    entries: built.worksheet.entries.map((entry) => entry.subject === subject
      ? { ...entry, status: 'ready-for-review' as const, contributions: [written] }
      : entry),
  };
  const bundle = buildRuntimeBundle(people, 'kiosk', { worksheet: filled });
  assert.equal(bundle.contributions.length, 1);
  assert.equal(bundle.contributions[0]?.subject, subject);
  assert.equal(bundle.contributionReport.peopleCovered, 1);
  assert.equal(bundle.contributionReport.written, 1);
});

test('an approval for the kiosk does not put the account on the public site', () => {
  const kioskOnly: ContributionWorksheet = {
    ...built.worksheet,
    entries: built.worksheet.entries.map((entry) => entry.subject === subject
      ? { ...entry, status: 'ready-for-review' as const,
          contributions: [{ ...written, publication: { publicWeb: false, kiosk: true } }] }
      : entry),
  };
  assert.equal(buildRuntimeBundle(people, 'kiosk', { worksheet: kioskOnly }).contributions.length, 1);
  assert.equal(buildRuntimeBundle(people, 'public', { worksheet: kioskOnly }).contributions.length, 0);
});

test('an honorific never reaches the bundle however the row is marked', () => {
  const honorific: ContributionWorksheet = {
    ...built.worksheet,
    entries: built.worksheet.entries.map((entry) => entry.subject === subject
      ? { ...entry, status: 'ready-for-review' as const,
          contributions: [{ ...written, outcomes: [], action: { text: 'A distinguished leader', provenance: 'generated' as const } }] }
      : entry),
  };
  assert.equal(buildRuntimeBundle(people, 'kiosk', { worksheet: honorific }).contributions.length, 0);
});

test('the committed worksheet is readable by the build', () => {
  const worksheet = readContributionWorksheet();
  assert.ok(worksheet, 'the generated file is present and parses');
  assert.equal(worksheet.entries.length, 111);
});
