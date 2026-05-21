import type { ExploreState, Inductee, SortMode } from '../../data/types';
import { allValue } from '../../data/filtering';
import { FallbackImage, initials } from '../../components/FallbackImage';

type ExploreViewProps = {
  inductees: Inductee[];
  filtered: Inductee[];
  facets: {
    regions: string[];
    years: number[];
  };
  loading: boolean;
  error: string;
  state: ExploreState;
  onStateChange: (state: Partial<ExploreState>) => void;
  onSelect: (inductee: Inductee) => void;
};

export function ExploreView({ inductees, filtered, facets, loading, error, state, onStateChange, onSelect }: ExploreViewProps) {
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
              <span className="inductee-card__bio">{summarize(inductee.bioText)}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
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
