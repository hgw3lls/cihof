import { createHash } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { PublishedPerson } from '@cihof/content';
import { filmTitleLimit, filmTitleVersion, type StoredFilmTitles } from './film-titles.ts';
import { imageSize } from './images.ts';
import { opensWithStaffNote } from './assets.ts';
import { profileContentVersion } from './profiles.ts';
import { parseRows } from './review.ts';
import { profileEditLimits } from './profile-edits.ts';

/**
 * New portraits and films, chosen in the staff portal.
 *
 * Until now every portrait and film came from the hall's own website and
 * channel, harvested once. Staff now add their own: a better picture of an
 * inductee, the film of this year's ceremony. Each arrives as a file the
 * staff member chose (an upload, kept by its checksum in `.review/uploads/`)
 * and a decision about it, under their name, in a sheet like every other.
 *
 * What a decision must say is what makes a portrait or a film showable at
 * all (packages/content: person.ts, film.ts): that the museum may show it in
 * the exhibit permanently, and for a film that its captions and transcript
 * were checked against it. Nobody is asked to approve a file they have not
 * seen: the portal shows each one before it can be chosen.
 *
 * A portrait replaces the profile's picture, with a description of the new
 * picture for people who cannot see it. The profile's approval lapses by
 * itself, since the picture is part of what it covers. The old file stays
 * where it is; the manifest notes what it replaced.
 *
 * A film is added to a person's films, played from the display's own copy
 * (the display update carries the film), with the poster, captions and
 * transcript beside it and, if one is given, its approved title. A film can
 * also be taken off the display: its record stays, no longer approved for it.
 */

/** An upload's name: its checksum and kind. Nothing else can name a file here. */
export const uploadPattern = /^[0-9a-f]{64}\.(jpg|png|mp4|vtt|txt)$/;

export const portraitColumns = ['id', 'contentVersion', 'upload', 'portraitAlt', 'focalPoint', 'rightsConfirmed', 'decisionReference', 'note'] as const;
export const filmChangeColumns = [
  'personId', 'decision', 'filmId', 'film', 'poster', 'captions', 'transcript', 'durationSeconds', 'title',
  'rightsConfirmed', 'captionsChecked', 'transcriptChecked', 'decisionReference', 'note',
] as const;

/** The largest of each upload, so a mistaken choice of file is caught at once. */
export const uploadLimits = { jpg: 25e6, png: 25e6, mp4: 20e9, vtt: 5e6, txt: 5e6 } as const;

export type PortraitDecision = {
  readonly id: string;
  readonly name: string;
  readonly upload: string;
  readonly checksum: string;
  readonly extension: 'jpg' | 'png';
  readonly width: number;
  readonly height: number;
  readonly portraitAlt: string;
  readonly focalPoint: string;
  readonly decisionReference: string;
  readonly note: string;
};

export type FilmAddition = {
  readonly decision: 'add';
  readonly personId: string;
  readonly name: string;
  readonly film: string;
  readonly poster: string;
  readonly captions: string;
  readonly transcript: string;
  readonly checksum: string;
  readonly durationSeconds: number;
  readonly title: string;
  readonly decisionReference: string;
  readonly note: string;
};

export type FilmWithdrawal = {
  readonly decision: 'withdraw';
  readonly personId: string;
  readonly name: string;
  readonly filmId: string;
  readonly decisionReference: string;
  readonly note: string;
};

export type FilmChange = FilmAddition | FilmWithdrawal;

/** Where a new file goes, relative to the project: the files the manifest will name. */
export type Placement = { readonly from: string; readonly to: string };

type Manifest = { assets: Record<string, Record<string, unknown>>; [key: string]: unknown };
type Curated = { inductees: Record<string, Record<string, unknown>>; [key: string]: unknown };

const focalPattern = /^(center|(100|[1-9]?\d)% (100|[1-9]?\d)%)$/;
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});
const text = (value: unknown) => (typeof value === 'string' ? value : '');

/** The id a film is known by: its YouTube id, or for a film the hall added itself, where it is played from. */
export function filmIdOf(video: unknown): string {
  const holding = record(video);
  return text(holding['youtubeVideoId']).trim() || text(holding['runtimePath']).trim();
}

/** Every person's films, from a manifest in memory: what a change is previewing. */
export function videoHoldingsFrom(manifest: unknown): Map<string, unknown[]> {
  const holdings = new Map<string, unknown[]>();
  for (const [id, asset] of Object.entries(record(record(manifest)['assets']))) {
    const videos = record(asset)['videos'];
    if (Array.isArray(videos) && videos.length > 0) holdings.set(id, videos);
  }
  return holdings;
}

/**
 * Checks an upload: there, the file its name says, and the kind of file its
 * name says. Returns the problem, or null.
 */
export function uploadProblem(uploadsDir: string, upload: string, kinds: readonly string[]): string | null {
  if (!uploadPattern.test(upload)) return `"${upload}" is not an upload from the staff portal`;
  const extension = upload.slice(65);
  if (!kinds.includes(extension)) return `"${upload}" is not ${kinds.map((kind) => `a .${kind}`).join(' or ')} file`;
  const path = join(uploadsDir, upload);
  if (!existsSync(path)) return `the file ${upload.slice(0, 12)}… is not on this computer any more; choose it again`;
  if (statSync(path).size > uploadLimits[extension as keyof typeof uploadLimits]) return `the file ${upload.slice(0, 12)}… is too large to be a ${extension} file the exhibit can use`;
  const head = readHead(path, 64);
  const sniffed = kindOf(head);
  if (extension === 'txt') {
    if (sniffed !== null && sniffed !== 'vtt') return `the transcript ${upload.slice(0, 12)}… is not text`;
  } else if (sniffed !== extension) {
    return `the file ${upload.slice(0, 12)}… is not really a .${extension} file`;
  }
  return null;
}

/** What kind of file these first bytes begin, of the kinds an upload can be; null for anything else. */
export function kindOf(head: Uint8Array): 'jpg' | 'png' | 'mp4' | 'vtt' | null {
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpg';
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'png';
  if (String.fromCharCode(...head.slice(4, 8)) === 'ftyp') return 'mp4';
  const start = new TextDecoder().decode(head).replace(/^﻿/, '');
  if (start.startsWith('WEBVTT')) return 'vtt';
  return null;
}

/** The SHA-256 an upload's name claims, checked against the file itself. */
export function uploadChecksumMatches(uploadsDir: string, upload: string): boolean {
  return sha256File(join(uploadsDir, upload)) === upload.slice(0, 64);
}

// ------------------------------------------------------------------ portraits

export function portraitDecisions(csvText: string, context: {
  people: readonly PublishedPerson[];
  curated: Curated;
  manifest: Manifest;
  checksums: ReadonlyMap<string, string>;
  uploadsDir: string;
}) {
  const { header, rows } = sheet(csvText);
  const missing = portraitColumns.filter((column) => !header.includes(column));
  if (missing.length > 0) return { decisions: [] as PortraitDecision[], errors: [`the sheet is missing the column(s) ${missing.join(', ')}`], blank: 0 };
  const cell = (cells: string[], column: string) => (cells[header.indexOf(column)] ?? '').trim();
  const people = new Map(context.people.map((person) => [person.id as string, person]));
  const decisions: PortraitDecision[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let blank = 0;

  rows.forEach((cells, index) => {
    const line = index + 2;
    const id = cell(cells, 'id');
    if (!id) return;
    if (!cell(cells, 'upload')) { blank += 1; return; }
    const person = people.get(id);
    if (!person || !context.curated.inductees[id] || !context.manifest.assets[id]) { errors.push(`line ${line}: there is no profile "${id}"`); return; }
    if (seen.has(id)) { errors.push(`line ${line}: ${person.name} appears twice`); return; }
    seen.add(id);
    const reference = cell(cells, 'decisionReference');
    if (!reference) { errors.push(`line ${line}: a new portrait needs a decisionReference`); return; }
    if (cell(cells, 'contentVersion') !== profileContentVersion(person, context.checksums.get(id) ?? '')) {
      errors.push(`line ${line}: ${person.name}'s profile has changed since the new portrait was chosen. Look at it again.`);
      return;
    }
    if (cell(cells, 'rightsConfirmed') !== 'yes') {
      errors.push(`line ${line}: ${person.name}: a portrait is shown only once somebody confirms the museum may show it in the exhibit permanently`);
      return;
    }
    const upload = cell(cells, 'upload');
    const problem = uploadProblem(context.uploadsDir, upload, ['jpg', 'png']);
    if (problem) { errors.push(`line ${line}: ${person.name}: ${problem}`); return; }
    if (!uploadChecksumMatches(context.uploadsDir, upload)) { errors.push(`line ${line}: ${person.name}: the picture changed after it was chosen; choose it again`); return; }
    const size = imageSize(new Uint8Array(readFileSync(join(context.uploadsDir, upload))));
    if (!size || size.width < 200 || size.height < 200) { errors.push(`line ${line}: ${person.name}: the picture is too small to show well (at least 200 by 200 pixels)`); return; }
    const portraitAlt = cell(cells, 'portraitAlt');
    if (!portraitAlt) { errors.push(`line ${line}: ${person.name}: describe the new picture for people who cannot see it`); return; }
    if (portraitAlt.length > profileEditLimits.portraitAlt) { errors.push(`line ${line}: ${person.name}: the description is longer than ${profileEditLimits.portraitAlt} characters`); return; }
    const focalPoint = cell(cells, 'focalPoint') || 'center';
    if (!focalPattern.test(focalPoint)) { errors.push(`line ${line}: ${person.name}: "${focalPoint}" is not a focal point`); return; }
    if (upload.slice(0, 64) === text(record(record(context.manifest.assets[id]['images'])['primary'])['checksumSha256'])) {
      errors.push(`line ${line}: ${person.name}: that is the picture the profile already shows`);
      return;
    }
    decisions.push({
      id, name: person.name, upload, checksum: upload.slice(0, 64), extension: upload.slice(65) as 'jpg' | 'png',
      width: size.width, height: size.height, portraitAlt, focalPoint, decisionReference: reference, note: cell(cells, 'note'),
    });
  });
  return { decisions, errors, blank };
}

/** The new portraits written into the manifest and the curated records, in memory, and where each file goes. */
export function applyPortraits(manifest: Manifest, curated: Curated, decisions: readonly PortraitDecision[], appliedAt: string) {
  const media = structuredClone(manifest);
  const roster = structuredClone(curated);
  const placements: Placement[] = [];
  for (const decision of decisions) {
    const asset = media.assets[decision.id]!;
    const images = record(asset['images']);
    const before = record(images['primary']);
    const file = `public/media/images/${decision.id}/portrait-${decision.checksum.slice(0, 12)}.${decision.extension}`;
    placements.push({ from: decision.upload, to: file });
    asset['images'] = {
      ...images,
      primary: {
        sourceUrl: '',
        filePath: file,
        runtimePath: `/${file.slice('public/'.length)}`,
        checksumSha256: decision.checksum,
        width: decision.width,
        height: decision.height,
        altText: decision.portraitAlt,
        primary: true,
        rightsStatus: 'approved',
        approvedForKiosk: true,
        decisionReference: decision.decisionReference,
      },
    };
    const was = text(before['filePath']) || text(before['sourceUrl']) || 'no picture';
    asset['notes'] = [...(Array.isArray(asset['notes']) ? asset['notes'] : []), `Portrait replaced under ${decision.decisionReference} on ${appliedAt.slice(0, 10)}; it was ${was}.`];

    const person = roster.inductees[decision.id]!;
    person['image'] = {
      ...record(person['image']),
      primaryAltText: decision.portraitAlt,
      focalPoint: decision.focalPoint,
      rightsStatus: 'approved',
      rightsNotes: `Chosen in the staff portal and confirmed for permanent use in the exhibit under ${decision.decisionReference} on ${appliedAt.slice(0, 10)}.${decision.note ? ` ${decision.note}` : ''}`,
      sourceUrl: '',
    };
  }
  return { manifest: media, curated: roster, placements };
}

// ------------------------------------------------------------------ films

export function filmChangeDecisions(csvText: string, context: {
  people: readonly PublishedPerson[];
  manifest: Manifest;
  uploadsDir: string;
}) {
  const { header, rows } = sheet(csvText);
  const missing = filmChangeColumns.filter((column) => !header.includes(column));
  if (missing.length > 0) return { decisions: [] as FilmChange[], errors: [`the sheet is missing the column(s) ${missing.join(', ')}`], blank: 0 };
  const cell = (cells: string[], column: string) => (cells[header.indexOf(column)] ?? '').trim();
  const people = new Map(context.people.map((person) => [person.id as string, person]));
  const decisions: FilmChange[] = [];
  const errors: string[] = [];
  const films = new Set<string>();
  let blank = 0;

  rows.forEach((cells, index) => {
    const line = index + 2;
    const personId = cell(cells, 'personId');
    if (!personId) return;
    const decision = cell(cells, 'decision');
    if (!decision) { blank += 1; return; }
    const person = people.get(personId);
    const asset = context.manifest.assets[personId];
    if (!person || !asset) { errors.push(`line ${line}: there is no profile "${personId}"`); return; }
    const reference = cell(cells, 'decisionReference');
    if (!reference) { errors.push(`line ${line}: a change to ${person.name}'s films needs a decisionReference`); return; }
    const note = cell(cells, 'note');

    if (decision === 'withdraw') {
      const filmId = cell(cells, 'filmId');
      const video = (Array.isArray(asset['videos']) ? asset['videos'] : []).find((each) => filmIdOf(each) === filmId);
      if (!video) { errors.push(`line ${line}: ${person.name} has no film "${filmId}"`); return; }
      if (record(video)['approvedForKiosk'] !== true) { errors.push(`line ${line}: ${person.name}'s film "${filmId}" is not on the display already`); return; }
      decisions.push({ decision, personId, name: person.name, filmId, decisionReference: reference, note });
      return;
    }
    if (decision !== 'add') { errors.push(`line ${line}: "${decision}" is not a decision about a film (add or withdraw)`); return; }

    const problems: string[] = [];
    if (cell(cells, 'rightsConfirmed') !== 'yes') problems.push('a film is shown only once somebody confirms the museum may show it in the exhibit permanently');
    if (cell(cells, 'captionsChecked') !== 'yes') problems.push('a film is shown only with captions somebody checked against it');
    if (cell(cells, 'transcriptChecked') !== 'yes') problems.push('a film is shown only with a transcript somebody checked against it');
    const uploads = { film: ['mp4'], poster: ['jpg', 'png'], captions: ['vtt'], transcript: ['txt'] } as const;
    for (const [column, kinds] of Object.entries(uploads)) {
      const problem = uploadProblem(context.uploadsDir, cell(cells, column), kinds);
      if (problem) problems.push(`${column}: ${problem}`);
      else if (column !== 'film' && !uploadChecksumMatches(context.uploadsDir, cell(cells, column))) problems.push(`${column}: the file changed after it was chosen; choose it again`);
    }
    const duration = Number(cell(cells, 'durationSeconds'));
    if (!Number.isFinite(duration) || duration <= 0) problems.push('the film\'s length is not known; play it in the portal first');
    const title = cell(cells, 'title');
    if (title.length > filmTitleLimit) problems.push(`the title is longer than ${filmTitleLimit} characters`);
    if (problems.length === 0) {
      const transcript = readFileSync(join(context.uploadsDir, cell(cells, 'transcript')), 'utf8');
      if (!transcript.trim()) problems.push('the transcript is empty');
      if (opensWithStaffNote(transcript)) problems.push('the transcript opens with a note to staff; remove it');
      const cues = readFileSync(join(context.uploadsDir, cell(cells, 'captions')), 'utf8').split(/\r?\n/).filter((each) => each.includes('-->')).length;
      if (cues === 0) problems.push('the captions file holds no captions');
    }
    const film = cell(cells, 'film');
    if (films.has(film)) problems.push('the same film is added twice');
    films.add(film);
    const already = (Array.isArray(asset['videos']) ? asset['videos'] : []).some((each) => text(record(each)['checksumSha256']) === film.slice(0, 64));
    if (already) problems.push('that film is already one of theirs');
    if (problems.length > 0) { errors.push(...problems.map((problem) => `line ${line}: ${person.name}: ${problem}`)); return; }
    decisions.push({
      decision, personId, name: person.name, film, poster: cell(cells, 'poster'), captions: cell(cells, 'captions'), transcript: cell(cells, 'transcript'),
      checksum: film.slice(0, 64), durationSeconds: Math.round(duration), title, decisionReference: reference, note,
    });
  });
  return { decisions, errors, blank };
}

/**
 * The film changes written into the manifest and the film titles, in memory,
 * and where each new file goes. A film's checksum is not checked here: it is
 * the one file too large to read twice, so the tool checks it as it copies.
 */
export function applyFilmChanges(manifest: Manifest, titles: StoredFilmTitles, decisions: readonly FilmChange[], appliedAt: string) {
  const media = structuredClone(manifest);
  const nextTitles = structuredClone(titles) as { titles: Record<string, unknown> } & StoredFilmTitles;
  const placements: Placement[] = [];
  for (const decision of decisions) {
    const asset = media.assets[decision.personId]!;
    const videos = Array.isArray(asset['videos']) ? asset['videos'] as Record<string, unknown>[] : [];
    if (decision.decision === 'withdraw') {
      asset['videos'] = videos.map((video) => (filmIdOf(video) === decision.filmId
        ? { ...video, approvedForKiosk: false, withdrawnUnder: decision.decisionReference }
        : video));
      asset['notes'] = [...(Array.isArray(asset['notes']) ? asset['notes'] : []), `Film ${decision.filmId} taken off the display under ${decision.decisionReference} on ${appliedAt.slice(0, 10)}.`];
      continue;
    }
    const base = `public/media/videos/${decision.personId}/${decision.personId}_${decision.checksum.slice(0, 12)}`;
    const posterExtension = decision.poster.slice(65);
    const files = {
      film: `${base}.mp4`, poster: `${base}.${posterExtension}`, captions: `${base}.en.vtt`, transcript: `${base}.transcript.txt`,
    };
    for (const part of ['film', 'poster', 'captions', 'transcript'] as const) placements.push({ from: decision[part], to: files[part] });
    const runtime = (file: string) => `/${file.slice('public/'.length)}`;
    asset['videos'] = [...videos, {
      sourceUrl: '',
      youtubeVideoId: '',
      filePath: files.film,
      runtimePath: runtime(files.film),
      posterFilePath: files.poster,
      posterRuntimePath: runtime(files.poster),
      captionFilePath: files.captions,
      captionRuntimePath: runtime(files.captions),
      transcriptFilePath: files.transcript,
      transcriptRuntimePath: runtime(files.transcript),
      checksumSha256: decision.checksum,
      durationSeconds: decision.durationSeconds,
      rightsStatus: 'approved',
      captionStatus: 'approved',
      transcriptStatus: 'approved',
      audioDescriptionStatus: 'review-needed',
      approvedForKiosk: true,
      approvedForPublicWeb: false,
      decisionReference: decision.decisionReference,
    }];
    asset['notes'] = [...(Array.isArray(asset['notes']) ? asset['notes'] : []), `Film added in the staff portal under ${decision.decisionReference} on ${appliedAt.slice(0, 10)}.`];
    if (decision.title) {
      const filmId = runtime(files.film);
      nextTitles.titles[filmId] = {
        title: decision.title,
        review: {
          status: 'approved',
          decisionReference: decision.decisionReference,
          contentVersion: filmTitleVersion(filmId, decision.title),
          reviewedAt: appliedAt,
          ...(decision.note ? { note: decision.note } : {}),
        },
        publication: { kiosk: true, publicWeb: false },
      };
    }
  }
  return { manifest: media, titles: nextTitles as StoredFilmTitles, placements };
}

// ------------------------------------------------------------------ helpers

function sheet(csvText: string) {
  const parsed = parseRows(csvText.replace(/^﻿/, ''));
  return { header: (parsed[0] ?? []).map((cell) => cell.trim()), rows: parsed.slice(1) };
}

/** The first bytes of a file, without reading the rest: a film can be gigabytes. */
function readHead(path: string, length: number): Uint8Array {
  const head = new Uint8Array(length);
  const descriptor = openSync(path, 'r');
  try {
    return head.subarray(0, readSync(descriptor, head, 0, length, 0));
  } finally {
    closeSync(descriptor);
  }
}

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
