import { stat } from 'node:fs/promises';
import { contentFormat, contentFormatVersion, contentVersionOf, hashFile } from './content-store.mjs';
import { writeZip } from './zip.mjs';

/**
 * Makes a content update: the zip a display takes in (content-store.mjs says
 * what it holds and how the display checks it). The staff portal makes one
 * from its edits; so does `npm run content:package` for whoever builds and
 * tests the apps.
 *
 * The update lists every file of the new version, but carries only those the
 * display does not already have: `base` is the version it is made from (the
 * display's export), and a file already in it, by checksum, is left out. So a
 * corrected biography travels in kilobytes, and a new film travels once.
 *
 * @param {{
 *   out: string,
 *   site: Record<string, string>,      content path → file on disk (data/…, media/…)
 *   source: Record<string, string>,    source data path → file on disk
 *   films?: Record<string, string>,    "<person>/<file>.mp4" → film on disk
 *   base?: { contentVersion: string, site: object, source: object, films?: object } | null,
 *   createdBy: string,
 *   summary?: string[],
 *   people?: number | null,
 *   exhibitSchemaVersion?: number | null,
 * }} options
 */
export async function makeUpdate({ out, site, source, films = {}, base = null, createdBy, summary = [], people = null, exhibitSchemaVersion = null }) {
  const describe = async (map) => {
    const listed = {};
    const where = new Map();
    for (const [path, file] of Object.entries(map).sort(([a], [b]) => a.localeCompare(b))) {
      const checksum = await hashFile(file);
      listed[path] = { sha256: checksum, bytes: (await stat(file)).size };
      where.set(checksum, file);
    }
    return { listed, where };
  };
  const siteFiles = await describe(site);
  const sourceFiles = await describe(source);
  const filmFiles = await describe(films);
  const manifest = {
    format: contentFormat,
    formatVersion: contentFormatVersion,
    contentVersion: '',
    basedOn: base?.contentVersion ?? null,
    createdAt: new Date().toISOString(),
    createdBy,
    summary,
    people,
    exhibitSchemaVersion,
    site: siteFiles.listed,
    source: sourceFiles.listed,
    films: filmFiles.listed,
  };
  manifest.contentVersion = contentVersionOf(manifest);

  // Only what the display does not have already.
  const have = new Set(base ? [...Object.values(base.site ?? {}), ...Object.values(base.source ?? {}), ...Object.values(base.films ?? {})].map((file) => file.sha256) : []);
  const carried = new Map();
  for (const where of [siteFiles.where, sourceFiles.where, filmFiles.where]) {
    for (const [checksum, file] of where) if (!have.has(checksum)) carried.set(checksum, file);
  }
  await writeZip(out, [
    { name: 'content.json', data: `${JSON.stringify(manifest, null, 2)}\n` },
    ...[...carried].sort(([a], [b]) => a.localeCompare(b)).map(([checksum, file]) => ({ name: `blobs/${checksum}`, path: file })),
  ]);
  return { manifest, carried: carried.size, listed: Object.keys(manifest.site).length + Object.keys(manifest.source).length + Object.keys(manifest.films).length };
}
