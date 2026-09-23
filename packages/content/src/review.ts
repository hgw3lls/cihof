/**
 * The sheet a curator signs the induction relationships off in.
 *
 * The crosswalk already holds the question — who is the person the roster wrote
 * down — and `inductionRelationships` already holds the answer's consequence.
 * What was missing is the surface between them: somewhere the person deciding
 * can see, for one recorded name, exactly which relationships their signature
 * would publish and on what evidence.
 *
 * So this sheet composes nothing of its own. Every proposal in it comes from
 * `proposedRelationships`, the same function the build uses, and the preview is
 * the record — not a rendering of it.
 *
 * What it will not do is decide. A generator can compose a label from two names
 * it already holds; it cannot know whether the Sam Miller on the roster is
 * Samuel H. Miller, and it cannot grant permission to say so on a wall. Those
 * are the two columns this sheet leaves empty, and the emptiness is the point:
 * `decisionReference` and `contentVersion` exist to record that a person
 * decided, so a sheet that filled them in would defeat the only check that
 * stands between a heuristic and a visitor.
 *
 * Rows are banded by how much judgement each needs, because the sheet is also
 * an estimate. Showing only the easy band would understate the work.
 */

import type {
  CrosswalkCandidate, CrosswalkEntry, CrosswalkPublicationDecision, CrosswalkResolution,
  InductionCrosswalk, ProposedRelationship,
} from './crosswalk.ts';
import type { InducteeId } from './identity.ts';
import { linksThreshold, placesThreshold } from './lenses.ts';

/**
 * How much judgement a row needs, decided by what the corpus could offer.
 *
 * Not a confidence score. A single candidate is not evidence that it is right —
 * it means nothing else was proposed, and the reviewer still has to agree.
 */
export type ReviewBand =
  /** One candidate, nothing to choose between. Confirm or reject. */
  | 'single-candidate'
  /** More than one candidate. A real choice, on the sources. */
  | 'ambiguous'
  /** No candidate. The reviewer starts from the recorded name alone. */
  | 'no-candidate';

export type ReviewRow = {
  readonly entryId: string;
  /** The value exactly as the roster records it. Never cleaned up. */
  readonly recordedName: string;
  readonly band: ReviewBand;
  /** The inductees whose rows name this person as their inducter. */
  readonly inducted: readonly InducteeId[];
  readonly candidates: readonly CrosswalkCandidate[];
  /**
   * What accepting the first candidate would publish, composed in full.
   *
   * Empty for a row with no candidate, and for an ambiguous row — proposing one
   * of several readings would put a thumb on a scale the reviewer is there to
   * hold.
   */
  readonly proposes: readonly ProposedRelationship[];
  /** Carried from the crosswalk. The sheet never writes this. */
  readonly resolution: CrosswalkResolution;
};

export type RelationshipReviewSheet = {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly source: string;
  /** Carried from the crosswalk. Absent until somebody signs it. */
  readonly publicationDecision?: CrosswalkPublicationDecision;
  readonly rows: readonly ReviewRow[];
};

export type ReviewProgress = {
  readonly names: number;
  readonly singleCandidate: number;
  readonly ambiguous: number;
  readonly noCandidate: number;
  readonly resolved: number;
  readonly unresolved: number;
  /** Relationships the resolutions already recorded would yield. */
  readonly relationshipsResolved: number;
  /** Relationships the unaccepted single candidates would add on top. */
  readonly relationshipsProposed: number;
  readonly publicationDecisionSigned: boolean;
  /** What the Links lens would count today. Zero without a decision. */
  readonly linksCount: number;
  readonly linksThreshold: number;
  readonly linksWouldOpen: boolean;
};

export function reviewProgress(sheet: RelationshipReviewSheet): ReviewProgress {
  let singleCandidate = 0;
  let ambiguous = 0;
  let noCandidate = 0;
  let resolved = 0;
  let relationshipsResolved = 0;
  let relationshipsProposed = 0;

  for (const row of sheet.rows) {
    if (row.band === 'single-candidate') singleCandidate += 1;
    else if (row.band === 'ambiguous') ambiguous += 1;
    else noCandidate += 1;

    if (row.resolution.status !== 'unresolved') resolved += 1;

    if (row.resolution.status === 'inductee') {
      const self = row.resolution.inducteeId;
      relationshipsResolved += row.inducted.filter((id) => id !== self).length;
    } else if (row.resolution.status === 'unresolved') {
      relationshipsProposed += row.proposes.length;
    }
  }

  const signed = sheet.publicationDecision !== undefined;
  // Resolving grants no permission. Without a decision the build emits nothing,
  // so the count a curator is owed here is zero, not the number they could have.
  const linksCount = signed ? relationshipsResolved : 0;

  return {
    names: sheet.rows.length,
    singleCandidate, ambiguous, noCandidate,
    resolved, unresolved: sheet.rows.length - resolved,
    relationshipsResolved, relationshipsProposed,
    publicationDecisionSigned: signed,
    linksCount,
    linksThreshold,
    linksWouldOpen: linksCount >= linksThreshold,
  };
}

/**
 * What still stands between this sheet and an open lens, in order.
 *
 * Written for the person who has to act on it, so it names the next thing to do
 * rather than everything that is not done.
 */
export function reviewRemaining(sheet: RelationshipReviewSheet): string[] {
  const progress = reviewProgress(sheet);
  const remaining: string[] = [];

  if (progress.relationshipsResolved === 0) {
    remaining.push(
      `no name is resolved to an inductee yet; confirming the ${progress.singleCandidate} single-candidate rows `
      + `would yield ${progress.relationshipsProposed} relationships`,
    );
  } else if (progress.relationshipsResolved < linksThreshold) {
    remaining.push(
      `${progress.relationshipsResolved} relationships resolved, ${linksThreshold} needed `
      + `(${progress.relationshipsProposed} more are proposed and unaccepted)`,
    );
  }

  if (!progress.publicationDecisionSigned) {
    remaining.push(
      'no publicationDecision: resolving a name says who someone is, not that the relationship may be shown',
    );
  }

  return remaining;
}

/**
 * Why a row cannot be acted on as it stands.
 *
 * A resolution that names an inductee nobody can find, or that resolves a name
 * to the very person it inducted, would pass the crosswalk's own shape check
 * and yield nothing — which reads as a reviewer's work having gone missing.
 */
export function reviewRowProblems(row: ReviewRow, isKnownPerson: (id: InducteeId) => boolean): string[] {
  const problems: string[] = [];
  const resolution = row.resolution;
  if (resolution.status !== 'inductee') return problems;

  if (!isKnownPerson(resolution.inducteeId)) {
    problems.push(`resolved to ${resolution.inducteeId}, who is not on the roster`);
  }
  if (row.inducted.every((id) => id === resolution.inducteeId)) {
    problems.push('resolved to the only person this row records them as inducting, so it yields nothing');
  }
  if (!nonEmpty(resolution.decisionReference)) {
    problems.push('resolved without a decision reference');
  }
  return problems;
}

/** The band a row falls in, from what the corpus could offer for it. */
export function bandOf(entry: CrosswalkEntry): ReviewBand {
  if (entry.candidates.length === 0) return 'no-candidate';
  return entry.candidates.length === 1 ? 'single-candidate' : 'ambiguous';
}

/** Rows a reviewer can act on fastest: one candidate, still unresolved. */
export function readyToConfirm(sheet: RelationshipReviewSheet): ReviewRow[] {
  return sheet.rows.filter((row) => row.band === 'single-candidate' && row.resolution.status === 'unresolved');
}

/** The sheet's own view of the crosswalk it came from, for the apply step. */
export function sheetMatchesCrosswalk(sheet: RelationshipReviewSheet, crosswalk: InductionCrosswalk): boolean {
  if (sheet.rows.length !== crosswalk.entries.length) return false;
  const names = new Set(crosswalk.entries.map((entry) => entry.recordedName));
  return sheet.rows.every((row) => names.has(row.recordedName));
}

function nonEmpty(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

// ------------------------------------------------------------ places

/**
 * How much work a place row needs before it can be shown.
 *
 * Not a quality judgement. `lead` means the archive found a name and nobody has
 * written a history for it, and `PublishedPlace` requires one — so a lead
 * cannot be approved into existence however willing the reviewer.
 */
export type PlaceBand = 'researched' | 'lead';

export type PlaceReviewRow = {
  readonly placeId: string;
  readonly name: string;
  readonly band: PlaceBand;
  readonly neighborhood: string;
  readonly shortHistory: string;
  /** People the archive ties to this place, with the verb it used. */
  readonly ties: readonly {
    readonly person: string;
    readonly displayName: string;
    readonly kind: string;
    readonly role: string | null;
  }[];
  readonly reviewed: boolean;
};

export type PlaceReviewSheet = {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly source: string;
  readonly rows: readonly PlaceReviewRow[];
};

export type PlaceReviewProgress = {
  readonly places: number;
  readonly researched: number;
  readonly leads: number;
  readonly reviewed: number;
  readonly ties: number;
  readonly tiesWithRole: number;
  /** Places that could be published today: reviewed, and with a history. */
  readonly publishable: number;
  readonly placesThreshold: number;
  readonly placesWouldOpen: boolean;
};

export function placeReviewProgress(sheet: PlaceReviewSheet): PlaceReviewProgress {
  let researched = 0;
  let reviewed = 0;
  let ties = 0;
  let tiesWithRole = 0;
  let publishable = 0;

  for (const row of sheet.rows) {
    if (row.band === 'researched') researched += 1;
    if (row.reviewed) reviewed += 1;
    // A review on a place with no history publishes a name and a blank
    // paragraph, so it does not count towards the lens however it is marked.
    if (row.reviewed && row.band === 'researched') publishable += 1;
    ties += row.ties.length;
    tiesWithRole += row.ties.filter((tie) => tie.role !== null && tie.role !== '').length;
  }

  return {
    places: sheet.rows.length,
    researched,
    leads: sheet.rows.length - researched,
    reviewed,
    ties,
    tiesWithRole,
    publishable,
    placesThreshold,
    placesWouldOpen: publishable >= placesThreshold,
  };
}

/** What still stands between this sheet and an open Places lens. */
export function placeReviewRemaining(sheet: PlaceReviewSheet): string[] {
  const progress = placeReviewProgress(sheet);
  const remaining: string[] = [];

  if (progress.publishable < placesThreshold) {
    const short = placesThreshold - progress.publishable;
    remaining.push(
      `${progress.publishable} of ${placesThreshold} places are reviewed and have a history; `
      + `${short} more needed, and ${progress.researched - progress.publishable} researched place(s) are still unreviewed`,
    );
  }
  if (progress.tiesWithRole < progress.ties) {
    remaining.push(
      `${progress.ties - progress.tiesWithRole} of ${progress.ties} person-to-place ties have no role, `
      + 'and a tie without one does not say what the person did there',
    );
  }
  return remaining;
}
