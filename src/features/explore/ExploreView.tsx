import { useEffect, useMemo, useState } from 'react';
import type { ExploreState, Inductee, MediaFilter, SortMode } from '../../data/types';
import { allValue } from '../../data/filtering';
import { FallbackImage, initials } from '../../components/FallbackImage';
import { countryCommunityOrRegionLabel } from '../../data/inducteeLabels';

type ExploreViewProps = {
  inductees: Inductee[];
  filtered: Inductee[];
  facets: {
    regions: string[];
    countries: string[];
    years: number[];
    themes: string[];
  };
  loading: boolean;
  error: string;
  state: ExploreState;
  selectedId?: string;
  currentInductee?: Inductee | null;
  toolsDefaultOpen?: boolean;
  wallDebug?: boolean;
  onStateChange: (state: Partial<ExploreState>) => void;
  onSelect: (inductee: Inductee) => void;
  onFindConnection: () => void;
};

export function ExploreView({
  inductees,
  filtered,
  facets,
  loading,
  error,
  state,
  selectedId = '',
  currentInductee = null,
  toolsDefaultOpen = false,
  wallDebug = false,
  onStateChange,
  onSelect,
  onFindConnection,
}: ExploreViewProps) {
  const [toolsOpen, setToolsOpen] = useState(() => toolsDefaultOpen || hasActiveFilters(state));
  const [discoveryOffset, setDiscoveryOffset] = useState(0);
  const visibleThemes = facets.themes.slice(0, 14);
  const activeFilterCount = getActiveFilters(state, onStateChange).length;
  const discoveryPool = filtered.length > 1 ? filtered : inductees;
  const discoveryTarget = useMemo(
    () => pickDifferentInductee(discoveryPool, currentInductee, discoveryOffset),
    [currentInductee, discoveryOffset, discoveryPool],
  );

  useEffect(() => {
    if (toolsDefaultOpen || hasActiveFilters(state)) setToolsOpen(true);
  }, [state, toolsDefaultOpen]);

  function handleDiscover() {
    if (!discoveryTarget) return;
    setDiscoveryOffset((value) => value + 1);
    onSelect(discoveryTarget);
  }

  return (
    <section className="explore portrait-wall" aria-label="All people portrait wall">
      <div className="portrait-wall__mast">
        <div>
          <p className="museum-kicker">Cleveland International Hall of Fame</p>
          <h2>All People</h2>
        </div>

        <div className="portrait-wall__actions">
          <div className="portrait-wall__count" aria-live="polite">
            {loading && 'Loading'}
            {error && 'Data error'}
            {!loading && !error && `${filtered.length} of ${inductees.length} portraits`}
          </div>

          <button
            className="portrait-wall__connection-button"
            type="button"
            onClick={onFindConnection}
          >
            Find A Connection
          </button>

          <button
            className="portrait-wall__tool-button"
            type="button"
            aria-expanded={toolsOpen}
            aria-controls="all-people-tools"
            onClick={() => setToolsOpen((value) => !value)}
          >
            Search & Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>

          <button
            className="portrait-wall__discovery-button"
            type="button"
            disabled={!discoveryTarget || loading}
            onClick={handleDiscover}
          >
            Show Me Someone Different
          </button>
        </div>
      </div>

      {toolsOpen && (
        <div className="portrait-wall__tools" id="all-people-tools" aria-label="Search and filters">
          <div className="controls" aria-label="Search and filters">
            <label className="field field--search">
              <span>Search</span>
              <input
                value={state.query}
                onChange={(event) => onStateChange({ query: event.target.value })}
                placeholder="Name, country, community, year, story, or inducer"
                type="search"
              />
            </label>

            <label className="field">
              <span>Country</span>
              <select value={state.country} onChange={(event) => onStateChange({ country: event.target.value })}>
                <option value={allValue}>All countries</option>
                {facets.countries.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Region</span>
              <select value={state.region} onChange={(event) => onStateChange({ region: event.target.value })}>
                <option value={allValue}>All regions</option>
                {facets.regions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Year</span>
              <select value={state.year} onChange={(event) => onStateChange({ year: event.target.value })}>
                <option value={allValue}>All years</option>
                {facets.years.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Sort</span>
              <select value={state.sortMode} onChange={(event) => onStateChange({ sortMode: event.target.value as SortMode })}>
                <option value="year-asc">Year, oldest first</option>
                <option value="year-desc">Year, newest first</option>
                <option value="name-asc">Name</option>
                <option value="country-asc">Country</option>
                <option value="region-asc">Region</option>
                <option value="physical-wall">Physical wall order</option>
              </select>
            </label>
          </div>

          <div className="discovery-tools" aria-label="Discovery filters">
            <div className="media-toggle" aria-label="Media quick filters">
              {mediaOptions.map((option) => (
                <button
                  className={state.media === option.value ? 'filter-pill filter-pill--active' : 'filter-pill'}
                  key={option.value}
                  type="button"
                  onClick={() => onStateChange({ media: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {visibleThemes.length > 0 && (
              <div className="theme-chips" aria-label="Theme filters">
                <button
                  className={state.theme === allValue ? 'theme-chip theme-chip--active' : 'theme-chip'}
                  type="button"
                  onClick={() => onStateChange({ theme: allValue })}
                >
                  All themes
                </button>
                {visibleThemes.map((theme) => (
                  <button
                    className={state.theme === theme ? 'theme-chip theme-chip--active' : 'theme-chip'}
                    key={theme}
                    type="button"
                    onClick={() => onStateChange({ theme })}
                  >
                    {theme}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ActiveFilters state={state} onStateChange={onStateChange} />

      <div className={state.sortMode === 'physical-wall' ? 'portrait-wall__grid portrait-wall__grid--physical' : 'portrait-wall__grid'} aria-label="Portraits">
        {loading && <PortraitPlaceholders />}
        {!loading && error && <div className="portrait-wall__empty">Data error: {error}</div>}
        {!loading && !error && filtered.length === 0 && <div className="portrait-wall__empty">No portraits match the current filters.</div>}
        {!loading && !error && filtered.map((inductee) => (
          <PortraitTile
            inductee={inductee}
            key={inductee.id}
            selected={selectedId === inductee.id}
            wallDebug={wallDebug}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

const mediaOptions: Array<{ value: MediaFilter; label: string }> = [
  { value: 'all', label: 'All media' },
  { value: 'with-video', label: 'With video' },
  { value: 'with-gallery', label: 'Image gallery' },
];

function PortraitTile({
  inductee,
  selected,
  wallDebug,
  onSelect,
}: {
  inductee: Inductee;
  selected: boolean;
  wallDebug: boolean;
  onSelect: (inductee: Inductee) => void;
}) {
  const placeLabel = countryCommunityOrRegionLabel(inductee);
  const className = [
    'portrait-tile',
    selected ? 'portrait-tile--selected' : '',
    inductee.featured || inductee.featuredCandidate ? 'portrait-tile--featured' : '',
    hasWallMetadata(inductee) ? 'portrait-tile--wall-mapped' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      aria-current={selected ? 'true' : undefined}
      className={className}
      type="button"
      onClick={() => onSelect(inductee)}
    >
      <span className="portrait-tile__frame">
        <FallbackImage
          alt={inductee.imageAltText}
          className="portrait-tile__image"
          fallbackClassName="portrait-tile__fallback"
          fallbackLabel={initials(inductee.name)}
          src={inductee.primaryImageUrl}
        />
        {wallDebug && <WallDebugOverlay inductee={inductee} />}
      </span>
      <span className="portrait-tile__plaque">
        <strong>{inductee.name}</strong>
        <span className="portrait-tile__year">{inductee.classYear ? `Class of ${inductee.classYear}` : 'Year unknown'}</span>
        {placeLabel && <span className="portrait-tile__community">{placeLabel}</span>}
      </span>
    </button>
  );
}

function WallDebugOverlay({ inductee }: { inductee: Inductee }) {
  const position = [
    inductee.physicalPanel ? `Panel ${inductee.physicalPanel}` : '',
    inductee.physicalRow ? `R${inductee.physicalRow}` : '',
    inductee.physicalColumn ? `C${inductee.physicalColumn}` : '',
  ].filter(Boolean).join(' / ');
  const coordinates = inductee.wallCoordinates
    ? `X${formatCoordinate(inductee.wallCoordinates.x)} Y${formatCoordinate(inductee.wallCoordinates.y)}${inductee.wallCoordinates.unit ? ` ${inductee.wallCoordinates.unit}` : ''}`
    : '';

  return (
    <span className="portrait-tile__wall-debug" aria-hidden="true">
      <span>{position || 'No wall position'}</span>
      {inductee.wallLabel && <span>{inductee.wallLabel}</span>}
      {coordinates && <span>{coordinates}</span>}
      <span>{inductee.physicalPortraitPresent ? 'Portrait present' : 'Not marked present'}</span>
    </span>
  );
}

function PortraitPlaceholders() {
  return (
    <>
      {Array.from({ length: 18 }, (_, index) => (
        <div className="portrait-tile portrait-tile--placeholder" key={index} aria-hidden="true">
          <span className="portrait-tile__frame">
            <span className="portrait-tile__fallback">CIHOF</span>
          </span>
          <span className="portrait-tile__plaque">
            <strong>Loading</strong>
            <span className="portrait-tile__year">Portrait</span>
          </span>
        </div>
      ))}
    </>
  );
}

function ActiveFilters({
  state,
  onStateChange,
}: {
  state: ExploreState;
  onStateChange: (state: Partial<ExploreState>) => void;
}) {
  const activeFilters = getActiveFilters(state, onStateChange);

  if (activeFilters.length === 0) return null;

  return (
    <div className="portrait-wall__active-filters" aria-label="Active filters">
      {activeFilters.map((filter) => (
        <button key={filter.key} type="button" onClick={filter.reset}>
          <span>{filter.label}</span>
          <strong>Clear</strong>
        </button>
      ))}
      <button
        className="portrait-wall__reset-filters"
        type="button"
        onClick={() => onStateChange({ query: '', region: allValue, country: allValue, year: allValue, theme: allValue, media: 'all' })}
      >
        Reset filters
      </button>
    </div>
  );
}

function getActiveFilters(state: ExploreState, onStateChange: (state: Partial<ExploreState>) => void) {
  return [
    state.query ? { key: 'query', label: `Search: ${state.query}`, reset: () => onStateChange({ query: '' }) } : null,
    state.country !== allValue ? { key: 'country', label: `Country: ${state.country}`, reset: () => onStateChange({ country: allValue }) } : null,
    state.region !== allValue ? { key: 'region', label: `Region: ${state.region}`, reset: () => onStateChange({ region: allValue }) } : null,
    state.year !== allValue ? { key: 'year', label: `Year: ${state.year}`, reset: () => onStateChange({ year: allValue }) } : null,
    state.theme !== allValue ? { key: 'theme', label: `Theme: ${state.theme}`, reset: () => onStateChange({ theme: allValue }) } : null,
    state.media !== allValue ? { key: 'media', label: mediaLabel(state.media), reset: () => onStateChange({ media: 'all' }) } : null,
  ].filter((item): item is { key: string; label: string; reset: () => void } => Boolean(item));
}

function hasActiveFilters(state: ExploreState) {
  return Boolean(
    state.query ||
    state.country !== allValue ||
    state.region !== allValue ||
    state.year !== allValue ||
    state.theme !== allValue ||
    state.media !== allValue,
  );
}

function mediaLabel(media: MediaFilter) {
  if (media === 'with-video') return 'Media: with video';
  if (media === 'with-gallery') return 'Media: image gallery';
  return 'Media: all';
}

function hasWallMetadata(inductee: Inductee) {
  return Boolean(
    inductee.physicalPortraitPresent ||
      inductee.physicalRow ||
      inductee.physicalColumn ||
      inductee.physicalPanel ||
      inductee.wallLabel ||
      inductee.wallCoordinates,
  );
}

function formatCoordinate(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function pickDifferentInductee(pool: Inductee[], current: Inductee | null, offset: number) {
  const candidates = pool.filter((item) => item.id !== current?.id);
  if (candidates.length === 0) return null;

  if (!current) {
    return [...candidates].sort(discoveryDefaultSort)[offset % candidates.length];
  }

  const ranked = candidates
    .map((inductee) => ({ inductee, score: differenceScore(current, inductee) }))
    .sort((a, b) => b.score - a.score || discoveryDefaultSort(a.inductee, b.inductee));

  const topBand = ranked.slice(0, Math.min(12, ranked.length));
  return topBand[offset % topBand.length]?.inductee ?? ranked[0].inductee;
}

function differenceScore(current: Inductee, candidate: Inductee) {
  let score = 0;
  const sharedCountries = overlapCount(current.countryTags, candidate.countryTags);
  if (sharedCountries === 0) score += current.countryTags.length > 0 || candidate.countryTags.length > 0 ? 42 : 0;
  else score -= sharedCountries * 14;

  score += current.region && candidate.region && current.region !== candidate.region ? 28 : -8;

  const sharedCommunities = overlapCount(current.communityTags, candidate.communityTags);
  if (sharedCommunities === 0) score += current.communityTags.length > 0 || candidate.communityTags.length > 0 ? 28 : 8;
  else score -= sharedCommunities * 12;

  if (typeof current.classYear === 'number' && typeof candidate.classYear === 'number') {
    score += Math.min(Math.abs(current.classYear - candidate.classYear) / 3, 26);
  } else {
    score += 6;
  }

  const sharedThemes = overlapCount(current.themeTags, candidate.themeTags);
  score += sharedThemes === 0 ? 24 : Math.max(0, 12 - sharedThemes * 4);

  if (candidate.featured) score += 5;
  else if (candidate.featuredCandidate) score += 3;
  if (candidate.hasVideo) score += 1;

  return score;
}

function overlapCount(a: string[], b: string[]) {
  if (a.length === 0 || b.length === 0) return 0;
  const bSet = new Set(b);
  return a.filter((item) => bSet.has(item)).length;
}

function discoveryDefaultSort(a: Inductee, b: Inductee) {
  const priorityA = Number(a.featured) * 100 + Number(a.featuredCandidate) * 40 + a.attractPriority;
  const priorityB = Number(b.featured) * 100 + Number(b.featuredCandidate) * 40 + b.attractPriority;
  return priorityB - priorityA || a.name.localeCompare(b.name);
}
