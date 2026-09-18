import { useEffect, useState } from 'react';

type FallbackImageProps = {
  src: string;
  alt?: string;
  className?: string;
  fallbackClassName: string;
  fallbackLabel: string;
  loading?: 'eager' | 'lazy';
  showLoadingFallback?: boolean;
};

export function FallbackImage({
  src,
  alt = '',
  className,
  fallbackClassName,
  fallbackLabel,
  loading = 'lazy',
  showLoadingFallback = false,
}: FallbackImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src]);

  if (!src || failed) {
    return <span className={fallbackClassName}>{fallbackLabel}</span>;
  }

  return (
    <>
      {showLoadingFallback && !loaded && <span className={fallbackClassName} aria-hidden="true">{fallbackLabel}</span>}
      <img
        className={className}
        src={assetSrc(src)}
        alt={alt}
        loading={loading}
        decoding="async"
        draggable={false}
        style={showLoadingFallback && !loaded ? { visibility: 'hidden' } : undefined}
        onError={() => setFailed(true)}
        onLoad={(event) => {
          const image = event.currentTarget;
          if (isNearSolidBlackImage(image)) {
            setFailed(true);
            return;
          }
          if (!showLoadingFallback) return;
          const loadedSrc = image.currentSrc;
          void image.decode().catch(() => undefined).then(() => {
            if (image.isConnected && image.currentSrc === loadedSrc) setLoaded(true);
          });
        }}
      />
    </>
  );
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

function assetSrc(src: string) {
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  if (!src.startsWith('/')) return src;
  return `${import.meta.env.BASE_URL}${src.replace(/^\/+/, '')}`;
}

function isNearSolidBlackImage(image: HTMLImageElement) {
  if (image.naturalWidth < 2 || image.naturalHeight < 2) return false;

  const sampleSize = 10;
  const canvas = document.createElement('canvas');
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return false;

  try {
    context.drawImage(image, 0, 0, sampleSize, sampleSize);
    const pixels = context.getImageData(0, 0, sampleSize, sampleSize).data;
    let total = 0;
    let min = 255;
    let max = 0;

    for (let index = 0; index < pixels.length; index += 4) {
      const luminance = 0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2];
      total += luminance;
      min = Math.min(min, luminance);
      max = Math.max(max, luminance);
    }

    const average = total / (pixels.length / 4);
    return (average <= 22 && max <= 34) || (average <= 14 && max - min <= 28);
  } catch {
    return false;
  }
}
