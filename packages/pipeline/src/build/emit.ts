import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { displayablePortrait, facetable, isAttributable, type PublishedPerson, type VisitorTarget } from '@cihof/content';

/**
 * The runtime bundle a visitor app loads.
 *
 * Carries its own content revision. The previous pipeline computed one and
 * nothing ever read it, so a device could not tell which release's content it
 * was showing and a stale cache was indistinguishable from a current one.
 */
export type RuntimeBundle = {
  readonly schemaVersion: 1;
  readonly target: VisitorTarget;
  readonly contentRevision: string;
  readonly generatedAt: string;
  readonly people: readonly RuntimePerson[];
};

/**
 * A person as the runtime sees them.
 *
 * Flattened deliberately: prose that nobody stands behind is dropped here
 * rather than shipped with a provenance flag for the app to respect. What is
 * not in the bundle cannot be rendered by mistake.
 */
export type RuntimePerson = {
  readonly id: string;
  readonly name: string;
  readonly sortName: string;
  readonly classYear: number | null;
  readonly portrait: { readonly src: string; readonly alt: string; readonly focalPoint?: string } | null;
  readonly biography: string;
  /** True when a curator wrote the biography rather than the institution's record. */
  readonly biographyCurated: boolean;
  readonly contributions: readonly string[];
  readonly communities: readonly string[];
  readonly countries: readonly string[];
  readonly sourceUrl: string | null;
};

export function buildRuntimeBundle(people: readonly PublishedPerson[], target: VisitorTarget): RuntimeBundle {
  const runtimePeople = people.map((person) => toRuntimePerson(person));
  return {
    schemaVersion: 1,
    target,
    contentRevision: revisionOf(runtimePeople),
    generatedAt: new Date().toISOString(),
    people: runtimePeople,
  };
}

export function writeRuntimeBundle(bundle: RuntimeBundle, path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(bundle, null, 2)}\n`);
}

function toRuntimePerson(person: PublishedPerson): RuntimePerson {
  const portrait = displayablePortrait(person.portrait);
  const biography = isAttributable(person.biography) ? person.biography : null;
  return {
    id: person.id,
    name: person.name,
    sortName: person.sortName,
    classYear: person.classYear,
    portrait: portrait
      ? (portrait.focalPoint
        ? { src: portrait.src, alt: portrait.alt, focalPoint: portrait.focalPoint }
        : { src: portrait.src, alt: portrait.alt })
      : null,
    biography: biography?.text ?? '',
    biographyCurated: biography?.provenance === 'curated',
    contributions: facetable(person.contributions),
    communities: facetable(person.communities),
    countries: facetable(person.countries),
    sourceUrl: person.sourceUrl,
  };
}

/**
 * Derived from the content only, never from the build time.
 *
 * Two builds of the same sources produce the same revision, so a device can
 * tell "different release" from "same content, rebuilt".
 */
function revisionOf(people: readonly RuntimePerson[]): string {
  return createHash('sha256').update(JSON.stringify(people)).digest('hex').slice(0, 32);
}
