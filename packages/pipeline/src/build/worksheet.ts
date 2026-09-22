import type { ContributionWorksheet, InducteeId, PublishedPerson, WorksheetEntry } from '@cihof/content';
import { isAttributable } from '@cihof/content';

/**
 * Builds the contribution worksheet, preserving everything already written.
 *
 * Regeneration only ever refreshes the reference columns — the biography and
 * the current summary, which come from the canonical sources — and adds rows
 * for people who were not there before. A status and a written contribution
 * belong to whoever wrote them and are copied across untouched.
 */
export type WorksheetRefresh = {
  readonly worksheet: ContributionWorksheet;
  readonly added: readonly InducteeId[];
  /**
   * Written rows whose subject is no longer on the roster.
   *
   * Reported rather than dropped: somebody wrote those and they are not this
   * script's to discard.
   */
  readonly orphaned: readonly InducteeId[];
};

export function buildContributionWorksheet(
  people: readonly PublishedPerson[],
  previous?: ContributionWorksheet,
): WorksheetRefresh {
  const kept = new Map((previous?.entries ?? []).map((entry) => [entry.subject, entry] as const));
  const roster = new Set(people.map((person) => person.id));

  const entries: WorksheetEntry[] = [];
  const added: InducteeId[] = [];

  for (const person of people) {
    const existing = kept.get(person.id);
    if (!existing) added.push(person.id);

    // Only prose somebody stands behind is offered as raw material. A
    // generated line is what this sheet exists to replace, so putting it in
    // front of the writer as source would invite it straight back in.
    const source = person.biography;
    const biography = source && isAttributable(source) ? source.text : '';

    entries.push({
      subject: person.id,
      displayName: person.name,
      classYear: person.classYear,
      sourceBiography: biography,
      currentSummary: person.contribution?.text ?? '',
      status: existing?.status ?? 'not-started',
      contributions: existing?.contributions ?? [],
    });
  }

  const orphaned = [...kept.values()]
    .filter((entry) => !roster.has(entry.subject))
    .filter((entry) => entry.contributions.length > 0 || entry.status !== 'not-started')
    .map((entry) => entry.subject);

  return {
    worksheet: {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      source: 'data/cihof_kiosk_manifest.csv + data/cihof_curated_metadata.json',
      entries,
    },
    added,
    orphaned,
  };
}
