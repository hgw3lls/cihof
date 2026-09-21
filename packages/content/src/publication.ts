/**
 * Publication rules.
 *
 * One implementation, shared by every generator and every app. Duplicating
 * these is the single change most likely to put unapproved content on a public
 * wall, so nothing may re-derive them locally.
 *
 * Two ideas are kept apart deliberately:
 *
 *   review     — has a human decided about this content?
 *   target     — which audiences did that decision cover?
 *
 * Approval is not permission. A record approved for the kiosk is not thereby
 * approved for the public web.
 */

export type VisitorTarget = 'public' | 'kiosk';
export type StaffTarget = 'portal';
export type Target = VisitorTarget | StaffTarget;

export type ReviewStatus = 'draft' | 'needs-review' | 'approved' | 'withheld';

export type Review = {
  status: ReviewStatus;
  /** Identifier of the decision this rests on. Required for approval. */
  decisionReference?: string;
  /** Content version the decision was made against. Required for approval. */
  contentVersion?: string;
  reviewedAt?: string;
  note?: string;
};

export type Publication = {
  publicWeb: boolean;
  kiosk: boolean;
  staffOnly?: boolean;
};

export type Reviewed = {
  review: Review;
  publication: Publication;
};

/**
 * An approval must say what decided it and what it decided about.
 *
 * A bare `status: 'approved'` is not enough: without a decision reference the
 * approval cannot be traced to a person, and without a content version it
 * cannot be told which wording it covered.
 */
export function isApproved(review: Review | undefined): boolean {
  if (!review || review.status !== 'approved') return false;
  return nonEmpty(review.decisionReference) && nonEmpty(review.contentVersion);
}

export function allowsTarget(publication: Publication | undefined, target: VisitorTarget): boolean {
  if (!publication) return false;
  if (publication.staffOnly === true) return false;
  return target === 'public' ? publication.publicWeb : publication.kiosk;
}

/** Enrichment reaches a visitor only with an approval that named their target. */
export function isPublished(value: Partial<Reviewed> | undefined, target: VisitorTarget): boolean {
  if (!value) return false;
  return isApproved(value.review) && allowsTarget(value.publication, target);
}

function nonEmpty(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
