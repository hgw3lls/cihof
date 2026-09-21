/**
 * Reproductions of the generator that composed the curated text fields.
 *
 * `honoredForSummary` and `documentedContextLine` are documented in the curated
 * roster's own reviewGuidance as curator-written. In fact all 111 values were
 * composed by scripts/generate-first-pass-content-decisions.js, written into
 * data/curation-decisions/cihof-first-pass-content.csv, and bulk-applied on
 * 2026-09-12. Nothing in the record says which is which.
 *
 * Re-composing and comparing recovers that. A value matching what the generator
 * would produce is machine text. A value that differs cannot be settled from
 * the data alone — a curator may have edited it, or the tags it was composed
 * from may have changed since — so it is reported as unverified rather than
 * credited to a curator who may not have written it.
 */

export function composeContextLine(input: {
  classYear: number | null;
  inductedBy: string;
  region: string;
  countryTags: readonly string[];
  communityTags: readonly string[];
}): string {
  const identity = input.countryTags.length > 0
    ? input.countryTags.join(', ')
    : input.communityTags.length > 0
      ? input.communityTags.join(', ')
      : input.region;
  const classLabel = input.classYear ? `Class of ${input.classYear}` : 'Cleveland International Hall of Fame inductee';
  const inductedBy = input.inductedBy ? ` Inducted by ${input.inductedBy}.` : '';
  return `${classLabel} honoree connected to ${identity || 'Cleveland international communities'}.${inductedBy}`.trim();
}

export function composeHonoredFor(themeTags: readonly string[], countryTags: readonly string[]): string {
  const themes = themeTags.length > 0 ? themeTags : ['civic leadership', 'community service'];
  const community = countryTags.length > 0 ? ` within ${countryTags.slice(0, 2).join(' and ')} heritage communities` : '';
  return `Contributions to ${humanList(themes.map(lowerFirst))}${community} and to Greater Cleveland's multicultural civic life.`;
}

function humanList(values: readonly string[]): string {
  if (values.length <= 1) return values[0] ?? '';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function lowerFirst(value: string): string {
  return value ? value.toLowerCase() : value;
}

/** Shape of a line the honoredFor generator produces, whatever its inputs were. */
const honoredForShape = /^Contributions to .+ and to Greater Cleveland's multicultural civic life\.$/s;
/** Shape of a line the context generator produces, whatever its inputs were. */
const contextShape = /^(Class of \d{4}|Cleveland International Hall of Fame inductee) honoree connected to .+\.(\s+Inducted by .+\.)?$/s;

export type ComposedKind = 'generated' | 'unverified';

/**
 * Classifies a stored value against the generator that may have written it.
 *
 * An exact match is machine text. A value that still carries the generator's
 * sentence shape is also machine text composed from inputs that have changed
 * since — that is how all 76 non-matching `honoredForSummary` values arose.
 * Anything else cannot be settled from the data and is left unverified.
 */
export function classifyComposed(stored: string, expected: string, kind: 'honoredFor' | 'context'): ComposedKind {
  const value = stored.trim();
  if (value === expected.trim()) return 'generated';
  const shape = kind === 'honoredFor' ? honoredForShape : contextShape;
  return shape.test(value) ? 'generated' : 'unverified';
}
