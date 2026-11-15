import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createStaffConnection } from '../src/connection.mjs';
import { createHotspot, hotspotHost, hotspotName, hotspotProblem, newWifiPassword, startScript, stopScript } from '../src/hotspot.mjs';

test('a Wi-Fi password is long enough for Windows and easy to read off the screen', () => {
  const password = newWifiPassword();
  assert.match(password, /^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
  assert.ok(password.length >= 8);
  assert.notEqual(newWifiPassword(), password);
});

test('the script names the hotspot and its password, quoted for PowerShell, and the stop script names neither', () => {
  const script = startScript({ name: "CIHOF-Display", password: "AB'C-DEFG-HJKM" });
  assert.match(script, /\$configuration\.Ssid = 'CIHOF-Display'/);
  assert.match(script, /\$configuration\.Passphrase = 'AB''C-DEFG-HJKM'/);
  assert.match(script, /IAsyncOperation`1/);
  assert.match(script, /StartTetheringAsync/);
  // An automatic variable in PowerShell: using it would read the user's profile path.
  assert.doesNotMatch(script, /\$profile\b/i);
  assert.match(stopScript(), /StopTetheringAsync/);
  assert.doesNotMatch(stopScript(), /Passphrase/);
});

test('only on Windows', async () => {
  const hotspot = createHotspot({ platform: 'darwin', run: async () => { throw new Error('ran'); } });
  assert.equal(hotspot.supported, false);
  await assert.rejects(hotspot.start(), /only available on Windows/);
});

test('turns it on with a new password, and off only if it turned it on', async () => {
  const ran = [];
  const hotspot = createHotspot({
    platform: 'win32',
    run: async (script) => {
      ran.push(script.includes('StartTetheringAsync') ? 'start' : 'stop');
      if (script.includes('StartTetheringAsync')) {
        const password = /Passphrase = '([^']+)'/.exec(script)[1];
        return { ok: true, alreadyOn: false, name: hotspotName, password };
      }
      return { ok: true };
    },
  });
  const joined = await hotspot.start();
  assert.equal(joined.host, hotspotHost);
  assert.equal(joined.name, hotspotName);
  assert.match(joined.password, /^.{4}-.{4}-.{4}$/);
  assert.deepEqual(await hotspot.stop(), { stopped: true });
  assert.deepEqual(await hotspot.stop(), { stopped: false }, 'nothing left to turn off');
  assert.deepEqual(ran, ['start', 'stop']);
});

test('a hotspot somebody else turned on is used, and left on', async () => {
  const ran = [];
  const hotspot = createHotspot({ platform: 'win32', run: async (script) => { ran.push(script); return { ok: true, alreadyOn: true, name: 'Office hotspot', password: 'theirs123' }; } });
  const joined = await hotspot.start();
  assert.equal(joined.name, 'Office hotspot');
  assert.equal(joined.startedHere, false);
  assert.deepEqual(await hotspot.stop(), { stopped: false });
  assert.equal(ran.length, 1);
});

test('when Windows will not, it says why in words staff can act on', async () => {
  const hotspot = createHotspot({ platform: 'win32', run: async () => ({ ok: false, reason: 'none' }) });
  await assert.rejects(hotspot.start(), /Plug an Ethernet cable/);
  assert.match(hotspotProblem({ reason: 'WiFiDeviceOff' }), /turn Wi-Fi on/);
  assert.match(hotspotProblem({ reason: 'DisabledByGroupPolicy' }), /group policy/);
  assert.match(hotspotProblem({ reason: 'Something new', message: 'Odd.' }), /Something new.*Odd\./);
});

test('the connection says when it closes, however it closes, so its hotspot goes with it', async () => {
  const closed = [];
  const connection = createStaffConnection({
    content: () => null,
    apply: async () => {},
    describe: () => ({}),
    scratch: mkdtempSync(join(tmpdir(), 'cihof-hotspot-')),
    onClosed: async (why) => { closed.push(why); throw new Error('The hotspot did not turn off.'); },
  });
  await connection.open({ minutes: 15, port: 0 });
  await connection.close();
  assert.deepEqual(closed, ['Closed from the admin panel.']);
  // A failure to turn the hotspot off is shown in the panel, not lost.
  assert.equal(connection.state().log[0].what, 'The hotspot did not turn off.');
  await connection.close();
  assert.equal(closed.length, 1, 'closing what is closed does nothing');
});
