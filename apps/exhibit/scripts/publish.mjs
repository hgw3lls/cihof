import { resolve } from 'node:path';
import { buildPeople, buildRuntimeBundle, writeRuntimeBundle, publishFilms, publishPortraits, publishedAttractText, placeWordsState } from '@cihof/pipeline';
import { publishedPlaces } from '@cihof/content';
import { readPlaceSeeds } from '@cihof/pipeline/src/sources/places.ts';
import { resolvePreview, resolveTarget } from './target.mjs';

/**
 * Publishes what this target is allowed to show: the runtime bundle and only
 * the portraits and films the published records clear. Films exist only at the
 * kiosk target; a public build stages none, and `publishPortraits` has already
 * cleared any a previous kiosk build left behind.
 */
const target = resolveTarget();
const people = buildPeople();
const preview = resolvePreview(target);
const bundle = buildRuntimeBundle(people, target, { preview });

if (!bundle.continuationBase) {
  console.log('No CIHOF_SITE_URL configured: this release shows no continuation codes.');
}

writeRuntimeBundle(bundle, resolve('public/data/exhibit.json'));
const assets = publishPortraits(people, resolve('public'));
console.log(`Published ${bundle.people.length} people for ${target} at revision ${bundle.contentRevision}.`);
if (preview) {
  const places = bundle.places.filter((place) => place.unreviewed).length;
  console.log(`Preview: ${places} unreviewed places and ${bundle.candidates.length} proposed ties, each marked.`);
}
console.log(`Published ${assets.copied} portraits; ${assets.skipped} people have none cleared for this target.`);

// The attract screen's words wait for approval like any visitor text. Say why
// they are held back, and the version an approval of these exact words names.
const attract = publishedAttractText(target, { preview });
if (attract.problem) {
  const shown = attract.text ? 'Preview shows the attract words, marked unreviewed' : "Attract screen shows the hall's name alone";
  console.log(`${shown}: ${attract.problem}${attract.contentVersion ? ` (approving these words records contentVersion ${attract.contentVersion})` : ''}.`);
}

// A place approval covers its words. Of the places approved for this target,
// name any held back because the words changed after approval, and any still
// resting on an approval from before approvals recorded the words.
const approvedPlaces = publishedPlaces(readPlaceSeeds(), target);
const changed = approvedPlaces.filter((place) => placeWordsState(place) === 'changed');
const legacy = approvedPlaces.filter((place) => placeWordsState(place) === 'legacy');
if (changed.length > 0) {
  console.log(`${changed.length} place(s) approved for ${target} held back: their words changed after approval (${changed.map((place) => place.name).join(', ')}).`);
}
if (legacy.length > 0) {
  console.log(`${legacy.length} place(s) shown for ${target} on an approval that predates recording the words; the staff review app offers them again.`);
}

if (target === 'kiosk') {
  const films = publishFilms(bundle, resolve('public'));
  console.log(`Staged ${films.films} films' posters, captions and transcripts.`);
  if (films.videosMissing > 0) {
    console.warn(`${films.videosMissing} of ${films.films} films have no MP4 in public/media/videos; those show their words instead.`);
  }
}
