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
  | { readonly kind: 'film'; readonly personId: string; readonly filmId: string };

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
  | { type: 'open-record'; personId: string }
  | { type: 'open-share'; personId: string }
  | { type: 'close-detail' }
  | { type: 'play-film'; personId: string; filmId: string }
  | { type: 'stop-film' }
  | { type: 'back' }
  | { type: 'reset' };

export const historyLimit = 24;

export function initialState(home: Mode = 'explore'): ExhibitState {
  return {
    home, mode: home, lens: 'people', selectedId: null, pair: null, arrangement: 'name', letter: null,
    detail: { kind: 'none' }, media: { kind: 'none' }, history: [],
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
      return remember(state, { lens: action.lens, pair: null, letter: null, detail: { kind: 'none' }, media: { kind: 'none' } });

    case 'select':
      if (state.selectedId === action.personId && state.pair === null) return state;
      return remember(state, { selectedId: action.personId, pair: null, detail: { kind: 'none' }, media: { kind: 'none' } });

    case 'clear-selection':
      if (state.selectedId === null && state.pair === null) return state;
      return remember(state, { selectedId: null, pair: null, detail: { kind: 'none' }, media: { kind: 'none' } });

    case 'pair': {
      const [a, b] = action.personIds;
      if (a === b) return state;
      return remember(state, { pair: [a, b], selectedId: null, detail: { kind: 'none' }, media: { kind: 'none' } });
    }

    case 'arrange':
      return state.arrangement === action.arrangement ? state : remember(state, { arrangement: action.arrangement, letter: null });

    case 'letter':
      return state.letter === action.letter ? state : { ...state, letter: action.letter };

    // A panel opens over whatever is playing and leaves it alone.
    case 'open-record':
      return remember(state, { selectedId: action.personId, pair: null, detail: { kind: 'record', personId: action.personId } });

    case 'open-share':
      return remember(state, { detail: { kind: 'share', personId: action.personId } });

    case 'close-detail':
      return state.detail.kind === 'none' ? state : { ...state, detail: { kind: 'none' } };

    case 'play-film':
      return remember(state, {
        selectedId: action.personId,
        pair: null,
        media: { kind: 'film', personId: action.personId, filmId: action.filmId },
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

function remember(state: ExhibitState, patch: Partial<Restorable>): ExhibitState {
  const { history, home: _home, mode: _mode, ...restorable } = state;
  return { ...state, ...patch, history: [...history, restorable].slice(-historyLimit) };
}
