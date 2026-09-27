/**
 * Light or dark, as the display's admin chose it, or as the visitor chose it
 * on the public site.
 *
 * The kiosk app passes its saved choice on the address it opens (`theme`). An
 * installed display defaults to dark, the design it was drawn in. The public
 * site starts light, and remembers a visitor's own choice on their device.
 * Anything unrecognised falls back to that default, silently, like the attract
 * settings. `auto`, following the device, is still accepted on the address.
 */
export const themes = ['dark', 'light', 'auto'] as const;
export type Theme = (typeof themes)[number];

/** Where the public site keeps a visitor's choice, on their own device. */
export const themeKey = 'cihof-theme';

export function readTheme(search: string, target: string | undefined, remembered: string | null = null): Theme {
  const asked = new URLSearchParams(search).get('theme');
  if ((themes as readonly string[]).includes(asked ?? '')) return asked as Theme;
  if (target !== 'public') return 'dark';
  return remembered === 'dark' || remembered === 'light' ? remembered : 'light';
}

/** The other one, from what is showing now (`auto` shows what the device prefers). */
export function otherTheme(theme: Theme, devicePrefersDark: boolean): 'dark' | 'light' {
  const showing = theme === 'auto' ? (devicePrefersDark ? 'dark' : 'light') : theme;
  return showing === 'dark' ? 'light' : 'dark';
}

/** The browser's own colour for its bars and the page behind the first paint. */
export const themeGround = { dark: '#121211', light: '#f4f2ec' } as const;

/** Shows a theme: the page's colours, and the browser's bars to match. */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  if (theme === 'auto') return;
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.setAttribute('content', themeGround[theme]);
}

/** A visitor's choice on the public site. Private browsing may refuse to keep it; it still applies. */
export function rememberTheme(theme: 'dark' | 'light') {
  try { localStorage.setItem(themeKey, theme); } catch { /* not kept; still shown */ }
}

export function rememberedTheme(): string | null {
  try { return localStorage.getItem(themeKey); } catch { return null; }
}
