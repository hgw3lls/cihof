import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Builds the exhibit with its editor for the staff portal's studio
 * (apps/exhibit/src/app/editor.ts): the display's own exhibit, served by the
 * portal at /exhibit/ on a preview of its copy. It carries no content (the
 * portal publishes its own) and never goes to a display or the website, which
 * both refuse it.
 *
 *   npm run review:shell [-- --out=<folder>]     default apps/review/exhibit-shell
 */

const root = resolve(import.meta.dirname, '..');
const exhibit = join(root, 'apps', 'exhibit');
const outArgument = process.argv.slice(2).find((argument) => argument.startsWith('--out='));
const out = resolve(outArgument ? outArgument.slice('--out='.length) : join(root, 'apps', 'review', 'exhibit-shell'));

const env = { ...process.env, CIHOF_TARGET: 'kiosk', CIHOF_EDITOR: '1', CIHOF_BASE_PATH: '/exhibit/' };
delete env.CIHOF_PREVIEW;
const built = spawnSync(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', out, '--emptyOutDir'], { cwd: exhibit, env, stdio: 'inherit' });
if (built.status !== 0) { console.error('The exhibit with its editor did not build.'); process.exit(built.status ?? 1); }
// The look it needs from public/, and nothing of the content.
for (const part of ['fonts', 'brand']) {
  if (existsSync(join(exhibit, 'public', part))) cpSync(join(exhibit, 'public', part), join(out, part), { recursive: true });
}
for (const part of ['data', 'media']) rmSync(join(out, part), { recursive: true, force: true });
console.log(`The exhibit with its editor, for the staff portal: ${out}`);
