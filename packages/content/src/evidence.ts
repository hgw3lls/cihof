/**
 * What a claim rests on.
 *
 * The previous model let a relationship be approved without naming a source,
 * which made "approved" mean only that somebody clicked approve. For an
 * interpretive claim about two real people that is not enough: a visitor
 * reading "worked together on this initiative" is owed the record that says so,
 * and a curator revisiting the assertion in five years is owed a way back to it.
 *
 * Evidence is therefore required for approval, not decorative alongside it.
 */

import { isApproved, type Reviewed } from './publication.ts';

export type EvidenceKind =
  | 'primary-source'
  | 'secondary-source'
  | 'catalogue'
  | 'oral-history'
  | 'collection-record'
  | 'correspondence'
  | 'other';

export type Evidence = {
  readonly id: string;
  /** What the source is called, as a reader would find it. */
  readonly title: string;
  readonly kind: EvidenceKind;
  /** Where inside the source: a page, a box and folder, a timecode. */
  readonly locator?: string;
  /** The repository or collection holding it. */
  readonly heldBy?: string;
  readonly url?: string;
  /** A short quotation supporting the claim. Subject to the same rights review. */
  readonly excerpt?: string;
  readonly consultedAt?: string;
};

export type Evidenced = {
  readonly evidence: readonly Evidence[];
};

/** A citation with no title is not a citation. */
export function isUsableEvidence(value: Evidence | undefined): boolean {
  if (!value) return false;
  return nonEmpty(value.id) && nonEmpty(value.title);
}

/**
 * The citations in a record that can actually be followed.
 *
 * Reads defensively because the records it is pointed at are not always this
 * codebase's own. External corpora carry `evidence` as a prose sentence rather
 * than a list, and a string has a `.filter` the way it has a `.length` — it
 * does not. Assuming the shape here threw a TypeError out through
 * `substantiationProblems` and `connectionProblems`, so a reviewer aiming the
 * staff view at an imported file got a stack trace instead of the list of
 * reasons those functions exist to produce.
 *
 * Anything that is not a list of citations carries no citation, which
 * `substantiationProblems` then reports in those words.
 */
export function usableEvidence(values: readonly Evidence[] | undefined): readonly Evidence[] {
  if (!Array.isArray(values)) return [];
  return values.filter(isUsableEvidence);
}

/**
 * Approval plus a source anyone can follow.
 *
 * Deliberately stricter than `isApproved`. A claim that survives review but
 * cites nothing is an assertion the institution is making in its own voice
 * without saying so, and this is the collection's most load-bearing kind of
 * claim: that two people's lives actually touched.
 */
export function isSubstantiated(value: (Partial<Reviewed> & Partial<Evidenced>) | undefined): boolean {
  if (!value) return false;
  return isApproved(value.review) && usableEvidence(value.evidence).length > 0;
}

/** Why a claim is not yet publishable, in words a reviewer can act on. */
export function substantiationProblems(value: (Partial<Reviewed> & Partial<Evidenced>) | undefined): string[] {
  const problems: string[] = [];
  if (!value) return ['record is missing'];
  const review = value.review;
  if (!review) problems.push('no review record');
  else if (review.status !== 'approved') problems.push(`review status is ${review.status}`);
  else {
    if (!nonEmpty(review.decisionReference)) problems.push('approved without a decision reference');
    if (!nonEmpty(review.contentVersion)) problems.push('approved without a content version');
  }
  // Named separately from "no usable evidence": a record whose evidence is a
  // sentence has a citation somebody wrote and a shape nobody converted, and
  // telling a reviewer to go and find a source would be wrong.
  if (value.evidence !== undefined && !Array.isArray(value.evidence)) {
    problems.push('evidence is not a list of citations');
  } else if (usableEvidence(value.evidence).length === 0) {
    problems.push('no usable evidence');
  }
  return problems;
}

function nonEmpty(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
