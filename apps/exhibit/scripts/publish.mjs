import { resolve } from 'node:path';
import { buildPeople, buildRuntimeBundle, writeRuntimeBundle, publishFilms, publishPortraits } from '@cihof/pipeline';
import { resolveTarget } from './target.mjs';

/**
 * Publishes what this target is allowed to show: the runtime bundle and only
 * the portraits and films the published records clear. Films exist only at the
 * kiosk target; a public build stages none, and `publishPortraits` has already
 * cleared any a previous kiosk build left behind.
 */
const target = resolveTarget();
const people = buildPeople();
const bundle = buildRuntimeBundle(people, target);

if (!bundle.continuationBase) {
  console.log('No CIHOF_SITE_URL configured: this release shows no continuation codes.');
}

writeRuntimeBundle(bundle, resolve('public/data/exhibit.json'));
const assets = publishPortraits(people, resolve('public'));
console.log(`Published ${bundle.people.length} people for ${target} at revision ${bundle.contentRevision}.`);
console.log(`Published ${assets.copied} portraits; ${assets.skipped} people have none cleared for this target.`);

if (target === 'kiosk') {
  const films = publishFilms(bundle, resolve('public'));
  console.log(`Staged ${films.films} films' posters, captions and transcripts.`);
  if (films.videosMissing > 0) {
    console.warn(`${films.videosMissing} of ${films.films} films have no MP4 in public/media/videos; those show their words instead.`);
  }
}
