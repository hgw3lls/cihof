/**
 * When something happened, and how well that is known.
 *
 * The collection carries one date per person — the induction year — and the
 * exhibit has been answering three different questions with it: when a person
 * was active, when something happened, and when the hall honoured them. The
 * first two are usually decades earlier than the third. A chronology built on
 * induction year is a chronology of the hall's own paperwork.
 *
 * So a date here states its own precision, and nothing derives a date of
 * activity from a class year.
 */

export type DatePrecision =
  /** A specific day: `1971-06-14`. */
  | 'day'
  /** A month, day unknown: `1971-06`. */
  | 'month'
  /** A year: `1971`. */
  | 'year'
  /** A decade the source names, e.g. "the early 1970s": start `1970`. */
  | 'decade'
  /** Known to fall between `start` and `end`, no closer. */
  | 'range'
  /** The source does not say. Not the same as "did not happen". */
  | 'unknown';

export type Timespan = {
  /** ISO 8601 truncated to `precision`. Absent only when precision is 'unknown'. */
  readonly start?: string;
  /** The close of a span. Absent for a moment, or for work still continuing. */
  readonly end?: string;
  readonly precision: DatePrecision;
  /** The source's own wording, e.g. "the early 1970s". Displayed, never parsed. */
  readonly label?: string;
  /** True where the source hedges. A hedged date is still a date. */
  readonly approximate?: boolean;
};

/**
 * Three answers, not two.
 *
 * A record with no date is not a record outside the window. Collapsing those
 * two is how a time control quietly asserts that a person was absent from a
 * decade when the truth is that nobody wrote the year down — and with 111
 * people carrying a single date each, that would be most of the collection.
 */
export type TimeMatch = 'inside' | 'outside' | 'undated';

export const undated: Timespan = { precision: 'unknown' };

/** The first and last year a span can cover, or null when it is not dated. */
export function spanYears(span: Timespan | undefined): readonly [number, number] | null {
  if (!span || span.precision === 'unknown') return null;
  const first = yearPart(span.start);
  if (first === null) return null;
  const last = yearPart(span.end);
  if (last !== null) return [Math.min(first, last), Math.max(first, last)];
  // An open decade covers its ten years; an open range or a moment covers one.
  // A span still running is closed at its start here and re-opened by callers
  // that know today's date, so this stays a pure function.
  return span.precision === 'decade' ? [first, first + 9] : [first, first];
}

export function matchesWindow(span: Timespan | undefined, fromYear: number, toYear: number): TimeMatch {
  const years = spanYears(span);
  if (years === null) return 'undated';
  const [first, last] = years;
  const low = Math.min(fromYear, toYear);
  const high = Math.max(fromYear, toYear);
  return last >= low && first <= high ? 'inside' : 'outside';
}

export type WindowPartition<T> = {
  readonly inside: readonly T[];
  readonly outside: readonly T[];
  readonly undated: readonly T[];
};

/**
 * Split records against a window without deciding what to do with the undated.
 *
 * Returning three lists rather than a filtered one forces the caller to say,
 * in its own code, whether an undated record is shown, hidden or counted
 * separately. A boolean filter would let that decision be made by accident.
 */
export function partitionByWindow<T>(
  records: readonly T[],
  dateOf: (record: T) => Timespan | undefined,
  fromYear: number,
  toYear: number,
): WindowPartition<T> {
  const inside: T[] = [];
  const outside: T[] = [];
  const missing: T[] = [];
  for (const record of records) {
    const match = matchesWindow(dateOf(record), fromYear, toYear);
    if (match === 'inside') inside.push(record);
    else if (match === 'outside') outside.push(record);
    else missing.push(record);
  }
  return { inside, outside, undated: missing };
}

/**
 * How a date should be read aloud or printed.
 *
 * The source's own wording wins when it has any: "the early 1970s" is more
 * honest than "1970" and more useful than "1970–1979".
 */
export function describeTimespan(span: Timespan | undefined): string | null {
  if (!span || span.precision === 'unknown') return null;
  if (span.label) return span.label;
  const years = spanYears(span);
  if (years === null) return null;
  const [first, last] = years;
  const hedge = span.approximate === true ? 'about ' : '';
  if (span.precision === 'decade') return `${hedge}the ${first}s`;
  return first === last ? `${hedge}${first}` : `${hedge}${first}–${last}`;
}

/** Sort key that keeps undated records in the list rather than dropping them. */
export function startYearOrNull(span: Timespan | undefined): number | null {
  const years = spanYears(span);
  return years === null ? null : years[0];
}

function yearPart(value: string | undefined): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(-?\d{4})\b/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}
