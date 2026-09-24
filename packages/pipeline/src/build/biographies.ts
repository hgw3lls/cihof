import type { PublishedPerson } from '@cihof/content';
import { csvCell, parseRows } from './review.ts';

/**
 * The biography sheet: every person's biography as visitors read it, with
 * columns for a correction.
 *
 * A correction is written into the curated roster as `bioTextOverride`, beside
 * the decision it rests on, and the biography then says it is curated. That
 * is true even for a one-word fix: the words are no longer the institution's
 * own, and the institution's text stays untouched in the roster of record.
 *
 * `useSourceText` removes an override, so a person goes back to the
 * institution's text.
 */

export const biographyReviewerColumns = ['correctedText', 'useSourceText', 'decisionReference', 'note'] as const;

export type BiographySheetRow = {
  readonly id: string;
  readonly name: string;
  readonly classYear: string;
  /** `source` (the institution's text) or `curated` (a curator's). */
  readonly provenance: string;
  readonly currentText: string;
};

export function buildBiographySheet(people: readonly PublishedPerson[]): BiographySheetRow[] {
  return [...people]
    .sort((a, b) => (a.classYear ?? 0) - (b.classYear ?? 0) || a.sortName.localeCompare(b.sortName))
    .map((person) => ({
      id: person.id,
      name: person.name,
      classYear: person.classYear === null ? '' : String(person.classYear),
      provenance: person.biography?.provenance ?? 'none',
      currentText: person.biography?.text ?? '',
    }));
}

export function biographySheetCsv(rows: readonly BiographySheetRow[]): string {
  const header = ['id', 'name', 'classYear', 'provenance', 'currentText', ...biographyReviewerColumns];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push([row.id, row.name, row.classYear, row.provenance, row.currentText, '', '', '', ''].map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export type BiographyDecision =
  | { readonly id: string; readonly name: string; readonly action: 'correct'; readonly text: string; readonly decisionReference: string; readonly note: string }
  | { readonly id: string; readonly name: string; readonly action: 'use-source'; readonly decisionReference: string; readonly note: string };

/**
 * Reads the reviewer's columns. Who a row is about comes from its id and is
 * checked against the people built today; the copied columns are for reading
 * and are never trusted.
 */
export function biographyDecisions(csvText: string, people: readonly PublishedPerson[]) {
  const rows = parseRows(csvText.replace(/^﻿/, ''));
  const header = (rows[0] ?? []).map((cell) => cell.trim());
  const missing = ['id', ...biographyReviewerColumns].filter((column) => !header.includes(column));
  if (missing.length > 0) {
    return { decisions: [], errors: [`the sheet is missing the column(s) ${missing.join(', ')}; make a new one with npm run review:bios`], blank: 0 };
  }
  const column = (cells: string[], name: string) => (cells[header.indexOf(name)] ?? '').trim();
  const byId = new Map(people.map((person) => [person.id as string, person]));

  const decisions: BiographyDecision[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let blank = 0;

  rows.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const id = column(cells, 'id');
    if (!id) return;
    const text = column(cells, 'correctedText');
    const useSource = column(cells, 'useSourceText').toLowerCase();
    const reference = column(cells, 'decisionReference');
    const note = column(cells, 'note');
    if (!text && !useSource) { blank += 1; return; }

    const person = byId.get(id);
    if (!person) { errors.push(`line ${line}: ${id} is not a person the exhibit builds`); return; }
    const who = `${person.name} (${id})`;
    if (seen.has(id)) { errors.push(`line ${line}: ${who} appears twice`); return; }
    seen.add(id);
    if (!reference) { errors.push(`line ${line}: ${who} has a correction with no decisionReference`); return; }

    if (useSource) {
      if (!['yes', 'y', 'true'].includes(useSource)) { errors.push(`line ${line}: ${who}: useSourceText is "yes" or empty`); return; }
      if (text) { errors.push(`line ${line}: ${who} has both correctedText and useSourceText; choose one`); return; }
      if (person.biography?.provenance !== 'curated') { errors.push(`line ${line}: ${who} already shows the institution's text`); return; }
      decisions.push({ id, name: person.name, action: 'use-source', decisionReference: reference, note });
      return;
    }
    if (text === (person.biography?.text ?? '').trim()) {
      errors.push(`line ${line}: ${who}: correctedText is the same as the current text`);
      return;
    }
    decisions.push({ id, name: person.name, action: 'correct', text, decisionReference: reference, note });
  });

  return { decisions, errors, blank };
}

/**
 * Writes the decisions into a curated-roster document, in memory. Returns the
 * new document; the caller decides whether to write it.
 */
export function applyBiographyDecisions(
  curated: { inductees: Record<string, Record<string, unknown>> },
  decisions: readonly BiographyDecision[],
  appliedAt: string,
) {
  const next = structuredClone(curated);
  for (const decision of decisions) {
    const record = next.inductees[decision.id];
    if (!record) throw new Error(`No curated record for ${decision.id}`);
    const notes = Array.isArray(record['curatorNotes']) ? [...record['curatorNotes'] as string[]] : [];
    if (decision.action === 'correct') {
      record['bioTextOverride'] = decision.text;
      notes.push(`Biography corrected under ${decision.decisionReference} on ${appliedAt.slice(0, 10)}.`);
    } else {
      delete record['bioTextOverride'];
      notes.push(`Biography returned to the institution's text under ${decision.decisionReference} on ${appliedAt.slice(0, 10)}.`);
    }
    record['bioTextDecision'] = {
      decisionReference: decision.decisionReference,
      action: decision.action,
      ...(decision.note ? { note: decision.note } : {}),
      appliedAt,
    };
    record['curatorNotes'] = notes;
  }
  return next;
}
