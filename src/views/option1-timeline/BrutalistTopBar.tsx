const BrutalistTopBar = ({
  activeYear,
  activeCount,
  onReset,
  onJumpToLatest,
}: {
  activeYear: string;
  activeCount: number;
  onReset: () => void;
  onJumpToLatest: () => void;
}) => {
  const countLabel = `${activeCount} Inductee${activeCount === 1 ? '' : 's'}`;

  return (
    <header className="timeline-top-bar">
      <div className="timeline-top-bar__title">
        <h1>CIHOF / TIMELINE</h1>
        <p>Horizontal archive</p>
      </div>
      <div className="timeline-top-bar__status" aria-live="polite">
        <strong>{activeYear || '—'}</strong>
        <span>{activeYear ? `— ${countLabel}` : 'Select a year'}</span>
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
