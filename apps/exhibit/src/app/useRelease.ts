import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Registers the offline worker and reports when a newer release is waiting.
 *
 * The worker never takes over by itself. This hook holds the handover until
 * `activateWaitingRelease` is called, which the shell does at a reset — a
 * moment when nobody is mid-sentence and losing the page costs nothing.
 */
export type ReleaseState = {
  /** A newer release is installed and waiting for permission to take over. */
  readonly updateWaiting: boolean;
  readonly activateWaitingRelease: () => void;
};

export function useRelease(): ReleaseState {
  const [updateWaiting, setUpdateWaiting] = useState(false);
  const waiting = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;

    let cancelled = false;
    const url = `${import.meta.env.BASE_URL}sw.js`;

    const note = (registration: ServiceWorkerRegistration) => {
      if (cancelled || !registration.waiting) return;
      waiting.current = registration.waiting;
      setUpdateWaiting(true);
    };

    navigator.serviceWorker.register(url, { scope: import.meta.env.BASE_URL })
      .then((registration) => {
        note(registration);
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          installing?.addEventListener('statechange', () => {
            // "installed" with a controller already present means this is an
            // update rather than a first provision.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) note(registration);
          });
        });
      })
      .catch(() => { /* Offline support is an enhancement; the display still runs. */ });

    return () => { cancelled = true; };
  }, []);

  const activateWaitingRelease = useCallback(() => {
    const worker = waiting.current;
    if (!worker) return;
    worker.postMessage('activate-release');
    waiting.current = null;
    setUpdateWaiting(false);
  }, []);

  return { updateWaiting, activateWaitingRelease };
}
