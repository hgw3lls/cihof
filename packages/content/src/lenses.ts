import { isDocumented, publishedConnections, type DocumentedRelationship } from './connection.ts';
import { isPublished, type Reviewed, type VisitorTarget } from './publication.ts';

/**
 * Which ways of exploring the collection are worth offering.
 *
 * A lens below its threshold is absent from the build, not present and empty.
 * An empty lens is not a deliverable: it spends a visitor's attention to tell
 * them there is nothing there, and it lets engineering report a surface as
 * shipped while the content it exists to present does not exist.
 *
 * The numbers are a content decision. Engineering owns the gate; the content
 * team owns the threshold, and the tracker records who set it.
 */
export type LensId = 'people' | 'years' | 'links' | 'places';

export type LensThreshold = {
  readonly id: LensId;
  /** How many published records the lens needs before it is worth offering. */
  readonly minimum: number;
  /** What is being counted, for the tracker and for a refusal message. */
  readonly counts: string;
};

export const lensThresholds: readonly LensThreshold[] = [
  // People and Years rest on the base collection, which is always present:
  // 111 people, every one of them dated.
  { id: 'people', minimum: 1, counts: 'published people' },
  { id: 'years', minimum: 1, counts: 'people with an induction year' },
  { id: 'links', minimum: 15, counts: 'documented relationships' },
  { id: 'places', minimum: 8, counts: 'reviewed places' },
];

/**
 * The Links threshold, by name.
 *
 * Read by the review sheet, which has to tell a curator how far off they are.
 * Taken from the table rather than restated, so the sheet cannot drift from the
 * gate it is reporting against.
 */
export const linksThreshold: number = lensThresholds.find((t) => t.id === 'links')?.minimum ?? 15;

export type LensCounts = Record<LensId, number>;

export type LensAvailability = {
  readonly id: LensId;
  readonly available: boolean;
  readonly count: number;
  readonly minimum: number;
  readonly counts: string;
};

export function lensAvailability(counts: LensCounts): LensAvailability[] {
  return lensThresholds.map((threshold) => ({
    id: threshold.id,
    available: counts[threshold.id] >= threshold.minimum,
    count: counts[threshold.id],
    minimum: threshold.minimum,
    counts: threshold.counts,
  }));
}

export function availableLenses(counts: LensCounts): LensId[] {
  return lensAvailability(counts).filter((lens) => lens.available).map((lens) => lens.id);
}

/** A place a visitor can be shown. Unreviewed seeds are not places yet. */
export type PublishedPlace = Reviewed & {
  readonly id: string;
  readonly name: string;
  readonly shortHistory: string;
  readonly neighborhood: string;
  readonly personIds: readonly string[];
};

/**
 * A documented relationship between two people.
 *
 * Shared induction year is deliberately not one of these. Two people honoured
 * in the same year have a context in common, not a relationship, and
 * presenting the two alike would claim something no source asserts. The three
 * kinds of claim, and what each one must carry, live in `connection.ts`.
 */
export type PublishedRelationship = DocumentedRelationship;

export function publishedPlaces(places: readonly unknown[], target: VisitorTarget): PublishedPlace[] {
  return places.filter((place): place is PublishedPlace => isPublished(place as Partial<Reviewed>, target));
}

/**
 * Documented relationships only, for the lens count and the visitor bundle.
 *
 * Shared context is not filtered out here because it never arrives here: it is
 * computed from the base records at render time and counts toward nothing.
 */
export function publishedRelationships(relationships: readonly unknown[], target: VisitorTarget): PublishedRelationship[] {
  return publishedConnections(relationships, target).filter(isDocumented);
}
