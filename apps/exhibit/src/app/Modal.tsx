import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A modal layer built on the browser's own dialog.
 *
 * Every panel here previously declared `aria-modal="true"` while leaving Tab
 * free to wander into the page behind it. That is worse than not claiming it:
 * a screen reader is told the rest of the display is inert while a keyboard
 * still walks straight out of the dialog into content that cannot be seen.
 *
 * `showModal()` makes the claim true. The browser traps focus, makes the rest
 * of the document inert, puts the panel in the top layer so stacking is not a
 * z-index argument, and raises `cancel` for Escape. Doing it by hand means
 * reimplementing all of that, and getting the edges wrong.
 */
export function Modal({ className, labelledBy, label, alert = false, onClose, children }: {
  className: string;
  labelledBy?: string;
  label?: string;
  /** An alertdialog interrupts; a dialog is merely on top. */
  alert?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();

    // showModal focuses the first focusable child, which is usually a Close
    // button. Preferring a marked element lets a panel open on its heading, so
    // the first thing announced is whose panel this is.
    const preferred = dialog?.querySelector<HTMLElement>('[data-autofocus]');
    preferred?.focus();

    return () => {
      dialog?.close();
      // Put the visitor back on the control they opened this from. Without it
      // they land at the top of the document with no idea where they were.
      if (returnTo.current?.isConnected) returnTo.current.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={className}
      role={alert ? 'alertdialog' : undefined}
      aria-labelledby={labelledBy}
      aria-label={label}
      onCancel={(event) => {
        // Escape closes this layer and only this layer. Handling it rather than
        // letting the dialog close itself keeps React's state the source of
        // truth for what is open.
        event.preventDefault();
        onClose();
      }}
    >
      {children}
    </dialog>
  );
}
