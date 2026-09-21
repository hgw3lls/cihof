import type {
  CrosswalkCandidate, CrosswalkEntry, InducteeId, InductionCrosswalk,
} from '@cihof/content';
import { inducteeId, slugify } from '../identity.ts';
import { readCuratedRoster } from '../sources/curated.ts';
import { readRoster } from '../sources/manifest.ts';

/**
 * Builds the induction crosswalk a curator resolves.
 *
 * Candidates are produced by normalising both strings and comparing them. That
 * is a prompt, not a finding, and it is the reason every candidate carries its
 * basis: a reviewer confirming "Sam Miller" has to be told that the software's
 * only reason for suggesting that person is that the letters matched.
 *
 * A name matching more than one inductee produces several candidates rather
 * than a winner. Picking one by some tiebreak would manufacture exactly the
 * identity this pipeline refuses to assert.
 */

const honorifics = /^(?:the\s+)?(dr|mr|mrs|ms|miss|fr|rev|sr|msgr|prof|sen|rep|hon|judge|bishop|archbishop|cardinal|amb|gov|mayor|councilman|councilwoman)\.?\s+/;

/** Case, accents, punctuation and honorifics removed. Nothing else. */
export function normalizeForCandidates(value: string): string {
  let text = value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  // Titles can stack: "the hon. dr. ...". Strip them until none is left.
  for (let pass = 0; pass < 4 && honorifics.test(text); pass += 1) text = text.replace(honorifics, '');
  return text.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export type CrosswalkRefresh = {
  readonly crosswalk: InductionCrosswalk;
  /** Names in the roster that were not in the previous file. */
  readonly added: readonly string[];
  /**
   * Previously resolved names no longer present in the roster.
   *
   * Reported rather than silently dropped: a curator's decision disappearing
   * without a word is how review work gets quietly redone.
   */
  readonly droppedResolved: readonly string[];
};

export function buildInductionCrosswalk(previous?: InductionCrosswalk): CrosswalkRefresh {
  const curated = readCuratedRoster();
  const roster = readRoster();

  // Display names by normalised form. A name shared by two inductees maps to
  // both; the reviewer is shown both and picks.
  const byNormalisedName = new Map<string, CrosswalkCandidate[]>();
  const knownIds = new Set<string>();
  for (const row of roster) {
    const id = inducteeId(row.name, row.classYear);
    const record = curated.get(id);
    if (!record) continue;
    knownIds.add(id);
    const displayName = record.displayName || row.name;
    // Both spellings are indexed: four ids were derived from a roster name that
    // `displayName` no longer reproduces, so either may be what a reviewer typed.
    for (const spelling of new Set([displayName, row.name])) {
      const key = normalizeForCandidates(spelling);
      if (!key) continue;
      const bucket = byNormalisedName.get(key) ?? [];
      if (!bucket.some((candidate) => candidate.inducteeId === id)) {
        bucket.push({ inducteeId: id as InducteeId, displayName, basis: 'normalised-name' });
      }
      byNormalisedName.set(key, bucket);
    }
  }

  // Group roster rows by the inducter name exactly as recorded.
  const inductedBy = new Map<string, InducteeId[]>();
  for (const row of roster) {
    const recorded = row.inductedBy.trim();
    if (!recorded) continue;
    const id = inducteeId(row.name, row.classYear);
    if (!knownIds.has(id)) continue;
    const bucket = inductedBy.get(recorded) ?? [];
    bucket.push(id as InducteeId);
    inductedBy.set(recorded, bucket);
  }

  const kept = new Map(
    (previous?.entries ?? []).map((entry) => [entry.recordedName, entry] as const),
  );

  const entries: CrosswalkEntry[] = [];
  const added: string[] = [];
  for (const [recordedName, inducted] of [...inductedBy].sort(byFrequencyThenName)) {
    const existing = kept.get(recordedName);
    if (!existing) added.push(recordedName);
    const resolution = existing?.resolution ?? { status: 'unresolved' as const };
    entries.push({
      id: `inducter:${slugify(recordedName) || 'unnamed'}`,
      recordedName,
      inducted: [...inducted].sort(),
      candidates: byNormalisedName.get(normalizeForCandidates(recordedName)) ?? [],
      // A resolution pointing at somebody no longer on the roster is stale and
      // is sent back for review rather than carried forward as though it held.
      resolution: resolution.status === 'inductee' && !knownIds.has(resolution.inducteeId)
        ? { status: 'unresolved' }
        : resolution,
    });
  }

  const droppedResolved = [...kept.values()]
    .filter((entry) => entry.resolution.status !== 'unresolved' && !inductedBy.has(entry.recordedName))
    .map((entry) => entry.recordedName);

  const crosswalk: InductionCrosswalk = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'data/cihof_kiosk_manifest.csv#inducted_by',
    ...(previous?.publicationDecision === undefined
      ? {}
      : { publicationDecision: previous.publicationDecision }),
    entries,
  };

  return { crosswalk, added, droppedResolved };
}

function byFrequencyThenName(
  [nameA, a]: readonly [string, readonly InducteeId[]],
  [nameB, b]: readonly [string, readonly InducteeId[]],
): number {
  return b.length - a.length || nameA.localeCompare(nameB);
}
