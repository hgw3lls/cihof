import { readFileSync, readdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  canonicalPersonEntityId,
  filterPlacesForTarget,
  filterRuntimeEnrichmentForTarget,
  filterStorySectionsForTarget,
  inducteeIdFromPersonEntityId,
  isBaseProfileEligible,
  validatePublishedRuntimeReferences,
  validateRuntimeBundleForTarget,
} from '../src/data/publicationPolicy';
import {
  fixtureAffiliations,
  fixtureIds,
  fixturePlacesDocument,
  fixtureStoryDocument,
} from './fixtures/city-experience-publication';

test('legacy draft status does not hide a canonical base profile or rewrite source text', () => {
  const profile = {
    id: fixtureIds.alpha,
    name: 'Fixture Alpha',
    approvalStatus: 'draft',
    bioText: 'Exact fixture source wording.',
  };
  expect(isBaseProfileEligible(profile)).toBe(true);
  expect(profile.bioText).toBe('Exact fixture source wording.');
  expect(canonicalPersonEntityId(profile.id)).toBe(`person:${fixtureIds.alpha}`);
  expect(inducteeIdFromPersonEntityId(canonicalPersonEntityId(profile.id))).toBe(profile.id);
  expect(inducteeIdFromPersonEntityId(profile.id)).toBeNull();
});

test('review, evidence, target, affiliation, and date semantics remain independent', () => {
  expect(fixtureAffiliations).toHaveLength(2);
  expect(new Set(fixtureAffiliations.map((item) => item.vocabularyKind))).toEqual(new Set([
    'heritage-cultural-community',
    'organizational-affiliation',
  ]));

  const publicStories = filterStorySectionsForTarget(fixtureStoryDocument, 'public') as typeof fixtureStoryDocument;
  const kioskStories = filterStorySectionsForTarget(fixtureStoryDocument, 'kiosk') as typeof fixtureStoryDocument;
  expect(publicStories.records[fixtureIds.alpha].beats.map((beat) => beat.id)).toEqual(['fixture-public-beat']);
  expect(kioskStories.records[fixtureIds.alpha].beats.map((beat) => beat.id)).toEqual([
    'fixture-public-beat',
    'fixture-kiosk-beat',
  ]);
  expect(JSON.stringify(publicStories)).not.toContain('Fixture-only staff note');

  const publicPlaces = filterPlacesForTarget(fixturePlacesDocument, 'public') as typeof fixturePlacesDocument;
  expect(publicPlaces.places.map((place) => place.id)).toEqual([fixtureIds.place]);
});

test('published fixture references are validated after filtering', () => {
  const bundle = filterRuntimeEnrichmentForTarget({
    inductees: [
      { id: fixtureIds.alpha, name: 'Fixture Alpha' },
      { id: fixtureIds.beta, name: 'Fixture Beta' },
    ],
    entities: { entities: [
      { id: canonicalPersonEntityId(fixtureIds.alpha) },
      { id: canonicalPersonEntityId(fixtureIds.beta) },
      { id: fixtureIds.place },
    ] },
    entityRelationships: { relationships: [] },
    storySections: fixtureStoryDocument,
    places: fixturePlacesDocument,
    archiveLeads: { records: [] },
  }, 'public');
  expect(validatePublishedRuntimeReferences(bundle)).toEqual([]);
});

test('public artifact preserves base profiles and excludes review seeds and fixture IDs', () => {
  const runtime = JSON.parse(readFileSync('dist/data/cihof-runtime-data.json', 'utf8'));
  const splitStories = JSON.parse(readFileSync('dist/data/story-sections.json', 'utf8'));
  const splitPlaces = JSON.parse(readFileSync('dist/data/places.json', 'utf8'));
  const splitArchives = JSON.parse(readFileSync('dist/data/archive-leads.json', 'utf8'));

  expect(runtime.inductees).toHaveLength(111);
  expect(Object.keys(runtime.storySections.records)).toHaveLength(0);
  expect(runtime.places.places).toHaveLength(0);
  expect(runtime.archiveLeads.records).toHaveLength(0);
  expect(Object.keys(splitStories.records)).toHaveLength(0);
  expect(splitPlaces.places).toHaveLength(0);
  expect(splitArchives.records).toHaveLength(0);
  expect(validatePublishedRuntimeReferences(runtime)).toEqual([]);

  const serialized = JSON.stringify({ runtime, splitStories, splitPlaces, splitArchives });
  expect(serialized).not.toContain('fixture-person-');
  expect(serialized).not.toContain('Fixture Civic Hall');
});

const expectations = { schemaVersion: 2 };

function importableBundle(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2,
    contentContract: { contentRevision: 'fixture-revision-0001' },
    inductees: [{ id: fixtureIds.alpha, name: 'Fixture Alpha' }],
    entities: { entities: [{ id: canonicalPersonEntityId(fixtureIds.alpha) }] },
    entityRelationships: { relationships: [] },
    storySections: { records: {} },
    archiveLeads: { records: [] },
    places: { places: [] },
    ...overrides,
  };
}

test('an import is refused with a reason rather than trusted', () => {
  const wrongSchema = validateRuntimeBundleForTarget(importableBundle({ schemaVersion: 1 }), 'kiosk', expectations);
  expect(wrongSchema.ok).toBe(false);
  expect(wrongSchema.ok === false && wrongSchema.reasons.join(' ')).toContain('schema version 1');

  const noRevision = validateRuntimeBundleForTarget(importableBundle({ contentContract: {} }), 'kiosk', expectations);
  expect(noRevision.ok).toBe(false);
  expect(noRevision.ok === false && noRevision.reasons.join(' ')).toContain('content revision');

  const noPeople = validateRuntimeBundleForTarget(importableBundle({ inductees: [{ id: '', name: '' }] }), 'kiosk', expectations);
  expect(noPeople.ok).toBe(false);

  expect(validateRuntimeBundleForTarget('not a bundle', 'kiosk', expectations).ok).toBe(false);
  expect(validateRuntimeBundleForTarget(null, 'kiosk', expectations).ok).toBe(false);
});

test('an import with a dangling reference is refused, naming the reference', () => {
  const dangling = validateRuntimeBundleForTarget(importableBundle({
    storySections: fixtureStoryDocument,
  }), 'kiosk', expectations);

  expect(dangling.ok).toBe(false);
  expect(dangling.ok === false && dangling.reasons.join(' ')).toContain('unresolved reference');
});

test('an import cannot reinstate content the publication rules withhold', () => {
  const accepted = validateRuntimeBundleForTarget(importableBundle({
    places: fixturePlacesDocument,
  }), 'public', expectations);

  expect(accepted.ok).toBe(true);
  if (!accepted.ok) return;

  // The withheld fixture place is absent from what an import is allowed to show,
  // even though the file offered it.
  const places = (accepted.bundle.places as { places: Array<{ id: string }> }).places;
  expect(places.map((place) => place.id)).toEqual([fixtureIds.place]);
  expect(JSON.stringify(accepted.bundle)).not.toContain('Fixture-only staff note');
  expect(accepted.contentRevision).toBe('fixture-revision-0001');
});

test('the public artifact contains no staff data-import path', () => {
  const assets = readdirSync('dist/assets').filter((name) => name.startsWith('index-') && name.endsWith('.js'));
  expect(assets.length).toBeGreaterThan(0);
  const bundle = assets.map((name) => readFileSync(`dist/assets/${name}`, 'utf8')).join('');

  for (const marker of ['Import Data File', 'Admin data tools unlocked', 'cihof.admin-passcode', 'cihof.admin-data.session']) {
    expect(bundle).not.toContain(marker);
  }
  // A configured passcode must not reach the public bundle even indirectly: a
  // computed import.meta.env lookup used to inline every VITE_ value.
  expect(bundle).not.toContain('VITE_CIHOF_ADMIN_PASSCODE');
});
