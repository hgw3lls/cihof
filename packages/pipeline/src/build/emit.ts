import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  availableLenses, displayablePortrait, facetable, isAttributable, lensAvailability,
  publishedPlaces, publishedRelationships,
  crosswalkProgress, inductionRelationships,
  type InducteeId, type InductionCrosswalk,
  type LensAvailability, type LensId, type PublishedPerson, type PublishedPlace,
  publishableFilms, filmShortfalls,
  type PublishedFilm, type PublishedRelationship, type VisitorTarget,
} from '@cihof/content';
import { readInductionCrosswalk } from '../sources/crosswalk.ts';
import { readPlaceSeeds, readRelationships } from '../sources/places.ts';
import { readVideoHoldings } from '../sources/media.ts';

/**
 * The runtime bundle a visitor app loads.
 *
 * Carries its own content revision. The previous pipeline computed one and
 * nothing ever read it, so a device could not tell which release's content it
 * was showing and a stale cache was indistinguishable from a current one.
 */
export type RuntimeBundle = {
  readonly schemaVersion: 1;
  readonly target: VisitorTarget;
  readonly contentRevision: string;
  readonly generatedAt: string;
  readonly people: readonly RuntimePerson[];
  readonly places: readonly PublishedPlace[];
  readonly relationships: readonly PublishedRelationship[];
  /**
   * Which lenses this release offers, decided here rather than in the app.
   * A lens the content cannot support is absent, so the app has nothing to
   * render empty and no threshold of its own to get wrong.
   */
  readonly lenses: readonly LensId[];
  /** The full reckoning, including what fell short and by how much. */
  readonly lensReport: readonly LensAvailability[];
  /**
   * Where a visitor continues reading on their own phone, or null when this
   * build has no publicly reachable site to send them to. Checked at publish
   * time so an unusable destination never reaches a wall.
   */
  readonly continuationBase: string | null;
  /**
   * What is holding the withheld film holdings back, counted by prerequisite.
   * A release should be able to say why a wall is silent.
   */
  readonly filmReport: { readonly held: number; readonly blockedBy: Record<string, number> };
  /**
   * Why Connections is offered or withheld, in the terms a curator can act on.
   * "Zero relationships" and "ninety-five names nobody has resolved yet" are
   * the same count and different problems.
   */
  readonly relationshipReport: {
    readonly published: number;
    readonly fromCrosswalk: number;
    readonly curated: number;
    readonly crosswalkNamesUnresolved: number;
    readonly crosswalkApproved: boolean;
  };
};

/**
 * A person as the runtime sees them.
 *
 * Flattened deliberately: prose that nobody stands behind is dropped here
 * rather than shipped with a provenance flag for the app to respect. What is
 * not in the bundle cannot be rendered by mistake.
 */
export type RuntimePerson = {
  readonly id: string;
  readonly name: string;
  readonly sortName: string;
  readonly classYear: number | null;
  readonly portrait: { readonly src: string; readonly alt: string; readonly focalPoint?: string } | null;
  readonly biography: string;
  /** True when a curator wrote the biography rather than the institution's record. */
  readonly biographyCurated: boolean;
  readonly contributions: readonly string[];
  readonly communities: readonly string[];
  readonly countries: readonly string[];
  readonly sourceUrl: string | null;
  /** Films cleared for this target. Empty for every person today. */
  readonly films: readonly PublishedFilm[];
};

/** Sources are injectable so the gate can be exercised at either side of a threshold. */
export type BundleSources = {
  readonly places?: readonly unknown[];
  readonly relationships?: readonly unknown[];
  /** Pass `null` to build as though the crosswalk had never been generated. */
  readonly crosswalk?: InductionCrosswalk | null;
  /** Public site this release points its codes at. */
  readonly continuationBase?: string | null;
};

export function buildRuntimeBundle(
  people: readonly PublishedPerson[],
  target: VisitorTarget,
  sources: BundleSources = {},
): RuntimeBundle {
  const holdings = readVideoHoldings();
  const runtimePeople = people.map((person) => toRuntimePerson(person, publishableFilms(holdings.get(person.id) ?? [], target)));

  // Count what the withheld holdings are waiting on, so a silent wall is
  // explainable rather than mysterious.
  const blockedBy: Record<string, number> = {};
  let held = 0;
  for (const videos of holdings.values()) {
    for (const video of videos) {
      const shortfalls = filmShortfalls(video as Record<string, unknown>, target);
      if (shortfalls.length === 0) continue;
      held += 1;
      for (const reason of shortfalls) blockedBy[reason] = (blockedBy[reason] ?? 0) + 1;
    }
  }
  const places = publishedPlaces(sources.places ?? readPlaceSeeds(), target);

  // The roster's `inducted_by` column becomes relationships here, and only
  // here. Resolving who a name refers to happens in the crosswalk under review;
  // this reads that decision, it never makes one. With nothing resolved and no
  // publication decision the generator yields nothing and Connections stays
  // off, which is the collection's actual state today.
  const crosswalk = sources.crosswalk === undefined ? readInductionCrosswalk() : sources.crosswalk;
  const nameById = new Map(people.map((person) => [person.id, person.name] as const));
  const fromCrosswalk = crosswalk
    ? inductionRelationships(crosswalk, (id: InducteeId) => nameById.get(id))
    : [];

  // Curated records come first so a hand-written relationship wins over the
  // generated one for the same pair rather than appearing twice and counting
  // twice toward the lens threshold.
  const curated = sources.relationships ?? readRelationships();
  const relationships = dedupeById(publishedRelationships([...curated, ...fromCrosswalk], target));
  const curatedPublished = relationships.length - relationships.filter(isFromCrosswalk).length;
  const progress = crosswalk ? crosswalkProgress(crosswalk) : null;

  const counts = {
    people: runtimePeople.length,
    years: runtimePeople.filter((person) => person.classYear !== null).length,
    links: relationships.length,
    places: places.length,
  };

  return {
    schemaVersion: 1,
    target,
    contentRevision: revisionOf(runtimePeople),
    generatedAt: new Date().toISOString(),
    people: runtimePeople,
    places,
    relationships,
    lenses: availableLenses(counts),
    lensReport: lensAvailability(counts),
    continuationBase: sources.continuationBase ?? process.env['CIHOF_SITE_URL'] ?? null,
    filmReport: { held, blockedBy },
    relationshipReport: {
      published: relationships.length,
      fromCrosswalk: relationships.filter(isFromCrosswalk).length,
      curated: curatedPublished,
      crosswalkNamesUnresolved: progress?.unresolved ?? 0,
      crosswalkApproved: crosswalk?.publicationDecision !== undefined,
    },
  };
}

function isFromCrosswalk(relationship: PublishedRelationship): boolean {
  return relationship.kind === 'inducted';
}

function dedupeById(relationships: readonly PublishedRelationship[]): PublishedRelationship[] {
  const seen = new Set<string>();
  const kept: PublishedRelationship[] = [];
  for (const relationship of relationships) {
    if (seen.has(relationship.id)) continue;
    seen.add(relationship.id);
    kept.push(relationship);
  }
  return kept;
}

export function writeRuntimeBundle(bundle: RuntimeBundle, path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(bundle, null, 2)}\n`);
}

function toRuntimePerson(person: PublishedPerson, films: readonly PublishedFilm[]): RuntimePerson {
  const portrait = displayablePortrait(person.portrait);
  const biography = isAttributable(person.biography) ? person.biography : null;
  return {
    id: person.id,
    name: person.name,
    sortName: person.sortName,
    classYear: person.classYear,
    portrait: portrait
      ? (portrait.focalPoint
        ? { src: portrait.src, alt: portrait.alt, focalPoint: portrait.focalPoint }
        : { src: portrait.src, alt: portrait.alt })
      : null,
    biography: biography?.text ?? '',
    biographyCurated: biography?.provenance === 'curated',
    contributions: facetable(person.contributions),
    communities: facetable(person.communities),
    countries: facetable(person.countries),
    sourceUrl: person.sourceUrl,
    films,
  };
}

/**
 * Derived from the content only, never from the build time.
 *
 * Two builds of the same sources produce the same revision, so a device can
 * tell "different release" from "same content, rebuilt".
 */
function revisionOf(people: readonly RuntimePerson[]): string {
  return createHash('sha256').update(JSON.stringify(people)).digest('hex').slice(0, 32);
}
