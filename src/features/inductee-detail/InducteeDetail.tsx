import { useEffect, useMemo, useState } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import type { Inductee } from '../../data/types';

type InducteeDetailProps = {
  inductee: Inductee | null;
  allInductees: Inductee[];
  kioskMode: boolean;
  previousInductee: Inductee | null;
  nextInductee: Inductee | null;
  onClose: () => void;
  onReset: () => void;
  onSelect: (inductee: Inductee) => void;
};

type RelatedItem = {
  inductee: Inductee;
  reason: string;
};

export function InducteeDetail({
  inductee,
  allInductees,
  kioskMode,
  previousInductee,
  nextInductee,
  onClose,
  onReset,
  onSelect,
}: InducteeDetailProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const related = useMemo(() => {
    if (!inductee) return [];
    const byId = new Map(allInductees.map((item) => [item.id, item]));
    const ranked = inductee.relatedIds
      .flatMap((id) => {
        const relatedInductee = byId.get(id);
        return relatedInductee ? [{ inductee: relatedInductee, reason: relationshipReason(inductee, relatedInductee) }] : [];
      })
      .slice(0, 6);

    if (ranked.length > 0) return ranked;

    return allInductees
      .filter((item) => item.id !== inductee.id && (item.region === inductee.region || item.classYear === inductee.classYear))
      .sort((a, b) => {
        const yearMatchA = a.classYear === inductee.classYear ? 0 : 1;
        const yearMatchB = b.classYear === inductee.classYear ? 0 : 1;
        return yearMatchA - yearMatchB || a.name.localeCompare(b.name);
      })
      .slice(0, 6)
      .map((item): RelatedItem => ({ inductee: item, reason: relationshipReason(inductee, item) }));
  }, [allInductees, inductee]);

  const gallery = useMemo(() => {
    if (!inductee) return [];
    return Array.from(new Set([inductee.primaryImageUrl, ...inductee.imageUrls].filter(Boolean))).slice(0, 8);
  }, [inductee]);

  useEffect(() => {
    if (!inductee) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (lightboxIndex !== null) setLightboxIndex(null);
        else onClose();
      }
      if (lightboxIndex !== null) {
        if (event.key === 'ArrowLeft') setLightboxIndex((current) => cycleImage(current, gallery.length, -1));
        if (event.key === 'ArrowRight') setLightboxIndex((current) => cycleImage(current, gallery.length, 1));
        return;
      }
      if (event.key === 'ArrowLeft' && previousInductee) onSelect(previousInductee);
      if (event.key === 'ArrowRight' && nextInductee) onSelect(nextInductee);
    };

    document.body.classList.add('drawer-open');
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.classList.remove('drawer-open');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [gallery.length, inductee, lightboxIndex, nextInductee, onClose, onSelect, previousInductee]);

  useEffect(() => {
    setLightboxIndex(null);
  }, [inductee?.id]);

  if (!inductee) return null;

  const hasVideo = inductee.hasVideo || inductee.youtubeVideoIds.length > 0 || inductee.localVideoPaths.length > 0;
  const activeLightboxUrl = lightboxIndex === null ? '' : gallery[lightboxIndex];

  return (
    <aside className="detail" aria-label={`${inductee.name} details`}>
      <button className="detail__scrim" type="button" aria-label="Close details" onClick={onClose} />
      <section className="detail__panel">
        <div className="detail__hero">
          <FallbackImage className="detail__heroImage" fallbackClassName="detail__heroFallback" fallbackLabel={initials(inductee.name)} loading="eager" src={inductee.primaryImageUrl} />
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close details">
            X
          </button>
          <button className="detail__resetButton" type="button" onClick={onReset}>
            Reset
          </button>
        </div>

        <div className="detail__content">
          <p className="eyebrow">{inductee.classYear ?? 'Year unknown'} Inductee</p>
          <h2>{inductee.name}</h2>
          <div className="detail__facts">
            <span>{inductee.region}</span>
            {inductee.inductedBy && <span>Inducted by {inductee.inductedBy}</span>}
            {inductee.hasVideo && <span>Video available</span>}
          </div>

          {inductee.themeTags.length > 0 && (
            <div className="detail__themeTags" aria-label="Story themes">
              {inductee.themeTags.map((theme) => (
                <span key={theme}>{theme}</span>
              ))}
            </div>
          )}

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
                {gallery.map((url, index) => (
                  <button className="gallery-grid__button" key={url} type="button" onClick={() => setLightboxIndex(index)}>
                    <FallbackImage fallbackClassName="gallery-grid__fallback" fallbackLabel={initials(inductee.name)} src={url} />
                  </button>
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
                  <button key={item.inductee.id} type="button" onClick={() => onSelect(item.inductee)}>
                    <FallbackImage fallbackClassName="related-list__fallback" fallbackLabel={initials(item.inductee.name)} src={item.inductee.primaryImageUrl} />
                    <strong>{item.inductee.name}</strong>
                    <small>{item.reason} / {item.inductee.classYear} / {item.inductee.region}</small>
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

      {activeLightboxUrl && (
        <div className="lightbox" role="dialog" aria-label={`${inductee.name} image viewer`}>
          <button className="lightbox__scrim" type="button" aria-label="Close image viewer" onClick={() => setLightboxIndex(null)} />
          <div className="lightbox__content">
            <FallbackImage className="lightbox__image" fallbackClassName="lightbox__fallback" fallbackLabel={initials(inductee.name)} loading="eager" src={activeLightboxUrl} />
            <div className="lightbox__bar">
              <button type="button" onClick={() => setLightboxIndex((current) => cycleImage(current, gallery.length, -1))}>Previous</button>
              <span>{(lightboxIndex ?? 0) + 1} / {gallery.length}</span>
              <button type="button" onClick={() => setLightboxIndex((current) => cycleImage(current, gallery.length, 1))}>Next</button>
              <button type="button" onClick={() => setLightboxIndex(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function cycleImage(current: number | null, total: number, direction: -1 | 1) {
  if (current === null || total <= 0) return null;
  return (current + direction + total) % total;
}

function relationshipReason(active: Inductee, related: Inductee) {
  const sharedTheme = active.themeTags.find((theme) => related.themeTags.includes(theme));
  if (active.classYear !== null && active.classYear === related.classYear) return `Class of ${active.classYear}`;
  if (sharedTheme) return `Shared theme: ${sharedTheme}`;
  if (active.region === related.region) return `Shared region: ${active.region}`;
  if (active.decade && active.decade === related.decade) return `${active.decade} inductees`;
  if (active.hasVideo && related.hasVideo) return 'Both include video';
  return 'Related story';
}
