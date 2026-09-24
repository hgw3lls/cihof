import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Locates the canonical sources independently of where the code is running.
 *
 * Module-relative paths (`new URL('../../data/x', import.meta.url)`) look
 * correct and break as soon as a bundler relocates the module: Astro moves this
 * code into its own output tree and the same expression then resolves to a
 * directory that does not exist. Walking up for the workspace root works from
 * source, from a bundle, and from any working directory.
 */
let cachedRoot: string | null = null;

export function repoRoot(): string {
  if (cachedRoot) return cachedRoot;

  let directory = process.cwd();
  for (let depth = 0; depth < 12; depth += 1) {
    const manifest = join(directory, 'package.json');
    if (existsSync(manifest)) {
      try {
        const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as { workspaces?: unknown };
        if (Array.isArray(parsed.workspaces)) { cachedRoot = directory; return directory; }
      } catch { /* keep walking */ }
    }
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }

  throw new Error('Could not locate the workspace root: no ancestor package.json declares "workspaces".');
}

/** A canonical source under `data/`. Never written by this pipeline. */
export function dataFile(name: string): string {
  return resolve(repoRoot(), 'data', name);
}

/** A file under the existing `public/` tree, used as a media source. */
export function publicFile(name: string): string {
  return resolve(repoRoot(), 'public', name);
}


/** Any path relative to the workspace root, given in full (e.g. `data/review-sheets/...`). */
export function repoFile(relativePath: string): string {
  return resolve(repoRoot(), relativePath);
}
