import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { bodyChecksum, checkRequest, keyFrom, newPairingCode, newSalt, signatureHeaders, signResponse } from './connection-auth.mjs';

/**
 * The staff connection: the staff portal reaching this display over the
 * museum's network, so content need not travel on a USB stick.
 *
 * It is off until somebody opens it in the admin panel, and then only for as
 * long as they chose: it closes itself when the time is up, or when they
 * close it, or after too many requests that are not signed with the pairing
 * code the panel shows (connection-auth.mjs). It is its own server, on its own
 * port: the exhibit's server never answers anything but this machine.
 *
 * It does what staff can do in the Content section, and nothing else: tell
 * what the display shows, export it, and take an update in, checked exactly
 * as one loaded from a stick, then apply it now or at the next reset. Every
 * request is listed in the panel.
 */

export const defaultConnectionPort = 5190;
/** How long a connection may be opened for. */
export const connectionMinutes = [15, 30, 60, 120];
/** Requests not signed with the code before the connection closes itself. */
const strikesAllowed = 12;
/** The largest update taken in: a few films. */
const largestUpdate = 64 * 1024 ** 3;

/**
 * @param {{
 *   content: () => ReturnType<typeof import('./content-store.mjs').createContentStore> | null,
 *   apply: (file: string, options: { now: boolean, force: boolean }) => Promise<unknown>,
 *   describe: () => object,
 *   scratch: string,
 *   onChange?: () => void,
 * }} options
 */
export function createStaffConnection({ content, apply, describe, scratch, onChange = () => {} }) {
  let open = null;
  const log = [];
  const note = (what) => {
    log.unshift({ at: new Date().toISOString(), what });
    log.length = Math.min(log.length, 40);
    onChange();
  };

  const close = async (why) => {
    if (!open) return;
    const closing = open;
    open = null;
    clearTimeout(closing.timer);
    await new Promise((done) => { closing.server.close(() => done()); closing.server.closeAllConnections?.(); });
    await rm(closing.scratch, { recursive: true, force: true });
    note(why);
  };

  const handle = async (request, response) => {
    const session = open;
    if (!session) { response.writeHead(503).end(); return; }
    const url = new URL(request.url ?? '/', 'http://display');
    const send = (status, value, nonce) => {
      const text = JSON.stringify(value);
      response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(nonce ? signResponse(session.key, { nonce, status, body: bodyChecksum(text) }) : {}) });
      response.end(text);
    };

    // What a portal needs to sign anything: which display this is, and this opening's salt. Nothing else.
    if (request.method === 'GET' && url.pathname === '/cihof/hello') {
      send(200, { product: 'cihof-display', name: session.name, salt: session.salt });
      return;
    }

    const problem = checkRequest(session.key, { method: request.method ?? 'GET', path: url.pathname + url.search, headers: request.headers, seen: session.seen });
    if (problem) {
      session.strikes += 1;
      send(401, { error: `Refused: ${problem}.` });
      if (session.strikes >= strikesAllowed) await close('Closed: too many requests that did not have the pairing code.');
      else note(`Refused a request (${problem}) from ${request.socket.remoteAddress ?? 'somewhere'}.`);
      return;
    }
    const nonce = String(request.headers[signatureHeaders.nonce]);
    const store = content();
    if (!store) { send(503, { error: 'This display\'s content store could not be opened.' }, nonce); return; }

    if (request.method === 'GET' && url.pathname === '/cihof/state') {
      if (!session.greeted) { session.greeted = true; note(`The staff portal connected from ${request.socket.remoteAddress ?? 'somewhere'}.`); }
      send(200, { ...describe(), content: store.state() }, nonce);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/cihof/export') {
      const file = join(session.scratch, `export-${randomUUID()}.cihof`);
      await mkdir(session.scratch, { recursive: true });
      const made = await store.exportCurrent(file);
      const checksum = await fileChecksum(file);
      response.writeHead(200, {
        'content-type': 'application/zip', 'cache-control': 'no-store', 'content-length': String((await stat(file)).size),
        'x-cihof-content-version': made.contentVersion,
        ...signResponse(session.key, { nonce, status: 200, body: checksum }),
      });
      await pipeline(createReadStream(file), response);
      await rm(file, { force: true });
      note(`Exported what it shows (${made.contentVersion}) to the staff portal.`);
      return;
    }

    // An update, taken in and checked; applied by a second request, once staff have seen what it says.
    if (request.method === 'POST' && url.pathname === '/cihof/updates') {
      const claimed = String(request.headers[signatureHeaders.body]);
      const id = randomUUID();
      const file = join(session.scratch, `update-${id}.cihof`);
      await mkdir(session.scratch, { recursive: true });
      const hash = createHash('sha256');
      let size = 0;
      try {
        await pipeline(request, new Transform({
          transform(chunk, _encoding, next) {
            size += chunk.length;
            if (size > largestUpdate) { next(new Error('too large')); return; }
            hash.update(chunk);
            next(null, chunk);
          },
        }), createWriteStream(file));
      } catch {
        await rm(file, { force: true });
        send(400, { error: 'The update did not arrive whole.' }, nonce);
        return;
      }
      if (hash.digest('hex') !== claimed) {
        await rm(file, { force: true });
        send(400, { error: 'The update arrived different from what was signed. Send it again.' }, nonce);
        return;
      }
      const report = await store.inspect(file);
      session.updates.set(id, { file, report });
      note(`Received an update from the staff portal${report.manifest?.createdBy ? `, made by ${report.manifest.createdBy}` : ''}${report.problems.length ? '; it cannot be applied' : ''}.`);
      send(200, { id, problems: report.problems, stale: report.stale, changes: report.changes }, nonce);
      return;
    }

    const applying = /^\/cihof\/updates\/([0-9a-f-]{36})\/apply$/.exec(url.pathname);
    if (request.method === 'POST' && applying) {
      const held = session.updates.get(applying[1]);
      if (!held) { send(404, { error: 'That update is not here any more. Send it again.' }, nonce); return; }
      const now = url.searchParams.get('now') === 'yes';
      const force = url.searchParams.get('force') === 'yes';
      if (held.report.problems.length) { send(409, { error: held.report.problems.join(' ') }, nonce); return; }
      if (held.report.stale && !force) { send(409, { error: held.report.stale, stale: true }, nonce); return; }
      try {
        await apply(held.file, { now, force });
      } catch (error) {
        send(500, { error: error instanceof Error ? error.message : String(error) }, nonce);
        return;
      }
      session.updates.delete(applying[1]);
      await rm(held.file, { force: true });
      note(`Applied the update from the staff portal (${held.report.changes?.to ?? 'a new version'}), ${now ? 'shown now' : 'shown at the next reset'}.`);
      send(200, { applied: true, now, content: store.state() }, nonce);
      return;
    }

    send(404, { error: 'No such request.' }, nonce);
  };

  return {
    /** Opens it for this many minutes: a new code, a new salt, a fresh start. */
    async open({ minutes = 30, port = defaultConnectionPort, name = 'CIHOF display' } = {}) {
      await close('Closed, to open again.');
      if (!connectionMinutes.includes(minutes)) throw new Error(`Open it for one of ${connectionMinutes.join(', ')} minutes.`);
      const code = newPairingCode();
      const salt = newSalt();
      const server = createServer((request, response) => {
        handle(request, response).catch((error) => {
          if (!response.headersSent) response.writeHead(500, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
        });
      });
      await new Promise((done, fail) => { server.once('error', fail); server.listen(port, '0.0.0.0', done); });
      port = server.address().port;
      const expiresAt = Date.now() + minutes * 60_000;
      open = {
        server, code, salt, key: keyFrom(code, salt), name, port, expiresAt, seen: new Map(), strikes: 0, greeted: false,
        updates: new Map(), scratch: join(scratch, randomUUID()),
        timer: setTimeout(() => { void close('Closed: its time was up.'); }, minutes * 60_000),
      };
      note(`Opened for ${minutes} minutes.`);
      return this.state();
    },
    close: () => close('Closed from the admin panel.'),
    /** For the admin panel: whether it is open, the code, where the portal finds it, and what happened. */
    state() {
      return {
        open: Boolean(open),
        code: open?.code ?? null,
        port: open?.port ?? null,
        expiresAt: open ? new Date(open.expiresAt).toISOString() : null,
        addresses: open ? addresses(open.port) : [],
        log: [...log],
      };
    },
  };
}

/** Where on the network the portal can reach this display. */
export function addresses(port) {
  return Object.values(networkInterfaces()).flat()
    .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => `${entry.address}:${port}`);
}

async function fileChecksum(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

