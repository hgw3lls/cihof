import { rankStoryLensMatches, type StoryLensMatch } from './storyLenses';
import type { Inductee, RelationshipProvenance, RelationshipRecord, RelationshipType, StoryLensConfig } from './types';
import communityTaxonomy from './communityTaxonomy.json';

export type NetworkReason = {
  type: RelationshipType;
  label: string;
  detail: string;
  provenance: RelationshipProvenance;
  score: number;
};

export type NetworkThread = {
  person: Inductee;
  reasons: NetworkReason[];
  score: number;
};

export type ConceptThread = {
  lens: StoryLensConfig;
  activeMatch: StoryLensMatch;
  matches: StoryLensMatch[];
  people: StoryLensMatch[];
  score: number;
};

export type GeoReference = {
  person: Inductee;
  country: string;
  region: string;
  note: string;
  source: string;
};

export type CountryNode = {
  id: string;
  label: string;
  region: string;
  people: Inductee[];
  references: GeoReference[];
};

export type RegionNode = {
  id: string;
  label: string;
  people: Inductee[];
  countries: CountryNode[];
};

export type GeographyTraceModel = {
  references: GeoReference[];
  countries: CountryNode[];
  regions: RegionNode[];
  people: Inductee[];
};

export type PlaceTraceFocus =
  | { kind: 'all'; key: ''; label: string; people: Inductee[]; countries: CountryNode[] }
  | { kind: 'region'; key: string; label: string; people: Inductee[]; countries: CountryNode[] }
  | { kind: 'country'; key: string; label: string; people: Inductee[]; countries: CountryNode[]; country: CountryNode };

export const initialTraceThreadCount = 6;
export const maxTraceThreadCount = 8;
export const maxConceptThreadChoices = 4;
export const internationalCountryExclusions = new Set(['United States']);
export const presentationReadySourceNotes = /Profile states|Profile identifies|Profile references|Profile centers|Profile describes|Profile names|Class-country attachment lists|born in|immigrated|emigrated|came to|arrived|Honorary Consul|first person of/i;
export const withheldSourceNotes = /needs curator confirmation|requires curator confirmation|pending review|suggests|no specific international origin|no specific country|born in Cleveland|born in La Grange|raised in Columbus/i;

export function buildConceptThreads(active: Inductee, inductees: Inductee[], lenses: StoryLensConfig[]): ConceptThread[] {
  return lenses
    .filter((lens) => lens.enabled !== false)
    .map((lens) => {
      const matches = rankStoryLensMatches(inductees, lens);
      const activeMatch = matches.find((match) => match.inductee.id === active.id);
      if (!activeMatch) return null;
      const people = matches.filter((match) => match.inductee.id !== active.id);
      if (people.length === 0) return null;

      return {
        lens,
        activeMatch,
        matches,
        people,
        score: activeMatch.score + Math.min(people.length, 24),
      };
    })
    .filter((thread): thread is ConceptThread => Boolean(thread))
    .sort((a, b) => b.score - a.score || a.lens.label.localeCompare(b.lens.label));
}

export function selectConceptThreadChoices(threads: ConceptThread[], activeThreadId: string) {
  const selected = activeThreadId ? threads.find((thread) => thread.lens.id === activeThreadId) : undefined;
  if (!selected) return threads.slice(0, maxConceptThreadChoices);
  return [
    selected,
    ...threads.filter((thread) => thread.lens.id !== selected.lens.id).slice(0, maxConceptThreadChoices - 1),
  ];
}

export function buildConceptNetwork(active: Inductee, thread: ConceptThread, directThreads: NetworkThread[]): NetworkThread[] {
  const directById = new Map(directThreads.map((item) => [item.person.id, item]));

  return thread.matches
    .filter((match) => match.inductee.id !== active.id)
    .map((match) => {
      const directThread = directById.get(match.inductee.id);
      const storyReason: NetworkReason = {
        type: 'shared_theme',
        label: `${thread.lens.label} / ${conceptSupportLabel(match)}`,
        detail: thread.lens.description,
        provenance: directThread?.reasons[0]?.provenance ?? 'curated',
        score: 92 + Math.min(match.score, 140) + (directThread ? 44 : 0),
      };

      return {
        person: match.inductee,
        reasons: [storyReason, ...(directThread?.reasons ?? []).slice(0, 2)],
        score: storyReason.score + featuredScore(match.inductee),
      };
    })
    .sort((a, b) => {
      const directA = directById.has(a.person.id) ? 1 : 0;
      const directB = directById.has(b.person.id) ? 1 : 0;
      return directB - directA || b.score - a.score || a.person.name.localeCompare(b.person.name);
    });
}

export function buildPlaceNetwork(active: Inductee, focus: PlaceTraceFocus, directThreads: NetworkThread[]): NetworkThread[] {
  const directById = new Map(directThreads.map((item) => [item.person.id, item]));

  return focus.people
    .filter((person) => person.id !== active.id)
    .map((person) => {
      const directThread = directById.get(person.id);
      const label = focus.kind === 'all' ? personPlaceLabel(person, focus) : focus.label;
      const provenance = placeTraceProvenance(active, person);
      const placeReason: NetworkReason = {
        type: 'related_place',
        label: `Connected to: ${label}`,
        detail: placeTraceDetail(focus, provenance),
        provenance,
        score: (provenance === 'curated' ? 76 : 62) + (directThread ? 40 : 0),
      };

      return {
        person,
        reasons: [placeReason, ...(directThread?.reasons ?? []).slice(0, 2)],
        score: placeReason.score + featuredScore(person),
      };
    })
    .sort((a, b) => {
      const directA = directById.has(a.person.id) ? 1 : 0;
      const directB = directById.has(b.person.id) ? 1 : 0;
      return directB - directA || b.score - a.score || a.person.name.localeCompare(b.person.name);
    });
}

export function conceptSupportLabel(match: StoryLensMatch) {
  const reason = match.reasons.find((item) => item !== 'Curator pinned') ?? match.reasons[0];
  if (!reason) return 'CIHOF record';
  return reason.replace(/^(Story|Trace) match:\s*/i, '').trim() || 'CIHOF record';
}

export function buildHumanNetwork(active: Inductee, inductees: Inductee[], relationships: RelationshipRecord[]) {
  const peopleById = new Map(inductees.map((item) => [item.id, item]));
  const peopleByName = new Map(inductees.map((item) => [normalizeName(item.name), item]));
  const threads = new Map<string, NetworkThread>();

  function addReason(person: Inductee | undefined, reason: NetworkReason) {
    if (!person || person.id === active.id || reason.provenance === 'inferred') return;
    const current = threads.get(person.id) ?? { person, reasons: [], score: 0 };
    if (!current.reasons.some((item) => item.type === reason.type && item.label === reason.label)) {
      current.reasons.push(reason);
      current.score += reason.score;
    }
    threads.set(person.id, current);
  }

  relationships
    .filter((relationship) => relationship.provenance !== 'inferred')
    .forEach((relationship) => {
      const sourcePerson = peopleById.get(relationship.sourcePersonId);
      const targetPerson = peopleById.get(relationship.targetEntityId);
      if (!sourcePerson) return;

      if (sourcePerson.id === active.id && targetPerson) {
        addReason(targetPerson, relationshipReason(relationship, 120));
      } else if (targetPerson?.id === active.id) {
        addReason(sourcePerson, relationshipReason(relationship, 120));
      }
    });

  relationships
    .filter((relationship) => relationship.provenance !== 'inferred' && !peopleById.has(relationship.targetEntityId))
    .filter((relationship) => relationship.sourcePersonId === active.id)
    .forEach((activeRelationship) => {
      relationships
        .filter((relationship) => relationship.provenance !== 'inferred')
        .filter((relationship) => relationship.targetEntityId === activeRelationship.targetEntityId && relationship.sourcePersonId !== active.id)
        .forEach((relationship) => {
          addReason(peopleById.get(relationship.sourcePersonId), {
            type: activeRelationship.type,
            label: activeRelationship.displayLabel,
            detail: activeRelationship.referenceNote || relationship.referenceNote || 'Shared documented relationship.',
            provenance: strongestProvenance(activeRelationship.provenance, relationship.provenance),
            score: 86,
          });
        });
    });

  const activeInducer = normalizedInductedBy(active);
  const activeInducerPerson = activeInducer ? peopleByName.get(activeInducer) : undefined;
  addReason(activeInducerPerson, {
    type: 'inducted_by',
    label: `Inducted by ${activeInducerPerson?.name ?? active.inductedBy}`,
    detail: 'Induction relationship in the CIHOF record.',
    provenance: 'curated',
    score: 112,
  });

  inductees.forEach((candidate) => {
    if (candidate.id === active.id) return;

    if (normalizedInductedBy(candidate) === normalizeName(active.name)) {
      addReason(candidate, {
        type: 'inducted_by',
        label: `${active.name} inducted ${candidate.name}`,
        detail: 'Induction relationship in the CIHOF record.',
        provenance: 'curated',
        score: 112,
      });
    }

    if (active.classYear && candidate.classYear === active.classYear) {
      addReason(candidate, {
        type: 'same_class',
        label: `Class of ${active.classYear}`,
        detail: 'Inducted in the same CIHOF class.',
        provenance: 'curated',
        score: 56,
      });
    }

    if (active.inductedBy && candidate.inductedBy && normalizedInductedBy(candidate) === activeInducer && candidate.inductedBy !== candidate.name) {
      addReason(candidate, {
        type: 'inducted_by',
        label: `Inducted by ${active.inductedBy}`,
        detail: 'Both records name the same inducer.',
        provenance: 'curated',
        score: 48,
      });
    }

    sharedExplicitValues(active.themeTags, active.themeTagsSource, candidate.themeTags, candidate.themeTagsSource).forEach((theme) => {
      addReason(candidate, {
        type: 'shared_theme',
        label: `Connected through: ${theme}`,
        detail: 'Both records include a reviewed contribution field.',
        provenance: 'curated',
        score: 44,
      });
    });

    sharedExplicitValues(active.countryTags, active.countryTagsSource, candidate.countryTags, candidate.countryTagsSource).forEach((place) => {
      addReason(candidate, {
        type: 'related_place',
        label: `Connected to: ${place}`,
        detail: 'Both records include a reviewed nationality or heritage association.',
        provenance: 'curated',
        score: 34,
      });
    });
  });

  return Array.from(threads.values())
    .map((thread) => ({
      ...thread,
      reasons: thread.reasons.sort((a, b) => b.score - a.score || provenanceRank(a.provenance) - provenanceRank(b.provenance)).slice(0, 3),
      score: thread.score + featuredScore(thread.person),
    }))
    .filter((thread) => thread.reasons.length > 0)
    .sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name));
}

export function relationshipReason(relationship: RelationshipRecord, score: number): NetworkReason {
  return {
    type: relationship.type,
    label: relationship.displayLabel,
    detail: relationship.referenceNote || 'Documented CIHOF relationship.',
    provenance: relationship.provenance,
    score,
  };
}

export function mostConnectedPerson(inductees: Inductee[], relationships: RelationshipRecord[]) {
  return inductees
    .map((inductee) => ({ inductee, count: buildHumanNetwork(inductee, inductees, relationships).length }))
    .sort((a, b) => b.count - a.count || featuredScore(b.inductee) - featuredScore(a.inductee) || a.inductee.name.localeCompare(b.inductee.name))[0]?.inductee ?? null;
}

export function relationshipTypeLabel(type: RelationshipType) {
  const labels: Record<RelationshipType, string> = {
    inducted_by: 'Induction',
    same_class: 'Class',
    shared_theme: 'Field',
    shared_organization: 'Organization',
    shared_community: 'Community',
    civic_collaboration: 'Civic Work',
    mentor: 'Mentor',
    colleague: 'Colleague',
    family: 'Family',
    related_place: 'Nationality',
    related_event: 'Event',
  };
  return labels[type];
}

export function nodeReasonLabel(reason: NetworkReason, activeName: string) {
  if (reason.type === 'same_class') return reason.label || 'Same CIHOF class';
  if (reason.label.startsWith(`${activeName} inducted `)) return 'Inducted them';
  if (reason.type === 'inducted_by' && reason.label.startsWith('Inducted by ')) return reason.label;
  return reason.label;
}

export function relationshipSupportLabel(reason: NetworkReason, activeName: string) {
  const type = relationshipTypeLabel(reason.type);
  const support = nodeReasonLabel(reason, activeName);
  return support.toLowerCase().startsWith(type.toLowerCase()) ? support : `${type} / ${support}`;
}

export function relationshipLineLabel(reason: NetworkReason | undefined, activeName: string) {
  if (!reason) return 'Documented connection';
  const label = nodeReasonLabel(reason, activeName);
  if (reason.type === 'same_class') return 'SHARED A CLASS';
  if (reason.type === 'shared_theme') return traceConceptPhrase(label);
  if (reason.type === 'shared_community') return 'SHARED COMMUNITY';
  if (reason.type === 'shared_organization') return 'SHARED ORGANIZATION';
  if (reason.type === 'civic_collaboration') return 'WORKED WITH';
  if (reason.type === 'mentor') return 'MENTORSHIP';
  if (reason.type === 'colleague') return 'WORKED WITH';
  if (reason.type === 'family') return 'FAMILY RECORD';
  if (reason.type === 'inducted_by') return label.startsWith('Inducted by ') ? 'INDUCTED BY' : 'INDUCTION LINK';
  if (reason.type === 'related_place') return label.replace(/^Connected to:\s*/i, '').toUpperCase();
  return label.toUpperCase();
}

function traceConceptPhrase(label: string) {
  const normalized = label.replace(/^Connected through:\s*/i, '').trim().toLowerCase();
  if (/\beducat|school|teacher|professor|university|student\b/.test(normalized)) return 'EDUCATION';
  if (/\bculture|heritage|tradition|arts|artist|music|language\b/.test(normalized)) return 'CULTURAL PRESERVATION';
  if (/\bcivic|public|mayor|council|government|service\b/.test(normalized)) return 'CIVIC SERVICE';
  if (/\bcommunity|organizing|neighborhood|volunteer\b/.test(normalized)) return 'COMMUNITY ORGANIZING';
  if (/\badvocacy|justice|rights|law\b/.test(normalized)) return 'ADVOCACY';
  if (/\bhealth|medicine|doctor|hospital|care\b/.test(normalized)) return 'HEALTH';
  return normalized ? normalized.toUpperCase() : 'SHARED WORK';
}

export function buildGeographyTraceModel(inductees: Inductee[]): GeographyTraceModel {
  const references = inductees.flatMap((person) => geographyReferences(person));
  const peopleByCountry = new Map<string, GeoReference[]>();

  references.forEach((reference) => {
    const current = peopleByCountry.get(reference.country) ?? [];
    current.push(reference);
    peopleByCountry.set(reference.country, current);
  });

  const countries = Array.from(peopleByCountry.entries())
    .map(([country, countryReferences]) => ({
      id: `country:${slugify(country)}`,
      label: country,
      region: countryReferences[0]?.region ?? '',
      people: uniquePeople(countryReferences.map((reference) => reference.person)),
      references: countryReferences,
    }))
    .sort((a, b) => b.people.length - a.people.length || a.label.localeCompare(b.label));

  const countriesByRegion = new Map<string, CountryNode[]>();
  countries.forEach((country) => {
    const current = countriesByRegion.get(country.region) ?? [];
    current.push(country);
    countriesByRegion.set(country.region, current);
  });

  const regions = Array.from(countriesByRegion.entries())
    .map(([region, regionCountries]) => ({
      id: `region:${slugify(region)}`,
      label: region,
      countries: regionCountries,
      people: uniquePeople(regionCountries.flatMap((country) => country.people)),
    }))
    .sort((a, b) => b.people.length - a.people.length || a.label.localeCompare(b.label));

  return {
    references,
    countries,
    regions,
    people: uniquePeople(references.map((reference) => reference.person)),
  };
}

export function geographyReferences(person: Inductee): GeoReference[] {
  const countries = person.countryTags.filter((country) => !internationalCountryExclusions.has(country));
  if (countries.length === 0 || !isPresentationReadyGeography(person)) return [];

  return countries.map((country) => ({
    person,
    country,
    region: countryRegion(country, person.region),
    note: person.countryTagsNote,
    source: person.countryTagsSource,
  }));
}

export function isPresentationReadyGeography(person: Inductee) {
  if (!person.countryTagsNote || withheldSourceNotes.test(person.countryTagsNote)) return false;
  if (person.countryTagsSource === 'curated' || person.countryTagsSource === 'documented') return true;
  return presentationReadySourceNotes.test(person.countryTagsNote);
}

export function resolvePlaceTraceFocus(model: GeographyTraceModel, focusKey: string): PlaceTraceFocus {
  const country = model.countries.find((item) => item.id === focusKey);
  if (country) {
    return {
      kind: 'country',
      key: country.id,
      label: country.label,
      people: country.people,
      countries: [country],
      country,
    };
  }

  const region = model.regions.find((item) => item.id === focusKey);
  if (region) {
    return {
      kind: 'region',
      key: region.id,
      label: region.label,
      people: region.people,
      countries: region.countries,
    };
  }

  return {
    kind: 'all',
    key: '',
    label: 'Nationality / Heritage',
    people: model.people,
    countries: model.countries,
  };
}

export function personPlaceLabel(person: Inductee, focus: PlaceTraceFocus) {
  if (focus.kind === 'country') return focus.label;
  const countries = person.countryTags.filter((country) => !internationalCountryExclusions.has(country));
  if (focus.kind === 'region') {
    const matching = countries.filter((country) => countryRegion(country, person.region) === focus.label);
    return matching.slice(0, 2).join(' / ') || focus.label;
  }
  return countries.slice(0, 2).join(' / ') || person.region;
}

export function countryRegion(country: string, fallback: string) {
  const communities = communityTaxonomy.nationalityCommunityMap as Record<string, string>;
  if (communities[country]) return communities[country];
  return fallback || 'International';
}

function uniquePeople(people: Inductee[]) {
  const seen = new Set<string>();
  return people
    .filter((person) => {
      if (seen.has(person.id)) return false;
      seen.add(person.id);
      return true;
    })
    .sort((a, b) => featuredScore(b) - featuredScore(a) || (b.classYear ?? 0) - (a.classYear ?? 0) || a.name.localeCompare(b.name));
}

function normalizedInductedBy(inductee: Inductee) {
  return inductee.inductedBy ? normalizeName(inductee.inductedBy) : '';
}

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function sharedExplicitValues(activeValues: string[], activeSource: string, candidateValues: string[], candidateSource: string) {
  if (!isExplicitSource(activeSource) || !isExplicitSource(candidateSource)) return [];
  const candidateSet = new Set(candidateValues);
  return activeValues.filter((value) => candidateSet.has(value));
}

function isExplicitSource(source: string) {
  return source === 'curated' || source === 'documented';
}

function placeTraceProvenance(active: Inductee, candidate: Inductee): RelationshipProvenance {
  return isExplicitSource(active.countryTagsSource) && isExplicitSource(candidate.countryTagsSource) ? 'curated' : 'inferred';
}

function placeTraceDetail(focus: PlaceTraceFocus, provenance: RelationshipProvenance) {
  if (provenance !== 'curated') {
    return 'This trace uses supplied working nationality or heritage metadata pending curator review.';
  }
  return focus.kind === 'country'
    ? `Both records include presentation-ready CIHOF nationality or heritage labels for ${focus.label}.`
    : 'This portrait is part of a presentation-ready CIHOF nationality or heritage trace.';
}

function strongestProvenance(a: RelationshipProvenance, b: RelationshipProvenance): RelationshipProvenance {
  return provenanceRank(a) <= provenanceRank(b) ? a : b;
}

function provenanceRank(provenance: RelationshipProvenance) {
  if (provenance === 'documented') return 0;
  if (provenance === 'curated') return 1;
  return 2;
}

function featuredScore(inductee: Inductee) {
  return (inductee.featured ? 8 : 0) + (inductee.featuredCandidate ? 5 : 0) + Math.min(inductee.attractPriority, 8);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
