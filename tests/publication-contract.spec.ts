import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  canonicalPersonEntityId,
  filterPlacesForTarget,
  filterRuntimeEnrichmentForTarget,
  filterStorySectionsForTarget,
  inducteeIdFromPersonEntityId,
  isBaseProfileEligible,
  validatePublishedRuntimeReferences,
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
