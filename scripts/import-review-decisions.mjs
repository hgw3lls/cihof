import { resolve } from 'node:path';
import { readDecisionsFile } from '../apps/review/server/export.mjs';
import { check, save } from '../apps/review/server/save.mjs';
import { draftCounts } from '../apps/review/server/sheets.mjs';

/**
 * Brings a reviewer's decisions, exported from the staff review app on a
 * staff computer, into the project.
 *
 *   npm run review:import -- --input=<cihof-decisions-….json>            check only
 *   npm run review:import -- --input=<cihof-decisions-….json> --apply    save
 *
 * It does exactly what saving does when the review app runs in the project:
 * each kind of review is applied by its own tool and becomes its own commit,
 * with the reviewer's name and the day they decided. The project must have no
 * other changes first. The tools check every decision again against the data
 * as it is now: an approval of something that has changed since the reviewer
 * saw it is refused, never saved, and that kind of review is left for them to
 * look at again. Nothing is pushed.
 */

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [key, ...rest] = a.slice(2).split('=');
  return [key, rest.length > 0 ? rest.join('=') : true];
}));
const root = resolve(import.meta.dirname, '..');

if (typeof args.input !== 'string') {
  console.error('\nUsage: npm run review:import -- --input=<decisions file> [--apply]');
  process.exit(1);
}
const { document, problem } = readDecisionsFile(resolve(args.input));
if (problem) { console.error(`\n${problem}`); process.exit(1); }

const counts = Object.entries(draftCounts(document.draft)).filter(([, count]) => count > 0);
console.log(`\nDecisions by ${document.reviewer}, made on ${document.day}, exported ${document.exportedAt}.`);
if (document.dataFrom) console.log(`They reviewed data from ${document.dataFrom}.`);
console.log(`  ${counts.map(([task, count]) => `${task} ${count}`).join(' · ') || 'none'}`);
console.log(`  Who may see the connections: ${document.audience === 'kiosk-and-web' ? 'the exhibit and the public website' : 'the exhibit only'}`);

const options = { root, draft: document.draft, audience: document.audience, day: document.day };
if (!args.apply) {
  const results = check(options);
  for (const result of results) {
    console.log(`\n${result.ok ? '✓' : '✗'} ${result.title}: ${result.count} decision${result.count === 1 ? '' : 's'}`);
    if (!result.ok) console.log(result.output.split('\n').map((line) => `    ${line}`).join('\n'));
  }
  const ok = results.every((result) => result.ok);
  console.log(ok
    ? `\nEverything checks out. To save: npm run review:import -- --input=${args.input} --apply\n`
    : '\nSomething was refused. Nothing was written. The reviewer should look at it again in the app.\n');
  process.exit(ok ? 0 : 1);
}

const { results, draft } = save(options);
for (const result of results) {
  console.log(`\n${result.ok ? '✓' : '✗'} ${result.title}: ${result.ok ? (result.commit ? `saved as ${result.commit}` : 'already recorded') : 'not saved'}`);
  if (!result.ok) console.log(result.output.split('\n').map((line) => `    ${line}`).join('\n'));
}
const left = Object.entries(draftCounts(draft)).filter(([, count]) => count > 0);
if (left.length > 0) {
  console.log(`\nNot saved: ${left.map(([task, count]) => `${task} ${count}`).join(' · ')}. Nothing of the part that failed was kept.`);
  process.exit(1);
}
console.log('\nSaved. Look the commits over, then push them.\n');
