import { runtimeLogger } from './runtimeLogger';

export function registerServiceWorker() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;

  const swUrl = `${import.meta.env.BASE_URL}sw.js`;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl)
        .then((registration) => {
          runtimeLogger.debug('Service worker registered.', {
            scope: registration.scope,
            activeState: registration.active?.state ?? '',
          });
      })
      .catch((error: Error) => {
        runtimeLogger.warn('Service worker registration failed.', { error: error.message });
      });
  }, { once: true });
}
