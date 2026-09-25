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

type StoredBlock = {
  readonly headline?: unknown;
  readonly tagline?: unknown;
  readonly review?: { status?: string; decisionReference?: string; contentVersion?: string };
  readonly publication?: { kiosk?: boolean; publicWeb?: boolean };
};

export type StoredExhibitText = { readonly attract?: StoredBlock };

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

/** The attract screen has room for this much, at its sizes. */
export const attractLimits = { headline: 60, tagline: 140 } as const;

export type AttractDecision = {
  readonly decision: 'approve' | 'reword';
  readonly headline: string;
  readonly tagline: string;
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
  const required = ['block', 'decision', 'contentVersion', 'headline', 'tagline', 'decisionReference', 'note'];
  const missing = required.filter((column) => !header.includes(column));
  if (missing.length > 0) return { decisions: [] as AttractDecision[], errors: [`the sheet is missing the column(s) ${missing.join(', ')}`], blank: 0 };
  const cell = (cells: string[], column: string) => (cells[header.indexOf(column)] ?? '').trim();
  const current = publishedAttractText('kiosk', { stored }).contentVersion;
  const decisions: AttractDecision[] = [];
  const errors: string[] = [];
  let blank = 0;

  parsed.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const block = cell(cells, 'block');
    const decision = cell(cells, 'decision').toLowerCase();
    if (!block) return;
    if (decision === '' || decision === 'skip') { blank += 1; return; }
    if (block !== 'attract') { errors.push(`line ${line}: "${block}" is not a block of exhibit text`); return; }
    if (decisions.length > 0) { errors.push(`line ${line}: the attract words appear twice`); return; }
    if (decision !== 'approve' && decision !== 'reword') { errors.push(`line ${line}: decision is approve, reword or empty, not "${decision}"`); return; }
    const reference = cell(cells, 'decisionReference');
    if (!reference) { errors.push(`line ${line}: a decision needs a decisionReference`); return; }
    const note = cell(cells, 'note');
    if (decision === 'approve') {
      if (cell(cells, 'contentVersion') !== current) {
        errors.push(`line ${line}: the attract words have changed since this sheet was made, so the approval would cover words nobody reviewed. Look at them again.`);
        return;
      }
      const words = stored.attract;
      decisions.push({ decision, headline: String(words?.headline ?? '').trim(), tagline: String(words?.tagline ?? '').trim(), decisionReference: reference, note });
      return;
    }
    const headline = cell(cells, 'headline');
    const tagline = cell(cells, 'tagline');
    if (!headline) { errors.push(`line ${line}: new words need a headline`); return; }
    if (headline.length > attractLimits.headline) { errors.push(`line ${line}: the headline is ${headline.length} characters; the screen has room for ${attractLimits.headline}`); return; }
    if (tagline.length > attractLimits.tagline) { errors.push(`line ${line}: the tagline is ${tagline.length} characters; the screen has room for ${attractLimits.tagline}`); return; }
    decisions.push({ decision, headline, tagline, decisionReference: reference, note });
  });

  return { decisions, errors, blank };
}

/**
 * The decision written into the exhibit-text document, in memory. The words
 * are approved for the display only: the website has no attract screen.
 */
export function applyAttractDecision(stored: StoredExhibitText, decision: AttractDecision, reviewedAt: string) {
  const next = structuredClone(stored) as Record<string, unknown>;
  const previous = (next['attract'] ?? {}) as Record<string, unknown>;
  next['attract'] = {
    ...previous,
    headline: decision.headline,
    tagline: decision.tagline,
    ...(decision.decision === 'reword' ? { source: `Written by the reviewer under ${decision.decisionReference}.` } : {}),
    review: {
      status: 'approved',
      decisionReference: decision.decisionReference,
      contentVersion: attractTextVersion(decision.headline, decision.tagline),
      reviewedAt,
      ...(decision.note ? { note: decision.note } : {}),
    },
    publication: { kiosk: true, publicWeb: false },
  };
  return next as StoredExhibitText;
}
