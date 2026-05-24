import type { ExploreState, Inductee, MediaFilter, SortMode } from '../../data/types';
import { allValue } from '../../data/filtering';
import { FallbackImage, initials } from '../../components/FallbackImage';

type ExploreViewProps = {
  inductees: Inductee[];
  filtered: Inductee[];
  facets: {
    regions: string[];
    years: number[];
    themes: string[];
  };
  loading: boolean;
  error: string;
  state: ExploreState;
  onStateChange: (state: Partial<ExploreState>) => void;
  onSelect: (inductee: Inductee) => void;
};

export function ExploreView({ inductees, filtered, facets, loading, error, state, onStateChange, onSelect }: ExploreViewProps) {
  const visibleThemes = facets.themes.slice(0, 16);

  return (
    <section className="explore" aria-label="Explore inductees">
      <div className="controls" aria-label="Search and filters">
        <label className="field field--search">
          <span>Search</span>
          <input
            value={state.query}
            onChange={(event) => onStateChange({ query: event.target.value })}
            placeholder="Name, region, year, story, or inducer"
            type="search"
          />
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
            <option value="region-asc">Region</option>
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

      <ActiveFilters state={state} onStateChange={onStateChange} />

      <div className="result-line" aria-live="polite">
        {loading && 'Loading inductees...'}
        {error && `Data error: ${error}`}
        {!loading && !error && `${filtered.length} of ${inductees.length} inductees shown`}
      </div>

      <div className="inductee-grid">
        {filtered.map((inductee) => (
          <button className="inductee-card" key={inductee.id} type="button" onClick={() => onSelect(inductee)}>
            <MediaThumb inductee={inductee} />
            <span className="inductee-card__body">
              <span className="inductee-card__meta">
                <span>{inductee.classYear ?? 'Year unknown'}</span>
                <span>{inductee.region}</span>
              </span>
              <strong>{inductee.name}</strong>
              <span className="inductee-card__tags">
                {inductee.hasVideo && <span>Video</span>}
                {inductee.hasGallery && <span>Gallery</span>}
                {inductee.themeTags.slice(0, 2).map((theme) => (
                  <span key={theme}>{theme}</span>
                ))}
              </span>
              <span className="inductee-card__bio">{inductee.storySummary || summarize(inductee.bioText)}</span>
            </span>
          </button>
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

function ActiveFilters({
  state,
  onStateChange,
}: {
  state: ExploreState;
  onStateChange: (state: Partial<ExploreState>) => void;
}) {
  const activeFilters = [
    state.query ? { key: 'query', label: `Search: ${state.query}`, reset: () => onStateChange({ query: '' }) } : null,
    state.region !== allValue ? { key: 'region', label: `Region: ${state.region}`, reset: () => onStateChange({ region: allValue }) } : null,
    state.year !== allValue ? { key: 'year', label: `Year: ${state.year}`, reset: () => onStateChange({ year: allValue }) } : null,
    state.theme !== allValue ? { key: 'theme', label: `Theme: ${state.theme}`, reset: () => onStateChange({ theme: allValue }) } : null,
    state.media !== allValue ? { key: 'media', label: mediaLabel(state.media), reset: () => onStateChange({ media: 'all' }) } : null,
  ].filter((item): item is { key: string; label: string; reset: () => void } => Boolean(item));

  if (activeFilters.length === 0) return null;

  return (
    <div className="active-filters" aria-label="Active filters">
      {activeFilters.map((filter) => (
        <button key={filter.key} type="button" onClick={filter.reset}>
          <span>{filter.label}</span>
          <strong>Clear</strong>
        </button>
      ))}
      <button
        className="active-filters__reset"
        type="button"
        onClick={() => onStateChange({ query: '', region: allValue, year: allValue, theme: allValue, media: 'all' })}
      >
        Reset filters
      </button>
    </div>
  );
}

function mediaLabel(media: MediaFilter) {
  if (media === 'with-video') return 'Media: with video';
  if (media === 'with-gallery') return 'Media: image gallery';
  return 'Media: all';
}

function MediaThumb({ inductee }: { inductee: Inductee }) {
  return (
    <FallbackImage
      className="inductee-card__image"
      fallbackClassName="inductee-card__fallback"
      fallbackLabel={initials(inductee.name)}
      src={inductee.primaryImageUrl}
    />
  );
}

function summarize(text: string) {
  if (text.length <= 170) return text;
  return `${text.slice(0, 170).trim()}...`;
}
