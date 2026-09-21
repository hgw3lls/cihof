import type { Inductee } from '../../../data/types';
import { foldSearchText } from '../interpretiveModel';

export const exhibitUrlVersion = '1';
export const exhibitHistoryLimit = 24;

export type ExhibitLens = 'people' | 'places' | 'links' | 'years';
export type ExhibitGrouping = 'all' | 'community' | 'contribution';
export type PeopleSort = 'name' | 'newest' | 'earliest';
export type TimeMode = 'induction' | 'activity';
export type DetailKind = 'none' | 'record' | 'qr' | 'story' | 'evidence' | 'gallery' | 'comparison';

export type ExhibitFacets = {
  communityIds: string[];
  contributionIds: string[];
  placeIds: string[];
  inductionYears: string[];
};

export type ExhibitViewport = {
  scrollTop: number;
  scrollLeft: number;
  focusId: string;
};

export type ExhibitDetail = {
  kind: DetailKind;
  id?: string;
};

// D08: a record opens over a playing film and closing it returns to that film.
// Media therefore cannot be one branch of the detail union.
export type ExhibitMedia =
  | { kind: 'none' }
  | { kind: 'film'; id: string };

export type ExhibitRestorableState = {
  lens: ExhibitLens;
  grouping: ExhibitGrouping;
  selectedPersonId: string;
  comparePersonIds: [] | [string] | [string, string];
  query: string;
  facets: ExhibitFacets;
  sort: PeopleSort;
  selectedPlaceId: string;
  time: { mode: TimeMode; from: number | null; to: number | null };
  detail: ExhibitDetail;
  media: ExhibitMedia;
  activeLinkPersonId: string;
  viewports: Record<ExhibitLens, ExhibitViewport>;
};

export type ExhibitState = ExhibitRestorableState & {
  history: ExhibitRestorableState[];
  revision: number;
};

export type ExhibitAction =
  | { type: 'set-lens'; lens: ExhibitLens }
  | { type: 'set-grouping'; grouping: ExhibitGrouping }
  | { type: 'select-person'; personId: string; detail?: ExhibitDetail; media?: ExhibitMedia }
  | { type: 'clear-selection' }
  | { type: 'set-query'; query: string }
  | { type: 'set-facet'; dimension: keyof ExhibitFacets; values: string[] }
  | { type: 'clear-filters' }
  | { type: 'set-sort'; sort: PeopleSort }
  | { type: 'set-comparison'; personIds: [] | [string] | [string, string] }
  | { type: 'set-place'; placeId: string }
  | { type: 'set-time-mode'; mode: TimeMode }
  | { type: 'set-time-range'; from: number | null; to: number | null }
  | { type: 'open-detail'; detail: ExhibitDetail }
  | { type: 'set-detail'; detail: ExhibitDetail }
  | { type: 'close-detail' }
  | { type: 'set-media'; media: ExhibitMedia }
  | { type: 'close-media' }
  | { type: 'set-link-focus'; personId: string }
  | { type: 'capture-viewport'; lens: ExhibitLens; viewport: ExhibitViewport }
  | { type: 'back' }
  | { type: 'back-selection' }
  | { type: 'reset' }
  | { type: 'replace-from-url'; state: ExhibitRestorableState };

export function createInitialExhibitState(search = ''): ExhibitState {
  return { ...parseExhibitUrl(search), history: [], revision: 0 };
}

export function createDefaultExhibitState(): ExhibitRestorableState {
  const viewport = (): ExhibitViewport => ({ scrollTop: 0, scrollLeft: 0, focusId: '' });
  return {
    lens: 'people',
    grouping: 'all',
    selectedPersonId: '',
    comparePersonIds: [],
    query: '',
    facets: { communityIds: [], contributionIds: [], placeIds: [], inductionYears: [] },
    sort: 'name',
    selectedPlaceId: '',
    time: { mode: 'induction', from: null, to: null },
    detail: { kind: 'none' },
    media: { kind: 'none' },
    activeLinkPersonId: '',
    viewports: { people: viewport(), places: viewport(), links: viewport(), years: viewport() },
  };
}

export function exhibitReducer(state: ExhibitState, action: ExhibitAction): ExhibitState {
  switch (action.type) {
    case 'set-lens':
      if (state.lens === action.lens && state.detail.kind === 'none' && state.media.kind === 'none') return state;
      return withHistory(state, { lens: action.lens, detail: { kind: 'none' }, media: { kind: 'none' }, activeLinkPersonId: '' });
    case 'set-grouping':
      return state.grouping === action.grouping ? state : withHistory(state, { grouping: action.grouping });
    case 'select-person': {
      const detail = action.detail ?? { kind: 'none' as const };
      const media = action.media ?? { kind: 'none' as const };
      if (state.selectedPersonId === action.personId && equalDetail(state.detail, detail) && equalMedia(state.media, media)) return state;
      return withHistory(state, { selectedPersonId: action.personId, detail, media, activeLinkPersonId: '' });
    }
    case 'clear-selection':
      return {
        ...state,
        selectedPersonId: '',
        comparePersonIds: [],
        selectedPlaceId: '',
        detail: { kind: 'none' },
        media: { kind: 'none' },
        activeLinkPersonId: '',
        history: [],
        revision: state.revision + 1,
      };
    case 'set-query':
      return state.query === action.query ? state : withHistory(state, { query: action.query.slice(0, 160) });
    case 'set-facet': {
      const values = normalizeList(action.values, 12);
      if (equalLists(state.facets[action.dimension], values)) return state;
      return withHistory(state, { facets: { ...state.facets, [action.dimension]: values } });
    }
    case 'clear-filters':
      if (!hasActiveDiscovery(state)) return state;
      return withHistory(state, {
        query: '',
        facets: { communityIds: [], contributionIds: [], placeIds: [], inductionYears: [] },
      });
    case 'set-sort':
      return state.sort === action.sort ? state : withHistory(state, { sort: action.sort });
    case 'set-comparison': {
      const comparePersonIds = normalizeList(action.personIds, 2) as [] | [string] | [string, string];
      return equalLists(state.comparePersonIds, comparePersonIds) ? state : withHistory(state, { comparePersonIds });
    }
    case 'set-place':
      return state.selectedPlaceId === action.placeId ? state : withHistory(state, { selectedPlaceId: action.placeId.slice(0, 120) });
    case 'set-time-mode':
      return state.time.mode === action.mode ? state : withHistory(state, { time: { ...state.time, mode: action.mode } });
    case 'set-time-range': {
      const range = normalizeTimeRange(action.from, action.to);
      return state.time.from === range.from && state.time.to === range.to
        ? state
        : withHistory(state, { time: { ...state.time, ...range } });
    }
    case 'open-detail':
      return equalDetail(state.detail, action.detail) ? state : withHistory(state, { detail: action.detail });
    case 'set-detail':
      return equalDetail(state.detail, action.detail) ? state : { ...state, detail: action.detail, revision: state.revision + 1 };
    case 'close-detail':
      return state.detail.kind === 'none' ? state : { ...state, detail: { kind: 'none' }, revision: state.revision + 1 };
    case 'set-media':
      return equalMedia(state.media, action.media) ? state : { ...state, media: action.media, revision: state.revision + 1 };
    case 'close-media':
      return state.media.kind === 'none' ? state : { ...state, media: { kind: 'none' }, revision: state.revision + 1 };
    case 'set-link-focus':
      return state.activeLinkPersonId === action.personId ? state : { ...state, activeLinkPersonId: action.personId, revision: state.revision + 1 };
    case 'capture-viewport':
      return {
        ...state,
        viewports: { ...state.viewports, [action.lens]: normalizeViewport(action.viewport) },
      };
    case 'back': {
      const previous = state.history[state.history.length - 1];
      if (!previous) return state;
      return { ...previous, history: state.history.slice(0, -1), revision: state.revision + 1 };
    }
    case 'back-selection': {
      let index = -1;
      for (let candidate = state.history.length - 1; candidate >= 0; candidate -= 1) {
        const personId = state.history[candidate].selectedPersonId;
        if (personId && personId !== state.selectedPersonId) {
          index = candidate;
          break;
        }
      }
      if (index < 0) return state;
      return { ...state.history[index], history: state.history.slice(0, index), revision: state.revision + 1 };
    }
    case 'reset':
      return { ...createDefaultExhibitState(), history: [], revision: state.revision + 1 };
    case 'replace-from-url':
      return { ...action.state, history: [], revision: state.revision + 1 };
  }
}

export function parseExhibitUrl(search: string): ExhibitRestorableState {
  const state = createDefaultExhibitState();
  const params = new URLSearchParams(search);
  const rawLens = params.get('scene') ?? params.get('view') ?? '';
  state.lens = compatibleLens(rawLens);
  state.selectedPersonId = safeIdentifier(params.get('person'));

  if (params.get('v') !== exhibitUrlVersion) return state;

  state.grouping = enumValue(params.get('group'), ['all', 'community', 'contribution'], 'all');
  state.query = (params.get('q') ?? '').slice(0, 160);
  state.facets = {
    communityIds: parseList(params.get('community')),
    contributionIds: parseList(params.get('contribution')),
    placeIds: parseIdentifierList(params.get('place')),
    inductionYears: parseList(params.get('year')).filter((value) => /^\d{4}$/.test(value)),
  };
  state.sort = enumValue(params.get('sort'), ['name', 'newest', 'earliest'], 'name');
  state.selectedPlaceId = safeIdentifier(params.get('placeFocus'));
  state.comparePersonIds = parseIdentifierList(params.get('compare')).slice(0, 2) as [] | [string] | [string, string];
  state.time = {
    mode: enumValue(params.get('timeMode'), ['induction', 'activity'], 'induction'),
    ...normalizeTimeRange(parseYear(params.get('from')), parseYear(params.get('to'))),
  };
  const detail = enumValue(params.get('detail'), ['none', 'record', 'story', 'evidence', 'gallery', 'comparison'], 'none');
  state.detail = detailResolvesAgainst(detail, state) ? { kind: detail } : { kind: 'none' };
  return state;
}

export function serializeExhibitUrl(state: ExhibitRestorableState, currentSearch = '') {
  const current = new URLSearchParams(currentSearch);
  const params = new URLSearchParams();
  for (const key of ['kiosk', 'reach', 'admin']) {
    if (current.get(key) === '1') params.set(key, '1');
  }
  if (state.lens !== 'people') params.set('scene', state.lens);
  if (state.selectedPersonId) params.set('person', state.selectedPersonId);

  if (hasStructuredUrlState(state)) {
    params.set('v', exhibitUrlVersion);
    if (state.grouping !== 'all') params.set('group', state.grouping);
    if (state.query) params.set('q', state.query);
    setListParam(params, 'community', state.facets.communityIds);
    setListParam(params, 'contribution', state.facets.contributionIds);
    setListParam(params, 'place', state.facets.placeIds);
    setListParam(params, 'year', state.facets.inductionYears);
    if (state.sort !== 'name') params.set('sort', state.sort);
    if (state.selectedPlaceId) params.set('placeFocus', state.selectedPlaceId);
    setListParam(params, 'compare', state.comparePersonIds);
    if (state.time.mode !== 'induction') params.set('timeMode', state.time.mode);
    if (state.time.from !== null) params.set('from', String(state.time.from));
    if (state.time.to !== null) params.set('to', String(state.time.to));
    if (['record', 'story', 'evidence', 'gallery', 'comparison'].includes(state.detail.kind)) params.set('detail', state.detail.kind);
  }
  return params.toString();
}

export function filterPeopleForExhibit(
  people: Inductee[],
  state: Pick<ExhibitRestorableState, 'query' | 'facets' | 'sort'>,
  placePeopleById: ReadonlyMap<string, ReadonlySet<string>> = new Map(),
) {
  const filtered = people.filter((person) => {
    if (!matchesQuery(person, state.query)) return false;
    if (!matchesFacet(person.communityTags, person.communityTagsSource, state.facets.communityIds)) return false;
    if (!matchesFacet(person.themeTags, person.themeTagsSource, state.facets.contributionIds)) return false;
    if (state.facets.inductionYears.length > 0 && !state.facets.inductionYears.includes(String(person.classYear ?? 'unknown'))) return false;
    if (state.facets.placeIds.length > 0 && !state.facets.placeIds.some((placeId) => placePeopleById.get(placeId)?.has(person.id))) return false;
    return true;
  });

  return filtered.sort((a, b) => {
    if (state.sort === 'newest') return (b.classYear ?? 0) - (a.classYear ?? 0) || a.name.localeCompare(b.name);
    if (state.sort === 'earliest') return (a.classYear ?? Number.MAX_SAFE_INTEGER) - (b.classYear ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name);
    return a.name.localeCompare(b.name);
  });
}

export function hasActiveDiscovery(state: Pick<ExhibitRestorableState, 'query' | 'facets'>) {
  return Boolean(state.query || Object.values(state.facets).some((values) => values.length > 0));
}

function withHistory(state: ExhibitState, patch: Partial<ExhibitRestorableState>): ExhibitState {
  return {
    ...state,
    ...patch,
    history: [...state.history, restorableSnapshot(state)].slice(-exhibitHistoryLimit),
    revision: state.revision + 1,
  };
}

function restorableSnapshot(state: ExhibitState): ExhibitRestorableState {
  return {
    lens: state.lens,
    grouping: state.grouping,
    selectedPersonId: state.selectedPersonId,
    comparePersonIds: [...state.comparePersonIds] as [] | [string] | [string, string],
    query: state.query,
    facets: {
      communityIds: [...state.facets.communityIds],
      contributionIds: [...state.facets.contributionIds],
      placeIds: [...state.facets.placeIds],
      inductionYears: [...state.facets.inductionYears],
    },
    sort: state.sort,
    selectedPlaceId: state.selectedPlaceId,
    time: { ...state.time },
    detail: { ...state.detail },
    media: { ...state.media },
    activeLinkPersonId: state.activeLinkPersonId,
    viewports: Object.fromEntries(Object.entries(state.viewports).map(([lens, viewport]) => [lens, { ...viewport }])) as Record<ExhibitLens, ExhibitViewport>,
  };
}

const personScopedDetails = new Set(['record', 'story', 'evidence', 'gallery']);

function detailResolvesAgainst(detail: DetailKind, state: ExhibitRestorableState) {
  if (detail === 'none') return false;
  if (personScopedDetails.has(detail)) return Boolean(state.selectedPersonId);
  if (detail === 'comparison') return state.comparePersonIds.length > 0;
  return true;
}

function compatibleLens(value: string): ExhibitLens {
  if (value === 'places') return 'places';
  if (value === 'links') return 'links';
  if (value === 'years') return 'years';
  if (['world', 'connections', 'journeys', 'routes', 'region-map'].includes(value)) return 'links';
  if (value === 'time' || value === 'timeline') return 'years';
  return 'people';
}

const explicitTagSources = new Set(['curated', 'documented']);

function matchesQuery(person: Inductee, query: string) {
  const folded = foldSearchText(query);
  if (!folded) return true;
  const text = [
    person.name,
    person.sortName,
    person.pronunciation,
    person.classYear,
    ...(explicitTagSources.has(person.themeTagsSource) ? person.themeTags : []),
    ...(explicitTagSources.has(person.communityTagsSource) ? person.communityTags : []),
    ...(explicitTagSources.has(person.countryTagsSource) ? person.countryTags : []),
  ].filter(Boolean).join(' ');
  return foldSearchText(text).includes(folded);
}

function matchesFacet(values: string[], source: string, selected: string[]) {
  if (selected.length === 0) return true;
  if (!explicitTagSources.has(source)) return false;
  return selected.some((value) => values.includes(value));
}

function hasStructuredUrlState(state: ExhibitRestorableState) {
  return state.grouping !== 'all'
    || hasActiveDiscovery(state)
    || state.sort !== 'name'
    || Boolean(state.selectedPlaceId || state.comparePersonIds.length)
    || state.time.mode !== 'induction'
    || state.time.from !== null
    || state.time.to !== null
    || state.detail.kind !== 'none';
}

function normalizeList(values: readonly string[], limit: number) {
  return [...new Set(values.map((value) => value.trim().slice(0, 120)).filter(Boolean))].slice(0, limit);
}

function parseList(value: string | null) {
  return normalizeList((value ?? '').split(','), 12).filter((item) => !/[<>{}\\\u0000-\u001f]/.test(item));
}

function parseIdentifierList(value: string | null) {
  return parseList(value).filter((item) => safeIdentifier(item) === item);
}

function setListParam(params: URLSearchParams, key: string, values: readonly string[]) {
  if (values.length > 0) params.set(key, values.join(','));
}

function safeIdentifier(value: string | null) {
  const candidate = (value ?? '').trim().slice(0, 120);
  return /^[a-z0-9][a-z0-9:._-]*$/i.test(candidate) ? candidate : '';
}

function parseYear(value: string | null) {
  if (!value || !/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return year >= 1500 && year <= 2200 ? year : null;
}

function normalizeTimeRange(from: number | null, to: number | null) {
  if (from !== null && to !== null && from > to) return { from: to, to: from };
  return { from, to };
}

function normalizeViewport(viewport: ExhibitViewport): ExhibitViewport {
  return {
    scrollTop: Math.max(0, Math.round(viewport.scrollTop)),
    scrollLeft: Math.max(0, Math.round(viewport.scrollLeft)),
    focusId: viewport.focusId.slice(0, 120),
  };
}

function enumValue<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}

function equalLists(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function equalDetail(a: ExhibitDetail, b: ExhibitDetail) {
  return a.kind === b.kind && a.id === b.id;
}

function equalMedia(a: ExhibitMedia, b: ExhibitMedia) {
  return a.kind === b.kind && (a.kind !== 'film' || b.kind !== 'film' || a.id === b.id);
}
