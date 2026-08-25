import { installationConfig, type AnimationIntensity } from '../config/installationConfig';

export type KioskSettings = {
  portraitLimit: number;
  portraitScale: number;
  screenScale: number;
  fieldInsetVmin: number;
  labelScale: number;
  idleTimeoutMs: number;
  idleWarningMs: number;
  attractRegroupMs: number;
  motion: AnimationIntensity;
  showTouchCue: boolean;
  showVocabulary: boolean;
  showRecordLayer: boolean;
  adminHotkey: AdminHotkey;
};

export type AdminHotkey =
  | 'Ctrl+Alt+A'
  | 'Ctrl+Alt+H'
  | 'Ctrl+Shift+A'
  | 'Ctrl+Shift+H'
  | 'Alt+Shift+A'
  | 'Alt+Shift+H'
  | 'Meta+Alt+A';

export const kioskSettingsStorageKey = 'cihof.kiosk-settings.v1';
export const kioskSettingsChangedEvent = 'cihof:kiosk-settings-changed';
export const adminHotkeyOptions: AdminHotkey[] = [
  'Ctrl+Alt+A',
  'Ctrl+Alt+H',
  'Ctrl+Shift+A',
  'Ctrl+Shift+H',
  'Alt+Shift+A',
  'Alt+Shift+H',
  'Meta+Alt+A',
];

export const defaultKioskSettings: KioskSettings = {
  portraitLimit: 111,
  portraitScale: 1,
  screenScale: 1,
  fieldInsetVmin: 0,
  labelScale: 1,
  idleTimeoutMs: installationConfig.idle.timeoutMs,
  idleWarningMs: installationConfig.idle.warningMs,
  attractRegroupMs: installationConfig.attractLoop.regroupMs,
  motion: installationConfig.animationIntensity,
  showTouchCue: true,
  showVocabulary: true,
  showRecordLayer: true,
  adminHotkey: 'Ctrl+Alt+A',
};

export function readKioskSettings(): KioskSettings {
  if (typeof window === 'undefined') return defaultKioskSettings;

  try {
    const raw = window.localStorage.getItem(kioskSettingsStorageKey);
    if (!raw) return defaultKioskSettings;
    return normalizeKioskSettings(JSON.parse(raw));
  } catch {
    return defaultKioskSettings;
  }
}

export function writeKioskSettings(settings: KioskSettings) {
  if (typeof window === 'undefined') return;
  const normalized = normalizeKioskSettings(settings);
  window.localStorage.setItem(kioskSettingsStorageKey, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent<KioskSettings>(kioskSettingsChangedEvent, { detail: normalized }));
}

export function resetKioskSettings() {
  if (typeof window === 'undefined') return defaultKioskSettings;
  window.localStorage.removeItem(kioskSettingsStorageKey);
  window.dispatchEvent(new CustomEvent<KioskSettings>(kioskSettingsChangedEvent, { detail: defaultKioskSettings }));
  return defaultKioskSettings;
}

export function subscribeKioskSettings(callback: (settings: KioskSettings) => void) {
  if (typeof window === 'undefined') return () => {};

  function onSettingsChanged(event: Event) {
    const customEvent = event as CustomEvent<KioskSettings>;
    callback(normalizeKioskSettings(customEvent.detail));
  }

  function onStorage(event: StorageEvent) {
    if (event.key !== kioskSettingsStorageKey) return;
    callback(readKioskSettings());
  }

  window.addEventListener(kioskSettingsChangedEvent, onSettingsChanged);
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener(kioskSettingsChangedEvent, onSettingsChanged);
    window.removeEventListener('storage', onStorage);
  };
}

export function normalizeKioskSettings(value: unknown): KioskSettings {
  const source = isRecord(value) ? value : {};
  const idleTimeoutMs = numberSetting(source.idleTimeoutMs, defaultKioskSettings.idleTimeoutMs, 15_000, 20 * 60_000);
  const idleWarningMs = Math.min(
    numberSetting(source.idleWarningMs, defaultKioskSettings.idleWarningMs, 0, 120_000),
    Math.max(0, idleTimeoutMs - 1_000),
  );

  return {
    portraitLimit: Math.round(numberSetting(source.portraitLimit, defaultKioskSettings.portraitLimit, 24, 180)),
    portraitScale: numberSetting(source.portraitScale, defaultKioskSettings.portraitScale, 0.72, 1.35),
    screenScale: numberSetting(source.screenScale, defaultKioskSettings.screenScale, 0.86, 1.18),
    fieldInsetVmin: numberSetting(source.fieldInsetVmin, defaultKioskSettings.fieldInsetVmin, 0, 8),
    labelScale: numberSetting(source.labelScale, defaultKioskSettings.labelScale, 0.82, 1.2),
    idleTimeoutMs,
    idleWarningMs,
    attractRegroupMs: numberSetting(source.attractRegroupMs, defaultKioskSettings.attractRegroupMs, 4_000, 120_000),
    motion: normalizeMotion(source.motion),
    showTouchCue: booleanSetting(source.showTouchCue, defaultKioskSettings.showTouchCue),
    showVocabulary: booleanSetting(source.showVocabulary, defaultKioskSettings.showVocabulary),
    showRecordLayer: booleanSetting(source.showRecordLayer, defaultKioskSettings.showRecordLayer),
    adminHotkey: normalizeAdminHotkey(source.adminHotkey),
  };
}

export function normalizeAdminHotkey(value: unknown): AdminHotkey {
  return adminHotkeyOptions.includes(value as AdminHotkey) ? value as AdminHotkey : defaultKioskSettings.adminHotkey;
}

export function matchesAdminHotkey(event: KeyboardEvent, hotkey: AdminHotkey) {
  const parts = hotkey.split('+');
  const key = parts[parts.length - 1]?.toLowerCase() ?? '';
  const modifiers = new Set(parts.slice(0, -1));
  const codeKey = event.code.startsWith('Key') ? event.code.slice(3).toLowerCase() : event.key.toLowerCase();

  return (event.key.toLowerCase() === key || codeKey === key)
    && event.ctrlKey === modifiers.has('Ctrl')
    && event.altKey === modifiers.has('Alt')
    && event.shiftKey === modifiers.has('Shift')
    && event.metaKey === modifiers.has('Meta');
}

function numberSetting(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function booleanSetting(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return fallback;
}

function normalizeMotion(value: unknown): AnimationIntensity {
  if (value === 'none' || value === 'reduced' || value === 'standard') return value;
  return defaultKioskSettings.motion;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
