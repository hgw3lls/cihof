import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isPublished, type VisitorTarget } from '@cihof/content';
import { dataFile } from '../paths.ts';
import { parseRows } from './review.ts';

/**
 * Words the exhibit shows that belong to no one person, such as the attract
 * screen's headline.
 *
 * They are visitor text like any other, so they follow the same rule: shown
 * only once a curator has approved them for this target, and only in the
 * exact words that were approved. The content version is a fingerprint of the
 * words, so an edit after approval holds the block back rather than letting
 * unreviewed wording ride on an old decision.
 */

export type AttractText = {
  readonly headline: string;
  readonly tagline: string;
  /** Only in an editor's preview: shown although nobody has approved it. */
  readonly unreviewed?: true;
};

/** The hall's "About" words: paragraphs a visitor can open from anywhere. */
export type AboutText = {
  readonly body: string;
  /** Only in an editor's preview: shown although nobody has approved it. */
  readonly unreviewed?: true;
};

type StoredBlock = {
  readonly headline?: unknown;
  readonly tagline?: unknown;
  readonly body?: unknown;
  readonly source?: unknown;
  readonly review?: { status?: string; decisionReference?: string; contentVersion?: string };
  readonly publication?: { kiosk?: boolean; publicWeb?: boolean };
};

export type StoredExhibitText = { readonly attract?: StoredBlock; readonly about?: StoredBlock };

export function readExhibitText(): StoredExhibitText {
  return JSON.parse(readFileSync(dataFile('cihof_exhibit_text.json'), 'utf8')) as StoredExhibitText;
}

/** The version an approval must name: a fingerprint of the words themselves. */
export function attractTextVersion(headline: string, tagline: string): string {
  return `text-${createHash('sha256').update(JSON.stringify([headline, tagline])).digest('hex').slice(0, 12)}`;
}

export type AttractTextStatus = {
  readonly text: AttractText | null;
  /** What an approval of the current words would record as contentVersion. */
  readonly contentVersion: string | null;
  readonly problem: string | null;
};

export function publishedAttractText(
  target: VisitorTarget,
  { preview = false, stored = readExhibitText() }: { preview?: boolean; stored?: StoredExhibitText } = {},
): AttractTextStatus {
  const block = stored.attract;
  const headline = typeof block?.headline === 'string' ? block.headline.trim() : '';
  const tagline = typeof block?.tagline === 'string' ? block.tagline.trim() : '';
  if (!block || !headline) return { text: null, contentVersion: null, problem: 'no attract headline is written' };

  const contentVersion = attractTextVersion(headline, tagline);
  const review = block.review ?? {};
  let problem: string | null = null;
  if (!isPublished({ review: review as never, publication: block.publication as never }, target)) {
    problem = review.status === 'approved' ? `not approved for the ${target} target` : `review status is ${review.status ?? 'missing'}`;
  } else if (review.contentVersion !== contentVersion) {
    problem = 'the words have changed since they were approved';
  }

  if (!problem) return { text: { headline, tagline }, contentVersion, problem: null };
  // An editor's preview shows the words, marked, so they can be judged in place.
  if (preview) return { text: { headline, tagline, unreviewed: true }, contentVersion, problem };
  return { text: null, contentVersion, problem };
}

/** The version an approval of the About words must name. */
export function aboutTextVersion(body: string): string {
  return `text-${createHash('sha256').update(JSON.stringify(['about', body])).digest('hex').slice(0, 12)}`;
}

export type AboutTextStatus = {
  readonly text: AboutText | null;
  readonly contentVersion: string | null;
  readonly problem: string | null;
};

/**
 * The About words for a target: only once approved for it, in exactly the
 * words approved. Both the display and the website may carry them.
 */
export function publishedAboutText(
  target: VisitorTarget,
  { preview = false, stored = readExhibitText() }: { preview?: boolean; stored?: StoredExhibitText } = {},
): AboutTextStatus {
  const block = stored.about;
  const body = typeof block?.body === 'string' ? block.body.trim() : '';
  if (!block || !body) return { text: null, contentVersion: null, problem: 'no About words are written' };

  const contentVersion = aboutTextVersion(body);
  const review = block.review ?? {};
  let problem: string | null = null;
  if (!isPublished({ review: review as never, publication: block.publication as never }, target)) {
    problem = review.status === 'approved' ? `not approved for the ${target} target` : `review status is ${review.status ?? 'missing'}`;
  } else if (review.contentVersion !== contentVersion) {
    problem = 'the words have changed since they were approved';
  }

  if (!problem) return { text: { body }, contentVersion, problem: null };
  if (preview) return { text: { body, unreviewed: true }, contentVersion, problem };
  return { text: null, contentVersion, problem };
}

/** The About panel reads comfortably at this length on a display and a phone. */
export const aboutLimit = 1500;

/** The attract screen has room for this much, at its sizes. */
export const attractLimits = { headline: 60, tagline: 140 } as const;

export type ExhibitTextBlock = 'attract' | 'about';

export type AttractDecision = {
  readonly block: ExhibitTextBlock;
  readonly decision: 'approve' | 'reword';
  readonly headline: string;
  readonly tagline: string;
  /** The About words; empty for the attract screen. */
  readonly body: string;
  readonly decisionReference: string;
  readonly note: string;
};

/**
 * Reads a curator's decision on the attract words from a one-row sheet.
 *
 * `approve` approves the words exactly as the reviewer saw them: the sheet's
 * contentVersion must match the words now, or the row is refused. `reword`
 * replaces them with the reviewer's own words, approved as written, as a
 * curated biography is.
 */
export function attractDecisions(csvText: string, stored: StoredExhibitText = readExhibitText()) {
  const parsed = parseRows(csvText.replace(/^﻿/, ''));
  const header = (parsed[0] ?? []).map((cell) => cell.trim());
  // `body` is optional so a sheet made before the About words still reads.
  const required = ['block', 'decision', 'contentVersion', 'headline', 'tagline', 'decisionReference', 'note'];
  const missing = required.filter((column) => !header.includes(column));
  if (missing.length > 0) return { decisions: [] as AttractDecision[], errors: [`the sheet is missing the column(s) ${missing.join(', ')}`], blank: 0 };
  const cell = (cells: string[], column: string) => (cells[header.indexOf(column)] ?? '').trim();
  const currentVersion = {
    attract: publishedAttractText('kiosk', { stored }).contentVersion,
    about: publishedAboutText('kiosk', { stored }).contentVersion,
  };
  const seen = new Set<string>();
  const decisions: AttractDecision[] = [];
  const errors: string[] = [];
  let blank = 0;

  parsed.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const block = cell(cells, 'block');
    const decision = cell(cells, 'decision').toLowerCase();
    if (!block) return;
    if (decision === '' || decision === 'skip') { blank += 1; return; }
    if (block !== 'attract' && block !== 'about') { errors.push(`line ${line}: "${block}" is not a block of exhibit text`); return; }
    const name = block === 'about' ? 'the About words' : 'the attract words';
    if (seen.has(block)) { errors.push(`line ${line}: ${name} appear twice`); return; }
    if (decision !== 'approve' && decision !== 'reword') { errors.push(`line ${line}: decision is approve, reword or empty, not "${decision}"`); return; }
    const reference = cell(cells, 'decisionReference');
    if (!reference) { errors.push(`line ${line}: a decision needs a decisionReference`); return; }
    const note = cell(cells, 'note');
    if (decision === 'approve') {
      if (cell(cells, 'contentVersion') !== currentVersion[block]) {
        errors.push(`line ${line}: ${name} have changed since this sheet was made, so the approval would cover words nobody reviewed. Look at them again.`);
        return;
      }
      const words = stored[block];
      seen.add(block);
      decisions.push({
        block, decision,
        headline: String(words?.headline ?? '').trim(), tagline: String(words?.tagline ?? '').trim(),
        body: String(words?.body ?? '').trim(), decisionReference: reference, note,
      });
      return;
    }
    if (block === 'about') {
      const body = cell(cells, 'body');
      if (!body) { errors.push(`line ${line}: new About words need a body`); return; }
      if (body.length > aboutLimit) { errors.push(`line ${line}: the About words are ${body.length} characters; the panel has room for ${aboutLimit}`); return; }
      seen.add(block);
      decisions.push({ block, decision, headline: '', tagline: '', body, decisionReference: reference, note });
      return;
    }
    const headline = cell(cells, 'headline');
    const tagline = cell(cells, 'tagline');
    if (!headline) { errors.push(`line ${line}: new words need a headline`); return; }
    if (headline.length > attractLimits.headline) { errors.push(`line ${line}: the headline is ${headline.length} characters; the screen has room for ${attractLimits.headline}`); return; }
    if (tagline.length > attractLimits.tagline) { errors.push(`line ${line}: the tagline is ${tagline.length} characters; the screen has room for ${attractLimits.tagline}`); return; }
    seen.add(block);
    decisions.push({ block, decision, headline, tagline, body: '', decisionReference: reference, note });
  });

  return { decisions, errors, blank };
}

/**
 * The decision written into the exhibit-text document, in memory. The attract
 * words are approved for the display only: the website has no attract screen.
 * The About words are approved for both, since both show them.
 */
export function applyAttractDecision(stored: StoredExhibitText, decision: AttractDecision, reviewedAt: string) {
  const next = structuredClone(stored) as Record<string, unknown>;
  const previous = (next[decision.block] ?? {}) as Record<string, unknown>;
  const words = decision.block === 'about'
    ? { body: decision.body }
    : { headline: decision.headline, tagline: decision.tagline };
  const version = decision.block === 'about'
    ? aboutTextVersion(decision.body)
    : attractTextVersion(decision.headline, decision.tagline);
  next[decision.block] = {
    ...previous,
    ...words,
    ...(decision.decision === 'reword' ? { source: `Written by the reviewer under ${decision.decisionReference}.` } : {}),
    review: {
      status: 'approved',
      decisionReference: decision.decisionReference,
      contentVersion: version,
      reviewedAt,
      ...(decision.note ? { note: decision.note } : {}),
    },
    publication: decision.block === 'about' ? { kiosk: true, publicWeb: true } : { kiosk: true, publicWeb: false },
  };
  return next as StoredExhibitText;
}
