import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isPublished, type VisitorTarget } from '@cihof/content';
import { dataFile } from '../paths.ts';

/**
 * Words the exhibit shows that belong to no one person, such as the attract
 * screen's headline.
 *
 * They are visitor text like any other, so they follow the same rule: shown
 * only once a curator has approved them for this target, and only in the
 * exact words that were approved. The content version is a fingerprint of the
 * words, so an edit after approval holds the block back rather than letting
 * unreviewed wording ride on an old decision.
 */

export type AttractText = {
  readonly headline: string;
  readonly tagline: string;
  /** Only in an editor's preview: shown although nobody has approved it. */
  readonly unreviewed?: true;
};

type StoredBlock = {
  readonly headline?: unknown;
  readonly tagline?: unknown;
  readonly review?: { status?: string; decisionReference?: string; contentVersion?: string };
  readonly publication?: { kiosk?: boolean; publicWeb?: boolean };
};

export type StoredExhibitText = { readonly attract?: StoredBlock };

export function readExhibitText(): StoredExhibitText {
  return JSON.parse(readFileSync(dataFile('cihof_exhibit_text.json'), 'utf8')) as StoredExhibitText;
}

/** The version an approval must name: a fingerprint of the words themselves. */
export function attractTextVersion(headline: string, tagline: string): string {
  return `text-${createHash('sha256').update(JSON.stringify([headline, tagline])).digest('hex').slice(0, 12)}`;
}

export type AttractTextStatus = {
  readonly text: AttractText | null;
  /** What an approval of the current words would record as contentVersion. */
  readonly contentVersion: string | null;
  readonly problem: string | null;
};

export function publishedAttractText(
  target: VisitorTarget,
  { preview = false, stored = readExhibitText() }: { preview?: boolean; stored?: StoredExhibitText } = {},
): AttractTextStatus {
  const block = stored.attract;
  const headline = typeof block?.headline === 'string' ? block.headline.trim() : '';
  const tagline = typeof block?.tagline === 'string' ? block.tagline.trim() : '';
  if (!block || !headline) return { text: null, contentVersion: null, problem: 'no attract headline is written' };

  const contentVersion = attractTextVersion(headline, tagline);
  const review = block.review ?? {};
  let problem: string | null = null;
  if (!isPublished({ review: review as never, publication: block.publication as never }, target)) {
    problem = review.status === 'approved' ? `not approved for the ${target} target` : `review status is ${review.status ?? 'missing'}`;
  } else if (review.contentVersion !== contentVersion) {
    problem = 'the words have changed since they were approved';
  }

  if (!problem) return { text: { headline, tagline }, contentVersion, problem: null };
  // An editor's preview shows the words, marked, so they can be judged in place.
  if (preview) return { text: { headline, tagline, unreviewed: true }, contentVersion, problem };
  return { text: null, contentVersion, problem };
}
