import { useMemo, useState } from 'react';
import type { Inductee, SortMode } from '../../data/types';

type ExploreViewProps = {
  inductees: Inductee[];
  facets: {
    regions: string[];
    years: number[];
  };
  loading: boolean;
  error: string;
  onSelect: (inductee: Inductee) => void;
};

const allValue = 'all';

export function ExploreView({ inductees, facets, loading, error, onSelect }: ExploreViewProps) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState(allValue);
  const [year, setYear] = useState(allValue);
  const [sortMode, setSortMode] = useState<SortMode>('year-asc');

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();

    return inductees
      .filter((item) => {
        const matchesSearch = !search || item.searchText.includes(search);
        const matchesRegion = region === allValue || item.region === region;
        const matchesYear = year === allValue || item.classYear === Number(year);
        return matchesSearch && matchesRegion && matchesYear;
      })
      .sort((a, b) => sortInductees(a, b, sortMode));
  }, [inductees, query, region, sortMode, year]);

  return (
    <section className="explore" aria-label="Explore inductees">
      <div className="controls" aria-label="Search and filters">
        <label className="field field--search">
          <span>Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, region, year, story, or inducer"
            type="search"
          />
        </label>

        <label className="field">
          <span>Region</span>
          <select value={region} onChange={(event) => setRegion(event.target.value)}>
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
          <select value={year} onChange={(event) => setYear(event.target.value)}>
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
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
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
  if (inductee.primaryImageUrl) {
    return <img className="inductee-card__image" src={inductee.primaryImageUrl} alt="" loading="lazy" />;
  }

  const initials = inductee.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');

  return <span className="inductee-card__fallback">{initials}</span>;
}

function summarize(text: string) {
  if (text.length <= 170) return text;
  return `${text.slice(0, 170).trim()}...`;
}

function sortInductees(a: Inductee, b: Inductee, sortMode: SortMode) {
  if (sortMode === 'name-asc') return a.name.localeCompare(b.name);
  if (sortMode === 'region-asc') return a.region.localeCompare(b.region) || a.name.localeCompare(b.name);

  const yearA = a.classYear ?? 9999;
  const yearB = b.classYear ?? 9999;

  if (sortMode === 'year-desc') return yearB - yearA || a.name.localeCompare(b.name);
  return yearA - yearB || a.name.localeCompare(b.name);
}
