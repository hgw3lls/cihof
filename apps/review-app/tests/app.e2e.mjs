/**
 * The staff review app, end to end, in a real Electron window: it starts with
 * no git or Node of its own, reads a data folder, and exports a reviewer's
 * checked decisions as a file that npm run review:import accepts.
 *
 *   npm run package:review-app -- --stage-only
 *   npm run review:data -- --out=<folder>
 *   CIHOF_REVIEW_DATA=<folder> node apps/review-app/tests/app.e2e.mjs
 *   CIHOF_REVIEW_APP_EXECUTABLE=<built app> …   the same checks on a built app
 *
 * Not part of npm test: it launches a browser engine.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron } from '@playwright/test';

const root = resolve(import.meta.dirname, '..', '..', '..');
const data = process.env.CIHOF_REVIEW_DATA;
if (!data) { console.error('Set CIHOF_REVIEW_DATA to a folder made with npm run review:data.'); process.exit(1); }
const electronBinary = process.env.CIHOF_ELECTRON
  ?? join(root, 'apps', 'kiosk-app', 'node_modules', 'electron', 'dist', ...(process.platform === 'darwin' ? ['Electron.app', 'Contents', 'MacOS', 'Electron'] : [process.platform === 'win32' ? 'electron.exe' : 'electron']));
const userData = mkdtempSync(join(tmpdir(), 'cihof-review-app-'));
const exports = join(userData, 'exports');
mkdirSync(userData, { recursive: true });
writeFileSync(join(userData, 'settings.json'), JSON.stringify({ dataFolder: data }));

// A PATH with no git and no Node: the app must not need either.
const env = { ...process.env, PATH: '/nonexistent', CIHOF_REVIEW_USER_DATA: userData, CIHOF_REVIEW_EXPORT_DIR: exports };
const built = process.env.CIHOF_REVIEW_APP_EXECUTABLE;
const app = await electron.launch({ executablePath: built ?? electronBinary, args: built ? [] : [join(root, 'apps', 'review-app')], env });
try {
  const page = await app.firstWindow();
  await page.getByText('Who is reviewing today?').waitFor({ timeout: 60_000 });
  console.log('  ✓ opens the review from the data folder, with no git or Node on the PATH');
  await page.getByLabel('Who is reviewing today?').fill('Test Reviewer');
  await page.getByRole('button', { name: 'Start' }).click();

  await page.getByRole('button', { name: /^Tours/ }).click();
  const tour = page.locator('article.tour').first();
  await tour.getByRole('button', { name: /^Approve it for the exhibit\s*The touchscreen/ }).click();
  await page.getByRole('button', { name: 'Back to the start' }).click();
  await page.getByRole('button', { name: 'Check and export' }).click();
  await page.getByRole('button', { name: 'Check my decisions' }).click();
  await page.getByRole('heading', { name: 'Everything checks out' }).waitFor({ timeout: 60_000 });
  console.log('  ✓ checks a decision with the project\'s own tools, run by the app\'s Node');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('heading', { name: 'Exported' }).waitFor({ timeout: 60_000 });

  const files = readdirSync(exports).filter((name) => name.startsWith('cihof-decisions-test-reviewer-'));
  assert.equal(files.length, 1);
  const document = JSON.parse(readFileSync(join(exports, files[0]), 'utf8'));
  assert.equal(document.reviewer, 'Test Reviewer');
  assert.equal(Object.keys(document.draft.tours).length, 1);
  assert.match(document.sheets.tours, /^tourId,decision,contentVersion,targets,decisionReference,note\n/);
  console.log(`  ✓ exports the decision as ${files[0]}`);

  // The developer's side accepts it (checking only: nothing is written).
  const out = execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings=ExperimentalWarning', join(root, 'scripts', 'import-review-decisions.mjs'), `--input=${join(exports, files[0])}`], { cwd: root, encoding: 'utf8' });
  assert.match(out, /Everything checks out/);
  console.log('  ✓ npm run review:import accepts it');

  await page.getByRole('button', { name: 'Back to the start' }).click();
  await page.getByText('When you have made some decisions, you will export them here.').waitFor();
  console.log('  ✓ the exported decisions have left the app\'s list');
} finally {
  await app.close();
}
