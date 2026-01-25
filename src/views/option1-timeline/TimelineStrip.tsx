import { useEffect, useMemo, useRef } from 'react';
import type { WheelEvent } from 'react';

const SCROLL_STEP = 240;

const TimelineStrip = ({
  years,
  selectedYear,
  onSelectYear,
}: {
  years: string[];
  selectedYear: string;
  onSelectYear: (year: string) => void;
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const selectedButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (selectedButtonRef.current) {
      selectedButtonRef.current.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  }, [selectedYear]);

  const decadeYears = useMemo(() => new Set(years.filter((year) => Number(year) % 10 === 0)), [
    years,
  ]);

  const handleNudge = (direction: number) => {
    trackRef.current?.scrollBy({ left: direction * SCROLL_STEP, behavior: 'smooth' });
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      trackRef.current?.scrollBy({ left: event.deltaY, behavior: 'auto' });
    }
  };

  return (
    <section className="timeline-strip">
      <button
        type="button"
        className="timeline-nudge"
        onClick={() => handleNudge(-1)}
        aria-label="Scroll timeline left"
      >
        ◀
      </button>
      <div
        className="timeline-strip__track"
        ref={trackRef}
        onWheel={handleWheel}
        role="listbox"
        aria-label="Timeline years"
      >
        {years.map((year) => {
          const isSelected = year === selectedYear;
          const isDecade = decadeYears.has(year);
          return (
            <button
              key={year}
              type="button"
              ref={isSelected ? selectedButtonRef : null}
              className={`timeline-year${isSelected ? ' timeline-year--active' : ''}${
                isDecade ? ' timeline-year--decade' : ''
              }`}
              onClick={() => onSelectYear(year)}
              aria-pressed={isSelected}
            >
              <span className="timeline-year__label">{year}</span>
              {isDecade && <span className="timeline-year__decade">DECADE</span>}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="timeline-nudge"
        onClick={() => handleNudge(1)}
        aria-label="Scroll timeline right"
      >
        ▶
      </button>
    </section>
  );
};

export default TimelineStrip;
