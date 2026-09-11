import type { HallLinkedPath, Inductee } from '../../data/types';
import { explicitTags, legacyGroupForYear, type LegacyChronology, type TraceContext } from './livingHallModes';

type ContextualNextStepInput = {
  allPeople: Inductee[];
  focusedPerson: Inductee | null;
  legacyChronology: LegacyChronology;
  traceContext: TraceContext;
};

export function buildContextualNextSteps({
  allPeople,
  focusedPerson,
  legacyChronology,
  traceContext,
}: ContextualNextStepInput): HallLinkedPath[] {
  if (!focusedPerson) return [];

  const paths: HallLinkedPath[] = [];
  const heritageLabels = new Set<string>();
  const heritagePath = traceContext.geography.countries.find((country) => {
    return country.people.some((person) => person.id === focusedPerson.id);
  });

  if (heritagePath) {
    heritageLabels.add(normalizePathLabel(heritagePath.label));
    paths.push({
      kind: 'heritage',
      label: heritagePath.label,
      detail: `${heritagePath.people.length} ${profileLabel(heritagePath.people.length)} share this nationality or heritage path`,
      personIds: heritagePath.people.map((person) => person.id),
      lens: 'traces',
      focusPersonId: focusedPerson.id,
      traceFocusKey: heritagePath.id,
    });
  }

  if (focusedPerson.classYear) {
    const group = legacyGroupForYear(legacyChronology, focusedPerson.classYear);
    if (group && group.people.length > 1) {
      paths.push({
        kind: 'class',
        label: `Class of ${focusedPerson.classYear}`,
        detail: `${group.people.length} ${profileLabel(group.people.length)} inducted together`,
        personIds: group.people.map((person) => person.id),
        lens: 'legacies',
        focusPersonId: focusedPerson.id,
        timelineYear: String(focusedPerson.classYear),
      });
    }
  }

  const community = focusedPerson.communityTags
    .find((tag) => isPathFacet(tag) && !heritageLabels.has(normalizePathLabel(tag)));
  if (community) {
    const people = matchingPeople(allPeople, (person) => person.communityTags.some((tag) => normalizePathLabel(tag) === normalizePathLabel(community)));
    if (people.length > 1) {
      paths.push({
        kind: 'community',
        label: community,
        detail: `${people.length} ${profileLabel(people.length)} connected by community work`,
        personIds: people.map((person) => person.id),
        lens: 'portraits',
        focusPersonId: focusedPerson.id,
      });
    }
  }

  const theme = explicitTags(focusedPerson.themeTags, focusedPerson.themeTagsSource).find(isPathFacet);
  if (theme) {
    const people = matchingPeople(allPeople, (person) => {
      return explicitTags(person.themeTags, person.themeTagsSource)
        .some((tag) => normalizePathLabel(tag) === normalizePathLabel(theme));
    });
    if (people.length > 1) {
      paths.push({
        kind: 'theme',
        label: theme,
        detail: `${people.length} ${profileLabel(people.length)} share this theme`,
        personIds: people.map((person) => person.id),
        lens: 'portraits',
        focusPersonId: focusedPerson.id,
      });
    }
  }

  return uniquePaths(paths).slice(0, 3);
}

function matchingPeople(allPeople: Inductee[], predicate: (person: Inductee) => boolean) {
  return allPeople
    .filter(predicate)
    .sort((a, b) => {
      return (b.classYear ?? 0) - (a.classYear ?? 0) || a.sortName.localeCompare(b.sortName) || a.name.localeCompare(b.name);
    });
}

function uniquePaths(paths: HallLinkedPath[]) {
  const seen = new Set<string>();
  return paths.filter((path) => {
    const key = `${path.kind}:${normalizePathLabel(path.label)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isPathFacet(value: string) {
  const label = value.trim();
  if (!label) return false;
  return !/^(n\/?a|none|unknown|not applicable)$/i.test(label);
}

function normalizePathLabel(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function profileLabel(count: number) {
  return count === 1 ? 'profile' : 'profiles';
}
