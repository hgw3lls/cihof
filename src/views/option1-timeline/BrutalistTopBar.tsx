const BrutalistTopBar = ({
  selectedRegion,
  searchTerm,
  selectedYear,
  onReset,
  onJumpToLatest,
}: {
  selectedRegion: string;
  searchTerm: string;
  selectedYear: string;
  onReset: () => void;
  onJumpToLatest: () => void;
}) => {
  const trimmedSearch = searchTerm.trim();

  return (
    <header className="timeline-top-bar">
      <div className="timeline-top-bar__title">
        <h1>CIHOF / TIMELINE</h1>
        <p>Class of {selectedYear || '—'}</p>
      </div>
      <div className="timeline-top-bar__filters" aria-live="polite">
        <span>
          Region: <strong>{selectedRegion || 'All'}</strong>
        </span>
        <span>
          Search: <strong>{trimmedSearch ? `"${trimmedSearch}"` : '—'}</strong>
        </span>
      </div>
      <div className="timeline-top-bar__actions">
        <button type="button" onClick={onReset}>
          Reset
        </button>
        <button type="button" onClick={onJumpToLatest}>
          Jump to Latest
        </button>
      </div>
    </header>
  );
};

export default BrutalistTopBar;
