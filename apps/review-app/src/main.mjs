import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataFolderProblem, freePort, installRuntime, isExportedFile, isOwnPage, isUpdateFile, isWebAddress, syncDataFolder } from './runtime.mjs';

/**
 * The staff review app, installed on a staff computer.
 *
 * It needs no git, no Node and no copy of the project. It carries the review
 * (runtime/: its pages and server, the pipeline and the apply tools) and runs
 * it with the Node inside Electron, on this computer only. The records come
 * from a data folder chosen once, copied in each time it starts (runtime.mjs).
 * A reviewer's decisions are checked with the same tools as always and leave
 * as one file, in Documents/CIHOF review decisions, for the developer to bring
 * in with npm run review:import. Nothing is committed here, and nothing is
 * sent anywhere by the app itself.
 *
 * Or, as the staff portal, it works on the content a display exported
 * (File, Open a display's content): edits are saved into that copy and made
 * into a display update, a file the display loads, with nobody in between
 * (apps/review/server/portal.mjs).
 */

const here = dirname(fileURLToPath(import.meta.url));
// Tests keep the app's settings, working copy and exports apart from a real reviewer's.
if (process.env.CIHOF_REVIEW_USER_DATA) app.setPath('userData', process.env.CIHOF_REVIEW_USER_DATA);
const runtime = app.isPackaged ? join(process.resourcesPath, 'runtime') : resolve(here, '..', 'stage', 'runtime');
const settingsPath = () => join(app.getPath('userData'), 'settings.json');
const work = () => join(app.getPath('userData'), 'review');
const exportDir = () => process.env.CIHOF_REVIEW_EXPORT_DIR || join(app.getPath('documents'), 'CIHOF review decisions');
const updatesDir = () => process.env.CIHOF_REVIEW_UPDATES_DIR || join(app.getPath('documents'), 'CIHOF display updates');
const portalMode = () => readSettings().mode === 'portal';
const appTitle = () => (portalMode() ? 'CIHOF staff portal' : 'CIHOF staff review');
let win = null;
let server = null;
/**
 * Said in the title bar while the review shows records that may be out of
 * date: the data folder could not be reached, so the last copy is in use.
 * The pages' own title never replaces it (see start()).
 */
let staleNote = '';
let port = 0;
let quitting = false;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(start);
}

app.on('before-quit', () => { quitting = true; stopServer(); });
app.on('window-all-closed', () => app.quit());

function readSettings() {
  try { return JSON.parse(readFileSync(settingsPath(), 'utf8')); } catch { return {}; }
}

function writeSettings(next) {
  mkdirSync(dirname(settingsPath()), { recursive: true });
  writeFileSync(settingsPath(), `${JSON.stringify({ ...readSettings(), ...next }, null, 2)}\n`);
}

async function start() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Open a display\'s content…', click: () => openContent() },
        { label: 'Show display updates', click: () => { mkdirSync(updatesDir(), { recursive: true }); shell.openPath(updatesDir()); } },
        { type: 'separator' },
        { label: 'Copy the latest records again', click: () => launch() },
        { label: 'Choose the data folder…', click: () => chooseFolder() },
        { label: 'Show exported decisions', click: () => { mkdirSync(exportDir(), { recursive: true }); shell.openPath(exportDir()); } },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'reload' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
  ]));

  ipcMain.handle('review-app:choose-folder', () => chooseFolder());
  ipcMain.handle('review-app:open-content', () => openContent());
  ipcMain.handle('review-app:show-update', (_event, path) => {
    if (isUpdateFile(path, updatesDir())) shell.showItemInFolder(resolve(path));
  });
  ipcMain.handle('review-app:retry', () => launch());
  ipcMain.handle('review-app:show-export', (_event, path) => {
    if (isExportedFile(path, exportDir())) shell.showItemInFolder(resolve(path));
  });

  win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: appTitle(),
    backgroundColor: '#f4f2ec',
    webPreferences: { preload: join(here, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  const contents = win.webContents;
  // The review's own pages stay in the window; a link out (a film on YouTube,
  // a source) opens in the browser, and nothing else opens at all.
  contents.setWindowOpenHandler(({ url }) => {
    if (isWebAddress(url) && !isOwnPage(url, port)) shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    if (isOwnPage(url, port) || url.startsWith('file:')) return;
    event.preventDefault();
    if (isWebAddress(url)) shell.openExternal(url);
  });
  // The window's title is the app's: a page loading cannot replace it, so a
  // warning about out-of-date records stays in sight while the review is used.
  win.on('page-title-updated', (event) => {
    event.preventDefault();
    win?.setTitle(`${appTitle()}${staleNote}`);
  });
  win.on('closed', () => { win = null; });
  await launch();
}

function status(state, message = '', detail = '') {
  if (!win) return;
  win.loadFile(join(here, 'status.html'), { search: new URLSearchParams({ state, message, detail }).toString() });
}

async function chooseFolder() {
  const result = await dialog.showOpenDialog(win, {
    title: 'Choose the data folder',
    message: 'Choose the review data folder the developer set up: the one with a folder called data inside it.',
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths[0]) return false;
  const folder = result.filePaths[0];
  const problem = dataFolderProblem(folder);
  if (problem) { status('problem', problem); return false; }
  writeSettings({ dataFolder: folder, mode: 'review' });
  await launch();
  return true;
}

/**
 * Opens the content a display exported as the portal's working copy. Saved
 * changes not yet in a display update would be replaced, so that is asked.
 */
async function openContent() {
  const result = await dialog.showOpenDialog(win, {
    title: 'Open a display\'s content',
    message: 'Choose the content exported from the display: its admin panel, Content, Export current content.',
    properties: ['openFile'],
    filters: [{ name: 'Display content', extensions: ['cihof', 'zip'] }],
  });
  if (result.canceled || !result.filePaths[0]) return false;
  const file = result.filePaths[0];
  stopServer();
  status('starting', 'Opening the display\'s content…');
  try {
    installRuntime(runtime, work(), build());
  } catch (error) {
    status('problem', 'The portal could not be set up on this computer.', String(error?.stack ?? error));
    return false;
  }
  let outcome = await runPortal([`--open=${file}`]);
  if (!outcome.ok && /not yet in a display update/.test(outcome.output)) {
    const answer = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Open it anyway', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      message: outcome.output.trim(),
      detail: 'To keep them, cancel and make a display update first. Opening this content replaces them with what the display had.',
    });
    if (answer.response !== 0) { await launch(); return false; }
    outcome = await runPortal([`--open=${file}`, '--replace']);
  }
  if (!outcome.ok) {
    status('problem', 'The display\'s content could not be opened.', outcome.output.trim());
    return false;
  }
  writeSettings({ mode: 'portal' });
  await launch();
  return true;
}

function runPortal(args) {
  return new Promise((done) => {
    const output = [];
    const child = spawn(process.execPath, [
      '--experimental-strip-types', '--no-warnings=ExperimentalWarning',
      join(work(), 'apps', 'review', 'server', 'portal.mjs'), ...args,
    ], { cwd: work(), env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    child.stdout.on('data', (chunk) => output.push(String(chunk)));
    child.stderr.on('data', (chunk) => output.push(String(chunk)));
    child.on('error', (error) => done({ ok: false, output: String(error) }));
    child.on('exit', (code) => done({ ok: code === 0, output: output.join('') }));
  });
}

function build() {
  try { return readFileSync(join(runtime, 'BUILD'), 'utf8').trim(); } catch { return `dev-${Date.now()}`; }
}

async function launch() {
  stopServer();
  if (!existsSync(join(runtime, 'apps', 'review', 'server', 'server.mjs'))) {
    status('problem', 'This copy of the app is incomplete: the review is missing from it. Ask the developer for a new copy.');
    return;
  }
  status('starting', 'Getting the review ready…');
  const root = work();
  try {
    installRuntime(runtime, root, build());
  } catch (error) {
    status('problem', 'The review could not be set up on this computer.', String(error?.stack ?? error));
    return;
  }

  // The portal works on the copy a display's export was opened into, and
  // nothing else: the data folder plays no part.
  const portal = portalMode();
  let note = '';
  staleNote = '';
  if (portal) {
    if (!existsSync(join(root, '.portal', 'base.json'))) { status('choose', 'Open the content exported from the display to begin: File, Open a display\'s content.'); return; }
  } else {
    // The latest records from the data folder. If it cannot be reached, the
    // last copy is used, and the window says so.
    const folder = readSettings().dataFolder;
    const problem = dataFolderProblem(folder);
    const haveCopy = existsSync(join(root, 'data', 'cihof_curated_metadata.json'));
    if (problem) {
      if (!folder || !haveCopy) { status(folder ? 'problem' : 'choose', problem); return; }
      const when = statSync(join(root, 'data', 'cihof_curated_metadata.json')).mtime;
      note = ` · the data folder cannot be reached: using the records copied on ${when.toLocaleDateString()}`;
    } else {
      status('starting', `Copying the latest records from ${folder}…`);
      try {
        syncDataFolder(folder, root);
      } catch (error) {
        if (!haveCopy) { status('problem', `The records could not be copied from ${folder}.`, String(error?.message ?? error)); return; }
        note = ' · the latest records could not be copied: using the last copy';
      }
    }
  }

  port = await freePort(5180);
  const output = [];
  server = spawn(process.execPath, [
    '--experimental-strip-types', '--no-warnings=ExperimentalWarning',
    join(root, 'apps', 'review', 'server', 'server.mjs'), '--no-open', `--port=${port}`,
    portal ? `--updates-dir=${updatesDir()}` : `--export-dir=${exportDir()}`,
  ], { cwd: root, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const current = server;
  current.stdout.on('data', (chunk) => output.push(String(chunk)));
  current.stderr.on('data', (chunk) => output.push(String(chunk)));
  current.on('exit', (code) => {
    if (server === current) server = null;
    if (!quitting && win) status('problem', 'The review stopped unexpectedly.', `${output.join('').slice(-2000)}\n(exit ${code})`);
  });

  const url = `http://localhost:${port}/`;
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (server !== current) return;
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) {
        staleNote = note;
        win?.setTitle(`${appTitle()}${note}`);
        await win?.loadURL(url);
        win?.setTitle(`${appTitle()}${note}`);
        return;
      }
    } catch { /* not listening yet */ }
    await new Promise((done) => setTimeout(done, 200));
  }
  stopServer();
  status('problem', 'The review did not start.', output.join('').slice(-2000));
}

function stopServer() {
  const current = server;
  server = null;
  if (current && current.exitCode === null) current.kill();
}
