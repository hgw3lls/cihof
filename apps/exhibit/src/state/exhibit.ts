/**
 * Visitor state for the installed exhibit.
 *
 * Three shapes here exist because of defects found in the previous
 * implementation, and each is expressed so the defect cannot recur:
 *
 *   A detail panel carries its own subject, so a record cannot be open with
 *   nobody selected. That state was reachable from a URL and rendered a blank
 *   exhibit.
 *
 *   Media is a field of its own, not a branch of the detail union. A record
 *   opens over a playing film and closing it returns to that film; collapsing
 *   them into one value silently discarded the film.
 *
 *   Discovery is held separately from selection. It narrows lists. Nothing in
 *   here lets a search term reach the relationship graph, which is how a query
 *   once emptied the constellation it was meant to help navigate.
 */

export type Lens = 'people' | 'places' | 'links' | 'years';

/** A panel always knows whose panel it is. */
export type Detail =
  | { readonly kind: 'none' }
  | { readonly kind: 'record'; readonly personId: string }
  | { readonly kind: 'share'; readonly personId: string };

/** Playing media outlives the panel above it. */
export type Media =
  | { readonly kind: 'none' }
  | { readonly kind: 'film'; readonly personId: string; readonly filmId: string };

export type Discovery = {
  readonly query: string;
  readonly communities: readonly string[];
  readonly contributions: readonly string[];
  readonly years: readonly number[];
};

export type ExhibitState = {
  readonly lens: Lens;
  readonly selectedId: string | null;
  readonly discovery: Discovery;
  readonly detail: Detail;
  readonly media: Media;
  readonly history: readonly Restorable[];
};

type Restorable = Omit<ExhibitState, 'history'>;

export type ExhibitAction =
  | { type: 'lens'; lens: Lens }
  | { type: 'select'; personId: string }
  | { type: 'clear-selection' }
  | { type: 'query'; query: string }
  | { type: 'facet'; dimension: 'communities' | 'contributions'; value: string }
  | { type: 'year'; year: number }
  | { type: 'clear-discovery' }
  | { type: 'open-record'; personId: string }
  | { type: 'open-share'; personId: string }
  | { type: 'close-detail' }
  | { type: 'play-film'; personId: string; filmId: string }
  | { type: 'stop-film' }
  | { type: 'back' }
  | { type: 'reset' };

export const historyLimit = 24;
export const maxQueryLength = 160;

export const emptyDiscovery: Discovery = { query: '', communities: [], contributions: [], years: [] };

export function initialState(): ExhibitState {
  return { lens: 'people', selectedId: null, discovery: emptyDiscovery, detail: { kind: 'none' }, media: { kind: 'none' }, history: [] };
}

export function hasDiscovery(discovery: Discovery): boolean {
  return discovery.query.trim().length > 0
    || discovery.communities.length > 0
    || discovery.contributions.length > 0
    || discovery.years.length > 0;
}

export function exhibitReducer(state: ExhibitState, action: ExhibitAction): ExhibitState {
  switch (action.type) {
    case 'lens':
      if (state.lens === action.lens) return state;
      // Leaving a lens ends anything playing in it.
      return remember(state, { lens: action.lens, detail: { kind: 'none' }, media: { kind: 'none' } });

    case 'select':
      if (state.selectedId === action.personId) return state;
      return remember(state, { selectedId: action.personId, detail: { kind: 'none' }, media: { kind: 'none' } });

    case 'clear-selection':
      if (state.selectedId === null) return state;
      return remember(state, { selectedId: null, detail: { kind: 'none' }, media: { kind: 'none' } });

    case 'query': {
      const query = action.query.slice(0, maxQueryLength);
      return state.discovery.query === query ? state : remember(state, { discovery: { ...state.discovery, query } });
    }

    case 'facet': {
      const current = state.discovery[action.dimension];
      const next = current.includes(action.value)
        ? current.filter((value) => value !== action.value)
        : [...current, action.value];
      return remember(state, { discovery: { ...state.discovery, [action.dimension]: next } });
    }

    case 'year': {
      const next = state.discovery.years.includes(action.year)
        ? state.discovery.years.filter((year) => year !== action.year)
        : [...state.discovery.years, action.year].sort((a, b) => a - b);
      return remember(state, { discovery: { ...state.discovery, years: next } });
    }

    case 'clear-discovery':
      return hasDiscovery(state.discovery) ? remember(state, { discovery: emptyDiscovery }) : state;

    // A panel opens over whatever is playing and leaves it alone.
    case 'open-record':
      return remember(state, { selectedId: action.personId, detail: { kind: 'record', personId: action.personId } });

    case 'open-share':
      return remember(state, { detail: { kind: 'share', personId: action.personId } });

    case 'close-detail':
      return state.detail.kind === 'none' ? state : { ...state, detail: { kind: 'none' } };

    case 'play-film':
      return remember(state, {
        selectedId: action.personId,
        media: { kind: 'film', personId: action.personId, filmId: action.filmId },
      });

    case 'stop-film':
      return state.media.kind === 'none' ? state : { ...state, media: { kind: 'none' } };

    case 'back': {
      const previous = state.history.at(-1);
      if (!previous) return state;
      return { ...previous, history: state.history.slice(0, -1) };
    }

    case 'reset':
      return initialState();
  }
}

function remember(state: ExhibitState, patch: Partial<Restorable>): ExhibitState {
  const { history, ...restorable } = state;
  return { ...state, ...patch, history: [...history, restorable].slice(-historyLimit) };
}
