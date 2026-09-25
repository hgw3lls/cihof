/**
 * Light or dark, as the display's admin chose it, or as the visitor's device
 * prefers on the public site.
 *
 * The kiosk app passes its saved choice on the address it opens (`theme`). An
 * installed display defaults to dark, the design it was drawn in; the public
 * site defaults to following the device. Anything unrecognised falls back to
 * that default, silently, like the attract settings.
 */
export const themes = ['dark', 'light', 'auto'] as const;
export type Theme = (typeof themes)[number];

export function readTheme(search: string, target: string | undefined): Theme {
  const asked = new URLSearchParams(search).get('theme');
  if ((themes as readonly string[]).includes(asked ?? '')) return asked as Theme;
  return target === 'public' ? 'auto' : 'dark';
}

/** The browser's own colour for its bars and the page behind the first paint. */
export const themeGround = { dark: '#121211', light: '#f4f2ec' } as const;
