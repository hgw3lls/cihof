import type { AttractText, PreviewTie, RuntimeBundle, RuntimePerson, RuntimePlace } from '@cihof/pipeline';
import type { PublishedFilm } from '@cihof/content';

/**
 * Loads the published bundle.
 *
 * The bundle is the only source of visitor content. There is deliberately no
 * local override path: the previous implementation read one from browser
 * storage ahead of the published artifact, where it outranked the reviewed
 * content, survived every reset and was invisible outside a staff panel.
 */
const bundleUrl = `${import.meta.env.BASE_URL}data/exhibit.json`;

export async function loadBundle(signal?: AbortSignal): Promise<RuntimeBundle> {
  // `signal: undefined` is not the same as no signal under
  // exactOptionalPropertyTypes, and fetch's own type says so.
  const response = await fetch(bundleUrl, signal ? { signal } : {});
  if (!response.ok) throw new Error(`Collection data could not be loaded (${response.status}).`);

  const payload = (await response.json()) as unknown;
  const bundle = asBundle(payload);
  if (!bundle) throw new Error('Collection data is not in a shape this display can read.');
  return bundle;
}

function asBundle(value: unknown): RuntimeBundle | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<RuntimeBundle>;
  if (candidate.schemaVersion !== 1) return null;
  if (!Array.isArray(candidate.people) || candidate.people.length === 0) return null;
  if (typeof candidate.contentRevision !== 'string' || candidate.contentRevision.length === 0) return null;
  return candidate as RuntimeBundle;
}

export type { AttractText, PreviewTie, RuntimeBundle, RuntimePerson, RuntimePlace, PublishedFilm };
