import { useEffect, useMemo, useState } from 'react';
import type { Inductee, ManifestMap } from '../types';
import { getLocalImagesForInductee } from '../data/inductees';
import YearScrubber from './YearScrubber';
import RegionFilterChips from './RegionFilterChips';
import InducteeGrid from './InducteeGrid';
import InducteeModal from './InducteeModal';

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

const TimelineView = ({
  inductees,
  manifest,
  years,
  regions,
}: {
  inductees: Inductee[];
  manifest: ManifestMap;
  years: string[];
  regions: string[];
}) => {
  const latestYear = years[years.length - 1] ?? '';
  const [selectedYear, setSelectedYear] = useState(latestYear);
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeInductee, setActiveInductee] = useState<Inductee | null>(null);

  const debouncedSearch = useDebouncedValue(searchTerm, 200).toLowerCase();

  const filteredInductees = useMemo(() => {
    return inductees.filter((inductee) => {
      if (inductee.class_year !== selectedYear) {
        return false;
      }
      if (selectedRegion !== 'All' && inductee.region !== selectedRegion) {
        return false;
      }
      if (debouncedSearch && !inductee.name.toLowerCase().includes(debouncedSearch)) {
        return false;
      }
      return true;
    });
  }, [inductees, selectedYear, selectedRegion, debouncedSearch]);

  return (
    <div className="timeline-view">
      <header className="timeline-header">
        <div>
          <h1>Cleveland International Hall of Fame</h1>
          <p className="subtitle">Timeline View</p>
        </div>
        <div className="search-box">
          <label htmlFor="search">Search</label>
          <input
            id="search"
            type="text"
            placeholder="Search inductee name"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
      </header>

      <YearScrubber years={years} selectedYear={selectedYear} onSelectYear={setSelectedYear} />

      <RegionFilterChips
        regions={regions}
        selectedRegion={selectedRegion}
        onSelectRegion={setSelectedRegion}
      />

      <InducteeGrid
        inductees={filteredInductees}
        getImage={(inductee) =>
          getLocalImagesForInductee(inductee, manifest)[0] ?? PLACEHOLDER_IMAGE
        }
        onSelect={setActiveInductee}
      />

      {activeInductee && (
        <InducteeModal
          inductee={activeInductee}
          localImages={getLocalImagesForInductee(activeInductee, manifest)}
          placeholder={PLACEHOLDER_IMAGE}
          onClose={() => setActiveInductee(null)}
        />
      )}
    </div>
  );
};

export default TimelineView;
