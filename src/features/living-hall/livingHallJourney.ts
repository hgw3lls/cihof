import type { Inductee } from '../../data/types';

export type VisitJourneyConfidence = 'documented' | 'curated' | 'inferred' | 'visitor';

export type VisitJourneyConnection = {
  label: string;
  detail: string;
  confidence: VisitJourneyConfidence;
  sourceLabel: string;
  strength: number;
};

export type VisitJourneySuggestion = {
  index: number;
  person: Inductee;
  connection: VisitJourneyConnection;
};

export type VisitJourneyInsight = {
  activeIndex: number;
  title: string;
  countLabel: string;
  connectiveLabel: string;
  summary: string;
  activeSuggestion: VisitJourneySuggestion | null;
};

type RouteCandidate = {
  label: string;
  title: string;
  type: 'class' | 'heritage' | 'community' | 'theme' | 'region' | 'custom';
  count: number;
  strength: number;
};

const fallbackConnection: VisitJourneyConnection = {
  label: 'Saved visit path',
  detail: 'These profiles are connected by the visitor path you are building.',
  confidence: 'visitor',
  sourceLabel: 'Saved visit sequence',
  strength: 1,
};

export function buildVisitJourneyInsight(people: Inductee[], activeIndex: number): VisitJourneyInsight {
  const safeActiveIndex = clamp(Math.round(activeIndex), 0, Math.max(people.length - 1, 0));
  const route = selectRouteCandidate(people);
  const countLabel = `${people.length} saved ${people.length === 1 ? 'record' : 'records'}`;
  const activeSuggestion = buildActiveSuggestion(people, safeActiveIndex);

  return {
    activeIndex: safeActiveIndex,
    title: route.title,
    countLabel,
    connectiveLabel: route.label,
    summary: routeSummary(route, people),
    activeSuggestion,
  };
}

export function strongestJourneyConnection(source: Inductee, target: Inductee): VisitJourneyConnection {
  return rankedConnections(source, target)[0] ?? fallbackConnection;
}

function buildActiveSuggestion(people: Inductee[], activeIndex: number): VisitJourneySuggestion | null {
  if (people.length <= 1) return null;
  const source = people[activeIndex];
  if (!source) return null;
  const sequentialNextIndex = (activeIndex + 1) % people.length;

  return people.reduce<VisitJourneySuggestion | null>((best, person, index) => {
    if (index === activeIndex) return best;
    const connection = strongestJourneyConnection(source, person);
    const candidate = { index, person, connection };
    if (!best) return candidate;
    if (candidate.connection.strength > best.connection.strength) return candidate;
    if (candidate.connection.strength < best.connection.strength) return best;
    if (candidate.index === sequentialNextIndex) return candidate;
    return best;
  }, null);
}

function selectRouteCandidate(people: Inductee[]): RouteCandidate {
  if (people.length === 0) {
    return { label: 'Visit path', title: 'Visit Path', type: 'custom', count: 0, strength: 0 };
  }
  if (people.length === 1) {
    return { label: 'Saved profile', title: 'Saved Profile Path', type: 'custom', count: 1, strength: 1 };
  }

  const candidates = [
    ...classCandidates(people),
    ...tagCandidates(people, 'heritage', 7, (label) => `${label} Heritage Path`),
    ...tagCandidates(people, 'community', 6, (label) => `${label} Community Path`),
    ...tagCandidates(people, 'theme', 5, (label) => `${label} Impact Path`),
    ...regionCandidates(people),
  ].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (b.strength !== a.strength) return b.strength - a.strength;
    return a.label.localeCompare(b.label);
  });

  return candidates[0] ?? {
    label: 'Custom route',
    title: 'Custom Visit Path',
    type: 'custom',
    count: people.length,
    strength: 1,
  };
}

function rankedConnections(source: Inductee, target: Inductee): VisitJourneyConnection[] {
  const connections: VisitJourneyConnection[] = [];

  if (source.relatedIds.includes(target.id) || target.relatedIds.includes(source.id)) {
    connections.push({
      label: 'Direct profile link',
      detail: `${source.name} and ${target.name} are explicitly linked in the Hall data.`,
      confidence: 'curated',
      sourceLabel: 'Related profile ids',
      strength: 9,
    });
  }

  if (source.classYear && source.classYear === target.classYear) {
    connections.push({
      label: `Class of ${source.classYear}`,
      detail: `${source.name} and ${target.name} were inducted in the same Hall of Fame class.`,
      confidence: 'documented',
      sourceLabel: 'Induction class metadata',
      strength: 8,
    });
  }

  sharedTags(source.countryTags, target.countryTags).forEach((label) => {
    connections.push({
      label,
      detail: `${source.name} and ${target.name} share the ${label} nationality path.`,
      confidence: sharedSourceConfidence(source.countryTagsSource, target.countryTagsSource),
      sourceLabel: 'Nationality metadata',
      strength: 7,
    });
  });

  sharedTags(source.communityTags, target.communityTags).forEach((label) => {
    connections.push({
      label,
      detail: `${source.name} and ${target.name} connect through ${label} community work.`,
      confidence: 'curated',
      sourceLabel: 'Community taxonomy',
      strength: 6,
    });
  });

  sharedTags(source.themeTags, target.themeTags).forEach((label) => {
    connections.push({
      label,
      detail: `${source.name} and ${target.name} share the ${label} theme in their Hall stories.`,
      confidence: sharedSourceConfidence(source.themeTagsSource, target.themeTagsSource),
      sourceLabel: 'Theme metadata',
      strength: 5,
    });
  });

  if (validLabel(source.region) && source.region === target.region) {
    connections.push({
      label: source.region,
      detail: `${source.name} and ${target.name} are grouped in the same collection region.`,
      confidence: 'inferred',
      sourceLabel: 'Regional grouping',
      strength: 2,
    });
  }

  return connections.sort((a, b) => b.strength - a.strength || a.label.localeCompare(b.label));
}

function classCandidates(people: Inductee[]): RouteCandidate[] {
  const counts = new Map<string, number>();
  people.forEach((person) => {
    if (person.classYear) increment(counts, String(person.classYear));
  });
  return Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .map(([year, count]) => ({
      label: `Class of ${year}`,
      title: `Class of ${year} Legacy Path`,
      type: 'class' as const,
      count,
      strength: 8,
    }));
}

function tagCandidates(
  people: Inductee[],
  type: RouteCandidate['type'],
  strength: number,
  titleFor: (label: string) => string,
): RouteCandidate[] {
  const counts = new Map<string, { label: string; count: number }>();
  people.flatMap((person) => tagsForType(person, type)).forEach((label) => {
    const key = normalizeLabel(label);
    const current = counts.get(key);
    counts.set(key, { label: current?.label ?? label, count: (current?.count ?? 0) + 1 });
  });
  return Array.from(counts.values())
    .filter(({ count }) => count >= 2)
    .map(({ label, count }) => ({
      label,
      title: titleFor(label),
      type,
      count,
      strength,
    }));
}

function regionCandidates(people: Inductee[]): RouteCandidate[] {
  const counts = new Map<string, number>();
  people.forEach((person) => {
    if (validLabel(person.region)) increment(counts, person.region);
  });
  return Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .map(([region, count]) => ({
      label: region,
      title: `${region} Visit Path`,
      type: 'region' as const,
      count,
      strength: 2,
    }));
}

function routeSummary(route: RouteCandidate, people: Inductee[]) {
  if (people.length <= 1) return 'Save more profiles to reveal shared threads and suggested next stops.';
  if (route.type === 'custom') return `${people.length} saved profiles are ready for a custom guided path.`;
  return `${route.count} of ${people.length} saved profiles share ${route.label}.`;
}

function tagsForType(person: Inductee, type: RouteCandidate['type']) {
  if (type === 'heritage') return validTags(person.countryTags);
  if (type === 'community') return validTags(person.communityTags);
  if (type === 'theme') return validTags(person.themeTags);
  return [];
}

function sharedTags(source: string[], target: string[]) {
  const targetLabels = new Map(validTags(target).map((label) => [normalizeLabel(label), label]));
  return validTags(source).filter((label) => targetLabels.has(normalizeLabel(label)));
}

function validTags(tags: string[]) {
  const seen = new Set<string>();
  return tags.map((tag) => tag.trim()).filter((tag) => {
    const key = normalizeLabel(tag);
    if (!validLabel(tag) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validLabel(label: string) {
  const key = normalizeLabel(label);
  return Boolean(key) && key !== 'na' && key !== 'n/a' && key !== 'none' && key !== 'unknown';
}

function normalizeLabel(label: string) {
  return label.trim().toLowerCase();
}

function sharedSourceConfidence(source: string, target: string): VisitJourneyConfidence {
  const sourceConfidence = sourceConfidenceFor(source);
  const targetConfidence = sourceConfidenceFor(target);
  if (sourceConfidence === 'documented' && targetConfidence === 'documented') return 'documented';
  if (isExplicitConfidence(sourceConfidence) && isExplicitConfidence(targetConfidence)) return 'curated';
  return 'inferred';
}

function sourceConfidenceFor(source: string): VisitJourneyConfidence {
  const key = normalizeLabel(source);
  if (key === 'documented' || key === 'source') return 'documented';
  if (key === 'curated' || key === 'approved') return 'curated';
  return 'inferred';
}

function isExplicitConfidence(confidence: VisitJourneyConfidence) {
  return confidence === 'documented' || confidence === 'curated';
}

function increment(counts: Map<string, number>, key: string) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
