import { useEffect, useMemo, useState } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import type { Inductee } from '../../data/types';

type AttractViewProps = {
  inductees: Inductee[];
  onStart: () => void;
};

const rotateMs = 6500;

export function AttractView({ inductees, onStart }: AttractViewProps) {
  const featured = useMemo(() => selectFeatured(inductees), [inductees]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (featured.length <= 1) return;
    const interval = window.setInterval(() => {
      setIndex((current) => (current + 1) % featured.length);
    }, rotateMs);

    return () => window.clearInterval(interval);
  }, [featured.length]);

  const active = featured[index] ?? inductees[0];
  const supporting = featured.filter((item) => item.id !== active?.id).slice(0, 4);

  return (
    <section className="attract" aria-label="Kiosk attract screen" onClick={onStart}>
      <button className="attract__start" type="button" onClick={onStart}>
        <span>Touch to explore</span>
      </button>

      {active && (
        <div className="attract__feature">
          <FallbackImage
            className="attract__image"
            fallbackClassName="attract__fallback"
            fallbackLabel={initials(active.name)}
            loading="eager"
            src={active.primaryImageUrl}
          />
          <div className="attract__story">
            <p className="eyebrow">Cleveland International Hall of Fame</p>
            <h2>{active.name}</h2>
            <div className="attract__meta">
              <span>{active.classYear ?? 'Year unknown'}</span>
              <span>{active.region}</span>
            </div>
            <p>{active.storySummary || summarize(active.bioText)}</p>
          </div>
        </div>
      )}

      <div className="attract__strip" aria-label="Featured inductees">
        {supporting.map((inductee) => (
          <div className="attract-card" key={inductee.id}>
            <FallbackImage fallbackClassName="attract-card__fallback" fallbackLabel={initials(inductee.name)} src={inductee.primaryImageUrl} />
            <strong>{inductee.name}</strong>
            <small>{inductee.classYear} / {inductee.region}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function selectFeatured(inductees: Inductee[]) {
  return [...inductees]
    .filter((item) => item.primaryImageUrl && item.bioText)
    .sort((a, b) => {
      const videoScore = Number(b.hasVideo) - Number(a.hasVideo);
      return videoScore || (b.classYear ?? 0) - (a.classYear ?? 0) || a.name.localeCompare(b.name);
    })
    .slice(0, 12);
}

function summarize(text: string) {
  if (text.length <= 320) return text;
  return `${text.slice(0, 320).trim()}...`;
}
