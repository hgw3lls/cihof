import { otherTheme, type Theme } from './theme.ts';

/**
 * Light or dark, from the bar along the bottom. The key names the colours it
 * switches to and shows them as a swatch.
 *
 * On the public site it is a visitor's own device, so their choice is kept for
 * their next visit. On the display it lasts until the visit ends; the next
 * visitor meets the colours the admin chose.
 */
export function ThemeSwitch({ theme, onChoose }: { theme: Theme; onChoose: (next: 'dark' | 'light') => void }) {
  const next = otherTheme(theme, window.matchMedia('(prefers-color-scheme: dark)').matches);
  const label = next === 'dark' ? 'Dark' : 'Light';
  return (
    <button type="button" className="lensbar__theme" data-next={next} aria-label={`${label} colours`} onClick={() => onChoose(next)}>
      <span className="lensbar__swatch" aria-hidden="true" />
      {label}
    </button>
  );
}
