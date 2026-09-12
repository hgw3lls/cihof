import { runtimeLogger } from '../app/runtimeLogger';
import { readCachedJson, writeCachedJson } from './localDataCache';

export type RuntimeDataBundle = {
  schemaVersion: number;
  generatedAt?: string;
  appName?: string;
  source?: Record<string, unknown>;
  inductees: unknown[];
  relationships?: unknown[];
  entities?: unknown;
  entityRelationships?: unknown;
  storySections?: unknown;
  storyLenses?: unknown;
  mediaManifest?: unknown;
  archiveLeads?: unknown;
  places?: unknown;
  cityQuestion?: unknown;
  worldLens?: unknown;
  physicalWall?: unknown;
  sourceCuration?: unknown;
  reports?: Record<string, unknown>;
};

const runtimeDataBundleUrl = `${import.meta.env.BASE_URL}data/cihof-runtime-data.json`;
const bundleCacheKey = 'runtime-data-bundle';
const bundleOverrideStorageKey = 'cihof.runtime-data-bundle.override.v1';
const bundleChangeEvent = 'cihof-runtime-data-bundle-change';

let memoryBundle: RuntimeDataBundle | null = null;
let pendingBundle: Promise<RuntimeDataBundle> | null = null;

export async function loadRuntimeDataBundle(): Promise<RuntimeDataBundle> {
  const override = readRuntimeDataBundleOverride();
  if (override) return override;
  if (memoryBundle) return memoryBundle;
  if (pendingBundle) return pendingBundle;

  pendingBundle = fetch(runtimeDataBundleUrl, { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error(`Runtime data bundle request failed: ${response.status}`);
      return response.json() as Promise<unknown>;
    })
    .then((payload) => {
      const bundle = normalizeRuntimeDataBundle(payload);
      if (!bundle) throw new Error('Runtime data bundle must include an inductees array.');
      writeCachedJson(bundleCacheKey, bundle);
      memoryBundle = bundle;
      pendingBundle = null;
      return bundle;
    })
    .catch((error) => {
      pendingBundle = null;
      const cached = readCachedJson(bundleCacheKey);
      const cachedBundle = normalizeRuntimeDataBundle(cached);
      if (cachedBundle) {
        runtimeLogger.warn('Using cached runtime data bundle after load failure.', { error });
        memoryBundle = cachedBundle;
        return cachedBundle;
      }
      throw error;
    });

  return pendingBundle;
}

export function readRuntimeDataBundleOverride(): RuntimeDataBundle | null {
  if (typeof window === 'undefined') return null;

  try {
    return normalizeRuntimeDataBundle(JSON.parse(window.localStorage.getItem(bundleOverrideStorageKey) ?? 'null'));
  } catch (error) {
    runtimeLogger.warn('Could not read imported runtime data bundle.', { error });
    return null;
  }
}

export function writeRuntimeDataBundleOverride(bundle: RuntimeDataBundle) {
  if (typeof window === 'undefined') return;
  const normalized = normalizeRuntimeDataBundle(bundle);
  if (!normalized) throw new Error('Imported data bundle must include an inductees array.');
  window.localStorage.setItem(bundleOverrideStorageKey, JSON.stringify(normalized));
  memoryBundle = normalized;
  pendingBundle = null;
  dispatchRuntimeDataBundleChange();
}

export function clearRuntimeDataBundleOverride() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(bundleOverrideStorageKey);
  memoryBundle = null;
  pendingBundle = null;
  dispatchRuntimeDataBundleChange();
}

export function hasRuntimeDataBundleOverride() {
  return Boolean(readRuntimeDataBundleOverride());
}

export function normalizeRuntimeDataBundle(value: unknown): RuntimeDataBundle | null {
  if (!isRecord(value)) return null;
  const inductees = Array.isArray(value.inductees) ? value.inductees : null;
  if (!inductees) return null;

  return {
    ...value,
    schemaVersion: typeof value.schemaVersion === 'number' ? value.schemaVersion : 1,
    inductees,
    relationships: Array.isArray(value.relationships) ? value.relationships : [],
  };
}

export function subscribeRuntimeDataBundleChanges(callback: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(bundleChangeEvent, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(bundleChangeEvent, callback);
    window.removeEventListener('storage', callback);
  };
}

export function runtimeDataBundleFilename() {
  const date = new Date().toISOString().slice(0, 10);
  return `cihof-runtime-data-${date}.json`;
}

function dispatchRuntimeDataBundleChange() {
  window.dispatchEvent(new CustomEvent(bundleChangeEvent));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
