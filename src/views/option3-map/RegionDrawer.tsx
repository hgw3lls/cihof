import type { Inductee } from '../../data/types';
import InducteeCard from '../../components/InducteeCard';
import InducteeGrid from '../../components/InducteeGrid';

type SortMode = 'name_asc' | 'year_desc';

type RegionGroup = {
  key: string;
  label: string;
  inductees: Inductee[];
};

const RegionDrawer = ({
  isOpen,
  mode,
  selectedRegionLabel,
  searchTerm,
  onSearchChange,
  selectedYear,
  years,
  onYearChange,
  sortMode,
  onSortChange,
  onClose,
  onShowAll,
  inductees,
  groupedInductees,
  getImage,
  onSelectInductee,
  canLoadMore,
  onLoadMore,
}: {
  isOpen: boolean;
  mode: 'region' | 'all';
  selectedRegionLabel: string | null;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedYear: string;
  years: string[];
  onYearChange: (value: string) => void;
  sortMode: SortMode;
  onSortChange: (value: SortMode) => void;
  onClose: () => void;
  onShowAll: () => void;
  inductees: Inductee[];
  groupedInductees: RegionGroup[];
  getImage: (inductee: Inductee) => string;
  onSelectInductee: (inductee: Inductee) => void;
  canLoadMore: boolean;
  onLoadMore: () => void;
}) => {
  return (
    <aside className={`hub-map-drawer${isOpen ? ' hub-map-drawer--open' : ''}`}>
      <header className="hub-map-drawer__header">
        <div>
          <h2>{mode === 'region' ? selectedRegionLabel ?? 'Region' : 'All Regions'}</h2>
          <p className="hub-map-drawer__subtitle">
            {mode === 'region'
              ? 'Tap an inductee to explore.'
              : 'Browse the full CIHOF archive by region.'}
          </p>
        </div>
        <button className="hub-map-drawer__close" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="hub-map-drawer__controls">
        <div className="control-group">
          <label htmlFor="hub-map-search">Search</label>
          <input
            id="hub-map-search"
            type="text"
            placeholder="Search name or biography"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <div className="control-group">
          <label htmlFor="hub-map-year">Class Year</label>
          <select
            id="hub-map-year"
            value={selectedYear}
            onChange={(event) => onYearChange(event.target.value)}
          >
            {['All', ...years].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="hub-map-sort">Sort</label>
          <select
            id="hub-map-sort"
            value={sortMode}
            onChange={(event) => onSortChange(event.target.value as SortMode)}
          >
            <option value="name_asc">Name A–Z</option>
            <option value="year_desc">Year desc → Name</option>
          </select>
        </div>
        {mode === 'region' && (
          <button className="hub-map-drawer__all" onClick={onShowAll}>
            Show all regions
          </button>
        )}
      </div>

      <div className="hub-map-drawer__content">
        {mode === 'region' ? (
          <InducteeGrid
            inductees={inductees}
            getImage={getImage}
            onSelect={onSelectInductee}
            showYear
          />
        ) : groupedInductees.length === 0 ? (
          <div className="empty-state">No inductees match the current filters.</div>
        ) : (
          groupedInductees.map((group) => (
            <section key={group.key} className="hub-map-group">
              <h3 className="hub-map-group__title">{group.label}</h3>
              <div className="hub-map-group__grid">
                {group.inductees.map((inductee) => (
                  <InducteeCard
                    key={`${inductee.class_year}-${inductee.name}`}
                    inductee={inductee}
                    image={getImage(inductee)}
                    onSelect={() => onSelectInductee(inductee)}
                    showYear
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {canLoadMore && (
        <div className="hub-map-drawer__footer">
          <button onClick={onLoadMore}>Load more</button>
        </div>
      )}
    </aside>
  );
};

export default RegionDrawer;
