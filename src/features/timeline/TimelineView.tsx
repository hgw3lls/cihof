import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import { allValue } from '../../data/filtering';
import { countryCommunityOrRegionLabel } from '../../data/inducteeLabels';
import { portraitImageUrl } from '../../data/portraitImages';
import type { Inductee } from '../../data/types';

type TimelineViewProps = {
  inductees: Inductee[];
  loading: boolean;
  error: string;
  selectedYear: string;
  onYearChange: (year: string) => void;
  onSelect: (inductee: Inductee) => void;
};

type YearGroup = {
  year: number;
  inductees: Inductee[];
};

type DistributionItem = {
  label: string;
  count: number;
};

export function TimelineView({ inductees, loading, error, selectedYear: selectedYearParam, onYearChange, onSelect }: TimelineViewProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const yearRefs = useRef(new Map<number, HTMLButtonElement>());
  const scrollFrame = useRef<number | null>(null);
  const activeYearRef = useRef<number | null>(null);
  const dragRef = useRef({ active: false, pointerId: 0, startX: 0, scrollLeft: 0, moved: false });
  const suppressYearClickRef = useRef(false);
  const [activeYear, setActiveYear] = useState<number | null>(null);

  const yearGroups = useMemo(() => buildYearGroups(inductees), [inductees]);
  const yearRange = useMemo(() => getYearRange(yearGroups), [yearGroups]);
  const allYears = useMemo(() => buildAllYears(yearRange), [yearRange]);
  const classMap = useMemo(() => new Map(yearGroups.map((group) => [group.year, group.inductees])), [yearGroups]);
  const decadeJumps = useMemo(() => buildDecadeJumps(allYears), [allYears]);
  const selectedYear = activeYear ?? yearRange?.max ?? null;
  const activeYearIndex = selectedYear === null ? -1 : allYears.indexOf(selectedYear);
  const selectedClass = useMemo(
    () => (selectedYear === null ? [] : classMap.get(selectedYear) ?? []),
    [classMap, selectedYear],
  );
  const classThemes = useMemo(() => aggregateThemes(selectedClass).slice(0, 5), [selectedClass]);
  const classPlaces = useMemo(() => {
    const distribution = preferredPlaceDistribution(selectedClass);
    return { ...distribution, items: distribution.items.slice(0, 5) };
  }, [selectedClass]);
  const earliestYear = yearRange?.min ?? null;
  const latestYear = yearRange?.max ?? null;
  const earliestClass = earliestYear === null ? [] : classMap.get(earliestYear) ?? [];
  const latestClass = latestYear === null ? [] : classMap.get(latestYear) ?? [];

  useEffect(() => {
    activeYearRef.current = activeYear;
  }, [activeYear]);

  useEffect(() => {
    if (!yearRange) {
      setActiveYear(null);
      activeYearRef.current = null;
      return;
    }

    const requestedYear = parseRequestedYear(selectedYearParam, yearRange);
    const nextYear = requestedYear ?? yearRange.max;
    setActiveYear(nextYear);
    activeYearRef.current = nextYear;
    window.requestAnimationFrame(() => scrollToYear(nextYear, 'auto'));
  }, [selectedYearParam, yearRange]);

  useEffect(() => {
    return () => {
      if (scrollFrame.current) window.cancelAnimationFrame(scrollFrame.current);
    };
  }, []);

  const commitYear = useCallback(
    (year: number, behavior: ScrollBehavior = 'smooth') => {
      if (!yearRange) return;
      const clampedYear = clamp(year, yearRange.min, yearRange.max);
      activeYearRef.current = clampedYear;
      setActiveYear(clampedYear);
      if (selectedYearParam !== String(clampedYear)) onYearChange(String(clampedYear));
      window.requestAnimationFrame(() => scrollToYear(clampedYear, behavior));
    },
    [onYearChange, selectedYearParam, yearRange],
  );

  const updateCenteredYear = useCallback(() => {
    const rail = railRef.current;
    if (!rail || yearRefs.current.size === 0) return;

    const railCenter = rail.scrollLeft + rail.clientWidth / 2;
    let closestYear: number | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    yearRefs.current.forEach((node, year) => {
      const center = node.offsetLeft + node.offsetWidth / 2;
      const distance = Math.abs(center - railCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestYear = year;
      }
    });

    if (closestYear === null || closestYear === activeYearRef.current) return;
    activeYearRef.current = closestYear;
    setActiveYear(closestYear);
    if (selectedYearParam !== String(closestYear)) onYearChange(String(closestYear));
  }, [onYearChange, selectedYearParam]);

  function setYearRef(year: number, node: HTMLButtonElement | null) {
    if (node) yearRefs.current.set(year, node);
    else yearRefs.current.delete(year);
  }

  function handleRailScroll() {
    if (scrollFrame.current) return;
    scrollFrame.current = window.requestAnimationFrame(() => {
      scrollFrame.current = null;
      updateCenteredYear();
    });
  }

  function handleRailPointerDown(event: PointerEvent<HTMLDivElement>) {
    const rail = railRef.current;
    if (!rail || (event.pointerType === 'mouse' && event.button !== 0)) return;
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: rail.scrollLeft,
      moved: false,
    };
    rail.setPointerCapture(event.pointerId);
    rail.classList.add('timeline-year-rail--dragging');
  }

  function handleRailPointerMove(event: PointerEvent<HTMLDivElement>) {
    const rail = railRef.current;
    const drag = dragRef.current;
    if (!rail || !drag.active || drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 4) drag.moved = true;
    rail.scrollLeft = drag.scrollLeft - delta;
    if (drag.moved) event.preventDefault();
  }

  function handleRailPointerEnd(event: PointerEvent<HTMLDivElement>) {
    const rail = railRef.current;
    const drag = dragRef.current;
    if (!rail || !drag.active || drag.pointerId !== event.pointerId) return;
    if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
    rail.classList.remove('timeline-year-rail--dragging');
    if (drag.moved) {
      suppressYearClickRef.current = true;
      window.setTimeout(() => {
        suppressYearClickRef.current = false;
      }, 0);
    }
    dragRef.current = { active: false, pointerId: 0, startX: 0, scrollLeft: 0, moved: false };
  }

  function handleYearClick(year: number) {
    if (suppressYearClickRef.current) return;
    commitYear(year);
  }

  if (loading) {
    return (
      <section className="timeline timeline--status" aria-label="Timeline">
        <div className="timeline-status">Loading classes</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="timeline timeline--status" aria-label="Timeline">
        <div className="timeline-status">Timeline could not be loaded: {error}</div>
      </section>
    );
  }

  if (!yearRange || selectedYear === null) {
    return (
      <section className="timeline timeline--status" aria-label="Timeline">
        <div className="timeline-status">No class years have been curated yet.</div>
      </section>
    );
  }

  return (
    <section className="timeline" aria-label="Timeline">
      <header className="timeline__header">
        <div className="timeline__activeYear" aria-live="polite">
          <p>Class Year</p>
          <h2>{selectedYear}</h2>
        </div>
        <div className="timeline__range" aria-label="Timeline range">
          <button
            className={selectedYear === yearRange.min ? 'timeline-range-button timeline-range-button--active' : 'timeline-range-button'}
            type="button"
            aria-pressed={selectedYear === yearRange.min}
            onClick={() => commitYear(yearRange.min)}
          >
            {yearRange.min} first class
          </button>
          <button
            className={selectedYear === yearRange.max ? 'timeline-range-button timeline-range-button--active' : 'timeline-range-button'}
            type="button"
            aria-pressed={selectedYear === yearRange.max}
            onClick={() => commitYear(yearRange.max)}
          >
            {yearRange.max} current class
          </button>
          <span>{inductees.length} people</span>
        </div>
      </header>

      <div className="timeline__controls" aria-label="Timeline controls">
        <button
          className="timeline-step"
          type="button"
          onClick={() => commitYear(selectedYear - 1)}
          disabled={activeYearIndex <= 0}
          aria-label="Previous year"
        >
          Previous Year
        </button>

        <div className="timeline-decade-jumps" aria-label="Decade jumps">
          {decadeJumps.map((jump) => (
            <button
              aria-pressed={selectedYear >= jump.start && selectedYear <= jump.end}
              className={selectedYear >= jump.start && selectedYear <= jump.end ? 'timeline-decade timeline-decade--active' : 'timeline-decade'}
              key={jump.label}
              type="button"
              onClick={() => commitYear(jump.targetYear)}
            >
              {jump.label}
            </button>
          ))}
        </div>

        <button
          className="timeline-step"
          type="button"
          onClick={() => commitYear(selectedYear + 1)}
          disabled={activeYearIndex === -1 || activeYearIndex >= allYears.length - 1}
          aria-label="Next year"
        >
          Next Year
        </button>
      </div>

      <div
        className="timeline-year-rail"
        ref={railRef}
        onScroll={handleRailScroll}
        onPointerDown={handleRailPointerDown}
        onPointerMove={handleRailPointerMove}
        onPointerUp={handleRailPointerEnd}
        onPointerCancel={handleRailPointerEnd}
        aria-label={`Class years from ${yearRange.min} through ${yearRange.max}`}
      >
        {allYears.map((year) => {
          const group = classMap.get(year);
          const count = group?.length ?? 0;
          const isActive = selectedYear === year;
          return (
            <button
              aria-current={isActive ? 'true' : undefined}
              className={[
                'timeline-year',
                isActive ? 'timeline-year--active' : '',
                count === 0 ? 'timeline-year--empty' : '',
              ].filter(Boolean).join(' ')}
              key={year}
              ref={(node) => setYearRef(year, node)}
              type="button"
              onClick={() => handleYearClick(year)}
            >
              <span>{year}</span>
              <small>{count > 0 ? `${count} people` : 'No class'}</small>
            </button>
          );
        })}
      </div>

      <section className="timeline-class" aria-labelledby="timeline-class-heading">
        <div className="timeline-class__header">
          <div>
            <p>Selected Class</p>
            <h3 id="timeline-class-heading">{selectedYear}</h3>
          </div>
          <div className="timeline-class__summary">
            <span>{selectedClass.length} portraits</span>
            {classThemes.slice(0, 2).map((item) => (
              <span key={item.label}>{item.label}</span>
            ))}
          </div>
        </div>

        {selectedClass.length > 0 ? (
          <div className="timeline-class__portraits" key={selectedYear}>
            {selectedClass.map((inductee) => (
              <button className="timeline-class-card" key={inductee.id} type="button" onClick={() => onSelect(inductee)}>
                <span className="timeline-class-card__media">
                  <FallbackImage
                    alt={inductee.imageAltText || inductee.name}
                    className="timeline-class-card__image"
                    fallbackClassName="timeline-class-card__fallback"
                    fallbackLabel={initials(inductee.name)}
                    src={portraitImageUrl(inductee, 'wall')}
                  />
                </span>
                <span className="timeline-class-card__body">
                  <strong>{inductee.name}</strong>
                  <small>{displayCommunity(inductee)}</small>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="timeline-class__empty">
            No class is documented for {selectedYear}. Use the year rail or previous and next controls to keep moving.
          </div>
        )}

        <div className="timeline-class__distribution" aria-label="Selected class distribution">
          <DistributionList title="Themes" items={classThemes} />
          <DistributionList title={classPlaces.title} items={classPlaces.items} />
        </div>
      </section>

      {earliestYear !== null && latestYear !== null && (
        <section className="timeline-compare" aria-labelledby="timeline-compare-heading">
          <div className="timeline-compare__header">
            <p>Then / Now</p>
            <h3 id="timeline-compare-heading">First Class and Current Class</h3>
          </div>
          <div className="timeline-compare__grid">
            <ComparisonClass label="Then" year={earliestYear} inductees={earliestClass} onSelect={onSelect} />
            <ComparisonClass label="Now" year={latestYear} inductees={latestClass} onSelect={onSelect} />
          </div>
        </section>
      )}
    </section>
  );

  function scrollToYear(year: number, behavior: ScrollBehavior) {
    const rail = railRef.current;
    const node = yearRefs.current.get(year);
    if (!rail || !node) return;
    const targetLeft = node.offsetLeft - (rail.clientWidth - node.offsetWidth) / 2;
    const maxScroll = Math.max(rail.scrollWidth - rail.clientWidth, 0);
    rail.scrollTo({ left: clamp(targetLeft, 0, maxScroll), behavior });
  }
}

function ComparisonClass({
  label,
  year,
  inductees,
  onSelect,
}: {
  label: string;
  year: number;
  inductees: Inductee[];
  onSelect: (inductee: Inductee) => void;
}) {
  const themes = aggregateThemes(inductees).slice(0, 4);
  const placeDistribution = preferredPlaceDistribution(inductees);

  return (
    <article className="timeline-compare-class">
      <header>
        <span>{label}</span>
        <strong>{year}</strong>
        <small>{inductees.length} portraits</small>
      </header>
      <div className="timeline-compare-class__portraits">
        {inductees.slice(0, 8).map((inductee) => (
          <button key={inductee.id} type="button" onClick={() => onSelect(inductee)} aria-label={`Open ${inductee.name}`}>
            <FallbackImage
              alt={inductee.imageAltText || inductee.name}
              className="timeline-compare-class__image"
              fallbackClassName="timeline-compare-class__fallback"
              fallbackLabel={initials(inductee.name)}
              src={portraitImageUrl(inductee, 'thumbnail')}
            />
          </button>
        ))}
      </div>
      <DistributionList title="Theme Distribution" items={themes} />
      <DistributionList title={placeDistribution.title} items={placeDistribution.items.slice(0, 4)} />
    </article>
  );
}

function DistributionList({ title, items }: { title: string; items: DistributionItem[] }) {
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <div className="timeline-distribution">
      <h4>{title}</h4>
      {items.length > 0 ? (
        <div className="timeline-distribution__items">
          {items.map((item) => (
            <div className="timeline-distribution__item" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.count}</strong>
              <i style={{ width: `${Math.max(12, (item.count / max) * 100)}%` }} aria-hidden="true" />
            </div>
          ))}
        </div>
      ) : (
        <p>No distribution data yet.</p>
      )}
    </div>
  );
}

function buildYearGroups(inductees: Inductee[]): YearGroup[] {
  const byYear = new Map<number, Inductee[]>();

  inductees.forEach((inductee) => {
    if (inductee.classYear === null) return;
    byYear.set(inductee.classYear, [...(byYear.get(inductee.classYear) ?? []), inductee]);
  });

  return Array.from(byYear.entries())
    .sort(([yearA], [yearB]) => yearA - yearB)
    .map(([year, items]) => ({
      year,
      inductees: [...items].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

function getYearRange(groups: YearGroup[]) {
  if (groups.length === 0) return null;
  return { min: groups[0].year, max: groups[groups.length - 1].year };
}

function buildAllYears(range: { min: number; max: number } | null) {
  if (!range) return [];
  return Array.from({ length: range.max - range.min + 1 }, (_, index) => range.min + index);
}

function buildDecadeJumps(years: number[]) {
  const decades = new Map<number, number>();
  years.forEach((year) => {
    const decade = Math.floor(year / 10) * 10;
    if (!decades.has(decade)) decades.set(decade, year);
  });

  return Array.from(decades.entries()).map(([decade, targetYear]) => ({
    label: `${decade}s`,
    start: decade,
    end: decade + 9,
    targetYear,
  }));
}

function parseRequestedYear(value: string, range: { min: number; max: number }) {
  if (!value || value === allValue) return null;
  const year = Number(value);
  if (!Number.isInteger(year)) return null;
  if (year < range.min || year > range.max) return null;
  return year;
}

function aggregateThemes(inductees: Inductee[]): DistributionItem[] {
  return aggregateStrings(inductees.flatMap((inductee) => inductee.themeTags));
}

function preferredPlaceDistribution(inductees: Inductee[]) {
  const countries = aggregateStrings(inductees.flatMap((inductee) => inductee.countryTags));
  if (countries.length > 0) return { title: 'Country Distribution', items: countries };
  const communities = aggregateStrings(inductees.flatMap((inductee) => inductee.communityTags));
  if (communities.length > 0) return { title: 'Community Distribution', items: communities };
  return { title: 'Region Distribution', items: aggregateStrings(inductees.map((inductee) => inductee.region)) };
}

function aggregateStrings(values: string[]): DistributionItem[] {
  const counts = new Map<string, number>();
  values
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function displayCommunity(inductee: Inductee) {
  return countryCommunityOrRegionLabel(inductee) || 'Country pending';
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
