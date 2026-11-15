import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStaffConnection } from '../../kiosk-app/src/connection.mjs';
import { bodyChecksum, keyFrom, signRequest, signResponse } from '../../kiosk-app/src/connection-auth.mjs';

/**
 * For the Android display remote's tests (app/src/test): the display's side,
 * from the display's own code, so the phone is tested against what it will
 * really talk to.
 *
 *   node scripts/test-display.mjs vectors   signatures made by connection-auth.mjs, as JSON
 *   node scripts/test-display.mjs serve     a real staff connection over a stand-in content store;
 *                                           prints {"port", "code"} and runs until stdin closes
 */

const mode = process.argv[2];

if (mode === 'vectors') {
  const code = 'K7RM-4QXP';
  const salt = '00112233445566778899aabbccddeeff';
  const key = keyFrom(code, salt);
  const body = bodyChecksum('{"hello":"display"}');
  const request = signRequest(key, { method: 'post', path: '/cihof/updates/x/apply?now=no&force=no', body, now: 1_700_000_000_000 });
  const response = signResponse(key, { nonce: request['x-cihof-nonce'], status: 409, body });
  process.stdout.write(JSON.stringify({ code: 'k7rm 4qxp', salt, key: key.toString('hex'), body, request, response, empty: bodyChecksum() }));
} else if (mode === 'serve') {
  const scratch = mkdtempSync(join(tmpdir(), 'cihof-remote-test-'));
  let active = 'content-aaaa';
  const history = [];
  const store = {
    state: () => ({ active, onDelivered: active === 'content-aaaa', delivered: { contentVersion: 'content-aaaa' }, history }),
    exportCurrent: async () => { throw new Error('Not in this test.'); },
    inspect: async (file) => {
      const text = readFileSync(file, 'utf8');
      return {
        problems: text.includes('broken') ? ['It is broken.'] : [],
        stale: text.includes('stale') ? 'It was made from content-zzzz, which this display no longer shows.' : null,
        changes: { from: active, to: 'content-bbbb', summary: ['Changed a biography.'], createdBy: 'Jane Smith', createdAt: '2026-11-15T14:03:00.000Z', newFilms: 1 },
        manifest: { createdBy: 'Jane Smith' },
      };
    },
  };
  const connection = createStaffConnection({
    content: () => store,
    apply: async (_file, { now, force }) => {
      active = 'content-bbbb';
      history.unshift({ contentVersion: active, createdBy: 'Jane Smith', createdAt: '2026-11-15T14:03:00.000Z', appliedAt: new Date().toISOString(), summary: [`now=${now} force=${force}`] });
    },
    describe: () => ({ name: 'Test display', app: { version: '9.9.9', release: 'abc1234', content: 'def', people: 93 } }),
    scratch,
  });
  const opened = await connection.open({ minutes: 15, port: 0, name: 'Test display' });
  process.stdout.write(`${JSON.stringify({ port: opened.port, code: opened.code })}\n`);
  const stop = async () => { await connection.close(); rmSync(scratch, { recursive: true, force: true }); process.exit(0); };
  process.stdin.on('end', stop);
  process.stdin.on('close', stop);
  process.stdin.resume();
} else {
  console.error('Use: node scripts/test-display.mjs vectors | serve');
  process.exit(1);
}
