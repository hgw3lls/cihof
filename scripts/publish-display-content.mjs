import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildPeople, buildRuntimeBundle, publishFilms, publishPortraits, writeRuntimeBundle } from '@cihof/pipeline';

/**
 * Publishes a display's content from the source data in this folder: what the
 * kiosk build puts under data/ and media/, and nothing else.
 *
 *   node --experimental-strip-types scripts/publish-display-content.mjs --out=<folder>
 *
 * The same steps as the exhibit's own publish (apps/exhibit/scripts/
 * publish.mjs), for the kiosk and never a preview, so the staff portal can
 * make a display update with no project, git or build tools: the exhibit's
 * code, fonts and look stay as the display has them. Films stay in the
 * display's films folder; only their posters, captions and transcripts are
 * staged here.
 */

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [key, ...rest] = a.slice(2).split('=');
  return [key, rest.join('=')];
}));
if (!args.out) {
  console.error('Usage: node --experimental-strip-types scripts/publish-display-content.mjs --out=<folder>');
  process.exit(1);
}

const out = resolve(args.out);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const people = buildPeople();
const bundle = buildRuntimeBundle(people, 'kiosk', { preview: false });
writeRuntimeBundle(bundle, join(out, 'data', 'exhibit.json'));
const portraits = publishPortraits(people, out);
const films = publishFilms(bundle, out);
// Films themselves are never part of this: the display plays them from its own folder.
const videos = join(out, 'media', 'videos');
for (const entry of existsSync(videos) ? readdirSync(videos, { recursive: true }) : []) {
  if (/\.(mp4|webm|mov|m4v|mkv|ogv|avi)$/i.test(String(entry))) rmSync(join(videos, String(entry)), { force: true });
}
console.log(JSON.stringify({ people: bundle.people.length, schemaVersion: bundle.schemaVersion ?? null, portraits: portraits.copied, films: films.films }));
