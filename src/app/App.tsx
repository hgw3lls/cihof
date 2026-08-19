import { useEffect, useMemo, useRef, useState } from 'react';
import { allValue, filterInductees } from '../data/filtering';
import { useDataFacets, useInductees } from '../data/useInductees';
import { useRelationships } from '../data/useRelationships';
import { AttractView } from '../features/attract/AttractView';
import { ConnectionFinder } from '../features/connections/ConnectionFinder';
import { ExploreView } from '../features/explore/ExploreView';
import { InducteeDetail } from '../features/inductee-detail/InducteeDetail';
import { JourneyView } from '../features/journeys/JourneyView';
import { PlacesView } from '../features/places/PlacesView';
import { ReviewDashboardView } from '../features/review-dashboard/ReviewDashboardView';
import { SearchView } from '../features/search/SearchView';
import { TimelineView } from '../features/timeline/TimelineView';
import { onPhysicalPortraitSelected, physicalPortraitSelectionFromInductee } from '../integrations/physicalPortrait';
import type { ExploreState, Inductee, MediaFilter, SortMode, ViewMode } from '../data/types';

const defaultExploreState: ExploreState = {
  query: '',
  region: allValue,
  country: allValue,
  year: allValue,
  theme: allValue,
  media: 'all',
  sortMode: 'year-asc',
};

const kioskIdleMs = 120_000;
const kioskResetWarningMs = 12_000;
const contentProtectionActive = import.meta.env.PROD;
const primaryNavItems: Array<{ mode: ViewMode; label: string }> = [
  { mode: 'all-people', label: 'All People' },
  { mode: 'time', label: 'Time' },
  { mode: 'places', label: 'Places' },
  { mode: 'journeys', label: 'Journeys' },
  { mode: 'search', label: 'Search' },
];

export function App() {
  const { inductees, loading, error } = useInductees();
  const { relationships } = useRelationships();
  const facets = useDataFacets(inductees);
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode());
  const [exploreState, setExploreState] = useState<ExploreState>(() => readExploreState());
  const [timelineYear, setTimelineYear] = useState<string>(() => readTimelineYear());
  const [selectedId, setSelectedId] = useState<string>(() => readParam('person'));
  const [lastSeenId, setLastSeenId] = useState<string>(() => readParam('person'));
  const [kioskMode, setKioskMode] = useState(() => readParam('kiosk') === '1');
  const [attractActive, setAttractActive] = useState(false);
  const [idleWarningActive, setIdleWarningActive] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [connectionSeedId, setConnectionSeedId] = useState('');
  const [connectionReturnId, setConnectionReturnId] = useState('');
  const scrollPositionRef = useRef({ left: 0, top: 0 });
  const reviewModeEnabled = readParam('review') === '1';
  const wallDebugEnabled = readParam('wallDebug') === '1' || readParam('debugWall') === '1';
  const shellClassName = [
    'app-shell',
    'museum-shell',
    kioskMode ? 'app-shell--kiosk' : '',
    wallDebugEnabled ? 'app-shell--wall-debug' : '',
    viewMode === 'review' ? 'museum-shell--staff' : '',
    contentProtectionActive ? 'app-shell--protected' : '',
  ].filter(Boolean).join(' ');
  const stageClassName = ['museum-stage', `museum-stage--${viewMode}`].join(' ');

  const selected = useMemo(
    () => inductees.find((item) => item.id === selectedId) ?? null,
    [inductees, selectedId],
  );
  const lastSeen = useMemo(
    () => inductees.find((item) => item.id === lastSeenId) ?? null,
    [inductees, lastSeenId],
  );
  const connectionSeed = useMemo(
    () => inductees.find((item) => item.id === connectionSeedId) ?? null,
    [connectionSeedId, inductees],
  );
  const connectionReturn = useMemo(
    () => inductees.find((item) => item.id === connectionReturnId) ?? null,
    [connectionReturnId, inductees],
  );

  const filtered = useMemo(() => filterInductees(inductees, exploreState), [exploreState, inductees]);
  const selectedIndex = selected ? filtered.findIndex((item) => item.id === selected.id) : -1;
  const previousInductee = selectedIndex > 0 ? filtered[selectedIndex - 1] : filtered[filtered.length - 1];
  const nextInductee = selectedIndex >= 0 ? filtered[(selectedIndex + 1) % filtered.length] : null;

  useEffect(() => {
    const params = new URLSearchParams();
    if (viewMode !== 'all-people') params.set('view', viewMode);
    if (exploreState.query) params.set('q', exploreState.query);
    if (exploreState.region !== allValue) params.set('region', exploreState.region);
    if (exploreState.country !== allValue) params.set('country', exploreState.country);
    if (viewMode !== 'time' && exploreState.year !== allValue) params.set('year', exploreState.year);
    if (viewMode === 'time' && timelineYear) params.set('timeYear', timelineYear);
    if (exploreState.theme !== allValue) params.set('theme', exploreState.theme);
    if (exploreState.media !== defaultExploreState.media) params.set('media', exploreState.media);
    if (exploreState.sortMode !== defaultExploreState.sortMode) params.set('sort', exploreState.sortMode);
    if (selectedId) params.set('person', selectedId);
    if (kioskMode) params.set('kiosk', '1');
    if (reviewModeEnabled) params.set('review', '1');
    if (wallDebugEnabled) params.set('wallDebug', '1');

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
    window.history.replaceState(null, '', nextUrl);
  }, [exploreState, kioskMode, reviewModeEnabled, selectedId, timelineYear, viewMode, wallDebugEnabled]);

  useEffect(() => {
    if (!kioskMode || viewMode === 'review') return;

    const warningDelay = Math.max(kioskIdleMs - kioskResetWarningMs, 0);
    let warningTimeout = window.setTimeout(() => {
      setIdleWarningActive(true);
    }, warningDelay);
    const showAttract = () => {
      setIdleWarningActive(false);
      resetExperience();
      setAttractActive(true);
    };
    let timeout = window.setTimeout(showAttract, kioskIdleMs);
    const resetTimer = () => {
      if (attractActive) return;
      setIdleWarningActive(false);
      window.clearTimeout(warningTimeout);
      window.clearTimeout(timeout);
      warningTimeout = window.setTimeout(() => {
        setIdleWarningActive(true);
      }, warningDelay);
      timeout = window.setTimeout(showAttract, kioskIdleMs);
    };

    window.addEventListener('pointerdown', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('touchstart', resetTimer);

    return () => {
      window.clearTimeout(warningTimeout);
      window.clearTimeout(timeout);
      window.removeEventListener('pointerdown', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
    };
  }, [attractActive, kioskMode, viewMode]);

  useContentProtection(viewMode !== 'review');

  const stats = useMemo(() => {
    const withImages = inductees.filter((item) => item.primaryImageUrl).length;
    const withVideo = inductees.filter((item) => item.hasVideo).length;
    return { total: inductees.length, filtered: filtered.length, withImages, withVideo };
  }, [filtered.length, inductees]);

  function updateExploreState(nextState: Partial<ExploreState>) {
    setExploreState((current) => ({ ...current, ...nextState }));
  }

  function selectInductee(inductee: Inductee) {
    stopActiveMedia();
    onPhysicalPortraitSelected(inductee.id, physicalPortraitSelectionFromInductee(inductee));
    setAttractActive(false);
    setIdleWarningActive(false);
    scrollPositionRef.current = { left: window.scrollX, top: window.scrollY };
    setLastSeenId(inductee.id);
    setSelectedId(inductee.id);
  }

  function resetExperience() {
    stopActiveMedia();
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    setExploreState({ ...defaultExploreState });
    setTimelineYear('');
    setSelectedId('');
    setLastSeenId('');
    setViewMode('all-people');
    setAttractActive(false);
    setIdleWarningActive(false);
    setConnectionOpen(false);
    setConnectionSeedId('');
    setConnectionReturnId('');
  }

  function closeDetail() {
    stopActiveMedia();
    setSelectedId('');
    setIdleWarningActive(false);
    window.requestAnimationFrame(() => {
      window.scrollTo({ left: scrollPositionRef.current.left, top: scrollPositionRef.current.top, behavior: 'auto' });
    });
  }

  function returnHome() {
    stopActiveMedia();
    setAttractActive(false);
    setIdleWarningActive(false);
    setSelectedId('');
    setConnectionOpen(false);
    setConnectionSeedId('');
    setViewMode('all-people');
    window.requestAnimationFrame(() => {
      window.scrollTo({ left: scrollPositionRef.current.left, top: scrollPositionRef.current.top, behavior: 'auto' });
    });
  }

  function openConnectionFinder(seed?: Inductee) {
    stopActiveMedia();
    setAttractActive(false);
    setIdleWarningActive(false);
    setConnectionSeedId(seed?.id ?? '');
    setConnectionReturnId(selectedId || seed?.id || lastSeenId);
    setConnectionOpen(true);
  }

  function closeConnectionFinder() {
    setConnectionOpen(false);
    setConnectionSeedId('');
  }

  function selectFromConnection(inductee: Inductee) {
    setConnectionOpen(false);
    selectInductee(inductee);
  }

  function startFromAttract() {
    setAttractActive(false);
    resetExperience();
  }

  function continueExploring() {
    setIdleWarningActive(false);
    setAttractActive(false);
  }

  return (
    <main className={shellClassName}>
      <header className="museum-rail" aria-label="Collection status">
        <div className="museum-brand">
          <span>CIHOF</span>
          <strong>Portrait Wall</strong>
        </div>
        <div className="museum-status" aria-label="Collection summary">
          <span>{stats.total} people</span>
          <span>{stats.withVideo} videos</span>
          {kioskMode && <span>Kiosk</span>}
          {wallDebugEnabled && <span>Wall Debug</span>}
        </div>
        <div className="museum-utilities">
          <button className={kioskMode ? 'kiosk-button kiosk-button--active' : 'kiosk-button'} type="button" onClick={() => setKioskMode((value) => !value)}>
            Kiosk {kioskMode ? 'On' : 'Off'}
          </button>
          <button className="home-button" type="button" onClick={resetExperience}>
            Reset
          </button>
        </div>
      </header>

      <section className={stageClassName}>
        {viewMode === 'all-people' && (
          <ExploreView
            inductees={inductees}
            filtered={filtered}
            facets={facets}
            loading={loading}
            error={error}
            state={exploreState}
            selectedId={selectedId}
            currentInductee={selected ?? lastSeen}
            wallDebug={wallDebugEnabled}
            onStateChange={updateExploreState}
            onSelect={selectInductee}
            onFindConnection={() => openConnectionFinder()}
          />
        )}

        {viewMode === 'search' && (
          <SearchView
            inductees={inductees}
            facets={facets}
            loading={loading}
            error={error}
            state={exploreState}
            selectedId={selectedId}
            onStateChange={updateExploreState}
            onSelect={selectInductee}
            onFindConnection={() => openConnectionFinder()}
          />
        )}

        {viewMode === 'time' && (
          <TimelineView
            inductees={inductees}
            loading={loading}
            error={error}
            selectedYear={timelineYear}
            onYearChange={setTimelineYear}
            onSelect={selectInductee}
          />
        )}

        {viewMode === 'places' && <PlacesView inductees={inductees} onSelect={selectInductee} />}

        {viewMode === 'journeys' && <JourneyView inductees={inductees} onSelect={selectInductee} />}

        {viewMode === 'review' && reviewModeEnabled && <ReviewDashboardView inductees={inductees} onSelect={selectInductee} />}
      </section>

      {viewMode !== 'review' && (
        <nav className="museum-bottom-nav" aria-label="Museum navigation">
          {primaryNavItems.map((item) => (
            <button
              aria-current={viewMode === item.mode ? 'page' : undefined}
              className={viewMode === item.mode ? 'museum-nav-item museum-nav-item--active' : 'museum-nav-item'}
              key={item.mode}
              type="button"
              onClick={() => setViewMode(item.mode)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}

      {kioskMode && idleWarningActive && !attractActive && (
        <section className="idle-warning" aria-label="Idle reset warning" onPointerDown={continueExploring}>
          <div className="idle-warning__panel">
            <p className="museum-kicker">Session Reset</p>
            <h2>CONTINUE EXPLORING?</h2>
            <span>Touch anywhere to stay here.</span>
          </div>
        </section>
      )}

      {kioskMode && attractActive && (
        <AttractView
          inductees={inductees}
          relationships={relationships}
          onStart={startFromAttract}
          onSelect={selectInductee}
        />
      )}

      <InducteeDetail
        inductee={attractActive ? null : selected}
        allInductees={inductees}
        relationships={relationships}
        kioskMode={kioskMode}
        nextInductee={nextInductee}
        previousInductee={previousInductee}
        wallDebug={wallDebugEnabled}
        onClose={closeDetail}
        onHome={returnHome}
        onReset={resetExperience}
        onSelect={selectInductee}
        onFindConnection={openConnectionFinder}
      />

      <ConnectionFinder
        open={connectionOpen}
        inductees={inductees}
        relationships={relationships}
        seedPerson={connectionSeed}
        returnPerson={connectionReturn}
        onClose={closeConnectionFinder}
        onSelectPerson={selectFromConnection}
      />
    </main>
  );
}

function useContentProtection(active: boolean) {
  useEffect(() => {
    if (!contentProtectionActive || !active) return undefined;

    function shouldAllowCopyTarget(target: EventTarget | null) {
      return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
    }

    function blockEvent(event: Event) {
      if (shouldAllowCopyTarget(event.target)) return;
      event.preventDefault();
    }

    function blockShortcut(event: KeyboardEvent) {
      if (shouldAllowCopyTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      const blockedModifiedKeys = new Set(['a', 'c', 'p', 's', 'u']);
      const blockedDevToolsKeys = new Set(['c', 'i', 'j']);

      if (event.key === 'F12' || (modifier && blockedModifiedKeys.has(key)) || (modifier && event.shiftKey && blockedDevToolsKeys.has(key))) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    document.addEventListener('contextmenu', blockEvent);
    document.addEventListener('copy', blockEvent);
    document.addEventListener('cut', blockEvent);
    document.addEventListener('dragstart', blockEvent);
    document.addEventListener('selectstart', blockEvent);
    document.addEventListener('keydown', blockShortcut, { capture: true });

    return () => {
      document.removeEventListener('contextmenu', blockEvent);
      document.removeEventListener('copy', blockEvent);
      document.removeEventListener('cut', blockEvent);
      document.removeEventListener('dragstart', blockEvent);
      document.removeEventListener('selectstart', blockEvent);
      document.removeEventListener('keydown', blockShortcut, { capture: true });
    };
  }, [active]);
}

function readParam(name: string) {
  return new URLSearchParams(window.location.search).get(name) ?? '';
}

function readViewMode(): ViewMode {
  const view = readParam('view');
  if (view === 'review' && readParam('review') === '1') return view;
  if (view === 'time' || view === 'timeline') return 'time';
  if (view === 'places' || view === 'region-map') return 'places';
  if (view === 'journeys') return 'journeys';
  if (view === 'search' || view === 'explore') return 'search';
  return 'all-people';
}

function readExploreState(): ExploreState {
  const sort = readParam('sort') as SortMode;
  const media = readParam('media') as MediaFilter;
  const view = readParam('view');
  const isTimelineRoute = view === 'time' || view === 'timeline';
  const sortMode: SortMode = ['year-asc', 'year-desc', 'name-asc', 'country-asc', 'region-asc', 'physical-wall'].includes(sort) ? sort : 'year-asc';
  const mediaMode: MediaFilter = ['with-video', 'with-gallery'].includes(media) ? media : 'all';

  return {
    query: readParam('q'),
    region: readParam('region') || allValue,
    country: readParam('country') || allValue,
    year: isTimelineRoute ? allValue : readParam('year') || allValue,
    theme: readParam('theme') || allValue,
    media: mediaMode,
    sortMode,
  };
}

function readTimelineYear() {
  const view = readParam('view');
  if (view !== 'time' && view !== 'timeline') return '';
  return readParam('timeYear') || readParam('year');
}

function stopActiveMedia() {
  document.querySelectorAll('video, audio').forEach((media) => {
    if (!(media instanceof HTMLMediaElement)) return;
    media.pause();
    media.currentTime = 0;
  });
  document.querySelectorAll('iframe').forEach((frame) => {
    frame.src = frame.src;
  });
  window.dispatchEvent(new Event('cihof:stop-media'));
}
