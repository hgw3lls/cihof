import { resolve } from 'node:path';
import { buildPeople, buildRuntimeBundle, writeRuntimeBundle, publishPortraits } from '@cihof/pipeline';

/**
 * Publishes what this target is allowed to show: the runtime bundle and only
 * the portraits the published records clear.
 */
const target = process.env.CIHOF_TARGET === 'public' ? 'public' : 'kiosk';
const people = buildPeople();
const bundle = buildRuntimeBundle(people, target);

writeRuntimeBundle(bundle, resolve('public/data/exhibit.json'));
const assets = publishPortraits(people, resolve('public'));
console.log(`Published ${bundle.people.length} people for ${target} at revision ${bundle.contentRevision}.`);
console.log(`Published ${assets.copied} portraits; ${assets.skipped} people have none cleared for this target.`);
