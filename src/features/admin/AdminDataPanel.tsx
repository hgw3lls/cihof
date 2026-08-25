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

type AdminDataPanelProps = {
  open: boolean;
  onClose: () => void;
  settings: KioskSettings;
  onSettingsChange: (settings: KioskSettings) => void;
};

const adminSessionKey = 'cihof.admin-data.session.v1';
const adminPasscodeKey = 'cihof.admin-passcode.v1';
const configuredPasscode = String(import.meta.env.VITE_CIHOF_ADMIN_PASSCODE ?? 'cihof-admin');
type AdminSection = 'data' | 'settings';

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
            <h2>{unlocked && section === 'settings' ? 'App Settings' : 'Import / Export'}</h2>
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
            ) : (
              <AdminSettingsControls
                settings={settings}
                onChangePasscode={changeAdminPasscode}
                onLock={lock}
                onPatch={patchSettings}
                onRestoreDefaults={restoreDefaultSettings}
              />
            )}
          </div>
        )}

        {status && <div className="admin-data-panel__status" aria-live="polite">{status}</div>}
      </div>
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
