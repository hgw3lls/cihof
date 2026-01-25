import { useEffect, useRef } from 'react';

const YearScrubber = ({
  years,
  selectedYear,
  onSelectYear,
}: {
  years: string[];
  selectedYear: string;
  onSelectYear: (year: string) => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const active = container.querySelector<HTMLButtonElement>(
      `[data-year='${selectedYear}']`
    );
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selectedYear]);

  const nudge = (direction: 'left' | 'right') => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const amount = direction === 'left' ? -240 : 240;
    container.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <section className="year-scrubber">
      <button className="scrubber-nudge" onClick={() => nudge('left')} aria-label="Scroll left">
        ◀
      </button>
      <div className="year-scrubber-track" ref={containerRef}>
        {years.map((year) => (
          <button
            key={year}
            data-year={year}
            className={year === selectedYear ? 'year-chip year-chip--active' : 'year-chip'}
            onClick={() => onSelectYear(year)}
          >
            {year}
          </button>
        ))}
      </div>
      <button className="scrubber-nudge" onClick={() => nudge('right')} aria-label="Scroll right">
        ▶
      </button>
    </section>
  );
};

export default YearScrubber;
