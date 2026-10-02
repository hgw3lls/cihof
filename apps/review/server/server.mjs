#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadReview, previewTour } from './data.mjs';
import { readiness, readSignoffs } from './readiness.mjs';
import { signoffChecklists } from './checklist.mjs';
import { history, sheetRows } from './history.mjs';
import { filmFiles, previewFix } from '../../../packages/pipeline/src/build/caption-fixes.ts';
import { readVideoHoldings } from '../../../packages/pipeline/src/sources/media.ts';
import { audiences, check, gitStatus, save } from './save.mjs';
import { draftCounts } from './sheets.mjs';
import { exportDecisions, listExports } from './export.mjs';

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
 *
 * With --export-dir, as the staff review app runs it on a staff computer with
 * no git: nothing is committed. Checked decisions are exported instead, as one
 * file in that folder for the developer to import (export.mjs), and the
 * history lists the files exported from this computer.
 */

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

export function createReviewServer({ root, dist, port, exportDir = null }) {
  const exporting = Boolean(exportDir);
  const draftPath = join(root, '.review', 'draft.json');
  const readDraft = () => readDraftFile(draftPath);
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

      // Portraits, and films' posters, read-only, from the project's own media
      // folder. Only the posters of the films: never the films themselves.
      if (url.pathname.startsWith('/media/images/') || (url.pathname.startsWith('/media/videos/') && url.pathname.endsWith('.webp'))) {
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
      const review = loadReview();
      const checklists = signoffChecklists(root);
      const signoffs = readSignoffs(root).map((item) => ({ ...item, confirms: checklists[item.section] ?? [] }));
      return json(response, 200, {
        ...review, signoffs, readiness: readiness(review, signoffs), draft, counts: draftCounts(draft),
        mode: exporting ? 'export' : 'commit',
        git: exporting ? { clean: true, unpushed: null } : gitStatus(root),
      });
    }
    if (request.method === 'GET' && path === '/api/history') {
      return json(response, 200, exporting ? { exports: listExports(exportDir), exportDir } : { entries: history(root) });
    }
    if (request.method === 'GET' && path === '/api/history/sheet') {
      const rows = sheetRows(root, new URL(request.url ?? '', 'http://x').searchParams.get('path'));
      return rows ? json(response, 200, rows) : json(response, 404, { error: 'No such sheet.' });
    }
    // What a caption fix would change, before the reviewer chooses it.
    if (request.method === 'POST' && path === '/api/films/preview') {
      const { filmId, fix, find, replaceWith } = await body(request);
      const film = filmFiles(readVideoHoldings()).get(String(filmId ?? ''));
      if (!film || !['music', 'blank', 'phrase'].includes(fix)) return json(response, 400, { error: 'No such film or fix.' });
      return json(response, 200, previewFix(film, { filmId: film.filmId, fix, find: String(find ?? ''), replaceWith: String(replaceWith ?? '') }));
    }
    // Who a tour would visit, as edited, before the reviewer keeps the edit.
    if (request.method === 'POST' && path === '/api/tours/preview') {
      const { tourId, changes } = await body(request);
      const tidy = tourChanges(changes);
      const preview = tidy ? previewTour(String(tourId ?? ''), tidy) : null;
      return preview ? json(response, 200, preview) : json(response, 400, { error: 'No such tour, or not an edit of one.' });
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
    if (request.method === 'POST' && path === '/api/export') {
      if (!exporting) return json(response, 404, { error: 'This review saves to the project; it does not export.' });
      const { audience } = await body(request);
      const outcome = exportDecisions({ root, draft: readDraft(), audience: audienceOf(audience), exportDir });
      // Exported decisions leave the draft, so they are not sent twice; the name stays.
      if (outcome.ok) writeDraft({ ...emptyDraft(), reviewer: readDraft().reviewer });
      return json(response, 200, { ...outcome, counts: draftCounts(outcome.ok ? emptyDraft() : readDraft()) });
    }
    if (request.method === 'POST' && path === '/api/save') {
      if (exporting) return json(response, 404, { error: 'This review exports its decisions; it does not save to the project.' });
      const { audience } = await body(request);
      const outcome = save({ root, draft: readDraft(), audience: audienceOf(audience) });
      writeDraft(outcome.draft);
      return json(response, 200, { results: outcome.results, counts: draftCounts(outcome.draft), git: gitStatus(root) });
    }
    return json(response, 404, { error: 'No such request.' });
  }
}

export function emptyDraft() {
  return { reviewer: '', ties: {}, places: {}, placeTies: {}, bios: {}, profiles: {}, attract: {}, tours: {}, filmTitles: {}, filmStarts: {}, signoffs: {}, filmFixes: {} };
}

/**
 * The reviewer's unsaved decisions, in the shape this version expects. A draft
 * kept by an older version lacks the reviews added since.
 */
export function readDraftFile(path) {
  try { return normaliseDraft(JSON.parse(readFileSync(path, 'utf8'))); } catch { return emptyDraft(); }
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
    // One block of exhibit text so far; nothing else can name a block.
    attract: Object.fromEntries(Object.entries(object(draft.attract)).filter(([key]) => key === 'attract')),
    // Only the decisions a tour can have; an edit kept to its own fields.
    tours: Object.fromEntries(Object.entries(object(draft.tours)).flatMap(([tourId, value]) => {
      if (value?.decision === 'withdraw' || (value?.decision === 'approve' && Object.hasOwn(audiences, value.audience))) return [[tourId, value]];
      if (value?.decision !== 'edit' || typeof value.seenVersion !== 'string') return [];
      const changes = tourChanges(value.changes);
      if (!changes) return [];
      // Approved for an audience, left for somebody else, or not yet chosen.
      const audience = Object.hasOwn(audiences, value.audience) || value.audience === 'nobody' ? value.audience : null;
      return [[tourId, { decision: 'edit', seenVersion: value.seenVersion, changes, audience, note: typeof value.note === 'string' ? value.note : '' }]];
    })),
    // A title approved, with its words, or a clearing.
    filmTitles: Object.fromEntries(Object.entries(object(draft.filmTitles)).filter(([, value]) => value?.decision === 'clear'
      || (value?.decision === 'approve' && typeof value.title === 'string'))),
    filmStarts: object(draft.filmStarts),
    // Only what this app can decide: an acceptance, or a clearing. A signature
    // recorded the old way, for someone else, is not made into an acceptance.
    signoffs: Object.fromEntries(Object.entries(object(draft.signoffs)).filter(([, value]) => ['accept', 'clear'].includes(value?.action))),
    filmFixes: object(draft.filmFixes),
  };
}

/** A tour edit's fields, and nothing else; null when it is not one. */
function tourChanges(value) {
  if (!value || typeof value !== 'object') return null;
  const text = (field) => (typeof value[field] === 'string' ? value[field].slice(0, 1000) : null);
  const list = (field) => (Array.isArray(value[field]) ? value[field].filter((each) => typeof each === 'string').slice(0, 200).map((each) => each.slice(0, 200)) : null);
  const changes = {
    label: text('label'), prompt: text('prompt'), description: text('description'),
    terms: list('terms'), themes: list('themes'), pinnedPersonIds: list('pinnedPersonIds'), excludedPersonIds: list('excludedPersonIds'),
    maxPortraits: Number.isInteger(value.maxPortraits) ? value.maxPortraits : null,
  };
  return Object.values(changes).every((each) => each !== null) ? changes : null;
}

function audienceOf(value) {
  return Object.hasOwn(audiences, value) ? value : 'kiosk';
}

function body(request, limit = 5 * 1024 * 1024) {
  return new Promise((done, fail) => {
    let size = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { fail(new Error('Too large.')); request.destroy(); return; }
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

// Compare the real paths of what was run and of this module: on macOS the
// temporary folder is a link (/var is /private/var), an install may be reached
// through a link, and Node may name this module by either path
// (--preserve-symlinks-main keeps the link). Otherwise it would never start.
const invokedDirectly = process.argv[1] && existsSync(process.argv[1])
  && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
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
  const exportDir = typeof args['export-dir'] === 'string' && args['export-dir'] ? args['export-dir'] : null;
  const server = createReviewServer({ root, dist, port, exportDir });
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
