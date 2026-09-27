import { useState } from 'react';
import { applyTheme, otherTheme, rememberTheme, type Theme } from './theme.ts';

/**
 * Light or dark, on the public site: a visitor's own device, so their own
 * choice, kept for their next visit. The display has none: its admin chooses.
 * The button names the colours it switches to.
 */
export function ThemeSwitch() {
  const [theme, setTheme] = useState(() => (document.documentElement.dataset.theme ?? 'light') as Theme);
  const next = otherTheme(theme, window.matchMedia('(prefers-color-scheme: dark)').matches);

  const choose = () => {
    applyTheme(next);
    rememberTheme(next);
    setTheme(next);
  };

  return (
    <button type="button" className="lensbar__theme" onClick={choose} aria-label={next === 'dark' ? 'Dark colours' : 'Light colours'}>
      {next === 'dark' ? 'Dark' : 'Light'}
    </button>
  );
}
