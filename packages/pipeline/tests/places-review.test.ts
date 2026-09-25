import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placeReviewProgress, placeReviewRemaining, publishedPlaceAssociations, publishedPlaces } from '@cihof/content';
import { buildPeople } from '../src/build/people.ts';
import { buildRuntimeBundle } from '../src/build/emit.ts';
import { buildPlaceReviewSheet, placeReviewSheetCsv, placeTiesSheetCsv } from '../src/build/review.ts';
import { readPlaceAssociations, readPlaceSeeds } from '../src/sources/places.ts';
import { placeTextVersion } from '../src/build/place-text.ts';

/**
 * Places, against the collection as it actually stands.
 *
 * Eighty-two places and eighty-six ties arrived from the HOF_WORLD v3 archive,
 * unreviewed. Reviewers have approved some since, and will approve more. The
 * point of these is that volume does not substitute for review, so the
 * threshold tests start from the sheet with every review cleared.
 */
const people = buildPeople();
const seeds = readPlaceSeeds();
const ties = readPlaceAssociations();
const sheet = buildPlaceReviewSheet(seeds, ties, people);
const unreviewed = {
  ...sheet,
  rows: sheet.rows.map((row) => ({ ...row, reviewed: false, ties: row.ties.map((tie) => ({ ...tie, role: null })) })),
};

const approved = { status: 'approved', decisionReference: 'fixture', contentVersion: 'fixture-v1' } as const;
const everywhere = { publicWeb: true, kiosk: true };
/** A place approved in the words it has: the approval names their fingerprint. */
const approvedPlace = <T extends { name: string; neighborhood?: string; shortHistory?: string }>(place: T) =>
  ({ ...place, review: { ...approved, contentVersion: placeTextVersion(place) }, publication: everywhere });

test('the ingest landed, and only reviewed places and roled ties are publishable', () => {
  assert.equal(seeds.length, 82);
  assert.equal(ties.length, 86);
  const reviewedWithHistory = (seeds as Array<Record<string, unknown>>)
    .filter((seed) => seed['review'] && String(seed['shortHistory'] ?? '').trim().length > 0).map((seed) => seed['id']);
  for (const place of publishedPlaces(seeds, 'kiosk')) {
    assert.ok(reviewedWithHistory.includes(place.id), `${place.id} is published without a review and a history`);
  }
  for (const tie of publishedPlaceAssociations(ties, 'kiosk')) {
    assert.ok(typeof tie.role === 'string' && tie.role.length > 0, 'a published tie says what the person did there');
  }
});

test('a lead is separated from a place somebody wrote a history for', () => {
  // Sixty-eight of the eighty-two are names a harvester found. Mixing them into
  // the review queue would put sixty-eight blank rows in front of a reviewer.
  const progress = placeReviewProgress(sheet);
  assert.equal(progress.places, 82);
  assert.equal(progress.researched, 14);
  assert.equal(progress.leads, 68);
});

test('a reviewed lead still does not count towards the lens', () => {
  // The trap: eighty-two places and a threshold of eight invites approving
  // whatever is nearest. A place with no history publishes a name and a blank
  // paragraph, so approval alone is not enough.
  const withLeadsApproved = {
    ...unreviewed,
    rows: unreviewed.rows.map((row) => (row.band === 'lead' ? { ...row, reviewed: true } : row)),
  };
  const progress = placeReviewProgress(withLeadsApproved);
  assert.equal(progress.reviewed, 68);
  assert.equal(progress.publishable, 0, 'a history is required, not just a signature');
  assert.equal(progress.placesWouldOpen, false);
});

test('the lens opens on eight reviewed places that have a history', () => {
  let remaining = 8;
  const rows = unreviewed.rows.map((row) => {
    if (row.band !== 'researched' || remaining === 0) return row;
    remaining -= 1;
    return { ...row, reviewed: true };
  });
  const progress = placeReviewProgress({ ...unreviewed, rows });
  assert.equal(progress.publishable, 8);
  assert.equal(progress.placesWouldOpen, true);
});

test('the sheet names both things standing in the way', () => {
  const remaining = placeReviewRemaining(unreviewed);
  assert.equal(remaining.length, 2);
  assert.match(remaining.join(' '), /8 places are reviewed/);
  assert.match(remaining.join(' '), /no role/);
});

test('the places sheet asks one question per place, and answers none of them', () => {
  const csv = placeReviewSheetCsv(sheet);
  const [header = '', ...rows] = csv.trim().split('\n');
  const columns = header.split(',');
  assert.ok(columns.includes('approve'));
  assert.ok(columns.includes('decisionReference'));
  // Roles live on the ties sheet. A roles column here would be a list a
  // curator has to keep in the same order as a list they cannot see.
  assert.ok(!columns.includes('roles'), 'roles are not a place-level decision');
  assert.equal(rows.length, 82, 'one row per place');

  const approve = columns.indexOf('approve');
  const reference = columns.indexOf('decisionReference');
  for (const row of rows) {
    const cells = splitRow(row);
    assert.equal(cells[approve], '', 'a pre-filled approval is not an approval');
    assert.equal(cells[reference], '', 'a generated reference traces to nobody');
  }
});

test('the ties sheet asks one question per tie, and answers none of them', () => {
  const csv = placeTiesSheetCsv(sheet);
  const [header = '', ...rows] = csv.trim().split('\n');
  const columns = header.split(',');
  assert.equal(rows.length, 86, 'one row per tie');

  // The harvested verb is shown as a prompt and kept out of the answer: being
  // born somewhere is not the claim that you lived there.
  assert.ok(columns.includes('harvestedKind'));
  const role = columns.indexOf('role');
  const kind = columns.indexOf('harvestedKind');
  assert.ok(role > 0 && kind > 0 && role !== kind);
  for (const row of rows) {
    const cells = splitRow(row);
    assert.equal(cells[role], '', 'a pre-filled role is not a decision');
    assert.ok((cells[kind] ?? '').length > 0, 'the prompt is there to read');
  }
});

test('a place shows the people whose tie carries a role, and only those', () => {
  const place = approvedPlace({ id: 'place:fixture', name: 'Fixture Gardens', shortHistory: 'A history.', neighborhood: 'Rockefeller Park' });
  const withRole = {
    id: 'tie-1', person: people[0]!.id, place: 'place:fixture', role: 'organized',
    review: approved, publication: everywhere, evidence: [{ id: 'e1', title: 'A source', kind: 'collection-record' }],
  };
  const withoutRole = { ...withRole, id: 'tie-2', person: people[1]!.id, role: 'associated' };

  const bundle = buildRuntimeBundle(people, 'kiosk', {
    places: [place], placeAssociations: [withRole, withoutRole], crosswalk: null,
  });
  const published = bundle.places.find((entry) => entry.id === 'place:fixture');
  assert.ok(published);
  // 'associated' is refused upstream: it does not say what the person did there.
  assert.deepEqual(published.personIds, [people[0]!.id]);
});

test('a reviewed place with no reviewed tie is still a place', () => {
  const place = approvedPlace({ id: 'place:quiet', name: 'Quiet Square', shortHistory: 'A history.', neighborhood: 'Downtown' });
  const bundle = buildRuntimeBundle(people, 'kiosk', { places: [place], placeAssociations: [], crosswalk: null });
  const published = bundle.places.find((entry) => entry.id === 'place:quiet');
  assert.ok(published, 'the place is shown');
  assert.deepEqual(published.personIds, [], 'with nobody under it, rather than being hidden');
});

test('eight reviewed places open the lens through the real build', () => {
  const eight = Array.from({ length: 8 }, (_, index) => approvedPlace({
    id: `place:fixture-${index}`, name: `Fixture ${index}`, shortHistory: 'A history.', neighborhood: 'Somewhere',
  }));
  const short = buildRuntimeBundle(people, 'kiosk', { places: eight.slice(0, 7), crosswalk: null });
  assert.equal(short.lenses.includes('places'), false, '7 is below the threshold of 8');
  const enough = buildRuntimeBundle(people, 'kiosk', { places: eight, crosswalk: null });
  assert.equal(enough.lenses.includes('places'), true, 'the lens appears without a code change');
});

function splitRow(row: string): string[] {
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

test('the researched flag agrees with whether a history exists', () => {
  // It was written onto the 68 ingested places and left off the 14 that were
  // already here, so the field read backwards for exactly the records it was
  // meant to mark. Nothing behaved wrongly — the review sheet bands on
  // `shortHistory` — but a field that disagrees with the thing it describes is
  // a trap for whoever reads it next.
  for (const place of seeds as { id: string; shortHistory?: string; researched?: boolean }[]) {
    const hasHistory = String(place.shortHistory ?? '').trim().length > 0;
    assert.equal(place.researched, hasHistory, `${place.id} is marked ${place.researched} with history=${hasHistory}`);
  }
  assert.equal(seeds.filter((p) => (p as { researched?: boolean }).researched).length, 14);
});
