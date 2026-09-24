import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

/**
 * Regenerates what is built from the roster and the curated records: the
 * induction crosswalk and the contribution worksheet (npm run crosswalk).
 *
 * The worksheet carries each person's biography and name for whoever writes
 * their contribution, so any tool that changes those runs this after
 * writing, and the change arrives with its generated files current.
 * Resolutions already made are carried forward, never touched.
 */
export function refreshGenerated(root) {
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types', '--no-warnings=ExperimentalWarning',
    join(root, 'packages', 'pipeline', 'scripts', 'crosswalk.mjs'),
  ], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`\n  The crosswalk and worksheet could not be refreshed:\n${result.stderr || result.stdout}`);
    console.error('  The decisions were written. Run npm run crosswalk once the problem is fixed.');
    process.exit(1);
  }
  console.log('  Refreshed the induction crosswalk and the contribution worksheet (npm run crosswalk).');
}
