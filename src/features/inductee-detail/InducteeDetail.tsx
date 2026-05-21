import { useEffect, useMemo } from 'react';
import type { Inductee } from '../../data/types';

type InducteeDetailProps = {
  inductee: Inductee | null;
  allInductees: Inductee[];
  onClose: () => void;
};

export function InducteeDetail({ inductee, allInductees, onClose }: InducteeDetailProps) {
  useEffect(() => {
    if (!inductee) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.classList.add('drawer-open');
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.classList.remove('drawer-open');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [inductee, onClose]);

  const related = useMemo(() => {
    if (!inductee) return [];
    return allInductees
      .filter((item) => item.id !== inductee.id && (item.region === inductee.region || item.classYear === inductee.classYear))
      .slice(0, 6);
  }, [allInductees, inductee]);

  if (!inductee) return null;

  const gallery = Array.from(new Set([inductee.primaryImageUrl, ...inductee.imageUrls].filter(Boolean))).slice(0, 8);

  return (
    <aside className="detail" aria-label={`${inductee.name} details`}>
      <button className="detail__scrim" type="button" aria-label="Close details" onClick={onClose} />
      <section className="detail__panel">
        <div className="detail__hero">
          {inductee.primaryImageUrl ? <img src={inductee.primaryImageUrl} alt="" /> : <div className="detail__heroFallback" />}
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

          <p className="detail__bio">{inductee.bioText}</p>

          {gallery.length > 1 && (
            <section className="detail__section" aria-label="Image gallery">
              <h3>Images</h3>
              <div className="gallery-grid">
                {gallery.map((url) => (
                  <img key={url} src={url} alt="" loading="lazy" />
                ))}
              </div>
            </section>
          )}

          {(inductee.youtubeVideoIds.length > 0 || inductee.localVideoPaths.length > 0) && (
            <section className="detail__section" aria-label="Videos">
              <h3>Video</h3>
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
            </section>
          )}

          {related.length > 0 && (
            <section className="detail__section" aria-label="Related inductees">
              <h3>Related</h3>
              <div className="related-list">
                {related.map((item) => (
                  <span key={item.id}>
                    <strong>{item.name}</strong>
                    <small>{item.classYear} / {item.region}</small>
                  </span>
                ))}
              </div>
            </section>
          )}

          {inductee.profileUrl && (
            <a className="source-link" href={inductee.profileUrl} target="_blank" rel="noreferrer">
              Original profile
            </a>
          )}
        </div>
      </section>
    </aside>
  );
}
