import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crosswalkProgress, type InductionCrosswalk } from '@cihof/content';
import { buildInductionCrosswalk, normalizeForCandidates } from '../src/build/crosswalk.ts';

const built = buildInductionCrosswalk();

test('the crosswalk covers every roster row that names an inducter', () => {
  const rows = built.crosswalk.entries.reduce((total, entry) => total + entry.inducted.length, 0);
  assert.equal(rows, 111, 'the canonical roster is 111 rows and every one names an inducter');
  assert.equal(built.crosswalk.entries.length, 95, '95 distinct recorded names');
  assert.equal(built.droppedResolved.length, 0);
});

test('the generator resolves nothing on its own', () => {
  // It offers candidates. Nothing in this pipeline may turn a name into an
  // identity, which is the entire reason the file exists.
  const progress = crosswalkProgress(built.crosswalk);
  assert.equal(progress.unresolved, progress.total);
  assert.equal(progress.inductee, 0);
  assert.equal(progress.relationshipsAvailable, 0);
  assert.equal(built.crosswalk.publicationDecision, undefined);
});

test('candidates say they are only a string match', () => {
  const withCandidates = built.crosswalk.entries.filter((entry) => entry.candidates.length > 0);
  assert.equal(withCandidates.length, 21, 'names that also appear as an inductee display name');
  for (const entry of withCandidates) {
    for (const candidate of entry.candidates) {
      assert.equal(candidate.basis, 'normalised-name');
    }
  }
});

test('an honorific in the record does not hide the candidate', () => {
  const khoury = built.crosswalk.entries.find((entry) => entry.recordedName === 'Dr. Wael Khoury');
  assert.ok(khoury, 'the roster records this inducter with a title');
  assert.deepEqual(khoury.candidates.map((candidate) => candidate.inducteeId), ['wael-khoury-2017']);
  assert.equal(normalizeForCandidates('The Hon. Dr. José Ramírez-O’Neill'), 'jose ramirez o neill');
});

test('a name nobody in the hall carries is offered no candidate', () => {
  const miller = built.crosswalk.entries.find((entry) => entry.recordedName === 'Sam Miller');
  assert.ok(miller);
  assert.deepEqual(miller.candidates, [], 'a real person, but not an inductee');
  assert.equal(miller.inducted.length, 4, 'and the most-used name in the roster');
});

test('the recorded name is preserved verbatim rather than tidied', () => {
  const recorded = built.crosswalk.entries.map((entry) => entry.recordedName);
  assert.ok(recorded.includes('Dr. Wael Khoury'), 'titles are kept, not stripped from the record');
  for (const name of recorded) assert.equal(name, name.trim());
});

test('a refresh carries resolutions forward and leaves the roster parts rebuilt', () => {
  const resolvedOnce: InductionCrosswalk = {
    ...built.crosswalk,
    entries: built.crosswalk.entries.map((entry) => entry.recordedName === 'Alex Machaskee'
      ? { ...entry, resolution: { status: 'inductee', inducteeId: 'alex-machaskee-2010' as never, decisionReference: 'cur-1' } }
      : entry),
  };
  const again = buildInductionCrosswalk(resolvedOnce);
  const machaskee = again.crosswalk.entries.find((entry) => entry.recordedName === 'Alex Machaskee')!;
  assert.equal(machaskee.resolution.status, 'inductee', 'review work survives a regeneration');
  assert.equal(crosswalkProgress(again.crosswalk).unresolved, 94);
  assert.deepEqual(again.added, [], 'nothing is new the second time');
});

test('a resolution pointing at somebody off the roster is sent back for review', () => {
  const stale: InductionCrosswalk = {
    ...built.crosswalk,
    entries: built.crosswalk.entries.map((entry) => entry.recordedName === 'Alex Machaskee'
      ? { ...entry, resolution: { status: 'inductee', inducteeId: 'someone-who-left-2009' as never, decisionReference: 'cur-1' } }
      : entry),
  };
  const again = buildInductionCrosswalk(stale);
  const machaskee = again.crosswalk.entries.find((entry) => entry.recordedName === 'Alex Machaskee')!;
  assert.equal(machaskee.resolution.status, 'unresolved',
    'a decision that no longer points at anybody is not carried forward as though it held');
});

test('a resolved name vanishing from the roster is reported, not discarded', () => {
  const withGhost: InductionCrosswalk = {
    ...built.crosswalk,
    entries: [
      ...built.crosswalk.entries,
      {
        id: 'inducter:someone-removed', recordedName: 'Someone Removed',
        inducted: [] as never, candidates: [],
        resolution: { status: 'not-an-inductee', decisionReference: 'cur-9' },
      },
    ],
  };
  const again = buildInductionCrosswalk(withGhost);
  assert.deepEqual(again.droppedResolved, ['Someone Removed']);
});

test('the publication decision survives a refresh', () => {
  const decided: InductionCrosswalk = {
    ...built.crosswalk,
    publicationDecision: { decisionReference: 'cur-7', contentVersion: 'v1', publication: { publicWeb: false, kiosk: true } },
  };
  assert.deepEqual(buildInductionCrosswalk(decided).crosswalk.publicationDecision, decided.publicationDecision);
});
