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
