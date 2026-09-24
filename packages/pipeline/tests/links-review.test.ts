import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CrosswalkEntry, InductionCrosswalk } from '@cihof/content';
import { inductionRelationships, readyToConfirm, reviewProgress, reviewRemaining } from '@cihof/content';
import { buildPeople } from '../src/build/people.ts';
import { buildRuntimeBundle } from '../src/build/emit.ts';
import { buildRelationshipReviewSheet, decisionsInSheet, reviewSheetCsv } from '../src/build/review.ts';
import { readInductionCrosswalk } from '../src/sources/crosswalk.ts';

/**
 * The review sheet, against the crosswalk as it actually stands.
 *
 * These run on the committed file rather than a fixture, because the number
 * that matters — how much review is left before Connections can open — is a
 * fact about this collection and not about a shape. A fixture would keep
 * passing while the real sheet went empty.
 *
 * A real decision now exists — cur-2026-062, kiosk only, signed 2026-09-22 —
 * so these read it rather than inventing one. Where a test needs the unsigned
 * case it removes the signature from a copy, and `fixtureDecision` remains for
 * the cases that need a decision these resolutions did not make. Neither ever
 * writes an approval into `data/`: that is a curatorial act, and a test that
 * forged one would forge the record the whole model exists to require.
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

test('every recorded name has now been decided', () => {
  // 25 confirmed against corpus candidates on 2026-09-22, then the remaining
  // 70 worked through in the review portal on 2026-09-23. Nine of those turned
  // out to be in the hall — six caught by name, three more (Gerry Quinn, Mike
  // Polensek, Tom Scanlon) only against the institution's own published list,
  // because a nickname is not a string match. Nothing is left open.
  const progress = reviewProgress(sheet);
  assert.equal(progress.resolved, 95);
  assert.equal(progress.unresolved, 0);
  assert.equal(progress.relationshipsResolved, 48);
});

test('the sheet reports the lens open, and says what signed it', () => {
  const progress = reviewProgress(sheet);
  assert.equal(progress.publicationDecisionSigned, true);
  assert.equal(progress.linksCount, 48);
  assert.equal(progress.linksWouldOpen, true);
  assert.deepEqual(reviewRemaining(sheet), [], 'nothing stands between this and an open lens');
});

test('the same resolutions report a shut lens with the signature removed', () => {
  // The separation, against the real resolutions rather than a fixture: the
  // 31 are resolved either way, and only the decision makes them countable.
  const unsigned = buildRelationshipReviewSheet(withoutDecision(crosswalk), people);
  const progress = reviewProgress(unsigned);
  assert.equal(progress.relationshipsResolved, 48, 'the review work is unchanged');
  assert.equal(progress.publicationDecisionSigned, false);
  assert.equal(progress.linksCount, 0);
  assert.equal(progress.linksWouldOpen, false);
  assert.match(reviewRemaining(unsigned).join(' '), /publicationDecision/);
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
  //
  // Stated against a crosswalk with its resolutions wound back, because the
  // committed one now has every name decided and so proposes nothing. The
  // invariant is about drift between preview and record, not about how much
  // review happens to have landed.
  const open = reopened(crosswalk);
  const previewed = new Map(
    buildRelationshipReviewSheet(open, people).rows.flatMap((row) => row.proposes.map((p) => [p.id, p])),
  );
  assert.ok(previewed.size > 0, 'the wound-back sheet should propose something to compare');

  const accepted = acceptSingleCandidates(open, { publicationDecision: fixtureDecision });
  const published = new Map(
    inductionRelationships(accepted, (id) => people.find((p) => p.id === id)?.name).map((r) => [r.id, r]),
  );
  assert.ok(published.size > 0);

  // Every preview is checked against the record, rather than every record
  // against a preview. A row resolved to somebody the corpus never proposed —
  // a name typed in by a reviewer who knew the answer — publishes without ever
  // having been previewed, and that is the sheet working, not drifting.
  for (const [id, preview] of previewed) {
    const relationship = published.get(id);
    assert.ok(relationship, `${id} was previewed but never published`);
    assert.equal(preview.label, relationship.label);
    assert.equal(preview.inverseLabel, relationship.inverseLabel);
    assert.deepEqual(preview.evidence, relationship.evidence);
  }
});

/** The crosswalk as it was before anybody resolved a single-candidate row. */
function reopened(source: InductionCrosswalk): InductionCrosswalk {
  return {
    ...source,
    entries: source.entries.map((entry) => (
      entry.candidates.length === 1 ? { ...entry, resolution: { status: 'unresolved' as const } } : entry
    )),
  };
}

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
  const accepted = acceptSingleCandidates(withoutDecision(crosswalk), {});
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

/**
 * The crosswalk with its signature removed.
 *
 * Deleting the key rather than setting it undefined, so the result is the shape
 * an unsigned file really has. Spreading `{...crosswalk}` is not enough now
 * that the committed one carries a decision — the separation tests would
 * inherit it and quietly stop testing the separation.
 */
function withoutDecision(source: InductionCrosswalk): InductionCrosswalk {
  const { publicationDecision, ...rest } = source;
  void publicationDecision;
  return rest as InductionCrosswalk;
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

// -------------------------------------------- protecting a filled-in sheet

const header = 'recordedName,band,decision,inducteeId,decisionReference,note';

test('a freshly generated sheet reads as undecided', () => {
  // Otherwise the generator refuses to regenerate its own output, including
  // the rows it pre-fills `inducteeId` on because they are already resolved.
  assert.deepEqual(decisionsInSheet(reviewSheetCsv(sheet)), []);
});

test('a typed decision is found, and named so the person recognises it', () => {
  const filled = `${header}\nSam Miller,no-candidate,not-an-inductee,,cur-2026-063,`;
  assert.deepEqual(decisionsInSheet(filled), ['Sam Miller: not-an-inductee / cur-2026-063']);
});

test('a reference with no decision still counts as work in progress', () => {
  // Somebody was part-way through. Overwriting that is the same loss.
  const partial = `${header}\nSam Miller,no-candidate,,,cur-2026-063,`;
  assert.equal(decisionsInSheet(partial).length, 1);
});

test('a sheet whose columns were reordered is still read correctly', () => {
  // Spreadsheets move columns. Reading by position would find the decision in
  // the wrong cell, or miss it entirely and overwrite the file.
  const moved = 'decisionReference,decision,recordedName\ncur-2026-063,not-an-inductee,Sam Miller';
  // Reported in the order the columns were asked for, not the order the sheet
  // happens to carry them, so the message reads the same whatever a
  // spreadsheet did to the layout.
  assert.deepEqual(decisionsInSheet(moved), ['Sam Miller: not-an-inductee / cur-2026-063']);
});

test('a sheet with no decision columns refuses rather than reporting nothing', () => {
  // The dangerous answer is the empty array, which reads as "safe to
  // overwrite". An unrecognisable sheet is not a sheet with nothing in it.
  assert.equal(decisionsInSheet('something,else\n1,2').length, 1);
  assert.match(decisionsInSheet('something,else\n1,2')[0] ?? '', /refusing rather than guessing/);
});

test('an empty file is genuinely empty, not a refusal', () => {
  assert.deepEqual(decisionsInSheet(''), []);
});

test('a quoted name carrying a comma survives detection', () => {
  const quoted = `${header}\n"Wong, Margaret",no-candidate,inductee,margaret-w-wong-2010,cur-2026-063,`;
  assert.deepEqual(decisionsInSheet(quoted), ['Wong, Margaret: inductee / cur-2026-063']);
});

// ------------------------------------------------------------- presenters

test('every inductee carries the presenter the roster recorded', () => {
  // 111 of 111. The roster names somebody for each, and losing that was the
  // cost of answering "not an inductee" and nothing else.
  const withPresenter = people.filter((person) => person.presentedBy !== null);
  assert.equal(withPresenter.length, people.length);
  for (const person of withPresenter) {
    assert.ok((person.presentedBy?.recordedName ?? '').trim().length > 0, `${person.id} has a blank presenter`);
  }
});

test('a presenter is linked only where a curator resolved them to the hall', () => {
  // The same decision Connections reads, so a name printed on a record and a
  // line drawn on the map can never disagree about who it refers to.
  const crosswalk = readInductionCrosswalk();
  const resolved = new Map(
    (crosswalk?.entries ?? [])
      .filter((entry) => entry.resolution.status === 'inductee')
      .map((entry) => [entry.recordedName, (entry.resolution as { inducteeId: string }).inducteeId]),
  );
  for (const person of people) {
    const presenter = person.presentedBy;
    if (!presenter) continue;
    assert.equal(presenter.inducteeId, resolved.get(presenter.recordedName) ?? null,
      `${person.id}: presenter link disagrees with the crosswalk`);
  }
});

test('most presenters are not in the hall, and are carried as text', () => {
  // The reason this is an attribute rather than a relationship: drawing a line
  // to them would put nodes on the map with no portrait and no record behind.
  const outside = people.filter((p) => p.presentedBy && !p.presentedBy.inducteeId).length;
  assert.ok(outside > people.length / 2, `${outside} of ${people.length} presenters are outside the hall`);
});

test('a presenter is never published as a relationship', () => {
  // The whole point of choosing an attribute. Every endpoint on the Connections
  // map is somebody a visitor can open.
  const ids = new Set(people.map((person) => person.id as string));
  const bundle = buildRuntimeBundle(people, 'kiosk');
  for (const relationship of bundle.relationships) {
    assert.ok(ids.has(relationship.from as string), `${relationship.from} is not a published person`);
    assert.ok(ids.has(relationship.to as string), `${relationship.to} is not a published person`);
  }
});

test('a presenter link never points at somebody this release withholds', () => {
  const bundle = buildRuntimeBundle(people, 'public');
  const shown = new Set(bundle.people.map((person) => person.id));
  for (const person of bundle.people) {
    const id = person.presentedBy?.inducteeId;
    if (id) assert.ok(shown.has(id), `${person.id} links to ${id}, who is not in this release`);
  }
});
