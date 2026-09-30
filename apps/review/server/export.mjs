import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, steps, today } from './save.mjs';
import { decisionReference } from './sheets.mjs';

/**
 * The review decisions, as a file for the developer.
 *
 * The staff review app, installed on a staff computer, has no git and no copy
 * of the project to commit to. So instead of saving, it checks the decisions
 * with the same tools, exactly as saving does first, and then writes them to
 * one file: the reviewer's decisions as the app holds them, the day and the
 * audience they chose, and the signed sheets they become, for reading. The
 * developer brings it into the project with `npm run review:import`, which
 * saves it through the same code the app uses on the developer's own computer:
 * one commit per kind of review, under the reviewer's name. Every approval
 * names the version of what the reviewer saw, so anything changed since is
 * refused there rather than approved unseen.
 */

export const decisionsFormat = 'cihof-review-decisions';
export const decisionsFormatVersion = 1;

/** Checks the decisions, and writes them to a file in `exportDir` if every check passes. */
export function exportDecisions({ root, draft, audience = 'kiosk', day = today(), exportDir, now = new Date(), about = {} }) {
  if (!draft.reviewer?.trim()) throw new Error('Enter your name before exporting.');
  const results = check({ root, draft, audience, day });
  if (results.length === 0) return { ok: false, results, file: null, problem: 'There are no decisions to export.' };
  if (!results.every((result) => result.ok)) return { ok: false, results, file: null };

  const sheets = Object.fromEntries(steps.filter((step) => step.keys(draft).length > 0).map((step) => [step.task, step.csv(draft, day)]));
  const document = {
    format: decisionsFormat,
    formatVersion: decisionsFormatVersion,
    reviewer: draft.reviewer.trim(),
    day,
    exportedAt: now.toISOString(),
    audience,
    ...about,
    counts: Object.fromEntries(results.map((result) => [result.task, result.count])),
    references: Object.fromEntries(results.map((result) => [result.task, decisionReference(result.task, day)])),
    draft,
    sheets,
  };
  mkdirSync(exportDir, { recursive: true });
  const time = [now.getHours(), now.getMinutes(), now.getSeconds()].map((part) => String(part).padStart(2, '0')).join('');
  const name = `cihof-decisions-${slug(document.reviewer)}-${day}-${time}.json`;
  const file = join(exportDir, name);
  writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`);
  return { ok: true, results, file };
}

/** Reads a decisions file, or says why it cannot be used. */
export function readDecisionsFile(path) {
  let document;
  try { document = JSON.parse(readFileSync(path, 'utf8')); } catch { return { problem: `${path} is not a decisions file the review app wrote.` }; }
  if (document?.format !== decisionsFormat) return { problem: `${path} is not a decisions file the review app wrote.` };
  if (document.formatVersion !== decisionsFormatVersion) return { problem: `${path} was written by a different version of the review app (format ${document.formatVersion}); this project reads format ${decisionsFormatVersion}.` };
  if (!document.reviewer || typeof document.reviewer !== 'string') return { problem: 'The file does not say who reviewed.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(document.day ?? '')) return { problem: 'The file does not say which day the decisions were made.' };
  if (!document.draft || typeof document.draft !== 'object') return { problem: 'The file holds no decisions.' };
  return { document };
}

/** The decisions files already exported from this computer, newest first, for the history screen. */
export function listExports(exportDir) {
  if (!exportDir || !existsSync(exportDir)) return [];
  return readdirSync(exportDir)
    .filter((name) => name.startsWith('cihof-decisions-') && name.endsWith('.json'))
    .flatMap((name) => {
      const { document } = readDecisionsFile(join(exportDir, name));
      if (!document) return [];
      const total = Object.values(document.counts ?? {}).reduce((sum, count) => sum + Number(count || 0), 0);
      return [{ name, reviewer: document.reviewer, day: document.day, exportedAt: document.exportedAt, total, counts: document.counts ?? {} }];
    })
    .sort((a, b) => String(b.exportedAt).localeCompare(String(a.exportedAt)));
}

function slug(text) {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'reviewer';
}
