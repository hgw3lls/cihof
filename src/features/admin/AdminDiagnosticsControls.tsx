import { useEffect, useState } from 'react';
import { buildInfo } from '../../app/buildInfo';
import type { KioskSettings } from '../../app/kioskSettings';
import { loadRuntimeDataBundle } from '../../data/runtimeDataBundle';

type AdminDiagnosticsSnapshot = {
  capturedAt: string;
  buildInfo: typeof buildInfo;
  dataSource: 'imported-browser-bundle' | 'built-in-bundle';
  url: string;
  online: boolean;
  viewport: {
    width: number;
    height: number;
    devicePixelRatio: number;
  };
  bundle: {
    appName: string;
    schemaVersion: number;
    generatedAt: string;
    inducteeCount: number;
    relationshipCount: number;
    mediaAssetCount: number;
    placeCount: number;
    sourceCurationCount: number;
  };
  storage: {
    localStorageAvailable: boolean;
    sessionStorageAvailable: boolean;
    localStorageBytes: number;
    localStorageKeys: string[];
  };
  serviceWorker: {
    supported: boolean;
    controlled: boolean;
    scope: string;
    activeState: string;
  };
  kioskSettings: KioskSettings;
  kioskHealth?: unknown;
};

export function AdminDiagnosticsControls({
  settings,
  overrideActive,
}: {
  settings: KioskSettings;
  overrideActive: boolean;
}) {
  const [snapshot, setSnapshot] = useState<AdminDiagnosticsSnapshot | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const nextSnapshot = await buildAdminDiagnosticsSnapshot(settings, overrideActive);
        if (!cancelled) {
          setSnapshot(nextSnapshot);
          setError('');
        }
      } catch (diagnosticError) {
        if (!cancelled) {
          setError(diagnosticError instanceof Error ? diagnosticError.message : 'Could not read diagnostics.');
        }
      }
    }

    void refresh();
    return () => {
      cancelled = true;
    };
  }, [overrideActive, settings]);

  return (
    <div className="admin-diagnostics">
      <p>
        Read-only kiosk diagnostics for checking the active data bundle, local storage, viewport, network state, and
        current browser settings.
      </p>

      {error && <span className="admin-data-panel__status">{error}</span>}

      {snapshot ? (
        <>
          <div className="admin-diagnostics__grid">
            <DiagnosticsCard
              title="Data"
              rows={[
                ['Source', snapshot.dataSource === 'imported-browser-bundle' ? 'Imported browser bundle' : 'Built-in bundle'],
                ['Generated', snapshot.bundle.generatedAt || 'Unknown'],
                ['Profiles', String(snapshot.bundle.inducteeCount)],
                ['Relationships', String(snapshot.bundle.relationshipCount)],
                ['Media records', String(snapshot.bundle.mediaAssetCount)],
                ['Places', String(snapshot.bundle.placeCount)],
                ['Source leads', String(snapshot.bundle.sourceCurationCount)],
              ]}
            />
            <DiagnosticsCard
              title="Runtime"
              rows={[
                ['Build mode', snapshot.buildInfo.mode],
                ['Build target', snapshot.buildInfo.buildTarget],
                ['Built at', snapshot.buildInfo.builtAt],
                ['Online', snapshot.online ? 'Yes' : 'No'],
                ['Viewport', `${snapshot.viewport.width} x ${snapshot.viewport.height}`],
                ['Pixel ratio', String(snapshot.viewport.devicePixelRatio)],
              ]}
            />
            <DiagnosticsCard
              title="Storage"
              rows={[
                ['Local storage', snapshot.storage.localStorageAvailable ? 'Available' : 'Unavailable'],
                ['Session storage', snapshot.storage.sessionStorageAvailable ? 'Available' : 'Unavailable'],
                ['Stored bytes', String(snapshot.storage.localStorageBytes)],
                ['CIHOF keys', String(snapshot.storage.localStorageKeys.length)],
                ['Service worker', snapshot.serviceWorker.supported ? snapshot.serviceWorker.activeState || 'Supported' : 'Unsupported'],
                ['Controlled page', snapshot.serviceWorker.controlled ? 'Yes' : 'No'],
              ]}
            />
            <DiagnosticsCard
              title="Settings"
              rows={[
                ['Portrait limit', String(snapshot.kioskSettings.portraitLimit)],
                ['Portrait scale', `${Math.round(snapshot.kioskSettings.portraitScale * 100)}%`],
                ['Screen scale', `${Math.round(snapshot.kioskSettings.screenScale * 100)}%`],
                ['Motion', snapshot.kioskSettings.motion],
                ['Idle reset', `${Math.round(snapshot.kioskSettings.idleTimeoutMs / 1000)}s`],
                ['Admin hotkey', snapshot.kioskSettings.adminHotkey],
              ]}
            />
          </div>

          <div className="admin-data-panel__actions">
            <button type="button" onClick={() => void refreshAdminDiagnostics(setSnapshot, setError, settings, overrideActive)}>
              Refresh Diagnostics
            </button>
            <button type="button" onClick={() => downloadJson(snapshot, diagnosticsFilename())}>
              Export Diagnostics
            </button>
          </div>
          <pre className="admin-diagnostics__json" aria-label="Diagnostics JSON preview">
            {JSON.stringify(snapshot, null, 2)}
          </pre>
        </>
      ) : (
        <span className="admin-data-panel__mode">Reading diagnostics...</span>
      )}
    </div>
  );
}

function DiagnosticsCard({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <section className="admin-diagnostics__card" aria-label={`${title} diagnostics`}>
      <h3>{title}</h3>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}


async function refreshAdminDiagnostics(
  setSnapshot: (snapshot: AdminDiagnosticsSnapshot) => void,
  setError: (error: string) => void,
  settings: KioskSettings,
  overrideActive: boolean,
) {
  try {
    setSnapshot(await buildAdminDiagnosticsSnapshot(settings, overrideActive));
    setError('');
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Could not read diagnostics.');
  }
}

async function buildAdminDiagnosticsSnapshot(settings: KioskSettings, overrideActive: boolean): Promise<AdminDiagnosticsSnapshot> {
  const bundle = await loadRuntimeDataBundle();
  const localStorageDiagnostics = readLocalStorageDiagnostics();
  const serviceWorker = await readServiceWorkerDiagnostics();
  const mediaManifest = isRecord(bundle.mediaManifest) ? bundle.mediaManifest : {};
  const mediaAssets = isRecord(mediaManifest.assets) ? mediaManifest.assets : {};
  const places = isRecord(bundle.places) && Array.isArray(bundle.places.places) ? bundle.places.places : [];
  const sourceCuration = isRecord(bundle.sourceCuration) ? bundle.sourceCuration : {};
  const sourceCurationCount = typeof sourceCuration.recordCount === 'number'
    ? sourceCuration.recordCount
    : Array.isArray(sourceCuration.curationIndex)
      ? sourceCuration.curationIndex.length
      : 0;

  return {
    capturedAt: new Date().toISOString(),
    buildInfo,
    dataSource: overrideActive ? 'imported-browser-bundle' : 'built-in-bundle',
    url: typeof window === 'undefined' ? '' : window.location.href,
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    viewport: {
      width: typeof window === 'undefined' ? 0 : window.innerWidth,
      height: typeof window === 'undefined' ? 0 : window.innerHeight,
      devicePixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio,
    },
    bundle: {
      appName: typeof bundle.appName === 'string' ? bundle.appName : '',
      schemaVersion: bundle.schemaVersion,
      generatedAt: typeof bundle.generatedAt === 'string' ? bundle.generatedAt : '',
      inducteeCount: bundle.inductees.length,
      relationshipCount: Array.isArray(bundle.relationships) ? bundle.relationships.length : 0,
      mediaAssetCount: Object.keys(mediaAssets).length,
      placeCount: places.length,
      sourceCurationCount,
    },
    storage: {
      ...localStorageDiagnostics,
      sessionStorageAvailable: canUseStorage('sessionStorage'),
    },
    serviceWorker,
    kioskSettings: settings,
    kioskHealth: typeof window === 'undefined' ? undefined : (window as Window & { __CIHOF_KIOSK_STATUS__?: unknown }).__CIHOF_KIOSK_STATUS__,
  };
}

function readLocalStorageDiagnostics() {
  if (!canUseStorage('localStorage')) {
    return {
      localStorageAvailable: false,
      localStorageBytes: 0,
      localStorageKeys: [],
    };
  }

  let localStorageBytes = 0;
  const localStorageKeys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index) ?? '';
    const value = window.localStorage.getItem(key) ?? '';
    localStorageBytes += key.length + value.length;
    if (key.startsWith('cihof.')) localStorageKeys.push(key);
  }

  return {
    localStorageAvailable: true,
    localStorageBytes,
    localStorageKeys: localStorageKeys.sort((a, b) => a.localeCompare(b)),
  };
}

async function readServiceWorkerDiagnostics() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return {
      supported: false,
      controlled: false,
      scope: '',
      activeState: '',
    };
  }

  const registration = await navigator.serviceWorker.getRegistration();
  return {
    supported: true,
    controlled: Boolean(navigator.serviceWorker.controller),
    scope: registration?.scope ?? '',
    activeState: registration?.active?.state ?? '',
  };
}

function canUseStorage(kind: 'localStorage' | 'sessionStorage') {
  if (typeof window === 'undefined') return false;
  try {
    const storage = window[kind];
    const testKey = 'cihof.storage-test';
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function diagnosticsFilename() {
  const date = new Date().toISOString().slice(0, 10);
  return `cihof-admin-diagnostics-${date}.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function downloadJson(payload: unknown, filename: string) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
