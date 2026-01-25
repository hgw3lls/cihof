import { forwardRef } from 'react';
import type { Inductee } from '../../data/types';
import InducteeThumbnail from './InducteeThumbnail';

const YearStop = forwardRef<
  HTMLDivElement,
  {
    year: string;
    inductees: Inductee[];
    isActive: boolean;
    onSelectInductee: (inductee: Inductee) => void;
    placeholderImage: string;
  }
>(({ year, inductees, isActive, onSelectInductee, placeholderImage }, ref) => {
  return (
    <section
      className={`year-stop${isActive ? ' year-stop--active' : ''}`}
      ref={ref}
      aria-current={isActive ? 'true' : undefined}
    >
      <div className="year-stop__marker">
        <span className="year-stop__year">{year}</span>
        <span className="year-stop__tick" aria-hidden="true" />
      </div>
      <div className="year-stop__gallery" aria-hidden={!isActive}>
        <div className="year-stop__gallery-inner">
          {inductees.map((inductee) => (
            <InducteeThumbnail
              key={`${year}-${inductee.name}`}
              inductee={inductee}
              onSelect={onSelectInductee}
              placeholderImage={placeholderImage}
            />
          ))}
        </div>
      </div>
    </section>
  );
});

YearStop.displayName = 'YearStop';

export default YearStop;
