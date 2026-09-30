import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataFolderProblem, freePort, installRuntime, isExportedFile, isOwnPage, isWebAddress, syncDataFolder } from './runtime.mjs';

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
 */

const here = dirname(fileURLToPath(import.meta.url));
// Tests keep the app's settings, working copy and exports apart from a real reviewer's.
if (process.env.CIHOF_REVIEW_USER_DATA) app.setPath('userData', process.env.CIHOF_REVIEW_USER_DATA);
const runtime = app.isPackaged ? join(process.resourcesPath, 'runtime') : resolve(here, '..', 'stage', 'runtime');
const settingsPath = () => join(app.getPath('userData'), 'settings.json');
const work = () => join(app.getPath('userData'), 'review');
const exportDir = () => process.env.CIHOF_REVIEW_EXPORT_DIR || join(app.getPath('documents'), 'CIHOF review decisions');
let win = null;
let server = null;
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
        { label: 'Copy the latest records again', click: () => launch() },
        { label: 'Choose the data folder…', click: () => chooseFolder() },
        { type: 'separator' },
        { label: 'Show exported decisions', click: () => { mkdirSync(exportDir(), { recursive: true }); shell.openPath(exportDir()); } },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'reload' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
  ]));

  ipcMain.handle('review-app:choose-folder', () => chooseFolder());
  ipcMain.handle('review-app:retry', () => launch());
  ipcMain.handle('review-app:show-export', (_event, path) => {
    if (isExportedFile(path, exportDir())) shell.showItemInFolder(resolve(path));
  });

  win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'CIHOF staff review',
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
  writeSettings({ dataFolder: folder });
  await launch();
  return true;
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

  // The latest records from the data folder. If it cannot be reached, the
  // last copy is used, and the window says so.
  const folder = readSettings().dataFolder;
  const problem = dataFolderProblem(folder);
  const haveCopy = existsSync(join(root, 'data', 'cihof_curated_metadata.json'));
  let note = '';
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

  port = await freePort(5180);
  const output = [];
  server = spawn(process.execPath, [
    '--experimental-strip-types', '--no-warnings=ExperimentalWarning',
    join(root, 'apps', 'review', 'server', 'server.mjs'), '--no-open', `--port=${port}`, `--export-dir=${exportDir()}`,
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
        win?.setTitle(`CIHOF staff review${note}`);
        await win?.loadURL(url);
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
