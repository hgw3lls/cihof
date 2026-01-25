import { useEffect, useMemo, useState } from 'react';
import type { Inductee } from '../../data/types';
import RegionFilterChips from '../../components/RegionFilterChips';
import InducteeGrid from '../../components/InducteeGrid';
import InducteeDetailModal from '../../components/InducteeDetailModal';

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='500'%3E%3Crect width='100%25' height='100%25' fill='%23252c37'/%3E%3Ctext x='50%25' y='50%25' font-size='28' fill='%23d9dee8' text-anchor='middle' dominant-baseline='middle'%3EPhoto%20Unavailable%3C/text%3E%3C/svg%3E";

const useDebouncedValue = (value: string, delayMs: number) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};

type SortMode = 'year_desc' | 'name_asc';

const normalizeValue = (value: string) => value.trim().toLowerCase();

const ExploreView = ({
  inductees,
  regions,
  years,
}: {
  inductees: Inductee[];
  regions: string[];
  years: string[];
}) => {
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('year_desc');
  const [visibleCount, setVisibleCount] = useState(24);
  const [activeInductee, setActiveInductee] = useState<Inductee | null>(null);

  const debouncedSearch = useDebouncedValue(searchTerm, 200).toLowerCase();
  const sortedYears = useMemo(
    () => [...years].sort((a, b) => Number(b) - Number(a)),
    [years],
  );

  useEffect(() => {
    document.body.classList.add('explore-brutalist-root');
    return () => {
      document.body.classList.remove('explore-brutalist-root');
    };
  }, []);

  const filteredInductees = useMemo(() => {
    const normalizedRegion = normalizeValue(selectedRegion);
    return inductees.filter((inductee) => {
      if (selectedRegion !== 'All' && normalizeValue(inductee.region) !== normalizedRegion) {
        return false;
      }
      if (selectedYear !== 'All' && inductee.class_year !== selectedYear) {
        return false;
      }
      if (debouncedSearch) {
        const haystack = `${inductee.name} ${inductee.bio_text ?? ''}`.toLowerCase();
        if (!haystack.includes(debouncedSearch)) {
          return false;
        }
      }
      return true;
    });
  }, [inductees, selectedRegion, selectedYear, debouncedSearch]);

  const sortedInductees = useMemo(() => {
    const list = [...filteredInductees];
    list.sort((a, b) => {
      if (sortMode === 'name_asc') {
        return a.name.localeCompare(b.name);
      }
      const yearA = Number(a.class_year);
      const yearB = Number(b.class_year);
      if (yearA !== yearB) {
        return yearB - yearA;
      }
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [filteredInductees, sortMode]);

  useEffect(() => {
    setVisibleCount(24);
  }, [selectedRegion, selectedYear, debouncedSearch, sortMode]);

  const displayedInductees = sortedInductees.slice(0, visibleCount);
  const resultsCount = sortedInductees.length;

  const handleReset = () => {
    setSelectedRegion('All');
    setSelectedYear('All');
    setSearchTerm('');
    setSortMode('year_desc');
  };

  return (
    <div className="explore-view explore-brutalist">
      <header className="explore-top-bar">
        <div className="explore-top-bar__title">
          <h1>CIHOF / EXPLORE</h1>
          <p>Discovery mode</p>
        </div>
        <div className="explore-top-bar__status" aria-live="polite">
          <strong>{resultsCount}</strong>
          <span>Results</span>
        </div>
        <div className="explore-top-bar__actions">
          <button onClick={handleReset}>Reset Filters</button>
        </div>
      </header>

      <section className="explore-filter-strip">
        <div className="filter-block filter-block--search">
          <label htmlFor="explore-search">Search</label>
          <input
            id="explore-search"
            type="text"
            placeholder="Search name or biography"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <div className="filter-block filter-block--regions">
          <span className="filter-label">Region</span>
          <div className="filter-scroll">
            <RegionFilterChips
              regions={regions}
              selectedRegion={selectedRegion}
              onSelectRegion={setSelectedRegion}
            />
          </div>
        </div>
        <div className="filter-block">
          <label htmlFor="explore-year">Year</label>
          <select
            id="explore-year"
            value={selectedYear}
            onChange={(event) => setSelectedYear(event.target.value)}
          >
            {['All', ...sortedYears].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-block">
          <label htmlFor="explore-sort">Sort</label>
          <select
            id="explore-sort"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
          >
            <option value="year_desc">Year desc → Name</option>
            <option value="name_asc">Name A–Z</option>
          </select>
        </div>
      </section>

      <section className="explore-content">
        <div className="explore-grid-pane">
          <div className="explore-grid-scroll">
            <InducteeGrid
              inductees={displayedInductees}
              getImage={(inductee) => inductee.primaryImage ?? PLACEHOLDER_IMAGE}
              onSelect={setActiveInductee}
              showYear
            />

            {sortedInductees.length > displayedInductees.length && (
              <div className="load-more">
                <button onClick={() => setVisibleCount((count) => count + 24)}>Load more</button>
              </div>
            )}
          </div>
        </div>
      </section>

      {activeInductee && (
        <InducteeDetailModal
          inductee={activeInductee}
          placeholder={PLACEHOLDER_IMAGE}
          onClose={() => setActiveInductee(null)}
        />
      )}
    </div>
  );
};

export default ExploreView;
