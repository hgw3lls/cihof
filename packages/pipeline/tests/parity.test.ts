import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildPeople } from '../src/build/people.ts';

/**
 * Parity against the artifact the existing pipeline publishes.
 *
 * A from-scratch generator can silently drop a curatorial decision, and nothing
 * about the output would look wrong. This compares the rewritten assembly
 * field-by-field against what is published today. Every difference must be
 * either absent or listed below with a reason.
 */
const published = JSON.parse(
  readFileSync(new URL('../../../public/data/cihof-runtime-data.json', import.meta.url), 'utf8'),
).inductees as Array<Record<string, unknown>>;

const rebuilt = new Map(buildPeople().map((person) => [person.id as string, person]));

test('the same people, by canonical id', () => {
  const publishedIds = new Set(published.map((person) => String(person['id'])));
  const rebuiltIds = new Set(rebuilt.keys());
  assert.deepEqual([...publishedIds].filter((id) => !rebuiltIds.has(id)), [], 'people lost by the rewrite');
  assert.deepEqual([...rebuiltIds].filter((id) => !publishedIds.has(id)), [], 'people invented by the rewrite');
  assert.equal(rebuiltIds.size, 111);
});

test('every published field the web needs is reproduced', () => {
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

  assert.deepEqual(differences.slice(0, 12), [], `${differences.length} field differences`);
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
