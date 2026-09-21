import { runtimeLogger } from '../app/runtimeLogger';
import { installationConfig } from '../config/installationConfig';

const prefix = 'cihof.data-cache.v1.';
const maxEntryBytes = 1_500_000;

export function readCachedJson(key: string): unknown | null {
  if (!installationConfig.features.dataCache || typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(`${prefix}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch (error) {
    runtimeLogger.warn('Could not read cached data.', { key, error });
    return null;
  }
}

export function writeCachedJson(key: string, value: unknown) {
  if (!installationConfig.features.dataCache || typeof window === 'undefined') return;

  try {
    const storageKey = `${prefix}${key}`;
    const serialized = JSON.stringify(value);
    if (serialized.length > maxEntryBytes) {
      window.localStorage.removeItem(storageKey);
      runtimeLogger.debug('Skipped oversized local data cache entry; offline assets remain available through the service worker.', {
        key,
        bytes: serialized.length,
      });
      return;
    }
    window.localStorage.setItem(storageKey, serialized);
  } catch (error) {
    runtimeLogger.warn('Could not write cached data.', { key, error });
  }
}
