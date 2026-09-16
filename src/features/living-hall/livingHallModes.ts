import type { ClevelandTraceLine } from '../../components/ClevelandTrace';
import {
  buildConceptNetwork,
  buildConceptThreads,
  buildGeographyTraceModel,
  buildHumanNetwork,
  buildPlaceNetwork,
  initialTraceThreadCount,
  isPresentationReadyGeography,
  relationshipLineLabel,
  relationshipSupportLabel,
  resolvePlaceTraceFocus,
  selectConceptThreadChoices,
  type ConceptThread,
  type GeographyTraceModel,
  type NetworkThread,
  type PlaceTraceFocus,
} from '../../data/traceModel';
import type { HallLens, HallLinkedPath, Inductee, RelationshipRecord, StoryLensConfig } from '../../data/types';
import {
  clamp,
  fallbackPosition,
  groupAnchors,
  hashNumber,
  legacyLabelPriority,
  portraitSize,
  staggerDelay,
  wobble,
  type HallLabel,
  type HallLayoutMetrics,
  type PortraitPosition,
} from './livingHallLayout';

export type HallMode = {
  id: string;
  title: string;
  subtitle: string;
  positions: Map<string, PortraitPosition>;
  labels: HallLabel[];
  lines?: HallLine[];
};

export type HallLine = ClevelandTraceLine & {
  label: string;
  provenance: NonNullable<ClevelandTraceLine['provenance']>;
};

export type TraceContext = {
  activePerson: Inductee | null;
  mode: 'direct' | 'concept' | 'place';
  traceFocusKey: string;
  visibleThreads: NetworkThread[];
  directThreads: NetworkThread[];
  conceptThreads: ConceptThread[];
  conceptChoices: ConceptThread[];
  activeConcept: ConceptThread | null;
  geography: GeographyTraceModel;
  placeFocus: PlaceTraceFocus;
  placeChoices: TraceChoice[];
};

export type TraceChoice = {
  key: string;
  label: string;
  detail: string;
  kind: 'direct' | 'concept' | 'place';
};

export type LegacyYearGroup = {
  key: string;
  year: number | null;
  label: string;
  people: Inductee[];
  x: number;
  spacing: number;
};

export type LegacyChronology = {
  groups: LegacyYearGroup[];
  years: number[];
  firstYear: number | null;
  lastYear: number | null;
  fieldScale: number;
};

export type LatestClass = {
  year: number;
  inductees: Inductee[];
  stats: {
    people: number;
    stories: number;
    cities: number;
  };
};

const explicitSources = new Set(['curated', 'documented']);

const emptyMode: HallMode = {
  id: 'empty',
  title: 'PORTRAITS',
  subtitle: 'No portraits loaded',
  positions: new Map(),
  labels: [],
};

export function hallDisplayTitle(lens: HallLens) {
  if (lens === 'traces' || lens === 'journeys') return 'CONNECTION FIELD';
  if (lens === 'legacies') return 'YEAR FIELD';
  return 'LIVING HALL';
}

export function selectHallMode({
  focusedPersonId,
  lens,
  layout,
  modes,
  people,
  relationships,
  step,
  traceTrailIds,
  traceContext,
  legacyChronology,
  activeLegacyYear,
  journeyPaths = [],
  linkedPath = null,
}: {
  focusedPersonId: string;
  lens: HallLens;
  layout: HallLayoutMetrics;
  modes: HallMode[];
  people: Inductee[];
  relationships: RelationshipRecord[];
  step: number;
  traceTrailIds: string[];
  traceContext: TraceContext;
  legacyChronology: LegacyChronology;
  activeLegacyYear: number | null;
  journeyPaths?: HallLinkedPath[];
  linkedPath?: HallLinkedPath | null;
}) {
  const fallback = modes[step % Math.max(modes.length, 1)] ?? emptyMode;
  const baseMode = lens === 'legacies'
    ? buildLegacyHallMode(people, legacyChronology, activeLegacyYear, focusedPersonId, layout)
    : lens === 'journeys'
      ? buildJourneyHallMode(people, portraitModeFromModes(modes, 0) ?? fallback, journeyPaths, linkedPath, focusedPersonId, layout)
    : lens === 'traces'
      ? buildTraceHallMode(people, portraitModeFromModes(modes, 0) ?? fallback, traceContext, traceTrailIds, layout)
      : portraitModeFromModes(modes, step) ?? fallback;

  return lens === 'traces' || lens === 'legacies' || lens === 'journeys' ? baseMode : applyHallFocus(baseMode, people, relationships, focusedPersonId, layout);
}

export function buildTraceContext({
  focusedPersonId,
  inductees,
  relationships,
  storyLenses,
  traceFocusKey,
}: {
  focusedPersonId: string;
  inductees: Inductee[];
  relationships: RelationshipRecord[];
  storyLenses: StoryLensConfig[];
  traceFocusKey: string;
}): TraceContext {
  const activePerson = focusedPersonId ? inductees.find((person) => person.id === focusedPersonId) ?? null : null;
  const geography = buildGeographyTraceModel(inductees);
  const directThreads = activePerson ? buildHumanNetwork(activePerson, inductees, relationships) : [];
  const conceptThreads = activePerson ? buildConceptThreads(activePerson, inductees, storyLenses) : [];
  const requestedConceptId = traceFocusKey.startsWith('concept:') ? traceFocusKey.slice('concept:'.length) : '';
  const activeConcept = requestedConceptId
    ? conceptThreads.find((thread) => thread.lens.id === requestedConceptId) ?? null
    : null;
  const placeRequested = traceFocusKey.startsWith('country:') || traceFocusKey.startsWith('region:');
  const placeFocus = resolvePlaceTraceFocus(geography, placeRequested ? traceFocusKey : '');
  const mode: TraceContext['mode'] = activeConcept ? 'concept' : placeRequested && placeFocus.key ? 'place' : 'direct';
  const activeTraceFocusKey = mode === 'concept'
    ? `concept:${activeConcept?.lens.id ?? ''}`
    : mode === 'place'
      ? placeFocus.key
      : '';
  const visibleThreads = activePerson
    ? mode === 'concept' && activeConcept
      ? buildConceptNetwork(activePerson, activeConcept, directThreads).slice(0, initialTraceThreadCount)
      : mode === 'place'
        ? buildPlaceNetwork(activePerson, placeFocus, directThreads).slice(0, initialTraceThreadCount)
        : directThreads.slice(0, initialTraceThreadCount)
    : [];

  return {
    activePerson,
    mode,
    traceFocusKey: activeTraceFocusKey,
    visibleThreads,
    directThreads,
    conceptThreads,
    conceptChoices: selectConceptThreadChoices(conceptThreads, requestedConceptId),
    activeConcept,
    geography,
    placeFocus,
    placeChoices: buildPlaceTraceChoices(geography, activePerson),
  };
}

export function traceChooserOptions(context: TraceContext): TraceChoice[] {
  const choices: TraceChoice[] = [];
  if (context.directThreads.length > 0) {
    choices.push({ key: '', label: 'DIRECT TIES', detail: '', kind: 'direct' });
  }
  const conceptLimit = context.directThreads.length > 0 ? 2 : 3;
  const placeLimit = context.directThreads.length > 0 ? 1 : 2;

  context.conceptChoices.slice(0, conceptLimit).forEach((thread) => {
    choices.push({
      key: `concept:${thread.lens.id}`,
      label: thread.lens.label,
      detail: thread.lens.prompt,
      kind: 'concept',
    });
  });
  context.placeChoices.slice(0, placeLimit).forEach((choice) => {
    choices.push(choice);
  });

  const activeIndex = choices.findIndex((choice) => choice.key === context.traceFocusKey);
  if (activeIndex > 0) {
    const [active] = choices.splice(activeIndex, 1);
    choices.unshift(active);
  }

  return choices.slice(0, 4);
}

export function buildHallModes(inductees: Inductee[], layout: HallLayoutMetrics) {
  if (inductees.length === 0) return [emptyMode];

  const modes: HallMode[] = [
    buildPortraitWallMode(inductees, 'chronicle', layout),
    buildPortraitWallMode(inductees, 'wall-memory', layout),
    buildTimelineMode(inductees, layout),
  ];

  const contributionMode = buildExplicitTagMode({
    id: 'contribution',
    title: 'AREAS OF CONTRIBUTION',
    subtitle: 'Grouped by curated contribution metadata',
    inductees,
    layout,
    tagSource: (inductee) => explicitTags(inductee.themeTags, inductee.themeTagsSource),
  });
  if (contributionMode) modes.push(contributionMode);

  const communityMode = buildExplicitTagMode({
    id: 'community',
    title: 'COMMUNITY TIES',
    subtitle: 'Grouped by documented community affiliations',
    inductees,
    layout,
    tagSource: (inductee) => inductee.communityTags,
  });
  if (communityMode) modes.push(communityMode);

  const geographyMode = buildExplicitTagMode({
    id: 'geography',
    title: 'NATIONALITY TRACES',
    subtitle: 'Grouped by nationality and heritage metadata',
    inductees,
    layout,
    tagSource: (inductee) => isPresentationReadyGeography(inductee) ? inductee.countryTags : [],
  });
  if (geographyMode) modes.push(geographyMode);

  return modes;
}

export function buildLegacyChronology(inductees: Inductee[], layout: HallLayoutMetrics): LegacyChronology {
  const classGroups = [...groupByYear(inductees).entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, people]) => ({
      key: String(year),
      year,
      label: String(year),
      people: [...people].sort((a, b) => a.sortName.localeCompare(b.sortName) || a.name.localeCompare(b.name)),
    }));
  const pendingPeople = inductees
    .filter((inductee) => typeof inductee.classYear !== 'number')
    .sort((a, b) => a.sortName.localeCompare(b.sortName) || a.name.localeCompare(b.name));
  const rawGroups = pendingPeople.length > 0
    ? [...classGroups, { key: 'pending', year: null, label: 'PENDING', people: pendingPeople }]
    : classGroups;
  const count = Math.max(rawGroups.length, 1);
  const spacing = count <= 1 ? 0 : 92 / (count - 1);
  const fieldScale = layout.legacy.fieldScale;
  const groups = rawGroups.map((group, index) => ({
    ...group,
    x: count <= 1 ? 50 : 4 + index * spacing,
    spacing: spacing || 18,
  }));
  const years = groups.map((group) => group.year).filter((year): year is number => year !== null);

  return {
    groups,
    years,
    firstYear: years[0] ?? null,
    lastYear: years[years.length - 1] ?? null,
    fieldScale,
  };
}

export function resolveLegacyActiveYear(chronology: LegacyChronology, timelineYear: string, focusedPerson: Inductee | null) {
  const requestedYear = parseHallYear(timelineYear);
  if (requestedYear !== null && chronology.years.includes(requestedYear)) return requestedYear;
  if (focusedPerson?.classYear && chronology.years.includes(focusedPerson.classYear)) return focusedPerson.classYear;
  return chronology.firstYear;
}

export function legacyGroupForYear(chronology: LegacyChronology, year: number | null) {
  if (year === null) return chronology.groups[0] ?? null;
  return chronology.groups.find((group) => group.year === year) ?? null;
}

export function buildLatestClass(inductees: Inductee[]): LatestClass | null {
  const groups = groupByYear(inductees);
  const latestYear = Math.max(...[...groups.keys()]);
  if (!Number.isFinite(latestYear)) return null;

  const latestInductees = [...(groups.get(latestYear) ?? [])].sort((a, b) => {
    return a.sortName.localeCompare(b.sortName) || a.name.localeCompare(b.name);
  });
  if (latestInductees.length === 0) return null;

  const storyCount = latestInductees.filter((inductee) => {
    return Boolean((inductee.storySummary || inductee.bioText).trim());
  }).length;

  return {
    year: latestYear,
    inductees: latestInductees,
    stats: {
      people: latestInductees.length,
      stories: storyCount || latestInductees.length,
      cities: latestInductees.length > 0 ? 1 : 0,
    },
  };
}

export function sortInductees(inductees: Inductee[]) {
  return [...inductees].sort((a, b) => {
    const yearA = a.classYear ?? Number.MAX_SAFE_INTEGER;
    const yearB = b.classYear ?? Number.MAX_SAFE_INTEGER;
    return yearA - yearB || a.sortName.localeCompare(b.sortName) || a.name.localeCompare(b.name);
  });
}

export function selectHallPeople(inductees: Inductee[], lens: HallLens, focusedPersonId: string, portraitLimit: number) {
  if (lens !== 'portraits') return inductees;
  const limit = Math.round(clamp(portraitLimit, 24, Math.max(24, inductees.length)));
  if (inductees.length <= limit) return inductees;

  const visible = inductees.slice(0, limit);
  if (!focusedPersonId || visible.some((person) => person.id === focusedPersonId)) return visible;

  const focusedPerson = inductees.find((person) => person.id === focusedPersonId);
  if (!focusedPerson) return visible;
  return [...visible.slice(0, Math.max(0, limit - 1)), focusedPerson];
}

export function buildHallYearRange(inductees: Inductee[]) {
  const years = [...groupByYear(inductees).keys()].sort((a, b) => a - b);
  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  if (!firstYear || !lastYear) return 'CIHOF';
  return firstYear === lastYear ? String(firstYear) : `${firstYear} - ${lastYear}`;
}

export function buildHallVocabulary(inductees: Inductee[]) {
  const counts = new Map<string, number>();
  for (const inductee of inductees) {
    const supportedTags = [
      ...explicitTags(inductee.themeTags, inductee.themeTagsSource),
      ...inductee.communityTags,
    ];

    for (const tag of supportedTags) {
      const label = tag.trim();
      if (!label) continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([label]) => label.toUpperCase());
}

export function explicitTags(tags: string[], source: string) {
  return explicitSources.has(source.toLowerCase()) ? tags : [];
}

function portraitModeFromModes(modes: HallMode[], step: number) {
  const portraitModes = modes.filter((mode) => mode.id.startsWith('portrait-wall'));
  return portraitModes[step % Math.max(portraitModes.length, 1)] ?? null;
}

function buildPlaceTraceChoices(geography: GeographyTraceModel, activePerson: Inductee | null): TraceChoice[] {
  const activePersonCountries = activePerson
    ? geography.countries.filter((country) => country.people.some((person) => person.id === activePerson.id))
    : [];
  const choices = [
    ...activePersonCountries,
    ...geography.countries,
  ];
  const seen = new Set<string>();

  return choices
    .filter((country) => {
      if (seen.has(country.id)) return false;
      seen.add(country.id);
      return true;
    })
    .slice(0, 4)
    .map((country) => ({
      key: country.id,
      label: country.label,
      detail: `${country.people.length}`,
      kind: 'place',
    }));
}

function buildJourneyHallMode(
  inductees: Inductee[],
  baseMode: HallMode,
  journeyPaths: HallLinkedPath[],
  linkedPath: HallLinkedPath | null,
  focusedPersonId: string,
  layout: HallLayoutMetrics,
): HallMode {
  const peopleById = new Map(inductees.map((person) => [person.id, person]));
  const activePath = linkedPath && linkedPath.lens === 'journeys'
    ? linkedPath
    : journeyPaths.find((path) => focusedPersonId && path.personIds.includes(focusedPersonId)) ?? null;

  if (activePath) {
    return buildActiveJourneyMode(inductees, baseMode, activePath, focusedPersonId, layout);
  }

  const positionedIds = new Set<string>();
  const positions = new Map<string, PortraitPosition>();
  const labels: HallLabel[] = [];
  const lines: HallLine[] = [];
  const visiblePaths = journeyPaths.slice(0, journeyClusterAnchors.length);

  visiblePaths.forEach((path, pathIndex) => {
    const anchor = journeyClusterAnchors[pathIndex];
    const pathPeople = path.personIds.map((id) => peopleById.get(id)).filter((person): person is Inductee => Boolean(person)).slice(0, 6);
    labels.push({
      id: `journey-${pathIndex}-${normalizeText(path.label)}`,
      text: journeyModeLabel(path.label),
      detail: `${pathPeople.length} STOPS`,
      x: anchor.labelX,
      y: anchor.labelY,
    });

    pathPeople.forEach((person, personIndex) => {
      positionedIds.add(person.id);
      const orbit = Math.sqrt((personIndex + 1) / Math.max(pathPeople.length, 1));
      const angle = ((personIndex * 128) + pathIndex * 42) * Math.PI / 180;
      const current = baseMode.positions.get(person.id) ?? fallbackPosition(personIndex, pathPeople.length);
      const size = personIndex === 0
        ? Math.max(layout.portrait.relatedMaxSize, current.size)
        : clamp(current.size + (personIndex < 3 ? 16 : 6), layout.portrait.relatedMinSize, layout.portrait.emphasisMaxSize);
      positions.set(person.id, {
        ...current,
        x: clamp(anchor.x + Math.cos(angle) * anchor.rx * orbit + wobble(person.id, 503, -0.75, 0.75), 7, 93),
        y: clamp(anchor.y + Math.sin(angle) * anchor.ry * orbit + wobble(person.name, 509, -0.65, 0.65), layout.portrait.yMin, layout.portrait.yMax),
        size,
        z: 1180 - pathIndex * 80 - personIndex,
        delay: staggerDelay(pathIndex * 3 + personIndex),
        emphasis: true,
        muted: false,
      });
    });

    pathPeople.forEach((person, personIndex) => {
      if (personIndex === 0) return;
      const previous = positions.get(pathPeople[personIndex - 1].id);
      const current = positions.get(person.id);
      if (!previous || !current) return;
      lines.push({
        id: `journey-cluster-${pathIndex}-${personIndex}`,
        label: personIndex === 1 ? journeyModeLabel(path.label) : '',
        detail: path.detail,
        provenance: 'curated',
        relationshipType: journeyRelationshipType(path),
        role: 'trail',
        x1: previous.x,
        y1: previous.y,
        x2: current.x,
        y2: current.y,
      });
    });
  });

  inductees
    .filter((person) => !positionedIds.has(person.id))
    .forEach((person, index, backgroundPeople) => {
      const current = baseMode.positions.get(person.id) ?? fallbackPosition(index, backgroundPeople.length || 1);
      positions.set(person.id, {
        ...current,
        size: Math.min(current.size, layout.trace.perimeterFarSize),
        z: 16 + (index % 6),
        delay: Math.min(current.delay, 120),
        emphasis: false,
        muted: true,
      });
    });

  return {
    ...baseMode,
    id: 'journeys-curated-paths',
    title: 'JOURNEYS',
    subtitle: `${visiblePaths.length} curated paths drawn from existing Hall metadata`,
    positions,
    labels,
    lines,
  };
}

function buildActiveJourneyMode(
  inductees: Inductee[],
  baseMode: HallMode,
  path: HallLinkedPath,
  focusedPersonId: string,
  layout: HallLayoutMetrics,
): HallMode {
  const pathIds = path.personIds.slice(0, journeySpineAnchors.length);
  const focusedPathIndex = pathIds.indexOf(focusedPersonId);
  const activeIndex = focusedPathIndex >= 0 ? focusedPathIndex : 0;
  const positions = new Map<string, PortraitPosition>();
  const lines: HallLine[] = [];
  const labels: HallLabel[] = [
    {
      id: `journey-active-${normalizeText(path.label)}`,
      text: journeyModeLabel(path.label),
      detail: `${pathIds.length} STOPS / CURATED PATH`,
      x: 50,
      y: 14,
    },
  ];

  inductees.forEach((person, index) => {
    const current = baseMode.positions.get(person.id) ?? fallbackPosition(index, inductees.length);
    const pathIndex = pathIds.indexOf(person.id);
    if (pathIndex >= 0) {
      const anchor = journeySpineAnchors[pathIndex];
      const isFocused = person.id === focusedPersonId || (!focusedPersonId && pathIndex === 0);
      const distance = Math.abs(pathIndex - activeIndex);
      positions.set(person.id, {
        ...current,
        x: clamp(anchor.x + wobble(person.id, 521, -0.65, 0.65), 6, 94),
        y: clamp(anchor.y + wobble(person.name, 523, -0.8, 0.8), layout.portrait.yMin, layout.portrait.yMax),
        size: isFocused
          ? layout.trace.anchorSize
          : distance <= 1
            ? layout.trace.relatedPrimarySize
            : layout.trace.relatedSecondarySize,
        z: isFocused ? 2600 : 1680 - pathIndex,
        delay: staggerDelay(pathIndex),
        emphasis: true,
        focused: isFocused,
        muted: false,
      });
      return;
    }

    const perimeter = tracePerimeterPosition(index, person, current, layout);
    positions.set(person.id, {
      ...current,
      x: perimeter.x,
      y: perimeter.y,
      size: Math.min(perimeter.size, layout.trace.perimeterFarSize),
      z: 18 + (index % 7),
      delay: Math.min(current.delay, 140),
      emphasis: false,
      muted: true,
    });
  });

  pathIds.forEach((personId, index) => {
    if (index === 0) return;
    const previous = positions.get(pathIds[index - 1]);
    const current = positions.get(personId);
    if (!previous || !current) return;
    lines.push({
      id: `journey-active-${path.kind}-${index}-${personId}`,
      label: index === 1 ? journeyModeLabel(path.label) : '',
      detail: path.detail,
      provenance: 'curated',
      relationshipType: journeyRelationshipType(path),
      role: 'trail',
      x1: previous.x,
      y1: previous.y,
      x2: current.x,
      y2: current.y,
    });
  });

  return {
    ...baseMode,
    id: `journeys-active-${path.kind}-${normalizeText(path.label)}`,
    title: 'JOURNEYS',
    subtitle: path.detail,
    positions,
    labels,
    lines,
  };
}

const journeyClusterAnchors = [
  { x: 22, y: 31, labelX: 17, labelY: 15, rx: 12, ry: 12 },
  { x: 58, y: 28, labelX: 60, labelY: 12, rx: 13, ry: 11 },
  { x: 78, y: 56, labelX: 82, labelY: 38, rx: 11, ry: 13 },
  { x: 36, y: 68, labelX: 29, labelY: 84, rx: 14, ry: 10 },
];

const journeySpineAnchors = [
  { x: 14, y: 36 },
  { x: 29, y: 56 },
  { x: 44, y: 36 },
  { x: 58, y: 59 },
  { x: 73, y: 38 },
  { x: 86, y: 57 },
];

function journeyRelationshipType(path: HallLinkedPath): HallLine['relationshipType'] {
  if (path.kind === 'class') return 'same_class';
  if (path.kind === 'heritage') return 'related_place';
  if (path.kind === 'community') return 'shared_community';
  if (path.kind === 'theme') return 'shared_theme';
  return undefined;
}

function journeyModeLabel(label: string) {
  return label
    .replace(/\s+(Heritage|Community|Impact|Legacy)\s+Path$/i, '')
    .replace(/\s+Path$/i, '')
    .toUpperCase();
}

function buildTraceHallMode(
  inductees: Inductee[],
  baseMode: HallMode,
  context: TraceContext,
  traceTrailIds: string[],
  layout: HallLayoutMetrics,
): HallMode {
  if (!context.activePerson) {
    return {
      ...baseMode,
      id: 'traces-awaiting-focus',
      title: 'TRACES',
      subtitle: 'Focus a portrait to reorganize the Hall by reviewed ties, concepts, and nationality or heritage',
      labels: [
        { id: 'traces-awaiting-focus', text: 'TRACES', detail: 'Touch a portrait', x: 50, y: 50 },
        ...baseMode.labels.slice(0, 2),
      ],
      lines: [],
    };
  }

  const activePerson = context.activePerson;
  const positions = new Map<string, PortraitPosition>();
  const lines: HallLine[] = [];
  const anchor = traceAnchorPoint;
  const visibleById = new Map(context.visibleThreads.map((thread, index) => [thread.person.id, { thread, index }]));
  const recentTrailIds = traceTrailIds.filter((personId) => personId !== activePerson.id).slice(-3);

  inductees.forEach((person, index) => {
    const current = baseMode.positions.get(person.id) ?? fallbackPosition(index, inductees.length);

    if (person.id === activePerson.id) {
      positions.set(person.id, {
        ...current,
        x: anchor.x,
        y: anchor.y,
        size: layout.trace.anchorSize,
        z: 2600,
        delay: 0,
        emphasis: true,
        focused: true,
        muted: false,
      });
      return;
    }

    const visible = visibleById.get(person.id);
    if (visible) {
      const orbit = traceOrbitAnchors[visible.index % traceOrbitAnchors.length];
      const reason = visible.thread.reasons[0];
      const relatedX = clamp(orbit.x + wobble(person.id, 131, -1.1, 1.1), 8, 92);
      const relatedY = clamp(orbit.y + wobble(person.name, 137, -1, 1), 13, 79);
      positions.set(person.id, {
        ...current,
        x: relatedX,
        y: relatedY,
        size: visible.index < 4 ? layout.trace.relatedPrimarySize : layout.trace.relatedSecondarySize,
        z: 1900 - visible.index,
        delay: staggerDelay(visible.index),
        emphasis: true,
        muted: false,
      });
      lines.push({
        id: `${activePerson.id}-${context.traceFocusKey || 'direct'}-${person.id}`,
        label: relationshipLineLabel(reason, activePerson.name),
        detail: reason ? relationshipSupportLabel(reason, activePerson.name) : undefined,
        provenance: reason?.provenance ?? 'curated',
        relationshipType: reason?.type,
        role: 'relationship',
        x1: anchor.x,
        y1: anchor.y,
        x2: relatedX,
        y2: relatedY,
      });
      return;
    }

    const trailIndex = recentTrailIds.indexOf(person.id);
    if (trailIndex >= 0) {
      const continuity = traceContinuityAnchors[trailIndex % traceContinuityAnchors.length];
      positions.set(person.id, {
        ...current,
        x: clamp(continuity.x + wobble(person.id, 157, -0.9, 0.9), 8, 92),
        y: clamp(continuity.y + wobble(person.name, 159, -0.75, 0.75), 13, layout.trace.yMax),
        size: context.mode === 'direct' ? layout.trace.relatedSecondarySize : layout.trace.trailSize,
        z: 1760 - trailIndex,
        delay: staggerDelay(trailIndex + 4),
        emphasis: true,
        muted: false,
      });
      return;
    }

    const perimeter = tracePerimeterPosition(index, person, current, layout);
    positions.set(person.id, {
      ...current,
      x: perimeter.x,
      y: perimeter.y,
      size: perimeter.size,
      z: 18 + (index % 8),
      delay: Math.min(current.delay, 140),
      emphasis: false,
      muted: true,
    });
  });

  return {
    ...baseMode,
    id: traceModeId(context),
    title: 'TRACES',
    subtitle: traceModeSubtitle(context),
    positions,
    labels: buildTraceLabels(context),
    lines: [
      ...buildTraceTrailLines(context, positions, traceTrailIds),
      ...lines,
    ],
  };
}

function buildTraceTrailLines(context: TraceContext, positions: Map<string, PortraitPosition>, traceTrailIds: string[]): HallLine[] {
  if (traceTrailIds.length < 2) return [];

  const trailLabel = context.mode === 'direct'
    ? 'YOU ARE HERE'
    : context.mode === 'concept'
      ? context.activeConcept?.lens.label.toUpperCase() ?? 'FOLLOW THE TRACE'
      : context.mode === 'place'
        ? context.placeFocus.label.toUpperCase()
        : '';
  const relationshipType = context.mode === 'concept'
    ? 'shared_theme'
    : context.mode === 'place'
      ? 'related_place'
      : undefined;
  const ids = traceTrailIds.slice(-5);
  const lines: HallLine[] = [];

  ids.forEach((personId, index) => {
    if (index === 0) return;
    const previousId = ids[index - 1];
    const previous = positions.get(previousId);
    const current = positions.get(personId);
    if (!previous || !current) return;

    lines.push({
      id: `trace-trail-${context.traceFocusKey || 'direct'}-${previousId}-${personId}-${index}`,
      label: index === ids.length - 1 ? trailLabel : '',
      detail: '',
      provenance: 'curated',
      relationshipType,
      role: 'trail',
      x1: previous.x,
      y1: previous.y,
      x2: current.x,
      y2: current.y,
    });
  });

  return lines;
}

const traceAnchorPoint = { x: 42, y: 46 };

const traceOrbitAnchors = [
  { x: 22, y: 28 },
  { x: 35, y: 21 },
  { x: 24, y: 64 },
  { x: 58, y: 68 },
  { x: 64, y: 29 },
  { x: 70, y: 55 },
];

const traceContinuityAnchors = [
  { x: 50, y: 73 },
  { x: 32, y: 75 },
  { x: 56, y: 18 },
];

const tracePerimeterSlots = [
  { x: 8, y: 13 },
  { x: 17, y: 10 },
  { x: 30, y: 9 },
  { x: 48, y: 8 },
  { x: 66, y: 9 },
  { x: 82, y: 11 },
  { x: 93, y: 15 },
  { x: 95, y: 31 },
  { x: 94, y: 51 },
  { x: 91, y: 70 },
  { x: 78, y: 80 },
  { x: 62, y: 82 },
  { x: 43, y: 82 },
  { x: 25, y: 80 },
  { x: 10, y: 72 },
  { x: 6, y: 54 },
  { x: 6, y: 35 },
];

function tracePerimeterPosition(index: number, person: Inductee, current: PortraitPosition, layout: HallLayoutMetrics) {
  const slot = tracePerimeterSlots[index % tracePerimeterSlots.length];
  const band = Math.floor(index / tracePerimeterSlots.length);
  return {
    x: clamp(slot.x + wobble(person.id, 149, -1.5, 1.5), 4, 96),
    y: clamp(slot.y + band * 1.8 + wobble(person.name, 151, -1.1, 1.1), 6, layout.trace.yMax),
    size: Math.min(current.size, band < 2 ? layout.trace.perimeterNearSize : layout.trace.perimeterFarSize),
  };
}

function traceModeId(context: TraceContext) {
  if (context.mode === 'concept') return `traces-concept-${context.activeConcept?.lens.id ?? 'unknown'}`;
  if (context.mode === 'place') return `traces-place-${context.placeFocus.key || 'unknown'}`;
  return 'traces-direct';
}

function traceModeSubtitle(context: TraceContext) {
  if (!context.activePerson) return 'Touch a portrait to begin';
  if (context.mode === 'concept') return `${context.activeConcept?.lens.label ?? 'Concept'} trace around ${context.activePerson.name}`;
  if (context.mode === 'place') return `${context.placeFocus.label} nationality trace around ${context.activePerson.name}`;
  return `Reviewed ties around ${context.activePerson.name}`;
}

function buildTraceLabels(context: TraceContext): HallLabel[] {
  if (!context.activePerson) return [];
  const modeLabel = context.mode === 'concept'
    ? context.activeConcept?.lens.label.toUpperCase() ?? 'CONCEPT TRACE'
    : context.mode === 'place'
      ? context.placeFocus.label.toUpperCase()
      : 'DIRECT TIES';
  const placeLabels = tracePlaceLabels(context);

  const labels: HallLabel[] = [];

  if (context.mode !== 'direct') {
    labels.push({
      id: 'trace-mode-label',
      text: modeLabel,
      detail: context.mode === 'concept' ? 'FOLLOW THE TRACE' : 'NATIONALITY / HERITAGE',
      x: 82,
      y: 18,
    });
  }

  labels.push(...placeLabels);
  return labels;
}

function tracePlaceLabels(context: TraceContext): HallLabel[] {
  if (context.mode === 'place' && context.placeFocus.kind !== 'all') {
    const countries = context.placeFocus.countries.slice(0, 3);
    return countries.map((country, index) => ({
      id: `trace-place-${country.id}`,
      text: country.label.toUpperCase(),
      detail: 'CONNECTED HERITAGE',
      x: [18, 82, 72][index] ?? 82,
      y: [18, 74, 13][index] ?? 74,
    }));
  }

  const activePlaces = context.geography.countries
    .filter((country) => country.people.some((person) => person.id === context.activePerson?.id))
    .slice(0, 2);

  return activePlaces.map((country, index) => ({
    id: `trace-active-place-${country.id}`,
    text: country.label.toUpperCase(),
    detail: `CONNECTED TO ${country.label.toUpperCase()}`,
    x: index === 0 ? 17 : 82,
    y: index === 0 ? 18 : 74,
  }));
}

function applyHallFocus(
  mode: HallMode,
  inductees: Inductee[],
  relationships: RelationshipRecord[],
  focusedPersonId: string,
  layout: HallLayoutMetrics,
): HallMode {
  if (!focusedPersonId) return mode;
  const focused = inductees.find((person) => person.id === focusedPersonId);
  if (!focused) return mode;

  const relatedIds = relatedPersonIdsForFocus(focused, inductees, relationships);
  const relatedPeople = inductees.filter((person) => relatedIds.has(person.id)).slice(0, focusRelatedAnchors.length);
  const positions = new Map<string, PortraitPosition>();
  const center = {
    x: layout.tier === 'compact' ? 31 : 34,
    y: clamp(45, layout.portrait.yMin + 8, layout.portrait.yMax - 8),
  };

  inductees.forEach((person, index) => {
    const current = mode.positions.get(person.id) ?? fallbackPosition(index, inductees.length);

    if (person.id === focusedPersonId) {
      positions.set(person.id, {
        ...current,
        x: center.x,
        y: center.y,
        size: Math.max(current.size, layout.portrait.focusSize),
        z: 2400,
        delay: 0,
        emphasis: true,
        focused: true,
        muted: false,
      });
      return;
    }

    const relatedIndex = relatedPeople.findIndex((relatedPerson) => relatedPerson.id === person.id);
    if (relatedIndex >= 0) {
      const anchor = focusRelatedAnchors[relatedIndex];
      positions.set(person.id, {
        ...current,
        x: clamp(anchor.x + wobble(person.id, 71, -1.4, 1.4), 7, 93),
        y: clamp(anchor.y + wobble(person.name, 73, -1.1, 1.1), layout.portrait.yMin, layout.portrait.yMax),
        size: Math.max(Math.min(current.size + 5, layout.portrait.relatedMaxSize), layout.portrait.relatedMinSize),
        z: 1700 - relatedIndex,
        delay: staggerDelay(relatedIndex),
        emphasis: true,
        muted: false,
      });
      return;
    }

    const openPosition = movePortraitAwayFromFocus(current, index, center);
    positions.set(person.id, {
      ...current,
      x: openPosition.x,
      y: openPosition.y,
      size: Math.min(current.size, openPosition.shifted ? layout.portrait.mutedMaxSize : layout.portrait.relatedMinSize),
      z: Math.min(current.z, 28),
      delay: Math.min(current.delay, 120),
      emphasis: false,
      muted: true,
    });
  });

  return {
    ...mode,
    id: `${mode.id}-focus`,
    title: 'PORTRAITS',
    subtitle: `${focused.name} focused in the same portrait wall`,
    positions,
    labels: [
      {
        id: `focus-${focused.id}`,
        text: focused.classYear ? `CLASS ${focused.classYear}` : 'HONORED LIFE',
        detail: relatedPeople.length > 0 ? `${relatedPeople.length} nearby records` : undefined,
        x: 36,
        y: 72,
      },
      ...mode.labels.slice(0, 4),
    ],
  };
}

const focusRelatedAnchors = [
  { x: 18, y: 31 },
  { x: 19, y: 59 },
  { x: 34, y: 21 },
  { x: 56, y: 24 },
  { x: 57, y: 66 },
  { x: 36, y: 73 },
  { x: 71, y: 42 },
  { x: 23, y: 74 },
];

function movePortraitAwayFromFocus(position: PortraitPosition, index: number, center: { x: number; y: number }) {
  const inFocusRoom = position.x > 20 && position.x < 86 && position.y > 22 && position.y < 69;
  if (!inFocusRoom) return { x: position.x, y: position.y, shifted: false };

  const dx = position.x - center.x;
  const dy = position.y - center.y;
  const horizontal = Math.abs(dx) > Math.abs(dy);
  const x = horizontal
    ? (dx < 0 ? 7 + (index % 5) * 2.4 : 88 + (index % 4) * 1.7)
    : clamp(position.x + (dx < 0 ? -15 : 22), 7, 94);
  const y = horizontal
    ? clamp(position.y + (dy < 0 ? -6 : 7), 10, 81)
    : (dy < 0 ? 10 + (index % 4) * 3.2 : 73 + (index % 4) * 2.2);

  return {
    x: clamp(x + wobble(`${index}`, 89, -0.9, 0.9), 6, 94),
    y: clamp(y + wobble(`${index}`, 97, -0.7, 0.7), 9, 82),
    shifted: true,
  };
}

function relatedPersonIdsForFocus(focused: Inductee, inductees: Inductee[], relationships: RelationshipRecord[]) {
  const byId = new Map(inductees.map((person) => [person.id, person]));
  const relatedIds = new Set(focused.relatedIds.filter((id) => byId.has(id) && id !== focused.id));

  relationships
    .filter((relationship) => relationship.provenance !== 'inferred')
    .forEach((relationship) => {
      if (relationship.sourcePersonId === focused.id && byId.has(relationship.targetEntityId)) {
        relatedIds.add(relationship.targetEntityId);
      }
      if (relationship.targetEntityId === focused.id && byId.has(relationship.sourcePersonId)) {
        relatedIds.add(relationship.sourcePersonId);
      }
    });

  inductees.forEach((candidate) => {
    if (candidate.id === focused.id) return;
    if (focused.classYear && candidate.classYear === focused.classYear) relatedIds.add(candidate.id);
    if (focused.inductedBy && candidate.inductedBy && normalizeText(candidate.inductedBy) === normalizeText(focused.inductedBy)) {
      relatedIds.add(candidate.id);
    }
  });

  return relatedIds;
}

function parseHallYear(value: string) {
  if (!value) return null;
  const year = Number(value);
  return Number.isInteger(year) ? year : null;
}

function buildPortraitWallMode(inductees: Inductee[], variant: 'chronicle' | 'wall-memory', layout: HallLayoutMetrics): HallMode {
  const positions = new Map<string, PortraitPosition>();
  const count = inductees.length;
  const columns = layout.portrait.columns;
  const rows = Math.ceil(count / columns);
  const xMin = layout.portrait.xMin;
  const xMax = layout.portrait.xMax;
  const yMin = layout.portrait.yMin;
  const yMax = layout.portrait.yMax;
  const arranged = variant === 'wall-memory' ? sortByPhysicalWallMemory(inductees) : inductees;

  arranged.forEach((inductee, slotIndex) => {
    const row = Math.floor(slotIndex / columns);
    const column = slotIndex % columns;
    const xRatio = columns <= 1 ? 0.5 : column / (columns - 1);
    const yRatio = rows <= 1 ? 0.5 : row / (rows - 1);
    const rowOffset = variant === 'wall-memory'
      ? ((row % 2 === 0 ? 1 : -1) * 1.35)
      : ((row % 3) - 1) * 0.7;
    const classBeat = inductee.classYear ? (inductee.classYear % 7) * 0.18 : 0;
    const size = portraitSize(inductee, slotIndex + (variant === 'wall-memory' ? 41 : 0), layout.portrait.minSize, layout.portrait.maxSize);
    const baseX = xMin + (xMax - xMin) * xRatio + rowOffset + wobble(inductee.id, 101, -0.55, 0.55);
    const baseY = yMin + (yMax - yMin) * yRatio + classBeat + wobble(inductee.name, 103, -0.45, 0.45);
    const composition = portraitWallComposition({
      column,
      columns,
      inductee,
      row,
      rows,
      slotIndex,
      variant,
      x: baseX,
      y: baseY,
    });

    const strongFrame = inductee.featured || inductee.featuredCandidate || slotIndex % 6 === 0 || slotIndex % 19 === 0;
    const anchorBoost = inductee.featured || inductee.featuredCandidate
      ? 10
      : slotIndex % 29 === 0
        ? 8
        : slotIndex % 6 === 0
          ? 5
          : 0;
    const resolvedSize = strongFrame
      ? clamp(size + composition.size + anchorBoost, layout.portrait.emphasisMinSize, layout.portrait.emphasisMaxSize)
      : clamp(size + composition.size - 6, layout.portrait.quietMinSize, layout.portrait.quietMaxSize);

    positions.set(inductee.id, {
      x: clamp(baseX + composition.x, layout.portrait.xMin - 2, layout.portrait.xMax + 1.5),
      y: clamp(baseY + composition.y, layout.portrait.yMin - 3, layout.portrait.yMax + 3),
      size: resolvedSize,
      z: 80 + Math.round(resolvedSize) + (inductee.featured ? 120 : inductee.featuredCandidate ? 60 : 0),
      delay: staggerDelay(slotIndex),
      emphasis: strongFrame,
      muted: !strongFrame,
    });
  });

  return {
    id: variant === 'chronicle' ? 'portrait-wall-chronicle' : 'portrait-wall-memory',
    title: 'PORTRAITS',
    subtitle: variant === 'chronicle'
      ? `${inductees.length} stable portrait frames arranged by class year`
      : 'Same portrait frames subtly regrouped by physical-wall records',
    positions,
    labels: [],
  };
}

function portraitWallComposition({
  column,
  columns,
  inductee,
  row,
  rows,
  slotIndex,
  variant,
  x,
  y,
}: {
  column: number;
  columns: number;
  inductee: Inductee;
  row: number;
  rows: number;
  slotIndex: number;
  variant: 'chronicle' | 'wall-memory';
  x: number;
  y: number;
}) {
  let offsetX = 0;
  let offsetY = 0;
  let sizeOffset = 0;

  const inTitleVoid = x > 29 && x < 63 && y > 24 && y < 55;
  if (inTitleVoid) {
    offsetX += x < 46 ? -2.8 : 3.2;
    offsetY += y < 39 ? -2.1 : 2.6;
    sizeOffset -= 4;
  }

  const edgeColumn = column < 2 || column > columns - 3;
  if (edgeColumn) {
    offsetX += column < 2 ? -1.2 : 1.2;
    sizeOffset += variant === 'wall-memory' ? 2 : 0;
  }

  if (variant === 'wall-memory') {
    const physicalPanelStep = inductee.physicalPanel ? (hashNumber(inductee.physicalPanel) % 3) - 1 : 0;
    offsetX += physicalPanelStep * 0.7;
    offsetY += ((row % 4) - 1.5) * 0.5;
    if (slotIndex % 17 === 0) sizeOffset += 4;
  } else {
    const classDecade = inductee.classYear ? Math.floor(inductee.classYear / 10) : 0;
    offsetX += ((classDecade % 3) - 1) * 0.55;
    if (row > 0 && row < rows - 1 && column % 5 === 0) offsetY += 1.5;
    if (slotIndex % 31 === 0) sizeOffset += 3;
  }

  return { x: offsetX, y: offsetY, size: sizeOffset };
}

function sortByPhysicalWallMemory(inductees: Inductee[]) {
  return [...inductees].sort((a, b) => {
    return physicalWallRank(a).localeCompare(physicalWallRank(b))
      || (a.classYear ?? Number.MAX_SAFE_INTEGER) - (b.classYear ?? Number.MAX_SAFE_INTEGER)
      || a.sortName.localeCompare(b.sortName)
      || a.name.localeCompare(b.name);
  });
}

function physicalWallRank(inductee: Inductee) {
  const panel = inductee.physicalPanel || 'zz';
  const row = String(inductee.physicalRow ?? 99).padStart(2, '0');
  const column = String(inductee.physicalColumn ?? 99).padStart(2, '0');
  return `${panel}:${row}:${column}:${inductee.sortName}`;
}

function buildLegacyHallMode(
  inductees: Inductee[],
  chronology: LegacyChronology,
  activeYear: number | null,
  focusedPersonId: string,
  layout: HallLayoutMetrics,
): HallMode {
  const positions = new Map<string, PortraitPosition>();
  const focused = focusedPersonId ? inductees.find((person) => person.id === focusedPersonId) ?? null : null;
  const focusedGroup = focused ? chronology.groups.find((group) => group.people.some((person) => person.id === focused.id)) ?? null : null;
  const labels: HallLabel[] = [];
  const activeGroupIndex = activeYear === null ? -1 : chronology.groups.findIndex((candidate) => candidate.year === activeYear);

  chronology.groups.forEach((group, groupIndex) => {
    const groupActive = group.year !== null && group.year === activeYear;
    const groupFocused = focusedGroup?.key === group.key;
    const distanceFromActiveGroup = activeGroupIndex >= 0 ? Math.abs(groupIndex - activeGroupIndex) : Number.POSITIVE_INFINITY;
    const upperLabelY = Math.max(layout.safe.topPct + 4, layout.legacy.rowTopY - 17);
    const lowerLabelY = Math.min(layout.legacy.rowBottomY + 18, 100 - layout.safe.bottomPct - 8);
    const labelY = groupActive ? lowerLabelY : groupIndex % 2 === 0 ? upperLabelY : lowerLabelY;
    labels.push({
      id: `legacy-year-${group.key}`,
      text: group.label,
      detail: group.year === null ? 'CLASS' : groupActive ? 'ACTIVE CLASS' : 'CLASS',
      priority: legacyLabelPriority(groupIndex, distanceFromActiveGroup, groupActive || groupFocused, layout),
      x: group.x,
      y: labelY,
    });

    const people = group.people;
    const rows = people.length <= 1 ? 1 : 2;
    const columns = Math.max(1, Math.ceil(people.length / rows));
    const localStep = clamp(group.spacing * 0.23, layout.legacy.localStepMin, layout.legacy.localStepMax);
    const focusedIndex = focused ? people.findIndex((person) => person.id === focused.id) : -1;
    const focusedColumn = focusedIndex >= 0 ? Math.floor(focusedIndex / rows) : -1;

    people.forEach((inductee, personIndex) => {
      const row = rows === 1 ? 0 : personIndex % rows;
      const column = rows === 1 ? personIndex : Math.floor(personIndex / rows);
      const xOffset = (column - (columns - 1) / 2) * localStep;
      const yBase = rows === 1
        ? 45
        : row === 0
          ? layout.legacy.rowTopY
          : layout.legacy.rowBottomY;
      const isFocused = inductee.id === focusedPersonId;
      const focusColumnDistance = focusedColumn < 0 ? Number.POSITIVE_INFINITY : Math.abs(column - focusedColumn);
      const focusPush = groupFocused && !isFocused && focusColumnDistance <= 1
        ? (column <= focusedColumn ? -1 : 1) * clamp(group.spacing * 0.32, 1.35, 2.75)
        : 0;
      const size = isFocused
        ? layout.legacy.focusedSize
        : groupFocused
          ? layout.legacy.focusedGroupSize
          : groupActive
            ? layout.legacy.activeSize
            : layout.legacy.standardSize;

      positions.set(inductee.id, {
        x: clamp(group.x + xOffset + focusPush + wobble(inductee.id, 211, -0.18, 0.18), 1.5, 98.5),
        y: clamp((isFocused ? 45 : yBase) + wobble(inductee.name, 213, -0.65, 0.65), layout.portrait.yMin, layout.legacy.rowBottomY + 12),
        size,
        z: isFocused ? 2600 : groupFocused ? 950 - personIndex : groupActive ? 420 - personIndex : 120 - Math.min(groupIndex, 80),
        delay: staggerDelay(groupIndex + personIndex),
        emphasis: isFocused || groupFocused || groupActive,
        focused: isFocused,
        muted: Boolean(focusedPersonId && !groupFocused && !groupActive),
      });
    });
  });

  return {
    id: focusedPersonId ? 'legacies-chronology-focus' : 'legacies-chronology',
    title: chronology.firstYear && chronology.lastYear ? `${chronology.firstYear} - ${chronology.lastYear}` : 'LEGACIES',
    subtitle: focused
      ? `${focused.name} held in the class chronology`
      : activeYear
        ? `Class of ${activeYear} centered in the Hall chronology`
        : 'Portrait frames arranged by induction class',
    positions,
    labels,
  };
}

function buildTimelineMode(inductees: Inductee[], layout: HallLayoutMetrics, activeYear: number | null = null): HallMode {
  return buildLegacyHallMode(inductees, buildLegacyChronology(inductees, layout), activeYear, '', layout);
}

function buildExplicitTagMode({
  id,
  title,
  subtitle,
  inductees,
  layout,
  tagSource,
}: {
  id: string;
  title: string;
  subtitle: string;
  inductees: Inductee[];
  layout: HallLayoutMetrics;
  tagSource: (inductee: Inductee) => string[];
}): HallMode | null {
  const buckets = new Map<string, Inductee[]>();

  for (const inductee of inductees) {
    const tag = tagSource(inductee)[0];
    if (!tag) continue;
    const bucket = buckets.get(tag) ?? [];
    bucket.push(inductee);
    buckets.set(tag, bucket);
  }

  const groups = [...buckets.entries()]
    .filter(([, people]) => people.length >= 2)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, 6);

  if (groups.length < 3) return null;

  const positionedIds = new Set<string>();
  const positions = new Map<string, PortraitPosition>();
  const labels: HallLabel[] = [];
  const anchors = groupAnchors(groups.length);

  groups.forEach(([label, people], groupIndex) => {
    const anchor = anchors[groupIndex];
    labels.push({ id: `${id}-${label}`, text: label.toUpperCase(), detail: `${people.length}`, x: anchor.x, y: anchor.labelY });

    people.forEach((inductee, personIndex) => {
      positionedIds.add(inductee.id);
      const orbit = Math.sqrt((personIndex + 1) / people.length);
      const angle = (personIndex * 151 + groupIndex * 43) * Math.PI / 180;
      const size = portraitSize(
        inductee,
        personIndex + groupIndex,
        layout.portrait.relatedMinSize,
        Math.max(layout.portrait.relatedMaxSize, layout.portrait.emphasisMaxSize),
      );

      positions.set(inductee.id, {
        x: clamp(anchor.x + Math.cos(angle) * anchor.rx * orbit, 6, 94),
        y: clamp(anchor.y + Math.sin(angle) * anchor.ry * orbit, layout.portrait.yMin, layout.portrait.yMax),
        size,
        z: 60 + Math.round(size),
        delay: staggerDelay(personIndex + groupIndex),
        emphasis: personIndex < 2,
      });
    });
  });

  inductees
    .filter((inductee) => !positionedIds.has(inductee.id))
    .forEach((inductee, index, ungrouped) => {
      const position = fallbackPosition(index, ungrouped.length || 1);
      positions.set(inductee.id, {
        ...position,
        size: Math.min(position.size, layout.portrait.relatedMaxSize),
        y: clamp(position.y, layout.portrait.yMin, layout.portrait.yMax),
        z: 20,
        emphasis: false,
      });
    });

  return { id, title, subtitle, positions, labels };
}

function groupByYear(inductees: Inductee[]) {
  const groups = new Map<number, Inductee[]>();
  for (const inductee of inductees) {
    if (typeof inductee.classYear !== 'number') continue;
    const group = groups.get(inductee.classYear) ?? [];
    group.push(inductee);
    groups.set(inductee.classYear, group);
  }
  return groups;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
