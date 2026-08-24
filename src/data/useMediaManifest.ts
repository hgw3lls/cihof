import { useEffect, useMemo, useState } from 'react';
import { runtimeLogger } from '../app/runtimeLogger';
import { readCachedJson, writeCachedJson } from './localDataCache';
import type { RuntimeAudioAsset, RuntimeImageAsset, RuntimeMediaRecord, RuntimeVideoAsset } from './types';

type MediaManifestState = {
  records: RuntimeMediaRecord[];
  loading: boolean;
  error: string;
};

const mediaManifestUrl = `${import.meta.env.BASE_URL}data/media-manifest.json`;
const cacheKey = 'media-manifest';

export function useMediaManifest(): MediaManifestState {
  const [state, setState] = useState<MediaManifestState>({ records: [], loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetch(mediaManifestUrl, { signal: controller.signal })
      .then((response) => {
        if (response.status === 404) return { assets: {} } as unknown;
        if (!response.ok) throw new Error(`Media manifest request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        writeCachedJson(cacheKey, payload);
        if (!cancelled) setState({ records: parseMediaManifest(payload), loading: false, error: '' });
      })
      .catch((error: Error) => {
        if (controller.signal.aborted || cancelled) return;
        const cached = readCachedJson(cacheKey);
        if (cached) {
          runtimeLogger.warn('Using cached media manifest after load failure.', { error: error.message });
          setState({ records: parseMediaManifest(cached), loading: false, error: '' });
          return;
        }
        setState({ records: [], loading: false, error: offlineAwareError(error.message, 'Media manifest could not be loaded.') });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return state;
}

export function useMediaRecordMap(records: RuntimeMediaRecord[]) {
  return useMemo(() => new Map(records.map((record) => [record.id, record])), [records]);
}

function parseMediaManifest(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const assets = (payload as { assets?: unknown }).assets;
  if (!assets || typeof assets !== 'object' || Array.isArray(assets)) return [];

  return Object.entries(assets)
    .map(([id, record]) => normalizeMediaRecord(id, record))
    .filter((record): record is RuntimeMediaRecord => Boolean(record));
}

function normalizeMediaRecord(id: string, value: unknown): RuntimeMediaRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Partial<RuntimeMediaRecord>;

  return {
    ...record,
    id: typeof record.id === 'string' && record.id ? record.id : id,
    name: stringOrUndefined(record.name),
    videos: normalizeAssetArray<RuntimeVideoAsset>(record.videos),
    audio: normalizeAssetArray<RuntimeAudioAsset>(record.audio),
    oralHistories: normalizeAssetArray<RuntimeAudioAsset>(record.oralHistories),
    images: normalizeImages(record.images),
  };
}

function normalizeImages(value: unknown): RuntimeMediaRecord['images'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const images = value as { primary?: unknown; gallery?: unknown };
  const primary = normalizeImage(images.primary);

  return {
    primary,
    gallery: normalizeAssetArray<RuntimeImageAsset>(images.gallery),
  };
}

function normalizeImage(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as RuntimeImageAsset;
}

function normalizeAssetArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is T => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
}

function stringOrUndefined(value: unknown) {
  return typeof value === 'string' && value ? value : undefined;
}

function offlineAwareError(message: string, fallback: string) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return `${fallback} The browser is offline.`;
  return message || fallback;
}
