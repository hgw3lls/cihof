import { app, BrowserWindow, dialog, ipcMain, Menu, powerSaveBlocker, session } from 'electron';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { msUntil } from './launch.mjs';
import { createKioskServer } from './server.mjs';
import { isAdminShortcut, isAllowedNavigation, isBlockedKey } from './policy.mjs';
import { freezeWatch } from './watch.mjs';
import { attemptPasscode, hashPasscode, loadSettings, passcodeProblem, saveSettings } from './settings.mjs';

/**
 * The installed exhibit as an application of its own.
 *
 * One full-screen window on the exhibit, served from this machine, with
 * nothing else reachable: no menus, no right-click, no browser shortcuts, no
 * navigating away, no zoom. Staff reach a hidden admin panel by holding the
 * top-left corner for five seconds, or with Ctrl+Shift+A, and a passcode.
 *
 * Debug switches in that panel (developer tools, menus, cursor) live in memory
 * only. The next restart, including the nightly one, turns them off again.
 */

const here = dirname(fileURLToPath(import.meta.url));
const siteRoot = app.isPackaged ? join(process.resourcesPath, 'site') : (process.env.CIHOF_SITE ?? join(here, 'site'));
// Tests, and a second display profile on one machine, can keep settings apart.
if (process.env.CIHOF_USER_DATA) app.setPath('userData', process.env.CIHOF_USER_DATA);
const settingsPath = join(app.getPath('userData'), 'settings.json');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // Touch gestures that would zoom the page or swipe back through history.
  app.commandLine.appendSwitch('disable-pinch');
  app.commandLine.appendSwitch('overscroll-history-navigation', '0');
  app.whenReady().then(start);
}

let settings = loadSettings(settingsPath);
const debug = { devtools: false, menus: false, cursor: false };
let exhibit = null;
let admin = null;
let adminUnlocked = false;
let adminSetupAllowed = false;
let quitting = false;
let origin = '';
let restartTimer = null;

async function start() {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-attach-webview', (event) => event.preventDefault());
  });

  const server = createKioskServer({ root: siteRoot });
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(settings.port, '127.0.0.1', resolve);
    });
  } catch (error) {
    dialog.showErrorBox('CIHOF Exhibit', error.code === 'EADDRINUSE'
      ? `Port ${settings.port} is already in use. Is the exhibit already running?`
      : `The exhibit could not start: ${error.message}`);
    app.exit(1);
    return;
  }
  origin = `http://127.0.0.1:${settings.port}`;

  powerSaveBlocker.start('prevent-display-sleep');
  applyStartAtLogin();
  applyMenu();
  scheduleRestart();

  ipcMain.on('exhibit:admin-gesture', (event) => {
    if (exhibit && event.sender === exhibit.webContents) openAdmin({ setupAllowed: false });
  });
  registerAdminHandlers();

  app.on('second-instance', () => exhibit?.focus());
  app.on('before-quit', () => { quitting = true; });
  createExhibitWindow();
}

function createExhibitWindow() {
  const windowed = debug.menus;
  const win = new BrowserWindow({
    show: false,
    kiosk: !windowed,
    fullscreen: !windowed,
    frame: windowed,
    autoHideMenuBar: !windowed,
    backgroundColor: '#fcfcfa',
    title: 'CIHOF Exhibit',
    webPreferences: {
      preload: join(here, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: debug.devtools,
      spellcheck: false,
      navigateOnDragDrop: false,
    },
  });
  exhibit = win;
  const contents = win.webContents;

  contents.on('before-input-event', (event, input) => {
    if (isAdminShortcut(input)) {
      event.preventDefault();
      openAdmin({ setupAllowed: true });
      return;
    }
    if (isBlockedKey(input, { debug: debug.devtools })) event.preventDefault();
  });
  contents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url, origin)) event.preventDefault();
  });
  contents.on('will-redirect', (event, url) => {
    if (!isAllowedNavigation(url, origin)) event.preventDefault();
  });
  contents.on('context-menu', (_event, params) => {
    if (!debug.menus) return;
    Menu.buildFromTemplate([
      { label: 'Back', enabled: contents.navigationHistory.canGoBack(), click: () => contents.navigationHistory.goBack() },
      { label: 'Reload', click: () => contents.reload() },
      ...(debug.devtools ? [{ type: 'separator' }, { label: 'Inspect', click: () => contents.inspectElement(params.x, params.y) }] : []),
    ]).popup({ window: win });
  });
  contents.on('zoom-changed', () => contents.setZoomFactor(1));
  contents.setVisualZoomLevelLimits(1, 1);
  contents.on('did-finish-load', () => {
    if (!debug.cursor) contents.insertCSS('*, *::before, *::after { cursor: none !important; }');
  });

  // A crashed or frozen page comes back rather than leaving a blank wall.
  contents.on('render-process-gone', () => setTimeout(() => !win.isDestroyed() && contents.reload(), 1000));
  const frozen = freezeWatch({ onFrozen: () => !win.isDestroyed() && contents.forcefullyCrashRenderer() });
  win.on('unresponsive', frozen.unresponsive);
  win.on('responsive', frozen.responsive);
  win.on('closed', frozen.dispose);

  // Alt+F4 and the like: the exhibit window only closes when the app is quitting.
  win.on('close', (event) => { if (!quitting && win === exhibit) event.preventDefault(); });

  win.once('ready-to-show', () => win.show());
  win.loadURL(`${origin}/`);
  return win;
}

/** Recreates the exhibit window so changed debug switches take effect. */
function rebuildExhibitWindow() {
  const old = exhibit;
  exhibit = null;
  createExhibitWindow();
  old?.destroy();
  applyMenu();
  if (debug.devtools) exhibit.webContents.openDevTools({ mode: 'detach' });
}

function applyMenu() {
  Menu.setApplicationMenu(debug.menus
    ? Menu.buildFromTemplate([{ role: 'fileMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }])
    : null);
}

function applyStartAtLogin() {
  if (!app.isPackaged || (process.platform !== 'win32' && process.platform !== 'darwin')) return;
  app.setLoginItemSettings({ openAtLogin: settings.startAtLogin });
}

function scheduleRestart() {
  if (restartTimer) clearTimeout(restartTimer);
  const wait = msUntil(settings.restartAt);
  if (wait === null) return;
  restartTimer = setTimeout(restartApp, wait);
}

function restartApp() {
  quitting = true;
  app.relaunch();
  app.exit(0);
}

// ------------------------------------------------------------------- admin

function openAdmin({ setupAllowed }) {
  // The corner gesture never offers to set a first passcode: a visitor could
  // otherwise hold the corner on a fresh display and lock staff out.
  adminSetupAllowed = setupAllowed;
  if (admin && !admin.isDestroyed()) { admin.focus(); return; }
  adminUnlocked = false;
  admin = new BrowserWindow({
    parent: exhibit ?? undefined,
    modal: true,
    width: 760,
    height: 900,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    backgroundColor: '#fcfcfa',
    title: 'Exhibit settings',
    webPreferences: {
      preload: join(here, 'admin-preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: debug.devtools,
      spellcheck: false,
    },
  });
  admin.webContents.on('before-input-event', (event, input) => {
    if (isBlockedKey(input, { debug: debug.devtools })) event.preventDefault();
  });
  admin.webContents.on('will-navigate', (event) => event.preventDefault());
  admin.on('closed', () => { admin = null; adminUnlocked = false; });
  admin.loadFile(join(here, 'admin', 'index.html'));
}

function releaseInfo() {
  try {
    const release = JSON.parse(readFileSync(join(siteRoot, 'release.json'), 'utf8'));
    const bundle = JSON.parse(readFileSync(join(siteRoot, 'data', 'exhibit.json'), 'utf8'));
    return { release: release.revision, content: String(bundle.contentRevision).slice(0, 12), people: bundle.people.length };
  } catch {
    return { release: 'unknown', content: 'unknown', people: 0 };
  }
}

function adminState() {
  return {
    hasPasscode: Boolean(settings.passcode),
    setupAllowed: adminSetupAllowed,
    unlocked: adminUnlocked,
    lockedForMs: Math.max(settings.lockout.until - Date.now(), 0),
    debug: { ...debug },
    settings: { restartAt: settings.restartAt, startAtLogin: settings.startAtLogin, port: settings.port },
    app: { version: app.getVersion(), platform: process.platform, ...releaseInfo() },
  };
}

function registerAdminHandlers() {
  const fromAdmin = (event) => admin && event.sender === admin.webContents;
  const handle = (channel, fn, { needsUnlock = true } = {}) => {
    ipcMain.handle(channel, (event, payload) => {
      if (!fromAdmin(event)) throw new Error('Not the admin panel.');
      if (needsUnlock && !adminUnlocked) throw new Error('Enter the passcode first.');
      return fn(payload);
    });
  };

  handle('admin:state', () => adminState(), { needsUnlock: false });

  handle('admin:unlock', (code) => {
    const result = attemptPasscode(settings, String(code));
    settings = result.settings;
    saveSettings(settingsPath, settings);
    adminUnlocked = result.ok;
    return { ok: result.ok, lockedForMs: result.lockedForMs ?? 0 };
  }, { needsUnlock: false });

  handle('admin:set-passcode', (code) => {
    const firstTime = !settings.passcode;
    if (!adminUnlocked && !(firstTime && adminSetupAllowed)) throw new Error('Enter the passcode first.');
    const problem = passcodeProblem(String(code));
    if (problem) return { ok: false, problem };
    settings = { ...settings, passcode: hashPasscode(String(code)), lockout: { failures: 0, until: 0 } };
    saveSettings(settingsPath, settings);
    adminUnlocked = true;
    return { ok: true };
  }, { needsUnlock: false });

  handle('admin:set-debug', (next) => {
    for (const key of Object.keys(debug)) {
      if (typeof next?.[key] === 'boolean') debug[key] = next[key];
    }
    rebuildExhibitWindow();
    admin?.focus();
    return adminState();
  });

  handle('admin:set-setting', ({ name, value } = {}) => {
    if (name === 'restartAt') {
      msUntil(String(value)); // throws on a bad time
      settings = { ...settings, restartAt: String(value) };
      scheduleRestart();
    } else if (name === 'startAtLogin') {
      settings = { ...settings, startAtLogin: Boolean(value) };
      applyStartAtLogin();
    } else {
      throw new Error(`Unknown setting: ${name}`);
    }
    saveSettings(settingsPath, settings);
    return adminState();
  });

  handle('admin:action', (action) => {
    if (action === 'close') { admin?.close(); return true; }
    if (!adminUnlocked) throw new Error('Enter the passcode first.');
    if (action === 'reload') { exhibit?.webContents.reload(); admin?.close(); return true; }
    if (action === 'recovery') { exhibit?.loadURL(`${origin}/?recovery=1`); admin?.close(); return true; }
    if (action === 'home') { exhibit?.loadURL(`${origin}/`); admin?.close(); return true; }
    if (action === 'restart') { restartApp(); return true; }
    if (action === 'exit') { quitting = true; app.quit(); return true; }
    throw new Error(`Unknown action: ${action}`);
  }, { needsUnlock: false });
}
