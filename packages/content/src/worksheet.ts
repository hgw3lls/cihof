/**
 * The sheet a curator writes contributions into.
 *
 * The induction crosswalk resolves a name somebody already wrote down. This is
 * the harder sibling: nothing exists to resolve, because no record says what
 * any of these 111 people actually changed. What the exhibit shows today is
 * composed from tags — "Contributions to arts and culture, diplomacy and global
 * affairs" — for every one of them, which is a category rather than an account.
 *
 * So this sheet does not offer candidates and it never drafts an action. The
 * one thing it can honestly do is put the institution's own biography in front
 * of the person writing, mark whose row is still empty, and refuse to call a
 * row finished when what it holds is another honorific.
 */

import type { Contribution } from './contribution.ts';
import { contributionProblems, isSpecific } from './contribution.ts';
import type { InducteeId } from './identity.ts';

export type WorksheetStatus =
  /** Nobody has written anything for this person yet. */
  | 'not-started'
  /** Being written; not ready for review. */
  | 'in-progress'
  /** Offered for review. */
  | 'ready-for-review'
  /**
   * Looked for, and there is nothing to write from.
   *
   * A real answer, and the one that keeps an empty row from being read as
   * unfinished work for ever.
   */
  | 'nothing-documented';

export type WorksheetEntry = {
  readonly subject: InducteeId;
  readonly displayName: string;
  readonly classYear: number | null;
  /**
   * The institution's own biography, copied here as raw material.
   *
   * Read-only: this sheet is not where the biography is edited, and a change
   * made here is discarded the next time the sheet is regenerated.
   */
  readonly sourceBiography: string;
  /** What a visitor currently reads, so the gap is visible while writing. */
  readonly currentSummary: string;
  readonly status: WorksheetStatus;
  readonly contributions: readonly Contribution[];
};

export type ContributionWorksheet = {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly source: string;
  readonly entries: readonly WorksheetEntry[];
};

export type WorksheetProgress = {
  readonly people: number;
  readonly notStarted: number;
  readonly inProgress: number;
  readonly readyForReview: number;
  readonly nothingDocumented: number;
  /** Contributions written, whatever their state. */
  readonly written: number;
  /** Of those, the ones that name something a visitor could follow. */
  readonly specific: number;
  /** Rows offered for review whose contributions are not yet publishable. */
  readonly readyButIncomplete: number;
};

export function worksheetProgress(worksheet: ContributionWorksheet): WorksheetProgress {
  let notStarted = 0;
  let inProgress = 0;
  let readyForReview = 0;
  let nothingDocumented = 0;
  let written = 0;
  let specific = 0;
  let readyButIncomplete = 0;

  for (const entry of worksheet.entries) {
    if (entry.status === 'not-started') notStarted += 1;
    else if (entry.status === 'in-progress') inProgress += 1;
    else if (entry.status === 'nothing-documented') nothingDocumented += 1;
    else readyForReview += 1;

    written += entry.contributions.length;
    specific += entry.contributions.filter(isSpecific).length;

    if (entry.status === 'ready-for-review' && entryProblems(entry).length > 0) readyButIncomplete += 1;
  }

  return {
    people: worksheet.entries.length,
    notStarted, inProgress, readyForReview, nothingDocumented,
    written, specific, readyButIncomplete,
  };
}

/**
 * What is wrong with a row, in the words of the person who has to fix it.
 *
 * A row marked ready with nothing in it, or with an honorific where an account
 * should be, is the failure this catches: it would otherwise sit in the sheet
 * looking finished.
 */
export function entryProblems(entry: WorksheetEntry): string[] {
  const problems: string[] = [];
  if (entry.status !== 'ready-for-review') return problems;

  if (entry.contributions.length === 0) {
    problems.push('marked ready with no contribution written');
    return problems;
  }

  entry.contributions.forEach((contribution, index) => {
    if (contribution.subject !== entry.subject) {
      problems.push(`contribution ${index + 1} names a different person`);
    }
    for (const problem of contributionProblems(contribution)) {
      problems.push(`contribution ${index + 1}: ${problem}`);
    }
    if (!isSpecific(contribution)) {
      problems.push(`contribution ${index + 1} names nothing a visitor could follow`);
    }
  });

  return problems;
}

/** Every contribution across the sheet, for the build to filter by target. */
export function worksheetContributions(worksheet: ContributionWorksheet): Contribution[] {
  return worksheet.entries.flatMap((entry) => [...entry.contributions]);
}

/** Rows still to write, the longest-standing first: people with no film either. */
export function unwrittenEntries(worksheet: ContributionWorksheet): WorksheetEntry[] {
  return worksheet.entries.filter((entry) => entry.status === 'not-started');
}
