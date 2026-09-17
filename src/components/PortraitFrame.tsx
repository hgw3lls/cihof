import { FallbackImage } from './FallbackImage';

export type PortraitFrameState = 'standard' | 'focus' | 'trace' | 'legacy';
export type PortraitFrameAspect = 'tall' | 'wide';

type PortraitFrameProps = {
  name: string;
  classYear: number | null;
  imageUrl: string;
  imageAltText: string;
  fallbackLabel: string;
  state?: PortraitFrameState;
  aspect?: PortraitFrameAspect;
  showRecord?: boolean;
  classLabel?: boolean;
};

export function PortraitFrame({
  name,
  classYear,
  imageUrl,
  imageAltText,
  fallbackLabel,
  state = 'standard',
  aspect = 'tall',
  showRecord = true,
  classLabel = false,
}: PortraitFrameProps) {
  const className = [
    'portrait-frame',
    `portrait-frame--${state}`,
    `portrait-frame--${aspect}`,
    showRecord ? 'portrait-frame--with-record' : 'portrait-frame--no-record',
  ].filter(Boolean).join(' ');

  return (
    <span className={className} data-frame-state={state} data-frame-aspect={aspect}>
      <span className="portrait-frame__mat">
        <span className="portrait-frame__imageOpening">
          <FallbackImage
            alt={imageAltText || name}
            className="portrait-frame__image living-portrait__image"
            fallbackClassName="portrait-frame__fallback living-portrait__fallback"
            fallbackLabel={fallbackLabel}
            loading="eager"
            src={imageUrl}
          />
        </span>
        {showRecord && (
          <span className="portrait-frame__record living-portrait__label">
            <strong>{name}</strong>
            {classYear && <small>{classLabel ? `Class of ${classYear}` : classYear}</small>}
          </span>
        )}
      </span>
      <svg className="portrait-frame__marks" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path className="portrait-frame__mark portrait-frame__mark--focus-corner" d="M4 18 V4 H18" />
        <path className="portrait-frame__mark portrait-frame__mark--focus-rule" d="M11 4 V24" />
        <path className="portrait-frame__mark portrait-frame__mark--trace-port portrait-frame__mark--trace-port-left" d="M0 50 H8" />
        <path className="portrait-frame__mark portrait-frame__mark--trace-port portrait-frame__mark--trace-port-right" d="M92 50 H100" />
        <path className="portrait-frame__mark portrait-frame__mark--legacy-baseline" d="M36 96 H64" />
        <path className="portrait-frame__mark portrait-frame__mark--legacy-notch" d="M50 92 V100" />
      </svg>
    </span>
  );
}
