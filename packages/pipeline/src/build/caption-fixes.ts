import { existsSync, readFileSync } from 'node:fs';
import { publicFile } from '../paths.ts';
import { parseRows } from './review.ts';

/**
 * Corrections to a film's captions and transcript, decided by a reviewer.
 *
 * The captions are YouTube's automatic captions and the transcripts were drawn
 * from them, so the same mistakes are in both: music heard as the word
 * "heat", the transcriber's [BLANK_AUDIO] mark, names misheard. A fix is
 * applied to both files, and to every copy of the film (a ceremony shared by
 * several people has a copy for each of them), so they never disagree.
 *
 * In the captions only the lines a fix touches change. A touched line loses
 * its word-by-word timing tags, which only pace the words within the line;
 * the line's own timing, and every other line, stay byte for byte as they
 * were.
 */

export type CaptionFixKind = 'music' | 'blank' | 'phrase';

export type CaptionFix = {
  readonly filmId: string;
  readonly fix: CaptionFixKind;
  /** The words to find; for `phrase` only. */
  readonly find?: string;
  /** What replaces them: "[music]" or nothing for `music`; anything for `phrase`. */
  readonly replaceWith: string;
};

export type FilmFiles = {
  readonly filmId: string;
  readonly people: readonly string[];
  readonly captions: readonly string[];
  readonly transcripts: readonly string[];
};

/** Every film by its id, with each copy's caption and transcript files. */
export function filmFiles(holdings: ReadonlyMap<string, readonly unknown[]>): Map<string, FilmFiles> {
  const films = new Map<string, { people: Set<string>; captions: Set<string>; transcripts: Set<string> }>();
  for (const [personId, videos] of holdings) {
    for (const value of videos) {
      const video = value as Record<string, unknown>;
      const filmId = typeof video['youtubeVideoId'] === 'string' ? video['youtubeVideoId'] : '';
      if (!filmId) continue;
      const entry = films.get(filmId) ?? { people: new Set(), captions: new Set(), transcripts: new Set() };
      entry.people.add(personId);
      if (typeof video['captionFilePath'] === 'string') entry.captions.add(video['captionFilePath']);
      if (typeof video['transcriptFilePath'] === 'string') entry.transcripts.add(video['transcriptFilePath']);
      films.set(filmId, entry);
    }
  }
  return new Map([...films].map(([filmId, entry]) => [filmId, {
    filmId,
    people: [...entry.people].sort(),
    captions: [...entry.captions].sort(),
    transcripts: [...entry.transcripts].sort(),
  }]));
}

const heatRun = /\bheat\b[.,!?]*(?:\s+\bheat\b[.,!?]*)*/gi;
const blank = /[ \t]*\[BLANK_AUDIO\][ \t]*/g;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The pattern a fix looks for, fresh each time (global patterns carry state). */
function pattern(fix: CaptionFix): RegExp {
  if (fix.fix === 'music') return new RegExp(heatRun.source, 'gi');
  if (fix.fix === 'blank') return new RegExp(blank.source, 'g');
  return new RegExp(escape(fix.find ?? ''), 'g');
}

/** The fix applied to a piece of plain text, and how many times it applied. */
export function fixText(text: string, fix: CaptionFix): { text: string; count: number } {
  if (fix.fix === 'phrase' && !fix.find) return { text, count: 0 };
  let count = 0;
  const replacement = fix.fix === 'blank' ? ' ' : fix.replaceWith;
  const next = text.replace(pattern(fix), () => { count += 1; return replacement; });
  if (count === 0) return { text, count };
  // Tidy only what a fix leaves behind: doubled spaces, a space before punctuation, spaces at line ends.
  const tidy = next
    .split('\n')
    .map((line) => line.replace(/ {2,}/g, ' ').replace(/ ([.,!?])/g, '$1').replace(/^ +| +$/g, ''))
    .join('\n');
  return { text: tidy, count };
}

/** A caption file with the fix applied to the lines it touches. */
export function fixCaptions(vtt: string, fix: CaptionFix): { text: string; count: number } {
  let count = 0;
  const lines = vtt.split('\n').map((line) => {
    if (line.includes('-->') || !line.trim() || /^(WEBVTT|Kind:|Language:|NOTE)/.test(line)) return line;
    const plain = line.replace(/<[^>]+>/g, '');
    const fixed = fixText(plain, fix);
    if (fixed.count === 0) return line;
    count += fixed.count;
    // An emptied line stays as a single space, as the captions mark a blank line.
    return fixed.text.trim() ? fixed.text : ' ';
  });
  return { text: lines.join('\n'), count };
}

export type FixPreview = {
  readonly transcriptCount: number;
  readonly captionCount: number;
  /** Where it applies in the transcript: the words before and after. */
  readonly examples: readonly { readonly before: string; readonly after: string }[];
};

function readPublic(path: string): string | null {
  const full = publicFile(path.replace(/^public\//, ''));
  return existsSync(full) ? readFileSync(full, 'utf8') : null;
}

/** What a fix would change in one film, read from its first copy (every copy is the same). */
export function previewFix(film: FilmFiles, fix: CaptionFix): FixPreview {
  const transcript = film.transcripts[0] ? readPublic(film.transcripts[0]) ?? '' : '';
  const captions = film.captions[0] ? readPublic(film.captions[0]) ?? '' : '';
  const examples: { before: string; after: string }[] = [];
  const flat = transcript.replace(/\s+/g, ' ');
  if (fix.fix !== 'phrase' || fix.find) {
    for (const match of flat.matchAll(pattern(fix))) {
      if (examples.length >= 6) break;
      const start = Math.max(0, (match.index ?? 0) - 60);
      const end = Math.min(flat.length, (match.index ?? 0) + match[0].length + 60);
      const before = flat.slice(start, end);
      examples.push({ before: `${start > 0 ? '…' : ''}${before}${end < flat.length ? '…' : ''}`, after: `${start > 0 ? '…' : ''}${fixText(before, fix).text}${end < flat.length ? '…' : ''}` });
    }
  }
  return {
    transcriptCount: fixText(transcript, fix).count,
    captionCount: fixCaptions(captions, fix).count,
    examples,
  };
}

/** Noise worth a look in a film's transcript: music heard as "heat", and blank-audio marks. */
export function findNoise(film: FilmFiles): { music: FixPreview; blank: FixPreview } {
  return {
    music: previewFix(film, { filmId: film.filmId, fix: 'music', replaceWith: '[music]' }),
    blank: previewFix(film, { filmId: film.filmId, fix: 'blank', replaceWith: '' }),
  };
}

// -------------------------------------------------------------- decisions

export type CaptionFixDecision = CaptionFix & { readonly decisionReference: string; readonly note: string };

/**
 * A sheet of fixes: filmId, fix (music, blank or phrase), find, replaceWith,
 * decisionReference, note. A fix that would change nothing is refused: it is
 * a decision about words that are not there.
 */
export function captionFixDecisions(csvText: string, films: ReadonlyMap<string, FilmFiles>) {
  const parsed = parseRows(csvText.replace(/^﻿/, ''));
  const header = (parsed[0] ?? []).map((cell) => cell.trim());
  const required = ['filmId', 'fix', 'find', 'replaceWith', 'decisionReference', 'note'];
  const missing = required.filter((column) => !header.includes(column));
  if (missing.length > 0) return { decisions: [] as CaptionFixDecision[], errors: [`the sheet is missing the column(s) ${missing.join(', ')}`] };
  // Values are kept exactly, spaces included: "[music]" and "" differ, and a name may start a line.
  const cell = (cells: string[], column: string) => cells[header.indexOf(column)] ?? '';
  const decisions: CaptionFixDecision[] = [];
  const errors: string[] = [];

  parsed.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const filmId = cell(cells, 'filmId').trim();
    const fix = cell(cells, 'fix').trim().toLowerCase();
    if (!filmId && !fix) return;
    const film = films.get(filmId);
    if (!film) { errors.push(`line ${line}: no film ${filmId || '(none)'}`); return; }
    if (fix !== 'music' && fix !== 'blank' && fix !== 'phrase') { errors.push(`line ${line}: fix is music, blank or phrase, not "${fix}"`); return; }
    const reference = cell(cells, 'decisionReference').trim();
    if (!reference) { errors.push(`line ${line}: a fix needs a decisionReference`); return; }
    const find = cell(cells, 'find');
    const replaceWith = cell(cells, 'replaceWith');
    if (fix === 'music' && replaceWith !== '[music]' && replaceWith !== '') {
      errors.push(`line ${line}: music is replaced with "[music]" or removed (empty), not "${replaceWith}"`);
      return;
    }
    if (fix === 'phrase') {
      if (!find.trim()) { errors.push(`line ${line}: say which words to correct`); return; }
      if (find === replaceWith) { errors.push(`line ${line}: the correction is the same as the words`); return; }
      if (/[\r\n]/.test(find + replaceWith)) { errors.push(`line ${line}: a correction is on one line`); return; }
    }
    const decision: CaptionFixDecision = {
      filmId, fix, replaceWith: fix === 'blank' ? '' : replaceWith, ...(fix === 'phrase' ? { find } : {}),
      decisionReference: reference, note: cell(cells, 'note').trim(),
    };
    const preview = previewFix(film, decision);
    if (preview.transcriptCount + preview.captionCount === 0) {
      errors.push(`line ${line}: ${fix === 'phrase' ? `"${find}" is not` : 'nothing to fix is'} in ${filmId}'s captions or transcript`);
      return;
    }
    decisions.push(decision);
  });
  return { decisions, errors };
}

export type AppliedFix = {
  readonly decision: CaptionFixDecision;
  readonly film: FilmFiles;
  readonly transcriptCount: number;
  readonly captionCount: number;
};

/**
 * Applies a sheet's fixes in order, to files already read (`read` returns a
 * file's original text). Each fix was previewed against the original words,
 * so a fix that would also act on words an earlier fix in the same sheet
 * wrote ("Alice" → "Bob", then "Bob" → "Carol") is refused: it would change
 * more than the reviewer saw. Save such fixes one after the other instead.
 */
export function applyFixes(decisions: readonly CaptionFixDecision[], films: ReadonlyMap<string, FilmFiles>, read: (path: string) => string) {
  const contents = new Map<string, string>();
  const current = (path: string) => contents.get(path) ?? read(path);
  const applied: AppliedFix[] = [];
  const errors: string[] = [];
  for (const decision of decisions) {
    const film = films.get(decision.filmId)!;
    let transcriptCount = 0;
    let captionCount = 0;
    let overlaps = false;
    for (const path of film.transcripts) {
      const onOriginal = fixText(read(path), decision).count;
      const result = fixText(current(path), decision);
      if (result.count !== onOriginal) overlaps = true;
      contents.set(path, result.text);
      transcriptCount = Math.max(transcriptCount, result.count);
    }
    for (const path of film.captions) {
      const onOriginal = fixCaptions(read(path), decision).count;
      const result = fixCaptions(current(path), decision);
      if (result.count !== onOriginal) overlaps = true;
      contents.set(path, result.text);
      captionCount = Math.max(captionCount, result.count);
    }
    if (overlaps) {
      const what = decision.fix === 'phrase' ? `"${decision.find}" → "${decision.replaceWith}"` : `the ${decision.fix} fix`;
      errors.push(`${decision.filmId}: ${what} would also change words an earlier fix in this sheet wrote, which nobody previewed. Save the earlier fix first, then this one.`);
    }
    applied.push({ decision, film, transcriptCount, captionCount });
  }
  return { contents, applied, errors };
}
