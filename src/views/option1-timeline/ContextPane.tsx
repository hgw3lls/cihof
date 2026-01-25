import { useMemo } from 'react';
import type { Inductee } from '../../data/types';
import MediaGallery from '../../components/MediaGallery';
import VideoGallery from '../../components/VideoGallery';

const ContextPane = ({
  selectedYear,
  yearInductees,
  activeInductee,
  placeholderImage,
  onClearSelection,
}: {
  selectedYear: string;
  yearInductees: Inductee[];
  activeInductee: Inductee | null;
  placeholderImage: string;
  onClearSelection: () => void;
}) => {
  const regionBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    yearInductees.forEach((inductee) => {
      counts.set(inductee.region, (counts.get(inductee.region) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [yearInductees]);

  if (!activeInductee) {
    return (
      <section className="timeline-pane context-pane">
        <div className="context-pane__header">
          <h2>Year {selectedYear || '—'}</h2>
          <p>{yearInductees.length} inductees</p>
        </div>
        <div className="context-pane__body">
          <div className="context-pane__block">
            <h3>Region distribution</h3>
            {regionBreakdown.length === 0 ? (
              <p className="context-pane__muted">No inductees for this year.</p>
            ) : (
              <ul className="context-pane__list">
                {regionBreakdown.map(([region, count]) => (
                  <li key={region}>
                    <span>{region}</span>
                    <strong>{count}</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="context-pane__block">
            <h3>Tip</h3>
            <p className="context-pane__muted">
              Tap a card to view biography, photos, and video highlights.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="timeline-pane context-pane">
      <div className="context-pane__header context-pane__header--detail">
        <div>
          <h2>{activeInductee.name}</h2>
          <p>
            Class of {activeInductee.class_year} · {activeInductee.region}
          </p>
          {activeInductee.inducted_by && <p>Inducted by: {activeInductee.inducted_by}</p>}
        </div>
        <div className="context-pane__actions">
          {activeInductee.profile_url && (
            <a href={activeInductee.profile_url} target="_blank" rel="noreferrer">
              Full profile
            </a>
          )}
          <button type="button" onClick={onClearSelection}>
            Clear Selection
          </button>
        </div>
      </div>
      <div className="context-pane__body context-pane__body--detail">
        <MediaGallery
          images={activeInductee.images}
          placeholder={placeholderImage}
          alt={activeInductee.name}
        />
        <div className="context-pane__block context-pane__bio">
          <h3>Biography</h3>
          <p>{activeInductee.bio_text || 'Biography details coming soon.'}</p>
        </div>
        <VideoGallery videos={activeInductee.videos} />
      </div>
    </section>
  );
};

export default ContextPane;
