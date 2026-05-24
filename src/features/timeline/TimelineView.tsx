import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import { allValue, sortInductees } from '../../data/filtering';
import type { ExploreState, Inductee, SortMode } from '../../data/types';

type TimelineViewProps = {
  inductees: Inductee[];
  facets: {
    regions: string[];
  };
  loading: boolean;
  error: string;
  state: ExploreState;
  onStateChange: (state: Partial<ExploreState>) => void;
  onSelect: (inductee: Inductee) => void;
};

type YearGroup = {
  year: number;
  inductees: Inductee[];
};

export function TimelineView({ inductees, facets, loading, error, state, onStateChange, onSelect }: TimelineViewProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const scrollFrame = useRef<number | null>(null);
  const centeredIdRef = useRef('');
  const [centeredId, setCenteredId] = useState('');
  const [jumpYear, setJumpYear] = useState(() => state.year || allValue);

  const timelineBase = useMemo(() => filterTimelineBase(inductees, state), [inductees, state.query, state.region]);
  const yearGroups = useMemo(() => buildYearGroups(timelineBase), [timelineBase]);
  const timelineItems = useMemo(() => sortTimelineItems(timelineBase, state.sortMode), [state.sortMode, timelineBase]);
  const centeredInductee = useMemo(
    () => timelineItems.find((item) => item.id === centeredId) ?? timelineItems[0] ?? null,
    [centeredId, timelineItems],
  );
  const centeredIndex = centeredInductee ? timelineItems.findIndex((item) => item.id === centeredInductee.id) : -1;
  const regionCounts = useMemo(() => aggregateRegions(timelineItems), [timelineItems]);
  const yearRange = useMemo(() => getYearRange(timelineItems), [timelineItems]);
  const yearSelectValue = yearGroups.some((group) => String(group.year) === jumpYear) ? jumpYear : allValue;

  useEffect(() => {
    centeredIdRef.current = centeredId;
  }, [centeredId]);

  useEffect(() => {
    setJumpYear(state.year || allValue);
  }, [state.year]);

  const updateCenteredItem = useCallback(() => {
    const carousel = carouselRef.current;
    if (!carousel || cardRefs.current.size === 0) return;

    const viewportCenter = carousel.scrollLeft + carousel.clientWidth / 2;
    let nextId = '';
    let closestDistance = Number.POSITIVE_INFINITY;

    cardRefs.current.forEach((node, id) => {
      const cardCenter = node.offsetLeft + node.offsetWidth / 2;
      const distance = Math.abs(cardCenter - viewportCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        nextId = id;
      }
    });

    if (nextId) setCenteredId(nextId);
  }, []);

  const centerItem = useCallback((id: string, behavior: ScrollBehavior = 'smooth') => {
    const node = cardRefs.current.get(id);
    if (!node) return;
    node.scrollIntoView({ behavior, block: 'nearest', inline: 'center' });
    setCenteredId(id);
  }, []);

  useEffect(() => {
    if (timelineItems.length === 0) {
      setCenteredId('');
      return;
    }

    const requestedYear = Number(jumpYear);
    const target =
      jumpYear !== allValue && !Number.isNaN(requestedYear)
        ? timelineItems.find((item) => item.classYear === requestedYear)
        : null;
    const currentStillVisible = timelineItems.some((item) => item.id === centeredIdRef.current);
    const nextItem = target ?? (currentStillVisible ? null : timelineItems[0]);

    if (!nextItem) return;

    const animationFrame = window.requestAnimationFrame(() => centerItem(nextItem.id, 'auto'));
    return () => window.cancelAnimationFrame(animationFrame);
  }, [centerItem, jumpYear, timelineItems]);

  useEffect(() => {
    return () => {
      if (scrollFrame.current) window.cancelAnimationFrame(scrollFrame.current);
    };
  }, []);

  function setCardRef(id: string, node: HTMLButtonElement | null) {
    if (node) cardRefs.current.set(id, node);
    else cardRefs.current.delete(id);
  }

  function handleCarouselScroll() {
    if (scrollFrame.current) return;
    scrollFrame.current = window.requestAnimationFrame(() => {
      scrollFrame.current = null;
      updateCenteredItem();
    });
  }

  function jumpToYear(value: string) {
    setJumpYear(value);
    const target = value === allValue ? timelineItems[0] : timelineItems.find((item) => item.classYear === Number(value));
    if (target) centerItem(target.id);
  }

  function stepCarousel(direction: -1 | 1) {
    if (timelineItems.length === 0) return;
    const currentIndex = centeredIndex >= 0 ? centeredIndex : 0;
    const nextIndex = Math.min(Math.max(currentIndex + direction, 0), timelineItems.length - 1);
    centerItem(timelineItems[nextIndex].id);
  }

  const activeYear = centeredInductee?.classYear ?? null;
  const activeYearPosition = activeYear !== null && yearRange ? getYearPosition(activeYear, yearRange) : 0;

  return (
    <section className="timeline" aria-label="Timeline">
      <div className="timeline__controls controls" aria-label="Timeline filters">
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
          <span>Jump</span>
          <select value={yearSelectValue} onChange={(event) => jumpToYear(event.target.value)}>
            <option value={allValue}>All years</option>
            {yearGroups.map((group) => (
              <option key={group.year} value={group.year}>
                {group.year}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Order</span>
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
        {!loading && !error && `${timelineItems.length} inductees in carousel`}
      </div>

      {!loading && !error && timelineItems.length > 0 && (
        <>
          <div className="timeline__rail" aria-label="Class years">
            <button className="year-chip" type="button" onClick={() => jumpToYear(allValue)}>
              <span>All</span>
              <small>{timelineItems.length}</small>
            </button>
            {yearGroups.map((group) => (
              <button
                className={activeYear === group.year ? 'year-chip year-chip--active' : 'year-chip'}
                key={group.year}
                type="button"
                onClick={() => jumpToYear(String(group.year))}
              >
                <span>{group.year}</span>
                <small>{group.inductees.length}</small>
              </button>
            ))}
          </div>

          <div className="timeline__stage">
            <div className="timeline-carousel-shell">
              <button
                className="timeline-arrow"
                type="button"
                onClick={() => stepCarousel(-1)}
                disabled={centeredIndex <= 0}
                aria-label="Previous inductee"
              >
                Prev
              </button>
              <div className="timeline-carousel" ref={carouselRef} onScroll={handleCarouselScroll} aria-label="Inductee carousel">
                {timelineItems.map((inductee) => {
                  const isCentered = centeredInductee?.id === inductee.id;
                  return (
                    <button
                      className={isCentered ? 'timeline-card timeline-card--active' : 'timeline-card'}
                      key={inductee.id}
                      type="button"
                      ref={(node) => setCardRef(inductee.id, node)}
                      onFocus={() => centerItem(inductee.id)}
                      onClick={() => onSelect(inductee)}
                    >
                      <span className="timeline-card__media">
                        <FallbackImage
                          className="timeline-card__image"
                          fallbackClassName="timeline-card__fallback"
                          fallbackLabel={initials(inductee.name)}
                          src={inductee.primaryImageUrl}
                        />
                        <span className="timeline-card__year">{inductee.classYear ?? 'Year unknown'}</span>
                      </span>
                      <span className="timeline-card__body">
                        <small>{inductee.region}</small>
                        <strong>{inductee.name}</strong>
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                className="timeline-arrow"
                type="button"
                onClick={() => stepCarousel(1)}
                disabled={centeredIndex === -1 || centeredIndex >= timelineItems.length - 1}
                aria-label="Next inductee"
              >
                Next
              </button>
            </div>

            {centeredInductee && (
              <aside className="timeline-insight" aria-live="polite">
                <div>
                  <p className="eyebrow">Centered Inductee</p>
                  <h2>{centeredInductee.name}</h2>
                </div>
                <div className="timeline-insight__meta">
                  <span>{centeredInductee.classYear ?? 'Year unknown'}</span>
                  <span>{centeredInductee.region}</span>
                  {(centeredInductee.youtubeVideoIds.length > 0 || centeredInductee.localVideoPaths.length > 0) && <span>Video</span>}
                </div>
                <div className="timeline-insight__scale" aria-hidden="true">
                  <span style={{ left: `${activeYearPosition}%` }} />
                </div>
                <p>{summarize(centeredInductee.bioText)}</p>
                <div className="timeline__counts" aria-label="Visible region counts">
                  {regionCounts.slice(0, 4).map((item) => (
                    <span key={item.region}>
                      {item.region}: {item.count}
                    </span>
                  ))}
                </div>
                <button className="timeline-insight__action" type="button" onClick={() => onSelect(centeredInductee)}>
                  Open Story
                </button>
              </aside>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function filterTimelineBase(inductees: Inductee[], state: ExploreState) {
  const search = state.query.trim().toLowerCase();
  return inductees.filter((item) => {
    const matchesSearch = !search || item.searchText.includes(search);
    const matchesRegion = state.region === allValue || item.region === state.region;
    return matchesSearch && matchesRegion;
  });
}

function sortTimelineItems(inductees: Inductee[], sortMode: SortMode) {
  return [...inductees].sort((a, b) => sortInductees(a, b, sortMode));
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

function aggregateRegions(inductees: Inductee[]) {
  const counts = new Map<string, number>();
  inductees.forEach((item) => counts.set(item.region, (counts.get(item.region) ?? 0) + 1));
  return Array.from(counts.entries())
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count || a.region.localeCompare(b.region));
}

function getYearRange(inductees: Inductee[]) {
  const years = inductees.map((item) => item.classYear).filter((year): year is number => typeof year === 'number');
  if (years.length === 0) return null;
  return { min: Math.min(...years), max: Math.max(...years) };
}

function getYearPosition(year: number, range: { min: number; max: number }) {
  if (range.max === range.min) return 50;
  return ((year - range.min) / (range.max - range.min)) * 100;
}

function summarize(text: string) {
  if (text.length <= 260) return text;
  return `${text.slice(0, 260).trim()}...`;
}
