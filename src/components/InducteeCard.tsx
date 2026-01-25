import type { Inductee } from '../types';

const InducteeCard = ({
  inductee,
  image,
  onSelect,
}: {
  inductee: Inductee;
  image: string;
  onSelect: () => void;
}) => {
  return (
    <button className="inductee-card" onClick={onSelect}>
      <div className="inductee-card__image">
        <img src={image} alt={inductee.name} loading="lazy" />
      </div>
      <div className="inductee-card__body">
        <h3>{inductee.name}</h3>
        <p>{inductee.region}</p>
      </div>
    </button>
  );
};

export default InducteeCard;
