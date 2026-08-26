import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { installationConfig } from '../config/installationConfig';

type QRCodePanelProps = {
  value: string;
  title: string;
  instruction: string;
  autoCloseMs?: number;
  ariaLabel?: string;
  className?: string;
  onAutoClose?: () => void;
  onClose?: () => void;
};

export function QRCodePanel({
  value,
  title,
  instruction,
  autoCloseMs = installationConfig.qr.autoCloseMs,
  ariaLabel,
  className = '',
  onAutoClose,
  onClose,
}: QRCodePanelProps) {
  const [qrSource, setQrSource] = useState('');
  const [error, setError] = useState('');
  const timeoutRef = useRef<number | null>(null);
  const safeValue = useMemo(() => value.trim(), [value]);
  const rootClassName = ['qr-continuation', className].filter(Boolean).join(' ');

  useEffect(() => {
    let cancelled = false;
    setQrSource('');
    setError('');
    if (!safeValue) {
      setError('No continuation link is available.');
      return undefined;
    }

    QRCode.toString(safeValue, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 4,
      color: {
        dark: '#000000ff',
        light: '#ffffffff',
      },
    })
      .then((svg) => {
        if (cancelled) return;
        setQrSource(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      })
      .catch(() => {
        if (cancelled) return;
        setError('QR code unavailable.');
      });

    return () => {
      cancelled = true;
    };
  }, [safeValue]);

  useEffect(() => {
    if (!onAutoClose || autoCloseMs <= 0) return undefined;

    const resetTimer = () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        onAutoClose();
      }, autoCloseMs);
    };

    resetTimer();
    window.addEventListener('pointerdown', resetTimer, { passive: true });
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('touchstart', resetTimer, { passive: true });

    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      window.removeEventListener('pointerdown', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
    };
  }, [autoCloseMs, onAutoClose]);

  return (
    <section className={rootClassName} aria-label={ariaLabel ?? `Take ${title} record with you`}>
      <div className="qr-continuation__copy">
        <p className="museum-kicker">Take It With You</p>
        <h3>{title}</h3>
        <span>{instruction}</span>
        <small>{safeValue}</small>
        {onClose && (
          <button className="qr-continuation__close" type="button" onClick={onClose}>
            Return To Portrait
          </button>
        )}
      </div>

      <div className="qr-continuation__code" aria-label="QR code">
        {qrSource && <img alt={`QR code for ${title}`} src={qrSource} />}
        {!qrSource && !error && <span>Preparing QR</span>}
        {error && <span>{error}</span>}
      </div>
    </section>
  );
}
