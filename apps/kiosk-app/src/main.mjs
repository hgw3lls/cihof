import { app, BrowserWindow, dialog, ipcMain, Menu, powerSaveBlocker, session } from 'electron';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { msUntil } from './launch.mjs';
import { createKioskServer } from './server.mjs';
import { createContentStore } from './content-store.mjs';
import { filmsState } from './films-folder.mjs';
import { isAdminShortcut, isAllowedNavigation, isBlockedKey } from './policy.mjs';
import { freezeWatch, heartbeatWatch } from './watch.mjs';
import { attemptPasscode, attractProblem, attractSettings, exhibitAddress, hashPasscode, loadSettings, passcodeProblem, saveSettings, themeGround } from './settings.mjs';

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
// The source data delivered with the app, which the staff portal edits.
const sourceRoot = app.isPackaged ? join(process.resourcesPath, 'content-source') : (process.env.CIHOF_CONTENT_SOURCE ?? join(here, 'content-source'));
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
let previewTimer = null;
/** The display's content: as delivered, and the updates since (content-store.mjs). */
let content = null;
/** An update chosen in the admin panel and checked, waiting for staff to apply it. */
let pendingUpdate = null;
/** The check-in watch of each exhibit window's page, by its web contents. */
const heartbeats = new Map();

async function start() {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-attach-webview', (event) => event.preventDefault());
  });

  // The content updates staff have loaded. If the store cannot be read, the
  // delivered content is served, and the admin panel says why.
  try {
    content = createContentStore({ dir: join(app.getPath('userData'), 'content'), deliveredSite: siteRoot, deliveredSource: sourceRoot });
  } catch (error) {
    content = null;
    console.error(`The content store could not be opened; showing the delivered content. ${error.message}`);
  }

  // The films folder chosen in the admin panel, and the content version
  // being served, read on every request, so a change applies at once.
  const server = createKioskServer({ root: siteRoot, videos: () => settings.videosFolder, content: () => content?.serving() ?? null });
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

  ipcMain.on('exhibit:alive', (event) => heartbeats.get(event.sender.id)?.beat());
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
    backgroundColor: themeGround[attractSettings(settings).theme],
    title: 'CIHOF Exhibit',
    webPreferences: {
      preload: join(here, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: debug.devtools,
      spellcheck: false,
      navigateOnDragDrop: false,
      // The display is always on show: its timers, and its check-ins, run at
      // full speed even with the admin panel over it.
      backgroundThrottling: false,
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

  // A crashed or frozen page comes back rather than leaving a blank wall. A
  // frozen one is noticed when it stops checking in, or when it cannot answer
  // a touch.
  const restartPage = () => !win.isDestroyed() && contents.forcefullyCrashRenderer();
  const silent = heartbeatWatch({ onSilent: restartPage });
  const contentsId = contents.id;
  heartbeats.set(contentsId, silent);
  contents.on('did-start-loading', silent.pause);
  contents.on('render-process-gone', () => {
    silent.pause();
    setTimeout(() => !win.isDestroyed() && contents.reload(), 1000);
  });
  const frozen = freezeWatch({ onFrozen: restartPage });
  win.on('unresponsive', frozen.unresponsive);
  win.on('responsive', frozen.responsive);
  win.on('closed', () => {
    frozen.dispose();
    silent.dispose();
    heartbeats.delete(contentsId);
  });

  // Alt+F4 and the like: the exhibit window only closes when the app is quitting.
  win.on('close', (event) => { if (!quitting && win === exhibit) event.preventDefault(); });

  win.once('ready-to-show', () => win.show());
  win.loadURL(exhibitAddress(origin, settings));
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
    backgroundColor: '#121211',
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
    // What is being served: the delivered release, or a content version's.
    const serving = content?.serving();
    const release = JSON.parse(readFileSync(serving?.releaseJson ?? join(siteRoot, 'release.json'), 'utf8'));
    const bundle = JSON.parse(readFileSync(serving?.site('data/exhibit.json') ?? join(siteRoot, 'data', 'exhibit.json'), 'utf8'));
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
    settings: { restartAt: settings.restartAt, startAtLogin: settings.startAtLogin, port: settings.port, ...attractSettings(settings) },
    app: { version: app.getVersion(), platform: process.platform, ...releaseInfo() },
    films: filmsState(siteRoot, settings.videosFolder),
    content: content ? { ...content.state(), pending: pendingUpdate?.report ?? null } : { unavailable: true },
  };
}

/**
 * Brings a new content version onto the screen. `now`: straight away, which
 * staff choose with the admin panel open and nobody mid-visit. Otherwise the
 * exhibit is told a new release is ready, and takes it over at its next reset.
 */
async function noticeContent({ now }) {
  if (!exhibit || exhibit.isDestroyed()) return;
  const contents = exhibit.webContents;
  const check = 'navigator.serviceWorker ? navigator.serviceWorker.getRegistration().then((r) => (r ? r.update() : null)).then(() => "ok", () => "none") : "none"';
  const takeOver = `(async () => {
    if (!navigator.serviceWorker) return 'no-worker';
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return 'no-worker';
    await registration.update();
    const settle = (worker) => new Promise((done) => {
      if (!worker || ['installed', 'activated', 'redundant'].includes(worker.state)) return done();
      worker.addEventListener('statechange', () => { if (['installed', 'activated', 'redundant'].includes(worker.state)) done(); });
    });
    await settle(registration.installing);
    if (!registration.waiting) return 'nothing-waiting';
    const changed = new Promise((done) => { navigator.serviceWorker.addEventListener('controllerchange', done, { once: true }); setTimeout(done, 10000); });
    registration.waiting.postMessage('activate-release');
    await changed;
    return 'taken-over';
  })()`;
  try {
    await contents.executeJavaScript(now ? takeOver : check);
  } catch { /* the page is reloading or gone; it reads what is served when it loads */ }
  if (now) exhibit.loadURL(exhibitAddress(origin, settings));
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
    } else if (['attractMode', 'attractRotate', 'spotlightSeconds', 'motion', 'theme'].includes(name)) {
      // The exhibit reads these (and its theme) as it loads, so it is reopened on its attract
      // screen straight away. Staff have the admin panel open, so nobody is
      // in the middle of a visit.
      const problem = attractProblem(name, value);
      if (problem) throw new Error(problem);
      settings = { ...settings, [name]: value };
      exhibit?.setBackgroundColor(themeGround[attractSettings(settings).theme]);
      exhibit?.loadURL(exhibitAddress(origin, settings));
    } else {
      throw new Error(`Unknown setting: ${name}`);
    }
    saveSettings(settingsPath, settings);
    return adminState();
  });

  // Shows an attract screen for thirty seconds without saving it, then puts
  // the exhibit back as it was saved and brings the panel back.
  handle('admin:preview-attract', (candidate = {}) => {
    const trial = { ...settings };
    for (const name of ['attractMode', 'attractRotate', 'spotlightSeconds', 'motion', 'theme']) {
      if (name in candidate && !attractProblem(name, candidate[name])) trial[name] = candidate[name];
    }
    if (previewTimer) clearTimeout(previewTimer);
    admin?.hide();
    exhibit?.loadURL(exhibitAddress(origin, trial));
    previewTimer = setTimeout(() => {
      previewTimer = null;
      exhibit?.loadURL(exhibitAddress(origin, settings));
      if (admin && !admin.isDestroyed()) { admin.show(); admin.focus(); }
    }, 30_000);
    return true;
  });

  // Where the films are played from. Chosen with the system's own folder
  // picker, so the panel never handles a path it was not given by staff.
  handle('admin:choose-videos', async () => {
    const result = await dialog.showOpenDialog(admin ?? exhibit, {
      title: 'Choose the films folder',
      message: 'Choose the folder that holds the films: one folder per person, as in the project\'s public/media/videos.',
      properties: ['openDirectory'],
    });
    if (!result.canceled && result.filePaths[0]) {
      settings = { ...settings, videosFolder: result.filePaths[0] };
      saveSettings(settingsPath, settings);
    }
    admin?.focus();
    return adminState();
  });
  handle('admin:clear-videos', () => {
    settings = { ...settings, videosFolder: null };
    saveSettings(settingsPath, settings);
    return adminState();
  });

  // A content update from the staff portal, chosen with the system's own
  // picker and checked before anything changes.
  handle('admin:content-choose', async () => {
    if (!content) throw new Error('The content store is not available on this display.');
    const result = await dialog.showOpenDialog(admin ?? exhibit, {
      title: 'Choose a content update',
      message: 'Choose the content update made with the staff portal.',
      filters: [{ name: 'Content updates', extensions: ['cihof', 'zip'] }],
      properties: ['openFile'],
    });
    admin?.focus();
    if (result.canceled || !result.filePaths[0]) return adminState();
    const path = result.filePaths[0];
    const report = await content.inspect(path);
    pendingUpdate = {
      path,
      report: {
        file: path.split(/[\\/]/).pop(),
        problems: report.problems,
        stale: report.stale,
        changes: report.changes,
        contentVersion: report.manifest?.contentVersion ?? null,
      },
    };
    return adminState();
  });
  handle('admin:content-apply', async ({ force = false, now = true } = {}) => {
    if (!content || !pendingUpdate) throw new Error('Choose a content update first.');
    await content.apply(pendingUpdate.path, { force: Boolean(force) });
    pendingUpdate = null;
    await noticeContent({ now: Boolean(now) });
    admin?.focus();
    return adminState();
  });
  handle('admin:content-restore', async ({ id, now = true } = {}) => {
    if (!content) throw new Error('The content store is not available on this display.');
    await content.restore(String(id));
    await noticeContent({ now: Boolean(now) });
    admin?.focus();
    return adminState();
  });
  handle('admin:content-cancel', () => {
    pendingUpdate = null;
    return adminState();
  });
  handle('admin:content-show-now', async () => {
    await noticeContent({ now: true });
    admin?.focus();
    return adminState();
  });
  // What the display shows now, for the staff portal to start from.
  handle('admin:content-export', async () => {
    if (!content) throw new Error('The content store is not available on this display.');
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const result = await dialog.showSaveDialog(admin ?? exhibit, {
      title: 'Export the current content',
      defaultPath: `cihof-content-export-${stamp}.cihof`,
      filters: [{ name: 'Content export', extensions: ['cihof'] }],
    });
    admin?.focus();
    if (result.canceled || !result.filePath) return { ...adminState(), exported: null };
    const outcome = await content.exportCurrent(result.filePath);
    return { ...adminState(), exported: { file: result.filePath, ...outcome } };
  });

  handle('admin:action', (action) => {
    if (action === 'close') { admin?.close(); return true; }
    if (!adminUnlocked) throw new Error('Enter the passcode first.');
    if (action === 'reload') { exhibit?.webContents.reload(); admin?.close(); return true; }
    if (action === 'recovery') { exhibit?.loadURL(exhibitAddress(origin, settings, { recovery: '1' })); admin?.close(); return true; }
    if (action === 'home') { exhibit?.loadURL(exhibitAddress(origin, settings)); admin?.close(); return true; }
    if (action === 'restart') { restartApp(); return true; }
    if (action === 'exit') { quitting = true; app.quit(); return true; }
    throw new Error(`Unknown action: ${action}`);
  }, { needsUnlock: false });
}
