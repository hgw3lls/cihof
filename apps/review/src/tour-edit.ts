import type { TourChanges } from './api.ts';

/**
 * What the tour editor's hands-on changes do to a tour's rules.
 *
 * A tour's people are chosen by its words and honours, with the people a
 * curator put first leading in their order and the people they left out never
 * appearing. The editor shows the result as one list to rearrange, so each
 * change made on the list is turned back into those rules here:
 *
 *   moving someone  puts them, and everyone above them, first in this order;
 *                   below them the rules choose as before
 *   adding someone  puts them first, after the others put first
 *   leaving out     takes them out of the list for good, even if the words
 *                   would choose them
 *   putting back    lets the words choose them again
 */

/** The people put first after moving one person in the list as it shows. */
export function moved(order: readonly string[], pinned: readonly string[], from: number, to: number): string[] {
  if (from === to || from < 0 || from >= order.length) return pinned.filter((id) => order.includes(id));
  const next = [...order];
  const [id] = next.splice(from, 1);
  const at = Math.max(0, Math.min(to, next.length));
  next.splice(at, 0, id!);
  const last = Math.max(at, ...pinned.map((each) => next.indexOf(each)));
  return next.slice(0, last + 1);
}

export function withMove(changes: TourChanges, order: readonly string[], from: number, to: number): TourChanges {
  const pinnedPersonIds = moved(order, changes.pinnedPersonIds, from, to);
  return { ...changes, pinnedPersonIds, maxPortraits: Math.max(changes.maxPortraits, pinnedPersonIds.length) };
}

export function withAdded(changes: TourChanges, id: string): TourChanges {
  const pinnedPersonIds = [...changes.pinnedPersonIds.filter((each) => each !== id), id];
  return {
    ...changes,
    pinnedPersonIds,
    excludedPersonIds: changes.excludedPersonIds.filter((each) => each !== id),
    // Someone put in by hand is never cut off by the length.
    maxPortraits: Math.max(changes.maxPortraits, pinnedPersonIds.length),
  };
}

export function withLeftOut(changes: TourChanges, id: string): TourChanges {
  return {
    ...changes,
    pinnedPersonIds: changes.pinnedPersonIds.filter((each) => each !== id),
    excludedPersonIds: changes.excludedPersonIds.includes(id) ? changes.excludedPersonIds : [...changes.excludedPersonIds, id],
  };
}

export function withPutBack(changes: TourChanges, id: string): TourChanges {
  return { ...changes, excludedPersonIds: changes.excludedPersonIds.filter((each) => each !== id) };
}

/** A word or honour added to look for, once, as typed. */
export function withWord(list: readonly string[], word: string): string[] {
  const value = word.trim();
  if (!value || list.some((each) => each.toLowerCase() === value.toLowerCase())) return [...list];
  return [...list, value];
}

export function sameChanges(a: TourChanges, b: TourChanges): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * A name for a new tour, from the words it is called by, as the pipeline's
 * newTourId makes it: lowercase, hyphened, and different from every name in
 * `taken`. tours:apply checks it again.
 */
export function newTourId(label: string, taken: ReadonlySet<string>): string {
  const base = label.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 50).replace(/-+$/, '') || 'tour';
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** A tour with nobody put in it and nothing to choose anybody by, as the pipeline's choosesNobody: a new one may not be made so. */
export function choosesNobody(changes: Pick<TourChanges, 'terms' | 'themes' | 'pinnedPersonIds'>): boolean {
  return changes.terms.length === 0 && changes.themes.length === 0 && changes.pinnedPersonIds.length === 0;
}
