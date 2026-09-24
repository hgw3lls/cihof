import { readFileSync } from 'node:fs';
import { dataFile } from '../paths.ts';

/**
 * Induction relationships from the HOF World corpus.
 *
 * The file carries its own scope note, and it is worth repeating here because
 * it decides how this data may be used: "Verified" means explicit documentary
 * evidence inside the canonical CIHOF corpus — a profile field, a source line,
 * an exact biography mention — and is "not a claim of independent external
 * historical verification". The induction lineage adds that its edges "should
 * be source-verified against ceremony/program records before being presented
 * as fully verified historical facts".
 *
 * So nothing here is promoted to a resolution. It becomes a candidate with the
 * source's own words attached, which is what a reviewer needs to confirm one.
 */
export type CorpusInduction = {
  /** The person who was inducted. */
  readonly honoreeId: string;
  /** The person recorded as inducting them. */
  readonly presenterId: string;
  readonly evidence: string;
  readonly sourceUrl: string;
  readonly verificationLayer: string;
};

const inductionTypes = new Set(['inducted_by', 'inducted_by_or_induction_connection']);

export function readCorpusInductions(): CorpusInduction[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(dataFile('hof_world_person_relationships.json'), 'utf8'));
  } catch {
    return [];
  }
  const rows = (parsed as { relationships?: unknown[] }).relationships;
  if (!Array.isArray(rows)) return [];

  const inductions: CorpusInduction[] = [];
  for (const value of rows) {
    const row = value as Record<string, unknown>;
    if (!inductionTypes.has(String(row['relationshipType']))) continue;
    const honoreeId = text(row['sourcePersonId']);
    const presenterId = text(row['targetPersonId']);
    if (!honoreeId || !presenterId || honoreeId === presenterId) continue;
    inductions.push({
      honoreeId,
      presenterId,
      evidence: text(row['evidence']),
      sourceUrl: firstUrl(row['sourceUrls']),
      verificationLayer: text(row['verificationLayer']),
    });
  }
  return inductions;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function firstUrl(value: unknown): string {
  return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : '';
}

/**
 * Every other person-to-person row in the HOF World corpus.
 *
 * None of these carries a review, and several are plainly photo captions read
 * as ties, so nothing here can reach a visitor. Preview builds show them marked
 * as unreviewed so an editor can see what the corpus proposes and decide.
 */
export type CorpusConnection = {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  /** The corpus's own classification, e.g. `documented_mention`. */
  readonly sourceType: string;
  readonly evidence: string;
  readonly sourceUrl: string;
  readonly verificationLayer: string;
};

export function readCorpusConnections(): CorpusConnection[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(dataFile('hof_world_person_relationships.json'), 'utf8'));
  } catch {
    return [];
  }
  const rows = (parsed as { relationships?: unknown[] }).relationships;
  if (!Array.isArray(rows)) return [];

  const connections: CorpusConnection[] = [];
  for (const value of rows) {
    const row = value as Record<string, unknown>;
    const sourceType = text(row['relationshipType']);
    if (!sourceType || inductionTypes.has(sourceType)) continue;
    const from = text(row['sourcePersonId']);
    const to = text(row['targetPersonId']);
    if (!from || !to || from === to) continue;
    connections.push({
      id: text(row['id']) || `${from}|${to}|${sourceType}`,
      from,
      to,
      sourceType,
      evidence: text(row['evidence']),
      sourceUrl: firstUrl(row['sourceUrls']),
      verificationLayer: text(row['verificationLayer']),
    });
  }
  return connections;
}
