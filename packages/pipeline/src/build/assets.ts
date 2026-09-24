import { copyFileSync, existsSync, linkSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { publicFile } from '../paths.ts';
import { displayablePortrait, type PublishedFilm, type PublishedPerson } from '@cihof/content';

/** The only subtree publishPortraits writes to, and therefore the only one it may clear. */
const mediaRoot = 'media';

/**
 * Copies only the portraits this target actually publishes.
 *
 * The media directory holds 100 MB, most of it gallery images that no reviewed
 * record references yet. Copying the directory would put unpublished assets in
 * a public artifact and rely on nothing linking to them. Copying from the
 * published records instead means the artifact can only contain what a record
 * already cleared for this target.
 */
export function publishPortraits(people: readonly PublishedPerson[], targetDir: string): { copied: number; skipped: number } {
  const sourceRoot = publicFile('.');

  // Clear only the subtree this function owns. Clearing `targetDir` itself would
  // delete everything else published into the same directory — which is exactly
  // what happened to the runtime bundle written moments earlier.
  rmSync(join(targetDir, mediaRoot), { recursive: true, force: true });

  let copied = 0;
  let skipped = 0;

  for (const person of people) {
    const portrait = displayablePortrait(person.portrait);
    if (!portrait) { skipped += 1; continue; }

    const relative = portrait.src.replace(/^\//, '');
    if (!relative.startsWith(`${mediaRoot}/`)) { skipped += 1; continue; }
    const from = join(sourceRoot, relative);
    const to = join(targetDir, relative);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    copied += 1;
  }

  return { copied, skipped };
}

/**
 * Stages the files the kiosk's published films name, next to the portraits.
 *
 * Only a kiosk calls this, and it refuses anything else: keeping video out of
 * the public artifact must not rest on a public bundle happening to list no
 * films. Like the portraits, it copies from the published records rather than
 * the directory, so nothing a record has not cleared can arrive.
 *
 * Posters, captions and transcripts are tracked and must be present. The MP4s
 * are not in the repository, so a checkout without them still builds; each one
 * absent is counted, and that film falls back to its words on the wall.
 * Video is hard-linked where the filesystem allows it, so staging several
 * gigabytes does not also mean copying them.
 */
export function publishFilms(
  bundle: { readonly target: string; readonly people: readonly { readonly films: readonly PublishedFilm[] }[] },
  targetDir: string,
): { films: number; videosMissing: number } {
  if (bundle.target !== 'kiosk') {
    throw new Error(`Films are staged for the kiosk only; this bundle is for "${bundle.target}".`);
  }

  const sourceRoot = publicFile('.');
  const stage = (src: string, { required, video }: { required: boolean; video: boolean }): boolean => {
    const relative = src.replace(/^\//, '');
    if (!relative.startsWith(`${mediaRoot}/`)) throw new Error(`A film asset outside ${mediaRoot}/: ${src}`);
    const from = join(sourceRoot, relative);
    if (!existsSync(from)) {
      if (required) throw new Error(`A published film names ${src}, which is not in public/.`);
      return false;
    }
    const to = join(targetDir, relative);
    mkdirSync(dirname(to), { recursive: true });
    rmSync(to, { force: true });
    if (video) {
      try { linkSync(from, to); return true; } catch { /* another filesystem: copy instead */ }
    }
    copyFileSync(from, to);
    return true;
  };

  let films = 0;
  let videosMissing = 0;
  for (const person of bundle.people) {
    for (const film of person.films) {
      films += 1;
      stage(film.poster, { required: true, video: false });
      stage(film.captions, { required: true, video: false });
      stage(film.transcript, { required: true, video: false });
      if (film.source.kind === 'local-file' && !stage(film.source.src, { required: false, video: true })) {
        videosMissing += 1;
      }
    }
  }
  return { films, videosMissing };
}
