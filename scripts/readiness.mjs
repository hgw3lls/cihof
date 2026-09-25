import { resolve } from 'node:path';
import { loadReview } from '../apps/review/server/data.mjs';
import { readiness, readSignoffs } from '../apps/review/server/readiness.mjs';

/**
 * What still stands between the exhibit and opening day.
 *
 *   npm run readiness            the list
 *   npm run readiness -- --strict   and fail if anything is still open
 *
 * Read from the records: the review states and data/cihof_opening_signoffs.json.
 * It changes nothing.
 */
const root = resolve(import.meta.dirname, '..');
const lines = readiness(loadReview(), readSignoffs(root));
const open = lines.filter((line) => line.open > 0);

console.log('\nReady for opening?\n');
let group = '';
for (const line of lines) {
  if (line.group !== group) { group = line.group; console.log(`  ${group}`); }
  const mark = line.open === 0 ? '✓' : '·';
  const count = line.total === 1 ? '' : `  ${line.done} of ${line.total}`;
  console.log(`    ${mark} ${line.title}${count}${line.open > 0 ? `   (${line.where})` : ''}`);
}
console.log(open.length === 0
  ? '\n  Everything the records track is done.\n'
  : `\n  ${open.length} of ${lines.length} still open.\n`);
if (process.argv.includes('--strict') && open.length > 0) process.exit(1);
