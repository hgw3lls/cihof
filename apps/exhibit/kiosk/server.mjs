#!/usr/bin/env node
/**
 * The installed display's own web server.
 *
 * Serves the exhibit from the `site/` folder beside it, on this machine only.
 * No dependencies beyond Node itself, so there is nothing to install and
 * nothing to update but Node.
 *
 * Why a server at all: the exhibit's offline worker only runs on an http(s)
 * origin, never from a file on disk, and films stream from here rather than
 * from the worker's cache, which means answering the byte-range requests a
 * video player makes when it seeks. `localhost` counts as a secure origin, so
 * the worker runs without a certificate.
 *
 *   node server.mjs                       http://localhost:8080/
 *   node server.mjs --port=9000
 *   node server.mjs --root=/path/to/site
 *
 * It listens on 127.0.0.1 by default: the display is its only visitor. Pass
 * --host=0.0.0.0 only on purpose, for example to check it from a laptop on a
 * private network during installation.
 */

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.vtt': 'text/vtt; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

/**
 * @param {{ root: string }} options
 * @returns {import('node:http').Server}
 */
export function createKioskServer({ root }) {
  const siteRoot = resolve(root);

  return createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }

    const file = locate(siteRoot, request.url ?? '/');
    if (!file) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }

    const headers = {
      'Content-Type': types[extname(file.path).toLowerCase()] ?? 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      // Revalidate every time. The offline worker holds the release; this only
      // has to make sure a new release is noticed when one is installed.
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    };

    const range = parseRange(request.headers.range, file.size);
    if (range === 'invalid') {
      response.writeHead(416, { ...headers, 'Content-Range': `bytes */${file.size}` }).end();
      return;
    }

    if (range) {
      response.writeHead(206, {
        ...headers,
        'Content-Range': `bytes ${range.start}-${range.end}/${file.size}`,
        'Content-Length': range.end - range.start + 1,
      });
      if (request.method === 'HEAD') { response.end(); return; }
      createReadStream(file.path, range).pipe(response);
      return;
    }

    response.writeHead(200, { ...headers, 'Content-Length': file.size });
    if (request.method === 'HEAD') { response.end(); return; }
    createReadStream(file.path).pipe(response);
  });
}

/**
 * The file a URL names, or null. Never anything outside the site folder.
 */
function locate(siteRoot, url) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  } catch {
    return null;
  }
  if (pathname.includes('\0')) return null;

  const candidate = resolve(siteRoot, `.${normalize(pathname)}`);
  if (candidate !== siteRoot && !candidate.startsWith(siteRoot + sep)) return null;

  for (const path of [candidate, join(candidate, 'index.html')]) {
    try {
      const stat = statSync(path);
      if (stat.isFile()) return { path, size: stat.size };
    } catch {
      // Not there; try the next.
    }
  }
  return null;
}

/**
 * One byte range, as a video player asks for it. Multiple ranges are not
 * needed by any player and are answered with the whole file.
 */
function parseRange(header, size) {
  if (typeof header !== 'string' || !header.startsWith('bytes=')) return null;
  const spec = header.slice('bytes='.length).trim();
  if (spec.includes(',')) return null;
  const match = /^(\d*)-(\d*)$/.exec(spec);
  if (!match || (match[1] === '' && match[2] === '')) return 'invalid';

  let start;
  let end;
  if (match[1] === '') {
    // "bytes=-500": the last 500 bytes.
    const suffix = Number(match[2]);
    if (suffix === 0) return 'invalid';
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (start > end || start >= size) return 'invalid';
  return { start, end };
}

function parseArgs(argv) {
  const parsed = {};
  for (const argument of argv) {
    if (!argument.startsWith('--')) continue;
    const [key, ...rest] = argument.slice(2).split('=');
    parsed[key] = rest.join('=');
  }
  return parsed;
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const args = parseArgs(process.argv.slice(2));
  const here = fileURLToPath(new URL('.', import.meta.url));
  const root = resolve(args.root || join(here, 'site'));
  const port = Number(args.port || process.env.PORT || 8080);
  const host = args.host || '127.0.0.1';

  try {
    if (!statSync(join(root, 'index.html')).isFile()) throw new Error();
  } catch {
    console.error(`No exhibit found at ${root}. Run this from the kiosk package folder, or pass --root.`);
    process.exit(1);
  }

  const server = createKioskServer({ root });
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Is the exhibit already running? Otherwise pass --port=<another>.`);
    } else {
      console.error(error.message);
    }
    process.exit(1);
  });
  server.listen(port, host, () => {
    console.log(`Cleveland International Hall of Fame exhibit`);
    console.log(`  serving ${root}`);
    console.log(`  open    http://localhost:${port}/`);
    console.log('  stop    Ctrl+C');
  });
}
