/**
 * The packaged-app behaviour, end to end, in a real Electron window.
 *
 *   npm run stage -- --site=<kiosk build>   then   npm run test:app
 *
 * Needs a display (on Linux: xvfb-run). Not part of npm test: it launches a
 * browser engine and takes about half a minute.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron } from '@playwright/test';

const app = resolve(import.meta.dirname, '..');
const userData = mkdtempSync(join(tmpdir(), 'cihof-app-'));
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const step = (name) => console.log(`  ✓ ${name}`);

// CIHOF_APP_EXECUTABLE runs the same checks against a packaged app instead.
const packaged = process.env.CIHOF_APP_EXECUTABLE;
const launch = () => electron.launch({
  executablePath: packaged ?? join(app, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron'),
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
  for (let i = 0; i < 50; i += 1) {
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
  await exhibit.getByRole('button', { name: 'People' }).waitFor({ timeout: 20_000 });
  const url = new URL(exhibit.url());
  assert.equal(url.hostname, '127.0.0.1');
  step(`the exhibit opens from its own server (${url.origin})`);

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
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.sendInputEvent({ type: 'mouseDown', x: 10, y: 10, button: 'left', clickCount: 1 }));
  await wait(5500);
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.sendInputEvent({ type: 'mouseUp', x: 10, y: 10, button: 'left', clickCount: 1 }));
  let admin = await adminWindow(electronApp);
  assert.ok(admin, 'holding the corner opens the admin panel');
  await admin.getByText('have not been set up').waitFor();
  step('holding the corner for 5 seconds opens admin, but will not set a first passcode');
  await admin.getByRole('button', { name: 'Close' }).click();
  await wait(500);

  // The keyboard shortcut may set it up.
  await sendKey(electronApp, 'A', ['control', 'shift']);
  admin = await adminWindow(electronApp);
  await admin.getByText('Choose an admin passcode').waitFor();
  await tap(admin, '2468');
  await admin.getByText('same passcode again').waitFor();
  await tap(admin, '2468');
  await admin.getByText('This display').waitFor();
  const stored = JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf8'));
  assert.match(stored.passcode, /^scrypt:/);
  assert.ok(!JSON.stringify(stored).includes('2468'));
  step('Ctrl+Shift+A sets the first passcode, stored hashed');

  await admin.getByRole('button', { name: 'Off' }).nth(2).click(); // Mouse pointer
  await wait(1500);
  let debug = await admin.evaluate(() => window.cihofAdmin.state().then((s) => s.debug));
  assert.equal(debug.cursor, true);
  await admin.getByRole('button', { name: 'Off' }).first().click(); // Developer tools
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
  await exhibit.getByRole('button', { name: 'People' }).waitFor({ timeout: 20_000 });
  const devTools = await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.isDevToolsOpened());
  assert.equal(devTools, false);
  step('after a restart the debug switches are off again');

  await sendKey(electronApp, 'A', ['control', 'shift']);
  const admin = await adminWindow(electronApp);
  await admin.getByText('Enter the admin passcode').waitFor();
  await tap(admin, '1111');
  await admin.getByText('not right').waitFor();
  await tap(admin, '2468');
  await admin.getByText('This display').waitFor();
  step('the passcode survives the restart; a wrong one is refused');

  const closed = new Promise((done) => electronApp.process().once('exit', done));
  admin.on('dialog', (dialog) => dialog.accept());
  await admin.getByRole('button', { name: 'Exit to desktop' }).click({ noWaitAfter: true }).catch(() => {});
  await Promise.race([closed, wait(8000).then(() => { throw new Error('the app did not exit'); })]);
  step('Exit to desktop closes the app');
} catch (error) {
  await electronApp.close().catch(() => {});
  throw error;
}
console.log('All kiosk app checks passed.');
