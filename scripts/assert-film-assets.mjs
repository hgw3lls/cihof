import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

/**
 * Every film asset the manifest names must be in the repository.
 *
 * The video payloads are 41 GB and are excluded on purpose, but the captions,
 * posters and transcripts beside them are 11 MB and are required: a film is not
 * published without approved captions and a transcript, whichever player serves
 * the picture. Those files sit inside the ignored folder, so they are tracked by
 * an explicit `git add -f` and nothing adds the next one automatically.
 *
 * Without this check the failure is silent and late: a new film's captions stay
 * untracked, a fresh checkout builds without them, and the film simply never
 * appears on the wall with no error anywhere.
 */

const manifest = JSON.parse(readFileSync('data/media_manifest.json', 'utf8'));
const fields = ['posterFilePath', 'captionFilePath', 'transcriptFilePath'];

const referenced = new Set();
for (const record of Object.values(manifest.assets ?? {})) {
  for (const video of record.videos ?? []) {
    for (const field of fields) {
      const path = typeof video[field] === 'string' ? video[field].trim() : '';
      if (path) referenced.add(path);
    }
  }
}

const paths = [...referenced].sort();
const absent = paths.filter((path) => !existsSync(path));

// `git ls-files` reports only tracked paths, which is exactly the question: will
// a fresh checkout have this file? Asking the filesystem would not tell us.
const tracked = new Set(
  execFileSync('git', ['ls-files', '-z', '--', ...paths], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0')
    .filter(Boolean),
);
const untracked = paths.filter((path) => !tracked.has(path) && existsSync(path));

if (absent.length > 0) {
  console.error(`\n${absent.length} film asset(s) named by the manifest are not on disk:`);
  for (const path of absent.slice(0, 10)) console.error(`  ${path}`);
  if (absent.length > 10) console.error(`  …and ${absent.length - 10} more`);
}

if (untracked.length > 0) {
  console.error(`\n${untracked.length} film asset(s) exist but are not in the repository:`);
  for (const path of untracked.slice(0, 10)) console.error(`  ${path}`);
  if (untracked.length > 10) console.error(`  …and ${untracked.length - 10} more`);
  console.error('\nThey are inside the ignored video folder, so add them deliberately:');
  console.error('  git add -f <paths>');
  console.error('Do not add the .mp4 files: those are 41 GB and stay out.');
}

if (absent.length > 0 || untracked.length > 0) process.exit(1);

console.log(`All ${paths.length} film assets named by the manifest are present and tracked.`);
