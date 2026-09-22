import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CrosswalkEntry, InductionCrosswalk } from '@cihof/content';
import { inductionRelationships, readyToConfirm, reviewProgress } from '@cihof/content';
import { buildPeople } from '../src/build/people.ts';
import { buildRuntimeBundle } from '../src/build/emit.ts';
import { buildRelationshipReviewSheet, reviewSheetCsv } from '../src/build/review.ts';
import { readInductionCrosswalk } from '../src/sources/crosswalk.ts';

/**
 * The review sheet, against the crosswalk as it actually stands.
 *
 * These run on the committed file rather than a fixture, because the number
 * that matters — how much review is left before Connections can open — is a
 * fact about this collection and not about a shape. A fixture would keep
 * passing while the real sheet went empty.
 *
 * The publication decision *is* a fixture, and deliberately so: signing one is
 * a curatorial act, and a test that wrote a real-looking approval into `data/`
 * would forge exactly the record the whole model exists to require.
 */
const people = buildPeople();
const crosswalk = readInductionCrosswalk();
assert.ok(crosswalk, 'the committed crosswalk should be readable');

/** Not a decision. A stand-in, so the gate downstream of one can be exercised. */
const fixtureDecision = {
  decisionReference: 'FIXTURE-NOT-A-REAL-DECISION',
  contentVersion: 'FIXTURE',
  publication: { publicWeb: false, kiosk: true },
};

const sheet = buildRelationshipReviewSheet(crosswalk, people);

test('the sheet covers every recorded name, not only the answerable ones', () => {
  // Showing the 25 easy rows and hiding the other 70 would make the work look
  // a third of its actual size.
  const progress = reviewProgress(sheet);
  assert.equal(progress.names, crosswalk.entries.length);
  assert.equal(progress.singleCandidate + progress.ambiguous + progress.noCandidate, progress.names);
  assert.ok(progress.noCandidate > 0, 'rows the corpus could not help with are present');
});

test('the collection as it stands has every name still to review', () => {
  const progress = reviewProgress(sheet);
  assert.equal(progress.resolved, 0);
  assert.equal(progress.relationshipsResolved, 0);
  assert.equal(progress.publicationDecisionSigned, false);
  assert.equal(progress.linksCount, 0);
  assert.equal(progress.linksWouldOpen, false);
});

test('an ambiguous row proposes nothing', () => {
  // Composing one of several readings would put a thumb on the scale the
  // reviewer is there to hold.
  for (const row of sheet.rows) {
    if (row.band === 'ambiguous' || row.band === 'no-candidate') {
      assert.deepEqual(row.proposes, [], `${row.recordedName} should propose nothing`);
    }
  }
});

test('the preview is the record, not a rendering of it', () => {
  // The sheet shows a curator what their signature publishes. If it composed
  // its own wording, the sheet could show one label and the build emit
  // another, and nobody would find out until it was on a wall.
  const accepted = acceptSingleCandidates(crosswalk, { publicationDecision: fixtureDecision });
  const published = inductionRelationships(accepted, (id) => people.find((p) => p.id === id)?.name);
  const previewed = new Map(sheet.rows.flatMap((row) => row.proposes.map((p) => [p.id, p])));

  assert.ok(published.length > 0);
  for (const relationship of published) {
    const preview = previewed.get(relationship.id);
    assert.ok(preview, `${relationship.id} was published but never previewed`);
    assert.equal(preview.label, relationship.label);
    assert.equal(preview.inverseLabel, relationship.inverseLabel);
    assert.deepEqual(preview.evidence, relationship.evidence);
  }
});

test('the generated sheet carries no decision of its own', () => {
  // The columns a person has to fill in are generated empty, every time.
  const csv = reviewSheetCsv(sheet);
  const [header = '', ...rows] = csv.trim().split('\n');
  const columns = header.split(',');
  const decision = columns.indexOf('decision');
  const reference = columns.indexOf('decisionReference');
  assert.ok(decision > 0 && reference > 0);
  for (const row of rows) {
    const cells = splitCsvRow(row);
    assert.equal(cells[decision], '', 'a pre-filled decision is not a decision');
    assert.equal(cells[reference], '', 'a generated decision reference traces to nobody');
  }
});

test('a recorded name carrying a comma survives the round trip', () => {
  // Names are copied from the roster untouched and some carry punctuation. A
  // mangled one sends a reviewer looking for somebody the roster never names.
  const awkward = sheet.rows.find((row) => row.recordedName.includes(','));
  if (!awkward) return;
  const line = reviewSheetCsv(sheet).split('\n').find((row) => row.includes(awkward.recordedName));
  assert.ok(line, 'the name should appear in the sheet');
  assert.equal(splitCsvRow(line)[0], awkward.recordedName);
});

// ------------------------------------------------------------- the lens gate

test('confirming the unambiguous candidates alone would clear the threshold', () => {
  // The finding this whole piece of work rests on: the collection can open
  // Connections from what is already committed, with no new material.
  const accepted = acceptSingleCandidates(crosswalk, {});
  const previewed = buildRelationshipReviewSheet(accepted, people);
  const progress = reviewProgress(previewed);
  assert.ok(
    progress.relationshipsResolved >= 15,
    `confirming ${readyToConfirm(sheet).length} rows yields ${progress.relationshipsResolved}, which must reach 15`,
  );
});

test('confirming them without a publication decision still publishes nothing', () => {
  const accepted = acceptSingleCandidates(crosswalk, {});
  const bundle = buildRuntimeBundle(people, 'kiosk', { crosswalk: accepted });
  assert.equal(bundle.relationships.length, 0, 'resolving a name is not permission to show it');
  assert.equal(bundle.lenses.includes('links'), false);
  assert.equal(bundle.relationshipReport.crosswalkApproved, false);
});

test('Connections opens once both the confirmations and a decision exist', () => {
  const accepted = acceptSingleCandidates(crosswalk, { publicationDecision: fixtureDecision });
  const bundle = buildRuntimeBundle(people, 'kiosk', { crosswalk: accepted });

  assert.equal(bundle.lenses.includes('links'), true, 'the lens appears without a code change');
  assert.ok(bundle.relationships.length >= 15, `${bundle.relationships.length} relationships should reach the threshold`);
  assert.equal(bundle.relationshipReport.crosswalkApproved, true);

  const links = bundle.lensReport.find((lens) => lens.id === 'links');
  assert.equal(links?.available, true);
  assert.equal(links?.count, bundle.relationships.length);
});

test('every relationship the lens would show carries evidence and both labels', () => {
  const accepted = acceptSingleCandidates(crosswalk, { publicationDecision: fixtureDecision });
  const bundle = buildRuntimeBundle(people, 'kiosk', { crosswalk: accepted });
  for (const relationship of bundle.relationships) {
    assert.equal(relationship.claim, 'documented');
    assert.ok(relationship.label.trim().length > 0, `${relationship.id} has no label`);
    // `inducted` is directional, so reading the forward label from the far end
    // would reverse the claim. Both ends must be worded.
    assert.ok(relationship.inverseLabel?.trim().length, `${relationship.id} has no inverse label`);
    assert.ok(relationship.evidence.length > 0, `${relationship.id} cites nothing`);
    assert.notEqual(relationship.from, relationship.to);
  }
});

test('a kiosk decision leaves Connections closed on the public target', () => {
  // The relationships name living people and rest on sources reviewed for a
  // room, not for the open web. The two targets are decided separately.
  const accepted = acceptSingleCandidates(crosswalk, { publicationDecision: fixtureDecision });
  assert.equal(buildRuntimeBundle(people, 'kiosk', { crosswalk: accepted }).lenses.includes('links'), true);

  const publicBundle = buildRuntimeBundle(people, 'public', { crosswalk: accepted });
  assert.equal(publicBundle.lenses.includes('links'), false);
  assert.equal(publicBundle.relationships.length, 0);
});

/**
 * Accepts every row the corpus offered exactly one candidate for.
 *
 * What a curator would be doing in the sheet, done here so the gate downstream
 * can be tested. The decision reference says what it is.
 */
function acceptSingleCandidates(
  source: InductionCrosswalk,
  over: Partial<InductionCrosswalk>,
): InductionCrosswalk {
  const entries: CrosswalkEntry[] = source.entries.map((entry) => (
    entry.candidates.length === 1 && entry.resolution.status === 'unresolved'
      ? {
        ...entry,
        resolution: {
          status: 'inductee' as const,
          inducteeId: entry.candidates[0]!.inducteeId,
          decisionReference: 'FIXTURE-NOT-A-REAL-DECISION',
        },
      }
      : entry
  ));
  return { ...source, entries, ...over };
}

/** Splits one generated row. The generator only ever quotes whole cells. */
function splitCsvRow(row: string): string[] {
  const cells: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    if (char === '"') {
      if (quoted && row[index + 1] === '"') { value += '"'; index += 1; continue; }
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) { cells.push(value); value = ''; continue; }
    value += char;
  }
  cells.push(value);
  return cells;
}
