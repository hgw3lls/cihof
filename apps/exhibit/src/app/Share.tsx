import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { continuationUrl, refusalMessage } from '@cihof/content';
import type { RuntimePerson } from '../data/runtime.ts';

/**
 * Offers a visitor the same person on their own phone.
 *
 * The address is shown as text beside the code. A code is useless to anyone who
 * cannot hold a phone up to a wall at the right height, and a visitor who
 * simply wants to type it should be able to.
 */
export function Share({ person, siteBase, onClose }: {
  person: RuntimePerson;
  siteBase: string | null;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const [drawError, setDrawError] = useState('');

  const destination = continuationUrl(siteBase, person.id);

  useEffect(() => {
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    headingRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (returnTo.current?.isConnected) returnTo.current.focus();
    };
  }, [onClose]);

  useEffect(() => {
    if (!destination.ok || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, destination.url, {
      width: 420,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#151515', light: '#ffffff' },
    }).catch(() => setDrawError('The code could not be drawn on this display.'));
  }, [destination.ok, destination.ok ? destination.url : '']);

  return (
    <section className="share" role="dialog" aria-modal="true" aria-labelledby="shareTitle">
      <div className="share__panel">
        <h2 id="shareTitle" ref={headingRef} tabIndex={-1}>Keep reading about {person.name}</h2>

        {destination.ok
          ? (
            <>
              <p>Point a phone camera at the code, or type the address.</p>
              {/* A canvas cannot be read out, so the address carries the meaning. */}
              <canvas ref={canvasRef} aria-hidden="true" />
              {drawError && <p className="share__problem" role="alert">{drawError}</p>}
              <p className="share__url">{destination.url.replace(/^https:\/\//, '')}</p>
            </>
          )
          : (
            <p className="share__problem" role="status">
              {refusalMessage(destination.refusal)} The full record is on this display.
            </p>
          )}

        <button type="button" onClick={onClose}>Close</button>
      </div>
    </section>
  );
}
