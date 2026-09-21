import { buildInfo } from '../app/buildInfo';
import { runtimeLogger } from '../app/runtimeLogger';
import { installationConfig } from '../config/installationConfig';

const prefix = 'cihof.data-cache.v2.';
const maxEntryBytes = 1_500_000;

// Entries are stamped with the content revision they were written from. A cache
// written by an earlier release is not served, so a record withdrawn in a later
// release cannot reappear from local storage.
type CacheEnvelope = { contentRevision: string; value: unknown };

export function readCachedJson(key: string): unknown | null {
  if (!installationConfig.features.dataCache || typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(`${prefix}${key}`);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as CacheEnvelope | null;
    if (!envelope || typeof envelope !== 'object' || !('contentRevision' in envelope)) return null;
    if (envelope.contentRevision !== buildInfo.contentRevision) {
      runtimeLogger.debug('Discarded cached data written from a different content revision.', {
        key,
        cached: envelope.contentRevision,
        expected: buildInfo.contentRevision,
      });
      window.localStorage.removeItem(`${prefix}${key}`);
      return null;
    }
    return envelope.value;
  } catch (error) {
    runtimeLogger.warn('Could not read cached data.', { key, error });
    return null;
  }
}

export function writeCachedJson(key: string, value: unknown) {
  if (!installationConfig.features.dataCache || typeof window === 'undefined') return;

  try {
    const storageKey = `${prefix}${key}`;
    const envelope: CacheEnvelope = { contentRevision: buildInfo.contentRevision, value };
    const serialized = JSON.stringify(envelope);
    if (serialized.length > maxEntryBytes) {
      window.localStorage.removeItem(storageKey);
      // Loud enough to notice. A payload that outgrows this cap silently removes
      // a fallback callers still believe they have; that is exactly how the
      // runtime bundle's fallback became unreachable.
      runtimeLogger.warn('Local data cache entry exceeds the storage cap and was not written; this key has no local fallback.', {
        key,
        bytes: serialized.length,
        capBytes: maxEntryBytes,
      });
      return;
    }
    window.localStorage.setItem(storageKey, serialized);
  } catch (error) {
    runtimeLogger.warn('Could not write cached data.', { key, error });
  }
}
