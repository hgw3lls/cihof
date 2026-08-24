import { useEffect, useState } from 'react';

type FallbackImageProps = {
  src: string;
  alt?: string;
  className?: string;
  fallbackClassName: string;
  fallbackLabel: string;
  loading?: 'eager' | 'lazy';
};

export function FallbackImage({
  src,
  alt = '',
  className,
  fallbackClassName,
  fallbackLabel,
  loading = 'lazy',
}: FallbackImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return <span className={fallbackClassName}>{fallbackLabel}</span>;
  }

  return <img className={className} src={assetSrc(src)} alt={alt} loading={loading} decoding="async" draggable={false} onError={() => setFailed(true)} />;
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
