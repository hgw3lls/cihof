import { createHash } from 'node:crypto';

/**
 * What a place approval covers: the words a visitor reads about the place.
 *
 * A place shows its name, its neighbourhood and a short history. An approval
 * records a fingerprint of those three as its content version, so an edit
 * after approval holds the place back rather than letting new wording ride on
 * an old decision, as the attract words and the profiles already do.
 *
 * Approvals made before this existed recorded the fixed label `places-v1`,
 * which names no words. They still publish, because a curator did approve the
 * place, but the staff review app offers each of them again, so the words
 * visitors read get looked at and a fingerprint recorded.
 */

type PlaceWords = {
  readonly name?: unknown;
  readonly neighborhood?: unknown;
  readonly shortHistory?: unknown;
  readonly review?: { readonly contentVersion?: unknown } | null;
};

export const legacyPlaceVersion = 'places-v1';

/** The Places screen has room for this much history at its reading size. */
export const placeHistoryLimit = 420;

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** The version an approval must name: a fingerprint of the words themselves. */
export function placeTextVersion(place: PlaceWords): string {
  const words = JSON.stringify([text(place.name), text(place.neighborhood), text(place.shortHistory)]);
  return `place-${createHash('sha256').update(words).digest('hex').slice(0, 12)}`;
}

/**
 * Whether an approved place may show the words it has now. `legacy` is an
 * approval that predates fingerprints: shown, and offered for review again.
 */
export function placeWordsState(place: PlaceWords): 'current' | 'legacy' | 'changed' {
  const recorded = place.review?.contentVersion;
  if (recorded === legacyPlaceVersion) return 'legacy';
  return recorded === placeTextVersion(place) ? 'current' : 'changed';
}

/** Why a history cannot be approved as written, or null when it can. */
export function placeHistoryProblem(history: string): string | null {
  const words = history.trim();
  if (!words) return 'the history is empty, so the place would show a name and nothing about it';
  if (words.length > placeHistoryLimit) return `the history is ${words.length} characters; the screen has room for ${placeHistoryLimit}`;
  if (/[\r\n]/.test(words)) return 'the history is one paragraph; take out the line breaks';
  return null;
}
