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
 *   node server.mjs --videos=/path/to/videos
 *
 * The films can live outside the site, in a folder of their own laid out as
 * the project's public/media/videos is (one folder per person), so a release
 * need not carry 20 GB of them: a film is looked for there first, then in the
 * site.
 * It listens on 127.0.0.1 by default: the display is its only visitor. Pass
 * --host=0.0.0.0 only on purpose, for example to check it from a laptop on a
 * private network during installation.
 */

import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { pipeline } from 'node:stream';
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

/** What the films folder may serve: the films, and nothing else. */
const filmFile = /\.(mp4|webm)$/i;

/**
 * @param {{
 *   root: string,
 *   videos?: string | null | (() => string | null),
 *   content?: (() => ContentServing | null) | null,
 * }} options
 *   `videos`: the films folder, or a function that says what it is now, so a
 *   folder chosen while the display runs is used at once.
 *   `content`: in the desktop app, the content version being served instead
 *   of the delivered content (see apps/kiosk-app/src/content-store.mjs), or
 *   null while the delivered content is served. Asked on every request, so a
 *   version chosen in the admin panel is served at once.
 * @returns {import('node:http').Server}
 *
 * @typedef {{
 *   releaseJson: string, workerJs: string,
 *   site: (path: string) => string | null,
 *   film: (path: string) => string | null,
 * }} ContentServing
 */
export function createKioskServer({ root, videos = null, content = null }) {
  const siteRoot = resolve(root);
  const videosRoot = () => {
    const folder = typeof videos === 'function' ? videos() : videos;
    return folder ? resolve(folder) : null;
  };

  return createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }

    const serving = typeof content === 'function' ? content() : null;
    const file = serving
      ? locateContent(serving, videosRoot(), siteRoot, request.url ?? '/')
      : locateFilm(videosRoot(), request.url ?? '/') ?? locate(siteRoot, request.url ?? '/');
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
      send(createReadStream(file.path, range), response);
      return;
    }

    response.writeHead(200, { ...headers, 'Content-Length': file.size });
    if (request.method === 'HEAD') { response.end(); return; }
    send(createReadStream(file.path), response);
  });
}

/**
 * Streams a file to a response and closes the file whatever happens.
 *
 * A video player cancels its request every time a visitor seeks, and `.pipe`
 * leaves the file open when the response closes early. On a display that runs
 * for months that is a slow leak of file handles until nothing can be opened.
 * `pipeline` destroys both ends on an abort or an error, and a read error (a
 * file removed mid-stream) ends that one response rather than the server.
 */
function send(file, response) {
  pipeline(file, response, () => {});
}

/**
 * A film from the films folder, or null: only a film's address
 * (/media/videos/<person>/<film>.mp4), and never anything outside the folder.
 */
function locateFilm(videosRoot, url) {
  if (!videosRoot) return null;
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  } catch {
    return null;
  }
  if (!pathname.startsWith('/media/videos/') || !filmFile.test(pathname) || pathname.includes('\0')) return null;
  const candidate = resolve(videosRoot, `.${normalize(pathname.slice('/media/videos'.length))}`);
  if (!candidate.startsWith(videosRoot + sep)) return null;
  try {
    const stat = statSync(candidate);
    return stat.isFile() ? { path: candidate, size: stat.size } : null;
  } catch {
    return null;
  }
}

/**
 * With a content version served: its own release manifest and worker, its
 * content (`data/`, `media/`) from the version and nothing else, so a file it
 * dropped is gone, a film it brought before the films folder, and the app's
 * own files as delivered.
 */
function locateContent(serving, videosRoot, siteRoot, url) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  } catch {
    return null;
  }
  if (pathname.includes('\0')) return null;
  const fileAt = (path) => {
    if (!path) return null;
    try {
      const stat = statSync(path);
      return stat.isFile() ? { path, size: stat.size } : null;
    } catch {
      return null;
    }
  };
  if (pathname === '/release.json') return fileAt(serving.releaseJson);
  if (pathname === '/sw.js') return fileAt(serving.workerJs);
  const relative = pathname.replace(/^\/+/, '');
  if (pathname.startsWith('/media/videos/') && filmFile.test(pathname)) {
    return fileAt(serving.film(pathname.slice('/media/videos/'.length))) ?? locateFilm(videosRoot, url) ?? locate(siteRoot, url);
  }
  if (relative.startsWith('data/') || relative.startsWith('media/')) return fileAt(serving.site(relative));
  return locate(siteRoot, url);
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

// Compare the real paths of what was run and of this module: on macOS the
// temporary folder is a link (/var is /private/var), an install may be reached
// through a link, and Node may name this module by either path
// (--preserve-symlinks-main keeps the link). Otherwise it would never start.
const invokedDirectly = process.argv[1] && existsSync(process.argv[1])
  && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
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

  const videos = args.videos ? resolve(args.videos) : null;
  const server = createKioskServer({ root, videos });
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
    if (videos) console.log(`  films   ${videos}`);
    console.log(`  open    http://localhost:${port}/`);
    console.log('  stop    Ctrl+C');
  });
}
