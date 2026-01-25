import type { Inductee } from '../data/types';
import InducteeCard from './InducteeCard';

const InducteeGrid = ({
  inductees,
  getImage,
  onSelect,
  showYear,
}: {
  inductees: Inductee[];
  getImage: (inductee: Inductee) => string;
  onSelect: (inductee: Inductee) => void;
  showYear?: boolean;
}) => {
  return (
    <section className="inductee-grid">
      {inductees.length === 0 ? (
        <div className="empty-state">No inductees match the current filters.</div>
      ) : (
        inductees.map((inductee) => (
          <InducteeCard
            key={`${inductee.class_year}-${inductee.name}`}
            inductee={inductee}
            image={getImage(inductee)}
            showYear={showYear}
            onSelect={() => onSelect(inductee)}
          />
        ))
      )}
    </section>
  );
};

export default InducteeGrid;
