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
 *   How People is arranged is held separately from selection. It moves faces
 *   around the wall and never chooses or unchooses anybody.
 */
import type { Arrangement } from './wall.ts';
import { defaultLayers, type LayerId } from './connections.ts';

export type Lens = 'people' | 'places' | 'links' | 'years';

/**
 * An installed display waits on its attract screen and returns there at every
 * reset; nothing a visitor chose survives the trip. A website has no attract
 * screen: somebody who opened it is already exploring.
 */
export type Mode = 'attract' | 'explore';

/** A panel always knows whose panel it is. */
export type Detail =
  | { readonly kind: 'none' }
  | { readonly kind: 'record'; readonly personId: string }
  | { readonly kind: 'share'; readonly personId: string };

/** Playing media outlives the panel above it. */
export type Media =
  | { readonly kind: 'none' }
  /** `at` is where to start, when a search found words said part way through. */
  | { readonly kind: 'film'; readonly personId: string; readonly filmId: string; readonly at?: number };

/** People lit on the wall, and what lit them: a search, or a grouping it found. */
export type Spotlight = { readonly label: string; readonly personIds: readonly string[] };

export type Search = { readonly open: boolean; readonly query: string };

/** A walk through the wall one person at a time: a curated tour, or a thread a visitor saved. */
export type Tour = {
  readonly id: string;
  readonly label: string;
  readonly prompt: string;
  readonly description: string;
  readonly personIds: readonly string[];
};

export type ExhibitState = {
  /** Where a reset lands, fixed for the life of the page. */
  readonly home: Mode;
  readonly mode: Mode;
  readonly lens: Lens;
  readonly selectedId: string | null;
  /** Two people side by side, instead of one. Never both at once. */
  readonly pair: readonly [string, string] | null;
  readonly arrangement: Arrangement;
  /** The letter picked on the A to Z rail; the others step back. */
  readonly letter: string | null;
  readonly search: Search;
  readonly spotlight: Spotlight | null;
  /** Connections: the diagram, or the city by place. */
  readonly linkView: 'diagram' | 'places';
  readonly linkLayers: readonly LayerId[];
  /** A place at the centre of the diagram, instead of a person. */
  readonly placeId: string | null;
  /** The people walked through in Connections, most recent last. */
  readonly trail: readonly string[];
  /** The induction class Years shows, when a visitor has touched one. */
  readonly year: number | null;
  readonly tour: Tour | null;
  readonly tourStep: number;
  readonly detail: Detail;
  readonly media: Media;
  readonly history: readonly Restorable[];
};

type Restorable = Omit<ExhibitState, 'history' | 'home' | 'mode'>;

export type ExhibitAction =
  | { type: 'begin' }
  | { type: 'begin-with'; personId: string }
  | { type: 'lens'; lens: Lens }
  | { type: 'select'; personId: string }
  | { type: 'clear-selection' }
  | { type: 'pair'; personIds: readonly [string, string] }
  | { type: 'arrange'; arrangement: Arrangement }
  | { type: 'letter'; letter: string | null }
  | { type: 'open-search' }
  | { type: 'search-query'; query: string }
  /** Closing keeps the people it found lit on the wall, when there are any. */
  | { type: 'close-search'; spotlight: Spotlight | null }
  | { type: 'clear-spotlight' }
  | { type: 'link-view'; view: 'diagram' | 'places' }
  | { type: 'link-layer'; layer: LayerId }
  | { type: 'place'; placeId: string }
  | { type: 'year'; year: number }
  | { type: 'start-tour'; tour: Tour }
  | { type: 'tour-step'; step: number }
  | { type: 'end-tour' }
  | { type: 'open-record'; personId: string }
  | { type: 'open-share'; personId: string }
  | { type: 'close-detail' }
  | { type: 'play-film'; personId: string; filmId: string; at?: number }
  | { type: 'stop-film' }
  | { type: 'back' }
  | { type: 'reset' };

export const historyLimit = 24;
export const maxQueryLength = 80;
/** How many people a trail keeps; the earliest drop off. */
export const trailLimit = 12;
const closedSearch: Search = { open: false, query: '' };

export function initialState(home: Mode = 'explore'): ExhibitState {
  return {
    home, mode: home, lens: 'people', selectedId: null, pair: null, arrangement: 'name', letter: null,
    search: closedSearch, spotlight: null, linkView: 'diagram', linkLayers: defaultLayers, placeId: null, trail: [], year: null, tour: null, tourStep: 0, detail: { kind: 'none' }, media: { kind: 'none' }, history: [],
  };
}

export function exhibitReducer(state: ExhibitState, action: ExhibitAction): ExhibitState {
  switch (action.type) {
    // Leaving the attract screen starts a fresh visit on People. Touching a
    // face there chooses that person; touching anything else chooses nobody.
    case 'begin':
      return { ...initialState(state.home), mode: 'explore' };

    case 'begin-with':
      return { ...initialState(state.home), mode: 'explore', selectedId: action.personId };

    case 'lens':
      if (state.lens === action.lens) return state;
      // Leaving a lens ends anything playing in it, and a pair belongs to the wall it was made on.
      // Connections opens on whoever was chosen, and their walk starts there.
      return remember(state, {
        lens: action.lens, pair: null, letter: null, search: closedSearch, spotlight: null, tour: null, tourStep: 0,
        linkView: 'diagram', placeId: null, trail: action.lens === 'links' && state.selectedId ? [state.selectedId] : [],
        detail: { kind: 'none' }, media: { kind: 'none' },
      });

    case 'select':
      if (state.selectedId === action.personId && state.pair === null) return state;
      // Choosing somebody from the search closes it; the people it lit stay lit.
      // In Connections each person chosen is a step on the visitor's walk;
      // going back to one already on it goes back along it.
      return remember(state, {
        selectedId: action.personId, pair: null, placeId: null, search: { ...state.search, open: false },
        // On a tour, touching one of its people moves the tour to them.
        ...(state.tour && state.tour.personIds.includes(action.personId) ? { tourStep: state.tour.personIds.indexOf(action.personId) } : {}),
        trail: state.lens === 'links' ? walk(state.trail, action.personId) : state.trail,
        detail: { kind: 'none' }, media: { kind: 'none' },
      });

    case 'clear-selection':
      if (state.selectedId === null && state.pair === null && state.placeId === null) return state;
      return remember(state, { selectedId: null, pair: null, placeId: null, trail: [], detail: { kind: 'none' }, media: { kind: 'none' } });

    case 'pair': {
      const [a, b] = action.personIds;
      if (a === b) return state;
      return remember(state, { pair: [a, b], selectedId: null, detail: { kind: 'none' }, media: { kind: 'none' } });
    }

    case 'arrange':
      return state.arrangement === action.arrangement ? state : remember(state, { arrangement: action.arrangement, letter: null });

    case 'letter':
      return state.letter === action.letter ? state : { ...state, letter: action.letter };

    // Search belongs to the wall: it opens on People, in place of the sheet.
    case 'open-search':
      if (state.search.open) return state;
      return remember(state, {
        lens: 'people', selectedId: null, pair: null, letter: null,
        search: { open: true, query: state.search.query }, detail: { kind: 'none' }, media: { kind: 'none' },
      });

    case 'search-query': {
      const query = action.query.slice(0, maxQueryLength);
      return query === state.search.query ? state : { ...state, search: { ...state.search, query } };
    }

    case 'close-search':
      if (!state.search.open) return state;
      return { ...state, search: { ...state.search, open: false }, spotlight: action.spotlight };

    case 'clear-spotlight':
      return { ...state, search: closedSearch, spotlight: null };

    // By place always shows the places, so turning it on turns their layer on.
    case 'link-view':
      if (state.linkView === action.view) return state;
      return remember(state, {
        linkView: action.view, selectedId: null, placeId: null, trail: [],
        linkLayers: action.view === 'places' && !state.linkLayers.includes('places') ? [...state.linkLayers, 'places'] : state.linkLayers,
      });

    case 'link-layer':
      return {
        ...state,
        linkLayers: state.linkLayers.includes(action.layer)
          ? state.linkLayers.filter((each) => each !== action.layer)
          : [...state.linkLayers, action.layer],
      };

    // Touching a year shows that class; nobody from another stays chosen.
    case 'year':
      if (state.year === action.year && state.selectedId === null) return state;
      return remember(state, { year: action.year, selectedId: null, pair: null });

    // A tour walks the wall, on People, starting with its first person.
    case 'start-tour': {
      const first = action.tour.personIds[0];
      if (!first) return state;
      return remember(state, {
        lens: 'people', tour: action.tour, tourStep: 0, selectedId: first, pair: null, letter: null, placeId: null,
        search: closedSearch, spotlight: null, detail: { kind: 'none' }, media: { kind: 'none' },
      });
    }

    case 'tour-step': {
      if (!state.tour) return state;
      const step = Math.min(state.tour.personIds.length - 1, Math.max(0, action.step));
      return remember(state, { tourStep: step, selectedId: state.tour.personIds[step] ?? null, pair: null });
    }

    case 'end-tour':
      return state.tour ? remember(state, { tour: null, tourStep: 0, selectedId: null, pair: null }) : state;

    case 'place':
      return remember(state, {
        lens: 'links', linkView: 'diagram', placeId: action.placeId, selectedId: null, pair: null,
        linkLayers: state.linkLayers.includes('places') ? state.linkLayers : [...state.linkLayers, 'places'],
        search: { ...state.search, open: false },
      });

    // A panel opens over whatever is playing and leaves it alone.
    case 'open-record':
      return remember(state, {
        selectedId: action.personId, pair: null, search: { ...state.search, open: false },
        detail: { kind: 'record', personId: action.personId },
      });

    case 'open-share':
      return remember(state, { detail: { kind: 'share', personId: action.personId } });

    case 'close-detail':
      return state.detail.kind === 'none' ? state : { ...state, detail: { kind: 'none' } };

    case 'play-film':
      return remember(state, {
        selectedId: action.personId,
        pair: null,
        search: { ...state.search, open: false },
        media: action.at === undefined
          ? { kind: 'film', personId: action.personId, filmId: action.filmId }
          : { kind: 'film', personId: action.personId, filmId: action.filmId, at: action.at },
      });

    case 'stop-film':
      return state.media.kind === 'none' ? state : { ...state, media: { kind: 'none' } };

    case 'back': {
      const previous = state.history.at(-1);
      if (!previous) return state;
      return { ...state, ...previous, history: state.history.slice(0, -1) };
    }

    case 'reset':
      return initialState(state.home);
  }
}

function walk(trail: readonly string[], personId: string): string[] {
  const at = trail.indexOf(personId);
  return at >= 0 ? trail.slice(0, at + 1) : [...trail, personId].slice(-trailLimit);
}

function remember(state: ExhibitState, patch: Partial<Restorable>): ExhibitState {
  const { history, home: _home, mode: _mode, ...restorable } = state;
  return { ...state, ...patch, history: [...history, restorable].slice(-historyLimit) };
}
