import { buildPeople } from '@cihof/pipeline/src/build/people.ts';
import { publishPortraits } from '@cihof/pipeline/src/build/assets.ts';
import { resolve } from 'node:path';

const people = buildPeople();
const result = publishPortraits(people, resolve('public'));
console.log(`Published ${result.copied} portraits; ${result.skipped} people have none cleared for this target.`);
