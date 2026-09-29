import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { allowsTarget, type VisitorTarget } from '@cihof/content';
import { dataFile } from '../paths.ts';
import { parseRows } from './review.ts';

/**
 * What a film is called in a person's list of films.
 *
 * The collection recorded no titles. Each film has one on YouTube, given by
 * whoever posted it, and those are collected as unreviewed outside research
 * (data/external-research/youtube-film-titles.json, npm run
 * source:film-titles), which nothing here reads. A title reaches a visitor
 * only once a curator has approved it, in the exact words approved, and only
 * on the targets the approval named: films are on the display only, so the
 * approvals made so far name the display only.
 *
 * A film with no approved title is described as before, by its length or as
 * part of a ceremony, and nothing is made up.
 */

export type FilmTitleReview = {
  readonly status?: string;
  readonly decisionReference?: string;
  readonly contentVersion?: string;
  readonly reviewedAt?: string;
  readonly note?: string;
};

export type StoredFilmTitle = {
  readonly title: string;
  readonly review: FilmTitleReview;
  readonly publication?: { readonly kiosk?: boolean; readonly publicWeb?: boolean };
};

export type StoredFilmTitles = {
  readonly schemaVersion?: number;
  readonly note?: string;
  readonly titles: Readonly<Record<string, StoredFilmTitle>>;
};

/** Room in the list beside a poster: two lines at its size. */
export const filmTitleLimit = 90;

const titlesPath = () => dataFile('cihof_film_titles.json');

export function readFilmTitles(): StoredFilmTitles {
  const path = titlesPath();
  if (!existsSync(path)) return { titles: {} };
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<StoredFilmTitles>;
  return { ...parsed, titles: parsed.titles ?? {} };
}

/** The version an approval names: the film and the exact words. */
export function filmTitleVersion(filmId: string, title: string): string {
  return `title-${createHash('sha256').update(JSON.stringify([filmId, title])).digest('hex').slice(0, 12)}`;
}

/** The approved title of this film for this target, or null. */
export function approvedFilmTitle(stored: StoredFilmTitles, filmId: string, target: VisitorTarget): string | null {
  const entry = stored.titles[filmId];
  if (!entry || typeof entry.title !== 'string') return null;
  const title = entry.title.trim();
  if (!title || title.length > filmTitleLimit) return null;
  const review = entry.review ?? {};
  if (review.status !== 'approved' || !review.decisionReference?.trim()) return null;
  if (review.contentVersion !== filmTitleVersion(filmId, title)) return null;
  if (!allowsTarget({ kiosk: entry.publication?.kiosk === true, publicWeb: entry.publication?.publicWeb === true }, target)) return null;
  return title;
}

export type FilmTitleDecision = {
  readonly filmId: string;
  /** `approve` the title in the sheet; `clear` takes the film's title away. */
  readonly decision: 'approve' | 'clear';
  readonly title: string;
  readonly decisionReference: string;
  readonly note: string;
};

/**
 * Reads a curator's decisions from a sheet (filmId, decision, title,
 * decisionReference, note). An approval approves the title written in the
 * sheet, as written: the reviewer's own words, or the collected YouTube title
 * they chose to keep. An empty decision leaves a film as it is.
 */
export function filmTitleDecisions(csvText: string, filmIds: ReadonlySet<string>) {
  const parsed = parseRows(csvText.replace(/^﻿/, ''));
  const header = (parsed[0] ?? []).map((cell) => cell.trim());
  const required = ['filmId', 'decision', 'title', 'decisionReference', 'note'];
  const missing = required.filter((column) => !header.includes(column));
  if (missing.length > 0) return { decisions: [] as FilmTitleDecision[], errors: [`the sheet is missing the column(s) ${missing.join(', ')}`], blank: 0 };
  const cell = (cells: string[], column: string) => (cells[header.indexOf(column)] ?? '').trim();
  const decisions: FilmTitleDecision[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let blank = 0;

  parsed.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const filmId = cell(cells, 'filmId');
    const decision = cell(cells, 'decision').toLowerCase();
    if (!filmId) return;
    if (decision === '' || decision === 'skip') { blank += 1; return; }
    if (!filmIds.has(filmId)) { errors.push(`line ${line}: there is no film "${filmId}" in the collection`); return; }
    if (seen.has(filmId)) { errors.push(`line ${line}: the film "${filmId}" appears twice`); return; }
    seen.add(filmId);
    if (decision !== 'approve' && decision !== 'clear') { errors.push(`line ${line}: decision is approve, clear or empty, not "${decision}"`); return; }
    const reference = cell(cells, 'decisionReference');
    if (!reference) { errors.push(`line ${line}: a decision needs a decisionReference`); return; }
    const title = cell(cells, 'title').replace(/\s+/g, ' ');
    if (decision === 'approve') {
      if (!title) { errors.push(`line ${line}: an approval needs the title it approves`); return; }
      if (title.length > filmTitleLimit) { errors.push(`line ${line}: the title is ${title.length} characters; the list has room for ${filmTitleLimit}`); return; }
    }
    decisions.push({ filmId, decision, title: decision === 'approve' ? title : '', decisionReference: reference, note: cell(cells, 'note') });
  });

  return { decisions, errors, blank };
}

/**
 * The decisions written into the titles document, in memory. An approval
 * records the words, the version that names them, and the display as its
 * only target, since films are shown there only; a clearing removes the title.
 */
export function applyFilmTitleDecisions(stored: StoredFilmTitles, decisions: readonly FilmTitleDecision[], reviewedAt: string): StoredFilmTitles {
  const titles: Record<string, StoredFilmTitle> = { ...stored.titles };
  for (const decision of decisions) {
    if (decision.decision === 'clear') { delete titles[decision.filmId]; continue; }
    titles[decision.filmId] = {
      title: decision.title,
      review: {
        status: 'approved',
        decisionReference: decision.decisionReference,
        contentVersion: filmTitleVersion(decision.filmId, decision.title),
        reviewedAt,
        ...(decision.note ? { note: decision.note } : {}),
      },
      publication: { kiosk: true, publicWeb: false },
    };
  }
  return {
    schemaVersion: stored.schemaVersion ?? 1,
    note: stored.note ?? 'Film titles approved by a curator, in the exact words approved. Applied by npm run films:titles:apply.',
    titles: Object.fromEntries(Object.entries(titles).sort(([a], [b]) => a.localeCompare(b))),
  };
}
