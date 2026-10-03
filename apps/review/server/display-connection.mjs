import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { rm, stat } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { bodyChecksum, keyFrom, responseIsSigned, signatureHeaders, signRequest } from '../../kiosk-app/src/connection-auth.mjs';

/**
 * The staff portal's side of a staff connection (apps/kiosk-app/src/
 * connection.mjs): a display reached over the museum's network with the
 * address and pairing code its admin panel shows. It asks what the display
 * shows, fetches its export, and sends it a display update, which the display
 * checks exactly as one loaded from a stick before anybody chooses to apply it.
 *
 * Every request is signed, and no answer is believed unless the display signed
 * it for that request (connection-auth.mjs).
 */

/** "192.168.1.40:5190", "192.168.1.40" or "http://…": the display's address as typed. */
export function displayBase(address) {
  const text = String(address ?? '').trim();
  if (!text) throw new Error('Type the address the display\'s admin panel shows.');
  const withScheme = /^https?:\/\//i.test(text) ? text : `http://${text}`;
  const url = new URL(withScheme);
  if (!url.port) url.port = '5190';
  return `${url.protocol}//${url.host}`;
}

export async function connectToDisplay({ address, code, fetchImpl = fetch }) {
  const base = displayBase(address);
  let hello;
  try {
    hello = await (await fetchImpl(`${base}/cihof/hello`, { signal: AbortSignal.timeout(8000) })).json();
  } catch {
    throw new Error(`No display answered at ${base.replace(/^http:\/\//, '')}. Check the address, and that its staff connection is open.`);
  }
  if (hello?.product !== 'cihof-display' || !/^[0-9a-f]{32}$/.test(hello.salt ?? '')) throw new Error('Whatever answered there is not a CIHOF display.');
  const key = keyFrom(code, hello.salt);
  const display = { base, name: hello.name, key, fetchImpl };
  const state = await call(display, 'GET', '/cihof/state');
  return { display, state };
}

/** A signed request; the answer, believed only if the display signed it. */
async function call(display, method, path, { body, bodyChecksum: checksum, timeout = 30_000 } = {}) {
  const headers = signRequest(display.key, { method, path, body: checksum ?? bodyChecksum(body) });
  const response = await display.fetchImpl(`${display.base}${path}`, {
    method, headers: { ...headers, ...(body ? { 'content-type': 'application/octet-stream' } : {}) }, body, duplex: body ? 'half' : undefined,
    signal: AbortSignal.timeout(timeout),
  });
  const text = await response.text();
  if (!responseIsSigned(display.key, { nonce: headers[signatureHeaders.nonce], status: response.status, headers: response.headers, body: bodyChecksum(text) })) {
    throw new Error(response.status === 401
      ? 'The display did not accept the pairing code. Check it against the one its admin panel shows now; it changes each time the connection is opened.'
      : 'The answer did not come from the display: it was not signed with the pairing code.');
  }
  const value = JSON.parse(text);
  if (!response.ok) throw Object.assign(new Error(value.error ?? response.statusText), { stale: value.stale === true });
  return value;
}

export async function displayState(display) {
  return call(display, 'GET', '/cihof/state');
}

/** Saves what the display shows, as its export, to `file`; checked against the checksum the display signed. */
export async function fetchExport(display, file) {
  const path = '/cihof/export';
  const headers = signRequest(display.key, { method: 'GET', path });
  const response = await display.fetchImpl(`${display.base}${path}`, { headers, signal: AbortSignal.timeout(30 * 60_000) });
  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    throw new Error(response.status === 401 ? 'The display did not accept the pairing code.' : `The display could not export its content. ${text}`);
  }
  const hash = createHash('sha256');
  await pipeline(Readable.fromWeb(response.body), new Transform({ transform(chunk, _encoding, next) { hash.update(chunk); next(null, chunk); } }), createWriteStream(file));
  const checksum = hash.digest('hex');
  if (!responseIsSigned(display.key, { nonce: headers[signatureHeaders.nonce], status: response.status, headers: response.headers, body: checksum })) {
    await rm(file, { force: true });
    throw new Error('The export did not come from the display, or did not arrive whole. Fetch it again.');
  }
  return { file, contentVersion: response.headers.get('x-cihof-content-version') };
}

/** Sends an update; the display checks it and says what it would change, without applying it. */
export async function sendUpdate(display, file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  const size = (await stat(file)).size;
  return call(display, 'POST', '/cihof/updates', {
    body: Readable.toWeb(createReadStream(file)), bodyChecksum: hash.digest('hex'), timeout: Math.max(60_000, size / 1e6 * 1000),
  });
}

export async function applyUpdate(display, id, { now = false, force = false } = {}) {
  return call(display, 'POST', `/cihof/updates/${id}/apply?now=${now ? 'yes' : 'no'}&force=${force ? 'yes' : 'no'}`, { timeout: 10 * 60_000 });
}
