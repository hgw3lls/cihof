import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Collects the title each held film has on YouTube, for a curator to review.
 *
 * The films were downloaded from YouTube, where each has a title given by
 * whoever posted it. The collection itself records none. These titles are
 * someone else's words, and some make claims ("… inducts his father …"), so
 * they are collected here as unreviewed outside research, like the rest of
 * data/external-research/: nothing reads this file into the exhibit. A
 * curator approves a title, or writes one, in the staff review app (Film
 * titles), and only that reaches the display.
 *
 * YouTube's oEmbed address gives a video's title and uploader without an API
 * key. A film whose title cannot be read (removed, private) is recorded as
 * such rather than guessed.
 *
 *   npm run source:film-titles
 *   npm run source:film-titles -- --delay-ms=500
 */

const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(root, 'data/media_manifest.json');
const outputPath = resolve(root, 'data/external-research/youtube-film-titles.json');
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [key, ...rest] = a.slice(2).split('=');
  return [key, rest.length > 0 ? rest.join('=') : true];
}));
const delayMs = Number(args['delay-ms'] ?? 300);

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const ids = new Map();
for (const [personId, asset] of Object.entries(manifest.assets ?? {})) {
  for (const video of asset.videos ?? []) {
    const id = typeof video.youtubeVideoId === 'string' ? video.youtubeVideoId.trim() : '';
    if (!id) continue;
    if (!ids.has(id)) ids.set(id, []);
    ids.get(id).push(personId);
  }
}

const previous = existsSync(outputPath) ? JSON.parse(readFileSync(outputPath, 'utf8')).films ?? {} : {};
const films = {};
let read = 0;
let missing = 0;
console.log(`Reading the YouTube titles of ${ids.size} films.`);
for (const [id, people] of ids) {
  const url = `https://www.youtube.com/watch?v=${id}`;
  try {
    const response = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`YouTube answered ${response.status}`);
    const body = await response.json();
    films[id] = {
      people,
      url,
      title: typeof body.title === 'string' ? body.title.trim() : '',
      uploader: typeof body.author_name === 'string' ? body.author_name.trim() : '',
      status: 'collected-needs-review',
      collectedAt: new Date().toISOString(),
    };
    read += 1;
  } catch (error) {
    // Kept as it was last read, if it ever was; otherwise recorded as unreadable.
    films[id] = previous[id]?.title
      ? previous[id]
      : { people, url, title: '', uploader: '', status: 'not-readable', note: String(error.message ?? error), collectedAt: new Date().toISOString() };
    missing += 1;
  }
  await new Promise((done) => setTimeout(done, delayMs));
}

writeFileSync(outputPath, `${JSON.stringify({
  schemaVersion: 1,
  source: {
    name: 'YouTube oEmbed',
    note: 'Each held film\'s title as given on YouTube by whoever posted it. Unreviewed outside research: nothing reads this into the exhibit. A curator approves or writes a title in the staff review app.',
  },
  films: Object.fromEntries(Object.entries(films).sort(([a], [b]) => a.localeCompare(b))),
}, null, 2)}\n`);
console.log(`Read ${read} titles${missing ? `; ${missing} could not be read` : ''}. Written to data/external-research/youtube-film-titles.json`);
