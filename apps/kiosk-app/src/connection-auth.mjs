import { createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * How the staff portal and a display prove themselves to each other over the
 * museum's network, shared by both (connection.mjs on the display,
 * apps/review/server/display-connection.mjs in the portal).
 *
 * The display shows a pairing code while its staff connection is open. The
 * code itself never crosses the network: each side turns it into a key, with
 * a salt the display chooses afresh each time it opens, and signs every
 * request and every answer with that key, over what it says: the method, the
 * path, the time, a one-off nonce and the checksum of the body. A request
 * from the wrong key, too old, or seen before is refused; an answer that does
 * not carry the display's signature for this request is not believed.
 *
 * Nothing is encrypted: what travels is the museum's own exhibit content, and
 * each file of it is checked against its checksum when it arrives. The code is
 * long enough (eight characters of 32, about 40 bits, stretched with scrypt)
 * that somebody recording the traffic cannot work it out while the
 * connection is open.
 */

/** No letters or digits that read as each other: no 0/O, 1/I/L. */
const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const signatureHeaders = { time: 'x-cihof-time', nonce: 'x-cihof-nonce', body: 'x-cihof-body', signature: 'x-cihof-signature' };
/** How far apart the two computers' clocks may be, and how long a request stays good. */
export const allowedSkewMs = 2 * 60 * 1000;
const emptyBody = createHash('sha256').digest('hex');

export function newPairingCode() {
  const characters = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]);
  return `${characters.slice(0, 4).join('')}-${characters.slice(4).join('')}`;
}

/** The code as typed: case, spaces and the dash do not matter. */
export function normaliseCode(code) {
  return String(code ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function newSalt() {
  return randomBytes(16).toString('hex');
}

export function keyFrom(code, salt) {
  return scryptSync(normaliseCode(code), Buffer.from(salt, 'hex'), 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

export function bodyChecksum(data) {
  return data === undefined || data === null ? emptyBody : createHash('sha256').update(data).digest('hex');
}

const requestText = ({ method, path, time, nonce, body }) => ['request', method.toUpperCase(), path, String(time), nonce, body].join('\n');
const responseText = ({ nonce, status, body }) => ['response', nonce, String(status), body].join('\n');
const mac = (key, text) => createHmac('sha256', key).update(text).digest('hex');

/** The headers that sign a request. `body` is the body's checksum. */
export function signRequest(key, { method, path, body = emptyBody, now = Date.now() }) {
  const nonce = randomBytes(16).toString('hex');
  const time = now;
  return {
    [signatureHeaders.time]: String(time),
    [signatureHeaders.nonce]: nonce,
    [signatureHeaders.body]: body,
    [signatureHeaders.signature]: mac(key, requestText({ method, path, time, nonce, body })),
  };
}

/**
 * Checks a request's signature, time and nonce, before its body is read.
 * `seen` remembers nonces; returns the problem, or null. The body's
 * checksum, once read, is compared with the one signed (`header.body`).
 */
export function checkRequest(key, { method, path, headers, seen, now = Date.now() }) {
  const get = (name) => String(headers[name] ?? '');
  const time = Number(get(signatureHeaders.time));
  const nonce = get(signatureHeaders.nonce);
  const body = get(signatureHeaders.body);
  const signature = get(signatureHeaders.signature);
  if (!Number.isFinite(time) || !/^[0-9a-f]{32}$/.test(nonce) || !/^[0-9a-f]{64}$/.test(body) || !/^[0-9a-f]{64}$/.test(signature)) return 'not signed';
  if (Math.abs(now - time) > allowedSkewMs) return 'too old, or the two computers disagree about the time';
  const expected = Buffer.from(mac(key, requestText({ method, path, time, nonce, body })), 'hex');
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return 'not signed with this display\'s code';
  if (seen.has(nonce)) return 'already seen';
  seen.set(nonce, time);
  for (const [old, at] of seen) if (now - at > allowedSkewMs * 2) seen.delete(old);
  return null;
}

/** The headers that sign an answer to the request with this nonce. */
export function signResponse(key, { nonce, status, body = emptyBody }) {
  return { [signatureHeaders.body]: body, [signatureHeaders.signature]: mac(key, responseText({ nonce, status, body })) };
}

/** Whether an answer carries the display's signature for this request and this body. */
export function responseIsSigned(key, { nonce, status, headers, body }) {
  const signature = String(headers.get?.(signatureHeaders.signature) ?? headers[signatureHeaders.signature] ?? '');
  const claimed = String(headers.get?.(signatureHeaders.body) ?? headers[signatureHeaders.body] ?? '');
  if (!/^[0-9a-f]{64}$/.test(signature) || claimed !== body) return false;
  return timingSafeEqual(Buffer.from(mac(key, responseText({ nonce, status, body })), 'hex'), Buffer.from(signature, 'hex'));
}
