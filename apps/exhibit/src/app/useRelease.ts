import { editing } from './editor.ts';
import { useCallback, useEffect, useRef, useState } from 'react';

export type ReleaseStatus = {
  /** The release this worker script belongs to. */
  readonly worker: string;
  /** The release actually being served, which may be an earlier one. */
  readonly serving: string;
  readonly previous: string | null;
  readonly rolledBackFrom: string | null;
  readonly provisioning: {
    readonly release: string;
    readonly expected: number;
    readonly missing: readonly { readonly path: string; readonly reason: string }[];
  } | null;
  readonly releasesHeld: readonly string[];
};

/**
 * Registers the offline worker, holds a new release until it is safe to take
 * over, and exposes what staff need to recover.
 *
 * Handover happens at a reset, when nobody is mid-sentence and losing the page
 * costs nothing. It never happens on its own.
 */
export function useRelease() {
  const [updateWaiting, setUpdateWaiting] = useState(false);
  const [status, setStatus] = useState<ReleaseStatus | null>(null);
  const waiting = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    // The staff portal's copy changes with every edit: it caches nothing.
    if (!('serviceWorker' in navigator) || import.meta.env.DEV || editing) return;

    let cancelled = false;
    const onMessage = (event: MessageEvent) => {
      if (!cancelled && event.data?.type === 'release-status') setStatus(event.data as ReleaseStatus);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);

    const note = (registration: ServiceWorkerRegistration) => {
      if (cancelled || !registration.waiting) return;
      waiting.current = registration.waiting;
      setUpdateWaiting(true);
    };

    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then((registration) => {
        note(registration);
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          installing?.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) note(registration);
          });
        });
        return navigator.serviceWorker.ready;
      })
      .then(() => navigator.serviceWorker.controller?.postMessage('release-status'))
      .catch(() => { /* Offline support is an enhancement; the display still runs. */ });

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('message', onMessage);
    };
  }, []);

  const activateWaitingRelease = useCallback(() => {
    const worker = waiting.current;
    if (!worker) return;
    // The page has already read the old release's data, so once the new one
    // takes over it starts afresh on it. This is called at a reset, between
    // visitors, so nobody loses anything.
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    worker.postMessage('activate-release');
    waiting.current = null;
    setUpdateWaiting(false);
  }, []);

  const refreshStatus = useCallback(() => {
    navigator.serviceWorker?.controller?.postMessage('release-status');
  }, []);

  /** Serve the previous release. A stored decision, so nothing is reinstalled. */
  const restorePrevious = useCallback(() => {
    navigator.serviceWorker?.controller?.postMessage('restore-previous');
  }, []);

  return { updateWaiting, status, activateWaitingRelease, refreshStatus, restorePrevious };
}
