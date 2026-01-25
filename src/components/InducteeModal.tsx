import { useMemo, useState } from 'react';
import type { Inductee } from '../types';

const isYouTubeSearchLink = (url: string) => url.includes('youtube.com/results');

const isYouTubeEmbed = (url: string) =>
  url.includes('youtube.com/embed') || url.includes('youtube-nocookie.com/embed');

const InducteeModal = ({
  inductee,
  localImages,
  placeholder,
  onClose,
}: {
  inductee: Inductee;
  localImages: string[];
  placeholder: string;
  onClose: () => void;
}) => {
  const images = useMemo(
    () => (localImages.length > 0 ? localImages : [placeholder]),
    [localImages, placeholder]
  );
  const [activeIndex, setActiveIndex] = useState(0);

  const currentImage = images[activeIndex] ?? placeholder;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="modal-header">
          <div>
            <h2>{inductee.name}</h2>
            <p className="modal-meta">
              Class of {inductee.class_year} · {inductee.region}
            </p>
            <p className="modal-meta">Inducted by: {inductee.inducted_by}</p>
          </div>
        </div>

        <div className="modal-content">
          <div className="modal-gallery">
            <img src={currentImage} alt={inductee.name} />
            {images.length > 1 && (
              <div className="carousel-controls">
                <button
                  onClick={() => setActiveIndex((prev) => (prev - 1 + images.length) % images.length)}
                >
                  Previous
                </button>
                <span>
                  {activeIndex + 1} / {images.length}
                </span>
                <button onClick={() => setActiveIndex((prev) => (prev + 1) % images.length)}>
                  Next
                </button>
              </div>
            )}
          </div>
          <div className="modal-bio">
            <h3>Biography</h3>
            <p>{inductee.bio_text}</p>
          </div>
        </div>

        {inductee.videos.length > 0 && (
          <div className="modal-videos">
            <h3>Videos</h3>
            <div className="video-grid">
              {inductee.videos.map((video) => {
                if (isYouTubeSearchLink(video)) {
                  return (
                    <a
                      key={video}
                      href={video}
                      className="video-link"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Search on YouTube
                    </a>
                  );
                }
                if (isYouTubeEmbed(video)) {
                  return (
                    <iframe
                      key={video}
                      src={video}
                      title="Inductee video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  );
                }
                return (
                  <a key={video} href={video} className="video-link" target="_blank" rel="noreferrer">
                    Watch video
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InducteeModal;
