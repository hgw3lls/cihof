import { useEffect, useRef } from 'react';

/**
 * Asks whether anyone is still there before the display resets.
 *
 * Focus moves here so a keyboard visitor is told, and returns to where they
 * were if they continue. Activity inside this dialog does not silently count as
 * "still here": only the button does.
 */
export function SessionWarning({ secondsRemaining, onContinue, onReset }: {
  secondsRemaining: number;
  onContinue: () => void;
  onReset: () => void;
}) {
  const continueRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    continueRef.current?.focus();
    return () => { if (returnTo.current?.isConnected) returnTo.current.focus(); };
  }, []);

  return (
    <div className="warning" data-session-warning role="alertdialog" aria-modal="true" aria-labelledby="warningTitle" aria-describedby="warningBody">
      <div className="warning__panel">
        <h2 id="warningTitle">Are you still here?</h2>
        <p id="warningBody" aria-live="polite">
          This display will start over in {secondsRemaining} second{secondsRemaining === 1 ? '' : 's'}.
        </p>
        <div className="warning__actions">
          <button ref={continueRef} type="button" onClick={onContinue}>Keep reading</button>
          <button type="button" onClick={onReset}>Start over now</button>
        </div>
      </div>
    </div>
  );
}
