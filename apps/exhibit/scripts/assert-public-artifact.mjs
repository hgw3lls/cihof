import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataFile } from '@cihof/pipeline/src/paths.ts';

/**
 * Refuses to let a kiosk artifact be published.
 *
 * Every other check in this repository validates inputs: `media:validate`
 * checks the manifest is internally consistent, `media:assert` checks the
 * caption files are tracked, `validate:kiosk` checks images are wall-ready.
 * None of them looks at the bytes about to be uploaded and asks whether those
 * bytes are cleared for the audience about to receive them. This does.
 *
 * It exists because the margin is one boolean. All 93 films are approved for
 * the kiosk, with rights, captions and transcripts approved and every path
 * present; `approvedForPublicWeb` is true on none of them. So the difference
 * between a publishable artifact and a breach of a deliberate editorial refusal
 * is a single field, and the build that produces the wrong one produces it
 * silently.
 *
 * Run between build and deploy. A failure here means do not publish — it does
 * not mean loosen the check.
 *
 *   node --experimental-strip-types apps/exhibit/scripts/assert-public-artifact.mjs [distDir]
 */

const here = fileURLToPath(new URL('.', import.meta.url));
const dist = resolve(process.argv[2] ?? join(here, '..', 'dist'));

/** Containers that can carry a moving picture, whatever the manifest calls them. */
const videoExtensions = new Set(['.mp4', '.webm', '.mov', '.m4v', '.mkv', '.ogv', '.avi']);

/**
 * Hosts that play a film from somewhere else.
 *
 * Withholding the payload is not the same as withholding the film: all 93
 * records carry a `youtubeVideoId`, so a kiosk build serves 93 embedded players
 * without a megabyte of video leaving the repository. An artifact that contains
 * no video file and an embed URL has still published the film.
 */
const embedHosts = ['youtube-nocookie.com', 'youtube.com/embed', 'youtu.be/'];

const failures = [];
const fail = (message) => failures.push(message);

// ---------------------------------------------------------------- the bundle

const bundlePath = join(dist, 'data', 'exhibit.json');
let bundle;
try {
  bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));
} catch (cause) {
  console.error(`Cannot read the runtime bundle at ${bundlePath}: ${cause.message}`);
  console.error('Build first: CIHOF_TARGET=public npm run build --workspace @cihof/exhibit');
  process.exit(1);
}

if (bundle.target !== 'public') {
  fail(`the bundle declares target "${bundle.target}", not "public" — this artifact was built for a different audience`);
}

const people = Array.isArray(bundle.people) ? bundle.people : [];
if (people.length === 0) fail('the bundle carries no people at all, which is not a publishable artifact');

const carryingFilms = people.filter((person) => Array.isArray(person.films) && person.films.length > 0);
if (carryingFilms.length > 0) {
  const named = carryingFilms.slice(0, 5).map((person) => `${person.id} (${person.films.length})`).join(', ');
  fail(`${carryingFilms.length} people carry films: ${named}${carryingFilms.length > 5 ? ', …' : ''}`);
}

// Counted from the manifest rather than hard-coded, so adding a 94th film does
// not quietly shrink what "all of them" means.
const manifest = JSON.parse(readFileSync(dataFile('media_manifest.json'), 'utf8'));
const totalHoldings = Object.values(manifest.assets ?? {})
  .reduce((sum, record) => sum + (Array.isArray(record.videos) ? record.videos.length : 0), 0);

const report = bundle.filmReport ?? {};
if (report.held !== totalHoldings) {
  fail(`the film report accounts for ${report.held} held holdings, but the manifest names ${totalHoldings} — some are unaccounted for`);
}

// Held is not enough on its own: a film could be absent because its captions
// went missing rather than because a reviewer withheld it, and that is a
// different situation wearing the same number. Every holding should be held by
// the target decision specifically.
const heldByTarget = report.blockedBy?.target ?? 0;
if (heldByTarget !== totalHoldings) {
  fail(
    `${heldByTarget} of ${totalHoldings} holdings are held by the public-web decision; `
    + `the rest are held by something else (${JSON.stringify(report.blockedBy ?? {})}), which is a content problem, not a clearance one`,
  );
}

// ------------------------------------------------------------- the built bytes

const files = [];
walk(dist);

for (const path of files) {
  if (videoExtensions.has(extname(path).toLowerCase())) {
    fail(`video file in the artifact: ${relative(dist, path)}`);
  }
}

const scannable = new Set(['.js', '.mjs', '.cjs', '.html', '.json', '.css']);
for (const path of files) {
  if (!scannable.has(extname(path).toLowerCase())) continue;
  const text = readFileSync(path, 'utf8');
  for (const host of embedHosts) {
    if (text.includes(host)) fail(`embedded player host "${host}" in ${relative(dist, path)}`);
  }
}

// ------------------------------------------------------------------- verdict

if (failures.length > 0) {
  console.error(`\nThis artifact must not be published. ${failures.length} problem${failures.length === 1 ? '' : 's'}:\n`);
  for (const message of failures) console.error(`  - ${message}`);
  console.error('');
  process.exit(1);
}

console.log(
  `Artifact cleared for publication: target=${bundle.target}, ${people.length} people, `
  + `0 films, ${totalHoldings} holdings held by the public-web decision, ${files.length} files scanned.`,
);

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile() && statSync(path).isFile()) files.push(path);
  }
}
