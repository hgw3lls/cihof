import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Guards the canonical npm entry points. The collected-count reporter covers an
// ordinary `playwright test`, but a CLI `--reporter` flag replaces the config's
// reporters and silently removes it, so the assertion also runs here where no
// flag can reach it.
const suite = process.argv[2] === 'portal' ? 'portal' : 'visitor';
const config = suite === 'portal' ? 'playwright.portal.config.ts' : 'playwright.config.ts';
const minimums = JSON.parse(readFileSync(resolve('tests/minimum-tests.json'), 'utf8'));
const minimum = Number(process.env.CIHOF_MINIMUM_TESTS ?? minimums[suite]);

const listed = spawnSync(
  process.execPath,
  [resolve('node_modules/@playwright/test/cli.js'), 'test', '--list', '--reporter=line', '-c', config],
  { encoding: 'utf8', env: { ...process.env, PLAYWRIGHT_SKIP_WEB_SERVER: '1' } },
);

if (listed.status !== 0) {
  process.stderr.write(listed.stdout ?? '');
  process.stderr.write(listed.stderr ?? '');
  console.error(`\nCould not collect the ${suite} suite. A spec that throws while loading will do this.\n`);
  process.exit(1);
}

const match = /^Total:\s+(\d+)\s+tests?\s+in\s+(\d+)\s+files?$/m.exec(listed.stdout ?? '');
if (!match) {
  console.error(`\nCould not read a test total from the ${suite} collection output. Playwright's summary format may have changed.\n`);
  process.exit(1);
}

const collected = Number(match[1]);
if (collected < minimum) {
  console.error([
    '',
    `The ${suite} suite collected ${collected} tests in ${match[2]} files, expected at least ${minimum}.`,
    '',
    'A spec that throws while loading, an over-narrow filter, a renamed file or a',
    'deleted one can empty a run without failing it. Find the cause before changing',
    'tests/minimum-tests.json; lowering it is how coverage disappears quietly.',
    '',
  ].join('\n'));
  process.exit(1);
}

console.log(`${suite} suite collects ${collected} tests in ${match[2]} files (minimum ${minimum}).`);
