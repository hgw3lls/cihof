import { useCallback, useEffect, useMemo, useReducer } from 'react';
import {
  createInitialExhibitState,
  exhibitReducer,
  serializeExhibitUrl,
  type ExhibitDetail,
  type ExhibitFacets,
  type ExhibitGrouping,
  type ExhibitLens,
  type ExhibitMedia,
  type ExhibitViewport,
  type PeopleSort,
  type TimeMode,
} from './exhibitState';

// Start over ends any staff session as well. Installation flags survive it;
// the admin flag must not, or a later reload reopens the staff panel for the
// next visitor.
const retainedResetParams = ['kiosk', 'reach'];

function resetSessionState(dispatch: (action: { type: 'reset' }) => void) {
  const current = new URLSearchParams(location.search);
  const params = new URLSearchParams();
  for (const key of retainedResetParams) {
    if (current.get(key) === '1') params.set(key, '1');
  }
  window.history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}`);
  dispatch({ type: 'reset' });
}

export function useExhibitController() {
  const [state, dispatch] = useReducer(exhibitReducer, undefined, () => createInitialExhibitState(location.search));

  useEffect(() => {
    const query = serializeExhibitUrl(state, location.search);
    const next = `${location.pathname}${query ? `?${query}` : ''}${location.hash}`;
    if (`${location.pathname}${location.search}${location.hash}` !== next) window.history.replaceState(null, '', next);
  }, [state]);

  useEffect(() => {
    const onPopState = () => dispatch({ type: 'replace-from-url', state: createInitialExhibitState(location.search) });
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const actions = useMemo(() => ({
    setLens: (lens: ExhibitLens) => dispatch({ type: 'set-lens', lens }),
    setGrouping: (grouping: ExhibitGrouping) => dispatch({ type: 'set-grouping', grouping }),
    selectPerson: (personId: string, detail?: ExhibitDetail, media?: ExhibitMedia) => dispatch({ type: 'select-person', personId, detail, media }),
    clearSelection: () => dispatch({ type: 'clear-selection' }),
    setQuery: (query: string) => dispatch({ type: 'set-query', query }),
    setFacet: (dimension: keyof ExhibitFacets, values: string[]) => dispatch({ type: 'set-facet', dimension, values }),
    clearFilters: () => dispatch({ type: 'clear-filters' }),
    setSort: (sort: PeopleSort) => dispatch({ type: 'set-sort', sort }),
    setComparison: (personIds: [] | [string] | [string, string]) => dispatch({ type: 'set-comparison', personIds }),
    setPlace: (placeId: string) => dispatch({ type: 'set-place', placeId }),
    setTimeMode: (mode: TimeMode) => dispatch({ type: 'set-time-mode', mode }),
    setTimeRange: (from: number | null, to: number | null) => dispatch({ type: 'set-time-range', from, to }),
    openDetail: (detail: ExhibitDetail) => dispatch({ type: 'open-detail', detail }),
    setDetail: (detail: ExhibitDetail) => dispatch({ type: 'set-detail', detail }),
    closeDetail: () => dispatch({ type: 'close-detail' }),
    setMedia: (media: ExhibitMedia) => dispatch({ type: 'set-media', media }),
    closeMedia: () => dispatch({ type: 'close-media' }),
    setLinkFocus: (personId: string) => dispatch({ type: 'set-link-focus', personId }),
    captureViewport: (lens: ExhibitLens, viewport: ExhibitViewport) => dispatch({ type: 'capture-viewport', lens, viewport }),
    back: () => dispatch({ type: 'back' }),
    backSelection: () => dispatch({ type: 'back-selection' }),
    reset: () => resetSessionState(dispatch),
  }), []);

  const reset = useCallback(() => resetSessionState(dispatch), []);
  return { state, actions, reset };
}
