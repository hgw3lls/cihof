import type { HallLens } from '../data/types';
import type { ExperienceNavItem } from './experienceNavigation';

type ExperienceDockProps = {
  activeLens: HallLens;
  items: ExperienceNavItem[];
  onChange: (lens: HallLens) => void;
};

export function ExperienceDock({ activeLens, items, onChange }: ExperienceDockProps) {
  return (
    <div className="museum-bottom-nav experience-dock" role="toolbar" aria-label="Ways to explore the Hall of Fame" data-active-lens={activeLens}>
      {items.map((item, index) => {
        const active = activeLens === item.lens;
        const className = active
          ? 'museum-nav-item museum-nav-item--active experience-dock__item'
          : 'museum-nav-item experience-dock__item';

        return (
          <button
            aria-label={item.ariaLabel}
            aria-pressed={active}
            className={className}
            data-lens={item.lens}
            key={item.lens}
            type="button"
            onClick={() => onChange(item.lens)}
          >
            <span className="experience-dock__index" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="experience-dock__label">
              <span>{item.label}</span>
              <small>{item.sublabel}</small>
            </span>
            <span className="experience-dock__state" aria-hidden="true">
              {active ? 'Live' : 'Ready'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
