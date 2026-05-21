import { useMemo } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import type { Inductee } from '../../data/types';

type TimelineViewProps = {
  inductees: Inductee[];
  selectedYear: string;
  onYearChange: (year: string) => void;
  onSelect: (inductee: Inductee) => void;
};

type YearGroup = {
  year: number;
  inductees: Inductee[];
  regions: Array<{ region: string; count: number }>;
};

export function TimelineView({ inductees, selectedYear, onYearChange, onSelect }: TimelineViewProps) {
  const groups = useMemo(() => buildYearGroups(inductees), [inductees]);
  const activeGroup = selectedYear === 'all' ? groups[groups.length - 1] : groups.find((group) => group.year === Number(selectedYear));

  return (
    <section className="timeline" aria-label="Timeline">
      <div className="timeline__rail" aria-label="Class years">
        <button
          className={selectedYear === 'all' ? 'year-chip year-chip--active' : 'year-chip'}
          type="button"
          onClick={() => onYearChange('all')}
        >
          All years
        </button>
        {groups.map((group) => (
          <button
            className={selectedYear === String(group.year) ? 'year-chip year-chip--active' : 'year-chip'}
            key={group.year}
            type="button"
            onClick={() => onYearChange(String(group.year))}
          >
            <span>{group.year}</span>
            <small>{group.inductees.length}</small>
          </button>
        ))}
      </div>

      {activeGroup && (
        <div className="timeline__focus">
          <div className="timeline__header">
            <div>
              <p className="eyebrow">Class Year</p>
              <h2>{selectedYear === 'all' ? 'All Induction Years' : activeGroup.year}</h2>
            </div>
            <div className="timeline__counts">
              {(selectedYear === 'all' ? aggregateRegions(inductees) : activeGroup.regions).map((item) => (
                <span key={item.region}>
                  {item.region}: {item.count}
                </span>
              ))}
            </div>
          </div>

          <div className="timeline__people">
            {(selectedYear === 'all' ? inductees : activeGroup.inductees).map((inductee) => (
              <button className="timeline-person" key={inductee.id} type="button" onClick={() => onSelect(inductee)}>
                <FallbackImage fallbackClassName="timeline-person__fallback" fallbackLabel={initials(inductee.name)} src={inductee.primaryImageUrl} />
                <strong>{inductee.name}</strong>
                <small>{inductee.region}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
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
      inductees: items.sort((a, b) => a.name.localeCompare(b.name)),
      regions: aggregateRegions(items),
    }));
}

function aggregateRegions(inductees: Inductee[]) {
  const counts = new Map<string, number>();
  inductees.forEach((item) => counts.set(item.region, (counts.get(item.region) ?? 0) + 1));
  return Array.from(counts.entries())
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count || a.region.localeCompare(b.region));
}

