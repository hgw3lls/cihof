import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  availableLenses, displayablePortrait, facetable, isAttributable, lensAvailability,
  publishedPlaceAssociations, publishedPlaces, publishedRelationships,
  crosswalkProgress, inductionRelationships,
  publishedContributions, worksheetContributions, worksheetProgress,
  type Contribution, type ContributionWorksheet,
  type InducteeId, type InductionCrosswalk,
  type LensAvailability, type LensId, type PublishedPerson, type PublishedPlace,
  publishableFilms, filmShortfalls,
  type FilmDelivery, type PublishedFilm, type PublishedRelationship, type VisitorTarget,
} from '@cihof/content';
import { readInductionCrosswalk } from '../sources/crosswalk.ts';
import { readContributionWorksheet } from '../sources/worksheet.ts';
import { readPlaceAssociations, readPlaceSeeds, readRelationships } from '../sources/places.ts';
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
  /** What each person changed, for the people a curator has written up. */
  readonly contributions: readonly Contribution[];
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
  readonly filmReport: {
    readonly held: number;
    readonly blockedBy: Record<string, number>;
    /** Where this release serves its films from. */
    readonly delivery: FilmDelivery;
  };
  /**
   * Why Connections is offered or withheld, in the terms a curator can act on.
   * "Zero relationships" and "ninety-five names nobody has resolved yet" are
   * the same count and different problems.
   */
  /**
   * How much of the collection can say what its people changed.
   *
   * "No contributions" and "a hundred and eleven rows nobody has written yet"
   * are the same count and different problems.
   */
  readonly contributionReport: {
    readonly published: number;
    readonly written: number;
    readonly peopleCovered: number;
    readonly peopleNotStarted: number;
  };
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
  /**
   * Who presented this person, as the roster records it. Text, not a link into
   * the graph: most presenters are not in the hall and have nothing behind
   * their name. `inducteeId` is set only for the ones who are.
   */
  readonly presentedBy: { readonly recordedName: string; readonly inducteeId: string | null } | null;
  /** Films cleared for this target. Empty for every person today. */
  readonly films: readonly PublishedFilm[];
};

/** Sources are injectable so the gate can be exercised at either side of a threshold. */
export type BundleSources = {
  readonly places?: readonly unknown[];
  readonly placeAssociations?: readonly unknown[];
  readonly relationships?: readonly unknown[];
  /** Pass `null` to build as though the crosswalk had never been generated. */
  readonly crosswalk?: InductionCrosswalk | null;
  /** Pass `null` to build as though the worksheet had never been generated. */
  readonly worksheet?: ContributionWorksheet | null;
  /** Where films are served from. Defaults per target; see `filmDeliveryFor`. */
  readonly filmDelivery?: FilmDelivery;
  /** Public site this release points its codes at. */
  readonly continuationBase?: string | null;
};

export function buildRuntimeBundle(
  people: readonly PublishedPerson[],
  target: VisitorTarget,
  sources: BundleSources = {},
): RuntimeBundle {
  const holdings = readVideoHoldings();
  const delivery = sources.filmDelivery ?? filmDeliveryFor(target);
  const publishedIds = new Set<string>(people.map((person) => person.id as string));
  const runtimePeople = people.map((person) =>
    toRuntimePerson(person, publishableFilms(holdings.get(person.id) ?? [], target, delivery), publishedIds));

  // Count what the withheld holdings are waiting on, so a silent wall is
  // explainable rather than mysterious.
  const blockedBy: Record<string, number> = {};
  let held = 0;
  for (const videos of holdings.values()) {
    for (const video of videos) {
      const shortfalls = filmShortfalls(video as Record<string, unknown>, target, delivery);
      if (shortfalls.length === 0) continue;
      held += 1;
      for (const reason of shortfalls) blockedBy[reason] = (blockedBy[reason] ?? 0) + 1;
    }
  }
  // A place is shown with the people a curator said belong to it, and a tie
  // only counts once it carries a role — `associated` is refused too, because
  // it does not say what the person did there. So a reviewed place with no
  // reviewed ties shows as a place, not as a place with nobody in it.
  const associations = publishedPlaceAssociations(sources.placeAssociations ?? readPlaceAssociations(), target);
  const peopleByPlace = new Map<string, string[]>();
  for (const association of associations) {
    const list = peopleByPlace.get(association.place) ?? [];
    if (!list.includes(association.person)) list.push(association.person);
    peopleByPlace.set(association.place, list);
  }
  const places = publishedPlaces(sources.places ?? readPlaceSeeds(), target)
    .map((place) => ({ ...place, personIds: peopleByPlace.get(place.id) ?? place.personIds ?? [] }));

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

  // Contributions are written by hand in the worksheet and read here. Nothing
  // in this pipeline composes one: a generated account is the thing the record
  // exists to replace, and `publishedContributions` refuses an action that is
  // not somebody's own words.
  const worksheet = sources.worksheet === undefined ? readContributionWorksheet() : sources.worksheet;
  const contributions = worksheet
    ? publishedContributions(worksheetContributions(worksheet), target)
    : [];
  const writing = worksheet ? worksheetProgress(worksheet) : null;

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
    contributions,
    lenses: availableLenses(counts),
    lensReport: lensAvailability(counts),
    continuationBase: sources.continuationBase ?? process.env['CIHOF_SITE_URL'] ?? null,
    filmReport: { held, blockedBy, delivery },
    contributionReport: {
      published: contributions.length,
      written: writing?.written ?? 0,
      peopleCovered: new Set(contributions.map((contribution) => contribution.subject)).size,
      peopleNotStarted: writing?.notStarted ?? 0,
    },
    relationshipReport: {
      published: relationships.length,
      fromCrosswalk: relationships.filter(isFromCrosswalk).length,
      curated: curatedPublished,
      crosswalkNamesUnresolved: progress?.unresolved ?? 0,
      crosswalkApproved: crosswalk?.publicationDecision !== undefined,
    },
  };
}

/**
 * Where films come from when nobody has said.
 *
 * A kiosk keeps its own copies: it is built to work with the network down, and
 * an embedded player is the first thing to go when it does. The public site has
 * no copies to keep — the 41 GB of MP4 is not in the repository — so it serves
 * the hall's own channel. `CIHOF_FILM_DELIVERY=local-file|youtube` overrides
 * either, and `sources.filmDelivery` overrides that.
 */
export function filmDeliveryFor(target: VisitorTarget): FilmDelivery {
  const configured = process.env['CIHOF_FILM_DELIVERY'];
  if (configured === 'local-file' || configured === 'youtube') return configured;
  return target === 'public' ? 'youtube' : 'local-file';
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

function toRuntimePerson(
  person: PublishedPerson,
  films: readonly PublishedFilm[],
  published: ReadonlySet<string>,
): RuntimePerson {
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
    // Only linked where the name resolves to somebody published in this
    // release. A link to a person the target withholds is a dead end.
    presentedBy: person.presentedBy
      ? {
        recordedName: person.presentedBy.recordedName,
        inducteeId: person.presentedBy.inducteeId && published.has(person.presentedBy.inducteeId)
          ? person.presentedBy.inducteeId
          : null,
      }
      : null,
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
