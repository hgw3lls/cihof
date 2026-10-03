/**
 * The packaged-app behaviour, end to end, in a real Electron window.
 *
 *   npm run stage -- --site=<kiosk build>   then   npm run test:app
 *
 * Needs a display (on Linux: xvfb-run). Not part of npm test: it launches a
 * browser engine and takes about half a minute.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron } from '@playwright/test';
import { makeUpdate } from '../src/content-package.mjs';
import { extractZip } from '../src/zip.mjs';

// Where Electron's own binary is, under node_modules/electron/dist, on each system.
const electronBinary = { win32: 'electron.exe', darwin: 'Electron.app/Contents/MacOS/Electron' }[process.platform] ?? 'electron';

const app = resolve(import.meta.dirname, '..');
const userData = mkdtempSync(join(tmpdir(), 'cihof-app-'));
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const step = (name) => console.log(`  ✓ ${name}`);

// CIHOF_APP_EXECUTABLE runs the same checks against a packaged app instead.
const packaged = process.env.CIHOF_APP_EXECUTABLE;
const launch = () => electron.launch({
  executablePath: packaged ?? join(app, 'node_modules', 'electron', 'dist', electronBinary),
  args: [...(process.getuid?.() === 0 ? ['--no-sandbox'] : []), ...(packaged ? [] : [join(app, 'stage')])],
  env: { ...process.env, CIHOF_USER_DATA: userData },
});

/** Sends real input through Electron, so the app's own input handling sees it. */
const sendKey = (electronApp, keyCode, modifiers = []) => electronApp.evaluate(({ BrowserWindow }, { keyCode, modifiers }) => {
  const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().startsWith('http'));
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
  win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
}, { keyCode, modifiers });

const adminWindow = async (electronApp) => {
  // A slow machine (CI) can take a few seconds to open the panel.
  for (let i = 0; i < 100; i += 1) {
    const found = electronApp.windows().find((page) => page.url().startsWith('file:'));
    if (found) { await found.waitForLoadState(); return found; }
    await wait(100);
  }
  return null;
};

const tap = async (page, digits) => {
  for (const digit of digits) await page.getByRole('button', { name: digit, exact: true }).click();
  await page.getByRole('button', { name: 'OK' }).click();
};

console.log('Kiosk app');
let electronApp = await launch();
try {
  const exhibit = await electronApp.firstWindow();
  await exhibit.locator('.attract--mosaic').waitFor({ timeout: 20_000 });
  const url = new URL(exhibit.url());
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.searchParams.get('attract'), 'mosaic');
  step(`the exhibit opens from its own server (${url.origin}), on its attract screen`);

  const shape = await electronApp.evaluate(({ BrowserWindow, Menu }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return { menu: Menu.getApplicationMenu(), kiosk: win.isKiosk(), fullScreen: win.isFullScreen(), devTools: win.webContents.isDevToolsOpened() };
  });
  assert.deepEqual(shape, { menu: null, kiosk: true, fullScreen: true, devTools: false });
  step('full screen, kiosk mode, no menu, no developer tools');

  await exhibit.evaluate(() => { window.location.href = 'https://example.com/'; });
  await wait(800);
  assert.equal(new URL(exhibit.url()).origin, url.origin);
  assert.equal(await exhibit.evaluate(() => window.open('https://example.com/')), null);
  step('it cannot be navigated away, and cannot open windows');

  await sendKey(electronApp, 'F12');
  await sendKey(electronApp, 'I', ['control', 'shift']);
  await wait(500);
  assert.equal(await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.isDevToolsOpened()), false);
  step('developer-tools shortcuts do nothing');

  // First time: the corner gesture refuses to set up a passcode.
  // What the page receives during the hold is kept, to say why if it fails.
  await exhibit.evaluate(() => {
    window.__pointers = [];
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'blur']) {
      window.addEventListener(type, (event) => window.__pointers.push(`${type}${'clientX' in event ? ` ${event.clientX},${event.clientY}` : ''}`), { capture: true });
    }
  });
  // A finger on the corner, as staff hold it on the display. Touch, not the
  // mouse: a display has no mouse, and a virtual display's mouse state can
  // interrupt a simulated press (it did on CI).
  const touch = await exhibit.context().newCDPSession(exhibit);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 10, y: 10 }] });
  await wait(5500);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await touch.detach();
  let admin = await adminWindow(electronApp);
  if (!admin) {
    const pointers = await exhibit.evaluate(() => window.__pointers.slice(0, 20)).catch((error) => [String(error)]);
    const windows = await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((w) => `${w.webContents.getURL()} ${JSON.stringify(w.getBounds())} focused=${w.isFocused()}`));
    console.log(`  page received: ${pointers.join('; ') || 'nothing'}\n  windows: ${windows.join(' | ')}`);
  }
  assert.ok(admin, 'holding the corner opens the admin panel');
  await admin.getByText('have not been set up').waitFor();
  step('holding the corner for 5 seconds opens admin, but will not set a first passcode');
  // Close shuts the window under the click, so wait for the window to go
  // rather than for the click to finish, and never find the closing one again.
  await Promise.all([
    admin.waitForEvent('close'),
    admin.getByRole('button', { name: 'Close' }).click({ noWaitAfter: true }).catch(() => undefined),
  ]);
  // The app opens a new panel only once it has let go of the old one; until
  // then the shortcut brings the closing one forward.
  for (let i = 0; i < 50 && await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length) > 1; i += 1) await wait(100);

  // The keyboard shortcut may set it up.
  await sendKey(electronApp, 'A', ['control', 'shift']);
  admin = await adminWindow(electronApp);
  await admin.getByText('Choose an admin passcode').waitFor();
  await tap(admin, '2468');
  await admin.getByText('same passcode again').waitFor();
  await tap(admin, '2468');
  await admin.getByRole('heading', { name: 'This display' }).waitFor();
  const stored = JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf8'));
  assert.match(stored.passcode, /^scrypt:/);
  assert.ok(!JSON.stringify(stored).includes('2468'));
  step('Ctrl+Shift+A sets the first passcode, stored hashed');

  await admin.getByRole('radio', { name: /Name wall/ }).click();
  await admin.getByRole('button', { name: 'Save' }).click();
  await admin.getByText('Saved.').waitFor();
  await exhibit.locator('.attract--names').waitFor({ timeout: 10_000 });
  assert.equal(new URL(exhibit.url()).searchParams.get('attract'), 'names');
  assert.equal(JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf8')).attractMode, 'names');
  step('choosing an attract screen in admin saves it and shows it on the display');

  await admin.getByRole('radio', { name: 'Light', exact: true }).click();
  await admin.getByRole('button', { name: 'Save' }).click();
  await admin.getByText('Saved.').waitFor();
  await exhibit.waitForFunction(() => document.documentElement.dataset.theme === 'light', null, { timeout: 10_000 });
  assert.equal(new URL(exhibit.url()).searchParams.get('theme'), 'light');
  assert.equal(JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf8')).theme, 'light');
  step('choosing light colours in admin saves them and shows them on the display');

  const debugSwitch = (label) => admin.locator('.toggle', { hasText: label }).getByRole('button');
  await debugSwitch('Mouse pointer').click();
  await wait(1500);
  let debug = await admin.evaluate(() => window.cihofAdmin.state().then((s) => s.debug));
  assert.equal(debug.cursor, true);
  await debugSwitch('Developer tools').click();
  await wait(2000);
  const devToolsOpen = await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some((w) => w.webContents.getURL().startsWith('http') && w.webContents.isDevToolsOpened()));
  assert.equal(devToolsOpen, true);
  step('debug switches work: pointer shown, developer tools open');

} catch (error) {
  await electronApp.close().catch(() => {});
  throw error;
}
await electronApp.close().catch(() => {});

// A fresh start: debug switches are gone, the passcode is not.
electronApp = await launch();
try {
  const exhibit = await electronApp.firstWindow();
  // The attract screen and colours chosen before the restart are still the ones shown.
  await exhibit.locator('.attract--names').waitFor({ timeout: 20_000 });
  assert.equal(await exhibit.evaluate(() => document.documentElement.dataset.theme), 'light');
  const devTools = await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.isDevToolsOpened());
  assert.equal(devTools, false);
  step('after a restart the debug switches are off again');

  await sendKey(electronApp, 'A', ['control', 'shift']);
  const admin = await adminWindow(electronApp);
  await admin.getByText('Enter the admin passcode').waitFor();
  await tap(admin, '1111');
  await admin.getByText('not right').waitFor();
  await tap(admin, '2468');
  await admin.getByRole('heading', { name: 'This display' }).waitFor();
  step('the passcode survives the restart; a wrong one is refused');
  admin.on('dialog', (dialog) => dialog.accept());

  // Content updates, as the staff portal makes them: the display exports what
  // it shows, an update is made from that export, and the display takes it in.
  // The system's file pickers are stood in for; everything else is the app's own.
  const work = mkdtempSync(join(tmpdir(), 'cihof-content-'));
  const exported = join(work, 'export.cihof');
  await electronApp.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, exported);
  await admin.getByRole('button', { name: 'Export current content…' }).click();
  await admin.getByText(/Exported to/).waitFor({ timeout: 60_000 });
  assert.ok(existsSync(exported));
  await extractZip(exported, join(work, 'export'));
  const base = JSON.parse(readFileSync(join(work, 'export', 'content.json'), 'utf8'));
  const fromExport = (map) => Object.fromEntries(Object.entries(map).map(([path, file]) => [path, join(work, 'export', 'blobs', file.sha256)]));
  assert.ok(Object.keys(base.source).length > 0, 'the export carries the source data the portal edits');
  step(`the display exports what it shows (${Object.keys(base.site).length} display files, ${Object.keys(base.source).length} source files)`);

  // An update that renames the first person.
  const delivered = JSON.parse(readFileSync(join(work, 'export', 'blobs', base.site['data/exhibit.json'].sha256), 'utf8'));
  const originalName = delivered.people[0].name;
  const changed = { ...delivered, people: [{ ...delivered.people[0], name: 'Content Update Check' }, ...delivered.people.slice(1)] };
  writeFileSync(join(work, 'exhibit.json'), JSON.stringify(changed));
  const updatePath = join(work, 'update.cihof');
  const made = await makeUpdate({
    out: updatePath, base, createdBy: 'The end-to-end test', summary: ['The first name changed, for the test.'],
    site: { ...fromExport(base.site), 'data/exhibit.json': join(work, 'exhibit.json') },
    source: fromExport(base.source),
    people: changed.people.length, exhibitSchemaVersion: changed.schemaVersion,
  });
  assert.equal(made.carried, 1);
  await electronApp.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, updatePath);
  await admin.getByRole('button', { name: 'Load a content update…' }).click();
  await admin.getByText('The first name changed, for the test.').waitFor({ timeout: 30_000 });
  await admin.getByRole('button', { name: 'Apply and show now' }).click();
  await admin.getByText('Applied. The display is showing it now.').waitFor({ timeout: 60_000 });
  await exhibit.getByText('Content Update Check').first().waitFor({ timeout: 30_000 });
  assert.equal(await exhibit.evaluate(() => fetch('/data/exhibit.json').then((r) => r.json()).then((b) => b.people[0].name)), 'Content Update Check');
  step('an update made from that export is checked, applied and shown on the display');

  // Back to the delivered content, and the update stays in the list.
  await admin.getByRole('button', { name: 'Go back to it' }).click();
  await admin.getByText('Done. The display is showing it now.').waitFor({ timeout: 60_000 });
  await exhibit.getByText(originalName).first().waitFor({ timeout: 30_000 });
  assert.equal(await exhibit.evaluate(() => fetch('/data/exhibit.json').then((r) => r.json()).then((b) => b.people[0].name)), originalName);
  await admin.getByRole('button', { name: 'Show this version' }).waitFor();
  step('the delivered content can be shown again, and the update is kept to show again');

  const closed = new Promise((done) => electronApp.process().once('exit', done));
  await admin.getByRole('button', { name: 'Exit to desktop' }).click({ noWaitAfter: true }).catch(() => {});
  await Promise.race([closed, wait(8000).then(() => { throw new Error('the app did not exit'); })]);
  step('Exit to desktop closes the app');
} catch (error) {
  await electronApp.close().catch(() => {});
  throw error;
}
console.log('All kiosk app checks passed.');
