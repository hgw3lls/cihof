import type { Inductee } from '../../data/types';
import InducteeGrid from '../../components/InducteeGrid';
import RegionFilterChips from '../../components/RegionFilterChips';

const InducteePane = ({
  regions,
  selectedRegion,
  onSelectRegion,
  searchTerm,
  onSearchTermChange,
  inductees,
  onSelectInductee,
  placeholderImage,
}: {
  regions: string[];
  selectedRegion: string;
  onSelectRegion: (region: string) => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  inductees: Inductee[];
  onSelectInductee: (inductee: Inductee) => void;
  placeholderImage: string;
}) => {
  return (
    <section className="timeline-pane inductee-pane">
      <div className="inductee-pane__header">
        <div className="inductee-pane__search">
          <label htmlFor="timeline-search">Search</label>
          <input
            id="timeline-search"
            type="text"
            placeholder="Search inductee name"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
          />
        </div>
        <RegionFilterChips
          regions={regions}
          selectedRegion={selectedRegion}
          onSelectRegion={onSelectRegion}
        />
      </div>
      <div className="inductee-pane__list">
        <InducteeGrid
          inductees={inductees}
          getImage={(inductee) => inductee.primaryImage ?? placeholderImage}
          onSelect={onSelectInductee}
        />
      </div>
    </section>
  );
};

export default InducteePane;
