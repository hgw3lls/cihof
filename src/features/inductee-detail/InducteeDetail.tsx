import { useEffect, useMemo } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import type { Inductee } from '../../data/types';

type InducteeDetailProps = {
  inductee: Inductee | null;
  allInductees: Inductee[];
  kioskMode: boolean;
  previousInductee: Inductee | null;
  nextInductee: Inductee | null;
  onClose: () => void;
  onSelect: (inductee: Inductee) => void;
};

export function InducteeDetail({
  inductee,
  allInductees,
  kioskMode,
  previousInductee,
  nextInductee,
  onClose,
  onSelect,
}: InducteeDetailProps) {
  useEffect(() => {
    if (!inductee) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && previousInductee) onSelect(previousInductee);
      if (event.key === 'ArrowRight' && nextInductee) onSelect(nextInductee);
    };

    document.body.classList.add('drawer-open');
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.classList.remove('drawer-open');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [inductee, nextInductee, onClose, onSelect, previousInductee]);

  const related = useMemo(() => {
    if (!inductee) return [];
    return allInductees
      .filter((item) => item.id !== inductee.id && (item.region === inductee.region || item.classYear === inductee.classYear))
      .sort((a, b) => {
        const yearMatchA = a.classYear === inductee.classYear ? 0 : 1;
        const yearMatchB = b.classYear === inductee.classYear ? 0 : 1;
        return yearMatchA - yearMatchB || a.name.localeCompare(b.name);
      })
      .slice(0, 6);
  }, [allInductees, inductee]);

  if (!inductee) return null;

  const gallery = Array.from(new Set([inductee.primaryImageUrl, ...inductee.imageUrls].filter(Boolean))).slice(0, 8);
  const hasVideo = inductee.youtubeVideoIds.length > 0 || inductee.localVideoPaths.length > 0;

  return (
    <aside className="detail" aria-label={`${inductee.name} details`}>
      <button className="detail__scrim" type="button" aria-label="Close details" onClick={onClose} />
      <section className="detail__panel">
        <div className="detail__hero">
          <FallbackImage className="detail__heroImage" fallbackClassName="detail__heroFallback" fallbackLabel={initials(inductee.name)} loading="eager" src={inductee.primaryImageUrl} />
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close details">
            X
          </button>
        </div>

        <div className="detail__content">
          <p className="eyebrow">{inductee.classYear ?? 'Year unknown'} Inductee</p>
          <h2>{inductee.name}</h2>
          <div className="detail__facts">
            <span>{inductee.region}</span>
            {inductee.inductedBy && <span>Inducted by {inductee.inductedBy}</span>}
          </div>

          <div className="detail__nav" aria-label="Adjacent inductees">
            {previousInductee && previousInductee.id !== inductee.id && (
              <button type="button" onClick={() => onSelect(previousInductee)}>
                <small>Previous</small>
                <strong>{previousInductee.name}</strong>
              </button>
            )}
            {nextInductee && nextInductee.id !== inductee.id && (
              <button type="button" onClick={() => onSelect(nextInductee)}>
                <small>Next</small>
                <strong>{nextInductee.name}</strong>
              </button>
            )}
          </div>

          <article className="detail__bioBlock">
            <h3>Story</h3>
            <p className="detail__bio">{inductee.bioText}</p>
          </article>

          {gallery.length > 1 && (
            <section className="detail__section" aria-label="Image gallery">
              <h3>Images</h3>
              <div className="gallery-grid">
                {gallery.map((url) => (
                  <FallbackImage key={url} fallbackClassName="gallery-grid__fallback" fallbackLabel={initials(inductee.name)} src={url} />
                ))}
              </div>
            </section>
          )}

          <section className="detail__section" aria-label="Videos">
            <h3>Video</h3>
            {hasVideo ? (
              <div className="video-list">
                {inductee.youtubeVideoIds.slice(0, 2).map((id) => (
                  <iframe
                    key={id}
                    title={`${inductee.name} video`}
                    src={`https://www.youtube.com/embed/${id}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ))}
                {inductee.localVideoPaths.slice(0, 2).map((path) => (
                  <video key={path} controls src={`/${path}`} />
                ))}
              </div>
            ) : (
              <div className="video-empty">No video is linked for this inductee yet.</div>
            )}
          </section>

          {related.length > 0 && (
            <section className="detail__section" aria-label="Related inductees">
              <h3>Related</h3>
              <div className="related-list related-list--cards">
                {related.map((item) => (
                  <button key={item.id} type="button" onClick={() => onSelect(item)}>
                    <FallbackImage fallbackClassName="related-list__fallback" fallbackLabel={initials(item.name)} src={item.primaryImageUrl} />
                    <strong>{item.name}</strong>
                    <small>{item.classYear} / {item.region}</small>
                  </button>
                ))}
              </div>
            </section>
          )}

          {inductee.profileUrl && !kioskMode && (
            <a className="source-link" href={inductee.profileUrl} target="_blank" rel="noreferrer">
              Original profile
            </a>
          )}
          {inductee.profileUrl && kioskMode && <span className="source-link source-link--disabled">Original profile hidden in kiosk mode</span>}
        </div>
      </section>
    </aside>
  );
}
