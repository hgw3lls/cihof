import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { PublishedPerson } from '@cihof/content';
import { dataFile, repoFile } from '../paths.ts';

/**
 * Parity against the record the old pipeline published.
 *
 * A generator can silently drop a curatorial decision, and nothing about the
 * output would look wrong. So every visible field of every person is compared
 * with the last record the old pipeline published, frozen in
 * `packages/pipeline/reference/published-runtime-data.json`. Each difference
 * must be recorded in `data/cihof_reviewed_differences.json` with the decision
 * that made it. Anything not recorded fails `npm test`.
 *
 * The apply tools record the differences their own sheet makes, with that
 * sheet's decision reference, and only for the people it changed. A difference
 * nobody decided, a generator regression, stays unrecorded and still fails.
 *
 * The frozen record is never re-snapshotted. Doing that to make the test pass
 * would discard exactly the evidence it exists to keep.
 */

export const publishedRecordPath = () => repoFile('packages/pipeline/reference/published-runtime-data.json');
export const reviewedDifferencesPath = () => dataFile('cihof_reviewed_differences.json');

export type ReviewedDifference = {
  /** The difference exactly as `collectDifferences` words it. */
  readonly difference: string;
  readonly decisionReference: string;
  readonly note?: string;
  readonly recordedAt?: string;
};

export type ReviewedDifferences = {
  readonly schemaVersion: 1;
  readonly note: string;
  readonly differences: readonly ReviewedDifference[];
};

type PublishedRecord = Record<string, unknown>;

export function readPublishedRecord(): PublishedRecord[] {
  return (JSON.parse(readFileSync(publishedRecordPath(), 'utf8')) as { inductees: PublishedRecord[] }).inductees;
}

export function readReviewedDifferences(): ReviewedDifferences {
  if (!existsSync(reviewedDifferencesPath())) return emptyLedger();
  return JSON.parse(readFileSync(reviewedDifferencesPath(), 'utf8')) as ReviewedDifferences;
}

export function emptyLedger(): ReviewedDifferences {
  return {
    schemaVersion: 1,
    note: 'Differences from the frozen published record that a decision made. Written by the apply tools and npm run parity:record; read by packages/pipeline/tests/parity.test.ts.',
    differences: [],
  };
}

/** The person a difference is about: the text before the first "." or ":". */
export function differenceSubject(difference: string): string {
  return /^[^.:]+/.exec(difference)?.[0] ?? '';
}

/**
 * Every way the rebuilt people differ from the published record, one line
 * each. A person added since (a new induction class) or no longer present is
 * one line of its own.
 */
export function collectDifferences(
  people: readonly PublishedPerson[],
  published: readonly PublishedRecord[] = readPublishedRecord(),
): string[] {
  const rebuilt = new Map(people.map((person) => [String(person.id), person]));
  const publishedIds = new Set(published.map((person) => String(person['id'])));
  const differences: string[] = [];

  for (const person of published) {
    const id = String(person['id']);
    const next = rebuilt.get(id);
    if (!next) {
      differences.push(`${id}: removed, in the published record but no longer built`);
      continue;
    }

    compare(differences, id, 'name', person['name'], next.name);
    compare(differences, id, 'sortName', person['sortName'], next.sortName);
    compare(differences, id, 'classYear', person['classYear'], next.classYear);
    compare(differences, id, 'profileUrl', person['profileUrl'] || null, next.sourceUrl);
    compare(differences, id, 'primaryImageUrl', person['primaryImageUrl'], next.portrait?.src ?? null);
    compare(differences, id, 'imageRightsStatus', person['imageRightsStatus'], next.portrait?.rights ?? null);
    compare(differences, id, 'bioText', String(person['bioText'] ?? '').trim(), next.biography?.text ?? '');
    compare(differences, id, 'honoredForSummary', String(person['honoredForSummary'] ?? '').trim(), next.contribution?.text ?? '');
    compare(differences, id, 'documentedContextLine', String(person['documentedContextLine'] ?? '').trim(), next.context?.text ?? '');
    compareList(differences, id, 'themeTags', person['themeTags'], next.contributions.values);
    compareList(differences, id, 'communityTags', person['communityTags'], next.communities.values);
    compareList(differences, id, 'countryTags', person['countryTags'], next.countries.values);
  }

  for (const id of rebuilt.keys()) {
    if (!publishedIds.has(id)) differences.push(`${id}: added, not in the published record`);
  }

  return differences;
}

/**
 * Sets the differences against what is recorded.
 *
 * `unrecorded`: differences nobody has recorded a decision for.
 * `stale`: recorded differences that no longer occur. Each was fixed, reverted
 * or superseded, and keeping it would quietly excuse a later regression that
 * happened to read the same way.
 */
export function reconcile(differences: readonly string[], ledger: ReviewedDifferences) {
  const current = new Set(differences);
  const recorded = new Set(ledger.differences.map((entry) => entry.difference));
  return {
    unrecorded: differences.filter((difference) => !recorded.has(difference)),
    stale: ledger.differences.filter((entry) => !current.has(entry.difference)),
  };
}

/**
 * The ledger after a decision about some people: their unrecorded differences
 * are recorded under the decision's reference, and their stale entries are
 * removed. Everybody else's entries are left exactly as they were, so one
 * sheet can never excuse a difference it did not make.
 */
export function recordDecision(
  ledger: ReviewedDifferences,
  differences: readonly string[],
  decision: { readonly ids: ReadonlySet<string>; readonly decisionReference: string; readonly note?: string; readonly recordedAt: string },
) {
  const { unrecorded, stale } = reconcile(differences, ledger);
  const concerns = (difference: string) => decision.ids.has(differenceSubject(difference));
  const added = unrecorded.filter(concerns);
  const removed = stale.filter((entry) => concerns(entry.difference));
  const removedSet = new Set(removed.map((entry) => entry.difference));

  const next: ReviewedDifferences = {
    ...ledger,
    differences: [
      ...ledger.differences.filter((entry) => !removedSet.has(entry.difference)),
      ...added.map((difference) => ({
        difference,
        decisionReference: decision.decisionReference,
        ...(decision.note ? { note: decision.note } : {}),
        recordedAt: decision.recordedAt,
      })),
    ].sort((a, b) => a.difference.localeCompare(b.difference)),
  };
  return {
    ledger: next,
    added,
    removed: removed.map((entry) => entry.difference),
    /** Unrecorded differences about people this decision did not touch. */
    elsewhere: unrecorded.filter((difference) => !concerns(difference)),
  };
}

export function ledgerJson(ledger: ReviewedDifferences): string {
  return `${JSON.stringify(ledger, null, 2)}\n`;
}

function compare(into: string[], id: string, field: string, before: unknown, after: unknown) {
  if (String(before ?? '') !== String(after ?? '')) {
    const shown = JSON.stringify(after) ?? '';
    // Long text is cut to keep a line readable. The fingerprint of the whole
    // rebuilt value keeps a second edit past the cut from matching the entry
    // recorded for the first.
    const fingerprint = shown.length > 70 ? ` #${createHash('sha256').update(shown).digest('hex').slice(0, 10)}` : '';
    into.push(`${id}.${field}: published ${JSON.stringify(before)?.slice(0, 70)} -> rebuilt ${shown.slice(0, 70)}${fingerprint}`);
  }
}

function compareList(into: string[], id: string, field: string, before: unknown, after: readonly string[]) {
  const a = Array.isArray(before) ? before.map(String) : [];
  if (a.join('|') !== after.join('|')) {
    into.push(`${id}.${field}: published [${a.join(', ')}] -> rebuilt [${after.join(', ')}]`);
  }
}
