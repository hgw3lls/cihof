import { labelFrom, type PublishedRelationship } from '@cihof/content';
import type { RuntimePerson } from '../data/runtime.ts';
import type { Discovery } from './exhibit.ts';

/**
 * Discovery narrows lists. It is applied where a visitor is choosing between
 * people, and nowhere else — a search term must never reach a relationship
 * graph, where filtering the collection empties the very connections the search
 * was meant to help navigate.
 */
export function matching(people: readonly RuntimePerson[], discovery: Discovery): RuntimePerson[] {
  const query = fold(discovery.query);
  return people.filter((person) => {
    if (query && !fold(searchText(person)).includes(query)) return false;
    if (discovery.communities.length > 0 && !discovery.communities.some((value) => person.communities.includes(value))) return false;
    if (discovery.contributions.length > 0 && !discovery.contributions.some((value) => person.contributions.includes(value))) return false;
    if (discovery.years.length > 0 && !discovery.years.includes(person.classYear ?? -1)) return false;
    return true;
  });
}

/** Facet options come from what the collection actually offers, in order. */
export function optionsFor(people: readonly RuntimePerson[], dimension: 'communities' | 'contributions'): string[] {
  return [...new Set(people.flatMap((person) => person[dimension]))].sort((a, b) => a.localeCompare(b));
}

export function yearsIn(people: readonly RuntimePerson[]): number[] {
  return [...new Set(people.map((person) => person.classYear).filter((year): year is number => year !== null))]
    .sort((a, b) => b - a);
}

function searchText(person: RuntimePerson): string {
  // Only tags a reviewer stands behind are searchable; the bundle contains no
  // others, so this cannot accidentally match an inferred label.
  return [person.name, person.sortName, person.classYear, ...person.contributions, ...person.communities, ...person.countries]
    .filter(Boolean).join(' ');
}

function fold(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').trim();
}

export type InductionClass = {
  readonly year: number;
  readonly people: readonly RuntimePerson[];
};

/**
 * The collection by induction class, newest first.
 *
 * Only people with a recorded year appear. Someone undated is not placed in a
 * guessed class — the collection says their year is not recorded, and the
 * chronology says the same by leaving them out of it rather than inventing a
 * home for them.
 */
export function inductionClasses(people: readonly RuntimePerson[]): InductionClass[] {
  const byYear = new Map<number, RuntimePerson[]>();
  for (const person of people) {
    if (person.classYear === null) continue;
    const bucket = byYear.get(person.classYear);
    if (bucket) bucket.push(person); else byYear.set(person.classYear, [person]);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, members]) => ({ year, people: members.slice().sort((a, b) => a.sortName.localeCompare(b.sortName)) }));
}

/** How many people the chronology cannot place, stated rather than hidden. */
export function undatedCount(people: readonly RuntimePerson[]): number {
  return people.filter((person) => person.classYear === null).length;
}

export type Tie = {
  readonly other: RuntimePerson;
  /** How the claim reads outwards from this person. Never composed here. */
  readonly label: string;
  readonly connectionId: string;
};

export type ConnectionNode = {
  readonly person: RuntimePerson;
  readonly ties: readonly Tie[];
};

/**
 * Documented relationships, gathered per person.
 *
 * Note what this does not take: `Discovery`. Every other selector here narrows
 * a list a visitor is choosing from, and narrowing this one removes the people
 * the graph exists to reach.
 *
 * The one thing that could go wrong silently is direction. Reading a forward
 * label from the far endpoint turns "mentored Ana Ruiz" into Ana Ruiz having
 * mentored her own mentor, and the result is a grammatical sentence stating
 * the opposite of what a curator approved. `labelFrom` returns null rather
 * than guess, and a tie nobody can word is dropped rather than worded wrongly.
 */
export function connectionNodes(
  people: readonly RuntimePerson[],
  relationships: readonly PublishedRelationship[],
): ConnectionNode[] {
  const byId = new Map(people.map((person) => [person.id, person]));
  const ties = new Map<string, Tie[]>();

  for (const relationship of relationships) {
    for (const viewpoint of [relationship.from, relationship.to] as readonly string[]) {
      const person = byId.get(viewpoint);
      const other = byId.get(viewpoint === relationship.from ? relationship.to : relationship.from);
      if (!person || !other) continue;

      const label = labelFrom(relationship, viewpoint as typeof relationship.from);
      if (!label) continue;

      const list = ties.get(viewpoint);
      const tie = { other, label, connectionId: relationship.id as string };
      if (list) list.push(tie); else ties.set(viewpoint, [tie]);
    }
  }

  return [...ties.entries()]
    .flatMap(([id, list]) => {
      const person = byId.get(id);
      return person ? [{ person, ties: list }] : [];
    })
    .sort((a, b) => b.ties.length - a.ties.length || a.person.sortName.localeCompare(b.person.sortName));
}
