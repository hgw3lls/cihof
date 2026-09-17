import { useEffect, useState } from 'react';

export type ColorMode = 'light' | 'dark';

const storageKey = 'cihof-color-mode';

export function useColorMode() {
  const [mode, setMode] = useState<ColorMode>(() => {
    try {
      return window.localStorage.getItem(storageKey) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, mode);
    } catch {
      // The display can still switch modes when storage is unavailable.
    }
  }, [mode]);

  return { mode, toggleMode: () => setMode((current) => current === 'light' ? 'dark' : 'light') };
}
