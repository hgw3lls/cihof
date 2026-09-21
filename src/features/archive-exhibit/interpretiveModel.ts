import type { ArchiveLead, Inductee, StorySectionRecord } from '../../data/types';

export type PeopleFilters = {
  contribution: string;
  year: string;
  community: string;
};

export type ClevelandContextItem = {
  id: string;
  headline: string;
  body: string;
  place: string;
  organization: string;
  sourceLabel: string;
  sourceUrl: string;
};

const explicitSources = new Set(['curated', 'documented']);

export function publishedContribution(person: Inductee) {
  return person.honoredForSummary || (explicitSources.has(person.storySummarySource) ? person.storySummary : '')
    || 'An approved contribution summary is not available for this record.';
}

export function sourceLink(value?: string) {
  try {
    const url = new URL(value ?? '');
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

export function archiveClearedForTarget(record: ArchiveLead, target: string) {
  return record.status === 'visitor-ready' && record.visibility === 'visitor-ready'
    && Boolean(record.rightsNote?.trim()) && Boolean(sourceLink(record.sourceUrl))
    && (target === 'public' ? record.approvedForPublicWeb === true : record.approvedForKiosk === true);
}

export function sourceBiographyText(person: Inductee) {
  return person.bioText;
}

export function sourceBiographyParagraphs(text: string) {
  if (!text) return [];
  return [text];
}

export function contributionOptions(people: Inductee[]) {
  return sortedUnique(people.flatMap((person) => explicitSources.has(person.themeTagsSource) ? person.themeTags : []));
}

export function communityOptions(people: Inductee[]) {
  return sortedUnique(people.flatMap((person) => explicitSources.has(person.communityTagsSource) ? person.communityTags : []));
}

export function yearOptions(people: Inductee[]) {
  return [...new Set(people.flatMap((person) => person.classYear === null ? [] : [person.classYear]))].sort((a, b) => b - a);
}

export function personMatchesDiscovery(person: Inductee, query: string, filters: PeopleFilters) {
  if (filters.contribution && !explicitSources.has(person.themeTagsSource)) return false;
  if (filters.contribution && !person.themeTags.includes(filters.contribution)) return false;
  if (filters.community && !explicitSources.has(person.communityTagsSource)) return false;
  if (filters.community && !person.communityTags.includes(filters.community)) return false;
  if (filters.year && String(person.classYear ?? 'unknown') !== filters.year) return false;

  const foldedQuery = foldSearchText(query);
  if (!foldedQuery) return true;
  const labels = [
    person.name,
    person.sortName,
    person.pronunciation,
    person.classYear,
    ...(explicitSources.has(person.themeTagsSource) ? person.themeTags : []),
    ...(explicitSources.has(person.communityTagsSource) ? person.communityTags : []),
    ...(explicitSources.has(person.countryTagsSource) ? person.countryTags : []),
  ];
  return foldSearchText(labels.filter(Boolean).join(' ')).includes(foldedQuery);
}

export function foldSearchText(value: unknown) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đð]/gi, 'd')
    .replace(/ł/gi, 'l')
    .replace(/ø/gi, 'o')
    .replace(/æ/gi, 'ae')
    .replace(/œ/gi, 'oe')
    .replace(/ß/g, 'ss')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();
}

export function portraitObjectPosition(value: string) {
  const focalPoint = value.trim().toLowerCase();
  if (/^(?:\d{1,3}(?:\.\d+)?%|left|center|right)\s+(?:\d{1,3}(?:\.\d+)?%|top|center|bottom)$/.test(focalPoint)) {
    return focalPoint.split(/\s+/).every((part) => !part.endsWith('%') || Number.parseFloat(part) <= 100)
      ? focalPoint : '50% 50%';
  }
  if (focalPoint === 'top') return '50% 0%';
  if (focalPoint === 'bottom') return '50% 100%';
  if (focalPoint === 'left') return '0% 50%';
  if (focalPoint === 'right') return '100% 50%';
  return '50% 50%';
}

export function approvedClevelandContext(person: Inductee, record?: StorySectionRecord): ClevelandContextItem[] {
  if (!record || record.inducteeId !== person.id || !explicitSources.has(record.provenance)) return [];
  return record.beats
    .filter((beat) => beat.provenance !== 'inferred' && beat.contextScope === 'cleveland'
      && beat.reviewStatus === 'approved' && Boolean(beat.sourceReference?.trim()))
    .map((beat) => ({
      id: beat.id,
      headline: beat.headline,
      body: beat.body,
      place: beat.place?.trim() ?? '',
      organization: beat.organization?.trim() ?? '',
      sourceLabel: beat.sourceReference!,
      sourceUrl: beat.sourceUrl ?? '',
    }));
}

function sortedUnique(values: string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort((a, b) => a.localeCompare(b));
}
