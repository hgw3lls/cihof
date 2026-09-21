/**
 * Prose carries where it came from.
 *
 * The published record mixes three kinds of text that look identical once
 * rendered: the institution's biography, wording a curator approved, and lines
 * a generator composed from tags. In the previous model all three were plain
 * strings, so `honoredForSummary` — a template reading "Contributions to <a>,
 * <b> and <c> within <Demonym> heritage communities…" — was rendered to
 * visitors indistinguishably from the biography.
 *
 * Making provenance part of the value means a renderer cannot present
 * generated text as a curatorial claim without saying so.
 */
export type TextProvenance =
  /** Wording supplied by the institution's own record. Reproduced, never edited. */
  | 'source'
  /** Wording a curator wrote or approved, traceable to a decision. */
  | 'curated'
  /** Composed by a generator from structured fields. Not anybody's claim. */
  | 'generated'
  /**
   * Cannot be told apart. The field is documented as curator-owned but its
   * value does not match what the generator would compose today, which may mean
   * a curator edited it or may mean the inputs changed since it was composed.
   * Rendered as cautiously as 'generated'.
   */
  | 'unverified';

export type AttributedText = {
  readonly text: string;
  readonly provenance: TextProvenance;
  /** Where the wording came from: a decision reference, or a generator name. */
  readonly origin?: string;
};

export function attributed(text: string, provenance: TextProvenance, origin?: string): AttributedText | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  return origin === undefined ? { text: trimmed, provenance } : { text: trimmed, provenance, origin };
}

/** True when the text is somebody's claim rather than a generator's composition. */
export function isAttributable(value: AttributedText | null | undefined): boolean {
  if (!value) return false;
  return value.provenance === 'source' || value.provenance === 'curated';
}
