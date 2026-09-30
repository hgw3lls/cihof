import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Where the display's films come from.
 *
 * A release can leave its films out (npm run package:kiosk-app, the default)
 * so the installer stays small; the display then plays them from a folder
 * chosen once in the admin panel, laid out as the project's
 * public/media/videos is: one folder per person. A release that carries its
 * films plays those, and a chosen folder is looked in first.
 *
 * This counts, for the admin panel, how many of the release's films can be
 * played and from where, so staff can see a folder is the right one before
 * leaving the display.
 */
export function filmsState(siteRoot, folder) {
  let films = [];
  try {
    const bundle = JSON.parse(readFileSync(join(siteRoot, 'data', 'exhibit.json'), 'utf8'));
    films = [...new Set(bundle.people.flatMap((person) => person.films ?? [])
      .filter((film) => film?.source?.kind === 'local-file' && typeof film.source.src === 'string')
      .map((film) => film.source.src))];
  } catch { /* no release: nothing to count */ }
  const base = folder ? resolve(folder) : null;
  let inFolder = 0;
  let inApp = 0;
  const missing = [];
  for (const src of films) {
    const relative = src.replace(/^\/+/, '');
    if (base && relative.startsWith('media/videos/') && existsSync(join(base, relative.slice('media/videos/'.length)))) inFolder += 1;
    else if (existsSync(join(siteRoot, relative))) inApp += 1;
    else missing.push(relative.split('/').pop());
  }
  return { folder: base, folderFound: base ? existsSync(base) : false, total: films.length, inFolder, inApp, missing };
}
