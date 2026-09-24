import { isApproved, type PublishedPlace, type Review } from '@cihof/content';
import type { CorpusConnection } from '../sources/corpus.ts';

/**
 * What a preview build adds, and how it says so.
 *
 * A preview shows an editor everything the sources propose — places nobody has
 * reviewed, ties the corpus suggests — so they can see it in place and decide
 * what stays. It changes no review state: every record it adds is marked
 * `unreviewed`, carries a `needs-review` status and is published to nobody, and
 * the only way any of it reaches a visitor is a real decision recorded through
 * the review sheets. `buildRuntimeBundle` refuses a public preview outright and
 * `assert:public` refuses any artifact that carries one.
 */

/** A tie the corpus proposes between two people, shown only in preview. */
export type PreviewTie = {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly sourceType: string;
  /**
   * How the tie reads, from either end. Worded from the corpus's own category
   * and the same both ways: nobody has decided which way these read, so the
   * preview does not guess.
   */
  readonly label: string;
  readonly evidence: string;
  readonly sourceUrl: string;
  readonly unreviewed: true;
};

/** A place as the runtime shows it. Preview places are marked. */
export type RuntimePlace = PublishedPlace & { readonly unreviewed?: true };

const sourceTypeWording: Record<string, string> = {
  documented_mention: 'named in a profile',
  ceremonial_connection: 'ceremony connection',
  collaborator: 'collaborator',
  family_spouse: 'spouse',
  family_relationship: 'family',
  friend: 'friend',
  electoral_relationship: 'electoral contest',
  public_service_relationship: 'public service',
  joint_oral_history_participant: 'same oral-history session',
};

export function previewTies(connections: readonly CorpusConnection[], published: ReadonlySet<string>): PreviewTie[] {
  const seen = new Set<string>();
  const ties: PreviewTie[] = [];
  for (const connection of connections) {
    // A tie to somebody this release does not show is a dead end on the map.
    if (!published.has(connection.from) || !published.has(connection.to)) continue;
    const pair = [connection.from, connection.to].sort().join('|');
    const key = `${pair}|${connection.sourceType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    ties.push({
      id: `preview:${connection.id}`,
      from: connection.from,
      to: connection.to,
      sourceType: connection.sourceType,
      label: sourceTypeWording[connection.sourceType] ?? connection.sourceType.replace(/_/g, ' '),
      evidence: connection.evidence,
      sourceUrl: connection.sourceUrl,
      unreviewed: true,
    });
  }
  return ties;
}

/**
 * Every seeded place, with every seeded tie, marked unreviewed.
 *
 * Reviewed places pass through as they are. The rest take a `needs-review`
 * status and a publication naming no audience, so the record states exactly
 * what it is rather than borrowing the shape of an approval.
 */
export function previewPlaces(
  seeds: readonly unknown[],
  associations: readonly unknown[],
  reviewed: readonly PublishedPlace[],
  published: ReadonlySet<string>,
): RuntimePlace[] {
  const reviewedIds = new Set(reviewed.map((place) => place.id));
  const peopleByPlace = new Map<string, string[]>();
  for (const value of associations) {
    const association = value as { person?: unknown; place?: unknown };
    if (typeof association.person !== 'string' || typeof association.place !== 'string') continue;
    if (!published.has(association.person)) continue;
    const list = peopleByPlace.get(association.place) ?? [];
    if (!list.includes(association.person)) list.push(association.person);
    peopleByPlace.set(association.place, list);
  }

  const unreviewed: RuntimePlace[] = [];
  for (const value of seeds) {
    const seed = value as {
      id?: unknown; name?: unknown; shortHistory?: unknown; neighborhood?: unknown;
      related?: { people?: unknown }; review?: Review;
    };
    if (typeof seed.id !== 'string' || typeof seed.name !== 'string' || reviewedIds.has(seed.id)) continue;
    // A place somebody has decided about is not unreviewed, whatever audience
    // the decision named. One approved for the web only, or withheld, stays out
    // of a kiosk preview rather than reappearing marked as never reviewed.
    if (isApproved(seed.review) || seed.review?.status === 'withheld') continue;
    const related = Array.isArray(seed.related?.people)
      ? seed.related.people.filter((id): id is string => typeof id === 'string' && published.has(id))
      : [];
    unreviewed.push({
      id: seed.id,
      name: seed.name,
      shortHistory: typeof seed.shortHistory === 'string' ? seed.shortHistory : '',
      neighborhood: typeof seed.neighborhood === 'string' ? seed.neighborhood : '',
      personIds: peopleByPlace.get(seed.id) ?? related,
      review: { status: 'needs-review' },
      publication: { publicWeb: false, kiosk: false },
      unreviewed: true,
    });
  }
  return [...reviewed, ...unreviewed];
}
