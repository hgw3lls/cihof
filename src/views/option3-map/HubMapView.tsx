import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Inductee } from '../../data/types';
import InducteeDetailModal from '../../components/InducteeDetailModal';
import HubMapSVG, { type HubNode, type RegionNode } from './HubMapSVG';
import RegionDrawer from './RegionDrawer';

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='500'%3E%3Crect width='100%25' height='100%25' fill='%23252c37'/%3E%3Ctext x='50%25' y='50%25' font-size='28' fill='%23d9dee8' text-anchor='middle' dominant-baseline='middle'%3EPhoto%20Unavailable%3C/text%3E%3C/svg%3E";

type SortMode = 'name_asc' | 'year_desc';

type RegionSummary = {
  key: string;
  label: string;
  count: number;
};

type InducteeWithRegion = Inductee & {
  regionKey: string;
  regionLabel: string;
};

const normalizeRegionKey = (value: string) => {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.toLowerCase();
};

const normalizeRegionLabel = (value: string) => value.trim().replace(/\s+/g, ' ');

const useDebouncedValue = (value: string, delayMs: number) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};

const useElementSize = () => {
  const [size, setSize] = useState({ width: 1000, height: 700 });
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!ref.current) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSize({
          width: Math.max(600, entry.contentRect.width),
          height: Math.max(520, entry.contentRect.height),
        });
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, size };
};

const computeRegionNodes = (
  regions: RegionSummary[],
  width: number,
  height: number,
): { hub: HubNode; nodes: RegionNode[] } => {
  const minSize = Math.min(width, height);
  const hubRadius = Math.max(70, minSize * 0.1);
  const regionRadius = Math.max(56, minSize * 0.08);
  const radiusPadding = hubRadius + regionRadius + 40;
  const radialDistance = Math.max(minSize * (regions.length > 8 ? 0.36 : 0.32), radiusPadding);
  const hub: HubNode = { x: width / 2, y: height / 2, radius: hubRadius };

  if (regions.length === 0) {
    return { hub, nodes: [] };
  }

  const nodes = regions.map((region, index) => {
    const angle = (2 * Math.PI * index) / regions.length - Math.PI / 2;
    const x = hub.x + radialDistance * Math.cos(angle);
    const y = hub.y + radialDistance * Math.sin(angle);
    return {
      ...region,
      x,
      y,
      radius: regionRadius,
    };
  });

  return { hub, nodes };
};

const HubMapView = ({
  inductees,
  years,
}: {
  inductees: Inductee[];
  years: string[];
}) => {
  const [drawerMode, setDrawerMode] = useState<'closed' | 'region' | 'all'>('closed');
  const [selectedRegionKey, setSelectedRegionKey] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState('All');
  const [sortMode, setSortMode] = useState<SortMode>('name_asc');
  const [visibleCount, setVisibleCount] = useState(18);
  const [activeInductee, setActiveInductee] = useState<Inductee | null>(null);
  const { ref, size } = useElementSize();

  const { regionList, inducteesWithRegion } = useMemo(() => {
    const map = new Map<string, RegionSummary>();
    const processed = inductees.map((inductee) => {
      const label = normalizeRegionLabel(inductee.region);
      const key = normalizeRegionKey(label || 'Unknown Region') || 'unknown region';
      const regionLabel = label || 'Unknown Region';
      const entry = map.get(key);
      if (entry) {
        entry.count += 1;
      } else {
        map.set(key, { key, label: regionLabel, count: 1 });
      }
      return {
        ...inductee,
        regionKey: key,
        regionLabel,
      };
    });
    const regionList = Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
    return { regionList, inducteesWithRegion: processed };
  }, [inductees]);

  const selectedRegionLabel =
    selectedRegionKey && regionList.find((region) => region.key === selectedRegionKey)?.label;

  const debouncedSearch = useDebouncedValue(searchTerm, 200).toLowerCase();

  const filteredInductees = useMemo(() => {
    return inducteesWithRegion.filter((inductee) => {
      if (drawerMode === 'region' && selectedRegionKey) {
        if (inductee.regionKey !== selectedRegionKey) {
          return false;
        }
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
  }, [inducteesWithRegion, drawerMode, selectedRegionKey, selectedYear, debouncedSearch]);

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
    setVisibleCount(18);
  }, [drawerMode, selectedRegionKey, selectedYear, debouncedSearch, sortMode]);

  const displayedInductees = sortedInductees.slice(0, visibleCount);

  const groupedInductees = useMemo(() => {
    if (drawerMode !== 'all') {
      return [];
    }
    const map = new Map<string, InducteeWithRegion[]>();
    displayedInductees.forEach((inductee) => {
      const list = map.get(inductee.regionKey) ?? [];
      list.push(inductee);
      map.set(inductee.regionKey, list);
    });
    return regionList
      .map((region) => ({
        key: region.key,
        label: region.label,
        inductees: map.get(region.key) ?? [],
      }))
      .filter((group) => group.inductees.length > 0);
  }, [drawerMode, displayedInductees, regionList]);

  const { hub, nodes } = useMemo(() => {
    return computeRegionNodes(regionList, size.width, size.height);
  }, [regionList, size]);

  const openRegionDrawer = (key: string) => {
    setSelectedRegionKey(key);
    setDrawerMode('region');
  };

  const openAllDrawer = () => {
    setSelectedRegionKey(null);
    setDrawerMode('all');
  };

  const closeDrawer = () => {
    setDrawerMode('closed');
  };

  const canLoadMore = sortedInductees.length > displayedInductees.length;

  return (
    <div className="hub-map-view">
      <header className="view-header">
        <div>
          <h1>Cleveland Hub Map</h1>
          <p className="subtitle">Tap a region to explore CIHOF inductees by origin</p>
        </div>
        <button className="hub-map-show-all" onClick={openAllDrawer}>
          Show all regions
        </button>
      </header>

      <div
        className={`hub-map-layout${drawerMode !== 'closed' ? ' hub-map-layout--drawer-open' : ''}`}
      >
        <section className="hub-map-visual" ref={ref}>
          <HubMapSVG
            width={size.width}
            height={size.height}
            hub={hub}
            regions={nodes}
            selectedRegionKey={selectedRegionKey}
            onSelectRegion={openRegionDrawer}
            onSelectAll={openAllDrawer}
          />
        </section>

        <RegionDrawer
          isOpen={drawerMode !== 'closed'}
          mode={drawerMode === 'region' ? 'region' : 'all'}
          selectedRegionLabel={selectedRegionLabel ?? null}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedYear={selectedYear}
          years={years}
          onYearChange={setSelectedYear}
          sortMode={sortMode}
          onSortChange={setSortMode}
          onClose={closeDrawer}
          onShowAll={openAllDrawer}
          inductees={displayedInductees}
          groupedInductees={groupedInductees}
          getImage={(inductee) => inductee.primaryImage ?? PLACEHOLDER_IMAGE}
          onSelectInductee={setActiveInductee}
          canLoadMore={drawerMode !== 'closed' && canLoadMore}
          onLoadMore={() => setVisibleCount((count) => count + 18)}
        />
      </div>

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

export default HubMapView;
