import { labelFrom, type PublishedRelationship } from '@cihof/content';
import type { PreviewTie } from '@cihof/pipeline';
import type { RuntimePerson } from '../data/runtime.ts';
import type { Discovery } from './exhibit.ts';

/**
 * Discovery narrows lists. It is applied where a visitor is choosing between
 * people, and nowhere else — a search term must never reach a relationship
 * graph, where filtering the collection empties the very connections the search
 * was meant to help navigate.
 */
export function matching(people: readonly RuntimePerson[], discovery: Discovery): RuntimePerson[] {
  const query = fold(discovery.query);
  return people.filter((person) => {
    if (query && !fold(searchText(person)).includes(query)) return false;
    if (discovery.communities.length > 0 && !discovery.communities.some((value) => person.communities.includes(value))) return false;
    if (discovery.contributions.length > 0 && !discovery.contributions.some((value) => person.contributions.includes(value))) return false;
    if (discovery.years.length > 0 && !discovery.years.includes(person.classYear ?? -1)) return false;
    return true;
  });
}

/** Facet options come from what the collection actually offers, in order. */
export function optionsFor(people: readonly RuntimePerson[], dimension: 'communities' | 'contributions'): string[] {
  return [...new Set(people.flatMap((person) => person[dimension]))].sort((a, b) => a.localeCompare(b));
}

export function yearsIn(people: readonly RuntimePerson[]): number[] {
  return [...new Set(people.map((person) => person.classYear).filter((year): year is number => year !== null))]
    .sort((a, b) => b - a);
}

function searchText(person: RuntimePerson): string {
  // Only tags a reviewer stands behind are searchable; the bundle contains no
  // others, so this cannot accidentally match an inferred label.
  return [person.name, person.sortName, person.classYear, ...person.contributions, ...person.communities, ...person.countries]
    .filter(Boolean).join(' ');
}

function fold(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').trim();
}

export type InductionClass = {
  readonly year: number;
  readonly people: readonly RuntimePerson[];
};

/**
 * The collection by induction class, newest first.
 *
 * Only people with a recorded year appear. Someone undated is not placed in a
 * guessed class — the collection says their year is not recorded, and the
 * chronology says the same by leaving them out of it rather than inventing a
 * home for them.
 */
export function inductionClasses(people: readonly RuntimePerson[]): InductionClass[] {
  const byYear = new Map<number, RuntimePerson[]>();
  for (const person of people) {
    if (person.classYear === null) continue;
    const bucket = byYear.get(person.classYear);
    if (bucket) bucket.push(person); else byYear.set(person.classYear, [person]);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, members]) => ({ year, people: members.slice().sort((a, b) => a.sortName.localeCompare(b.sortName)) }));
}

/** How many people the chronology cannot place, stated rather than hidden. */
export function undatedCount(people: readonly RuntimePerson[]): number {
  return people.filter((person) => person.classYear === null).length;
}

export type Tie = {
  readonly other: RuntimePerson;
  /** How the claim reads outwards from this person. Never composed here. */
  readonly label: string;
  readonly connectionId: string;
  /** A tie the sources propose that nobody has reviewed. Preview builds only. */
  readonly unreviewed?: boolean;
};

export type ConnectionNode = {
  readonly person: RuntimePerson;
  readonly ties: readonly Tie[];
};

/**
 * Documented relationships, gathered per person.
 *
 * Note what this does not take: `Discovery`. Every other selector here narrows
 * a list a visitor is choosing from, and narrowing this one removes the people
 * the graph exists to reach.
 *
 * The one thing that could go wrong silently is direction. Reading a forward
 * label from the far endpoint turns "mentored Ana Ruiz" into Ana Ruiz having
 * mentored her own mentor, and the result is a grammatical sentence stating
 * the opposite of what a curator approved. `labelFrom` returns null rather
 * than guess, and a tie nobody can word is dropped rather than worded wrongly.
 */
export function connectionNodes(
  people: readonly RuntimePerson[],
  relationships: readonly PublishedRelationship[],
  candidates: readonly PreviewTie[] = [],
): ConnectionNode[] {
  const byId = new Map(people.map((person) => [person.id, person]));
  const ties = new Map<string, Tie[]>();

  for (const relationship of relationships) {
    for (const viewpoint of [relationship.from, relationship.to] as readonly string[]) {
      const person = byId.get(viewpoint);
      const other = byId.get(viewpoint === relationship.from ? relationship.to : relationship.from);
      if (!person || !other) continue;

      const label = labelFrom(relationship, viewpoint as typeof relationship.from);
      if (!label) continue;

      const list = ties.get(viewpoint);
      const tie = { other, label, connectionId: relationship.id as string };
      if (list) list.push(tie); else ties.set(viewpoint, [tie]);
    }
  }

  // Proposed ties read the same from both ends, because nobody has decided
  // which way they read. They are marked, and never outrank a reviewed tie.
  for (const candidate of candidates) {
    for (const viewpoint of [candidate.from, candidate.to]) {
      const person = byId.get(viewpoint);
      const other = byId.get(viewpoint === candidate.from ? candidate.to : candidate.from);
      if (!person || !other) continue;
      const list = ties.get(viewpoint);
      const tie = { other, label: candidate.label, connectionId: candidate.id, unreviewed: true };
      if (list) list.push(tie); else ties.set(viewpoint, [tie]);
    }
  }

  return [...ties.entries()]
    .flatMap(([id, list]) => {
      const person = byId.get(id);
      return person ? [{ person, ties: list }] : [];
    })
    .sort((a, b) => b.ties.length - a.ties.length || a.person.sortName.localeCompare(b.person.sortName));
}

export type MapRing = 'focus' | 'tie' | 'cluster' | 'elsewhere';

export type PlacedPerson = {
  readonly person: RuntimePerson;
  /** Unit coordinates, -1..1, origin at the focused person. */
  readonly x: number;
  readonly y: number;
  readonly ring: MapRing;
  /** How this person's tie to the focus reads, when they have one. */
  readonly label: string | null;
  /** True when that tie is only proposed, not reviewed. */
  readonly labelUnreviewed?: boolean;
};

export type PlacedTie = {
  readonly connectionId: string;
  readonly from: string;
  readonly to: string;
  /** Reads from the focused person outwards. Null when neither end is focused. */
  readonly label: string | null;
  readonly touchesFocus: boolean;
  readonly unreviewed: boolean;
};

export type ConnectionMap = {
  readonly focus: RuntimePerson | null;
  readonly placed: readonly PlacedPerson[];
  readonly ties: readonly PlacedTie[];
  /** People sharing a component with the focus, the focus included. */
  readonly clusterSize: number;
  readonly islands: number;
};

/**
 * The collection as a map that recentres on whoever is chosen.
 *
 * The shape of this data decided the shape of the view. It is not a web: 31
 * relationships across 46 people in 16 disconnected components, eleven of them
 * a single pair, the largest eleven people and nobody holding more than four
 * ties. A force-directed cloud of that is a scatter of specks that jitters and
 * never settles, and on a wall it would read as a fault.
 *
 * So the layout is focus and context, and deterministic. The chosen person sits
 * at the centre, the people a source says they touched ring them at arm's
 * length, the rest of their island sits beyond that, and the other islands are
 * pushed to the rim where they stay reachable without competing. Choosing
 * somebody else re-centres the whole thing.
 *
 * Deterministic matters twice over here. A visitor pointing at a portrait and
 * looking back a moment later should find it where it was, and a physics
 * simulation on a display that runs for months is a heater.
 */
export function connectionMap(
  nodes: readonly ConnectionNode[],
  focusId: string | null,
): ConnectionMap {
  if (nodes.length === 0) return { focus: null, placed: [], ties: [], clusterSize: 0, islands: 0 };

  const byId = new Map(nodes.map((node) => [node.person.id, node]));
  // Falling back to the best-connected person means arriving at the lens shows
  // the richest part of the collection rather than an arbitrary corner.
  const chosen = (focusId && byId.get(focusId)) || [...nodes][0]!;

  const neighbours = (id: string) => byId.get(id)?.ties.map((tie) => tie.other.id) ?? [];
  const component = reachableFrom(chosen.person.id, neighbours);

  const direct = new Set(neighbours(chosen.person.id));
  const beyond = [...component].filter((id) => id !== chosen.person.id && !direct.has(id));
  const outside = nodes.filter((node) => !component.has(node.person.id));

  const placed: PlacedPerson[] = [{
    person: chosen.person, x: 0, y: 0, ring: 'focus', label: null,
  }];

  // Ring one: sorted so the same person lands in the same place every time.
  // One place per person. A preview can hold a reviewed and a proposed tie to
  // the same person, and the reviewed wording is the one worth reading.
  const firstTieTo = new Map<string, Tie>();
  for (const tie of chosen.ties) {
    const held = firstTieTo.get(tie.other.id);
    if (!held || (held.unreviewed && !tie.unreviewed)) firstTieTo.set(tie.other.id, tie);
  }
  const ties = [...firstTieTo.values()].sort((a, b) => a.other.sortName.localeCompare(b.other.sortName));
  const angleOf = new Map<string, number>();
  ties.forEach((tie, index) => {
    const angle = (index / Math.max(ties.length, 1)) * Math.PI * 2 - Math.PI / 2;
    angleOf.set(tie.other.id, angle);
    placed.push({
      person: tie.other, x: Math.cos(angle) * 0.54, y: Math.sin(angle) * 0.54,
      ring: 'tie', label: tie.label, labelUnreviewed: tie.unreviewed === true,
    });
  });

  // Ring two: kept near whichever ring-one person introduced them, so a chain
  // reads as a chain rather than as an unrelated ring.
  beyond.sort((a, b) => (byId.get(a)?.person.sortName ?? '').localeCompare(byId.get(b)?.person.sortName ?? ''));
  beyond.forEach((id, index) => {
    const node = byId.get(id);
    if (!node) return;
    const introducer = neighbours(id).find((other) => angleOf.has(other));
    const base = introducer !== undefined ? angleOf.get(introducer)! : (index / Math.max(beyond.length, 1)) * Math.PI * 2;
    const spread = ((index % 3) - 1) * 0.22;
    placed.push({
      person: node.person, x: Math.cos(base + spread) * 0.86, y: Math.sin(base + spread) * 0.86,
      ring: 'cluster', label: null,
    });
  });

  // The rim: other islands, grouped so a pair stays a visible pair.
  //
  // Each island gets an arc in proportion to how many people it holds, rather
  // than an equal share — fifteen equal slices put a pair and a single person
  // the same distance apart, and the pairs collided. Radius alternates so two
  // neighbouring islands are separated by depth as well as by angle, which is
  // what stops the top of the rim reading as one long smear.
  const islands = componentsOf(outside.map((node) => node.person.id), neighbours);
  const rimTotal = islands.reduce((sum, island) => sum + island.length, 0);
  let travelled = 0;
  islands.forEach((island, islandIndex) => {
    island.sort((a, b) => (byId.get(a)?.person.sortName ?? '').localeCompare(byId.get(b)?.person.sortName ?? ''));
    const share = (island.length / Math.max(rimTotal, 1)) * Math.PI * 2;
    const base = travelled + share / 2 - Math.PI / 2;
    travelled += share;
    const radius = islandIndex % 2 === 0 ? 1.0 : 1.16;
    island.forEach((id, memberIndex) => {
      const node = byId.get(id);
      if (!node) return;
      const nudge = (memberIndex - (island.length - 1) / 2) * Math.min(share / Math.max(island.length, 1), 0.16);
      placed.push({
        person: node.person,
        x: Math.cos(base + nudge) * radius, y: Math.sin(base + nudge) * radius,
        ring: 'elsewhere', label: null,
      });
    });
  });

  const drawn = new Set(placed.map((entry) => entry.person.id));
  const seenTie = new Set<string>();
  const placedTies: PlacedTie[] = [];
  for (const node of nodes) {
    for (const tie of node.ties) {
      if (seenTie.has(tie.connectionId)) continue;
      seenTie.add(tie.connectionId);
      if (!drawn.has(node.person.id) || !drawn.has(tie.other.id)) continue;
      const touchesFocus = node.person.id === chosen.person.id || tie.other.id === chosen.person.id;
      placedTies.push({
        connectionId: tie.connectionId,
        from: node.person.id,
        to: tie.other.id,
        // Only worded when the focus is an endpoint, and always read outwards
        // from them. A label shown from the wrong end reverses the claim.
        label: touchesFocus
          ? (node.person.id === chosen.person.id ? tie.label : (byId.get(tie.other.id)?.ties.find((t) => t.connectionId === tie.connectionId)?.label ?? null))
          : null,
        touchesFocus,
        unreviewed: tie.unreviewed === true,
      });
    }
  }

  return {
    focus: chosen.person,
    placed,
    ties: placedTies,
    clusterSize: component.size,
    islands: islands.length,
  };
}

function reachableFrom(start: string, neighbours: (id: string) => readonly string[]): Set<string> {
  const seen = new Set<string>([start]);
  const stack = [start];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const next of neighbours(current)) {
      if (seen.has(next)) continue;
      seen.add(next);
      stack.push(next);
    }
  }
  return seen;
}

function componentsOf(ids: readonly string[], neighbours: (id: string) => readonly string[]): string[][] {
  const pool = new Set(ids);
  const found: string[][] = [];
  for (const id of ids) {
    if (!pool.has(id)) continue;
    const reached = [...reachableFrom(id, neighbours)].filter((value) => pool.has(value));
    for (const value of reached) pool.delete(value);
    found.push(reached);
  }
  return found;
}
