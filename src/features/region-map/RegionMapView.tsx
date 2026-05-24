import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import { allValue, sortInductees } from '../../data/filtering';
import type { Inductee, SortMode } from '../../data/types';

type RegionMapViewProps = {
  inductees: Inductee[];
  selectedRegion: string;
  onRegionChange: (region: string) => void;
  onSelect: (inductee: Inductee) => void;
};

type RegionGroup = {
  region: string;
  count: number;
  withVideo: number;
  withGallery: number;
  yearRange: string;
};

type MediaFilter = 'all' | 'with-video' | 'with-gallery';

const regionAccent: Record<string, string> = {
  Europe: '#b73e2f',
  Asia: '#1f6f78',
  Africa: '#765a9a',
  'North America': '#6e7f32',
  'South America': '#b56a2f',
  'Unknown Region': '#68645d',
};

export function RegionMapView({ inductees, selectedRegion, onRegionChange, onSelect }: RegionMapViewProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const scrollFrame = useRef<number | null>(null);
  const centeredIdRef = useRef('');
  const [centeredId, setCenteredId] = useState('');
  const [decadeFilter, setDecadeFilter] = useState(allValue);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [order, setOrder] = useState<SortMode>('year-asc');

  const groups = useMemo(() => buildRegionGroups(inductees), [inductees]);
  const regionBase = useMemo(() => filterByRegion(inductees, selectedRegion), [inductees, selectedRegion]);
  const decadeOptions = useMemo(() => buildDecadeOptions(regionBase), [regionBase]);
  const visibleItems = useMemo(
    () => filterRegionItems(regionBase, decadeFilter, mediaFilter, order),
    [decadeFilter, mediaFilter, order, regionBase],
  );
  const centeredInductee = useMemo(
    () => visibleItems.find((item) => item.id === centeredId) ?? visibleItems[0] ?? null,
    [centeredId, visibleItems],
  );
  const centeredIndex = centeredInductee ? visibleItems.findIndex((item) => item.id === centeredInductee.id) : -1;
  const activeRegion = selectedRegion === allValue ? centeredInductee?.region ?? groups[0]?.region ?? allValue : selectedRegion;
  const activeGroup = groups.find((group) => group.region === activeRegion) ?? groups[0] ?? null;
  const visibleSummary = useMemo(() => summarizeVisibleItems(visibleItems), [visibleItems]);
  const regionCounts = useMemo(() => aggregateRegions(visibleItems), [visibleItems]);

  useEffect(() => {
    centeredIdRef.current = centeredId;
  }, [centeredId]);

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
    if (visibleItems.length === 0) {
      setCenteredId('');
      return;
    }

    const currentStillVisible = visibleItems.some((item) => item.id === centeredIdRef.current);
    if (currentStillVisible) return;

    const animationFrame = window.requestAnimationFrame(() => centerItem(visibleItems[0].id, 'auto'));
    return () => window.cancelAnimationFrame(animationFrame);
  }, [centerItem, visibleItems]);

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

  function selectRegion(region: string) {
    onRegionChange(region);
  }

  function resetRegionMap() {
    onRegionChange(allValue);
    setDecadeFilter(allValue);
    setMediaFilter('all');
    setOrder('year-asc');
  }

  function stepCarousel(direction: -1 | 1) {
    if (visibleItems.length === 0) return;
    const currentIndex = centeredIndex >= 0 ? centeredIndex : 0;
    const nextIndex = Math.min(Math.max(currentIndex + direction, 0), visibleItems.length - 1);
    centerItem(visibleItems[nextIndex].id);
  }

  return (
    <section className="region-map" aria-label="Region constellation">
      <div className="region-map__stage" aria-label="Regions connected to Cleveland">
        <div className="region-map__center">
          <span>Cleveland</span>
          <strong>CIHOF</strong>
        </div>

        {groups.map((group, index) => {
          const angle = (index / groups.length) * Math.PI * 2 - Math.PI / 2;
          const x = 50 + Math.cos(angle) * 34;
          const y = 50 + Math.sin(angle) * 34;
          const color = regionAccent[group.region] ?? regionAccent['Unknown Region'];
          const active = group.region === activeRegion;
          const nodeStyle = { left: `${x}%`, top: `${y}%`, '--region-color': color } as CSSProperties;
          const linkStyle = { '--region-color': color, '--link-angle': `${angle}rad` } as CSSProperties;

          return (
            <div className="region-map__orbit" key={group.region}>
              <span className={active ? 'region-map__link region-map__link--active' : 'region-map__link'} style={linkStyle} />
              <button
                className={active ? 'region-node region-node--active' : 'region-node'}
                type="button"
                style={nodeStyle}
                onClick={() => selectRegion(group.region)}
              >
                <span>{group.region}</span>
                <strong>{group.count}</strong>
                <small>{group.withVideo} videos</small>
              </button>
            </div>
          );
        })}

        <div className="region-map__legend" aria-hidden="true">
          <span>{groups.length} regions</span>
          <span>{inductees.length} stories</span>
        </div>
      </div>

      <div className="region-map__experience">
        <div className="region-map__header">
          <div>
            <p className="eyebrow">Region Constellation</p>
            <h2>{selectedRegion === allValue ? 'All Regions' : selectedRegion}</h2>
          </div>
          <button className="reset-button" type="button" onClick={resetRegionMap}>
            Reset Region
          </button>
        </div>

        <div className="region-map__filters" aria-label="Region carousel filters">
          <label className="field">
            <span>Region</span>
            <select value={selectedRegion} onChange={(event) => selectRegion(event.target.value)}>
              <option value={allValue}>All regions</option>
              {groups.map((group) => (
                <option key={group.region} value={group.region}>
                  {group.region}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Class Era</span>
            <select value={decadeFilter} onChange={(event) => setDecadeFilter(event.target.value)}>
              <option value={allValue}>All eras</option>
              {decadeOptions.map((decade) => (
                <option key={decade} value={decade}>
                  {decade}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Media</span>
            <select value={mediaFilter} onChange={(event) => setMediaFilter(event.target.value as MediaFilter)}>
              <option value="all">All media</option>
              <option value="with-video">With video</option>
              <option value="with-gallery">Image gallery</option>
            </select>
          </label>

          <label className="field">
            <span>Order</span>
            <select value={order} onChange={(event) => setOrder(event.target.value as SortMode)}>
              <option value="year-asc">Year, oldest first</option>
              <option value="year-desc">Year, newest first</option>
              <option value="name-asc">Name</option>
              <option value="region-asc">Region</option>
            </select>
          </label>
        </div>

        <div className="result-line" aria-live="polite">
          {visibleItems.length} inductees in this view
        </div>

        {visibleItems.length > 0 ? (
          <>
            <div className="region-carousel-shell">
              <button
                className="region-arrow"
                type="button"
                onClick={() => stepCarousel(-1)}
                disabled={centeredIndex <= 0}
                aria-label="Previous region inductee"
              >
                Prev
              </button>
              <div className="region-carousel" ref={carouselRef} onScroll={handleCarouselScroll} aria-label="Region inductee carousel">
                {visibleItems.map((inductee) => {
                  const isCentered = centeredInductee?.id === inductee.id;
                  return (
                    <button
                      className={isCentered ? 'region-card region-card--active' : 'region-card'}
                      key={inductee.id}
                      type="button"
                      ref={(node) => setCardRef(inductee.id, node)}
                      onFocus={() => centerItem(inductee.id)}
                      onClick={() => onSelect(inductee)}
                    >
                      <span className="region-card__media">
                        <FallbackImage
                          className="region-card__image"
                          fallbackClassName="region-card__fallback"
                          fallbackLabel={initials(inductee.name)}
                          src={inductee.primaryImageUrl}
                        />
                        <span className="region-card__region">{inductee.region}</span>
                      </span>
                      <span className="region-card__body">
                        <small>{inductee.classYear ?? 'Year unknown'}</small>
                        <strong>{inductee.name}</strong>
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                className="region-arrow"
                type="button"
                onClick={() => stepCarousel(1)}
                disabled={centeredIndex === -1 || centeredIndex >= visibleItems.length - 1}
                aria-label="Next region inductee"
              >
                Next
              </button>
            </div>

            {centeredInductee && (
              <aside className="region-insight" aria-live="polite">
                <div>
                  <p className="eyebrow">Centered Story</p>
                  <h3>{centeredInductee.name}</h3>
                </div>
                <div className="region-insight__meta">
                  <span>{centeredInductee.classYear ?? 'Year unknown'}</span>
                  <span>{centeredInductee.region}</span>
                  {centeredInductee.hasVideo && <span>Video</span>}
                </div>
                <p>{summarize(centeredInductee.bioText)}</p>
                <div className="region-insight__stats" aria-label="Visible region counts">
                  <span>{visibleSummary.years}</span>
                  <span>{visibleSummary.withVideo} with video</span>
                  {activeGroup && <span>{activeGroup.withGallery} galleries in {activeGroup.region}</span>}
                </div>
                <div className="region-insight__regions" aria-label="Visible regions">
                  {regionCounts.slice(0, 5).map((item) => (
                    <span key={item.region}>{item.region}: {item.count}</span>
                  ))}
                </div>
                <button className="region-insight__action" type="button" onClick={() => onSelect(centeredInductee)}>
                  Open Story
                </button>
              </aside>
            )}
          </>
        ) : (
          <div className="region-empty">No inductees match these region filters.</div>
        )}
      </div>
    </section>
  );
}

function filterByRegion(inductees: Inductee[], region: string) {
  if (region === allValue) return inductees;
  return inductees.filter((item) => item.region === region);
}

function filterRegionItems(inductees: Inductee[], decade: string, media: MediaFilter, order: SortMode) {
  return inductees
    .filter((item) => decade === allValue || getDecade(item.classYear) === decade)
    .filter((item) => {
      if (media === 'with-video') return item.hasVideo;
      if (media === 'with-gallery') return item.hasGallery;
      return true;
    })
    .sort((a, b) => sortInductees(a, b, order));
}

function buildRegionGroups(inductees: Inductee[]): RegionGroup[] {
  const byRegion = new Map<string, Inductee[]>();
  inductees.forEach((inductee) => byRegion.set(inductee.region, [...(byRegion.get(inductee.region) ?? []), inductee]));

  return Array.from(byRegion.entries())
    .map(([region, items]) => {
      const years = items.map((item) => item.classYear).filter((year): year is number => typeof year === 'number');
      return {
        region,
        count: items.length,
        withVideo: items.filter((item) => item.hasVideo).length,
        withGallery: items.filter((item) => item.hasGallery).length,
        yearRange: years.length > 0 ? `${Math.min(...years)}-${Math.max(...years)}` : 'Years unknown',
      };
    })
    .sort((a, b) => b.count - a.count || a.region.localeCompare(b.region));
}

function buildDecadeOptions(inductees: Inductee[]) {
  return Array.from(new Set(inductees.map((item) => getDecade(item.classYear)).filter((value): value is string => Boolean(value)))).sort();
}

function getDecade(year: number | null) {
  if (year === null) return '';
  return `${Math.floor(year / 10) * 10}s`;
}

function aggregateRegions(inductees: Inductee[]) {
  const counts = new Map<string, number>();
  inductees.forEach((item) => counts.set(item.region, (counts.get(item.region) ?? 0) + 1));
  return Array.from(counts.entries())
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count || a.region.localeCompare(b.region));
}

function summarizeVisibleItems(inductees: Inductee[]) {
  const years = inductees.map((item) => item.classYear).filter((year): year is number => typeof year === 'number');
  return {
    withVideo: inductees.filter((item) => item.hasVideo).length,
    years: years.length > 0 ? `${Math.min(...years)}-${Math.max(...years)}` : 'Years unknown',
  };
}

function summarize(text: string) {
  if (text.length <= 250) return text;
  return `${text.slice(0, 250).trim()}...`;
}
