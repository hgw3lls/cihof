import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Person ids in the HOF_WORLD v3 layout, mapped back to this roster.
 *
 * v3 types every id — `person:`, `org:`, `place:` — and while doing so it
 * normalised three person ids that the roster records with a doubled year:
 *
 *   person:carolyn-balogh-2016     carolyn-balogh-2016-2016
 *   person:arnie-de-la-porte-2016  arnie-de-la-porte-2016-2016
 *   person:khalid-samad-2016       khalid-samad-2016-2016
 *
 * Which makes stripping the prefix look like it works. It resolves 82 of the
 * archive's 85 person-to-person edges, and drops three people without saying
 * anything — the worst available outcome, because the gap is invisible and the
 * code that caused it reads as obviously correct.
 *
 * So the map is the only route, and an id the map does not carry resolves to
 * null rather than to a guess. The archive supplies the map itself, at
 * `_meta/id-map.json`, and its own note confirms person ids are the only ones
 * that moved.
 */

export type ChangedId = {
  /** As v3 writes it, prefix included. */
  readonly typedId: string;
  /** As this roster records it. */
  readonly repoId: string;
};

export type HofWorldIds = {
  readonly count: number;
  readonly changed: readonly ChangedId[];
  /**
   * The roster id for a v3 person id, or null.
   *
   * Null is a finding. A caller that treats it as "skip quietly" reintroduces
   * exactly the silent drop this exists to prevent.
   */
  toRepoId(typedId: string): string | null;
  /** Whether the map claims this id moved in the refactor. */
  didChange(typedId: string): boolean;
};

const personPrefix = 'person:';

export function buildIdIndex(document: unknown): HofWorldIds {
  const people = (document as { people?: unknown })?.people;
  if (!Array.isArray(people)) {
    throw new Error('The HOF_WORLD id map has no `people` list. Expected _meta/id-map.json.');
  }

  const byTypedId = new Map<string, string>();
  const changed: ChangedId[] = [];

  for (const entry of people) {
    const record = entry as { id?: unknown; legacyId?: unknown; changed?: unknown };
    const typedId = typeof record.id === 'string' ? record.id : '';
    const repoId = typeof record.legacyId === 'string' ? record.legacyId : '';
    if (!typedId || !repoId) continue;
    if (!typedId.startsWith(personPrefix)) continue;

    byTypedId.set(typedId, repoId);
    if (record.changed === true) changed.push({ typedId, repoId });
  }

  if (byTypedId.size === 0) {
    throw new Error('The HOF_WORLD id map carried no usable person entries.');
  }

  return {
    count: byTypedId.size,
    changed,
    toRepoId: (typedId) => byTypedId.get(typedId) ?? null,
    didChange: (typedId) => changed.some((entry) => entry.typedId === typedId),
  };
}

/** Reads the map from an unpacked v3 archive. The archive stays outside this repo. */
export function readIdIndex(archiveRoot: string): HofWorldIds {
  const path = resolve(archiveRoot, '_meta/id-map.json');
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (cause) {
    throw new Error(`Could not read the HOF_WORLD id map at ${path}: ${(cause as Error).message}`);
  }
  return buildIdIndex(parsed);
}

export type MergeField = {
  readonly repoId: string;
  /** Dotted path into the curated record. Arrays are leaves, not branches. */
  readonly path: string;
  readonly current: unknown;
  readonly incoming: unknown;
  readonly why?: string;
};

export type MergePlan = {
  readonly taken: readonly MergeField[];
  readonly refused: readonly MergeField[];
  readonly identical: number;
};

/**
 * What an archive record may contribute to the record this repository holds.
 *
 * Directional on purpose, and the direction is that the repository wins. The
 * archive is a snapshot; this repository keeps moving, and on 2026-09-22 it
 * moved three heritage attributions the snapshot predates. A field-level merge
 * that preferred the incoming value would undo them silently.
 *
 * So a field the repository has not filled in is taken, and a field where the
 * two disagree is refused and reported. There is no option to reverse that.
 * Replacing a curated value is a curatorial act and belongs in `curate:apply`
 * with a decision behind it.
 */
export function planMerge(repoId: string, incoming: unknown, current: unknown): MergePlan {
  const taken: MergeField[] = [];
  const refused: MergeField[] = [];
  let identical = 0;

  for (const [path, value] of leafEntries(incoming)) {
    const held = valueAt(current, path);
    if (JSON.stringify(held ?? null) === JSON.stringify(value ?? null)) { identical += 1; continue; }
    if (isBlank(held) && !isBlank(value)) { taken.push({ repoId, path, current: held, incoming: value }); continue; }
    refused.push({
      repoId, path, current: held, incoming: value,
      why: isBlank(value) ? 'the archive has nothing here' : 'both are set and they disagree',
    });
  }

  return { taken, refused, identical };
}

/** Every leaf in a record, as a dotted path. Arrays are leaves, not branches. */
export function* leafEntries(value: unknown, prefix = ''): Generator<readonly [string, unknown]> {
  for (const [key, entry] of Object.entries((value ?? {}) as Record<string, unknown>)) {
    const path = `${prefix}${key}`;
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) yield* leafEntries(entry, `${path}.`);
    else yield [path, entry] as const;
  }
}

export function valueAt(record: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (node, key) => (node == null ? undefined : (node as Record<string, unknown>)[key]),
    record,
  );
}

/**
 * Blank enough that taking a value adds rather than replaces.
 *
 * `false` and `0` are values somebody chose. Counting them as blank is how an
 * import turns "reviewed and declined" into "nobody has looked".
 */
export function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

// ------------------------------------------------------------------- places

export type PlaceSeed = {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly shortHistory: string;
  readonly neighborhood: string;
  readonly address?: string;
  /** What the archive says it knows: `curated`, or how the lead was found. */
  readonly authorityStatus: string;
  /**
   * A place somebody wrote a history for, as against a name a harvester found.
   *
   * The distinction decides what the work is. Fourteen of v3's eighty-two are
   * curated; the other sixty-eight carry no `shortHistory` at all, and
   * `PublishedPlace` requires one. Those are not places awaiting review, they
   * are leads awaiting research, and a review sheet that mixed the two would
   * put sixty-eight blank rows in front of somebody expecting to approve.
   */
  readonly researched: boolean;
};

export function readPlaces(archiveRoot: string): PlaceSeed[] {
  const path = resolve(archiveRoot, 'core/places.json');
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as { places?: unknown[] };
  const places = Array.isArray(parsed.places) ? parsed.places : [];
  return places.flatMap((value) => {
    const place = value as Record<string, unknown>;
    const id = typeof place['id'] === 'string' ? place['id'] : '';
    if (!id.startsWith('place:')) return [];
    const shortHistory = text(place['shortHistory']);
    return [{
      id,
      name: text(place['name']),
      type: text(place['type']),
      shortHistory,
      neighborhood: text(place['neighborhood']),
      ...(text(place['address']) ? { address: text(place['address']) } : {}),
      authorityStatus: text(place['authorityStatus']),
      researched: shortHistory.length > 0,
    }];
  });
}

/** How v3 words a person's tie to a place, before anybody assigns a role. */
export type PlaceTieKind = 'associated_with_place' | 'born_in' | 'lived_in' | 'moved_to';

export type PlaceAssociationSeed = {
  readonly id: string;
  readonly person: string;
  readonly place: string;
  readonly kind: PlaceTieKind;
  /** The role a curator assigns. Never guessed from the kind. */
  readonly role: null;
  readonly evidence: readonly { readonly text: string; readonly sourceUrls: readonly string[] }[];
  readonly verificationLayer: string;
};

const placeTieKinds: readonly string[] = ['associated_with_place', 'born_in', 'lived_in', 'moved_to'];

/**
 * Person-to-place ties from the v3 edge table, with no role assigned.
 *
 * `lived_in` looks like it maps straight to the `lived` role and `born_in`
 * looks close enough, and neither is this module's call to make. Being born
 * somewhere is not the same claim as having lived there, and
 * `associated_with_place` — forty-four of the eighty-six — is the catch-all
 * that `placeAssociationProblems` refuses outright because it "does not say
 * what the person did there". Filling the role in here would launder a
 * harvester's verb into a curator's decision.
 *
 * Ties naming a person the id map does not carry are returned as unresolved
 * rather than dropped, so an ingest can report them.
 */
export function readPlaceAssociations(archiveRoot: string, ids: HofWorldIds): {
  readonly associations: readonly PlaceAssociationSeed[];
  readonly unresolved: readonly string[];
} {
  const path = resolve(archiveRoot, 'edges/edges.json');
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as { edges?: unknown[] };
  const edges = Array.isArray(parsed.edges) ? parsed.edges : [];

  const associations: PlaceAssociationSeed[] = [];
  const unresolved: string[] = [];

  for (const value of edges) {
    const edge = value as Record<string, unknown>;
    const kind = text(edge['type']);
    const subject = text(edge['subject']);
    const object = text(edge['object']);
    if (!placeTieKinds.includes(kind)) continue;
    if (!subject.startsWith('person:') || !object.startsWith('place:')) continue;

    const person = ids.toRepoId(subject);
    if (!person) { unresolved.push(subject); continue; }

    const evidence = Array.isArray(edge['evidence']) ? edge['evidence'] : [];
    associations.push({
      id: text(edge['id']),
      person,
      place: object,
      kind: kind as PlaceTieKind,
      role: null,
      evidence: evidence.map((entry) => {
        const record = entry as Record<string, unknown>;
        const urls = record['sourceUrls'];
        return { text: text(record['text']), sourceUrls: Array.isArray(urls) ? urls.map(String) : [] };
      }),
      verificationLayer: text((edge['verification'] as Record<string, unknown>)?.['layer']),
    });
  }

  return { associations, unresolved };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
