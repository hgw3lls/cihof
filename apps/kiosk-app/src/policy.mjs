/**
 * What the exhibit window lets through.
 *
 * Pure decisions, kept apart from Electron so they can be tested without it.
 * The window asks these on every key press and every navigation; everything
 * not allowed is simply dropped.
 */

/**
 * Keys that would take a visitor out of the exhibit or change how it looks:
 * reload, developer tools, view source, find, print, save, open, new window,
 * close tab, zoom, history navigation and full-screen toggling.
 *
 * @typedef {{ type?: string, key: string, control?: boolean, meta?: boolean, alt?: boolean, shift?: boolean }} KeyInput
 */
const blockedWithModifier = new Set(['r', 'i', 'j', 'c', 'u', 'f', 'g', 'p', 's', 'o', 'n', 't', 'w', 'q', 'h', 'l', 'd', '+', '=', '-', '_', '0']);
const blockedAlone = new Set(['F1', 'F3', 'F5', 'F6', 'F7', 'F11', 'F12', 'BrowserBack', 'BrowserForward', 'BrowserRefresh', 'BrowserHome', 'BrowserSearch', 'ContextMenu']);

/**
 * @param {KeyInput} input
 * @param {{ debug: boolean }} options
 * @returns {boolean}
 */
export function isBlockedKey(input, { debug }) {
  if (debug) return false;
  const key = input.key;
  if (blockedAlone.has(key)) return true;
  const command = input.control || input.meta;
  if (command && blockedWithModifier.has(key.toLowerCase())) return true;
  // Alt+Left / Alt+Right go back and forward; Alt+Home opens a home page.
  if (input.alt && (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Home')) return true;
  return false;
}

/** The staff shortcut that opens the admin settings: Ctrl+Shift+A (Cmd+Shift+A on a Mac). */
export function isAdminShortcut(input) {
  return input.type !== 'keyUp' && Boolean(input.control || input.meta) && Boolean(input.shift) && input.key.toLowerCase() === 'a';
}

/**
 * Only the exhibit itself. A link to anywhere else is refused rather than
 * opened, because there is nowhere on a wall for a visitor to go.
 *
 * @param {string} target
 * @param {string} origin  e.g. http://127.0.0.1:8080
 */
export function isAllowedNavigation(target, origin) {
  try {
    return new URL(target).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}
