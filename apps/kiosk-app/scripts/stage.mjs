import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { listSource } from '../src/content-store.mjs';

/**
 * Assembles the runnable app in stage/: the app's own code, the exhibit's
 * local server and launcher helpers, and (with --site) the exhibit itself.
 *
 *   node scripts/stage.mjs --site=<kiosk build folder>
 *
 * The site is the kiosk build served at "/" — what npm run package:kiosk
 * writes as release/cihof-kiosk-<release>/site. Without --site, a site
 * already staged is kept, so `npm start` can be rerun after code changes.
 *
 * Beside it, in content-source/, the source it was built from: every file git
 * tracks under the project's data/ and public/media/ (the records, portraits,
 * and the films' posters, captions and transcripts; never the films), with a
 * list of their checksums.
 * The display keeps it so that the staff portal can always start an update
 * from what the display shows, delivered content included.
 */

const app = resolve(import.meta.dirname, '..');
const stage = join(app, 'stage');
const kiosk = resolve(app, '../exhibit/kiosk');
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [key, ...rest] = a.slice(2).split('=');
  return [key, rest.join('=')];
}));

const keptSite = existsSync(join(stage, 'site')) && !args.site;
for (const entry of existsSync(stage) ? ['main.mjs', 'preload.cjs', 'admin-preload.cjs', 'admin', 'policy.mjs', 'settings.mjs', 'watch.mjs', 'films-folder.mjs', 'content-store.mjs', 'content-package.mjs', 'zip.mjs', 'connection.mjs', 'connection-auth.mjs', 'server.mjs', 'launch.mjs', 'package.json'] : []) {
  rmSync(join(stage, entry), { recursive: true, force: true });
}
mkdirSync(stage, { recursive: true });

cpSync(join(app, 'src'), stage, { recursive: true });
cpSync(join(kiosk, 'server.mjs'), join(stage, 'server.mjs'));
cpSync(join(kiosk, 'launch.mjs'), join(stage, 'launch.mjs'));

const own = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'));
writeFileSync(join(stage, 'package.json'), `${JSON.stringify({
  name: 'cihof-exhibit',
  productName: 'CIHOF Exhibit',
  version: own.version,
  description: 'Cleveland International Hall of Fame interactive exhibit',
  author: 'Tony Yanick',
  license: 'UNLICENSED',
  type: 'module',
  main: 'main.mjs',
}, null, 2)}\n`);

if (args.site) {
  const site = resolve(args.site);
  if (!existsSync(join(site, 'index.html')) || !existsSync(join(site, 'release.json'))) {
    console.error(`${site} is not a kiosk build (no index.html or release.json).`);
    process.exit(1);
  }
  const release = JSON.parse(readFileSync(join(site, 'release.json'), 'utf8'));
  const bundle = JSON.parse(readFileSync(join(site, 'data', 'exhibit.json'), 'utf8'));
  if (release.base !== '/' || bundle.target !== 'kiosk' || bundle.preview) {
    console.error(`${site} is not a kiosk build served at "/" (base ${release.base}, target ${bundle.target}${bundle.preview ? ', preview' : ''}).`);
    process.exit(1);
  }
  // The staff portal's editing (apps/exhibit/src/app/editor.ts) is for its own copy, never the display's.
  const assets = join(site, 'assets');
  if (existsSync(assets) && readdirSync(assets).some((name) => name.endsWith('.js') && readFileSync(join(assets, name), 'utf8').includes('cihof-editor-bridge'))) {
    console.error(`${site} is the staff portal's editing copy of the exhibit, not a display's.`);
    process.exit(1);
  }
  rmSync(join(stage, 'site'), { recursive: true, force: true });
  cpSync(site, join(stage, 'site'), { recursive: true });
  console.log(`Staged release ${release.revision} (${bundle.people.length} people).`);

  // The source, as git tracks it in the project this app is built from: what the review data folder holds.
  const project = resolve(app, '../..');
  const source = join(stage, 'content-source');
  rmSync(source, { recursive: true, force: true });
  const tracked = execFileSync('git', ['ls-files', '-z', '--', 'data', 'public/media'], { cwd: project, encoding: 'utf8' }).split('\0')
    .filter((path) => path && !/\.(mp4|m4v|mov|webm|mkv|avi)$/i.test(path) && existsSync(join(project, path)));
  for (const path of tracked) {
    mkdirSync(dirname(join(source, path)), { recursive: true });
    cpSync(join(project, path), join(source, path));
  }
  writeFileSync(join(source, 'content.json'), `${JSON.stringify({ source: await listSource(source) }, null, 2)}\n`);
  console.log(`Staged the source: ${tracked.length} files.`);
} else if (keptSite) {
  console.log('Kept the site already staged.');
} else {
  console.error('No site staged. Pass --site=<kiosk build folder> (npm run package:kiosk writes one).');
  process.exit(1);
}
console.log(`App staged in ${stage}`);
