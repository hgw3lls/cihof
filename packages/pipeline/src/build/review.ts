import type {
  InductionCrosswalk, InducteeId, PlaceReviewRow, PlaceReviewSheet, PublishedPerson,
  RelationshipReviewSheet, ReviewRow,
} from '@cihof/content';
import { placeTextVersion, placeWordsState } from './place-text.ts';
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
export function csvCell(value: string): string {
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
export function decisionsInSheet(
  csvText: string,
  decisionColumns: readonly string[] = ['decision', 'decisionReference'],
  labelColumn = 'recordedName',
): string[] {
  let rows: string[][];
  try {
    rows = parseRows(csvText);
  } catch {
    return ['(this sheet could not be parsed; refusing rather than guessing)'];
  }
  const header = rows[0]?.map((cell) => cell.trim());
  if (!header) return [];

  const label = header.indexOf(labelColumn);
  const columns = decisionColumns.map((column) => header.indexOf(column)).filter((index) => index >= 0);
  if (columns.length === 0) {
    return ['(this sheet has no decision columns; refusing rather than guessing)'];
  }

  const decided: string[] = [];
  for (const cells of rows.slice(1)) {
    const written = columns.map((index) => (cells[index] ?? '').trim()).filter(Boolean);
    if (written.length === 0) continue;
    const who = label >= 0 ? (cells[label] ?? '').trim() || '(unnamed row)' : '(unnamed row)';
    decided.push(`${who}: ${written.join(' / ')}`);
  }
  return decided;
}

/** Minimal RFC4180 reader. Only needs to survive what a spreadsheet writes. */
export function parseRows(text: string): string[][] {
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

// ------------------------------------------------------------------- places

/**
 * Builds the places review sheet from the seeds and the ingested ties.
 *
 * Derived, like its sibling: reviews live in `data/cihof_places.json` and roles
 * in `data/cihof_place_associations.json`, and this shows them rather than
 * holding them. Rows are banded by whether anybody has written a history,
 * because a reviewer cannot approve a place into existence without one.
 */
export function buildPlaceReviewSheet(
  places: readonly unknown[],
  associations: readonly unknown[],
  people: readonly PublishedPerson[],
): PlaceReviewSheet {
  // Keyed by plain string: a tie's person id arrives from an ingested file and
  // has not been through the brand, so looking it up as one would not compile
  // and casting it would assert something nothing has checked.
  const nameById = new Map<string, string>(people.map((person) => [person.id as string, person.name]));
  const tiesByPlace = new Map<string, PlaceReviewRow['ties'][number][]>();

  for (const value of associations) {
    const tie = value as Record<string, unknown>;
    const place = typeof tie['place'] === 'string' ? tie['place'] : '';
    const person = typeof tie['person'] === 'string' ? tie['person'] : '';
    if (!place || !person) continue;
    const role = tie['role'];
    const list = tiesByPlace.get(place) ?? [];
    list.push({
      person,
      displayName: nameById.get(person) ?? person,
      kind: typeof tie['kind'] === 'string' ? tie['kind'] : '',
      role: typeof role === 'string' && role.trim().length > 0 ? role.trim() : null,
    });
    tiesByPlace.set(place, list);
  }

  const rows: PlaceReviewRow[] = places.flatMap((value) => {
    const place = value as Record<string, unknown>;
    const id = typeof place['id'] === 'string' ? place['id'] : '';
    if (!id) return [];
    const shortHistory = typeof place['shortHistory'] === 'string' ? place['shortHistory'].trim() : '';
    const ties = (tiesByPlace.get(id) ?? [])
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    return [{
      placeId: id,
      name: typeof place['name'] === 'string' ? place['name'] : '',
      band: shortHistory.length > 0 ? ('researched' as const) : ('lead' as const),
      neighborhood: typeof place['neighborhood'] === 'string' ? place['neighborhood'] : '',
      shortHistory,
      ties,
      // A review record is the thing that publishes a place. Its presence is
      // read, never written here.
      reviewed: Boolean(place['review']),
      contentVersion: placeTextVersion(place),
      words: place['review'] ? placeWordsState(place as Parameters<typeof placeWordsState>[0]) : null,
    }];
  });

  rows.sort((a, b) => b.ties.length - a.ties.length || a.name.localeCompare(b.name));

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'data/cihof_places.json + data/cihof_place_associations.json',
    rows,
  };
}

/**
 * The places sheet: one row per place, and the decision is whether to show it.
 *
 * Roles are not here. A place carries one approval and a place carries many
 * ties, so a `roles` column on a place row would be a list a curator has to
 * keep in the same order as a list they cannot see. Ties get their own sheet,
 * one row each.
 */
export function placeReviewSheetCsv(sheet: PlaceReviewSheet): string {
  const header = [
    'placeId', 'name', 'band', 'neighborhood', 'tieCount', 'people', 'shortHistory',
    'currentlyReviewed',
    // What an approval of the words as they stand records. The apply tool
    // refuses a row whose version no longer matches the words.
    'contentVersion',
    // The reviewer's. Generated empty, every time. `newHistory` replaces the
    // history with the reviewer's own words, approved as written.
    'approve', 'newHistory', 'decisionReference', 'note',
  ];
  const lines = [header.join(',')];
  for (const row of sheet.rows) {
    lines.push([
      row.placeId, row.name, row.band, row.neighborhood,
      String(row.ties.length),
      row.ties.map((tie) => tie.displayName).join(' | '),
      row.shortHistory.slice(0, 180),
      String(row.reviewed),
      row.contentVersion,
      '', '', '', '',
    ].map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

/**
 * The ties sheet: one row per person-at-a-place, and the decision is the role.
 *
 * `kind` is the verb the archive harvested — `born_in`, `lived_in`, `moved_to`,
 * or the catch-all `associated_with_place`. It is shown because it is a useful
 * prompt and left out of the role column because it is not an answer: being
 * born somewhere is not the claim that you lived there, and
 * `associated_with_place` is forty-four of the eighty-six and says nothing at
 * all about what the person did.
 *
 * Rows are grouped by place so a reviewer works through one place at a time.
 */
export function placeTiesSheetCsv(sheet: PlaceReviewSheet): string {
  const header = [
    'placeId', 'placeName', 'band', 'person', 'displayName', 'harvestedKind', 'currentRole',
    // The reviewer's. Generated empty, every time.
    'role', 'decisionReference', 'note',
  ];
  const lines = [header.join(',')];
  for (const row of sheet.rows) {
    for (const tie of row.ties) {
      lines.push([
        row.placeId, row.name, row.band, tie.person, tie.displayName, tie.kind, tie.role ?? '',
        '', '', '',
      ].map(csvCell).join(','));
    }
  }
  return `${lines.join('\n')}\n`;
}

/** The roles `placeAssociationProblems` will accept, for the sheet's own guidance. */
export const placeRoles: readonly string[] = [
  'lived', 'worked', 'studied', 'taught', 'organized', 'served', 'founded',
];

// ------------------------------------------------------------ proposed ties

/**
 * A tie the HOF World corpus proposes between two inductees, as a row to decide.
 *
 * Grouped by pair and corpus category, the same way the preview draws them, so
 * a row here is a line on the preview map. Where the corpus recorded the same
 * tie from both ends, both passages are kept: the second is often the one that
 * settles it.
 */
export type ProposedTieRow = {
  /** The preview's id for this tie, so a row can be found on the map. */
  readonly tieId: string;
  readonly corpusIds: readonly string[];
  readonly personA: string;
  readonly personAName: string;
  readonly personB: string;
  readonly personBName: string;
  readonly sourceType: string;
  /** A kind the corpus category plainly maps to, as a prompt. Never a decision. */
  readonly suggestedKind: string;
  readonly verificationLayer: string;
  readonly evidence: readonly string[];
  readonly sourceUrls: readonly string[];
  /** What has been decided so far: `unreviewed`, or the decision on file. */
  readonly currentStatus: string;
};

/**
 * Only the categories that name a relationship outright get a suggestion.
 * "Named in a profile" and "ceremony connection" are mostly two people in the
 * same caption or on the same stage; suggesting a kind for those would be the
 * sheet deciding for the reviewer.
 */
const suggestedKinds: Record<string, string> = {
  collaborator: 'collaborated-with',
  family_spouse: 'family-of',
  family_relationship: 'family-of',
  friend: 'friend-of',
};

export function buildProposedTiesSheet(
  connections: readonly CorpusConnectionLike[],
  people: readonly PublishedPerson[],
  decisions: readonly { readonly corpusIds: readonly string[]; readonly decision: string }[] = [],
): ProposedTieRow[] {
  const decidedAs = new Map<string, string>();
  for (const decision of decisions) for (const id of decision.corpusIds) decidedAs.set(id, decision.decision);
  const nameOf = new Map<string, string>(people.map((person) => [person.id as string, person.name]));
  const grouped = new Map<string, {
    first: CorpusConnectionLike; corpusIds: string[]; evidence: string[]; sourceUrls: string[];
  }>();

  for (const connection of connections) {
    if (!nameOf.has(connection.from) || !nameOf.has(connection.to)) continue;
    const key = `${[connection.from, connection.to].sort().join('|')}|${connection.sourceType}`;
    const group = grouped.get(key) ?? { first: connection, corpusIds: [], evidence: [], sourceUrls: [] };
    group.corpusIds.push(connection.id);
    if (connection.evidence && !group.evidence.includes(connection.evidence)) group.evidence.push(connection.evidence);
    if (connection.sourceUrl && !group.sourceUrls.includes(connection.sourceUrl)) group.sourceUrls.push(connection.sourceUrl);
    grouped.set(key, group);
  }

  const rows = [...grouped.values()].map(({ first, corpusIds, evidence, sourceUrls }): ProposedTieRow => ({
    tieId: `preview:${first.id}`,
    corpusIds,
    personA: first.from,
    personAName: nameOf.get(first.from) ?? first.from,
    personB: first.to,
    personBName: nameOf.get(first.to) ?? first.to,
    sourceType: first.sourceType,
    suggestedKind: suggestedKinds[first.sourceType] ?? '',
    verificationLayer: first.verificationLayer,
    evidence,
    sourceUrls,
    currentStatus: corpusIds.map((id) => decidedAs.get(id)).find(Boolean) ?? 'unreviewed',
  }));

  // The rows that name a relationship outright first, so a reviewer starts with
  // the decisions most likely to be quick, then one category at a time.
  return rows.sort((a, b) =>
    Number(b.suggestedKind !== '') - Number(a.suggestedKind !== '')
    || a.sourceType.localeCompare(b.sourceType)
    || a.personAName.localeCompare(b.personAName)
    || a.personBName.localeCompare(b.personBName));
}

/** The shape `readCorpusConnections` returns, without importing a source reader here. */
export type CorpusConnectionLike = {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly sourceType: string;
  readonly evidence: string;
  readonly sourceUrl: string;
  readonly verificationLayer: string;
};

/**
 * One row per proposed tie. The reviewer's columns are last and generated empty.
 *
 *   decision           relationship | context | reject
 *   kind               for a relationship: one of `relationshipKinds`
 *   label              how it reads from person A: "married Ramesh Shah"
 *   inverseLabel       how it reads from person B; required when the kind is directional
 *   decisionReference  who decided and when, e.g. ties-review-2026-09-25
 *
 * "context" is for two people who appear together — a caption, a stage, a
 * session — where no source says their work touched. It keeps the pairing
 * without claiming a relationship.
 */
export function proposedTiesSheetCsv(rows: readonly ProposedTieRow[]): string {
  const header = [
    'tieId', 'personA', 'personAName', 'personB', 'personBName',
    'sourceType', 'suggestedKind', 'verificationLayer', 'evidence', 'sourceUrls', 'corpusIds', 'currentStatus',
    // The reviewer's. Generated empty, every time.
    'decision', 'kind', 'label', 'inverseLabel', 'decisionReference', 'note',
  ];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push([
      row.tieId, row.personA, row.personAName, row.personB, row.personBName,
      row.sourceType, row.suggestedKind, row.verificationLayer,
      row.evidence.join(' || '), row.sourceUrls.join(' '), row.corpusIds.join(' '), row.currentStatus,
      '', '', '', '', '', '',
    ].map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Every column the reviewer owns. All of them count as review work, including a
 * half-done row with only a note or an inverse label, so regenerating the sheet
 * can never discard anything somebody typed.
 */
export const proposedTieReviewerColumns: readonly string[] = [
  'decision', 'kind', 'label', 'inverseLabel', 'decisionReference', 'note',
];

/** Relationship kinds the model accepts, for the sheet's own guidance. */
export const relationshipKinds: readonly string[] = [
  'collaborated-with', 'founded-with', 'mentored', 'taught', 'succeeded', 'employed', 'family-of', 'friend-of', 'nominated',
];
