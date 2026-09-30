import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

/**
 * Makes, or brings up to date, the data folder the staff review app reads on
 * a staff computer.
 *
 *   npm run review:data -- --out=<folder>
 *
 * The folder can be anywhere both computers reach, such as a shared drive:
 * the app copies what it needs from it each time it starts. It holds every
 * file git tracks under data/ and public/media/, as in this checkout: the
 * records, the portraits, and the films' posters, captions and transcripts.
 * Never the films. Run it again after pulling or after applying decisions,
 * and the reviewers see the change the next time they open the app. Files no
 * longer in the project are removed from the folder.
 */

const root = resolve(import.meta.dirname, '..');
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [key, ...rest] = a.slice(2).split('=');
  return [key, rest.length > 0 ? rest.join('=') : true];
}));
if (typeof args.out !== 'string' || !args.out) {
  console.error('\nUsage: npm run review:data -- --out=<folder>');
  process.exit(1);
}
const out = resolve(args.out);
if (out === root || out.startsWith(`${root}/data`) || out.startsWith(`${root}/public`)) {
  console.error('\nChoose a folder outside the project\'s data and public folders.');
  process.exit(1);
}

const films = /\.(mp4|m4v|mov|webm|mkv|avi)$/i;
const tracked = execFileSync('git', ['ls-files', '-z', '--', 'data', 'public/media'], { cwd: root, encoding: 'utf8' })
  .split('\0').filter((path) => path && !films.test(path) && existsSync(join(root, path)));

let copied = 0;
for (const path of tracked) {
  const from = join(root, path);
  const to = join(out, path);
  const stat = statSync(from);
  if (existsSync(to)) {
    const current = statSync(to);
    if (current.size === stat.size && Math.abs(current.mtimeMs - stat.mtimeMs) < 2000) continue;
  }
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  utimesSync(to, stat.atime, stat.mtime);
  copied += 1;
}

// What the project no longer has goes from the folder too, inside its data parts only.
const wanted = new Set(tracked);
let removed = 0;
const walk = function* walk(folder) {
  if (!existsSync(folder)) return;
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) yield* walk(path); else yield path;
  }
};
for (const part of ['data', 'public/media']) {
  for (const file of walk(join(out, part))) {
    if (!wanted.has(relative(out, file).split('\\').join('/'))) { rmSync(file, { force: true }); removed += 1; }
  }
}

const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
writeFileSync(join(out, 'REVIEW-DATA.txt'), [
  'CIHOF staff review data',
  '',
  `From the project at commit ${commit}, ${new Date().toISOString()}.`,
  'The staff review app copies what it needs from this folder each time it starts.',
  'Made with npm run review:data. Do not edit the files here: change the project and run it again.',
  '',
].join('\n'));
console.log(`Review data in ${out}: ${tracked.length} files from ${commit}; ${copied} copied, ${removed} removed.`);
