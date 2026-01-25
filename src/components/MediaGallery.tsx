import { useMemo, useState } from 'react';

const MediaGallery = ({
  images,
  placeholder,
  alt,
}: {
  images: string[];
  placeholder: string;
  alt: string;
}) => {
  const galleryImages = useMemo(
    () => (images.length > 0 ? images : [placeholder]),
    [images, placeholder]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const currentImage = galleryImages[activeIndex] ?? placeholder;

  return (
    <div className="media-gallery">
      <img src={currentImage} alt={alt} loading="lazy" />
      {galleryImages.length > 1 && (
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
    </div>
  );
};

export default MediaGallery;
