import { useEffect, useMemo, useState } from 'react';
import { allValue, filterInductees } from '../data/filtering';
import { useDataFacets, useInductees } from '../data/useInductees';
import { ExploreView } from '../features/explore/ExploreView';
import { InducteeDetail } from '../features/inductee-detail/InducteeDetail';
import { TimelineView } from '../features/timeline/TimelineView';
import type { ExploreState, Inductee, SortMode, ViewMode } from '../data/types';

const defaultExploreState: ExploreState = {
  query: '',
  region: allValue,
  year: allValue,
  sortMode: 'year-asc',
};

export function App() {
  const { inductees, loading, error } = useInductees();
  const facets = useDataFacets(inductees);
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode());
  const [exploreState, setExploreState] = useState<ExploreState>(() => readExploreState());
  const [selectedId, setSelectedId] = useState<string>(() => readParam('person'));

  const selected = useMemo(
    () => inductees.find((item) => item.id === selectedId) ?? null,
    [inductees, selectedId],
  );

  const filtered = useMemo(() => filterInductees(inductees, exploreState), [exploreState, inductees]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (viewMode !== 'explore') params.set('view', viewMode);
    if (exploreState.query) params.set('q', exploreState.query);
    if (exploreState.region !== allValue) params.set('region', exploreState.region);
    if (exploreState.year !== allValue) params.set('year', exploreState.year);
    if (exploreState.sortMode !== defaultExploreState.sortMode) params.set('sort', exploreState.sortMode);
    if (selectedId) params.set('person', selectedId);

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
    window.history.replaceState(null, '', nextUrl);
  }, [exploreState, selectedId, viewMode]);

  const stats = useMemo(() => {
    const withImages = inductees.filter((item) => item.primaryImageUrl).length;
    const withVideo = inductees.filter((item) => item.youtubeVideoIds.length > 0 || item.localVideoPaths.length > 0).length;
    return { total: inductees.length, filtered: filtered.length, withImages, withVideo };
  }, [filtered.length, inductees]);

  function updateExploreState(nextState: Partial<ExploreState>) {
    setExploreState((current) => ({ ...current, ...nextState }));
  }

  function selectInductee(inductee: Inductee) {
    setSelectedId(inductee.id);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Cleveland International Hall of Fame</p>
          <h1>Inductee Explorer</h1>
        </div>
        <div className="topbar__stats" aria-label="Collection summary">
          <span>{stats.total} inductees</span>
          <span>{facets.regions.length} regions</span>
          <span>{stats.withVideo} videos</span>
        </div>
      </header>

      <nav className="view-tabs" aria-label="Views">
        <button className={viewMode === 'explore' ? 'view-tab view-tab--active' : 'view-tab'} type="button" onClick={() => setViewMode('explore')}>
          Explore
        </button>
        <button className={viewMode === 'timeline' ? 'view-tab view-tab--active' : 'view-tab'} type="button" onClick={() => setViewMode('timeline')}>
          Timeline
        </button>
      </nav>

      {viewMode === 'explore' ? (
        <ExploreView
          inductees={inductees}
          filtered={filtered}
          facets={facets}
          loading={loading}
          error={error}
          state={exploreState}
          onStateChange={updateExploreState}
          onSelect={selectInductee}
        />
      ) : (
        <TimelineView
          inductees={filtered}
          selectedYear={exploreState.year}
          onYearChange={(year) => updateExploreState({ year })}
          onSelect={selectInductee}
        />
      )}

      <InducteeDetail
        inductee={selected}
        allInductees={inductees}
        onClose={() => setSelectedId('')}
        onSelect={selectInductee}
      />
    </main>
  );
}

function readParam(name: string) {
  return new URLSearchParams(window.location.search).get(name) ?? '';
}

function readViewMode(): ViewMode {
  return readParam('view') === 'timeline' ? 'timeline' : 'explore';
}

function readExploreState(): ExploreState {
  const sort = readParam('sort') as SortMode;
  const sortMode: SortMode = ['year-asc', 'year-desc', 'name-asc', 'region-asc'].includes(sort) ? sort : 'year-asc';

  return {
    query: readParam('q'),
    region: readParam('region') || allValue,
    year: readParam('year') || allValue,
    sortMode,
  };
}
