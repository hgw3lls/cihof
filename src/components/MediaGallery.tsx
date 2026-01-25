import { useMemo, useState } from 'react';

const MediaGallery = ({
  images,
  placeholder,
  alt,
  variant = 'default',
}: {
  images: string[];
  placeholder: string;
  alt: string;
  variant?: 'default' | 'brutalist';
}) => {
  const galleryImages = useMemo(
    () => (images.length > 0 ? images : [placeholder]),
    [images, placeholder]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const currentImage = galleryImages[activeIndex] ?? placeholder;
  const isBrutalist = variant === 'brutalist';

  return (
    <div className={`media-gallery${isBrutalist ? ' media-gallery--brutalist' : ''}`}>
      <img src={currentImage} alt={alt} loading="lazy" />
      {galleryImages.length > 1 && !isBrutalist && (
        <div className="carousel-controls">
          <button
            onClick={() =>
              setActiveIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length)
            }
          >
            Previous
          </button>
          <span>
            {activeIndex + 1} / {galleryImages.length}
          </span>
          <button onClick={() => setActiveIndex((prev) => (prev + 1) % galleryImages.length)}>
            Next
          </button>
        </div>
      )}
      {galleryImages.length > 1 && isBrutalist && (
        <div className="media-gallery__strip" role="list">
          {galleryImages.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`media-gallery__thumb${index === activeIndex ? ' is-active' : ''}`}
              aria-label={`Show image ${index + 1}`}
            >
              <img src={image} alt={`${alt} thumbnail ${index + 1}`} loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MediaGallery;
