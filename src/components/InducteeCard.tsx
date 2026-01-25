import type { Inductee } from '../data/types';

const InducteeCard = ({
  inductee,
  image,
  onSelect,
  showYear = false,
}: {
  inductee: Inductee;
  image: string;
  onSelect: () => void;
  showYear?: boolean;
}) => {
  return (
    <button className="inductee-card" onClick={onSelect}>
      <div className="inductee-card__image">
        <img src={image} alt={inductee.name} loading="lazy" />
      </div>
      <div className="inductee-card__body">
        <h3>{inductee.name}</h3>
        <p className="inductee-card__meta">
          {showYear && <span>Class of {inductee.class_year}</span>}
          <span>{inductee.region}</span>
        </p>
      </div>
    </button>
  );
};

export default InducteeCard;
