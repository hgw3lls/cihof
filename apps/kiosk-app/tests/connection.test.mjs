import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { createStaffConnection } from '../src/connection.mjs';
import { keyFrom, newPairingCode, normaliseCode, signRequest } from '../src/connection-auth.mjs';
import { applyUpdate, connectToDisplay, displayBase, fetchExport, sendUpdate } from '../../review/server/display-connection.mjs';

const scratch = mkdtempSync(join(tmpdir(), 'cihof-connection-'));
// A display's content store, as far as the connection uses it.
const applied = [];
let stale = null;
const store = {
  state: () => ({ active: 'content-aaaa', onDelivered: true, history: [] }),
  exportCurrent: async (file) => { writeFileSync(file, 'the display\'s export'); return { contentVersion: 'content-aaaa', files: 1 }; },
  inspect: async (file) => ({
    problems: readFileSync(file, 'utf8').includes('broken') ? ['It is broken.'] : [],
    stale,
    changes: { to: 'content-bbbb', summary: ['A change.'] },
    manifest: { createdBy: 'Jane Smith' },
  }),
};
const connection = createStaffConnection({
  content: () => store,
  apply: async (file, options) => { applied.push({ text: readFileSync(file, 'utf8'), ...options }); },
  describe: () => ({ name: 'Gallery display', version: '1.0.0' }),
  scratch,
});
after(() => connection.close());

test('a pairing code is easy to read out, and typed any way it still matches', () => {
  const code = newPairingCode();
  assert.match(code, /^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
  assert.equal(normaliseCode(code.toLowerCase().replace('-', ' ')), normaliseCode(code));
  assert.equal(displayBase('192.168.1.40'), 'http://192.168.1.40:5190');
});

test('closed, nothing answers; opened, the portal connects only with the code the panel shows', async () => {
  await assert.rejects(connectToDisplay({ address: '127.0.0.1:5191', code: 'AAAA-AAAA' }), /No display answered/);
  const opened = await connection.open({ minutes: 15, port: 0, name: 'Gallery display' });
  assert.equal(opened.open, true);
  const address = `127.0.0.1:${opened.port}`;
  await assert.rejects(connectToDisplay({ address, code: 'WRNG-C0DE' }), /did not accept the pairing code/);
  const { display, state } = await connectToDisplay({ address, code: opened.code.toLowerCase() });
  assert.equal(state.name, 'Gallery display');
  assert.equal(state.content.active, 'content-aaaa');
  assert.ok(connection.state().log.some((entry) => /connected/.test(entry.what)));

  // Its export, checked against the checksum the display signed.
  const file = join(scratch, 'fetched.cihof');
  assert.equal((await fetchExport(display, file)).contentVersion, 'content-aaaa');
  assert.equal(readFileSync(file, 'utf8'), 'the display\'s export');

  // An update: checked first, applied only when asked, stale only when forced.
  const update = join(scratch, 'update.cihof');
  writeFileSync(update, 'an update');
  const report = await sendUpdate(display, update);
  assert.deepEqual(report.problems, []);
  assert.equal(applied.length, 0, 'nothing is applied by sending it');
  await applyUpdate(display, report.id, { now: true });
  assert.deepEqual(applied, [{ text: 'an update', now: true, force: false }]);
  await assert.rejects(applyUpdate(display, report.id), /not here any more/);

  stale = 'Made from an older version.';
  const again = await sendUpdate(display, update);
  await assert.rejects(applyUpdate(display, again.id), /older version/);
  await applyUpdate(display, again.id, { force: true });
  assert.equal(applied.at(-1).force, true);
  stale = null;

  writeFileSync(update, 'broken');
  const broken = await sendUpdate(display, update);
  assert.deepEqual(broken.problems, ['It is broken.']);
  await assert.rejects(applyUpdate(display, broken.id), /broken/);
});

test('a request replayed, or signed with the wrong code, is refused, and too many close it', async () => {
  const opened = await connection.open({ minutes: 15, port: 0 });
  const base = `http://127.0.0.1:${opened.port}`;
  const hello = await (await fetch(`${base}/cihof/hello`)).json();
  const headers = signRequest(keyFrom(opened.code, hello.salt), { method: 'GET', path: '/cihof/state' });
  assert.equal((await fetch(`${base}/cihof/state`, { headers })).status, 200);
  assert.equal((await fetch(`${base}/cihof/state`, { headers })).status, 401, 'a replay is refused');
  const wrong = keyFrom('ZZZZ-ZZZZ', hello.salt);
  for (let attempt = 0; attempt < 12; attempt += 1) await fetch(`${base}/cihof/state`, { headers: signRequest(wrong, { method: 'GET', path: '/cihof/state' }) }).catch(() => {});
  assert.equal(connection.state().open, false);
  assert.match(connection.state().log[0].what, /too many requests/);
  await assert.rejects(fetch(`${base}/cihof/hello`));
});
