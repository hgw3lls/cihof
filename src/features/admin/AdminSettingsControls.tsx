import { FormEvent, useState } from 'react';
import { adminHotkeyOptions, type KioskSettings } from '../../app/kioskSettings';

export function AdminSettingsControls({
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
