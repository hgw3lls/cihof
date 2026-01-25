export type AppMode = 'option1' | 'option2';

const MODE_STORAGE_KEY = 'cihof-mode-override';

export const normalizeMode = (value: string | undefined | null): AppMode | null => {
  if (!value) {
    return null;
  }
  const normalized = value.toLowerCase();
  if (normalized === 'option1' || normalized === 'option2') {
    return normalized;
  }
  return null;
};

export const getStoredModeOverride = (): AppMode | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
    return normalizeMode(stored);
  } catch {
    return null;
  }
};

export const setStoredModeOverride = (mode: AppMode | null) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    if (!mode) {
      window.localStorage.removeItem(MODE_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage failures to keep kiosk usable.
  }
};

const getEnvMode = (): AppMode | null => {
  const env = import.meta.env as Record<string, string | boolean | undefined>;
  const rawMode =
    env.VITE_CIHOF_MODE ??
    (typeof env.NEXT_PUBLIC_CIHOF_MODE === 'string' ? env.NEXT_PUBLIC_CIHOF_MODE : undefined) ??
    (typeof env.REACT_APP_CIHOF_MODE === 'string' ? env.REACT_APP_CIHOF_MODE : undefined);
  return normalizeMode(typeof rawMode === 'string' ? rawMode : null);
};

export const resolveMode = async (): Promise<AppMode> => {
  const storedMode = getStoredModeOverride();
  if (storedMode) {
    return storedMode;
  }

  const envMode = getEnvMode();
  if (envMode) {
    return envMode;
  }
  try {
    const response = await fetch('/config.json');
    if (response.ok) {
      const data = (await response.json()) as { mode?: string };
      const configMode = normalizeMode(data.mode);
      if (configMode) {
        return configMode;
      }
    }
  } catch {
    // Ignore config load failures and fall back to default.
  }
  return 'option2';
};

export const shouldShowModeBadge = () => import.meta.env.VITE_CIHOF_SHOW_MODE === 'true';
