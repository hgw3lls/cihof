import { useEffect, useMemo, useState } from 'react';
import type { Inductee } from '../../data/types';
import BrutalistTopBar from './BrutalistTopBar';
import ContextPane from './ContextPane';
import InducteePane from './InducteePane';
import TimelineStrip from './TimelineStrip';

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
  years,
  regions,
}: {
  inductees: Inductee[];
  years: string[];
  regions: string[];
}) => {
  const latestYear = years[years.length - 1] ?? '';
  const [selectedYear, setSelectedYear] = useState(latestYear);
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeInductee, setActiveInductee] = useState<Inductee | null>(null);

  useEffect(() => {
    document.documentElement.classList.add('timeline-brutalist-root');
    return () => {
      document.documentElement.classList.remove('timeline-brutalist-root');
    };
  }, []);

  useEffect(() => {
    if (!selectedYear && latestYear) {
      setSelectedYear(latestYear);
    }
  }, [latestYear, selectedYear]);

  const debouncedSearch = useDebouncedValue(searchTerm, 200).toLowerCase();

  const filteredInductees = useMemo(() => {
    return inductees.filter((inductee) => {
      if (selectedYear && inductee.class_year !== selectedYear) {
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

  const yearInductees = useMemo(() => {
    return inductees.filter((inductee) => inductee.class_year === selectedYear);
  }, [inductees, selectedYear]);

  useEffect(() => {
    if (!activeInductee) {
      return;
    }
    const stillVisible = filteredInductees.some(
      (inductee) =>
        inductee.name === activeInductee.name && inductee.class_year === activeInductee.class_year
    );
    if (!stillVisible) {
      setActiveInductee(null);
    }
  }, [activeInductee, filteredInductees]);

  const handleReset = () => {
    setSelectedYear(latestYear);
    setSelectedRegion('All');
    setSearchTerm('');
    setActiveInductee(null);
  };

  return (
    <div className="timeline-view timeline-brutalist">
      <BrutalistTopBar
        selectedRegion={selectedRegion}
        searchTerm={searchTerm}
        selectedYear={selectedYear}
        onReset={handleReset}
        onJumpToLatest={() => setSelectedYear(latestYear)}
      />

      <TimelineStrip
        years={years}
        selectedYear={selectedYear}
        onSelectYear={(year) => {
          setSelectedYear(year);
          setActiveInductee(null);
        }}
      />

      <div className="timeline-content">
        <InducteePane
          regions={regions}
          selectedRegion={selectedRegion}
          onSelectRegion={setSelectedRegion}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          inductees={filteredInductees}
          onSelectInductee={setActiveInductee}
          placeholderImage={PLACEHOLDER_IMAGE}
        />
        <ContextPane
          selectedYear={selectedYear}
          yearInductees={yearInductees}
          activeInductee={activeInductee}
          placeholderImage={PLACEHOLDER_IMAGE}
          onClearSelection={() => setActiveInductee(null)}
        />
      </div>
    </div>
  );
};

export default TimelineView;
