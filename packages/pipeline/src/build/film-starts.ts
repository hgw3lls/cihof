import { existsSync, readFileSync } from 'node:fs';
import { dataFile, publicFile } from '../paths.ts';
import { parseRows } from './review.ts';

/**
 * Where a person's film starts, when the film is not only theirs.
 *
 * Some inductees' film is a whole induction ceremony: the 2024 ceremony runs
 * an hour and three quarters and stands for six people. Opening it from the
 * beginning leaves a visitor to find the person they chose somewhere inside
 * it. A start time, approved by a curator, opens it at that person's part.
 *
 * A start is presentation, not a claim about anybody, but it still decides
 * what a visitor is shown first, so it follows the same rule as everything
 * else: nothing but an approved start with its decision reference is used,
 * and the approval names the exact second it covers. A suggestion drafted
 * from the captions is only ever shown to a reviewer.
 */

export type FilmStartReview = {
  readonly status?: string;
  readonly decisionReference?: string;
  readonly contentVersion?: string;
  readonly reviewedAt?: string;
  readonly note?: string;
};

export type StoredFilmStart = {
  readonly startSeconds: number;
  readonly review: FilmStartReview;
};

export type StoredFilmStarts = {
  readonly schemaVersion?: number;
  readonly note?: string;
  readonly starts: Readonly<Record<string, StoredFilmStart>>;
};

const startsPath = () => dataFile('cihof_film_starts.json');

export function readFilmStarts(): StoredFilmStarts {
  const path = startsPath();
  if (!existsSync(path)) return { starts: {} };
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<StoredFilmStarts>;
  return { ...parsed, starts: parsed.starts ?? {} };
}

export const filmStartKey = (personId: string, filmId: string) => `${personId}|${filmId}`;

/** The version an approval must name: the film and the second it opens at. */
export function filmStartVersion(filmId: string, seconds: number): string {
  return `start-${filmId}-${seconds}`;
}

/**
 * The approved start for this person's copy of this film, in whole seconds,
 * or null: never approved, approved for another second, or outside the film.
 */
export function approvedFilmStart(
  stored: StoredFilmStarts,
  personId: string,
  filmId: string,
  durationSeconds: number | null,
): number | null {
  const entry = stored.starts[filmStartKey(personId, filmId)];
  if (!entry) return null;
  const seconds = entry.startSeconds;
  if (!Number.isInteger(seconds) || seconds <= 0) return null;
  if (durationSeconds !== null && seconds >= durationSeconds) return null;
  const review = entry.review ?? {};
  if (review.status !== 'approved' || !review.decisionReference?.trim()) return null;
  if (review.contentVersion !== filmStartVersion(filmId, seconds)) return null;
  return seconds;
}

// ------------------------------------------------------------ suggestions

export type Cue = { readonly t: number; readonly words: string };

/**
 * Caption cues, once each. Automatic captions roll: every line appears twice,
 * once as it arrives and once as the line above the next, so a repeated line
 * is dropped rather than counted twice.
 */
export function readCues(vtt: string): Cue[] {
  const cues: Cue[] = [];
  const seen = new Set<string>();
  for (const block of vtt.split(/\r?\n\r?\n+/)) {
    const time = block.match(/(\d+):(\d\d):(\d\d)[.,]\d+\s+-->/);
    if (!time) continue;
    const t = Number(time[1]) * 3600 + Number(time[2]) * 60 + Number(time[3]);
    const lines = block.split(/\r?\n/).slice(1).map((line) => line.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
    for (const line of lines) {
      if (seen.has(line)) continue;
      seen.add(line);
      cues.push({ t, words: line });
    }
  }
  return cues;
}

export type StartSuggestion = {
  readonly seconds: number;
  /** In plain words, why this second: what was said there. */
  readonly reason: string;
  /** What the captions say from just before the suggested second. */
  readonly context: readonly Cue[];
};

const honorifics = new Set(['dr', 'dr.', 'ambassador', 'mayor', 'senator', 'rev', 'rev.', 'reverend', 'honorable', 'judge', 'sister', 'father', 'fr', 'fr.', 'bishop', 'the', 'hon', 'hon.']);
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Given and family name, the words a ceremony introduces someone by. */
export function nameTerms(displayName: string): string[] {
  const words = displayName
    .replace(/\(.*?\)/g, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/[,]/g, ''))
    .filter((word) => word.length > 1 && !honorifics.has(word.toLowerCase()) && !/^[A-Z]\.$/.test(word) && !/^(jr|sr|ii|iii)\.?$/i.test(word));
  if (words.length === 0) return [];
  return [...new Set([words[0]!, words[words.length - 1]!])];
}

const introduction = /\b(first|next|final|last)\s+(inductee|honou?ree|honou?r)\b|\binductee (tonight )?is\b/i;

/**
 * Where a person's part of a shared ceremony film seems to begin, from its
 * captions: the stretch where their name is said most, and then the
 * announcement just before it ("our next inductee…"). Automatic captions
 * mishear names, so given and family name both count. This is a suggestion
 * for a reviewer to check by watching, never a start on its own.
 */
export function suggestStart(cues: readonly Cue[], displayName: string, durationSeconds: number | null): StartSuggestion | null {
  const terms = nameTerms(displayName);
  if (terms.length === 0 || cues.length === 0) return null;
  const pattern = new RegExp(`\\b(${terms.map(escape).join('|')})\\b`, 'i');
  const end = durationSeconds ?? cues[cues.length - 1]!.t;
  // The opening roll call and the closing thanks name everybody.
  const mentions = cues.filter((cue) => pattern.test(cue.words) && cue.t >= 600 && cue.t < end - 180);
  if (mentions.length === 0) return null;

  // The eight minutes holding the most mentions.
  let best = { from: 0, count: 0 };
  for (const [index, mention] of mentions.entries()) {
    let count = 0;
    for (let next = index; next < mentions.length && mentions[next]!.t < mention.t + 480; next += 1) count += 1;
    if (count > best.count) best = { from: index, count };
  }
  const first = mentions[best.from]!;
  const announcement = [...cues].reverse().find((cue) => cue.t <= first.t && cue.t >= first.t - 180 && introduction.test(cue.words));
  const seconds = Math.max(1, (announcement ?? first).t - (announcement ? 2 : 20));
  const times = best.count === 1 ? 'once' : `${best.count} times`;
  const reason = announcement
    ? `The captions say "${announcement.words}" at ${clock(announcement.t)}, and name them ${times} in the minutes that follow.`
    : `The captions name them ${times} from ${clock(first.t)}; no announcement was found just before, so this starts 20 seconds ahead.`;
  return {
    seconds,
    reason,
    context: cues.filter((cue) => cue.t >= seconds - 5 && cue.t <= seconds + 45).slice(0, 14),
  };
}

/**
 * Suggestions for everybody a shared film stands for. Automatic captions
 * sometimes mishear a name beyond recognition ("Erica pisar"); when one person
 * cannot be found by name and exactly one announcement is left that nobody
 * else was matched to, that announcement is offered for them, saying so.
 */
export function suggestStarts(
  cues: readonly Cue[],
  people: readonly { readonly id: string; readonly name: string }[],
  durationSeconds: number | null,
): Map<string, StartSuggestion> {
  const found = new Map<string, StartSuggestion>();
  for (const person of people) {
    const suggestion = suggestStart(cues, person.name, durationSeconds);
    if (suggestion) found.set(person.id, suggestion);
  }
  const missing = people.filter((person) => !found.has(person.id));
  if (missing.length !== 1) return found;
  const end = durationSeconds ?? cues[cues.length - 1]?.t ?? 0;
  const unclaimed = cues.filter((cue) =>
    introduction.test(cue.words) && cue.t >= 600 && cue.t < end - 180
    && [...found.values()].every((taken) => Math.abs(taken.seconds - cue.t) > 90));
  if (unclaimed.length !== 1) return found;
  const announcement = unclaimed[0]!;
  const seconds = Math.max(1, announcement.t - 2);
  found.set(missing[0]!.id, {
    seconds,
    reason: `The captions never say this name clearly (they may have misheard it). "${announcement.words}" at ${clock(announcement.t)} is the one introduction not matched to anyone else. Check by watching.`,
    context: cues.filter((cue) => cue.t >= seconds - 5 && cue.t <= seconds + 45).slice(0, 14),
  });
  return found;
}

export function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const h = Math.floor(whole / 3600);
  const m = Math.floor(whole / 60) % 60;
  const s = whole % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** h:mm:ss, m:ss or plain seconds, as a reviewer might type it; null if it is none of those. */
export function parseClock(text: string): number | null {
  const value = text.trim();
  if (/^\d+$/.test(value)) return Number(value);
  const parts = value.split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) return null;
  const numbers = parts.map(Number);
  if (numbers.slice(1).some((part) => part > 59)) return null;
  return numbers.reduce((total, part) => total * 60 + part, 0);
}

export type SharedFilm = {
  readonly filmId: string;
  readonly durationSeconds: number | null;
  readonly captionFile: string | null;
  readonly people: readonly string[];
};

/** Films that stand for more than one person: the only ones a start is for. */
export function sharedFilms(holdings: ReadonlyMap<string, readonly unknown[]>): SharedFilm[] {
  const byFilm = new Map<string, { durationSeconds: number | null; captionFile: string | null; people: string[] }>();
  for (const [personId, videos] of holdings) {
    for (const value of videos) {
      const video = value as Record<string, unknown>;
      const filmId = typeof video['youtubeVideoId'] === 'string' ? video['youtubeVideoId'] : '';
      if (!filmId) continue;
      const entry = byFilm.get(filmId) ?? {
        durationSeconds: typeof video['durationSeconds'] === 'number' ? video['durationSeconds'] : null,
        captionFile: typeof video['captionFilePath'] === 'string' ? video['captionFilePath'] : null,
        people: [],
      };
      if (!entry.people.includes(personId)) entry.people.push(personId);
      byFilm.set(filmId, entry);
    }
  }
  return [...byFilm.entries()]
    .filter(([, entry]) => entry.people.length > 1)
    .map(([filmId, entry]) => ({ filmId, ...entry, people: [...entry.people].sort() }))
    .sort((a, b) => a.filmId.localeCompare(b.filmId));
}

export function readCaptionCues(captionFile: string | null): Cue[] {
  if (!captionFile) return [];
  const path = publicFile(captionFile.replace(/^public\//, ''));
  return existsSync(path) ? readCues(readFileSync(path, 'utf8')) : [];
}

// -------------------------------------------------------------- decisions

export type FilmStartDecision = {
  readonly personId: string;
  readonly filmId: string;
  /** A second to open at, or null for "from the beginning". */
  readonly startSeconds: number | null;
  readonly decisionReference: string;
  readonly note: string;
};

/**
 * A sheet of start decisions: personId, filmId, decision (`start` or
 * `beginning`), startSeconds, decisionReference, note. A start must fall
 * inside a film the person actually has, and that film must stand for more
 * than one person.
 */
export function filmStartDecisions(csvText: string, shared: readonly SharedFilm[]) {
  const parsed = parseRows(csvText.replace(/^﻿/, ''));
  const header = (parsed[0] ?? []).map((cell) => cell.trim());
  const required = ['personId', 'filmId', 'decision', 'startSeconds', 'decisionReference', 'note'];
  const missing = required.filter((column) => !header.includes(column));
  if (missing.length > 0) return { decisions: [] as FilmStartDecision[], errors: [`the sheet is missing the column(s) ${missing.join(', ')}`], blank: 0 };
  const cell = (cells: string[], column: string) => (cells[header.indexOf(column)] ?? '').trim();
  const films = new Map(shared.map((film) => [film.filmId, film]));
  const decisions: FilmStartDecision[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let blank = 0;

  parsed.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const personId = cell(cells, 'personId');
    const filmId = cell(cells, 'filmId');
    const decision = cell(cells, 'decision').toLowerCase();
    if (!personId && !filmId) return;
    if (decision === '' || decision === 'skip') { blank += 1; return; }
    const film = films.get(filmId);
    if (!film) { errors.push(`line ${line}: ${filmId || '(no film)'} is not a film shared by several people`); return; }
    if (!film.people.includes(personId)) { errors.push(`line ${line}: ${personId} does not have the film ${filmId}`); return; }
    const key = filmStartKey(personId, filmId);
    if (seen.has(key)) { errors.push(`line ${line}: ${personId}'s start for ${filmId} appears twice`); return; }
    seen.add(key);
    const reference = cell(cells, 'decisionReference');
    if (!reference) { errors.push(`line ${line}: a decision needs a decisionReference`); return; }
    const note = cell(cells, 'note');
    if (decision === 'beginning') {
      decisions.push({ personId, filmId, startSeconds: null, decisionReference: reference, note });
      return;
    }
    if (decision !== 'start') { errors.push(`line ${line}: decision is start, beginning or empty, not "${decision}"`); return; }
    const seconds = parseClock(cell(cells, 'startSeconds'));
    if (seconds === null || seconds <= 0) { errors.push(`line ${line}: "${cell(cells, 'startSeconds')}" is not a time in the film`); return; }
    if (film.durationSeconds !== null && seconds >= film.durationSeconds) {
      errors.push(`line ${line}: ${clock(seconds)} is past the end of the film (${clock(film.durationSeconds)})`);
      return;
    }
    decisions.push({ personId, filmId, startSeconds: seconds, decisionReference: reference, note });
  });
  return { decisions, errors, blank };
}

/** The decisions written into the starts document, in memory. "From the beginning" removes a start. */
export function applyFilmStartDecisions(stored: StoredFilmStarts, decisions: readonly FilmStartDecision[], reviewedAt: string): StoredFilmStarts {
  const starts: Record<string, StoredFilmStart> = { ...stored.starts };
  for (const decision of decisions) {
    const key = filmStartKey(decision.personId, decision.filmId);
    if (decision.startSeconds === null) { delete starts[key]; continue; }
    starts[key] = {
      startSeconds: decision.startSeconds,
      review: {
        status: 'approved',
        decisionReference: decision.decisionReference,
        contentVersion: filmStartVersion(decision.filmId, decision.startSeconds),
        reviewedAt,
        ...(decision.note ? { note: decision.note } : {}),
      },
    };
  }
  return {
    schemaVersion: 1,
    note: stored.note ?? 'Where a person\'s film opens when the film stands for several people. Written only by npm run films:starts:apply.',
    starts: Object.fromEntries(Object.entries(starts).sort(([a], [b]) => a.localeCompare(b))),
  };
}
