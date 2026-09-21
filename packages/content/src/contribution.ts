/**
 * What a person changed.
 *
 * This is the record the collection does not yet have, and the one four other
 * ways of exploring it are waiting on. Today a visitor who selects someone
 * reaches `honoredForSummary` — "Contributions to arts and culture, diplomacy
 * and global affairs…" — which is machine-composed from tags for all 111
 * people. It is a category, not an account. Nothing in it can be followed,
 * dated, placed on a map, or set beside another life.
 *
 * A contribution is that account, in the shape a visitor can follow:
 *
 *   person -> action -> what it produced -> where it can still be seen
 *
 * Not every record will carry every step. A contribution with an action and a
 * date and nothing else is honest; a contribution with an honorific and no
 * outcome is the thing this type exists to replace.
 */

import { substantiationProblems, type Evidenced } from './evidence.ts';
import type { ContributionId, InducteeId } from './identity.ts';
import { isPublished, type Reviewed, type VisitorTarget } from './publication.ts';
import { isAttributable, type AttributedText } from './text.ts';
import { startYearOrNull, type Timespan } from './time.ts';

/** What an action produced. `person` covers someone the work reached. */
export type OutcomeKind =
  | 'organization'
  | 'place'
  | 'program'
  | 'policy'
  | 'practice'
  | 'publication'
  | 'event'
  | 'person';

export type Outcome = {
  readonly kind: OutcomeKind;
  /** A canonical entity id where one exists, so the outcome is navigable. */
  readonly id?: string;
  /** What it is called. Present even when there is no entity to link to. */
  readonly name: string;
  readonly note?: string;
};

export type Contribution = Reviewed & Evidenced & {
  readonly id: ContributionId;
  readonly subject: InducteeId;
  /**
   * What the person did, as a verb.
   *
   * "Founded the Slovenian National Home's language school" — not
   * "distinguished community leader". The provenance travels with it so a
   * renderer cannot present a generated line as a curator's account.
   */
  readonly action: AttributedText;
  readonly occurred: Timespan;
  /** What the action produced or changed. Empty is allowed and means unknown. */
  readonly outcomes: readonly Outcome[];
  /** Where the contribution can still be seen. The "continuing legacy" step. */
  readonly stillVisibleAt?: readonly Outcome[];
};

/**
 * A contribution that names nothing is an honorific.
 *
 * The interesting screen — the one the whole design rests on — is the one that
 * turns a description into a thing: an organisation, a street, a programme.
 * This is the test for whether a record can carry that screen.
 */
export function isSpecific(contribution: Contribution): boolean {
  return contribution.outcomes.length > 0 && isAttributable(contribution.action);
}

export function publishedContributions(values: readonly unknown[], target: VisitorTarget): Contribution[] {
  return values.filter((value): value is Contribution => {
    if (!isPublished(value as Partial<Reviewed>, target)) return false;
    return contributionProblems(value).length === 0;
  });
}

export function contributionsFor(
  subject: InducteeId,
  contributions: readonly Contribution[],
): Contribution[] {
  return contributions.filter((contribution) => contribution.subject === subject);
}

export type ChangeChain = {
  readonly subject: InducteeId;
  readonly steps: readonly Contribution[];
  /** How many published contributions were left out of `steps`. */
  readonly remaining: number;
};

/**
 * The short sequence behind one portrait.
 *
 * Capped, because three well-explained steps read better than a screen of
 * lines, and the cap is reported rather than hidden so the record can offer a
 * way through to the rest.
 *
 * Ordered by when the work happened. Undated contributions sort last and are
 * still included: an undated record is not an absent one, and with this
 * collection's dating it would otherwise be most of them.
 */
export function changeChain(
  subject: InducteeId,
  contributions: readonly Contribution[],
  limit = 3,
): ChangeChain {
  const mine = contributionsFor(subject, contributions);
  const ordered = [...mine].sort(byOccurrenceThenSpecificity);
  return { subject, steps: ordered.slice(0, limit), remaining: Math.max(0, ordered.length - limit) };
}

/** Why a contribution is not publishable, for the staff review view. */
export function contributionProblems(value: unknown): string[] {
  const candidate = value as Partial<Contribution>;
  if (!candidate || typeof candidate !== 'object') return ['record is missing'];
  const problems = substantiationProblems(candidate);
  if (!nonEmpty(candidate.id)) problems.push('no id');
  if (!nonEmpty(candidate.subject)) problems.push('no subject');

  const action = candidate.action;
  if (!action || !nonEmpty(action.text)) problems.push('no action');
  else if (!isAttributable(action)) problems.push(`action is ${action.provenance}, so it is nobody's account`);

  if (!candidate.occurred) problems.push('no date record, not even an explicit unknown');
  if (!Array.isArray(candidate.outcomes)) problems.push('no outcome list');
  else {
    const unnamed = candidate.outcomes.filter((outcome) => !nonEmpty(outcome?.name)).length;
    if (unnamed > 0) problems.push(`${unnamed} outcome(s) with no name`);
  }
  return problems;
}

function byOccurrenceThenSpecificity(a: Contribution, b: Contribution): number {
  const yearA = startYearOrNull(a.occurred);
  const yearB = startYearOrNull(b.occurred);
  if (yearA !== null && yearB !== null && yearA !== yearB) return yearA - yearB;
  if (yearA === null && yearB !== null) return 1;
  if (yearA !== null && yearB === null) return -1;
  // Same year, or both undated: the one that names something comes first.
  return Number(isSpecific(b)) - Number(isSpecific(a));
}

function nonEmpty(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
