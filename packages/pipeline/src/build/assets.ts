import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { publicFile } from '../paths.ts';
import { displayablePortrait, type PublishedPerson } from '@cihof/content';

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
