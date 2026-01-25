import { useCallback, useEffect, useMemo, useRef, useState, type WheelEvent } from 'react';
import InducteeDetailModal from '../../components/InducteeDetailModal';
import type { Inductee } from '../../data/types';
import BrutalistTopBar from './BrutalistTopBar';
import TimelineScroller from './TimelineScroller';
import YearMenu from './YearMenu';
import YearStop from './YearStop';

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='500'%3E%3Crect width='100%25' height='100%25' fill='%23000'/%3E%3Ctext x='50%25' y='50%25' font-size='28' fill='%23ffffff' text-anchor='middle' dominant-baseline='middle'%3EPhoto%20Unavailable%3C/text%3E%3C/svg%3E";

const TimelineView = ({ inductees }: { inductees: Inductee[]; years: string[]; regions: string[] }) => {
  const sortedYears = useMemo(() => {
    const yearSet = new Set<string>();
    inductees.forEach((inductee) => {
      if (inductee.class_year) {
        yearSet.add(inductee.class_year);
      }
    });
    return Array.from(yearSet).sort((a, b) => Number(a) - Number(b));
  }, [inductees]);

  const latestYear = sortedYears[sortedYears.length - 1] ?? '';
  const [activeYear, setActiveYear] = useState(latestYear);
  const [selectedInductee, setSelectedInductee] = useState<Inductee | null>(null);

  const timelineRef = useRef<HTMLDivElement | null>(null);
  const yearRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rafRef = useRef<number | null>(null);

  const inducteesByYear = useMemo(() => {
    const map = new Map<string, Inductee[]>();
    sortedYears.forEach((year) => map.set(year, []));
    inductees.forEach((inductee) => {
      const year = inductee.class_year;
      if (!map.has(year)) {
        map.set(year, []);
      }
      map.get(year)?.push(inductee);
    });
    return map;
  }, [inductees, sortedYears]);

  const activeCount = activeYear ? inducteesByYear.get(activeYear)?.length ?? 0 : 0;

  const scrollToYear = useCallback((year: string, behavior: ScrollBehavior = 'smooth') => {
    const container = timelineRef.current;
    const target = yearRefs.current[year];
    if (!container || !target) {
      return;
    }
    const left = target.offsetLeft + target.offsetWidth / 2 - container.clientWidth / 2;
    container.scrollTo({ left, behavior });
  }, []);

  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) {
      return;
    }
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const container = timelineRef.current;
      if (!container) {
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const center = containerRect.left + containerRect.width / 2;
      let closestYear = activeYear;
      let closestDistance = Number.POSITIVE_INFINITY;

      sortedYears.forEach((year) => {
        const node = yearRefs.current[year];
        if (!node) {
          return;
        }
        const rect = node.getBoundingClientRect();
        const nodeCenter = rect.left + rect.width / 2;
        const distance = Math.abs(nodeCenter - center);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestYear = year;
        }
      });

      if (closestYear && closestYear !== activeYear) {
        setActiveYear(closestYear);
      }
    });
  }, [activeYear, sortedYears]);

  const handleWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    const container = timelineRef.current;
    if (!container) {
      return;
    }
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      container.scrollLeft += event.deltaY;
    }
  }, []);

  useEffect(() => {
    document.body.classList.add('timeline-brutalist-root');
    return () => {
      document.body.classList.remove('timeline-brutalist-root');
    };
  }, []);

  useEffect(() => {
    if (!latestYear) {
      return;
    }
    if (!activeYear || !sortedYears.includes(activeYear)) {
      setActiveYear(latestYear);
    }
  }, [activeYear, latestYear, sortedYears]);

  useEffect(() => {
    if (!latestYear) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      scrollToYear(latestYear, 'auto');
    });
    return () => window.cancelAnimationFrame(frame);
  }, [latestYear, scrollToYear]);

  const handleSelectYear = (year: string) => {
    if (!year) {
      return;
    }
    setActiveYear(year);
    setSelectedInductee(null);
    scrollToYear(year, 'smooth');
  };

  const handleReset = () => {
    if (!latestYear) {
      setActiveYear('');
      setSelectedInductee(null);
      return;
    }
    setActiveYear(latestYear);
    setSelectedInductee(null);
    scrollToYear(latestYear, 'smooth');
  };

  return (
    <div className="timeline-view timeline-brutalist">
      <BrutalistTopBar
        activeYear={activeYear}
        activeCount={activeCount}
        onReset={handleReset}
        onJumpToLatest={() => handleSelectYear(latestYear)}
      />

      <YearMenu years={sortedYears} activeYear={activeYear} onSelectYear={handleSelectYear} />

      <TimelineScroller ref={timelineRef} onScroll={handleScroll} onWheel={handleWheel}>
        {sortedYears.map((year) => (
          <YearStop
            key={year}
            ref={(node) => {
              yearRefs.current[year] = node;
            }}
            year={year}
            inductees={inducteesByYear.get(year) ?? []}
            isActive={year === activeYear}
            onSelectInductee={setSelectedInductee}
            placeholderImage={PLACEHOLDER_IMAGE}
          />
        ))}
      </TimelineScroller>

      {selectedInductee && (
        <InducteeDetailModal
          inductee={selectedInductee}
          placeholder={PLACEHOLDER_IMAGE}
          onClose={() => setSelectedInductee(null)}
        />
      )}
    </div>
  );
};

export default TimelineView;
