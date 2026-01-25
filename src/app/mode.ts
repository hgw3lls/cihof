export type AppMode = 'option1' | 'option2';

const normalizeMode = (value: string | undefined | null): AppMode | null => {
  if (!value) {
    return null;
  }
  const normalized = value.toLowerCase();
  if (normalized === 'option1' || normalized === 'option2') {
    return normalized;
  }
  return null;
};

export const resolveMode = async (): Promise<AppMode> => {
  const envMode = normalizeMode(import.meta.env.VITE_CIHOF_MODE);
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
