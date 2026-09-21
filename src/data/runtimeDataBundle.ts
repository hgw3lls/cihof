import { buildInfo } from '../app/buildInfo';
import { runtimeLogger } from '../app/runtimeLogger';
import { validateRuntimeBundleForTarget, type VisitorContentTarget } from './publicationPolicy';

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
  contentContract?: unknown;
  places?: unknown;
  cityQuestion?: unknown;
  worldLens?: unknown;
  physicalWall?: unknown;
  sourceCuration?: unknown;
  reports?: Record<string, unknown>;
};

const runtimeDataBundleUrl = `${import.meta.env.BASE_URL}data/cihof-runtime-data.json`;
const bundleOverrideStorageKey = 'cihof.runtime-data-bundle.override.v1';
const bundleChangeEvent = 'cihof-runtime-data-bundle-change';

/** What an import is checked against: this artifact's own content contract. */
export const bundleExpectations = { schemaVersion: buildInfo.contentSchemaVersion };
const visitorTarget: VisitorContentTarget = buildInfo.buildTarget === 'public' ? 'public' : 'kiosk';

/**
 * Open question Q4 (cihof-evidence-led-plan/DECISIONS.md): does a staff import
 * survive Start Over on an unattended terminal?
 *
 * Default `false` — the import survives. An idle reset fires after a couple of
 * minutes of inactivity, so clearing on reset would discard a deliberate staff
 * import within minutes of making it and make the feature unusable. The risk
 * that motivated the question is that an import persists unnoticed; that is
 * addressed by showing it and making it clearable without the passcode, not by
 * discarding it.
 *
 * This is a content and installation decision, not an engineering one. Flip the
 * constant if the owners decide otherwise.
 */
export const clearImportOnSessionReset = false;

export type ImportedBundleDescriptor = {
  contentRevision: string;
  importedAt: string;
  /** True when the import's revision differs from the one this artifact shipped. */
  differsFromBuild: boolean;
};

let memoryBundle: RuntimeDataBundle | null = null;
let pendingBundle: Promise<RuntimeDataBundle> | null = null;

// Validation walks every published reference in a multi-megabyte bundle, and the
// read runs on common render paths. Memoise on the raw stored string so repeated
// reads are free while any edit to the entry still forces a fresh check.
let overrideMemo: { raw: string; result: StoredOverride | null } | null = null;

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
      memoryBundle = bundle;
      pendingBundle = null;
      return bundle;
    })
    .catch((error) => {
      // There is deliberately no local fallback here. The previous one wrote to
      // localStorage behind a 1.5 MB cap while this payload is over 3 MB, so it
      // never stored and its read could never return. Offline continuity is the
      // service worker's job; see EV-03.
      pendingBundle = null;
      throw error;
    });

  return pendingBundle;
}

export function readRuntimeDataBundleOverride(): RuntimeDataBundle | null {
  return readStoredOverride()?.bundle ?? null;
}

/** Identifies an active import for display. Null when the built-in bundle is live. */
export function readRuntimeDataBundleOverrideDescriptor(): ImportedBundleDescriptor | null {
  const stored = readStoredOverride();
  if (!stored) return null;
  return {
    contentRevision: stored.contentRevision,
    importedAt: stored.importedAt,
    differsFromBuild: stored.contentRevision !== buildInfo.contentRevision,
  };
}

/**
 * Applies an imported bundle after it passes the same publication selectors the
 * build uses. Throws with the reasons when it does not, so the caller can show
 * them rather than reporting a generic failure.
 */
export function writeRuntimeDataBundleOverride(bundle: unknown) {
  if (typeof window === 'undefined') return;

  const validation = validateRuntimeBundleForTarget(bundle, visitorTarget, bundleExpectations);
  if (!validation.ok) throw new Error(validation.reasons.join(' '));

  const normalized = normalizeRuntimeDataBundle(validation.bundle);
  if (!normalized) throw new Error('Imported data bundle must include an inductees array.');

  const stored: StoredOverride = {
    version: 2,
    importedAt: new Date().toISOString(),
    contentRevision: validation.contentRevision,
    bundle: normalized,
  };
  window.localStorage.setItem(bundleOverrideStorageKey, JSON.stringify(stored));
  overrideMemo = null;
  memoryBundle = normalized;
  pendingBundle = null;
  dispatchRuntimeDataBundleChange();
}

type StoredOverride = {
  version: 2;
  importedAt: string;
  contentRevision: string;
  bundle: RuntimeDataBundle;
};

/**
 * Reads and re-validates the stored import on every access.
 *
 * Re-validating rather than trusting what was written matters: the entry is in
 * localStorage, which anything with access to this browser can edit, and an
 * artifact updated since the import may no longer read that schema. An entry
 * that no longer passes is discarded and logged rather than served.
 */
function readStoredOverride(): StoredOverride | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(bundleOverrideStorageKey) ?? '';
  if (overrideMemo && overrideMemo.raw === raw) return overrideMemo.result;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw || 'null');
  } catch (error) {
    runtimeLogger.warn('Could not read imported runtime data bundle.', { error });
    overrideMemo = { raw, result: null };
    return null;
  }
  if (!parsed) {
    overrideMemo = { raw, result: null };
    return null;
  }

  const wrapper = isRecord(parsed) && parsed.version === 2 ? parsed : null;
  const candidate = wrapper ? wrapper.bundle : parsed;

  const validation = validateRuntimeBundleForTarget(candidate, visitorTarget, bundleExpectations);
  if (!validation.ok) {
    runtimeLogger.warn('Discarded a stored data import that no longer passes publication checks.', { reasons: validation.reasons });
    window.localStorage.removeItem(bundleOverrideStorageKey);
    overrideMemo = { raw: '', result: null };
    return null;
  }

  const normalized = normalizeRuntimeDataBundle(validation.bundle);
  if (!normalized) {
    overrideMemo = { raw, result: null };
    return null;
  }

  const result: StoredOverride = {
    version: 2,
    importedAt: typeof wrapper?.importedAt === 'string' ? wrapper.importedAt : 'unknown',
    contentRevision: validation.contentRevision,
    bundle: normalized,
  };
  overrideMemo = { raw, result };
  return result;
}

export function clearRuntimeDataBundleOverride() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(bundleOverrideStorageKey);
  overrideMemo = null;
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
