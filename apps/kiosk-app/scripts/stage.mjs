import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Assembles the runnable app in stage/: the app's own code, the exhibit's
 * local server and launcher helpers, and (with --site) the exhibit itself.
 *
 *   node scripts/stage.mjs --site=<kiosk build folder>
 *
 * The site is the kiosk build served at "/" — what npm run package:kiosk
 * writes as release/cihof-kiosk-<release>/site. Without --site, a site
 * already staged is kept, so `npm start` can be rerun after code changes.
 */

const app = resolve(import.meta.dirname, '..');
const stage = join(app, 'stage');
const kiosk = resolve(app, '../exhibit/kiosk');
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [key, ...rest] = a.slice(2).split('=');
  return [key, rest.join('=')];
}));

const keptSite = existsSync(join(stage, 'site')) && !args.site;
for (const entry of existsSync(stage) ? ['main.mjs', 'preload.cjs', 'admin-preload.cjs', 'admin', 'policy.mjs', 'settings.mjs', 'server.mjs', 'launch.mjs', 'package.json'] : []) {
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
  rmSync(join(stage, 'site'), { recursive: true, force: true });
  cpSync(site, join(stage, 'site'), { recursive: true });
  console.log(`Staged release ${release.revision} (${bundle.people.length} people).`);
} else if (keptSite) {
  console.log('Kept the site already staged.');
} else {
  console.error('No site staged. Pass --site=<kiosk build folder> (npm run package:kiosk writes one).');
  process.exit(1);
}
console.log(`App staged in ${stage}`);
