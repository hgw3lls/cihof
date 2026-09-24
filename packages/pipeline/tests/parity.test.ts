import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { buildPeople } from '../src/build/people.ts';

/**
 * Parity against the artifact the old pipeline published.
 *
 * A from-scratch generator can silently drop a curatorial decision, and nothing
 * about the output would look wrong. This compares the rewritten assembly
 * field-by-field against the last record the old pipeline published. Every
 * difference must be either absent or listed below with a reason.
 *
 * The reference is a frozen fixture rather than the old pipeline's live output,
 * which was regenerated on every build: comparing against it meant the oracle
 * moved whenever the thing it was meant to check moved, and a regeneration
 * could absorb a dropped decision without the test noticing. The old pipeline
 * has since been retired, so the fixture is now the only record of what it
 * published.
 *
 * When this test fails, the finding is the difference. Re-snapshotting the
 * fixture to make it pass discards exactly the evidence it exists to produce.
 */
const fixture = resolve(fileURLToPath(new URL('.', import.meta.url)), 'fixtures/published-runtime-data.json');

const published = JSON.parse(readFileSync(fixture, 'utf8'))
  .inductees as Array<Record<string, unknown>>;

const rebuilt = new Map(buildPeople().map((person) => [person.id as string, person]));

test('the same people, by canonical id', () => {
  const publishedIds = new Set(published.map((person) => String(person['id'])));
  const rebuiltIds = new Set(rebuilt.keys());
  assert.deepEqual([...publishedIds].filter((id) => !rebuiltIds.has(id)), [], 'people lost by the rewrite');
  assert.deepEqual([...rebuiltIds].filter((id) => !publishedIds.has(id)), [], 'people invented by the rewrite');
  assert.equal(rebuiltIds.size, 111);
});

/**
 * Differences a curator has looked at and intends.
 *
 * The fixture is the record as the old pipeline published it, and it is frozen
 * on purpose. When curated content is corrected the rebuild will rightly differ
 * from it, and the honest way to record that is here — naming the difference
 * and why — rather than by re-snapshotting the fixture, which would discard
 * the evidence this test exists to produce.
 *
 * An entry is a decision, so it carries who decided and when. Anything not
 * listed still fails.
 */
const reviewedDifferences = new Set([
  // Heritage corrections supplied by the project owner, 2026-09-22.
  'bill-miller-2017.countryTags: published [Slovenian] -> rebuilt [Polish, German]',
  'ralph-j-perk-2011.countryTags: published [Czech] -> rebuilt [Czech, Slovak]',
  // Pogue was inducted on a community basis and the record said no nationality
  // tag was assigned. That decision was revisited, not overlooked.
  'dick-pogue-2015.countryTags: published [] -> rebuilt [Scotch-Irish]',
  // Sort-name repairs requested by the project owner, 2026-09-24. The old
  // generator took the last word as the surname, so life dates and alternate
  // names in parentheses became surnames, a suffix left a doubled comma, and one
  // honorific was kept. These are the "Last, First" forms the other 107 use.
  'helen-karpinski-1899-2002-2010.sortName: published "2002), Helen Karpinski (1899 –" -> rebuilt "Karpinski, Helen"',
  'reverend-dr-otis-moss-jr-2011.sortName: published "Moss,, Dr. Otis" -> rebuilt "Moss, Otis, Jr."',
  'anthony-yen-yan-yuan-tai-2012.sortName: published "Tai), Anthony Yen (Yan Yuan" -> rebuilt "Yen, Anthony"',
  'honorable-jose-a-villanueva-2015.sortName: published "Villanueva, Honorable José A." -> rebuilt "Villanueva, José A."',
]);

function collectDifferences(): string[] {
  const differences: string[] = [];

  for (const person of published) {
    const id = String(person['id']);
    const next = rebuilt.get(id);
    if (!next) continue;

    compare(differences, id, 'name', person['name'], next.name);
    compare(differences, id, 'sortName', person['sortName'], next.sortName);
    compare(differences, id, 'classYear', person['classYear'], next.classYear);
    compare(differences, id, 'profileUrl', person['profileUrl'] || null, next.sourceUrl);
    compare(differences, id, 'primaryImageUrl', person['primaryImageUrl'], next.portrait?.src ?? null);
    compare(differences, id, 'imageRightsStatus', person['imageRightsStatus'], next.portrait?.rights ?? null);
    compare(differences, id, 'bioText', String(person['bioText'] ?? '').trim(), next.biography?.text ?? '');
    compare(differences, id, 'honoredForSummary', String(person['honoredForSummary'] ?? '').trim(), next.contribution?.text ?? '');
    compare(differences, id, 'documentedContextLine', String(person['documentedContextLine'] ?? '').trim(), next.context?.text ?? '');
    compareList(differences, id, 'themeTags', person['themeTags'], next.contributions.values);
    compareList(differences, id, 'communityTags', person['communityTags'], next.communities.values);
    compareList(differences, id, 'countryTags', person['countryTags'], next.countries.values);
  }

  return differences;
}

test('every published field the web needs is reproduced', () => {
  const differences = collectDifferences();
  const unexplained = differences.filter((difference) => !reviewedDifferences.has(difference));
  assert.deepEqual(unexplained.slice(0, 12), [], `${unexplained.length} unexplained field differences`);
});

test('every reviewed difference is still a real difference', () => {
  // An entry that stops matching has been fixed, reverted, or mistyped, and
  // leaving it here would quietly excuse a future regression that happened to
  // read the same way.
  const differences = new Set(collectDifferences());
  for (const reviewed of reviewedDifferences) {
    assert.ok(differences.has(reviewed), `no longer differs, so remove it from the list: ${reviewed}`);
  }
});

test('provenance is recorded for text the published record left unmarked', () => {
  const people = [...rebuilt.values()];
  const count = (field: 'biography' | 'contribution' | 'context', provenance: string) =>
    people.filter((person) => person[field]?.provenance === provenance).length;

  // Twelve people have a curator-written bioTextOverride replacing the harvested
  // biography. The published record stores both as plain strings, so nothing in
  // it distinguishes the institution's text from a curator's rewrite.
  assert.equal(count('biography', 'curated'), 12);
  assert.equal(count('biography', 'source'), 99);

  // Both of these are documented in the roster's own reviewGuidance as
  // curator-written. Every one of the 111 is machine-composed: 35 match the
  // generator exactly and 76 still carry its sentence shape, composed from tags
  // that changed afterwards. No curator prose exists in either field.
  assert.equal(count('contribution', 'generated'), 111);
  assert.equal(count('context', 'generated'), 111);
});

function compare(into: string[], id: string, field: string, before: unknown, after: unknown) {
  if (String(before ?? '') !== String(after ?? '')) {
    into.push(`${id}.${field}: published ${JSON.stringify(before)?.slice(0, 70)} -> rebuilt ${JSON.stringify(after)?.slice(0, 70)}`);
  }
}

function compareList(into: string[], id: string, field: string, before: unknown, after: readonly string[]) {
  const a = Array.isArray(before) ? before.map(String) : [];
  if (a.join('|') !== after.join('|')) {
    into.push(`${id}.${field}: published [${a.join(', ')}] -> rebuilt [${after.join(', ')}]`);
  }
}
