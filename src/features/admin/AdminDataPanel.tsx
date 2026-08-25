import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import {
  clearRuntimeDataBundleOverride,
  hasRuntimeDataBundleOverride,
  loadRuntimeDataBundle,
  normalizeRuntimeDataBundle,
  runtimeDataBundleFilename,
  writeRuntimeDataBundleOverride,
} from '../../data/runtimeDataBundle';
import {
  adminHotkeyOptions,
  normalizeKioskSettings,
  resetKioskSettings,
  writeKioskSettings,
  type KioskSettings,
} from '../../app/kioskSettings';
import { buildInfo } from '../../app/buildInfo';

type AdminDataPanelProps = {
  open: boolean;
  onClose: () => void;
  settings: KioskSettings;
  onSettingsChange: (settings: KioskSettings) => void;
};

const adminSessionKey = 'cihof.admin-data.session.v1';
const adminPasscodeKey = 'cihof.admin-passcode.v1';
const configuredPasscode = String(import.meta.env.VITE_CIHOF_ADMIN_PASSCODE ?? 'cihof-admin');
type AdminSection = 'data' | 'settings' | 'diagnostics';

export function AdminDataPanel({ open, onClose, settings, onSettingsChange }: AdminDataPanelProps) {
  const [unlocked, setUnlocked] = useState(() => readAdminSession());
  const [passcode, setPasscode] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [overrideActive, setOverrideActive] = useState(() => hasRuntimeDataBundleOverride());
  const [section, setSection] = useState<AdminSection>('data');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setPasscode('');
      setStatus('');
      return;
    }
    setOverrideActive(hasRuntimeDataBundleOverride());
  }, [open]);

  if (!open) return null;

  function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passcode !== readAdminPasscode()) {
      setStatus('Password did not match.');
      return;
    }
    writeAdminSession();
    setUnlocked(true);
    setPasscode('');
    setStatus('Admin data tools unlocked.');
  }

  async function exportBundle() {
    setBusy(true);
    setStatus('Preparing data export...');
    try {
      const bundle = await loadRuntimeDataBundle();
      downloadJson({
        ...bundle,
        kioskSettings: settings,
        exportedAt: new Date().toISOString(),
        exportedFrom: 'CIHOF kiosk admin panel',
      }, runtimeDataBundleFilename());
      setStatus(`Exported ${bundle.inductees.length} profile records.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not export data bundle.');
    } finally {
      setBusy(false);
    }
  }

  function importBundle(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    setStatus('Reading imported data bundle...');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? '')) as unknown;
        const bundle = normalizeRuntimeDataBundle(parsed);
        if (!bundle) throw new Error('Imported file must be a CIHOF runtime data bundle with an inductees array.');
        const importedSettings = extractKioskSettings(parsed);
        writeRuntimeDataBundleOverride(bundle);
        if (importedSettings) {
          writeKioskSettings(importedSettings);
          onSettingsChange(importedSettings);
        }
        setOverrideActive(true);
        setStatus(`Imported ${bundle.inductees.length} profile records for this browser.${importedSettings ? ' App settings restored.' : ''}`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Could not import data bundle.');
      } finally {
        setBusy(false);
      }
    };
    reader.onerror = () => {
      setBusy(false);
      setStatus('Could not read the selected file.');
    };
    reader.readAsText(file);
  }

  function clearImportedBundle() {
    clearRuntimeDataBundleOverride();
    setOverrideActive(false);
    setStatus('Cleared imported browser data. The built-in data bundle is active again.');
  }

  function patchSettings(patch: Partial<KioskSettings>) {
    const next = normalizeKioskSettings({ ...settings, ...patch });
    writeKioskSettings(next);
    onSettingsChange(next);
    setStatus('App settings saved for this browser.');
  }

  function restoreDefaultSettings() {
    const next = resetKioskSettings();
    onSettingsChange(next);
    setStatus('App settings restored to built-in defaults.');
  }

  function changeAdminPasscode(currentPasscode: string, nextPasscode: string, confirmPasscode: string) {
    if (currentPasscode !== readAdminPasscode()) {
      setStatus('Current password did not match.');
      return false;
    }
    if (nextPasscode.trim().length < 8) {
      setStatus('New password must be at least 8 characters.');
      return false;
    }
    if (nextPasscode !== confirmPasscode) {
      setStatus('New password confirmation did not match.');
      return false;
    }
    writeAdminPasscode(nextPasscode);
    setStatus('Admin password updated for this browser.');
    return true;
  }

  function lock() {
    clearAdminSession();
    setUnlocked(false);
    setStatus('');
    onClose();
  }

  return (
    <section className="admin-data-panel" aria-label="Admin data and app settings" role="dialog" aria-modal="true">
      <div className="admin-data-panel__surface">
        <header className="admin-data-panel__header">
          <div>
            <p className="museum-kicker">Admin</p>
            <h2>{unlocked ? adminSectionTitle(section) : 'Import / Export'}</h2>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </header>

        {!unlocked ? (
          <form className="admin-data-panel__form" onSubmit={unlock}>
            <label className="field">
              <span>Password</span>
              <input
                autoComplete="current-password"
                autoFocus
                type="password"
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
              />
            </label>
            <button disabled={!passcode || busy} type="submit">Unlock</button>
          </form>
        ) : (
          <div className="admin-data-panel__tools">
            <div className="admin-data-panel__nav" role="tablist" aria-label="Admin sections">
              <button
                aria-pressed={section === 'data'}
                className={section === 'data' ? 'admin-data-panel__tab admin-data-panel__tab--active' : 'admin-data-panel__tab'}
                type="button"
                onClick={() => setSection('data')}
              >
                Data File
              </button>
              <button
                aria-pressed={section === 'settings'}
                className={section === 'settings' ? 'admin-data-panel__tab admin-data-panel__tab--active' : 'admin-data-panel__tab'}
                type="button"
                onClick={() => setSection('settings')}
              >
                App Settings
              </button>
              <button
                aria-pressed={section === 'diagnostics'}
                className={section === 'diagnostics' ? 'admin-data-panel__tab admin-data-panel__tab--active' : 'admin-data-panel__tab'}
                type="button"
                onClick={() => setSection('diagnostics')}
              >
                Diagnostics
              </button>
            </div>

            {section === 'data' ? (
              <>
                <p>
                  Export the runtime data bundle or import a replacement bundle into this browser. Individual profile
                  curation stays in the separate portal app.
                </p>
                <div className="admin-data-panel__actions">
                  <button disabled={busy} type="button" onClick={() => void exportBundle()}>Export Data File</button>
                  <button disabled={busy} type="button" onClick={() => fileInputRef.current?.click()}>Import Data File</button>
                  <button disabled={busy || !overrideActive} type="button" onClick={clearImportedBundle}>Use Built-In Data</button>
                  <button disabled={busy} type="button" onClick={lock}>Lock</button>
                </div>
                <input ref={fileInputRef} accept="application/json,.json" hidden type="file" onChange={importBundle} />
                <span className={overrideActive ? 'admin-data-panel__mode admin-data-panel__mode--override' : 'admin-data-panel__mode'}>
                  {overrideActive ? 'Imported browser data is active' : 'Built-in data bundle is active'}
                </span>
              </>
            ) : section === 'settings' ? (
              <AdminSettingsControls
                settings={settings}
                onChangePasscode={changeAdminPasscode}
                onLock={lock}
                onPatch={patchSettings}
                onRestoreDefaults={restoreDefaultSettings}
              />
            ) : (
              <AdminDiagnosticsControls settings={settings} overrideActive={overrideActive} />
            )}
          </div>
        )}

        {status && <div className="admin-data-panel__status" aria-live="polite">{status}</div>}
      </div>
    </section>
  );
}

function adminSectionTitle(section: AdminSection) {
  if (section === 'settings') return 'App Settings';
  if (section === 'diagnostics') return 'Diagnostics';
  return 'Import / Export';
}

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

function AdminDiagnosticsControls({
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

function AdminSettingsControls({
  settings,
  onChangePasscode,
  onPatch,
  onRestoreDefaults,
  onLock,
}: {
  settings: KioskSettings;
  onChangePasscode: (currentPasscode: string, nextPasscode: string, confirmPasscode: string) => boolean;
  onPatch: (patch: Partial<KioskSettings>) => void;
  onRestoreDefaults: () => void;
  onLock: () => void;
}) {
  return (
    <div className="admin-settings">
      <p>
        These controls tune this kiosk/browser only. They do not change CIHOF profile records or portal curation data.
      </p>

      <div className="admin-settings__grid">
        <fieldset className="admin-settings__group">
          <legend>Screen</legend>
          <AdminRange
            label="Overall screen scale"
            value={Math.round(settings.screenScale * 100)}
            min={86}
            max={118}
            suffix="%"
            onChange={(value) => onPatch({ screenScale: value / 100 })}
          />
          <AdminRange
            label="Hall field inset"
            value={settings.fieldInsetVmin}
            min={0}
            max={8}
            step={0.5}
            suffix="vmin"
            onChange={(value) => onPatch({ fieldInsetVmin: value })}
          />
          <AdminRange
            label="Label scale"
            value={Math.round(settings.labelScale * 100)}
            min={82}
            max={120}
            suffix="%"
            onChange={(value) => onPatch({ labelScale: value / 100 })}
          />
        </fieldset>

        <fieldset className="admin-settings__group">
          <legend>Portraits</legend>
          <AdminNumber
            label="Portraits in PORTRAITS"
            value={settings.portraitLimit}
            min={24}
            max={180}
            onChange={(value) => onPatch({ portraitLimit: value })}
          />
          <AdminRange
            label="Portrait frame size"
            value={Math.round(settings.portraitScale * 100)}
            min={72}
            max={135}
            suffix="%"
            onChange={(value) => onPatch({ portraitScale: value / 100 })}
          />
          <AdminToggle
            checked={settings.showRecordLayer}
            label="Show record texture"
            onChange={(checked) => onPatch({ showRecordLayer: checked })}
          />
        </fieldset>

        <fieldset className="admin-settings__group">
          <legend>Behavior</legend>
          <AdminNumber
            label="Idle reset seconds"
            value={Math.round(settings.idleTimeoutMs / 1000)}
            min={15}
            max={1200}
            onChange={(value) => onPatch({ idleTimeoutMs: value * 1000 })}
          />
          <AdminNumber
            label="Idle warning seconds"
            value={Math.round(settings.idleWarningMs / 1000)}
            min={0}
            max={120}
            onChange={(value) => onPatch({ idleWarningMs: value * 1000 })}
          />
          <AdminNumber
            label="Attract regroup seconds"
            value={Math.round(settings.attractRegroupMs / 1000)}
            min={4}
            max={120}
            onChange={(value) => onPatch({ attractRegroupMs: value * 1000 })}
          />
        </fieldset>

        <fieldset className="admin-settings__group">
          <legend>Visibility</legend>
          <label className="admin-settings__field">
            <span>Motion</span>
            <select
              value={settings.motion}
              onChange={(event) => onPatch({ motion: event.target.value as KioskSettings['motion'] })}
            >
              <option value="standard">Standard</option>
              <option value="reduced">Reduced</option>
              <option value="none">None</option>
            </select>
          </label>
          <AdminToggle
            checked={settings.showTouchCue}
            label="Show touch cue"
            onChange={(checked) => onPatch({ showTouchCue: checked })}
          />
          <AdminToggle
            checked={settings.showVocabulary}
            label="Show theme vocabulary"
            onChange={(checked) => onPatch({ showVocabulary: checked })}
          />
        </fieldset>

        <fieldset className="admin-settings__group admin-settings__group--access">
          <legend>Admin Access</legend>
          <label className="admin-settings__field">
            <span>Admin hotkey</span>
            <select
              value={settings.adminHotkey}
              onChange={(event) => onPatch({ adminHotkey: event.target.value as KioskSettings['adminHotkey'] })}
            >
              {adminHotkeyOptions.map((hotkey) => (
                <option key={hotkey} value={hotkey}>{hotkey}</option>
              ))}
            </select>
          </label>
          <AdminPasscodeForm onChangePasscode={onChangePasscode} />
        </fieldset>
      </div>

      <div className="admin-data-panel__actions">
        <button type="button" onClick={onRestoreDefaults}>Reset Settings</button>
        <button type="button" onClick={onLock}>Lock</button>
      </div>
      <span className="admin-data-panel__mode">Settings are stored locally in this browser</span>
    </div>
  );
}

function AdminPasscodeForm({
  onChangePasscode,
}: {
  onChangePasscode: (currentPasscode: string, nextPasscode: string, confirmPasscode: string) => boolean;
}) {
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [nextPasscode, setNextPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');

  function submitPasscode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const changed = onChangePasscode(currentPasscode, nextPasscode, confirmPasscode);
    if (!changed) return;
    setCurrentPasscode('');
    setNextPasscode('');
    setConfirmPasscode('');
  }

  return (
    <form className="admin-settings__passcodeForm" onSubmit={submitPasscode}>
      <label className="admin-settings__field admin-settings__field--stacked">
        <span>Current password</span>
        <input
          autoComplete="current-password"
          type="password"
          value={currentPasscode}
          onChange={(event) => setCurrentPasscode(event.target.value)}
        />
      </label>
      <label className="admin-settings__field admin-settings__field--stacked">
        <span>New password</span>
        <input
          autoComplete="new-password"
          minLength={8}
          type="password"
          value={nextPasscode}
          onChange={(event) => setNextPasscode(event.target.value)}
        />
      </label>
      <label className="admin-settings__field admin-settings__field--stacked">
        <span>Confirm new password</span>
        <input
          autoComplete="new-password"
          minLength={8}
          type="password"
          value={confirmPasscode}
          onChange={(event) => setConfirmPasscode(event.target.value)}
        />
      </label>
      <button disabled={!currentPasscode || !nextPasscode || !confirmPasscode} type="submit">Update Password</button>
    </form>
  );
}

function AdminRange({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="admin-settings__field">
      <span>{label}</span>
      <input
        max={max}
        min={min}
        step={step}
        type="range"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <strong>{value}{suffix}</strong>
    </label>
  );
}

function AdminNumber({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="admin-settings__field">
      <span>{label}</span>
      <input
        max={max}
        min={min}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function AdminToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="admin-settings__toggle">
      <input checked={checked} type="checkbox" onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
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
      sourceCurationCount: Array.isArray(sourceCuration.curationIndex) ? sourceCuration.curationIndex.length : 0,
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

function readAdminSession() {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(adminSessionKey) === '1';
}

function readAdminPasscode() {
  if (typeof window === 'undefined') return configuredPasscode;
  return window.localStorage.getItem(adminPasscodeKey) || configuredPasscode;
}

function writeAdminPasscode(passcode: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(adminPasscodeKey, passcode);
}

function writeAdminSession() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(adminSessionKey, '1');
}

function clearAdminSession() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(adminSessionKey);
}

function extractKioskSettings(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const settings = (value as Record<string, unknown>).kioskSettings;
  return settings ? normalizeKioskSettings(settings) : null;
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
