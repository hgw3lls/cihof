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
  normalizeKioskSettings,
  resetKioskSettings,
  writeKioskSettings,
  type KioskSettings,
} from '../../app/kioskSettings';
import { AdminDiagnosticsControls } from './AdminDiagnosticsControls';
import { AdminReviewQueue } from './AdminReviewQueue';
import { AdminSettingsControls } from './AdminSettingsControls';

type AdminDataPanelProps = {
  open: boolean;
  onClose: () => void;
  settings: KioskSettings;
  onSettingsChange: (settings: KioskSettings) => void;
  archiveOnly?: boolean;
};

const adminSessionKey = 'cihof.admin-data.session.v1';
const adminPasscodeKey = 'cihof.admin-passcode.v1';
const localDevPasscode = 'cihof-admin';
const configuredPasscode = String(import.meta.env.VITE_CIHOF_ADMIN_PASSCODE ?? '').trim();
type AdminSection = 'data' | 'settings' | 'review' | 'diagnostics';

export function AdminDataPanel({ open, onClose, settings, onSettingsChange, archiveOnly = false }: AdminDataPanelProps) {
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
    const activePasscode = readAdminPasscode();
    if (!activePasscode) {
      setStatus('Admin password is not configured for this build.');
      return;
    }
    if (passcode !== activePasscode) {
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
    const activePasscode = readAdminPasscode();
    if (!activePasscode) {
      setStatus('Admin password is not configured for this build.');
      return false;
    }
    if (currentPasscode !== activePasscode) {
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
                aria-pressed={section === 'review'}
                className={section === 'review' ? 'admin-data-panel__tab admin-data-panel__tab--active' : 'admin-data-panel__tab'}
                type="button"
                onClick={() => setSection('review')}
              >
                Review Queue
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
                archiveOnly={archiveOnly}
                settings={settings}
                onChangePasscode={changeAdminPasscode}
                onLock={lock}
                onPatch={patchSettings}
                onRestoreDefaults={restoreDefaultSettings}
              />
            ) : section === 'review' ? (
              <AdminReviewQueue overrideActive={overrideActive} />
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
  if (section === 'review') return 'Review Queue';
  if (section === 'diagnostics') return 'Diagnostics';
  return 'Import / Export';
}




function readAdminSession() {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(adminSessionKey) === '1';
}

function readAdminPasscode() {
  const bundledPasscode = configuredPasscode || (import.meta.env.DEV ? localDevPasscode : '');
  if (typeof window === 'undefined') return bundledPasscode;
  return window.localStorage.getItem(adminPasscodeKey) || bundledPasscode;
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
