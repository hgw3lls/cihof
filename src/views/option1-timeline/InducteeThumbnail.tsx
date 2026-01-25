import type { Inductee } from '../../data/types';

const InducteeThumbnail = ({
  inductee,
  onSelect,
  placeholderImage,
}: {
  inductee: Inductee;
  onSelect: (inductee: Inductee) => void;
  placeholderImage: string;
}) => {
  const imageSrc = inductee.primaryImage ?? inductee.images[0] ?? placeholderImage;

  return (
    <button
      type="button"
      className="inductee-thumb"
      onClick={() => onSelect(inductee)}
      aria-label={`View details for ${inductee.name}`}
    >
      <img src={imageSrc} alt={inductee.name} loading="lazy" />
      <span>{inductee.name}</span>
    </button>
  );
};

export default InducteeThumbnail;
