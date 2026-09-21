import { Modal } from './Modal.tsx';

/**
 * Asks whether anyone is still there before the display resets.
 *
 * An alertdialog rather than a dialog: it interrupts, because the next thing
 * that happens is the visitor's reading disappearing. Escape means "I am
 * here", which is the kindest reading of someone pressing a key — it is the
 * same answer as the button they would otherwise have to find.
 */
export function SessionWarning({ secondsRemaining, onContinue, onReset }: {
  secondsRemaining: number;
  onContinue: () => void;
  onReset: () => void;
}) {
  return (
    <Modal className="warning" labelledBy="warningTitle" alert onClose={onContinue}>
      <div className="warning__panel" data-session-warning>
        <h2 id="warningTitle">Are you still here?</h2>
        <p aria-live="polite">
          This display will start over in {secondsRemaining} second{secondsRemaining === 1 ? '' : 's'}.
        </p>
        <div className="warning__actions">
          <button type="button" data-autofocus onClick={onContinue}>Keep reading</button>
          <button type="button" onClick={onReset}>Start over now</button>
        </div>
      </div>
    </Modal>
  );
}
