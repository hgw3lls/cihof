/**
 * How two records may be shown together.
 *
 * Three different claims get made about people in this collection, and once
 * they are rendered they look alike — a line on a map, two portraits side by
 * side:
 *
 *   documented  a source says these two people's work actually touched
 *   context     both records happen to share a value; nobody asserts a link
 *   comparison  a curator put them together and explained why
 *
 * Collapsing them is the failure this type exists to prevent. The Links scene
 * today draws 12 dashed lines per person that mean only "inducted the same
 * year" — the hall's own paperwork — and a solid line for a documented
 * relationship would be indistinguishable in shape from those if the data did
 * not force the distinction. So the claim is the discriminant, not a
 * presentation hint hanging off the side of one record type.
 *
 * Note what is *not* reviewable. Shared context is computed from base records
 * and asserts nothing beyond them, so it carries no review: there is no
 * curatorial decision to be made about the fact that two people were honoured
 * in the same year. It also never counts toward the documented-relationship
 * threshold that decides whether the Links lens is offered at all.
 */

import { isUsableEvidence, substantiationProblems, usableEvidence, type Evidence, type Evidenced } from './evidence.ts';
import type { ConnectionId, InducteeId, PlaceId } from './identity.ts';
import { isPublished, type Reviewed, type VisitorTarget } from './publication.ts';
import type { AttributedText } from './text.ts';
import type { Timespan } from './time.ts';

export type ConnectionClaim = 'documented' | 'context' | 'comparison';

/**
 * Kinds a source can actually document.
 *
 * Kept deliberately short and concrete. "Shared theme" and "same class" are
 * absent because they are context, not relationship, and putting them here is
 * how the distinction erodes.
 */
export type RelationshipKind =
  | 'collaborated-with'
  | 'founded-with'
  | 'mentored'
  | 'taught'
  | 'succeeded'
  | 'employed'
  | 'family-of'
  | 'nominated';

/** Kinds that read differently from each end and so need both labels. */
const directionalKinds = new Set<RelationshipKind>(['mentored', 'taught', 'succeeded', 'employed', 'nominated']);

export function isDirectional(kind: RelationshipKind): boolean {
  return directionalKinds.has(kind);
}

export type DocumentedRelationship = Reviewed & Evidenced & {
  readonly claim: 'documented';
  readonly id: ConnectionId;
  readonly from: InducteeId;
  readonly to: InducteeId;
  readonly kind: RelationshipKind;
  /** Reads from `from` to `to`: "mentored Ana Ruiz". */
  readonly label: string;
  /** Reads from `to` to `from`. Required when the kind is directional. */
  readonly inverseLabel?: string;
  /** When the relationship held, where a source says. */
  readonly active?: Timespan;
};

/** What two records have in common. Computed, not decided. */
export type ContextBasis = 'induction-year' | 'community' | 'contribution' | 'place';

export type SharedContext = {
  readonly claim: 'context';
  readonly id: ConnectionId;
  readonly between: readonly [InducteeId, InducteeId];
  readonly basis: ContextBasis;
  /** The value they share: `2010`, `Slovenian`, `Education`. */
  readonly value: string;
  /**
   * Wording that states the coincidence and stops there.
   *
   * "Both honoured in 2010" is a fact about the records. "Colleagues in the
   * class of 2010" is a claim about the people, and no source supports it.
   */
  readonly statement: string;
};

export type CuratorialComparison = Reviewed & Evidenced & {
  readonly claim: 'comparison';
  readonly id: ConnectionId;
  readonly between: readonly [InducteeId, InducteeId];
  /** The civic concern both lives speak to. */
  readonly question: string;
  /** Why a curator put these two together. Carries its own provenance. */
  readonly reading: AttributedText;
};

export type Connection = DocumentedRelationship | SharedContext | CuratorialComparison;

/** Person-to-place roles. "Lived here" and "served this community" are not the same claim. */
export type PlaceRole = 'lived' | 'worked' | 'studied' | 'taught' | 'organized' | 'served' | 'founded' | 'associated';

export type PlaceAssociation = Reviewed & Evidenced & {
  readonly id: ConnectionId;
  readonly person: InducteeId;
  readonly place: PlaceId;
  readonly role: PlaceRole;
  /** What the person did there, in the source's terms. */
  readonly note?: string;
  readonly active?: Timespan;
};

export function isDocumented(value: Connection): value is DocumentedRelationship {
  return value.claim === 'documented';
}

export function isSharedContext(value: Connection): value is SharedContext {
  return value.claim === 'context';
}

export function isComparison(value: Connection): value is CuratorialComparison {
  return value.claim === 'comparison';
}

/** The two people a connection joins, whichever claim it makes. */
export function endpoints(value: Connection): readonly [InducteeId, InducteeId] {
  return isDocumented(value) ? [value.from, value.to] : value.between;
}

/**
 * How the relationship reads from one end.
 *
 * Approaching a documented relationship from its far endpoint and reading the
 * forward label back reverses the claim: it turns "mentored Ana Ruiz" into Ana
 * Ruiz having mentored her own mentor. Returning null for a person who is not
 * an endpoint keeps that from being papered over with a default.
 */
export function labelFrom(relationship: DocumentedRelationship, viewpoint: InducteeId): string | null {
  if (viewpoint === relationship.from) return relationship.label;
  if (viewpoint !== relationship.to) return null;
  if (!isDirectional(relationship.kind)) return relationship.label;
  const inverse = relationship.inverseLabel;
  return typeof inverse === 'string' && inverse.trim().length > 0 ? inverse : null;
}

/**
 * Connections a visitor may be shown.
 *
 * Shared context passes without review because it makes no reviewable claim.
 * Everything else must be approved for this target *and* carry evidence.
 */
export function publishedConnections(values: readonly unknown[], target: VisitorTarget): Connection[] {
  return values.filter((value): value is Connection => {
    const candidate = value as Partial<Connection>;
    if (candidate.claim === 'context') return sharedContextProblems(value).length === 0;
    if (candidate.claim !== 'documented' && candidate.claim !== 'comparison') return false;
    if (!isPublished(value as Partial<Reviewed>, target)) return false;
    return connectionProblems(value).length === 0;
  });
}

/** Only documented relationships count toward the Links lens threshold. */
export function documentedCount(connections: readonly Connection[]): number {
  return connections.filter(isDocumented).length;
}

export function publishedPlaceAssociations(values: readonly unknown[], target: VisitorTarget): PlaceAssociation[] {
  return values.filter((value): value is PlaceAssociation => {
    if (!isPublished(value as Partial<Reviewed>, target)) return false;
    return placeAssociationProblems(value).length === 0;
  });
}

/**
 * Why a connection is not publishable, for the staff review view.
 *
 * Reasons rather than a boolean, because the person who has to fix this needs
 * to know which field is missing, not that something is.
 */
export function connectionProblems(value: unknown): string[] {
  const candidate = value as Partial<DocumentedRelationship & CuratorialComparison>;
  if (!candidate || typeof candidate !== 'object') return ['record is missing'];
  if (candidate.claim === 'context') return sharedContextProblems(value);

  const problems = substantiationProblems(candidate);
  if (!nonEmpty(candidate.id)) problems.push('no id');

  if (candidate.claim === 'documented') {
    if (!nonEmpty(candidate.from) || !nonEmpty(candidate.to)) problems.push('missing an endpoint');
    else if (candidate.from === candidate.to) problems.push('both endpoints are the same person');
    if (!nonEmpty(candidate.label)) problems.push('no label');
    if (candidate.kind && isDirectional(candidate.kind) && !nonEmpty(candidate.inverseLabel)) {
      problems.push(`${candidate.kind} reads differently from each end but has no inverse label`);
    }
    return problems;
  }

  if (candidate.claim === 'comparison') {
    if (!pairOfDistinctPeople(candidate.between)) problems.push('needs two distinct people');
    if (!nonEmpty(candidate.question)) problems.push('no shared question');
    const reading = candidate.reading;
    if (!reading || !nonEmpty(reading.text)) problems.push('no curatorial reading');
    else if (reading.provenance !== 'curated') problems.push(`reading is ${reading.provenance}, not curated`);
    return problems;
  }

  return ['unrecognised claim'];
}

export function sharedContextProblems(value: unknown): string[] {
  const candidate = value as Partial<SharedContext>;
  if (!candidate || typeof candidate !== 'object') return ['record is missing'];
  const problems: string[] = [];
  if (!nonEmpty(candidate.id)) problems.push('no id');
  if (!pairOfDistinctPeople(candidate.between)) problems.push('needs two distinct people');
  if (!nonEmpty(candidate.value)) problems.push('no shared value');
  if (!nonEmpty(candidate.statement)) problems.push('no statement');
  return problems;
}

export function placeAssociationProblems(value: unknown): string[] {
  const candidate = value as Partial<PlaceAssociation>;
  if (!candidate || typeof candidate !== 'object') return ['record is missing'];
  const problems = substantiationProblems(candidate);
  if (!nonEmpty(candidate.id)) problems.push('no id');
  if (!nonEmpty(candidate.person)) problems.push('no person');
  if (!nonEmpty(candidate.place)) problems.push('no place');
  // `associated` is the catch-all the 44 seeded links would land in. It is
  // allowed, but it is the one role that tells a visitor nothing, so the
  // review view names it rather than letting it pass as finished work.
  if (candidate.role === undefined) problems.push('no role');
  else if (candidate.role === 'associated') problems.push("role is 'associated', which does not say what the person did there");
  return problems;
}

export function firstUsableEvidence(value: Evidenced | undefined): Evidence | null {
  return usableEvidence(value?.evidence).find(isUsableEvidence) ?? null;
}

function pairOfDistinctPeople(value: readonly InducteeId[] | undefined): boolean {
  return Array.isArray(value) && value.length === 2 && nonEmpty(value[0]) && nonEmpty(value[1]) && value[0] !== value[1];
}

function nonEmpty(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
