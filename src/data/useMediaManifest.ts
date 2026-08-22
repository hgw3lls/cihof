import { useEffect, useMemo, useState } from 'react';
import type { RuntimeAudioAsset, RuntimeImageAsset, RuntimeMediaRecord, RuntimeVideoAsset } from './types';

type MediaManifestState = {
  records: RuntimeMediaRecord[];
  loading: boolean;
  error: string;
};

const mediaManifestUrl = `${import.meta.env.BASE_URL}data/media-manifest.json`;

export function useMediaManifest(): MediaManifestState {
  const [state, setState] = useState<MediaManifestState>({ records: [], loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;

    fetch(mediaManifestUrl)
      .then((response) => {
        if (response.status === 404) return { assets: {} } as unknown;
        if (!response.ok) throw new Error(`Media manifest request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!cancelled) setState({ records: parseMediaManifest(payload), loading: false, error: '' });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ records: [], loading: false, error: error.message });
      });

    return () => {
      cancelled = true;
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
  const images = value as { primary?: unknown; gallery?: unknown; portraits?: unknown; portraitQuality?: unknown };
  const primary = normalizeImage(images.primary);

  return {
    primary,
    gallery: normalizeAssetArray<RuntimeImageAsset>(images.gallery),
    portraits: normalizePortraits(images.portraits),
    portraitQuality: normalizePlainObject<NonNullable<RuntimeMediaRecord['images']>['portraitQuality']>(images.portraitQuality),
  };
}

function normalizeImage(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as RuntimeImageAsset;
}

function normalizePortraits(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const portraits = value as { wall?: unknown; profile?: unknown; thumbnail?: unknown };
  return {
    wall: normalizeImage(portraits.wall),
    profile: normalizeImage(portraits.profile),
    thumbnail: normalizeImage(portraits.thumbnail),
  };
}

function normalizePlainObject<T>(value: unknown): T | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as T;
}

function normalizeAssetArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is T => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
}

function stringOrUndefined(value: unknown) {
  return typeof value === 'string' && value ? value : undefined;
}
