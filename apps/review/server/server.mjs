#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadReview } from './data.mjs';
import { audiences, check, gitStatus, save } from './save.mjs';
import { draftCounts } from './sheets.mjs';

/**
 * The staff review app: a small local server and the pages it serves.
 *
 *   npm run review            build the pages, start, and open the browser
 *   npm run review -- --no-open --port=5180
 *
 * It runs on the computer that holds the project and answers only that
 * computer (127.0.0.1). It reads the data fresh on every page load, keeps a
 * reviewer's unsaved decisions in .review/draft.json (ignored by git), and
 * saves them through the same apply tools a developer runs, as local commits.
 * It never pushes.
 */

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

export function createReviewServer({ root, dist, port }) {
  const draftPath = join(root, '.review', 'draft.json');
  const readDraft = () => {
    try { return JSON.parse(readFileSync(draftPath, 'utf8')); } catch { return emptyDraft(); }
  };
  const writeDraft = (draft) => {
    mkdirSync(join(root, '.review'), { recursive: true });
    writeFileSync(draftPath, `${JSON.stringify(draft, null, 2)}\n`);
  };
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);

  return createServer(async (request, response) => {
    try {
      // Another website open in the same browser can send requests here. It
      // cannot make them carry this host, or this origin.
      if (!allowedHosts.has(request.headers.host ?? '')) return send(response, 403, 'Not this host.');
      const origin = request.headers.origin;
      if (origin && !allowedHosts.has(origin.replace(/^https?:\/\//, ''))) return send(response, 403, 'Not this origin.');

      const url = new URL(request.url ?? '/', `http://${request.headers.host}`);

      if (url.pathname.startsWith('/api/')) {
        if (request.method !== 'GET' && !String(request.headers['content-type'] ?? '').startsWith('application/json')) {
          return send(response, 415, 'Send JSON.');
        }
        return await api(request, response, url.pathname);
      }

      // Portraits, read-only, from the project's own media folder.
      if (url.pathname.startsWith('/media/images/')) {
        return file(response, join(root, 'public'), url.pathname);
      }
      return file(response, dist, url.pathname === '/' ? '/index.html' : url.pathname, join(dist, 'index.html'));
    } catch (error) {
      return json(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  async function api(request, response, path) {
    if (request.method === 'GET' && path === '/api/review') {
      const draft = readDraft();
      return json(response, 200, { ...loadReview(), draft, counts: draftCounts(draft), git: gitStatus(root) });
    }
    if (request.method === 'PUT' && path === '/api/draft') {
      const draft = normaliseDraft(await body(request));
      writeDraft(draft);
      return json(response, 200, { counts: draftCounts(draft) });
    }
    if (request.method === 'POST' && path === '/api/check') {
      const { audience } = await body(request);
      return json(response, 200, { results: check({ root, draft: readDraft(), audience: audienceOf(audience) }) });
    }
    if (request.method === 'POST' && path === '/api/save') {
      const { audience } = await body(request);
      const outcome = save({ root, draft: readDraft(), audience: audienceOf(audience) });
      writeDraft(outcome.draft);
      return json(response, 200, { results: outcome.results, counts: draftCounts(outcome.draft), git: gitStatus(root) });
    }
    return json(response, 404, { error: 'No such request.' });
  }
}

export function emptyDraft() {
  return { reviewer: '', ties: {}, places: {}, placeTies: {}, bios: {}, profiles: {} };
}

/** Keeps only the draft's own shape, so nothing else can be smuggled into a sheet. */
function normaliseDraft(value) {
  const object = (candidate) => (candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? candidate : {});
  const draft = object(value);
  return {
    reviewer: typeof draft.reviewer === 'string' ? draft.reviewer.slice(0, 120) : '',
    ties: object(draft.ties),
    places: object(draft.places),
    placeTies: object(draft.placeTies),
    bios: object(draft.bios),
    profiles: object(draft.profiles),
  };
}

function audienceOf(value) {
  return Object.hasOwn(audiences, value) ? value : 'kiosk';
}

function body(request) {
  return new Promise((done, fail) => {
    let size = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > 5 * 1024 * 1024) { fail(new Error('Too large.')); request.destroy(); return; }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try { done(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (error) { fail(error); }
    });
    request.on('error', fail);
  });
}

function file(response, base, pathname, fallback) {
  const target = normalize(join(base, decodeURIComponent(pathname)));
  if (target !== base && !target.startsWith(base + sep)) return send(response, 403, 'Outside the folder.');
  const chosen = existsSync(target) && statSync(target).isFile() ? target : fallback;
  if (!chosen || !existsSync(chosen)) return send(response, 404, 'Not found.');
  response.writeHead(200, {
    'content-type': mime[extname(chosen).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  createReadStream(chosen).pipe(response);
}

function json(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(value));
}

function send(response, status, text) {
  response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  response.end(text);
}

function openBrowser(url) {
  const [command, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]]
      : ['xdg-open', [url]];
  spawn(command, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [key, ...rest] = a.slice(2).split('=');
    return [key, rest.length > 0 ? rest.join('=') : true];
  }));
  const port = Number(args.port || 5180);
  const root = process.cwd();
  const dist = fileURLToPath(new URL('../dist', import.meta.url));
  if (!existsSync(join(root, 'data', 'cihof_curated_metadata.json'))) {
    console.error('Run this from the project folder (npm run review).');
    process.exit(1);
  }
  if (!existsSync(join(dist, 'index.html'))) {
    console.error('The review pages have not been built. Run: npm run review');
    process.exit(1);
  }
  const server = createReviewServer({ root, dist, port });
  server.on('error', (error) => {
    console.error(error.code === 'EADDRINUSE'
      ? `Port ${port} is in use. Is the review app already open? Otherwise use --port=<another>.`
      : error.message);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://localhost:${port}/`;
    console.log('\n  CIHOF staff review');
    console.log(`  ${url}`);
    console.log('  Leave this window open while you review. Close it to stop.\n');
    if (!args['no-open']) openBrowser(url);
  });
}
