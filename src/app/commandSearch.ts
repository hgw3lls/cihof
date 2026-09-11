import { buildGeographyTraceModel } from '../data/traceModel';
import type { HallLens, HallLinkedPath, Inductee } from '../data/types';

export type CommandResultKind = 'class' | 'heritage' | 'community' | 'theme' | 'person';

export type CommandSearchResult = {
  id: string;
  kind: CommandResultKind;
  lens: HallLens;
  eyebrow: string;
  title: string;
  subtitle: string;
  score: number;
  personIds: string[];
  person?: Inductee;
  timelineYear?: string;
  traceFocusKey?: string;
};

export type CommandSearchResultGroup = {
  kind: CommandResultKind;
  label: string;
  results: CommandSearchResult[];
};

const commandKindOrder: CommandResultKind[] = ['class', 'heritage', 'community', 'theme', 'person'];
const commandKindLabels: Record<CommandResultKind, string> = {
  class: 'Classes',
  heritage: 'Nationality',
  community: 'Community',
  theme: 'Themes',
  person: 'People',
};
const commandKindLimits: Record<CommandResultKind, number> = {
  class: 4,
  heritage: 5,
  community: 4,
  theme: 4,
  person: 6,
};

export function commandSearchResults(inductees: Inductee[], query: string): CommandSearchResult[] {
  const terms = tokenizeSearchQuery(query);
  if (terms.length === 0) return [];
  const geography = buildGeographyTraceModel(inductees);
  const results = [
    ...commandClassResults(inductees, terms),
    ...commandHeritageResults(geography, terms),
    ...commandCommunityResults(inductees, geography, terms),
    ...commandThemeResults(inductees, terms),
    ...commandPersonResults(inductees, terms),
  ];

  return commandKindOrder.flatMap((kind) => {
    return results
      .filter((result) => result.kind === kind)
      .sort(compareCommandResults)
      .slice(0, commandKindLimits[kind]);
  });
}

export function commandSearchResultGroups(results: CommandSearchResult[]): CommandSearchResultGroup[] {
  return commandKindOrder
    .map((kind) => ({
      kind,
      label: commandKindLabels[kind],
      results: results.filter((result) => result.kind === kind),
    }))
    .filter((group) => group.results.length > 0);
}

export function commandResultToLinkedPath(result: CommandSearchResult): HallLinkedPath {
  return {
    kind: result.kind,
    label: result.title,
    detail: result.subtitle,
    personIds: result.personIds,
    lens: result.lens,
    focusPersonId: result.person?.id,
    timelineYear: result.timelineYear,
    traceFocusKey: result.traceFocusKey,
  };
}

function commandClassResults(inductees: Inductee[], terms: string[]): CommandSearchResult[] {
  const peopleByYear = new Map<number, Inductee[]>();

  inductees.forEach((inductee) => {
    if (!inductee.classYear) return;
    const current = peopleByYear.get(inductee.classYear) ?? [];
    current.push(inductee);
    peopleByYear.set(inductee.classYear, current);
  });

  return Array.from(peopleByYear.entries()).flatMap(([year, people]) => {
    const score = commandLabelScore(`class of ${year} ${year}`, terms, 110);
    if (score === 0) return [];

    const result: CommandSearchResult = {
      id: `class:${year}`,
      kind: 'class',
      lens: 'legacies',
      eyebrow: 'Legacies',
      title: `Class of ${year}`,
      subtitle: `${people.length} inductees / open the class shelf`,
      score,
      personIds: people.map((person) => person.id),
      timelineYear: String(year),
    };
    return [result];
  });
}

function commandHeritageResults(
  geography: ReturnType<typeof buildGeographyTraceModel>,
  terms: string[],
): CommandSearchResult[] {
  return geography.countries.flatMap((country) => {
    const score = commandLabelScore(country.label, terms, 120);
    if (score === 0) return [];

    const result: CommandSearchResult = {
      id: `heritage:${country.id}`,
      kind: 'heritage',
      lens: 'traces',
      eyebrow: 'Traces',
      title: country.label,
      subtitle: `${country.people.length} profiles / ${country.region} heritage path`,
      score,
      personIds: country.people.map((person) => person.id),
      traceFocusKey: country.id,
    };
    if (country.people[0]) result.person = country.people[0];
    return [result];
  });
}

function commandCommunityResults(
  inductees: Inductee[],
  geography: ReturnType<typeof buildGeographyTraceModel>,
  terms: string[],
): CommandSearchResult[] {
  const communities = new Map<string, { label: string; people: Inductee[]; traceFocusKey?: string }>();
  const heritageLabels = new Set(geography.countries.map((country) => normalizeSearchTerm(country.label)));

  geography.regions.forEach((region) => {
    if (heritageLabels.has(normalizeSearchTerm(region.label))) return;
    addCommandCommunity(communities, region.label, region.people, region.id);
  });

  inductees.forEach((inductee) => {
    inductee.communityTags
      .filter(isCommandFacetLabel)
      .forEach((community) => addCommandCommunity(communities, community, [inductee]));
  });

  return Array.from(communities.values()).flatMap((community) => {
    const score = commandLabelScore(community.label, terms, community.traceFocusKey ? 90 : 62);
    if (score === 0) return [];
    const people = sortCommandPeople(community.people);
    const traceFocusKey = community.traceFocusKey;

    const result: CommandSearchResult = {
      id: `community:${slugCommandValue(community.label)}`,
      kind: 'community',
      lens: traceFocusKey ? 'traces' : 'portraits',
      eyebrow: traceFocusKey ? 'Traces' : 'People',
      title: community.label,
      subtitle: `${people.length} profiles / community path`,
      score,
      personIds: people.map((person) => person.id),
    };
    if (people[0]) result.person = people[0];
    if (traceFocusKey) result.traceFocusKey = traceFocusKey;
    return [result];
  });
}

function commandThemeResults(inductees: Inductee[], terms: string[]): CommandSearchResult[] {
  const themes = new Map<string, Inductee[]>();

  inductees.forEach((inductee) => {
    inductee.themeTags
      .filter(isCommandFacetLabel)
      .forEach((theme) => addCommandPeopleFacet(themes, theme, [inductee]));
  });

  return Array.from(themes.entries()).flatMap(([theme, people]) => {
    const score = commandLabelScore(theme, terms, 54);
    if (score === 0) return [];
    const sortedPeople = sortCommandPeople(people);

    const result: CommandSearchResult = {
      id: `theme:${slugCommandValue(theme)}`,
      kind: 'theme',
      lens: 'portraits',
      eyebrow: 'People',
      title: theme,
      subtitle: `${sortedPeople.length} profiles / shared theme`,
      score,
      personIds: sortedPeople.map((person) => person.id),
    };
    if (sortedPeople[0]) result.person = sortedPeople[0];
    return [result];
  });
}

function commandPersonResults(inductees: Inductee[], terms: string[]): CommandSearchResult[] {
  return inductees
    .map((inductee) => ({ inductee, score: commandSearchScore(inductee, terms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.inductee.sortName.localeCompare(b.inductee.sortName))
    .map(({ inductee, score }) => ({
      id: `person:${inductee.id}`,
      kind: 'person' as const,
      lens: 'portraits' as const,
      eyebrow: 'Profile',
      title: inductee.name,
      subtitle: commandResultMeta(inductee),
      score,
      personIds: [inductee.id],
      person: inductee,
    }));
}

function commandSearchScore(inductee: Inductee, terms: string[]) {
  const name = normalizeSearchTerm(inductee.name);
  const sortName = normalizeSearchTerm(inductee.sortName);
  const classYear = inductee.classYear ? String(inductee.classYear) : '';
  const heritageTags = inductee.countryTags.map(normalizeSearchTerm);
  const communityTags = inductee.communityTags.map(normalizeSearchTerm);
  const themeTags = inductee.themeTags.map(normalizeSearchTerm);
  const haystack = [
    name,
    sortName,
    classYear,
    normalizeSearchTerm(inductee.region),
    normalizeSearchTerm(inductee.inductedBy),
    normalizeSearchTerm(inductee.searchText),
    ...heritageTags,
    ...communityTags,
    ...themeTags,
  ].join(' ');

  if (!terms.every((term) => haystack.includes(term))) return 0;

  return terms.reduce((score, term) => {
    if (name.startsWith(term) || sortName.startsWith(term)) return score + 90;
    if (name.includes(term) || sortName.includes(term)) return score + 62;
    if (heritageTags.some((tag) => tag.includes(term))) return score + 46;
    if (communityTags.some((tag) => tag.includes(term))) return score + 40;
    if (classYear.startsWith(term)) return score + 32;
    if (themeTags.some((tag) => tag.includes(term))) return score + 16;
    return score + 8;
  }, inductee.featured ? 8 : 0);
}

function commandResultMeta(inductee: Inductee) {
  const classLabel = inductee.classYear ? `Class ${inductee.classYear}` : 'Class year pending';
  const tags = [...inductee.countryTags, ...inductee.communityTags].slice(0, 2);
  return [classLabel, ...tags].join(' / ');
}

function compareCommandResults(a: CommandSearchResult, b: CommandSearchResult) {
  return b.score - a.score || a.title.localeCompare(b.title);
}

function addCommandPeopleFacet(facets: Map<string, Inductee[]>, label: string, people: Inductee[]) {
  if (!isCommandFacetLabel(label)) return;
  const key = normalizeSearchTerm(label);
  const current = facets.get(key) ?? [];
  people.forEach((person) => {
    if (!current.some((item) => item.id === person.id)) current.push(person);
  });
  facets.set(key, current);
}

function addCommandCommunity(
  communities: Map<string, { label: string; people: Inductee[]; traceFocusKey?: string }>,
  label: string,
  people: Inductee[],
  traceFocusKey?: string,
) {
  if (!isCommandFacetLabel(label)) return;
  const key = normalizeSearchTerm(label);
  const current = communities.get(key) ?? { label: label.trim(), people: [], traceFocusKey };
  people.forEach((person) => {
    if (!current.people.some((item) => item.id === person.id)) current.people.push(person);
  });
  if (traceFocusKey && !current.traceFocusKey) current.traceFocusKey = traceFocusKey;
  communities.set(key, current);
}

function commandLabelScore(label: string, terms: string[], bonus = 0) {
  const normalized = normalizeSearchTerm(label);
  if (!normalized || !terms.every((term) => normalized.includes(term))) return 0;
  const words = normalized.split(/\s+/).filter(Boolean);

  return terms.reduce((score, term) => {
    if (normalized === term) return score + 120;
    if (words.some((word) => word === term)) return score + 92;
    if (normalized.startsWith(term)) return score + 72;
    if (words.some((word) => word.startsWith(term))) return score + 56;
    return score + 26;
  }, bonus);
}

function sortCommandPeople(people: Inductee[]) {
  return [...people].sort((a, b) => {
    const priorityA = (a.featured ? 8 : 0) + (a.featuredCandidate ? 5 : 0) + Math.min(a.attractPriority, 8);
    const priorityB = (b.featured ? 8 : 0) + (b.featuredCandidate ? 5 : 0) + Math.min(b.attractPriority, 8);
    return priorityB - priorityA || (b.classYear ?? 0) - (a.classYear ?? 0) || a.sortName.localeCompare(b.sortName);
  });
}

function isCommandFacetLabel(value: string) {
  const label = value.trim();
  if (!label) return false;
  return !/^(n\/?a|none|unknown|not applicable)$/i.test(label);
}

function tokenizeSearchQuery(value: string) {
  return normalizeSearchTerm(value).split(/\s+/).filter(Boolean);
}

function normalizeSearchTerm(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slugCommandValue(value: string) {
  return normalizeSearchTerm(value).replace(/\s+/g, '-');
}
