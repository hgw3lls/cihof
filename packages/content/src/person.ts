import type { InducteeId } from './identity.ts';
import type { AttributedText } from './text.ts';

/** Where a set of tags came from. Only curated or documented tags may drive a facet. */
export type TagProvenance = 'curated' | 'documented' | 'inferred' | 'none';

export type TagSet = {
  readonly values: readonly string[];
  readonly provenance: TagProvenance;
};

export type Portrait = {
  readonly src: string;
  readonly alt: string;
  readonly focalPoint?: string;
  /** Only 'approved' may be rendered to a visitor. */
  readonly rights: 'approved' | 'pending' | 'restricted' | 'unknown';
};

/**
 * A person as published to a visitor.
 *
 * This is the base profile: identity, portrait, the institution's biography and
 * reviewed tags. Interpretation — relationships, stories, places, galleries —
 * is not part of it and arrives only through the review pipeline.
 */
export type PublishedPerson = {
  readonly id: InducteeId;
  readonly name: string;
  readonly sortName: string;
  readonly classYear: number | null;
  readonly portrait: Portrait | null;
  readonly biography: AttributedText | null;
  readonly contribution: AttributedText | null;
  readonly context: AttributedText | null;
  readonly communities: TagSet;
  readonly contributions: TagSet;
  readonly countries: TagSet;
  /** The institution's own page for this person, when it has one. */
  readonly sourceUrl: string | null;
};

const explicitTagProvenance = new Set<TagProvenance>(['curated', 'documented']);

/**
 * Base eligibility: a canonical id and a name.
 *
 * Deliberately not tied to `approvalStatus`. Every one of the 111 records is
 * `draft`, a legacy workflow value that predates the review contract, and
 * treating it as a publication decision would empty the collection. Enrichment
 * is gated separately, by review and target.
 */
export function isEligible(person: { id?: unknown; name?: unknown }): boolean {
  return typeof person.id === 'string' && person.id.trim().length > 0
    && typeof person.name === 'string' && person.name.trim().length > 0;
}

/** A facet may only offer tags a reviewer stands behind. */
export function facetable(tags: TagSet): readonly string[] {
  return explicitTagProvenance.has(tags.provenance) ? tags.values : [];
}

/** Portraits reach a visitor only with approved rights. */
export function displayablePortrait(portrait: Portrait | null): Portrait | null {
  return portrait && portrait.rights === 'approved' ? portrait : null;
}
