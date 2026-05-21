import { useEffect, useMemo, useState } from 'react';
import { allValue, filterInductees } from '../data/filtering';
import { useDataFacets, useInductees } from '../data/useInductees';
import { AttractView } from '../features/attract/AttractView';
import { ExploreView } from '../features/explore/ExploreView';
import { InducteeDetail } from '../features/inductee-detail/InducteeDetail';
import { RegionMapView } from '../features/region-map/RegionMapView';
import { TimelineView } from '../features/timeline/TimelineView';
import type { ExploreState, Inductee, SortMode, ViewMode } from '../data/types';

const defaultExploreState: ExploreState = {
  query: '',
  region: allValue,
  year: allValue,
  sortMode: 'year-asc',
};

const kioskIdleMs = 120_000;

export function App() {
  const { inductees, loading, error } = useInductees();
  const facets = useDataFacets(inductees);
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode());
  const [exploreState, setExploreState] = useState<ExploreState>(() => readExploreState());
  const [selectedId, setSelectedId] = useState<string>(() => readParam('person'));
  const [kioskMode, setKioskMode] = useState(() => readParam('kiosk') === '1');
  const [attractActive, setAttractActive] = useState(false);

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
    if (kioskMode) params.set('kiosk', '1');

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
    window.history.replaceState(null, '', nextUrl);
  }, [exploreState, kioskMode, selectedId, viewMode]);

  useEffect(() => {
    if (!kioskMode) return;

    const showAttract = () => {
      resetExperience();
      setAttractActive(true);
    };
    let timeout = window.setTimeout(showAttract, kioskIdleMs);
    const resetTimer = () => {
      if (attractActive) return;
      window.clearTimeout(timeout);
      timeout = window.setTimeout(showAttract, kioskIdleMs);
    };

    window.addEventListener('pointerdown', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('touchstart', resetTimer);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('pointerdown', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
    };
  }, [attractActive, kioskMode]);

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

  function resetExperience() {
    setExploreState(defaultExploreState);
    setSelectedId('');
    setViewMode('explore');
    setAttractActive(false);
  }

  function startFromAttract() {
    setAttractActive(false);
    resetExperience();
  }

  return (
    <main className={kioskMode ? 'app-shell app-shell--kiosk' : 'app-shell'}>
      <header className="topbar">
        <div>
          <p className="eyebrow">Cleveland International Hall of Fame</p>
          <h1>Inductee Explorer</h1>
        </div>
        <div className="topbar__actions">
          <div className="topbar__stats" aria-label="Collection summary">
            <span>{stats.total} inductees</span>
            <span>{facets.regions.length} regions</span>
            <span>{stats.withVideo} videos</span>
          </div>
          <div className="topbar__buttons">
            <button className={kioskMode ? 'kiosk-button kiosk-button--active' : 'kiosk-button'} type="button" onClick={() => setKioskMode((value) => !value)}>
              Kiosk {kioskMode ? 'On' : 'Off'}
            </button>
            <button className="home-button" type="button" onClick={resetExperience}>
              Reset
            </button>
          </div>
        </div>
      </header>

      <nav className="view-tabs" aria-label="Views">
        <button className={viewMode === 'explore' ? 'view-tab view-tab--active' : 'view-tab'} type="button" onClick={() => setViewMode('explore')}>
          Explore
        </button>
        <button className={viewMode === 'timeline' ? 'view-tab view-tab--active' : 'view-tab'} type="button" onClick={() => setViewMode('timeline')}>
          Timeline
        </button>
        <button className={viewMode === 'region-map' ? 'view-tab view-tab--active' : 'view-tab'} type="button" onClick={() => setViewMode('region-map')}>
          Regions
        </button>
      </nav>

      {kioskMode && <div className="kiosk-status">Kiosk mode shows featured stories after 2 minutes idle</div>}

      {viewMode === 'explore' && (
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
      )}

      {viewMode === 'timeline' && (
        <TimelineView
          inductees={filtered}
          selectedYear={exploreState.year}
          onYearChange={(year) => updateExploreState({ year })}
          onSelect={selectInductee}
        />
      )}

      {viewMode === 'region-map' && (
        <RegionMapView
          inductees={filtered}
          allInductees={inductees}
          selectedRegion={exploreState.region}
          onRegionChange={(region) => updateExploreState({ region })}
          onSelect={selectInductee}
        />
      )}

      {kioskMode && attractActive && <AttractView inductees={inductees} onStart={startFromAttract} />}

      <InducteeDetail
        inductee={attractActive ? null : selected}
        allInductees={inductees}
        kioskMode={kioskMode}
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
  const view = readParam('view');
  if (view === 'timeline' || view === 'region-map') return view;
  return 'explore';
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
