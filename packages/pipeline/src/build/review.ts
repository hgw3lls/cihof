import type {
  InductionCrosswalk, InducteeId, PublishedPerson, RelationshipReviewSheet, ReviewRow,
} from '@cihof/content';
import { bandOf, proposedRelationships } from '@cihof/content';

/**
 * Builds the induction review sheet from the crosswalk, as curators left it.
 *
 * Wholly derived: every field comes from the crosswalk or from the roster, and
 * regenerating discards nothing, because there is nothing here that a person
 * wrote. Decisions live in `data/cihof_induction_crosswalk.json` and are read
 * from there — the sheet shows them, it does not hold them.
 *
 * That is the difference from the contribution worksheet, which is the canonical
 * home of what curators write and therefore has to defend it. This one can be
 * deleted and rebuilt without losing anything.
 */
export function buildRelationshipReviewSheet(
  crosswalk: InductionCrosswalk,
  people: readonly PublishedPerson[],
): RelationshipReviewSheet {
  const nameById = new Map(people.map((person) => [person.id, person.name] as const));
  const nameOf = (id: InducteeId) => nameById.get(id);

  const rows: ReviewRow[] = crosswalk.entries.map((entry) => {
    const band = bandOf(entry);
    // Only an unambiguous row gets a preview. Composing one reading of an
    // ambiguous row would put a thumb on the scale the reviewer is there to
    // hold, and the preview is persuasive precisely because it is complete.
    const proposes = band === 'single-candidate' && entry.candidates[0]
      ? proposedRelationships(entry, entry.candidates[0].inducteeId, nameOf)
      : [];

    return {
      entryId: entry.id,
      recordedName: entry.recordedName,
      band,
      inducted: entry.inducted,
      candidates: entry.candidates,
      proposes,
      resolution: entry.resolution,
    };
  });

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'data/cihof_induction_crosswalk.json',
    ...(crosswalk.publicationDecision === undefined
      ? {}
      : { publicationDecision: crosswalk.publicationDecision }),
    rows,
  };
}

/**
 * The sheet as a CSV a curator can fill in away from the repository.
 *
 * One line per name, with the decision columns last and empty. The preview
 * columns are there so the person deciding can see what their signature
 * publishes without opening the JSON; they are regenerated on every run and
 * anything typed into them is discarded.
 */
export function reviewSheetCsv(sheet: RelationshipReviewSheet): string {
  const header = [
    'recordedName', 'band', 'inductedCount', 'inducted',
    'candidateInducteeId', 'candidateName', 'candidateBasis', 'candidateVerificationLayer',
    'candidateEvidence', 'proposedCount', 'proposedLabels',
    'currentStatus',
    // Everything from here is the reviewer's. Generated empty, every time.
    'decision', 'inducteeId', 'decisionReference', 'note',
  ];

  const lines = [header.join(',')];
  for (const row of sheet.rows) {
    const candidate = row.candidates[0];
    const resolved = row.resolution.status === 'inductee' ? row.resolution.inducteeId : '';
    lines.push([
      row.recordedName,
      row.band,
      String(row.inducted.length),
      row.inducted.join(' '),
      row.candidates.map((c) => c.inducteeId).join(' '),
      row.candidates.map((c) => c.displayName).join(' | '),
      candidate?.basis ?? '',
      candidate?.verificationLayer ?? '',
      candidate?.evidence ?? '',
      String(row.proposes.length),
      row.proposes.map((p) => p.label).join(' | '),
      row.resolution.status,
      // The reviewer's columns. A pre-filled decision is not a decision.
      '', resolved, '', '',
    ].map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Quotes a cell.
 *
 * Recorded names are copied from the roster untouched and some carry commas
 * and quotation marks; a sheet that mangled them would send a reviewer looking
 * for a person the roster does not record.
 */
function csvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Rows in a sheet somebody has already decided.
 *
 * The sheet is derived and safe to rebuild — except for these four columns,
 * which are not derived from anything and exist nowhere else until
 * `links:apply` runs. Regenerating over them destroys review work silently.
 *
 * Only `decision` and `decisionReference` count. `inducteeId` is pre-filled on
 * rows that are already resolved, so treating it as a signal would make the
 * generator refuse to regenerate its own output.
 *
 * Forgiving about what it is reading, and biased towards refusing: a sheet that
 * has been through a spreadsheet may come back with reordered or extra columns,
 * and "I could not parse this" must never be reported as "there is nothing
 * here" — that is the one wrong answer, because it leads to an overwrite.
 */
export function decisionsInSheet(csvText: string): string[] {
  let rows: string[][];
  try {
    rows = parseRows(csvText);
  } catch {
    return ['(this sheet could not be parsed; refusing rather than guessing)'];
  }
  const header = rows[0]?.map((cell) => cell.trim());
  if (!header) return [];

  const name = header.indexOf('recordedName');
  const decision = header.indexOf('decision');
  const reference = header.indexOf('decisionReference');
  if (decision < 0 && reference < 0) {
    return ['(this sheet has no decision columns; refusing rather than guessing)'];
  }

  const decided: string[] = [];
  for (const cells of rows.slice(1)) {
    const said = decision >= 0 ? (cells[decision] ?? '').trim() : '';
    const traced = reference >= 0 ? (cells[reference] ?? '').trim() : '';
    if (!said && !traced) continue;
    const who = name >= 0 ? (cells[name] ?? '').trim() || '(unnamed row)' : '(unnamed row)';
    decided.push(`${who}: ${said || '(no decision)'}${traced ? ` [${traced}]` : ''}`);
  }
  return decided;
}

/** Minimal RFC4180 reader. Only needs to survive what a spreadsheet writes. */
function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1; continue; }
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) { row.push(value); value = ''; continue; }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = []; value = '';
      continue;
    }
    value += char;
  }
  row.push(value);
  if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  return rows;
}
