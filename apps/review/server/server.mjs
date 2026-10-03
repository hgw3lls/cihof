#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadReview, previewProfile, previewTour } from './data.mjs';
import { tourIdPattern } from '../../../packages/pipeline/src/build/tours.ts';
import { readiness, readSignoffs } from './readiness.mjs';
import { signoffChecklists } from './checklist.mjs';
import { history, sheetRows } from './history.mjs';
import { filmFiles, previewFix } from '../../../packages/pipeline/src/build/caption-fixes.ts';
import { readVideoHoldings } from '../../../packages/pipeline/src/sources/media.ts';
import { audiences, check, gitStatus, save, saveHere } from './save.mjs';
import { isPortal, makeDisplayUpdate, portalState } from './portal.mjs';
import { kindOf, uploadLimits, uploadPattern } from '../../../packages/pipeline/src/build/media-changes.ts';
import { imageSize } from '../../../packages/pipeline/src/build/images.ts';
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
 *
 * With --updates-dir, as the staff portal: the working folder is a copy of
 * what a display shows, opened from its export (portal.mjs). Decisions are
 * saved straight into it, with no git, and display updates are made from it
 * into that folder.
 */

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

export function createReviewServer({ root, dist, port, exportDir = null, updatesDir = null }) {
  const portal = Boolean(updatesDir);
  const exporting = !portal && Boolean(exportDir);
  const draftPath = join(root, '.review', 'draft.json');
  const readDraft = () => readDraftFile(draftPath);
  const writeDraft = (draft) => {
    mkdirSync(join(root, '.review'), { recursive: true });
    writeFileSync(draftPath, `${JSON.stringify(draft, null, 2)}\n`);
  };
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const uploadsDir = join(root, '.review', 'uploads');

  /**
   * Keeps a chosen file, by its checksum, after checking it is the kind of
   * file it is chosen as. The apply tools find it there by that name.
   */
  const upload = async (request, response, kind) => {
    if (!Object.hasOwn(uploadLimits, kind)) return json(response, 400, { error: 'Not a kind of file the exhibit uses.' });
    mkdirSync(uploadsDir, { recursive: true });
    const incoming = join(uploadsDir, `incoming-${randomUUID()}`);
    const hash = createHash('sha256');
    const head = [];
    let size = 0;
    try {
      // Streamed to disk as it arrives: a film can be gigabytes.
      await pipeline(request, new Transform({
        transform(chunk, _encoding, next) {
          size += chunk.length;
          if (size > uploadLimits[kind]) { next(new Error('The file is too large.')); return; }
          if (head.length < 64) head.push(...chunk.subarray(0, 64 - head.length));
          hash.update(chunk);
          next(null, chunk);
        },
      }), createWriteStream(incoming));
    } catch (error) {
      rmSync(incoming, { force: true });
      return json(response, 400, { error: error instanceof Error && error.message === 'The file is too large.' ? error.message : 'The file did not arrive whole.' });
    }
    const sniffed = kindOf(Uint8Array.from(head));
    const fits = kind === 'txt' ? sniffed === null || sniffed === 'vtt' : sniffed === kind;
    if (size === 0 || !fits) {
      rmSync(incoming, { force: true });
      return json(response, 400, { error: size === 0 ? 'The file is empty.' : `That is not a .${kind} file.` });
    }
    const name = `${hash.digest('hex')}.${kind}`;
    renameSync(incoming, join(uploadsDir, name));
    const picture = kind === 'jpg' || kind === 'png' ? imageSize(new Uint8Array(readFileSync(join(uploadsDir, name)))) : null;
    return json(response, 200, { name, bytes: size, width: picture?.width ?? null, height: picture?.height ?? null });
  };

  return createServer(async (request, response) => {
    try {
      // Another website open in the same browser can send requests here. It
      // cannot make them carry this host, or this origin.
      if (!allowedHosts.has(request.headers.host ?? '')) return send(response, 403, 'Not this host.');
      const origin = request.headers.origin;
      if (origin && !allowedHosts.has(origin.replace(/^https?:\/\//, ''))) return send(response, 403, 'Not this origin.');

      const url = new URL(request.url ?? '/', `http://${request.headers.host}`);

      if (url.pathname.startsWith('/api/')) {
        // A file chosen in Portraits and films. Its type is not one a form on
        // another site can send, so a browser asks first, and is not answered.
        if (request.method === 'POST' && url.pathname === '/api/uploads') {
          if (String(request.headers['content-type'] ?? '') !== 'application/octet-stream') return send(response, 415, 'Send the file.');
          return await upload(request, response, url.searchParams.get('kind') ?? '');
        }
        if (request.method === 'GET' && url.pathname.startsWith('/api/uploads/')) {
          const name = url.pathname.slice('/api/uploads/'.length);
          if (!uploadPattern.test(name) || !/\.(jpg|png)$/.test(name)) return send(response, 404, 'Not found.');
          return file(response, uploadsDir, `/${name}`);
        }
        if (request.method !== 'GET' && !String(request.headers['content-type'] ?? '').startsWith('application/json')) {
          return send(response, 415, 'Send JSON.');
        }
        return await api(request, response, url.pathname);
      }

      // Portraits, and films' posters, read-only, from the project's own media
      // folder. Only the posters of the films: never the films themselves.
      if (url.pathname.startsWith('/media/images/') || (url.pathname.startsWith('/media/videos/') && /\.(webp|jpg|png)$/.test(url.pathname))) {
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
        mode: portal ? 'portal' : exporting ? 'export' : 'commit',
        git: portal || exporting ? { clean: true, unpushed: null } : gitStatus(root),
        ...(portal ? { portal: { ...portalState(root), updatesDir } } : {}),
      });
    }
    if (request.method === 'GET' && path === '/api/history') {
      if (portal) return json(response, 200, { portal: portalState(root) });
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
    // A profile as an edit would leave it, before the reviewer keeps the edit.
    if (request.method === 'POST' && path === '/api/profiles/preview') {
      const { id, edit } = await body(request);
      const tidy = profileEdit(edit);
      const preview = tidy ? previewProfile(String(id ?? ''), tidy) : null;
      return preview ? json(response, 200, preview) : json(response, 400, { error: 'No such profile, or not an edit of one.' });
    }
    // Who a tour would visit, as edited, before the reviewer keeps the edit.
    if (request.method === 'POST' && path === '/api/tours/preview') {
      const { tourId, changes, creating } = await body(request);
      const tidy = tourChanges(changes);
      const preview = tidy ? previewTour(String(tourId ?? ''), tidy, { creating: creating === true }) : null;
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
      if (portal) {
        const outcome = saveHere({ root, draft: readDraft(), audience: audienceOf(audience) });
        writeDraft(outcome.draft);
        return json(response, 200, { results: outcome.results, counts: draftCounts(outcome.draft), git: { clean: true, unpushed: null }, portal: portalState(root) });
      }
      const outcome = save({ root, draft: readDraft(), audience: audienceOf(audience) });
      writeDraft(outcome.draft);
      return json(response, 200, { results: outcome.results, counts: draftCounts(outcome.draft), git: gitStatus(root) });
    }
    // The display's content, made from this copy, as an update for the display.
    if (request.method === 'POST' && path === '/api/display-update') {
      if (!portal) return json(response, 404, { error: 'Only the staff portal makes display updates.' });
      const { note } = await body(request);
      const outcome = await makeDisplayUpdate({ root, outDir: updatesDir, by: readDraft().reviewer, note: typeof note === 'string' ? note.slice(0, 2000) : '' });
      return json(response, 200, { ...outcome, portal: portalState(root) });
    }
    return json(response, 404, { error: 'No such request.' });
  }
}

export function emptyDraft() {
  return { reviewer: '', ties: {}, places: {}, placeTies: {}, bios: {}, profiles: {}, profileEdits: {}, attract: {}, tours: {}, filmTitles: {}, filmStarts: {}, signoffs: {}, filmFixes: {}, newClass: {}, portraits: {}, films: {} };
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
    // An edit names the profile it began from, and carries only an edit's fields.
    profileEdits: Object.fromEntries(Object.entries(object(draft.profileEdits)).flatMap(([id, value]) => {
      const tidy = profileEdit(value?.edit);
      return tidy && typeof value.seenVersion === 'string'
        ? [[id, { seenVersion: value.seenVersion, edit: tidy, note: typeof value.note === 'string' ? value.note : '' }]]
        : [];
    })),
    // One block of exhibit text so far; nothing else can name a block.
    attract: Object.fromEntries(Object.entries(object(draft.attract)).filter(([key]) => key === 'attract')),
    // Only the decisions a tour can have; an edit kept to its own fields.
    tours: Object.fromEntries(Object.entries(object(draft.tours)).flatMap(([tourId, value]) => {
      if (value?.decision === 'withdraw' || (value?.decision === 'approve' && Object.hasOwn(audiences, value.audience))) return [[tourId, value]];
      if (value?.decision === 'delete') {
        return typeof value.seenVersion === 'string' ? [[tourId, { decision: 'delete', seenVersion: value.seenVersion, note: typeof value.note === 'string' ? value.note : '' }]] : [];
      }
      const creating = value?.decision === 'create' && tourIdPattern.test(tourId);
      if (!creating && (value?.decision !== 'edit' || typeof value.seenVersion !== 'string')) return [];
      const changes = tourChanges(value.changes);
      if (!changes) return [];
      // Approved for an audience, left for somebody else, or not yet chosen.
      const audience = Object.hasOwn(audiences, value.audience) || value.audience === 'nobody' ? value.audience : null;
      const note = typeof value.note === 'string' ? value.note : '';
      return [[tourId, creating
        ? { decision: 'create', changes, audience, note }
        : { decision: 'edit', seenVersion: value.seenVersion, changes, audience, note }]];
    })),
    // A title approved, with its words, or a clearing.
    filmTitles: Object.fromEntries(Object.entries(object(draft.filmTitles)).filter(([, value]) => value?.decision === 'clear'
      || (value?.decision === 'approve' && typeof value.title === 'string'))),
    filmStarts: object(draft.filmStarts),
    // Only what this app can decide: an acceptance, or a clearing. A signature
    // recorded the old way, for someone else, is not made into an acceptance.
    signoffs: Object.fromEntries(Object.entries(object(draft.signoffs)).filter(([, value]) => ['accept', 'clear'].includes(value?.action))),
    filmFixes: object(draft.filmFixes),
    // A new inductee: the row class:add reads, and nothing else.
    newClass: Object.fromEntries(Object.entries(object(draft.newClass)).flatMap(([key, value]) => {
      if (!value || typeof value !== 'object') return [];
      const text = (field, limit = 300) => (typeof value[field] === 'string' ? value[field].slice(0, limit) : '');
      const tags = (field) => (Array.isArray(value[field]) ? value[field].filter((tag) => typeof tag === 'string').slice(0, 20).map((tag) => tag.slice(0, 60)) : []);
      return [[key, {
        name: text('name', 120), classYear: Number.isInteger(value.classYear) ? value.classYear : null,
        displayName: text('displayName', 120), sortName: text('sortName', 120), region: text('region', 40),
        profileUrl: text('profileUrl', 500), inductedBy: text('inductedBy', 200), biography: text('biography', 20000),
        themeTags: tags('themeTags'), countryTags: tags('countryTags'), communityTags: tags('communityTags'),
        portrait: typeof value.portrait === 'string' && uploadPattern.test(value.portrait) ? value.portrait : '',
        portraitAltText: text('portraitAltText', 1000), rightsConfirmed: value.rightsConfirmed === true, note: text('note', 2000),
      }]];
    })),
    // A new picture names an upload and the profile as it was; nothing else.
    portraits: Object.fromEntries(Object.entries(object(draft.portraits)).flatMap(([id, value]) => (
      value && typeof value.seenVersion === 'string' && typeof value.upload === 'string' && uploadPattern.test(value.upload)
        ? [[id, {
          seenVersion: value.seenVersion, upload: value.upload,
          portraitAlt: typeof value.portraitAlt === 'string' ? value.portraitAlt.slice(0, 1000) : '',
          focalPoint: typeof value.focalPoint === 'string' ? value.focalPoint.slice(0, 20) : 'center',
          rightsConfirmed: value.rightsConfirmed === true,
          note: typeof value.note === 'string' ? value.note : '',
        }]]
        : []))),
    // A film added names its uploads; a film taken off names the film.
    films: Object.fromEntries(Object.entries(object(draft.films)).flatMap(([key, value]) => {
      const note = typeof value?.note === 'string' ? value.note : '';
      const person = typeof value?.personId === 'string' ? value.personId : '';
      if (!person) return [];
      if (value.decision === 'withdraw' && typeof value.filmId === 'string') return [[key, { decision: 'withdraw', personId: person, filmId: value.filmId, note }]];
      const files = ['film', 'poster', 'captions', 'transcript'];
      if (value.decision !== 'add' || !files.every((part) => typeof value[part] === 'string' && uploadPattern.test(value[part]))) return [];
      return [[key, {
        decision: 'add', personId: person, film: value.film, poster: value.poster, captions: value.captions, transcript: value.transcript,
        durationSeconds: Number.isFinite(value.durationSeconds) ? value.durationSeconds : 0,
        title: typeof value.title === 'string' ? value.title.slice(0, 200) : '',
        rightsConfirmed: value.rightsConfirmed === true, captionsChecked: value.captionsChecked === true, transcriptChecked: value.transcriptChecked === true,
        note,
      }]];
    })),
  };
}

/** A profile edit's fields, and nothing else; null when it is not one. */
function profileEdit(value) {
  if (!value || typeof value !== 'object') return null;
  const text = (field) => (typeof value[field] === 'string' ? value[field].slice(0, 1000) : null);
  const list = (field) => (Array.isArray(value[field]) ? value[field].filter((each) => typeof each === 'string').slice(0, 50).map((each) => each.slice(0, 200)) : null);
  const edit = {
    name: text('name'), sortName: text('sortName'),
    communities: list('communities'), contributions: list('contributions'), countries: list('countries'),
    honoredFor: text('honoredFor'), contextLine: text('contextLine'), portraitAlt: text('portraitAlt'), focalPoint: text('focalPoint'),
  };
  return Object.values(edit).every((each) => each !== null) ? edit : null;
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
  const updatesDir = typeof args['updates-dir'] === 'string' && args['updates-dir'] ? args['updates-dir'] : null;
  if (updatesDir && !isPortal(root)) {
    console.error('The staff portal needs a display\'s export opened first.');
    process.exit(1);
  }
  const server = createReviewServer({ root, dist, port, exportDir, updatesDir });
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
