import type { Inductee } from '../types';
import InducteeCard from './InducteeCard';

const InducteeGrid = ({
  inductees,
  getImage,
  onSelect,
}: {
  inductees: Inductee[];
  getImage: (inductee: Inductee) => string;
  onSelect: (inductee: Inductee) => void;
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
            onSelect={() => onSelect(inductee)}
          />
        ))
      )}
    </section>
  );
};

export default InducteeGrid;
