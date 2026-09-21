/**
 * Resolving the one documented relationship the collection already holds.
 *
 * Every roster row names the person who inducted that inductee — 105 of them,
 * 90 distinct names — and some of those people are inductees themselves. That
 * is a documented person-to-person act, recorded by the institution, and it is
 * the only such record in the collection today.
 *
 * It is stored as a name, which is exactly what this codebase refuses to match
 * on. So the name is not resolved here; it is *offered* here. A curator says
 * who each name is, once, and only that decision produces a relationship.
 * Candidates exist to make that pass quick, and carry the basis on which they
 * were suggested so nobody mistakes a normalised string comparison for a
 * finding.
 *
 * Two separate decisions live in this file, and conflating them would put
 * unreviewed claims on a public wall:
 *
 *   resolution           who this name refers to
 *   publicationDecision  whether the resulting relationships may be shown,
 *                        and to whom
 *
 * Resolving all 90 names grants no permission at all. Without a publication
 * decision this file yields no relationships.
 */

import type { Evidence } from './evidence.ts';
import type { ConnectionId, InducteeId } from './identity.ts';
import type { Publication, Review } from './publication.ts';
import type { DocumentedRelationship } from './connection.ts';

export type CrosswalkStatus =
  /** Nobody has looked at this name yet. */
  | 'unresolved'
  /** This name is an inductee, named by id. */
  | 'inductee'
  /** A real person, not in the hall. No relationship follows. */
  | 'not-an-inductee'
  /** The record does not say enough to tell who this is. */
  | 'unidentifiable';

export type CrosswalkResolution =
  | { readonly status: 'unresolved' }
  | {
      readonly status: 'inductee';
      readonly inducteeId: InducteeId;
      /** The decision this rests on. Required: a resolution is a curatorial act. */
      readonly decisionReference: string;
      readonly decidedAt?: string;
      readonly note?: string;
    }
  | {
      readonly status: 'not-an-inductee' | 'unidentifiable';
      readonly decisionReference: string;
      readonly decidedAt?: string;
      readonly note?: string;
    };

export type CrosswalkCandidate = {
  readonly inducteeId: InducteeId;
  readonly displayName: string;
  /**
   * Why this was offered.
   *
   * `normalised-name` means only that two strings matched after case,
   * accents, punctuation and honorifics were removed. It is a prompt for a
   * reviewer, never a basis for publication.
   */
  readonly basis: 'normalised-name';
};

export type CrosswalkEntry = {
  /** A stable slug for referring to the row. The merge key is `recordedName`. */
  readonly id: string;
  /** The value exactly as the roster records it. Never cleaned up. */
  readonly recordedName: string;
  /** The inductees whose rows name this person as their inducter. */
  readonly inducted: readonly InducteeId[];
  readonly candidates: readonly CrosswalkCandidate[];
  readonly resolution: CrosswalkResolution;
};

export type CrosswalkPublicationDecision = {
  readonly decisionReference: string;
  readonly contentVersion: string;
  readonly reviewedAt?: string;
  readonly publication: Publication;
};

export type InductionCrosswalk = {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly source: string;
  /** Absent until a reviewer decides these relationships may be shown. */
  readonly publicationDecision?: CrosswalkPublicationDecision;
  readonly entries: readonly CrosswalkEntry[];
};

export type CrosswalkProgress = {
  readonly total: number;
  readonly unresolved: number;
  readonly inductee: number;
  readonly notAnInductee: number;
  readonly unidentifiable: number;
  /** Roster rows covered by a resolved name, however it resolved. */
  readonly rowsResolved: number;
  readonly rowsTotal: number;
  /** Relationships this file would yield if a publication decision existed. */
  readonly relationshipsAvailable: number;
};

export function crosswalkProgress(crosswalk: InductionCrosswalk): CrosswalkProgress {
  let unresolved = 0;
  let inductee = 0;
  let notAnInductee = 0;
  let unidentifiable = 0;
  let rowsResolved = 0;
  let rowsTotal = 0;
  let relationshipsAvailable = 0;

  for (const entry of crosswalk.entries) {
    rowsTotal += entry.inducted.length;
    const resolution = entry.resolution;
    if (resolution.status === 'unresolved') { unresolved += 1; continue; }
    rowsResolved += entry.inducted.length;
    if (resolution.status === 'inductee') {
      inductee += 1;
      // A row naming its own subject yields nothing, so it is not counted here
      // either: the number has to match what the build would actually emit.
      relationshipsAvailable += entry.inducted.filter((id) => id !== resolution.inducteeId).length;
    } else if (resolution.status === 'not-an-inductee') notAnInductee += 1;
    else unidentifiable += 1;
  }

  return {
    total: crosswalk.entries.length,
    unresolved, inductee, notAnInductee, unidentifiable,
    rowsResolved, rowsTotal, relationshipsAvailable,
  };
}

/**
 * The relationships a resolved crosswalk yields.
 *
 * Returns nothing without a publication decision. Knowing who a name refers to
 * is not permission to say so on a wall, and this is the join where the two
 * would otherwise be easy to merge by accident.
 *
 * `nameOf` supplies display names for the labels. A person whose name cannot
 * be resolved produces no relationship rather than a label with a hole in it.
 */
export function inductionRelationships(
  crosswalk: InductionCrosswalk,
  nameOf: (id: InducteeId) => string | undefined,
): DocumentedRelationship[] {
  const decision = crosswalk.publicationDecision;
  if (!decision) return [];

  const review: Review = {
    status: 'approved',
    decisionReference: decision.decisionReference,
    contentVersion: decision.contentVersion,
    ...(decision.reviewedAt === undefined ? {} : { reviewedAt: decision.reviewedAt }),
  };

  const relationships: DocumentedRelationship[] = [];
  for (const entry of crosswalk.entries) {
    if (entry.resolution.status !== 'inductee') continue;
    const inducter = entry.resolution.inducteeId;
    const inducterName = nameOf(inducter);
    if (!inducterName) continue;

    for (const inducted of entry.inducted) {
      // A roster row naming its own subject is a data error, not a loop in the
      // civic record. Emitting it would draw a line from a portrait to itself.
      if (inducted === inducter) continue;
      const inductedName = nameOf(inducted);
      if (!inductedName) continue;

      relationships.push({
        claim: 'documented',
        id: `induction:${inducter}:${inducted}` as ConnectionId,
        from: inducter,
        to: inducted,
        kind: 'inducted',
        label: `inducted ${inductedName}`,
        inverseLabel: `was inducted by ${inducterName}`,
        review,
        publication: decision.publication,
        evidence: [inductionEvidence(entry.recordedName)],
      });
    }
  }
  return relationships;
}

/**
 * The citation behind an induction relationship.
 *
 * Quotes the roster's own wording, so a reader can see that the record said
 * "Sam Miller" and that a curator decided which Sam Miller that was.
 */
export function inductionEvidence(recordedName: string): Evidence {
  return {
    id: 'cihof-kiosk-manifest#inducted_by',
    title: 'CIHOF kiosk manifest, inducted_by',
    kind: 'collection-record',
    heldBy: 'Cleveland International Hall of Fame',
    excerpt: recordedName,
  };
}

/** Rows a reviewer still has to look at, most-used names first. */
export function unresolvedEntries(crosswalk: InductionCrosswalk): CrosswalkEntry[] {
  return crosswalk.entries
    .filter((entry) => entry.resolution.status === 'unresolved')
    .sort((a, b) => b.inducted.length - a.inducted.length || a.recordedName.localeCompare(b.recordedName));
}
