import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import { allValue } from '../../data/filtering';
import { countryCommunityOrRegionLabel } from '../../data/inducteeLabels';
import type { Inductee } from '../../data/types';

type TimelineViewProps = {
  inductees: Inductee[];
  loading: boolean;
  error: string;
  selectedYear: string;
  onYearChange: (year: string) => void;
  onSelect: (inductee: Inductee) => void;
  onOpenMedia?: (inductee: Inductee) => void;
};

type YearGroup = {
  year: number;
  inductees: Inductee[];
};

type TimeLensStyle = CSSProperties & {
  '--time-progress'?: string;
};

export function TimelineView({
  inductees,
  loading,
  error,
  selectedYear: selectedYearParam,
  onYearChange,
  onSelect,
  onOpenMedia,
}: TimelineViewProps) {
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [classFocused, setClassFocused] = useState(true);

  const yearGroups = useMemo(() => buildYearGroups(inductees), [inductees]);
  const yearRange = useMemo(() => getYearRange(yearGroups), [yearGroups]);
  const allYears = useMemo(() => buildAllYears(yearRange), [yearRange]);
  const classMap = useMemo(() => new Map(yearGroups.map((group) => [group.year, group.inductees])), [yearGroups]);
  const requestedYear = useMemo(
    () => (yearRange ? parseRequestedYear(selectedYearParam, yearRange) : null),
    [selectedYearParam, yearRange],
  );
  const selectedYear = activeYear ?? requestedYear ?? yearRange?.max ?? null;
  const selectedClass = selectedYear === null ? [] : classMap.get(selectedYear) ?? [];
  const accumulatedGroups = useMemo(
    () => (selectedYear === null ? [] : allYears.filter((year) => year <= selectedYear).map((year) => ({ year, inductees: classMap.get(year) ?? [] }))),
    [allYears, classMap, selectedYear],
  );
  const accumulatedPeople = useMemo(
    () => accumulatedGroups.flatMap((group) => group.inductees),
    [accumulatedGroups],
  );
  const classVideoPeople = selectedClass.filter((inductee) => inductee.hasVideo);
  const activeClassThemes = aggregateStrings(selectedClass.flatMap((inductee) => inductee.themeTags)).slice(0, 3);
  const rangeProgress =
    selectedYear === null || !yearRange || yearRange.max === yearRange.min
      ? '100%'
      : `${((selectedYear - yearRange.min) / (yearRange.max - yearRange.min)) * 100}%`;
  const lensStyle: TimeLensStyle = { '--time-progress': rangeProgress };

  useEffect(() => {
    if (!yearRange) {
      setActiveYear(null);
      return;
    }
    setActiveYear(requestedYear ?? yearRange.max);
  }, [requestedYear, yearRange]);

  function previewYear(value: number) {
    if (!yearRange) return;
    const nextYear = clamp(Math.round(value), yearRange.min, yearRange.max);
    setActiveYear(nextYear);
    setClassFocused(false);
    if (selectedYearParam !== String(nextYear)) onYearChange(String(nextYear));
  }

  function commitYear(value = selectedYear) {
    if (!yearRange || value === null) return;
    const nextYear = clamp(Math.round(value), yearRange.min, yearRange.max);
    setActiveYear(nextYear);
    setClassFocused(true);
    if (selectedYearParam !== String(nextYear)) onYearChange(String(nextYear));
  }

  function openClassMedia() {
    const firstVideoPerson = classVideoPeople[0];
    if (firstVideoPerson) (onOpenMedia ?? onSelect)(firstVideoPerson);
  }

  if (loading) {
    return (
      <section className="timeline time-lens time-lens--status" aria-label="Time">
        <div className="time-lens__status">Loading time lens</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="timeline time-lens time-lens--status" aria-label="Time">
        <div className="time-lens__status">Time lens could not be loaded: {error}</div>
      </section>
    );
  }

  if (!yearRange || selectedYear === null) {
    return (
      <section className="timeline time-lens time-lens--status" aria-label="Time">
        <div className="time-lens__status">No class years have been curated yet.</div>
      </section>
    );
  }

  return (
    <section className={classFocused ? 'timeline time-lens time-lens--focused' : 'timeline time-lens'} style={lensStyle} aria-label="Time">
      <header className="time-lens__header">
        <div>
          <p>Time</p>
          <h2>Built Through Years</h2>
        </div>
        <div className="time-lens__yearReadout" aria-live="polite">
          <span>Class Of</span>
          <strong>{selectedYear}</strong>
        </div>
        <div className="time-lens__metrics" aria-label="Hall growth through selected year">
          <span>{accumulatedPeople.length} inducted so far</span>
          <span>{selectedClass.length > 0 ? `${selectedClass.length} in this class` : 'No documented class'}</span>
          <span>{classVideoPeople.length > 0 ? `${classVideoPeople.length} with media` : 'Media unavailable'}</span>
        </div>
      </header>

      <div className="time-lens__field">
        <section className="time-build" aria-label={`Hall of Fame growth through ${selectedYear}`}>
          <div className="time-build__baseline" aria-hidden="true" />
          <div className="time-build__wall">
            {accumulatedGroups.map((group) => {
              const active = group.year === selectedYear;
              return (
                <article
                  className={[
                    'time-year-stack',
                    active ? 'time-year-stack--active' : '',
                    group.inductees.length === 0 ? 'time-year-stack--empty' : '',
                  ].filter(Boolean).join(' ')}
                  key={group.year}
                  aria-label={`Class of ${group.year}, ${group.inductees.length} inductees`}
                >
                  <header>
                    <span>{group.year}</span>
                    <strong>{group.inductees.length > 0 ? group.inductees.length : '0'}</strong>
                  </header>
                  {group.inductees.length > 0 ? (
                    <div className="time-year-stack__portraits">
                      {group.inductees.map((inductee, index) => (
                        <button
                          aria-label={`Open ${inductee.name}, class of ${group.year}`}
                          className="time-build-person"
                          data-transition-person={inductee.id}
                          data-transition-role="time-portrait"
                          key={inductee.id}
                          style={{ '--portrait-delay': `${Math.min(index * 18, 180)}ms` } as CSSProperties}
                          type="button"
                          onClick={() => onSelect(inductee)}
                        >
                          <FallbackImage
                            alt={inductee.imageAltText || inductee.name}
                            className="time-build-person__image"
                            fallbackClassName="time-build-person__fallback"
                            fallbackLabel={initials(inductee.name)}
                            src={inductee.primaryImageUrl}
                          />
                          <span>{inductee.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="time-year-stack__empty">No class documented</div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <aside className="time-class-focus" aria-labelledby="time-class-heading">
          <div className="time-class-focus__copy">
            <p>{classFocused ? 'Focused Class' : 'Moving Through Time'}</p>
            <h3 id="time-class-heading">{selectedYear}</h3>
            <span>
              {selectedClass.length > 0
                ? `${selectedClass.length} people added to the Hall`
                : 'No inductees are documented for this year'}
            </span>
          </div>

          {activeClassThemes.length > 0 && (
            <div className="time-class-focus__themes" aria-label="Class themes">
              {activeClassThemes.map((theme) => (
                <span key={theme.label}>{theme.label}</span>
              ))}
            </div>
          )}

          {selectedClass.length > 0 ? (
            <div className="time-class-focus__people" key={selectedYear}>
              {selectedClass.map((inductee) => (
                <button
                  data-transition-person={inductee.id}
                  data-transition-role="time-portrait"
                  key={inductee.id}
                  type="button"
                  onClick={() => onSelect(inductee)}
                >
                  <FallbackImage
                    alt={inductee.imageAltText || inductee.name}
                    className="time-class-focus__image"
                    fallbackClassName="time-class-focus__fallback"
                    fallbackLabel={initials(inductee.name)}
                    src={inductee.primaryImageUrl}
                  />
                  <span>
                    <strong>{inductee.name}</strong>
                    <small>{displayContext(inductee)}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="time-class-focus__empty">Move the year control to the next documented class.</div>
          )}

          <footer className="time-class-focus__actions">
            <button type="button" onClick={() => setClassFocused(true)} aria-pressed={classFocused}>
              {classFocused ? 'Full Class In View' : 'View Full Class'}
            </button>
            {classVideoPeople.length > 0 ? (
              <button type="button" onClick={openClassMedia}>
                Open Class Media
              </button>
            ) : (
              <span>Class media unavailable</span>
            )}
          </footer>
        </aside>
      </div>

      <div className="time-lens__controls" aria-label={`Select a year from ${yearRange.min} through ${yearRange.max}`}>
        <button type="button" onClick={() => commitYear(yearRange.min)} aria-label={`Jump to ${yearRange.min}`}>
          {yearRange.min}
        </button>
        <label className="time-lens__scrubber">
          <span>Hold and move through the Hall</span>
          <input
            className="time-lens__range"
            type="range"
            min={yearRange.min}
            max={yearRange.max}
            step={1}
            value={selectedYear}
            onChange={(event) => previewYear(Number(event.currentTarget.value))}
            onPointerDown={() => setClassFocused(false)}
            onPointerUp={() => commitYear()}
            onTouchEnd={() => commitYear()}
            onKeyUp={() => commitYear()}
            onBlur={() => commitYear()}
          />
        </label>
        <button type="button" onClick={() => commitYear(yearRange.max)} aria-label={`Jump to ${yearRange.max}`}>
          {yearRange.max}
        </button>
      </div>
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

function parseRequestedYear(value: string, range: { min: number; max: number }) {
  if (!value || value === allValue) return null;
  const year = Number(value);
  if (!Number.isInteger(year)) return null;
  if (year < range.min || year > range.max) return null;
  return year;
}

function aggregateStrings(values: string[]) {
  const counts = new Map<string, number>();
  values
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function displayContext(inductee: Inductee) {
  return countryCommunityOrRegionLabel(inductee) || inductee.themeTags[0] || 'Context pending';
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
