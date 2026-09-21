/**
 * Canonical id derivation.
 *
 * An id is a permanent public URL. Changing how one is derived silently
 * repoints or breaks every link, QR code and saved reference to that person,
 * so this reproduces the existing rule exactly rather than improving on it.
 *
 * Ported from scripts/generate-curated-metadata.js and scripts/data-utils.js,
 * which carried identical copies of `slugify`.
 */

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Derives an id from the roster name and class year.
 *
 * Deliberately does no cleanup. Four harvested names carry a trailing year —
 * "Arnie de la Porte – 2016" — which produces a doubled year in the id:
 * `arnie-de-la-porte-2016-2016`. That is the id already published, and
 * `displayName` was tidied to "Arnie de la Porte" afterwards while the id kept
 * its original derivation. Stripping the suffix here would look like a fix and
 * would repoint four permanent public URLs.
 *
 * Derive from the roster name, never from `displayName`: for those four the
 * display name no longer reproduces the id.
 *
 * This is for people not yet in the roster. An existing person's id is the
 * roster key, which is canonical and is never re-derived.
 */
export function inducteeId(rosterName: string, classYear: number | string): string {
  const year = String(classYear).trim();
  const base = slugify(rosterName);
  return year ? `${base}-${year}` : base;
}
