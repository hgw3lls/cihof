import { useMemo, type CSSProperties } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import { allValue } from '../../data/filtering';
import type { Inductee } from '../../data/types';

type RegionMapViewProps = {
  inductees: Inductee[];
  allInductees: Inductee[];
  selectedRegion: string;
  onRegionChange: (region: string) => void;
  onSelect: (inductee: Inductee) => void;
};

type RegionGroup = {
  region: string;
  count: number;
  withVideo: number;
  featured: Inductee[];
  yearRange: string;
};

const regionAccent: Record<string, string> = {
  Europe: '#b73e2f',
  Asia: '#1f6f78',
  Africa: '#765a9a',
  'North America': '#6e7f32',
  'South America': '#b56a2f',
  'Unknown Region': '#68645d',
};

export function RegionMapView({ inductees, allInductees, selectedRegion, onRegionChange, onSelect }: RegionMapViewProps) {
  const groups = useMemo(() => buildRegionGroups(allInductees), [allInductees]);
  const activeRegion = selectedRegion === allValue ? groups[0]?.region ?? allValue : selectedRegion;
  const activeGroup = groups.find((group) => group.region === activeRegion);
  const visible = selectedRegion === allValue ? inductees : inductees.filter((item) => item.region === selectedRegion);

  return (
    <section className="region-map" aria-label="Region map">
      <div className="region-map__stage">
        <div className="region-map__center">
          <span>Cleveland</span>
          <strong>CIHOF</strong>
        </div>

        {groups.map((group, index) => {
          const angle = (index / groups.length) * Math.PI * 2 - Math.PI / 2;
          const x = 50 + Math.cos(angle) * 34;
          const y = 50 + Math.sin(angle) * 34;
          const active = selectedRegion === group.region || (selectedRegion === allValue && group.region === activeRegion);

          return (
            <button
              className={active ? 'region-node region-node--active' : 'region-node'}
              key={group.region}
              type="button"
              style={{ left: `${x}%`, top: `${y}%`, '--region-color': regionAccent[group.region] ?? regionAccent['Unknown Region'] } as CSSProperties}
              onClick={() => onRegionChange(group.region)}
            >
              <span>{group.region}</span>
              <strong>{group.count}</strong>
            </button>
          );
        })}
      </div>

      <div className="region-map__panel">
        <div className="region-map__header">
          <div>
            <p className="eyebrow">Region Focus</p>
            <h2>{selectedRegion === allValue ? 'All Regions' : selectedRegion}</h2>
          </div>
          <button className="reset-button" type="button" onClick={() => onRegionChange(allValue)}>
            Reset Region
          </button>
        </div>

        {activeGroup && (
          <div className="region-map__summary">
            <span>{activeGroup.count} inductees</span>
            <span>{activeGroup.withVideo} with video</span>
            <span>{activeGroup.yearRange}</span>
          </div>
        )}

        <div className="region-map__featured" aria-label="Featured inductees">
          {(selectedRegion === allValue ? groups.flatMap((group) => group.featured.slice(0, 1)) : activeGroup?.featured ?? []).map((inductee) => (
            <button className="region-feature" key={inductee.id} type="button" onClick={() => onSelect(inductee)}>
              <FallbackImage fallbackClassName="region-feature__fallback" fallbackLabel={initials(inductee.name)} src={inductee.primaryImageUrl} />
              <strong>{inductee.name}</strong>
              <small>{inductee.classYear} / {inductee.region}</small>
            </button>
          ))}
        </div>

        <div className="region-map__list" aria-label="Region inductees">
          {visible.map((inductee) => (
            <button key={inductee.id} type="button" onClick={() => onSelect(inductee)}>
              <span>{inductee.classYear ?? 'Unknown'}</span>
              <strong>{inductee.name}</strong>
              <small>{inductee.region}</small>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
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
        withVideo: items.filter((item) => item.youtubeVideoIds.length > 0 || item.localVideoPaths.length > 0).length,
        featured: [...items]
          .sort((a, b) => Number(Boolean(b.primaryImageUrl)) - Number(Boolean(a.primaryImageUrl)) || (b.classYear ?? 0) - (a.classYear ?? 0))
          .slice(0, 6),
        yearRange: years.length > 0 ? `${Math.min(...years)}-${Math.max(...years)}` : 'Years unknown',
      };
    })
    .sort((a, b) => b.count - a.count || a.region.localeCompare(b.region));
}

