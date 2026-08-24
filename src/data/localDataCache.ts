import { runtimeLogger } from '../app/runtimeLogger';
import { installationConfig } from '../config/installationConfig';

const prefix = 'cihof.data-cache.v1.';

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
    window.localStorage.setItem(`${prefix}${key}`, JSON.stringify(value));
  } catch (error) {
    runtimeLogger.warn('Could not write cached data.', { key, error });
  }
}
