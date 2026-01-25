const RegionFilterChips = ({
  regions,
  selectedRegion,
  onSelectRegion,
}: {
  regions: string[];
  selectedRegion: string;
  onSelectRegion: (region: string) => void;
}) => {
  return (
    <section className="region-filters">
      {['All', ...regions].map((region) => (
        <button
          key={region}
          className={region === selectedRegion ? 'region-chip region-chip--active' : 'region-chip'}
          onClick={() => onSelectRegion(region)}
        >
          {region}
        </button>
      ))}
    </section>
  );
};

export default RegionFilterChips;
